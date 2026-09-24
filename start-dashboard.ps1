<#
.SYNOPSIS
  Starts the Context Broker Monitoring & Sandbox Web Dashboard (http://localhost:3333)
#>
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

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

$dashboardScript = Join-Path $PSScriptRoot "apps\dashboard\dist\server.js"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Context Broker Monitoring & Sandbox Dashboard" -ForegroundColor White
Write-Host "  URL: http://localhost:3333" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Open default browser
Start-Process "http://localhost:3333"

& $nodeExe $dashboardScript
