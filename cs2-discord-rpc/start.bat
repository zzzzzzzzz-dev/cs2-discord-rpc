@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is missing or is not on PATH.
  echo Install the Windows LTS version from: https://nodejs.org/en/download
  echo During installation, keep "Add to PATH" enabled.
  echo Then close and reopen this window and run start.bat again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS with "Add to PATH" enabled.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist .env (
  copy .env.example .env >nul
  echo Created .env.
  echo Open .env and set DISCORD_CLIENT_ID to your Discord Application ID.
  echo Then run start.bat again.
  pause
  exit /b 0
)

call npm.cmd start
pause
