<#
.SYNOPSIS
  Package and publish Context Broker VS Code extension to Open VSX Registry.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts\publish-to-openvsx.ps1 -Pat "<YOUR_OVSX_TOKEN>"
  Flags:
    -Pat       Personal Access Token from open-vsx.org (or uses $env:OVSX_PAT if omitted)
    -DryRun    Package only, skip publishing
#>

param(
  [string]$Pat = $env:OVSX_PAT,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
$ExtDir = Join-Path $ProjectRoot "apps\vscode-extension"

Write-Host "`n  === Packaging Context Broker VS Code Companion ===`n" -ForegroundColor Cyan

# 1. Build extension
Set-Location $ProjectRoot
Write-Host "Building extension..." -ForegroundColor Gray
& pnpm --filter unified-context-broker run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[X] Build failed." -ForegroundColor Red
  exit 1
}

# 2. Package .vsix
Set-Location $ExtDir
Write-Host "Packaging .vsix with vsce..." -ForegroundColor Gray
& npx --yes @vscode/vsce package --no-dependencies --out unified-context-broker.vsix
if ($LASTEXITCODE -ne 0) {
  Write-Host "[X] Packaging failed." -ForegroundColor Red
  exit 1
}

$VsixFile = Join-Path $ExtDir "unified-context-broker.vsix"
if (-not (Test-Path $VsixFile)) {
  Write-Host "[X] .vsix file not generated." -ForegroundColor Red
  exit 1
}

$VsixSize = (Get-Item $VsixFile).Length / 1KB
Write-Host "[OK] Packaged: unified-context-broker.vsix ($([Math]::Round($VsixSize, 2)) KB)" -ForegroundColor Green

if ($DryRun) {
  Write-Host "`n[DryRun] Skipping publish step. File ready at: $VsixFile" -ForegroundColor Yellow
  exit 0
}

# 3. Publish to Open VSX
if (-not $Pat) {
  Write-Host "`n[!] No Open VSX PAT provided." -ForegroundColor Yellow
  Write-Host "    Provide via: -Pat '<TOKEN>' or `$env:OVSX_PAT = '<TOKEN>'" -ForegroundColor Gray
  Write-Host "    Get a token at: https://open-vsx.org/user-settings/tokens" -ForegroundColor Gray
  Write-Host "    Your .vsix is ready locally at: $VsixFile" -ForegroundColor Cyan
  exit 0
}

Write-Host "Publishing to Open VSX registry..." -ForegroundColor Cyan
& npx --yes ovsx publish unified-context-broker.vsix -p $Pat
if ($LASTEXITCODE -eq 0) {
  Write-Host "`n[OK] Successfully published to Open VSX!" -ForegroundColor Green
} else {
  Write-Host "`n[X] Publish failed. Ensure your Open VSX namespace matches the publisher in package.json." -ForegroundColor Red
  exit $LASTEXITCODE
}
