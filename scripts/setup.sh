#!/bin/bash

# Logistics Aggregator Portal - Setup Script
# Automatically sets up .env files and dependencies for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to setup .env file from .env.example
setup_env_file() {
    local source_file="$1"
    local target_file="$2"
    local description="$3"
    local service_name_for_replacement="$5" # New argument for service name
    
    if [ -f "$source_file" ]; then
        if [ ! -f "$target_file" ] || [ "$4" = "--force" ]; then
            print_status "Setting up $description..."
            cp "$source_file" "$target_file"
            # Replace localhost with service names for Docker environment ONLY for service .env files
            if [ -n "$service_name_for_replacement" ]; then
                replace_localhost_with_service_names "$service_name_for_replacement" "$target_file"
            fi
            print_success "✅ Created $target_file"
        else
            # Check if existing .env file needs URL fixes
            if [ -n "$service_name_for_replacement" ]; then
                fix_existing_env_urls "$service_name_for_replacement" "$target_file"
            fi
            print_warning "⚠️  $target_file already exists, skipping (use --force to overwrite)"
        fi
    else
        print_error "❌ $source_file not found"
        return 1
    fi
}

# Function to fix common URL issues in existing .env files
fix_existing_env_urls() {
    local service_name="$1"
    local env_file="$2"
    local fixed_something=false
    
    # Fix DATABASE_URL with wrong port (5432 instead of 3008)
    if grep -q "DATABASE_URL=\".*@localhost:5432/" "$env_file"; then
        sed -i '' 's/localhost:5432/localhost:3008/' "$env_file"
        print_status "Fixed DATABASE_URL port in $env_file (5432 → 3008)"
        fixed_something=true
    fi
    
    # Fix REDIS_URL with wrong port (6379 instead of 3009)
    if grep -q "REDIS_URL=\".*@localhost:6379\"" "$env_file"; then
        sed -i '' 's/localhost:6379/localhost:3009/' "$env_file"
        print_status "Fixed REDIS_URL port in $env_file (6379 → 3009)"
        fixed_something=true
    fi
    
    # Apply Docker service name replacements if any fixes were made
    if [ "$fixed_something" = true ]; then
        replace_localhost_with_service_names "$service_name" "$env_file"
    fi
}

# Function to replace localhost with Docker service names in .env files
replace_localhost_with_service_names() {
    local service_name="$1"
    local env_file="$2"
    
    print_status "Adjusting $env_file for Docker environment..."
    
    # Replace DATABASE_URL localhost with postgres service name
    if grep -q "DATABASE_URL=\".*@localhost:3008/" "$env_file"; then
        sed -i '' 's/localhost:3008/postgres:5432/' "$env_file"
        print_status "Updated DATABASE_URL in $env_file"
    fi
    
    # Replace REDIS_URL localhost with redis service name
    if grep -q "REDIS_URL=\".*@localhost:3009/" "$env_file"; then
        sed -i '' 's/localhost:3009/redis:6379/' "$env_file"
        print_status "Updated REDIS_URL in $env_file"
    fi
    
    # Replace inter-service communication URLs
    # This assumes that the .env.example files already contain these variables,
    # which they should, as seen from the previous read_file calls.
    # We will replace localhost with the service name in each URL.
    
    # Define services and their ports (excluding the current service itself)
    # The ports are internal Docker ports, not external mapped ports.
    local services="auth-service:3002 user-service:3003 shipment-service:3004 partner-service:3005 support-service:3006 platform-service:3007 api-gateway:3001"
    
    for svc_port in $services; do
        local svc=$(echo "$svc_port" | cut -d':' -f1)
        local port=$(echo "$svc_port" | cut -d':' -f2)
        
        if [ "$svc" != "$service_name" ]; then # Don't replace own service URL if it exists
            local uppercase_svc=$(echo "$svc" | tr '[:lower:]-' '[:upper:]_')
            local var_name="${uppercase_svc}_SERVICE_URL"
            
            if grep -q "${var_name}=\"http://localhost:${port}\"" "$env_file"; then
                # Use a different delimiter for sed to avoid issues with '/' in URLs
                sed -i '' "s|${var_name}=\"http://localhost:${port}\"|${var_name}=\"http://${svc}:${port}\"|" "$env_file"
                print_status "Updated ${var_name} in $env_file to use service name"
            fi
        fi
    done
}

