@echo off
title PhotoBook Studio
cd /d "%~dp0"

:: If the dev server is already running, open Chrome directly and exit
netstat -an 2>nul | find ":5173 " | find "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo Server already running — opening Chrome...
    start /min powershell -command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' 'http://localhost:5173'"
    exit /b 0
)

echo.
echo   PhotoBook Studio
echo   ----------------
echo   Starting dev server...
echo   Chrome will open automatically at http://localhost:5173
echo   Keep this window open while using the app.
echo   Close this window to stop the server.
echo.

:: Vite opens Chrome automatically (configured in vite.config.ts)
npm run dev
