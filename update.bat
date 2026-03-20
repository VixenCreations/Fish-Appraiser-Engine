@echo off
title Fish! Appraiser Engine - Auto Updater
color 0B

echo ========================================================
echo        FISH! APPRAISER ENGINE - AUTO UPDATER
echo               Maintained by VIXENLICOUS
echo ========================================================
echo.

:: Check if Git is installed and accessible
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in your system PATH.
    echo Please install Git from https://git-scm.com/
    echo.
    pause
    exit /b
)

echo [INFO] Contacting GitHub repository...
echo.

:: Pull the latest changes from the current branch
:: Fetch latest data and force the local folder to match GitHub exactly
git fetch --all
git reset --hard origin/main

echo.
echo ========================================================
echo [SUCCESS] Engine is up to date!
echo ========================================================
echo.

:: Give the user the option to boot the server immediately
set /p boot="Would you like to start the Appraiser Engine now? (Y/N): "
if /i "%boot%"=="Y" (
    echo.
    echo [INFO] Booting Node.js server...
    node server.js
) else (
    echo.
    echo Exiting updater. Press any key to close...
    pause >nul
)