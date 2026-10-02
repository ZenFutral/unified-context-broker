import type * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const CONTEXT_BROKER_RULE_CONTENT = `# Context Broker MCP — Directive & Discovery Rules

**MANDATORY:** Prioritize \`context-broker\` MCP tools over raw file reads or unbounded searches.

## Directives
1. **Search Context:** ALWAYS call \`search_context(query)\` before searching files. Never run unbounded file greps.
2. **Symbol Lookup:** ALWAYS call \`get_symbol_context(symbol)\` to view definitions/signatures instead of loading full files.
3. **Blast Radius Check:** ALWAYS call \`get_impact_context(symbol)\` before refactoring or removing code.
4. **Architecture Map:** ALWAYS call \`get_repository_map()\` to explore project layout.
5. **Architectural Memory:** ALWAYS call \`recall_decisions(query)\` before making structural changes, and \`record_decision(title, decision, rationale)\` after architectural consensus.
6. **Provider Health:** Call \`backend_health()\` to verify provider status.
7. **Safe Mutation:** Use \`search_and_replace(path, find, replace)\` for atomic file edits.

## Quick Lookup Table
| Intent | Tool |
| :--- | :--- |
| Find code / concepts | \`search_context\` |
| Inspect symbol definition | \`get_symbol_context\` |
| Check change impact | \`get_impact_context\` |
| Overview codebase | \`get_repository_map\` |
| Check / record ADRs | \`recall_decisions\` / \`record_decision\` |
| Edit files safely | \`search_and_replace\` |

## Forbidden
- NO reading entire files for single symbol lookups.
- NO modifying shared APIs without \`get_impact_context\`.
- NO ignoring recorded ADRs.
`;

/**
 * Finds the server entry path: checks extension bundle first, then workspace fallbacks.
 */
export function resolveServerEntryPath(extensionUri?: vscode.Uri): string | undefined {
  if (extensionUri) {
    const extFsPath = extensionUri.fsPath;
    const candidates = [
      path.join(extFsPath, 'server', 'server.mjs'),
      path.join(extFsPath, 'server', 'bundle.js'),
      path.join(extFsPath, 'dist', 'server.mjs'),
      path.join(extFsPath, 'dist', 'bundle.js'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  }

  let workspaceFolders: Array<{ uri: { fsPath: string } }> | undefined;
  try {
    const vscodeModule = Function('return require("vscode")')();
    workspaceFolders = vscodeModule?.workspace?.workspaceFolders;
  } catch {
    // Outside VS Code runtime
  }

  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const devCandidates = [
        path.join(folder.uri.fsPath, 'apps', 'mcp-server', 'dist', 'bundle.js'),
        path.join(folder.uri.fsPath, 'apps', 'mcp-server', 'dist', 'index.js'),
        path.join(folder.uri.fsPath, 'unified-context-broker', 'apps', 'mcp-server', 'dist', 'bundle.js'),
        path.join(folder.uri.fsPath, 'unified-context-broker', 'apps', 'mcp-server', 'dist', 'index.js'),
      ];
      for (const c of devCandidates) {
        if (fs.existsSync(c)) {
          return c;
        }
      }
    }
  }

  return undefined;
}

/**
 * Deploys MCP server configuration to C:/Users/<user>/.gemini/config/mcp_config.json and .agents/mcp_config.json.
 */
export function configureWorkspaceMcp(workspaceRoot: string, serverPath: string): boolean {
  let modifiedAny = false;
  const normalizedServerPath = serverPath.replace(/\\/g, '/');

  const geminiConfigPath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
  const targets = [
    geminiConfigPath,
    path.join(workspaceRoot, '.agents', 'mcp_config.json')
  ];

  for (const targetFile of targets) {
    try {
      let config: { mcpServers?: Record<string, { command: string; args: string[] }> } = {};
      if (fs.existsSync(targetFile)) {
        const raw = fs.readFileSync(targetFile, 'utf8');
        try {
          config = JSON.parse(raw);
        } catch {
          config = {};
        }
      }

      if (!config.mcpServers) {
        config.mcpServers = {};
      }

      const existing = config.mcpServers['context-broker'];
      const currentArgs = existing?.args?.[0]?.replace(/\\/g, '/');

      if (!existing || currentArgs !== normalizedServerPath) {
        config.mcpServers['context-broker'] = {
          command: 'node',
          args: [normalizedServerPath]
        };

        const targetDir = path.dirname(targetFile);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.writeFileSync(targetFile, JSON.stringify(config, null, 2), 'utf8');
        modifiedAny = true;
      }
    } catch (err) {
      console.warn(`[ContextBroker] Failed to configure MCP at ${targetFile}:`, err);
    }
  }

  return modifiedAny;
}

