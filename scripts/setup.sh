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
    
    if [ -f "$source_file" ]; then
        if [ ! -f "$target_file" ] || [ "$4" = "--force" ]; then
            print_status "Setting up $description..."
            cp "$source_file" "$target_file"
            print_success "✅ Created $target_file"
        else
            print_warning "⚠️  $target_file already exists, skipping (use --force to overwrite)"
        fi
    else
        print_error "❌ $source_file not found"
        return 1
    fi
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
        setup_env_file "$env_example" "$env_file" "$service environment" "$4"
    else
        # Fallback: Create a basic .env file for the service (this should rarely happen now)
        print_warning "⚠️  No .env.example found for $service, creating basic .env file"
        
        if [ ! -f "$env_file" ] || [ "$4" = "--force" ]; then
            print_status "Creating basic $service environment file..."
            
            cat > "$env_file" << EOF
# Environment variables for $service
# WARNING: This is a fallback .env file. Consider creating a proper .env.example

# Database
DATABASE_URL="postgresql://logistics:logistics123@localhost:5432/logistics_$db_name"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="3600"

# Service Configuration
NODE_ENV="development"
PORT="$port"

# Service URLs (for inter-service communication)
AUTH_SERVICE_URL="http://localhost:8001"
USER_SERVICE_URL="http://localhost:8002"
SHIPMENT_SERVICE_URL="http://localhost:8003"
SUPPORT_SERVICE_URL="http://localhost:8004"
PLATFORM_SERVICE_URL="http://localhost:8005"
API_GATEWAY_URL="http://localhost:8000"

# External Services
WALLET_SERVICE_URL="http://localhost:8006"
WALLET_SERVICE_API_KEY="your_wallet_service_api_key"
PARTNER_SERVICE_URL="http://localhost:8007"
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
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:8000

# Service URLs (for direct service calls if needed)
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:8001
NEXT_PUBLIC_USER_SERVICE_URL=http://localhost:8002
NEXT_PUBLIC_SHIPMENT_SERVICE_URL=http://localhost:8003

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
NEXT_PUBLIC_PARTNER_SERVICE_URL=http://localhost:8007
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
    setup_env_file ".env.example" ".env" "root environment" "$FORCE_OVERWRITE"
fi

# Setup backend services
if [ "$SETUP_TYPE" = "full" ] || [ "$SETUP_TYPE" = "backend" ]; then
    print_status "🔧 Setting up backend services..."
    
    # Define services with their ports and database names
    services="auth-service:8001:auth user-service:8002:users shipment-service:8003:shipments support-service:8004:support platform-service:8005:platforms api-gateway:8000:gateway"
    
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

# Generate Prisma clients for backend services
if [ "$SETUP_TYPE" = "full" ] || [ "$SETUP_TYPE" = "backend" ]; then
    print_status "🗄️  Generating Prisma clients..."
    
    for service in auth-service user-service shipment-service support-service platform-service; do
        if [ -d "backend/$service" ] && [ -f "backend/$service/prisma/schema.prisma" ]; then
            print_status "Generating Prisma client for $service..."
            (cd "backend/$service" && npx prisma generate) || print_warning "⚠️  Failed to generate Prisma client for $service"
        fi
    done
    
    print_success "✅ Prisma clients generated"
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
        echo "   4. Access API Gateway at http://localhost:8000"
        echo "   5. Access Auth Service Swagger at http://localhost:8001/api-docs"
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
        echo "   3. Access API Gateway at http://localhost:8000"
        echo "   4. Access Auth Service Swagger at http://localhost:8001/api-docs"
        ;;
esac

echo ""
print_warning "⚠️  Important:"
echo "   - Update JWT_SECRET in production"
echo "   - Configure external service API keys"
echo "   - Set up proper database credentials for production"
echo ""
