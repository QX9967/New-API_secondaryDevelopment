@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Starting Development Environment
echo ========================================
echo.

set "ROOT_DIR=%~dp0"

echo [1/3] Starting Go Backend (port 3000)...
start "Go Backend" cmd /k "cd /d "%ROOT_DIR%" && go run main.go"

echo [2/3] Starting Frontend (port 5173)...
start "Frontend" cmd /k "cd /d "%ROOT_DIR%web\default" && npm run dev"

echo [3/3] Starting Python Mock Server (port 8080)...
start "Mock Server" cmd /k "cd /d "%ROOT_DIR%" && python mock-ai-server/main.py"

echo.
echo ========================================
echo   All services started!
echo ========================================
echo.
echo   Go Backend:     http://localhost:3000
echo   Frontend:       http://localhost:5173
echo   Mock Server:    http://localhost:8080
echo.
echo Close this window will NOT stop services.
echo Press Ctrl+C in each service window to stop.
echo.
pause
