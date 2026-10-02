@echo off
setlocal enabledelayedexpansion

title Unified Context Broker

echo.
echo ================================================================
echo    Unified Context Broker - Startup ^& Self-Repair Engine
echo ================================================================
echo.

rem Navigate to the directory containing this script
cd /d "%~dp0"

rem 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required but was not found in your PATH.
    echo Please install Node.js ^(>= 20.0.0^) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

rem 2. Check and determine pnpm
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    set "PNPM_CMD=pnpm"
) else (
    set "PNPM_CMD=npx --yes pnpm@9.0.0"
)

rem 3. Check for flags
set "ARG=%~1"

if /i "%ARG%"=="/help" goto show_help
if /i "%ARG%"=="--help" goto show_help
if /i "%ARG%"=="-h" goto show_help
if /i "%ARG%"=="/?" goto show_help

if /i "%ARG%"=="/test" goto run_tests
if /i "%ARG%"=="--test" goto run_tests
if /i "%ARG%"=="-t" goto run_tests

if /i "%ARG%"=="/build" goto run_build
if /i "%ARG%"=="--build" goto run_build
if /i "%ARG%"=="-b" goto run_build

if /i "%ARG%"=="/fix" goto run_fix
if /i "%ARG%"=="--fix" goto run_fix
if /i "%ARG%"=="-f" goto run_fix

if /i "%ARG%"=="/validate" goto run_validate
if /i "%ARG%"=="--validate" goto run_validate
if /i "%ARG%"=="-v" goto run_validate

rem 4. Check dependencies
if not exist "node_modules\" (
    echo [!] node_modules missing. Auto-installing dependencies...
    call %PNPM_CMD% install
    if %errorlevel% neq 0 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

rem 5. Run full validation and self-repair
echo [*] Validating setup, project naming, and repairing any issues...
node scripts/validate-and-fix.mjs
if %errorlevel% neq 0 (
    echo [ERROR] Validation or self-repair encountered an issue.
    pause
    exit /b 1
)

rem 6. Start services
echo.
echo ================================================================
echo  Unified Context Broker is initialized and ready!
echo ================================================================
echo  * MCP Server:   apps\mcp-server\dist\index.js
echo  * Bundle:       apps\mcp-server\dist\bundle.js
echo  * Telemetry:    .data\telemetry\
echo  * Decision Mem: .data\memory\decisions.jsonl
echo  * Dashboard GUI: http://localhost:4100
echo ================================================================
echo.
echo Starting Companion GUI Dashboard on port 4100...
start "" "http://localhost:4100"
node apps\dashboard\dist\server.js
goto end

:run_validate
echo [*] Running full validation and self-repair...
node scripts/validate-and-fix.mjs --validate
if %errorlevel% neq 0 (
    echo [ERROR] Validation failed.
    exit /b 1
)
echo [OK] Validation completed successfully.
goto end

:run_build
echo [*] Building all packages and standalone bundle...
call %PNPM_CMD% run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    exit /b 1
)
call %PNPM_CMD% --filter @context-broker/mcp-server run bundle
if %errorlevel% neq 0 (
    echo [ERROR] Bundle failed.
    exit /b 1
)
echo [OK] All packages and standalone bundle built successfully.
goto end

:run_tests
echo [*] Running full test suite...
call %PNPM_CMD% test
goto end

:run_fix
echo [*] Performing deep clean, reinstall, and rebuild...
call %PNPM_CMD% run clean
call %PNPM_CMD% install
call %PNPM_CMD% run build
call %PNPM_CMD% --filter @context-broker/mcp-server run bundle
node scripts/validate-and-fix.mjs --validate
goto end

:show_help
echo Unified Context Broker Launcher Usage:
echo   start.bat                Full validation, auto-fix, and launch dashboard
echo   start.bat --validate     Run setup validation and auto-fix without starting
echo   start.bat --build        Rebuild monorepo packages and standalone bundle
echo   start.bat --test         Run full test suite
echo   start.bat --fix          Deep clean, reinstall, rebuild, and re-validate
echo   start.bat --help         Show this help message
goto end

:end
endlocal
