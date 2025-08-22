@echo off
setlocal enabledelayedexpansion

REM Logistics Aggregator Portal - Setup Script for Windows
REM Automatically sets up .env files and dependencies for development

echo 🚀 Starting Logistics Aggregator Portal setup...

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: pnpm is not installed or not in PATH
    echo Please install pnpm first: npm install -g pnpm
    pause
    exit /b 1
)

REM Check if Docker is running
docker version >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: Docker is not running or not installed
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Function to setup .env file from .env.example
:setup_env_file
set "source_file=%~1"
set "target_file=%~2"
set "description=%~3"
set "force=%~4"

if exist "!source_file!" (
    if not exist "!target_file!" (
        echo [INFO] Setting up !description!...
        copy "!source_file!" "!target_file!" >nul
        echo ✅ Created !target_file!
    ) else if "!force!"=="--force" (
        echo [INFO] Overwriting !description!...
        copy "!source_file!" "!target_file!" >nul
        echo ✅ Updated !target_file!
    ) else (
        echo ⚠️  !target_file! already exists, skipping (use --force to overwrite)
    )
) else (
    echo ❌ !source_file! not found
    goto :eof
)
goto :eof

REM Function to create service-specific .env files
:create_service_env
set "service=%~1"
set "port=%~2"
set "db_name=%~3"
set "force=%~4"

set "env_file=backend\!service!\.env"
set "env_example=backend\!service!\.env.example"

REM Always prioritize .env.example if it exists
if exist "!env_example!" (
    echo [INFO] Setting up !service! environment from .env.example...
    call :setup_env_file "!env_example!" "!env_file!" "!service! environment" "!force!"
) else (
    REM Fallback: Create a basic .env file for the service
    echo ⚠️  No .env.example found for !service!, creating basic .env file
    
    if not exist "!env_file!" (
        echo [INFO] Creating basic !service! environment file...
        
        (
            echo # Environment variables for !service!
            echo # WARNING: This is a fallback .env file. Consider creating a proper .env.example
            echo.
            echo # Database
            echo DATABASE_URL="postgresql://logistics:logistics123@localhost:5432/logistics_!db_name!"
            echo.
            echo # Redis
            echo REDIS_URL="redis://localhost:6379"
            echo.
            echo # JWT Configuration
            echo JWT_SECRET="your-super-secret-jwt-key-change-in-production"
            echo JWT_EXPIRES_IN="3600"
            echo.
            echo # Service Configuration
            echo NODE_ENV="development"
            echo PORT="!port!"
            echo.
            echo # Service URLs (for inter-service communication)
            echo AUTH_SERVICE_URL="http://localhost:8001"
            echo USER_SERVICE_URL="http://localhost:8002"
            echo SHIPMENT_SERVICE_URL="http://localhost:8003"
            echo SUPPORT_SERVICE_URL="http://localhost:8004"
            echo PLATFORM_SERVICE_URL="http://localhost:8005"
            echo API_GATEWAY_URL="http://localhost:8000"
            echo.
            echo # External Services
            echo WALLET_SERVICE_URL="http://localhost:8006"
            echo WALLET_SERVICE_API_KEY="your_wallet_service_api_key"
        ) > "!env_file!"
        
        echo ✅ Created !env_file!
    ) else if "!force!"=="--force" (
        echo [INFO] Overwriting !service! environment file...
        
        (
            echo # Environment variables for !service!
            echo # WARNING: This is a fallback .env file. Consider creating a proper .env.example
            echo.
            echo # Database
            echo DATABASE_URL="postgresql://logistics:logistics123@localhost:5432/logistics_!db_name!"
            echo.
            echo # Redis
            echo REDIS_URL="redis://localhost:6379"
            echo.
            echo # JWT Configuration
            echo JWT_SECRET="your-super-secret-jwt-key-change-in-production"
            echo JWT_EXPIRES_IN="3600"
            echo.
            echo # Service Configuration
            echo NODE_ENV="development"
            echo PORT="!port!"
            echo.
            echo # Service URLs (for inter-service communication)
            echo AUTH_SERVICE_URL="http://localhost:8001"
            echo USER_SERVICE_URL="http://localhost:8002"
            echo SHIPMENT_SERVICE_URL="http://localhost:8003"
            echo SUPPORT_SERVICE_URL="http://localhost:8004"
            echo PLATFORM_SERVICE_URL="http://localhost:8005"
            echo API_GATEWAY_URL="http://localhost:8000"
            echo.
            echo # External Services
            echo WALLET_SERVICE_URL="http://localhost:8006"
            echo WALLET_SERVICE_API_KEY="your_wallet_service_api_key"
        ) > "!env_file!"
        
        echo ✅ Updated !env_file!
    ) else (
        echo ⚠️  !env_file! already exists, skipping (use --force to overwrite)
    )
)
goto :eof

REM Check command line arguments
set "setup_type=%~1"
set "force_flag=%~2"

if "%setup_type%"=="--force" (
    set "force_flag=--force"
    set "setup_type="
)

