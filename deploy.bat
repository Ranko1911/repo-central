@echo off
echo [ELITE PROTOCOL DEPLOYER]
echo =========================
echo.

echo 1. Adding files...
git add .
if %errorlevel% neq 0 (
    echo [ERROR] Git Add failed.
    pause
    exit /b
)

echo 2. Committing changes...
if "%~1"=="" (
    set "msg=deploy: quick update via script"
) else (
    set "msg=%~1"
)
git commit -m "%msg%"
REM Ignoramos errores en commit por si no hay cambios nuevos.

echo 3. Pushing to main...
git push origin main
if %errorlevel% neq 0 (
    echo [ERROR] Git Push failed.
    pause
    exit /b
)

echo.
echo [SUCCESS] Deployed to GitHub.
echo Changes should be live in ~2 minutes.
pause
