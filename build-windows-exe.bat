@echo off
setlocal
cd /d "%~dp0"
echo === Building Qikki Windows Desktop Executable (.exe) ===
echo Working directory: %CD%
echo.
echo =======================================================================
echo IMPORTANT NOTICE FOR WINDOWS USERS:
echo Electron-builder extracts code-signing tools that require creating
echo symbolic links on Windows. If you encounter a symbolic link error:
echo 1. Close this window.
echo 2. Right-click "build-windows-exe.bat" and select "Run as administrator".
echo =======================================================================
echo.

if not exist "package.json" (
  echo ERROR: package.json not found in "%CD%".
  echo Please extract the entire downloaded .zip folder first, then run build-windows-exe.bat inside the extracted folder.
  pause
  exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed. Please install Node.js 22+ from https://nodejs.org/ and re-run this script.
  pause
  exit /b 1
)

echo [1/3] Installing dependencies...
call npm install --legacy-peer-deps --no-audit --no-fund
if %errorlevel% neq 0 (
  echo.
  echo First install attempt failed. Cleaning stale lock/cache and retrying...
  if exist "package-lock.json" del /f /q "package-lock.json"
  call npm install --legacy-peer-deps --no-audit --no-fund
)
if %errorlevel% neq 0 (
  echo.
  echo Failed to install dependencies. Please take a screenshot of the error above.
  pause
  exit /b 1
)

echo [2/3] Building Qikki frontend bundle...
if exist "scripts\sync-publish-repo.mjs" call node scripts/sync-publish-repo.mjs
call npm run build
if %errorlevel% neq 0 (
  echo Vite build failed. Please take a screenshot of the error above.
  pause
  exit /b 1
)

echo [3/3] Packaging Windows Installer and Portable .exe...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm install --no-save electron@^35.0.0 electron-builder@^26.0.12 --legacy-peer-deps --no-audit --no-fund
if %errorlevel% neq 0 (
  echo Failed to install Electron packaging tools. Please take a screenshot of the error above.
  pause
  exit /b 1
)
call npx electron-builder --win --x64
if %errorlevel% neq 0 (
  echo Electron packaging failed. Please take a screenshot of the error above.
  pause
  exit /b 1
)

echo.
echo Done! Your .exe files are ready inside the "release" folder.
explorer release
pause
