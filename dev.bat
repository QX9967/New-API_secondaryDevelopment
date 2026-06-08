@echo off
chcp 65001 >nul
title new-api dev server

echo ========================================
echo  Select frontend:
echo  [1] Classic (Semi Design)  - port 5174
echo  [2] Default (shadcn/ui)    - port 5173
echo ========================================
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    set FRONTEND_DIR=classic
    set PORT=5174
) else if "%choice%"=="2" (
    set FRONTEND_DIR=default
    set PORT=5173
) else (
    echo Invalid choice.
    pause
    exit /b 1
)

echo.
echo Starting Go backend on :3000 ...
start "go-backend" cmd /c "cd /d %~dp0 && go run main.go"

echo Starting %FRONTEND_DIR% frontend on :%PORT% ...
start "frontend" cmd /c "cd /d %~dp0web\%FRONTEND_DIR% && bun run dev"

echo.
echo ========================================
echo  Backend:  http://localhost:3000
echo  Frontend: http://localhost:%PORT%
echo ========================================
echo.
echo Press any key to stop all servers ...
pause >nul

taskkill /FI "WINDOWTITLE eq go-backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq frontend*" /F >nul 2>&1
echo Servers stopped.
