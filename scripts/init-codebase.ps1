<#
.SYNOPSIS
  Initializes Context Broker MCP in any target codebase, auto-populating the
  mandatory AI rule 'context-broker.md' and MCP configuration files.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts\init-codebase.ps1 -Target "C:\path\to\codebase"
#>

param(
  [string]$Target = (Get-Location).Path,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot  = Split-Path -Parent $PSScriptRoot

$Target = (Resolve-Path $Target).Path

Write-Host ""
Write-Host "  Initializing Context Broker MCP in: $Target" -ForegroundColor Cyan
Write-Host "  ================================================================" -ForegroundColor Cyan

# 1. Resolve Server Entry Path
$ServerEntry = Join-Path $ProjectRoot "apps\mcp-server\dist\index.js"
if (-not (Test-Path $ServerEntry)) {
  Write-Host "  [!] Server entry not built yet, building..." -ForegroundColor Yellow
  & pnpm --filter @context-broker/mcp-server build
}
$NormalizedServerPath = $ServerEntry.Replace('\', '/')

# 2. Rule content definition
$RuleContent = @'
# Context Broker MCP — Tool Usage & Discovery Enforcement

This rule enforces the mandatory use of the **Context Broker MCP** tools (`context-broker`) whenever navigating, searching, analyzing, or modifying this codebase.

## 🚨 MANDATORY DIRECTIVES

All AI assistants and agents operating in this workspace MUST follow these directives:

### 1. Mandatory Pre-Search with `search_context`
- **DO NOT** perform blind global searches (e.g. running unbounded ripgrep, reading entire directories, or querying generic regexes across all files) when seeking implementations, features, or architectural concepts.
- **MUST CALL** `search_context(query, tokenBudget?)` first.
  - Context Broker uses hybrid rank fusion across BM25 lexical search, semantic vector retrieval, code graph expansion, and git freshness.
  - This delivers high-precision, deduplicated code slices and saves up to 80–90% of token context.

### 2. Precise Symbol Lookups with `get_symbol_context`
- **DO NOT** read hundreds of lines of source code just to inspect a class, function, type definition, or interface.
- **MUST CALL** `get_symbol_context(symbol, maxCallers?, maxReferences?)`.
  - It retrieves the precise definition, docstring, parameter signatures, call sites, and caller dependencies directly from the structural graph.

### 3. Mandatory Blast Radius Check with `get_impact_context`
- **BEFORE** refactoring, renaming, altering signatures, or removing functions, classes, or interfaces, you **MUST CALL** `get_impact_context(symbol, depth?)`.
  - Inspect downstream callers, transitive dependencies, and blast radius to ensure changes will not introduce regressions.

### 4. Repository Orientation with `get_repository_map`
- When asked about high-level codebase architecture, module responsibilities, entry points, or workspace layout, **MUST CALL** `get_repository_map()`.
  - Avoid scanning folders manually or reading every package manifest.

### 5. Architectural Memory Verification with `recall_decisions`
- **BEFORE** proposing significant architectural modifications, adopting new dependencies, or altering core abstractions, **MUST CALL** `recall_decisions(query, tags?)`.
  - Check whether a prior Architectural Decision Record (ADR) or trade-off analysis already addresses the question or prohibits the proposed change.

### 6. Durable Decision Persistence with `record_decision`
- **AFTER** agreeing on, implementing, or modifying significant architectural patterns, frameworks, or database schemas, **MUST CALL** `record_decision(title, decision, rationale, alternatives?)`.
  - This preserves context in durable memory across long sessions and agent swarms.

### 7. Diagnostics & Provider Verification with `backend_health`
- If retrieval results appear incomplete or if adapter connectivity is suspected to be degraded, call `backend_health()` to inspect the status, latency, and counts across all 5 adapters (comP, CodeGraphContext, Vector, Git, Memory).

---

## 🧭 Tool Selection Flowchart

| Developer Intent | Required Tool | When to Call |
| :--- | :--- | :--- |
| Find code, concepts, implementations | `search_context` | First step before reading files |
| Inspect a specific symbol / class / function | `get_symbol_context` | Instead of viewing entire file |
| Modify, refactor, or delete a symbol | `get_impact_context` | Before writing code edits |
| Understand workspace structure & modules | `get_repository_map` | Onboarding or structural overview |
| Check prior architectural choices / ADRs | `recall_decisions` | Before proposing design changes |
| Save an architectural choice / ADR | `record_decision` | After reaching a design consensus |
| Diagnose ranking / relevance reasoning | `explain_context` | Debugging context ranking |
| Check system status & adapter connections | `backend_health` | On connection error or startup |

---

## 🚫 Strictly Forbidden Anti-Patterns

1. **NO Raw Code Dumps**: Do not read multiple full files into context when a targeted symbol lookup (`get_symbol_context`) or hybrid search (`search_context`) provides the exact slice needed.
2. **NO Blind Refactoring**: Do not modify public APIs or core utilities without verifying downstream dependencies via `get_impact_context`.
3. **NO Ignored ADRs**: Do not reverse or re-litigate decisions documented in the memory store without first reviewing them via `recall_decisions`.
'@

# 3. Create .agents/rules/context-broker.md
$AgentsDir = Join-Path $Target ".agents"
$RulesDir  = Join-Path $AgentsDir "rules"
if (-not (Test-Path $RulesDir)) {
  New-Item -ItemType Directory -Path $RulesDir -Force | Out-Null
}
$RulePath = Join-Path $RulesDir "context-broker.md"
if (-not (Test-Path $RulePath) -or $Force) {
  $RuleContent | Set-Content -Path $RulePath -Encoding UTF8
  Write-Host "  [OK] Created rule file: $RulePath" -ForegroundColor Green
} else {
  Write-Host "  [OK] Rule file already exists: $RulePath" -ForegroundColor Green
}

# 4. Create .cursor/rules/context-broker.md if .cursor directory exists
if (Test-Path (Join-Path $Target ".cursor")) {
  $CursorRulesDir = Join-Path $Target ".cursor\rules"
  if (-not (Test-Path $CursorRulesDir)) {
    New-Item -ItemType Directory -Path $CursorRulesDir -Force | Out-Null
  }
  $CursorRulePath = Join-Path $CursorRulesDir "context-broker.md"
  if (-not (Test-Path $CursorRulePath) -or $Force) {
    $RuleContent | Set-Content -Path $CursorRulePath -Encoding UTF8
    Write-Host "  [OK] Created Cursor rule file: $CursorRulePath" -ForegroundColor Green
  }
}

# 5. Create .agents/mcp_config.json
$McpConfigPath = Join-Path $AgentsDir "mcp_config.json"
if (-not (Test-Path $McpConfigPath) -or $Force) {
  $McpJson = @"
{
  "mcpServers": {
    "context-broker": {
      "command": "node",
      "args": [
        "$NormalizedServerPath"
      ],
      "env": {
        "CONTEXT_BROKER_MOCK": "true"
      }
    }
  }
}
"@
  $McpJson | Set-Content -Path $McpConfigPath -Encoding UTF8
  Write-Host "  [OK] Created MCP configuration: $McpConfigPath" -ForegroundColor Green
} else {
  Write-Host "  [OK] MCP configuration already exists: $McpConfigPath" -ForegroundColor Green
}

# 6. Create .vscode/mcp.json
$VsCodeDir = Join-Path $Target ".vscode"
if (-not (Test-Path $VsCodeDir)) {
  New-Item -ItemType Directory -Path $VsCodeDir -Force | Out-Null
}
$VsCodeMcpPath = Join-Path $VsCodeDir "mcp.json"
if (-not (Test-Path $VsCodeMcpPath) -or $Force) {
  $VsCodeMcpJson = @"
{
  "servers": {
    "context-broker": {
      "command": "node",
      "args": [
        "$NormalizedServerPath"
      ],
      "env": {
        "CONTEXT_BROKER_MOCK": "true"
      }
    }
  }
}
"@
  $VsCodeMcpJson | Set-Content -Path $VsCodeMcpPath -Encoding UTF8
  Write-Host "  [OK] Created VS Code MCP configuration: $VsCodeMcpPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host "  Context Broker MCP Initialization Complete!" -ForegroundColor White
Write-Host "  Rule 'context-broker.md' forces all AI agents to use MCP tools." -ForegroundColor Green
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host ""
