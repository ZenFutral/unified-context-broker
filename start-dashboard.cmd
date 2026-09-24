@echo off
set NODE_EXE=node
where node >nul 2>nul
if %errorlevel% neq 0 (
  if exist "C:\Users\ZenFutral\AppData\Roaming\fnm\node-versions\v24.21.0\installation\node.exe" (
    set "NODE_EXE=C:\Users\ZenFutral\AppData\Roaming\fnm\node-versions\v24.21.0\installation\node.exe"
  )
)
start http://localhost:3333
"%NODE_EXE%" "%~dp0apps\dashboard\dist\server.js" %*
