<#
.SYNOPSIS
  Starts the Context Broker MCP Server locally
.PARAMETER Mock
  Run in mock mode (default: true)
.PARAMETER Live
  Run in live mode connecting to upstream services
#>
param(
  [switch]$Live
)

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

if ($Live) {
  $env:CONTEXT_BROKER_MOCK = "false"
  Write-Host "[Context Broker] Starting in LIVE mode..." -ForegroundColor Cyan
} else {
  $env:CONTEXT_BROKER_MOCK = "true"
  Write-Host "[Context Broker] Starting in DEV/MOCK mode..." -ForegroundColor Green
}

# Resolve node executable robustly
$nodeExe = "node"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $fnmDirs = @(
    "$env:LOCALAPPDATA\fnm\node-versions",
    "$env:APPDATA\fnm\node-versions"
  )
  foreach ($dir in $fnmDirs) {
    if (Test-Path $dir) {
      $latest = Get-ChildItem $dir -Directory | Sort-Object Name -Descending | Select-Object -First 1
      if ($latest -and (Test-Path (Join-Path $latest.FullName "installation\node.exe"))) {
        $nodeExe = Join-Path $latest.FullName "installation\node.exe"
        break
      }
    }
  }
  if ($nodeExe -eq "node" -and (Test-Path "$env:LOCALAPPDATA\fnm\fnm.exe")) {
    & "$env:LOCALAPPDATA\fnm\fnm.exe" env --shell powershell | Out-String | Invoke-Expression
  }
}

$serverScript = Join-Path $PSScriptRoot "apps\mcp-server\dist\index.js"
& $nodeExe $serverScript
