@echo off
title Fish! Appraiser Engine - Auto Bootstrapper
color 0B

echo ========================================================
echo        FISH! APPRAISER ENGINE - BOOTSTRAPPER
echo               Maintained by VIXENLICOUS
echo ========================================================
echo.

:: Check for Administrator privileges (required for silent installations)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARN] You are not running as Administrator.
    echo [WARN] Installations may prompt for UAC permission or fail.
    echo For a seamless setup, right-click and "Run as Administrator".
    echo.
    pause
)

set "REQUIRE_RESTART=0"

:: Check and Install Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Git not found. Downloading and installing via Winget...
    winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
    set "REQUIRE_RESTART=1"
) else (
    echo [OK] Git is installed.
)

:: Check and Install Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Node.js not found. Downloading and installing LTS via Winget...
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    set "REQUIRE_RESTART=1"
) else (
    echo [OK] Node.js is installed.
)

:: If we installed core software, the terminal's PATH is now outdated.
if "%REQUIRE_RESTART%"=="1" (
    echo.
    echo ========================================================
    echo [ACTION REQUIRED] Core dependencies were just installed!
    echo Your system needs to refresh its background environment.
    echo Please CLOSE this window and run install.bat one more time.
    echo ========================================================
    pause
    exit /b
)

echo.
echo [INFO] System environment validated.
echo [INFO] Setting working directory to project root...

:: Dynamically set the working directory to the parent folder
cd /d "%~dp0.."

echo [INFO] Compiling local Engine packages...
echo.

call npm install

echo.
echo ========================================================
echo [SUCCESS] Engine compilation complete!
echo ========================================================
echo.
pause