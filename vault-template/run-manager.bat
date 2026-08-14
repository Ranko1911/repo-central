@echo off
title Repo-Vault Manager Launcher
echo =======================================
echo     REPO-VAULT MANAGER LAUNCHER
echo =======================================
echo.
echo Iniciando el servidor local de administracion...
echo Servidor corriendo en http://localhost:8080
echo.

python "%~dp0repo-manager\server.py"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo iniciar el servidor. Asegurate de tener Python instalado y accesible desde tu PATH.
    pause
)
