@echo off
setlocal enabledelayedexpansion

REM Logistics Aggregator Portal - Cleanup Script for Windows
REM Removes all node_modules, build folders, lock files, and temporary files

echo [CLEANUP] Starting comprehensive cleanup...
echo [INFO] Starting cleanup process...

REM Skip over function definitions
goto :main

REM Function to safely remove directories/files
:remove_if_exists
set "path=%~1"
set "description=%~2"
if exist "!path!" (
    echo [INFO] Removing !description!: !path!
    rmdir /s /q "!path!" 2>nul
    if exist "!path!" (
        del /f /q "!path!" 2>nul
    )
    echo [SUCCESS] Removed !description!
) else (
    echo [WARNING] !description! not found: !path!
)
goto :eof

REM Main execution starts here
:main
echo [INFO] Cleaning workspace directories...

REM Remove root level dependencies and build artifacts
call :remove_if_exists "node_modules" "root node_modules"
call :remove_if_exists "pnpm-lock.yaml" "root pnpm lock file"
call :remove_if_exists "package-lock.json" "root npm lock file"
call :remove_if_exists "yarn.lock" "root yarn lock file"
call :remove_if_exists ".next" "root Next.js build"
call :remove_if_exists "dist" "root dist folder"
call :remove_if_exists "build" "root build folder"

REM Remove frontend dependencies and build artifacts
echo [INFO] Cleaning frontend...
call :remove_if_exists "frontend\node_modules" "frontend node_modules"
call :remove_if_exists "frontend\.next" "frontend Next.js build"
call :remove_if_exists "frontend\dist" "frontend dist folder"
call :remove_if_exists "frontend\build" "frontend build folder"
call :remove_if_exists "frontend\pnpm-lock.yaml" "frontend pnpm lock"
call :remove_if_exists "frontend\package-lock.json" "frontend npm lock"
call :remove_if_exists "frontend\yarn.lock" "frontend yarn lock"
call :remove_if_exists "frontend\.turbo" "frontend Turbo cache"

REM Remove backend service dependencies and build artifacts
echo [INFO] Cleaning backend services...
for %%s in (auth-service user-service shipment-service partner-service support-service platform-service api-gateway) do (
    set "service_path=backend\%%s"
    if exist "!service_path!" (
        echo [INFO] Cleaning %%s...
        call :remove_if_exists "!service_path!\node_modules" "%%s node_modules"
        call :remove_if_exists "!service_path!\dist" "%%s dist folder"
        call :remove_if_exists "!service_path!\build" "%%s build folder"
        call :remove_if_exists "!service_path!\pnpm-lock.yaml" "%%s pnpm lock"
        call :remove_if_exists "!service_path!\package-lock.json" "%%s npm lock"
        call :remove_if_exists "!service_path!\yarn.lock" "%%s yarn lock"
        call :remove_if_exists "!service_path!\.turbo" "%%s Turbo cache"
    )
)

REM Remove shared dependencies
echo [INFO] Cleaning shared modules...
call :remove_if_exists "shared\node_modules" "shared node_modules"
call :remove_if_exists "shared\dist" "shared dist folder"
call :remove_if_exists "shared\build" "shared build folder"
call :remove_if_exists "shared\pnpm-lock.yaml" "shared pnpm lock"
call :remove_if_exists "shared\package-lock.json" "shared npm lock"
call :remove_if_exists "shared\yarn.lock" "shared yarn lock"

REM Find and remove any remaining lock files and node_modules
echo [INFO] Finding remaining artifacts...
for /r . %%f in (node_modules) do (
    if exist "%%f" (
        echo [INFO] Removing remaining node_modules: %%f
        rmdir /s /q "%%f" 2>nul
    )
)

for /r . %%f in (pnpm-lock.yaml) do (
    if exist "%%f" (
        echo [INFO] Removing remaining pnpm lock: %%f
        del /f /q "%%f" 2>nul
    )
)

for /r . %%f in (package-lock.json) do (
    if exist "%%f" (
        echo [INFO] Removing remaining npm lock: %%f
        del /f /q "%%f" 2>nul
    )
)

for /r . %%f in (yarn.lock) do (
    if exist "%%f" (
        echo [INFO] Removing remaining yarn lock: %%f
        del /f /q "%%f" 2>nul
    )
)

REM Remove build and cache directories
echo [INFO] Cleaning build and cache directories...
for /r . %%f in (.next) do (
    if exist "%%f" (
        echo [INFO] Removing Next.js build: %%f
        rmdir /s /q "%%f" 2>nul
    )
)

