@echo off
title Fish! Appraiser Engine - Restart Tool
color 0B

echo ========================================================
echo        FISH! APPRAISER ENGINE - RESTART
echo               Maintained by VIXENLICOUS
echo ========================================================
echo.

echo [INFO] Searching for running instances of server.js...
for /f "tokens=2" %%I in ('wmic process where "name='node.exe' and commandline like '%%server.js%%'" get processid ^| findstr [0-9]') do (
    echo [INFO] Terminating process ID %%I...
    taskkill /PID %%I /F >nul 2>nul
)

:: Dynamically set the working directory to the parent folder
cd /d "%~dp0.."

echo [INFO] Booting fresh instance...
echo.
node server.js