$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (Test-Path "$env:LOCALAPPDATA\fnm\fnm.exe") {
    $fnmEnv = & "$env:LOCALAPPDATA\fnm\fnm.exe" env --shell powershell | Out-String
    Invoke-Expression $fnmEnv
  }
}

Set-Location $ProjectRoot
& pnpm --filter context-broker-vscode build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

# Automatically deploy to AntiGravity IDE and VS Code active extensions folders
$ExtSrc   = Join-Path $ProjectRoot "apps\vscode-extension"
$DestDirs = @(
  (Join-Path $env:USERPROFILE ".antigravity-ide\extensions\context-broker-vscode-0.1.0"),
  (Join-Path $env:USERPROFILE ".vscode\extensions\context-broker-vscode-0.1.0")
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
}

Write-Host "Extension successfully deployed to AntiGravity IDE." -ForegroundColor Green
Write-Host "To activate in active window: run 'Developer: Reload Window' (Ctrl+R)" -ForegroundColor Yellow
