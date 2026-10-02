import type * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const CONTEXT_BROKER_RULE_CONTENT = `# Context Broker MCP — Tool Usage & Discovery Enforcement

This rule enforces the mandatory use of the **Context Broker MCP** tools (\`context-broker\`) whenever navigating, searching, analyzing, or modifying this codebase.

## 🚨 MANDATORY DIRECTIVES

All AI assistants and agents operating in this workspace MUST follow these directives:

### 1. Mandatory Pre-Search with \`search_context\`
- **DO NOT** perform blind global searches (e.g. running unbounded ripgrep, reading entire directories, or querying generic regexes across all files) when seeking implementations, features, or architectural concepts.
- **MUST CALL** \`search_context(query, tokenBudget?)\` first.
  - Context Broker uses hybrid rank fusion across BM25 lexical search, semantic vector retrieval, code graph expansion, and git freshness.
  - This delivers high-precision, deduplicated code slices and saves up to 80–90% of token context.

### 2. Precise Symbol Lookups with \`get_symbol_context\`
- **DO NOT** read hundreds of lines of source code just to inspect a class, function, type definition, or interface.
- **MUST CALL** \`get_symbol_context(symbol, maxCallers?, maxReferences?)\`.
  - It retrieves the precise definition, docstring, parameter signatures, call sites, and caller dependencies directly from the structural graph.

### 3. Mandatory Blast Radius Check with \`get_impact_context\`
- **BEFORE** refactoring, renaming, altering signatures, or removing functions, classes, or interfaces, you **MUST CALL** \`get_impact_context(symbol, depth?)\`.
  - Inspect downstream callers, transitive dependencies, and blast radius to ensure changes will not introduce regressions.

### 4. Repository Orientation with \`get_repository_map\`
- When asked about high-level codebase architecture, module responsibilities, entry points, or workspace layout, **MUST CALL** \`get_repository_map()\`.
  - Avoid scanning folders manually or reading every package manifest.

### 5. Architectural Memory Verification with \`recall_decisions\`
- **BEFORE** proposing significant architectural modifications, adopting new dependencies, or altering core abstractions, **MUST CALL** \`recall_decisions(query, tags?)\`.
  - Check whether a prior Architectural Decision Record (ADR) or trade-off analysis already addresses the question or prohibits the proposed change.

### 6. Durable Decision Persistence with \`record_decision\`
- **AFTER** agreeing on, implementing, or modifying significant architectural patterns, frameworks, or database schemas, **MUST CALL** \`record_decision(title, decision, rationale, alternatives?)\`.
  - This preserves context in durable memory across long sessions and agent swarms.

### 7. Diagnostics & Provider Verification with \`backend_health\`
- If retrieval results appear incomplete or if adapter connectivity is suspected to be degraded, call \`backend_health()\` to inspect the status, latency, and counts across all 5 adapters (comP, CodeGraphContext, Vector, Git, Memory).

### 8. Atomic Source Mutation with \`search_and_replace\`
- **WHEN** modifying source code, updating configuration, or refactoring implementations, **PREFER** calling \`search_and_replace(path, find, replace, expectedOccurrences?, dryRun?)\` (aliases: \`replace_in_file\`, \`patch_file\`).
- This guarantees:
  - Exact character sequence verification with occurrence validation.
  - Automatic pre-commit secret scrubbing (blocks leaked API keys, tokens, or private credentials).
  - Workspace boundary jail enforcement (blocks path traversal outside root).
  - Dry-run verification before writing changes to disk.

---

## 🧭 Tool Selection Flowchart

| Developer Intent | Required Tool | When to Call |
| :--- | :--- | :--- |
| Find code, concepts, implementations | \`search_context\` | First step before reading files |
| Inspect a specific symbol / class / function | \`get_symbol_context\` | Instead of viewing entire file |
| Modify, refactor, or delete a symbol | \`get_impact_context\` | Before writing code edits |
| Understand workspace structure & modules | \`get_repository_map\` | Onboarding or structural overview |
| Check prior architectural choices / ADRs | \`recall_decisions\` | Before proposing design changes |
| Save an architectural choice / ADR | \`record_decision\` | After reaching a design consensus |
| Diagnose ranking / relevance reasoning | \`explain_context\` | Debugging context ranking |
| Check system status & adapter connections | \`backend_health\` | On connection error or startup |
| Safely patch or replace code in a file | \`search_and_replace\` (\`replace_in_file\`) | Source modification / refactoring |

---

## 🚫 Strictly Forbidden Anti-Patterns

1. **NO Raw Code Dumps**: Do not read multiple full files into context when a targeted symbol lookup (\`get_symbol_context\`) or hybrid search (\`search_context\`) provides the exact slice needed.
2. **NO Blind Refactoring**: Do not modify public APIs or core utilities without verifying downstream dependencies via \`get_impact_context\`.
3. **NO Ignored ADRs**: Do not reverse or re-litigate decisions documented in the memory store without first reviewing them via \`recall_decisions\`.
4. **NO Unverified Multi-Line Overwrites**: Do not blind-overwrite entire files or emit hallucinated patches without verifying exact target content or performing a dry-run via \`search_and_replace\`.
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
 * Deploys MCP server configuration to .vscode/mcp.json and .agents/mcp_config.json.
 */
export function configureWorkspaceMcp(workspaceRoot: string, serverPath: string): boolean {
  let modifiedAny = false;
  const normalizedServerPath = serverPath.replace(/\\/g, '/');

  const targets = [
    path.join(workspaceRoot, '.vscode', 'mcp.json'),
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
