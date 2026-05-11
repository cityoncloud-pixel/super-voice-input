@echo off
REM 超级语音输入 · 一键启动（Electron 会自动拉起 uvicorn，无需另开 Python 终端）
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo 未找到 npm，请先安装 Node.js 并在本目录执行 npm install。
  pause
  exit /b 1
)
npm run desktop
if errorlevel 1 pause
