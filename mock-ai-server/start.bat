@echo off
echo ========================================
echo  Mock AI Provider Server
echo ========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [Error] Python is not installed or not in PATH
    pause
    exit /b 1
)

REM 安装依赖
echo Installing dependencies...
pip install -r requirements.txt -q

echo.
echo Starting server...
echo.
python main.py

pause
