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
# Context Broker MCP — Directive & Discovery Rules

**MANDATORY:** Prioritize `context-broker` MCP tools over raw file reads or unbounded searches.

## Directives
1. **Search Context:** ALWAYS call `search_context(query)` before searching files. Never run unbounded file greps.
2. **Symbol Lookup:** ALWAYS call `get_symbol_context(symbol)` to view definitions/signatures instead of loading full files.
3. **Blast Radius Check:** ALWAYS call `get_impact_context(symbol)` before refactoring or removing code.
4. **Architecture Map:** ALWAYS call `get_repository_map()` to explore project layout.
5. **Architectural Memory:** ALWAYS call `recall_decisions(query)` before making structural changes, and `record_decision(title, decision, rationale)` after architectural consensus.
6. **Provider Health:** Call `backend_health()` to verify provider status.
7. **Safe Mutation:** Use `search_and_replace(path, find, replace)` for atomic file edits.

## Quick Lookup Table
| Intent | Tool |
| :--- | :--- |
| Find code / concepts | `search_context` |
| Inspect symbol definition | `get_symbol_context` |
| Check change impact | `get_impact_context` |
| Overview codebase | `get_repository_map` |
| Check / record ADRs | `recall_decisions` / `record_decision` |
| Edit files safely | `search_and_replace` |

## Forbidden
- NO reading entire files for single symbol lookups.
- NO modifying shared APIs without `get_impact_context`.
- NO ignoring recorded ADRs.
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

# 6. Create C:/Users/<user>/.gemini/config/mcp_config.json
$GeminiConfigDir = Join-Path $env:USERPROFILE ".gemini\config"
if (-not (Test-Path $GeminiConfigDir)) {
  New-Item -ItemType Directory -Path $GeminiConfigDir -Force | Out-Null
}
$GeminiMcpPath = Join-Path $GeminiConfigDir "mcp_config.json"
if (-not (Test-Path $GeminiMcpPath) -or $Force) {
  $GeminiMcpJson = @"
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
  $GeminiMcpJson | Set-Content -Path $GeminiMcpPath -Encoding UTF8
  Write-Host "  [OK] Created Gemini MCP configuration: $GeminiMcpPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host "  Context Broker MCP Initialization Complete!" -ForegroundColor White
Write-Host "  Rule 'context-broker.md' forces all AI agents to use MCP tools." -ForegroundColor Green
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host ""
