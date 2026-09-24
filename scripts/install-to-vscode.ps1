<#
.SYNOPSIS
  Installs the Context Broker Companion Extension directly into your active AntiGravity IDE / VS Code
#>
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$ExtSrc       = Join-Path $ProjectRoot "apps\vscode-extension"
$ExtDest      = Join-Path $env:USERPROFILE ".vscode\extensions\context-broker-vscode-0.1.0"

Write-Host "Building and packaging extension..." -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build-extension.ps1")

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Context Broker Extension Installed into AntiGravity IDE!" -ForegroundColor White
Write-Host "  No debug mode or second window required." -ForegroundColor White
Write-Host "  To activate in your active window: run 'Developer: Reload Window'" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