/**
 * Deploys rule to .agents/rules/context-broker.md and AGENTS.md.
 */
export function deployAgentRules(workspaceRoot: string, serverPath?: string): boolean {
  let createdOrUpdated = false;

  // 1. Write .agents/rules/context-broker.md
  try {
    const rulesDir = path.join(workspaceRoot, '.agents', 'rules');
    const ruleFile = path.join(rulesDir, 'context-broker.md');
    if (!fs.existsSync(rulesDir)) {
      fs.mkdirSync(rulesDir, { recursive: true });
    }
    if (!fs.existsSync(ruleFile)) {
      fs.writeFileSync(ruleFile, CONTEXT_BROKER_RULE_CONTENT, 'utf8');
      createdOrUpdated = true;
    }
  } catch (err) {
    console.warn('[ContextBroker] Failed to scaffold .agents/rules/context-broker.md:', err);
  }

  // 2. Deploy or update delimited block in AGENTS.md (or agent.md)
  try {
    const startTag = '<!-- CONTEXT_BROKER_START -->';
    const endTag = '<!-- CONTEXT_BROKER_END -->';

    const serverDisplay = serverPath ? serverPath.replace(/\\/g, '/') : 'node ./unified-context-broker/apps/mcp-server/dist/bundle.js';

    const skillBlock = `${startTag}
## Context Broker Retrieval Engine

Context Broker provides ultra-fast hybrid retrieval (lexical + vector + AST code graph + git freshness) and durable memory.
When inspecting, navigating, or modifying this repository, prioritize calling the Context Broker MCP tools over brute-force file reads.

### Canonical MCP Tools
- \`search_context(query, tokenBudget?)\` — Hybrid search across code, docs, and git changes.
- \`get_symbol_context(symbol)\` — Exact symbol definition, signature, callers, and references.
- \`get_impact_context(symbol)\` — Blast radius and downstream callers before refactoring.
- \`get_repository_map()\` — High-level architecture map and entry points.
- \`recall_decisions(query)\` — Historical architectural decision memory (ADRs).
- \`record_decision(title, decision, rationale)\` — Persist architectural choices to durable memory.
- \`backend_health()\` — Health diagnostics across all 5 adapters (comP, CodeGraph, Vector, Git, Memory).
- \`search_and_replace(path, find, replace)\` — Safe atomic AST-verified mutation with secret scrubbing.

### MCP Server Location
\`node "${serverDisplay}"\`
${endTag}`;

    let agentsFile = path.join(workspaceRoot, 'AGENTS.md');
    if (!fs.existsSync(agentsFile) && fs.existsSync(path.join(workspaceRoot, 'agent.md'))) {
      agentsFile = path.join(workspaceRoot, 'agent.md');
    }

    if (fs.existsSync(agentsFile)) {
      const content = fs.readFileSync(agentsFile, 'utf8');
      if (content.includes(startTag) && content.includes(endTag)) {
        const before = content.split(startTag)[0];
        const after = content.split(endTag)[1];
        const updated = before + skillBlock + after;
        if (updated !== content) {
          fs.writeFileSync(agentsFile, updated, 'utf8');
          createdOrUpdated = true;
        }
      } else {
        fs.writeFileSync(agentsFile, content.trimEnd() + '\n\n' + skillBlock + '\n', 'utf8');
        createdOrUpdated = true;
      }
    } else {
      fs.writeFileSync(agentsFile, skillBlock + '\n', 'utf8');
      createdOrUpdated = true;
    }
  } catch (err) {
    console.warn('[ContextBroker] Failed to scaffold AGENTS.md:', err);
  }

  return createdOrUpdated;
}

