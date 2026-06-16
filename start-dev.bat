@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Starting Development Environment
echo ========================================
echo.
echo Please choose startup mode:
echo   1. Full startup (Frontend + Go Backend + Python Mock Server)
echo   2. Only backend (Go Backend + Python Mock Server)
echo.
set /p choice="Enter 1 or 2: "

set "ROOT_DIR=%~dp0"

if "%choice%"=="1" goto full
if "%choice%"=="2" goto backend_only
echo Invalid choice. Please run again.
pause
exit /b

:full
echo.
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
goto end

:backend_only
echo.
echo [1/2] Starting Go Backend (port 3000)...
start "Go Backend" cmd /k "cd /d "%ROOT_DIR%" && go run main.go"

echo [2/2] Starting Python Mock Server (port 8080)...
start "Mock Server" cmd /k "cd /d "%ROOT_DIR%" && python mock-ai-server/main.py"

echo.
echo ========================================
echo   Backend services started!
echo ========================================
echo.
echo   Go Backend:     http://localhost:3000
echo   Mock Server:    http://localhost:8080
echo   (Frontend not started)
goto end

:end
echo.
echo All services have been started in separate windows.
echo You may close this window now.