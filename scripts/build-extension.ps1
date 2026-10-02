$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (Test-Path "$env:LOCALAPPDATA\fnm\fnm.exe") {
    $fnmEnv = & "$env:LOCALAPPDATA\fnm\fnm.exe" env --shell powershell | Out-String
    Invoke-Expression $fnmEnv
  }
}

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  & pnpm --filter ./apps/vscode-extension build
} else {
  Write-Host "Compiling extension with tsc..." -ForegroundColor Gray
  & node "$ProjectRoot\node_modules\.pnpm\typescript@5.9.3\node_modules\typescript\bin\tsc" -b "$ProjectRoot\apps\vscode-extension"
}

# Sync standalone MCP server bundle into extension server folder
$ServerDir = Join-Path $ProjectRoot "apps\vscode-extension\server"
if (-not (Test-Path $ServerDir)) {
  New-Item -ItemType Directory -Path $ServerDir -Force | Out-Null
}
$McpBundle = Join-Path $ProjectRoot "apps\mcp-server\dist\bundle.js"
if (Test-Path $McpBundle) {
  Copy-Item $McpBundle -Destination (Join-Path $ServerDir "server.mjs") -Force
}

# Automatically deploy to AntiGravity IDE and VS Code active extensions folders
$ExtSrc   = Join-Path $ProjectRoot "apps\vscode-extension"
$DestDirs = @(
  (Join-Path $env:USERPROFILE ".antigravity-ide\extensions\unified-context-broker.unified-context-broker-0.3.0"),
  (Join-Path $env:USERPROFILE ".vscode\extensions\unified-context-broker.unified-context-broker-0.3.0")
)

foreach ($ExtDest in $DestDirs) {
  if (-not (Test-Path $ExtDest)) {
    New-Item -ItemType Directory -Path $ExtDest -Force | Out-Null
  }

  Write-Host "Syncing extension to: $ExtDest..." -ForegroundColor Cyan
  Copy-Item (Join-Path $ExtSrc "package.json") -Destination $ExtDest -Force
  if (Test-Path (Join-Path $ExtSrc "README.md")) {
    Copy-Item (Join-Path $ExtSrc "README.md") -Destination $ExtDest -Force
  }
  Copy-Item (Join-Path $ExtSrc "dist") -Destination $ExtDest -Recurse -Force
  if (Test-Path (Join-Path $ExtSrc "resources")) {
    Copy-Item (Join-Path $ExtSrc "resources") -Destination $ExtDest -Recurse -Force
  }
  if (Test-Path (Join-Path $ExtSrc "server")) {
    Copy-Item (Join-Path $ExtSrc "server") -Destination $ExtDest -Recurse -Force
  }
}

Write-Host "Extension successfully deployed to AntiGravity IDE." -ForegroundColor Green
Write-Host "To activate in active window: run 'Developer: Reload Window' (Ctrl+R)" -ForegroundColor Yellow
