#!/bin/bash

echo "========================================"
echo " Mock AI Provider Server"
echo "========================================"
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "[Error] Python3 is not installed"
    exit 1
fi

# 安装依赖
echo "Installing dependencies..."
pip3 install -r requirements.txt -q

echo ""
echo "Starting server on http://localhost:8080"
echo "Press Ctrl+C to stop"
echo "========================================"
echo ""

python3 main.py