echo 📋 Setup type: %setup_type%
if defined force_flag echo 🔄 Force mode: enabled

REM Setup root .env file
echo 🌍 Setting up root environment...
if exist ".env.example" (
    call :setup_env_file ".env.example" ".env" "root environment" "%force_flag%"
) else (
    echo ⚠️  No root .env.example found, creating basic .env file
    
    if not exist ".env" (
        (
            echo # Root environment variables
            echo # Database
            echo POSTGRES_USER=logistics
            echo POSTGRES_PASSWORD=logistics123
            echo POSTGRES_DB=logistics_main
            echo.
            echo # Redis
            echo REDIS_PASSWORD=
            echo.
            echo # JWT
            echo JWT_SECRET=your-super-secret-jwt-key-change-in-production
            echo.
            echo # Service URLs
            echo AUTH_SERVICE_URL=http://localhost:8001
            echo USER_SERVICE_URL=http://localhost:8002
            echo SHIPMENT_SERVICE_URL=http://localhost:8003
            echo SUPPORT_SERVICE_URL=http://localhost:8004
            echo PLATFORM_SERVICE_URL=http://localhost:8005
            echo API_GATEWAY_URL=http://localhost:8000
        ) > ".env"
        echo ✅ Created root .env file
    ) else if defined force_flag (
        echo [INFO] Overwriting root .env file...
        (
            echo # Root environment variables
            echo # Database
            echo POSTGRES_USER=logistics
            echo POSTGRES_PASSWORD=logistics123
            echo POSTGRES_DB=logistics_main
            echo.
            echo # Redis
            echo REDIS_PASSWORD=
            echo.
            echo # JWT
            echo JWT_SECRET=your-super-secret-jwt-key-change-in-production
            echo.
            echo # Service URLs
            echo AUTH_SERVICE_URL=http://localhost:8001
            echo USER_SERVICE_URL=http://localhost:8002
            echo SHIPMENT_SERVICE_URL=http://localhost:8003
            echo SUPPORT_SERVICE_URL=http://localhost:8004
            echo PLATFORM_SERVICE_URL=http://localhost:8005
            echo API_GATEWAY_URL=http://localhost:8000
        ) > ".env"
        echo ✅ Updated root .env file
    ) else (
        echo ⚠️  Root .env already exists, skipping (use --force to overwrite)
    )
)

REM Setup service-specific .env files
echo 🔧 Setting up service environments...

if "%setup_type%"=="" (
    REM Setup all services
    call :create_service_env "auth-service" "8001" "auth" "%force_flag%"
    call :create_service_env "user-service" "8002" "users" "%force_flag%"
    call :create_service_env "shipment-service" "8003" "shipments" "%force_flag%"
    call :create_service_env "support-service" "8004" "support" "%force_flag%"
    call :create_service_env "platform-service" "8005" "platforms" "%force_flag%"
    call :create_service_env "api-gateway" "8000" "main" "%force_flag%"
) else if "%setup_type%"=="--frontend" (
    echo 🎨 Frontend-only setup selected
    REM Frontend doesn't need .env file for basic setup
) else if "%setup_type%"=="--backend" (
    echo 🔧 Backend-only setup selected
    call :create_service_env "auth-service" "8001" "auth" "%force_flag%"
    call :create_service_env "user-service" "8002" "users" "%force_flag%"
    call :create_service_env "shipment-service" "8003" "shipments" "%force_flag%"
    call :create_service_env "support-service" "8004" "support" "%force_flag%"
    call :create_service_env "platform-service" "8005" "platforms" "%force_flag%"
    call :create_service_env "api-gateway" "8000" "main" "%force_flag%"
) else (
    echo ❌ Unknown setup type: %setup_type%
    echo Valid options: --frontend, --backend, or none for all
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
if "%setup_type%"=="" (
    echo [INFO] Installing all dependencies...
    pnpm install
) else if "%setup_type%"=="--frontend" (
    echo [INFO] Installing frontend dependencies...
    pnpm --filter frontend install
) else if "%setup_type%"=="--backend" (
    echo [INFO] Installing backend dependencies...
    pnpm --filter "logistics-*" install
)

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
if "%setup_type%"=="" (
    echo    1. Run 'pnpm run dev' for full stack development
    echo    2. Run 'pnpm run dev:frontend' for frontend only
    echo    3. Run 'pnpm run dev:backend' for backend only
) else if "%setup_type%"=="--frontend" (
    echo    1. Run 'pnpm run dev:frontend' to start frontend
    echo    2. Run 'pnpm run dev:backend' if you need backend services
) else if "%setup_type%"=="--backend" (
    echo    1. Run 'pnpm run dev:backend' to start backend services
    echo    2. Run 'pnpm run dev:frontend' if you need frontend
)
echo.
echo ⚠️  Remember to:
echo    - Configure your database connection strings
echo    - Set proper JWT secrets for production
echo    - Update service URLs if using different ports
echo.
echo 🚀 Ready to develop!

pause
