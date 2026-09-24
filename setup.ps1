<#
.SYNOPSIS
  Context Broker MCP - Full Setup Script
  Installs Node.js via fnm (no admin required), pnpm, builds, and generates
  the MCP client config for connecting to an AI agent.

.USAGE
  powershell -ExecutionPolicy Bypass -File setup.ps1
  Flags: -SkipNodeInstall  -SkipPnpmInstall  -SkipTests  -MockMode
#>

param(
  [switch]$SkipNodeInstall,
  [switch]$SkipPnpmInstall,
  [switch]$SkipTests,
  [switch]$MockMode,
  [string]$TargetWorkspace
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot

function Write-Step { param($msg) Write-Host "`n  == $msg ==" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [X]  $msg" -ForegroundColor Red; exit 1 }

function Add-UserPath {
  param($newPath)
  $cur = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  if ($cur -notlike "*$newPath*") {
    [System.Environment]::SetEnvironmentVariable('Path', "$cur;$newPath", 'User')
  }
  if ($env:Path -notlike "*$newPath*") {
    $env:Path = "$env:Path;$newPath"
  }
}

Write-Host ""
Write-Host "  Context Broker MCP -- Setup Script" -ForegroundColor Magenta
Write-Host "  =================================================" -ForegroundColor Magenta

# ---- Step 1: Node.js ----------------------------------------------------------
Write-Step "Step 1: Node.js"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCmd) {
  $nodeVer = & node --version
  Write-Ok "Node.js $nodeVer already installed"
}
elseif ($SkipNodeInstall) {
  Write-Fail "Node.js not found and -SkipNodeInstall was set. Install from https://nodejs.org"
}
else {
  # ---- Install fnm (no admin needed) ----------------------------------------
  $fnmExe = "$env:LOCALAPPDATA\fnm\fnm.exe"
  $fnmCmd = Get-Command fnm -ErrorAction SilentlyContinue
  if (-not $fnmCmd) {
    if (-not (Test-Path $fnmExe)) {
      Write-Warn "Installing fnm (Fast Node Manager) -- no admin required..."
      $fnmDir = "$env:LOCALAPPDATA\fnm"
      New-Item -ItemType Directory -Force -Path $fnmDir | Out-Null
      $fnmZip = "$env:TEMP\fnm-windows.zip"
      Invoke-WebRequest -Uri "https://github.com/Schniz/fnm/releases/latest/download/fnm-windows.zip" -OutFile $fnmZip -UseBasicParsing
      Expand-Archive -Path $fnmZip -DestinationPath $fnmDir -Force
      Remove-Item $fnmZip -ErrorAction SilentlyContinue
      Add-UserPath $fnmDir
      Write-Ok "fnm installed to $fnmDir"
    }
    else {
      Add-UserPath (Split-Path $fnmExe)
    }
    $fnmExe = "$env:LOCALAPPDATA\fnm\fnm.exe"
  }
  else {
    $fnmExe = $fnmCmd.Source
  }

  # ---- Install Node via fnm ---------------------------------------------------
  Write-Warn "Installing Node.js LTS via fnm (no admin prompt)..."
  # Use cmd to avoid PowerShell treating fnm's stderr progress as errors
  $null = cmd /c "`"$fnmExe`" install --lts 2>&1"
  $null = cmd /c "`"$fnmExe`" use lts-latest 2>&1"
  Write-Ok "Node.js LTS downloaded via fnm"

  # Apply fnm env vars (sets PATH so node.exe is reachable in this session)
  $fnmEnvOut = (cmd /c "`"$fnmExe`" env --shell cmd 2>&1")
  foreach ($line in $fnmEnvOut) {
    if ($line -match '^SET\s+(\w+)=(.+)$') {
      $varName  = $Matches[1]
      $varValue = $Matches[2]
      [System.Environment]::SetEnvironmentVariable($varName, $varValue, 'Process')
      if ($varName -eq 'PATH') { $env:Path = $varValue }
    }
  }

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) {
    Write-Warn ""
    Write-Warn "Node.js was installed but is not on PATH for THIS terminal session."
    Write-Warn "Please open a NEW terminal window and re-run:"
    Write-Warn "  powershell -ExecutionPolicy Bypass -File setup.ps1 -SkipNodeInstall"
    exit 0
  }
  $nodeVer = & node --version
  Write-Ok "Node.js $nodeVer installed via fnm"
}

# ---- Step 2: pnpm -------------------------------------------------------------
Write-Step "Step 2: pnpm"

$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue

if ($pnpmCmd) {
  $pnpmVer = & pnpm --version
  Write-Ok "pnpm $pnpmVer already installed"
}
elseif ($SkipPnpmInstall) {
  Write-Fail "pnpm not found. Run: npm install -g pnpm"
}
else {
  Write-Warn "Installing pnpm globally via npm..."
  & npm install -g pnpm
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','User') + ';' + $env:Path
  $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if (-not $pnpmCmd) {
    Write-Fail "pnpm install failed. Run manually: npm install -g pnpm"
  }
  $pnpmVer = & pnpm --version
  Write-Ok "pnpm $pnpmVer installed"
}

# ---- Step 3: Install workspace dependencies -----------------------------------
Write-Step "Step 3: Install workspace dependencies"
Set-Location $ProjectRoot
Write-Host "  Running: pnpm install" -ForegroundColor Gray
& pnpm install
Write-Ok "All dependencies installed"

# ---- Step 4: Build ------------------------------------------------------------
Write-Step "Step 4: TypeScript build"
Write-Host "  Running: pnpm build" -ForegroundColor Gray
& pnpm build
Write-Ok "All packages compiled successfully"

# ---- Step 5: Tests ------------------------------------------------------------
if (-not $SkipTests) {
  Write-Step "Step 5: Test suite"
  $env:CONTEXT_BROKER_MOCK = 'true'
  Write-Host "  Running: pnpm test (CONTEXT_BROKER_MOCK=true)" -ForegroundColor Gray
  try {
    & pnpm test
    Write-Ok "All tests passed"
  }
  catch {
    Write-Warn "Some tests failed -- see output above."
  }
}
else {
  Write-Step "Step 5: Tests (skipped)"
}

# ---- Step 6: Generate MCP config ----------------------------------------------
Write-Step "Step 6: Generate MCP client configuration"

# Find the stable node path (not the session-temporary fnm_multishells shim)
$nodeSource = (Get-Command node).Source
$stableNodePath = $nodeSource

# If node is in a fnm_multishells temp dir, find the real installation path
if ($nodeSource -like "*fnm_multishells*") {
  $fnmVersionsDir = "$env:LOCALAPPDATA\fnm\node-versions"
  if (Test-Path $fnmVersionsDir) {
    $latestNode = Get-ChildItem $fnmVersionsDir -Directory |
      Sort-Object Name -Descending |
      Select-Object -First 1
    if ($latestNode) {
      $candidate = Join-Path $latestNode.FullName "installation\node.exe"
      if (Test-Path $candidate) {
        $stableNodePath = $candidate
      }
    }
  }
}
$serverEntry = Join-Path $ProjectRoot "apps\mcp-server\dist\index.js"
$mockEnvVal  = if ($MockMode) { "true" } else { "false" }

$configJson = @"
{
  "mcpServers": {
    "context-broker": {
      "command": "$($stableNodePath.Replace('\','\\'))",
      "args": ["$($serverEntry.Replace('\','\\'))"],
      "env": {
        "CONTEXT_BROKER_MOCK": "$mockEnvVal"
      }
    }
  }
}
"@

$snippetPath = Join-Path $ProjectRoot "mcp-client-config.json"
$configJson | Set-Content -Path $snippetPath -Encoding UTF8
Write-Ok "Config saved to: $snippetPath"
Write-Host ""
Write-Host $configJson -ForegroundColor White

# ---- Step 7: Auto-populate context-broker.md Rule -----------------------------
Write-Step "Step 7: Auto-populate context-broker.md Rule & Configurations"

$InitScript = Join-Path $ProjectRoot "scripts\init-codebase.ps1"
$TargetsToInit = @()

# Current workspace root (parent of context-broker or context-broker itself)
$WorkspaceRoot = Split-Path -Parent $ProjectRoot
$TargetsToInit += $WorkspaceRoot

if ($TargetWorkspace) {
  $TargetsToInit += $TargetWorkspace
}

foreach ($target in $TargetsToInit) {
  if (Test-Path $target) {
    & powershell -ExecutionPolicy Bypass -File $InitScript -Target $target
  }
}

# ---- Done ---------------------------------------------------------------------
Write-Step "Setup Complete!"
Write-Host ""
Write-Host "  DEV / MOCK MODE (all adapters use built-in mock data):" -ForegroundColor Cyan
Write-Host '    $env:CONTEXT_BROKER_MOCK = "true"'
Write-Host "    node `"$serverEntry`""
Write-Host ""
Write-Host "  LIVE MODE (connect real upstream tools):" -ForegroundColor Cyan
Write-Host '    $env:COMP_DAEMON_URL = "http://localhost:7878"'
Write-Host '    $env:CGC_ENDPOINT    = "http://localhost:8080"'
Write-Host '    $env:MEMORY_DB_PATH  = "C:\path\to\memory.db"'
Write-Host "    node `"$serverEntry`""
Write-Host ""
Write-Host "  DEFAULT / PRIMARY ENVIRONMENTS:" -ForegroundColor Cyan
Write-Host "    AntiGravity IDE: .agents\mcp_config.json" -ForegroundColor Green
Write-Host "    VS Code:        .vscode\mcp.json (+ apps\vscode-extension)" -ForegroundColor Green
Write-Host ""
Write-Host "  NON-DEFAULT / SECONDARY OPTIONS:" -ForegroundColor DarkGray
Write-Host "    Cursor:         .cursor\mcp.json" -ForegroundColor DarkGray
Write-Host "    Claude Desktop: %APPDATA%\Claude\claude_desktop_config.json" -ForegroundColor DarkGray
Write-Host ""
