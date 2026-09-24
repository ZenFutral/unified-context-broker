import * as vscode from 'vscode';
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

---

## 🚫 Strictly Forbidden Anti-Patterns

1. **NO Raw Code Dumps**: Do not read multiple full files into context when a targeted symbol lookup (\`get_symbol_context\`) or hybrid search (\`search_context\`) provides the exact slice needed.
2. **NO Blind Refactoring**: Do not modify public APIs or core utilities without verifying downstream dependencies via \`get_impact_context\`.
3. **NO Ignored ADRs**: Do not reverse or re-litigate decisions documented in the memory store without first reviewing them via \`recall_decisions\`.
`;

/**
 * Ensures that the target workspace contains the Context Broker rule and configurations.
 */
export function ensureWorkspaceInitialized(
  workspaceRoot: string,
  serverEntryPath?: string,
  force: boolean = false
): { ruleCreated: boolean; mcpConfigCreated: boolean } {
  let ruleCreated = false;
  let mcpConfigCreated = false;

  // 1. Ensure .agents/rules/context-broker.md exists
  const agentsDir = path.join(workspaceRoot, '.agents');
  const rulesDir = path.join(agentsDir, 'rules');
  const ruleFilePath = path.join(rulesDir, 'context-broker.md');

  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  if (!fs.existsSync(ruleFilePath) || force) {
    fs.writeFileSync(ruleFilePath, CONTEXT_BROKER_RULE_CONTENT, 'utf8');
    ruleCreated = true;
  }

  // Also write to .cursor/rules/context-broker.md if .cursor folder exists
  const cursorDir = path.join(workspaceRoot, '.cursor', 'rules');
  if (fs.existsSync(path.join(workspaceRoot, '.cursor'))) {
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }
    const cursorRulePath = path.join(cursorDir, 'context-broker.md');
    if (!fs.existsSync(cursorRulePath) || force) {
      fs.writeFileSync(cursorRulePath, CONTEXT_BROKER_RULE_CONTENT, 'utf8');
    }
  }

  // 2. Ensure .agents/mcp_config.json exists if server entry is known
  if (serverEntryPath && fs.existsSync(serverEntryPath)) {
    const mcpConfigPath = path.join(agentsDir, 'mcp_config.json');
    if (!fs.existsSync(mcpConfigPath) || force) {
      const normalizedPath = serverEntryPath.replace(/\\/g, '/');
      const config = {
        mcpServers: {
          'context-broker': {
            command: 'node',
            args: [normalizedPath],
            env: {
              CONTEXT_BROKER_MOCK: 'true'
            }
          }
        }
      };
      fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2), 'utf8');
      mcpConfigCreated = true;
    }

    // Also populate .vscode/mcp.json if .vscode exists
    const vscodeDir = path.join(workspaceRoot, '.vscode');
    if (fs.existsSync(vscodeDir)) {
      const vscodeMcpPath = path.join(vscodeDir, 'mcp.json');
      if (!fs.existsSync(vscodeMcpPath) || force) {
        const normalizedPath = serverEntryPath.replace(/\\/g, '/');
        const vscodeConfig = {
          servers: {
            'context-broker': {
              command: 'node',
              args: [normalizedPath],
              env: {
                CONTEXT_BROKER_MOCK: 'true'
              }
            }
          }
        };
        fs.writeFileSync(vscodeMcpPath, JSON.stringify(vscodeConfig, null, 2), 'utf8');
      }
    }
  }

  return { ruleCreated, mcpConfigCreated };
}

/**
 * Finds the server entry path relative to extension or monorepo workspace.
 */
export function resolveServerEntryPath(extensionUri: vscode.Uri): string | undefined {
  // Candidate 1: ContextMCP monorepo apps/mcp-server/dist/index.js
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const candidate1 = path.join(folder.uri.fsPath, 'context-broker', 'apps', 'mcp-server', 'dist', 'index.js');
      if (fs.existsSync(candidate1)) return candidate1;

      const candidate2 = path.join(folder.uri.fsPath, 'apps', 'mcp-server', 'dist', 'index.js');
      if (fs.existsSync(candidate2)) return candidate2;
    }
  }

  // Candidate 2: Relative to extension installation directory
  const extFsPath = extensionUri.fsPath;
  const candidateExt = path.join(extFsPath, '..', '..', 'context-broker', 'apps', 'mcp-server', 'dist', 'index.js');
  if (fs.existsSync(candidateExt)) return candidateExt;

  return undefined;
}
