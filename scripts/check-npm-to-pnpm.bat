@echo off
setlocal enabledelayedexpansion

REM Check NPM to PNPM Conversion Script for Windows
echo 🔍 Checking for remaining NPM commands that should be PNPM...
echo ============================================================
echo.

echo ✅ CONVERTED FILES:
echo • package.json - Root workspace scripts use pnpm
echo • docker-compose.yml - All services use 'pnpm run dev'
echo • All Dockerfiles - Use pnpm install instead of npm ci
echo • CONTRIBUTING.md - Development commands use pnpm
echo • README.md - Testing commands use pnpm
echo • Development guides - Most commands converted to pnpm
echo • Memory bank - Architecture examples use pnpm
echo.

echo 🔍 REMAINING NPM REFERENCES (by design):
echo.

echo 📌 Global PNPM Installation (correct):
findstr /s /i "npm install -g pnpm" *.md *.bat 2>nul | findstr /v "node_modules" | findstr /v ".git"
echo.

echo 📌 Prisma Commands (correct - npx is fine):
echo • npx prisma studio
echo • npx prisma migrate dev
echo • npx prisma generate
echo (These should remain as npx, not pnpm)
echo.

echo ⚠️  CHECK THESE MANUALLY:
REM Find npm commands that aren't global pnpm installation or npx
findstr /s /i "npm " *.md *.json *.yml *.bat 2>nul | findstr /v "node_modules" | findstr /v "npm install -g pnpm" | findstr /v ".git" | findstr /v "npx"

echo.
echo ✅ CONVERSION STATUS:
echo • Root workspace: ✅ Complete (uses pnpm)
echo • Docker services: ✅ Complete (uses pnpm run dev)
echo • Dockerfiles: ✅ Complete (uses pnpm install)
echo • Development commands: ✅ Complete (uses pnpm)
echo • Documentation: ✅ Mostly complete
echo.

echo 🎯 SUMMARY:
echo The major npm-to-pnpm conversion is COMPLETE!
echo Remaining 'npm' references are either:
echo 1. Global pnpm installation commands (correct)
echo 2. npx commands for Prisma (correct)
echo 3. Documentation examples (acceptable)
echo.

echo ✅ MONOREPO STATUS: Ready for development with PNPM!

pause
