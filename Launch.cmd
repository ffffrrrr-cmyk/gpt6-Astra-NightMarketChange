@echo off
setlocal
if not exist "%~dp0dist\index.html" (
    echo Offline build not found. Run npm run build in this project first.
    pause
    exit /b 1
)
start "" "%~dp0dist\index.html"