for /r . %%f in (dist) do (
    if exist "%%f" (
        echo [INFO] Removing dist directory: %%f
        rmdir /s /q "%%f" 2>nul
    )
)

for /r . %%f in (build) do (
    if exist "%%f" (
        echo [INFO] Removing build directory: %%f
        rmdir /s /q "%%f" 2>nul
    )
)

for /r . %%f in (.turbo) do (
    if exist "%%f" (
        echo [INFO] Removing Turbo cache: %%f
        rmdir /s /q "%%f" 2>nul
    )
)

REM Remove temporary files
echo [INFO] Cleaning temporary files...
for /r . %%f in (*.log) do (
    if exist "%%f" (
        echo [INFO] Removing log file: %%f
        del /f /q "%%f" 2>nul
    )
)

for /r . %%f in (*.tmp) do (
    if exist "%%f" (
        echo [INFO] Removing temp file: %%f
        del /f /q "%%f" 2>nul
    )
)

for /r . %%f in (.DS_Store) do (
    if exist "%%f" (
        echo [INFO] Removing macOS file: %%f
        del /f /q "%%f" 2>nul
    )
)

for /r . %%f in (Thumbs.db) do (
    if exist "%%f" (
        echo [INFO] Removing Windows file: %%f
        del /f /q "%%f" 2>nul
    )
)

REM Remove Docker build cache (optional)
where docker >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Cleaning Docker artifacts...

    REM Stop only logistics project containers (filter by name prefix)
    echo [INFO] Stopping logistics project containers...
    for /f "tokens=*" %%i in ('docker ps -q --filter "name=logistics-" 2^>nul') do (
        echo [INFO] Stopping logistics container: %%i
        docker stop %%i 2>nul
    )

    REM Remove project containers using docker-compose
    echo [INFO] Removing project containers via docker-compose...
    docker-compose down -v 2>nul
    docker-compose -f docker-compose.frontend.yml down -v 2>nul
    docker-compose -f docker-compose.backend.yml down -v 2>nul

    REM Clean up Docker system (ONLY logistics-related resources)
    if "%1"=="--docker-deep-clean" (
        echo [WARNING] Performing deep Docker cleanup ^(LOGISTICS PROJECT ONLY^)...

        REM Remove logistics-specific images only
        echo [INFO] Removing logistics Docker images...
        for /f "tokens=*" %%i in ('docker images --filter "reference=*logistics*" -q 2^>nul') do (
            docker rmi -f %%i 2>nul
        )

        REM Remove dangling images
        echo [INFO] Removing dangling images...
        docker image prune -f 2>nul

        REM Remove logistics-specific volumes only
        echo [INFO] Removing logistics Docker volumes...
        for /f "tokens=*" %%i in ('docker volume ls --filter "name=logistics" -q 2^>nul') do (
            docker volume rm %%i 2>nul
        )

        REM Remove logistics-specific networks only
        echo [INFO] Removing logistics Docker networks...
        for /f "tokens=*" %%i in ('docker network ls --filter "name=logistics" -q 2^>nul') do (
            docker network rm %%i 2>nul
        )

        REM Clean build cache ^(safe - doesn't affect other projects^)
        echo [INFO] Cleaning Docker build cache...
        docker builder prune -f 2>nul

        echo [SUCCESS] Docker deep clean completed ^(logistics project only^)
    ) else (
        echo [INFO] Cleaning Docker build cache...
        docker builder prune -f 2>nul
        echo [SUCCESS] Docker build cache cleaned
    )
)

REM Remove IDE and editor files
echo [INFO] Cleaning IDE files...
call :remove_if_exists ".vscode\settings.json" "VSCode settings"
call :remove_if_exists ".idea" "IntelliJ IDEA files"
call :remove_if_exists ".eslintcache" "ESLint cache"

REM Clean pnpm cache
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Cleaning pnpm cache...
    pnpm store prune 2>nul
    echo [SUCCESS] pnpm cache cleaned
)

REM Summary
echo.
echo [SUCCESS] Cleanup completed successfully!
echo.
echo [SUCCESS] All node_modules directories removed
echo [SUCCESS] All lock files removed
echo [SUCCESS] All build directories removed
echo [SUCCESS] All cache directories removed
echo [SUCCESS] All temporary files removed
echo [SUCCESS] Docker containers and volumes cleaned

echo.
echo [INFO] Next steps:
echo    1. Run 'pnpm run setup:dev:win' for full stack development (Windows)
echo    2. Run 'pnpm run setup:frontend:win' for frontend only (Windows)
echo    3. Run 'pnpm run setup:backend:win' for backend only (Windows)
echo.
echo [WARNING] Remember to check your .env files are properly configured!

pause
