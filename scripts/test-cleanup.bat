@echo off
echo [TEST] Starting test cleanup...

if exist "node_modules" (
    echo [INFO] Found node_modules directory
    rmdir /s /q "node_modules" 2>nul
    echo [SUCCESS] Removed node_modules
) else (
    echo [WARNING] node_modules not found
)

if exist "pnpm-lock.yaml" (
    echo [INFO] Found pnpm-lock.yaml
    del /f /q "pnpm-lock.yaml" 2>nul
    echo [SUCCESS] Removed pnpm-lock.yaml
) else (
    echo [WARNING] pnpm-lock.yaml not found
)

echo [SUCCESS] Test cleanup completed
pause