# Function to create service-specific .env files
create_service_env() {
    local service="$1"
    local port="$2"
    local db_name="$3"
    
    local env_file="backend/$service/.env"
    local env_example="backend/$service/.env.example"
    
    # Always prioritize .env.example if it exists
    if [ -f "$env_example" ]; then
        print_status "Setting up $service environment from .env.example..."
        setup_env_file "$env_example" "$env_file" "$service environment" "$4" "$service" # Pass service name for replacement
    else
        # Fallback: Create a basic .env file for the service (this should rarely happen now)
        print_warning "⚠️  No .env.example found for $service, creating basic .env file"
        
        if [ ! -f "$env_file" ] || [ "$4" = "--force" ]; then
            print_status "Creating basic $service environment file..."
            
            cat > "$env_file" << EOF
# Environment variables for $service
# WARNING: This is a fallback .env file. Consider creating a proper .env.example

# Database
DATABASE_URL="postgresql://logistics:logistics123@localhost:3008/logistics_$db_name"

# Redis
REDIS_URL="redis://localhost:3009"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="3600"

# Service Configuration
NODE_ENV="development"
PORT="$port"

# Service URLs (for inter-service communication)
AUTH_SERVICE_URL="http://localhost:3002"
USER_SERVICE_URL="http://localhost:3003"
SHIPMENT_SERVICE_URL="http://localhost:3004"
SUPPORT_SERVICE_URL="http://localhost:3006"
PLATFORM_SERVICE_URL="http://localhost:3007"
PARTNER_SERVICE_URL="http://localhost:3005"
API_GATEWAY_URL="http://localhost:3001"

# External Services
WALLET_SERVICE_URL="http://localhost:8006"
WALLET_SERVICE_API_KEY="your_wallet_service_api_key"
PARTNER_SERVICE_EXTERNAL_URL="https://calc.websiteduniya.com"
PARTNER_SERVICE_API_KEY="your_partner_service_api_key"

# Prisma
PRISMA_QUERY_ENGINE_BINARY=""
EOF
            print_success "✅ Created basic $env_file"
            print_warning "⚠️  Consider creating backend/$service/.env.example for better configuration"
        else
            print_warning "⚠️  $env_file already exists, skipping (use --force to overwrite)"
        fi
    fi
}

# Function to create frontend .env file
create_frontend_env() {
    local env_file="frontend/.env.local"
    
    if [ ! -f "$env_file" ] || [ "$1" = "--force" ]; then
        print_status "Creating frontend environment file..."
        
        cat > "$env_file" << EOF
# Frontend Environment Variables

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3001

# Service URLs (for direct service calls if needed)
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3002
NEXT_PUBLIC_USER_SERVICE_URL=http://localhost:3003
NEXT_PUBLIC_SHIPMENT_SERVICE_URL=http://localhost:3004

# Application Configuration
NEXT_PUBLIC_APP_NAME="Logistics Aggregator Portal"
NEXT_PUBLIC_APP_VERSION="1.0.0"

# Tracking Configuration
NEXT_PUBLIC_TRACKING_URL=http://localhost:3000/track

# Development Configuration
NODE_ENV=development
NEXT_PUBLIC_ENVIRONMENT=development

# External Services (if frontend needs direct access)
NEXT_PUBLIC_WALLET_SERVICE_URL=http://localhost:8006
NEXT_PUBLIC_PARTNER_SERVICE_EXTERNAL_URL=https://calc.websiteduniya.com
EOF
        print_success "✅ Created $env_file"
    else
        print_warning "⚠️  $env_file already exists, skipping (use --force to overwrite)"
    fi
}

# Parse command line arguments
SETUP_TYPE="full"
FORCE_OVERWRITE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend)
            SETUP_TYPE="frontend"
            shift
            ;;
        --backend)
            SETUP_TYPE="backend"
            shift
            ;;
        --force)
            FORCE_OVERWRITE="--force"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Usage: $0 [--frontend|--backend] [--force]"
            exit 1
            ;;
    esac
done

echo "🚀 Starting Logistics Aggregator Portal setup..."
echo "Setup type: $SETUP_TYPE"

# Setup root .env file
if [ "$SETUP_TYPE" = "full" ] || [ "$SETUP_TYPE" = "backend" ]; then
    print_status "📋 Setting up root environment..."
    setup_env_file ".env.example" ".env" "root environment" "$FORCE_OVERWRITE" "" # No service name for root .env
