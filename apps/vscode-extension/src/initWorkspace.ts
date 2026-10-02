import type * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_CONTEXT_BROKER_RULE } from '@context-broker/contracts';

export const CONTEXT_BROKER_RULE_CONTENT = DEFAULT_CONTEXT_BROKER_RULE;


/**
 * Ensures that the target workspace contains the Context Broker rule and configurations.
 */
export function deploySingleIndicatorToAgentsMd(workspaceRoot: string, brokerFolderName: string = 'unified-context-broker'): boolean {
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
 * Ensures that the target workspace contains the Context Broker single external indicator (AGENTS.md).
 */
export function ensureWorkspaceInitialized(
  workspaceRoot: string,
  _serverEntryPath?: string,
  _force: boolean = false
): { ruleCreated: boolean; mcpConfigCreated: boolean } {
  const brokerFolder = 'unified-context-broker';

  const updated = deploySingleIndicatorToAgentsMd(workspaceRoot, brokerFolder);
  return { ruleCreated: updated, mcpConfigCreated: false };
}

/**
 * Finds the server entry path relative to extension or monorepo workspace.
 */
export function resolveServerEntryPath(extensionUri?: vscode.Uri): string | undefined {
  let workspaceFolders: Array<{ uri: { fsPath: string } }> | undefined;
  try {
    // Dynamic import for vscode module in VS Code extension runtime
    const vscodeModule = Function('return require("vscode")')();
    workspaceFolders = vscodeModule?.workspace?.workspaceFolders;
  } catch {
    // Node environment outside VS Code runtime
  }

  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const candidate1 = path.join(folder.uri.fsPath, 'context-broker', 'apps', 'mcp-server', 'dist', 'index.js');
      if (fs.existsSync(candidate1)) return candidate1;

      const candidate2 = path.join(folder.uri.fsPath, 'apps', 'mcp-server', 'dist', 'index.js');
      if (fs.existsSync(candidate2)) return candidate2;
    }
  }

  if (extensionUri) {
    const extFsPath = extensionUri.fsPath;
    const candidateExt = path.join(extFsPath, '..', '..', 'context-broker', 'apps', 'mcp-server', 'dist', 'index.js');
    if (fs.existsSync(candidateExt)) return candidateExt;
  }

  return undefined;
}