/**
 * Deploys the single external indicator to AGENTS.md strictly without polluting host root.
 */
export function deploySingleIndicatorToAgentsMd(
  workspaceRoot: string,
  brokerFolderName: string = 'unified-context-broker'
): boolean {
  const startTag = '<!-- CONTEXT_BROKER_START -->';
  const endTag = '<!-- CONTEXT_BROKER_END -->';

  const relPrefix = `./${brokerFolderName}`;

  const skillBlock = `${startTag}
## Context Broker Retrieval Engine (Embedded)

This codebase embeds a self-contained context engine at \`${relPrefix}/\`.
When inspecting, searching, navigating, or refactoring this repository, prioritize the embedded broker over brute-force file reads.

### Direct Retrieval Commands (Zero-Daemon CLI)
- **Hybrid Search:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js search "<query>" --budget 8000\`
- **Symbol Lookup:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js symbol <name> [--file <path>]\`
- **Repository Structure Digest:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js digest\`
- **Architectural Memory Recall:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js memory recall "<query>"\`
- **Persist Decision:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js memory record --title "<title>" --decision "<decision>" --rationale "<rationale>"\`
- **Engine Diagnostics:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js --health\`
- **Safe Source Mutation:** \`node ${relPrefix}/packages/orchestrator/bin/cli.js replace <file> --find "<target>" --replace "<replacement>"\`

### MCP Integration (IDE & Multi-Agent Swarms)
- **MCP Server Binary:** \`node ${relPrefix}/apps/mcp-server/dist/bundle.js\` (or \`node ${relPrefix}/apps/mcp-server/dist/index.js\`)
- **Canonical Tools:** \`search_context\`, \`get_symbol_context\`, \`lookup_symbol\`, \`get_impact_context\`, \`analyze_impact\`, \`get_repository_map\`, \`get_repo_map\`, \`recall_decisions\`, \`record_decision\`, \`explain_context\`, \`backend_health\`, \`check_health\`, \`search_and_replace\`, \`replace_in_file\`, \`patch_file\`
${endTag}`;

  let agentsFile = path.join(workspaceRoot, 'AGENTS.md');
  if (!fs.existsSync(agentsFile) && fs.existsSync(path.join(workspaceRoot, 'agent.md'))) {
    agentsFile = path.join(workspaceRoot, 'agent.md');
  }

  let createdOrUpdated = false;
  if (fs.existsSync(agentsFile)) {
    const content = fs.readFileSync(agentsFile, 'utf8');
    if (content.includes(startTag) && content.includes(endTag)) {
      const before = content.split(startTag)[0];
      const after = content.split(endTag)[1];
      const updated = before + skillBlock + after;
      if (updated !== content) {
        fs.writeFileSync(agentsFile, updated, 'utf8');
        createdOrUpdated = true;
      }
    } else {
      fs.writeFileSync(agentsFile, content.trimEnd() + '\n\n' + skillBlock + '\n', 'utf8');
      createdOrUpdated = true;
    }
  } else {
    fs.writeFileSync(agentsFile, skillBlock + '\n', 'utf8');
    createdOrUpdated = true;
  }

  return createdOrUpdated;
}

/**
 * Ensures workspace is completely initialized with self-contained MCP configuration and rules.
 */
export function ensureWorkspaceInitialized(
  workspaceRoot: string,
  serverEntryPath?: string,
  _force: boolean = false
): { ruleCreated: boolean; mcpConfigCreated: boolean } {
  const rulesUpdated = deployAgentRules(workspaceRoot, serverEntryPath);
  let mcpUpdated = false;

  if (serverEntryPath) {
    mcpUpdated = configureWorkspaceMcp(workspaceRoot, serverEntryPath);
  }

  return { ruleCreated: rulesUpdated, mcpConfigCreated: mcpUpdated };
}