fi

# Setup backend services
if [ "$SETUP_TYPE" = "full" ] || [ "$SETUP_TYPE" = "backend" ]; then
    print_status "🔧 Setting up backend services..."
    
    # Define services with their ports and database names
    services="auth-service:3002:auth user-service:3003:users shipment-service:3004:shipments partner-service:3005:partners support-service:3006:support platform-service:3007:platforms api-gateway:3001:gateway"
    
    for service_config in $services; do
        IFS=':' read -r service port db_name <<< "$service_config"
        
        if [ -d "backend/$service" ]; then
            create_service_env "$service" "$port" "$db_name" "$FORCE_OVERWRITE"
        else
            print_warning "⚠️  Service directory backend/$service not found, skipping"
        fi
    done
fi

# Setup frontend
if [ "$SETUP_TYPE" = "full" ] || [ "$SETUP_TYPE" = "frontend" ]; then
    print_status "🎨 Setting up frontend..."
    
    if [ -d "frontend" ]; then
        create_frontend_env "$FORCE_OVERWRITE"
    else
        print_warning "⚠️  Frontend directory not found, skipping"
    fi
fi

# Setup shared module
if [ "$SETUP_TYPE" = "full" ] || [ "$SETUP_TYPE" = "backend" ]; then
    if [ -d "shared" ]; then
        print_status "📦 Setting up shared module..."
        # Shared module typically doesn't need its own .env, but we can create one if needed
        print_success "✅ Shared module ready"
    fi
fi

# Install dependencies
print_status "📦 Installing dependencies..."

if command -v pnpm &> /dev/null; then
    print_status "Installing with pnpm..."
    pnpm install
    print_success "✅ Dependencies installed"
else
    print_error "❌ pnpm not found. Please install pnpm first:"
    echo "   npm install -g pnpm@8.15.1"
    exit 1
fi

# Generate Prisma clients and deploy migrations for backend services
if [ "$SETUP_TYPE" = "full" ] || [ "$SETUP_TYPE" = "backend" ]; then
    print_status "🗄️  Setting up Prisma for backend services..."
    
    for service in auth-service user-service shipment-service partner-service support-service platform-service; do
        if [ -d "backend/$service" ] && [ -f "backend/$service/prisma/schema.prisma" ]; then
            print_status "Setting up Prisma for $service..."
            
            # Generate Prisma client
            (cd "backend/$service" && npx prisma generate) || print_warning "⚠️  Failed to generate Prisma client for $service"
            
            # Note: Migrations will be deployed automatically when containers start
            if [ -d "backend/$service/prisma/migrations" ]; then
                print_status "✅ Migrations found for $service (will deploy on container startup)"
            else
                print_status "ℹ️  No migrations directory for $service"
            fi
        fi
    done
    
    print_success "✅ Prisma setup completed"
fi

# Summary and next steps
echo ""
echo "🎉 Setup completed successfully!"
echo ""

case $SETUP_TYPE in
    "full")
        print_success "✅ Full stack setup complete"
        echo ""
        print_status "📋 Next steps:"
        echo "   1. Review and update .env files with your specific configuration"
        echo "   2. Run 'pnpm run dev' to start all services"
        echo "   3. Access frontend at http://localhost:3000"
        echo "   4. Access API Gateway at http://localhost:3001"
        echo "   5. Access Auth Service Swagger at http://localhost:3002/api-docs"
        ;;
    "frontend")
        print_success "✅ Frontend setup complete"
        echo ""
        print_status "📋 Next steps:"
        echo "   1. Review frontend/.env.local configuration"
        echo "   2. Run 'pnpm run dev:frontend' to start frontend"
        echo "   3. Access frontend at http://localhost:3000"
        ;;
    "backend")
        print_success "✅ Backend setup complete"
        echo ""
        print_status "📋 Next steps:"
        echo "   1. Review .env files in each service directory"
        echo "   2. Run 'pnpm run dev:backend' to start backend services"
        echo "   3. Access API Gateway at http://localhost:3001"
        echo "   4. Access Auth Service Swagger at http://localhost:3002/api-docs"
        ;;
esac

echo ""
print_warning "⚠️  Important:"
echo "   - Update JWT_SECRET in production"
echo "   - Configure external service API keys"
echo "   - Set up proper database credentials for production"
echo ""
