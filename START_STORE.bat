@echo off
title AY FIREWORKS SERVER
cd /d "%~dp0"
echo ========================================================
echo   💥 STARTING AY FIREWORKS WEBSITE & ADMIN DASHBOARD
echo ========================================================
echo.
echo Storefront:  http://localhost:3000
echo Admin Panel: http://localhost:3000/admin
echo.
timeout /t 2 /nobreak > nul
start "" "http://localhost:3000"
node server.js
pause
