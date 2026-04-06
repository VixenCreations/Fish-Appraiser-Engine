@echo off
title Fish! Appraiser Engine - Server
color 0B

echo ========================================================
echo        FISH! APPRAISER ENGINE - SERVER
echo               Maintained by VIXENLICOUS
echo ========================================================
echo.

:: Dynamically set the working directory to the parent folder
cd /d "%~dp0.."

echo [INFO] Working directory set to: %CD%
echo [INFO] Booting Node.js server...
echo.

node server.js

echo.
echo [WARN] Server process terminated.
pause