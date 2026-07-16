#!/bin/bash

# Logistics Aggregator Portal - Cleanup Script
# Removes all node_modules, build folders, lock files, and temporary files

set -e

echo "🧹 Starting comprehensive cleanup..."
echo ""

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

# Confirmation prompt
print_warning "⚠️  This will remove ALL node_modules, Docker containers, and volumes!"
print_warning "⚠️  Make sure you've committed any important changes."
echo ""
read -p "Continue with cleanup? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi
echo ""

###############################################################################
# STEP 1: STOP AND REMOVE DOCKER FIRST
# This is CRITICAL - must happen BEFORE trying to delete directories
###############################################################################

if command -v docker &> /dev/null; then
    print_status "🐳 Step 1: Stopping Docker containers and removing volumes..."

    # Stop only logistics project containers
    logistics_containers=$(docker ps -q --filter "name=logistics-" 2>/dev/null || true)
    if [ -n "$logistics_containers" ]; then
        print_status "Stopping logistics containers..."
        echo "$logistics_containers" | xargs docker stop 2>/dev/null || true
        print_success "✅ Containers stopped"
    fi

    # Remove containers AND volumes - this unmounts volume directories
    print_status "Removing containers and volumes..."
    docker-compose down -v 2>/dev/null || true
    docker-compose -f docker-compose.frontend.yml down -v 2>/dev/null || true
    docker-compose -f docker-compose.backend.yml down -v 2>/dev/null || true
    print_success "✅ Docker containers and volumes removed"

    # Wait a moment for volumes to fully unmount
    sleep 2
    echo ""
fi

###############################################################################
# STEP 2: CLEAN HOST DIRECTORIES
# Now that volumes are unmounted, we can safely delete directories
###############################################################################

print_status "🗂️  Step 2: Cleaning workspace directories..."

# Function to safely remove directories/files
safe_remove() {
    local path="$1"
    local description="$2"

    if [ -e "$path" ]; then
        print_status "Removing $description: $path"
        rm -rf "$path" 2>/dev/null || {
            print_warning "⚠️  Could not remove $description: $path (may need sudo)"
            return 1
        }
        print_success "✅ Removed $description"
    fi
}

# Remove root level dependencies
safe_remove "node_modules" "root node_modules"
safe_remove "package-lock.json" "root npm lock"
safe_remove "yarn.lock" "root yarn lock"
safe_remove ".next" "root Next.js build"
safe_remove "dist" "root dist"
safe_remove "build" "root build"

# Remove frontend
print_status "🎨 Cleaning frontend..."
safe_remove "frontend/node_modules" "frontend node_modules"
safe_remove "frontend/.next" "frontend Next.js build"
safe_remove "frontend/dist" "frontend dist"
safe_remove "frontend/build" "frontend build"
safe_remove "frontend/yarn.lock" "frontend yarn lock"
safe_remove "frontend/.turbo" "frontend Turbo cache"

# Remove backend services
print_status "🔧 Cleaning backend services..."

backend_services=("api-gateway" "auth-service" "user-service" "shipment-service" "partner-service" "support-service" "platform-service" "wallet-service" "license-service")

for service in "${backend_services[@]}"; do
    service_path="backend/$service"
    if [ -d "$service_path" ]; then
        print_status "Cleaning $service..."
        safe_remove "$service_path/node_modules" "$service node_modules"
        safe_remove "$service_path/dist" "$service dist"
        safe_remove "$service_path/build" "$service build"
        safe_remove "$service_path/yarn.lock" "$service yarn lock"
        safe_remove "$service_path/.turbo" "$service Turbo cache"
    fi
done

# Remove shared
print_status "📦 Cleaning shared modules..."
safe_remove "shared/node_modules" "shared node_modules"
safe_remove "shared/dist" "shared dist"

echo ""

###############################################################################
# STEP 3: FIND AND REMOVE REMAINING ARTIFACTS
###############################################################################

print_status "🔍 Step 3: Finding remaining artifacts..."

# Find and remove function with better error handling
find_and_remove() {
    local pattern="$1"
    local description="$2"

    print_status "Finding $description..."

    # Find and remove directories
    found_count=0
    while IFS= read -r item; do
        if [ -d "$item" ] || [ -f "$item" ]; then
            rm -rf "$item" 2>/dev/null && {
                print_success "✅ Removed: $item"
                ((found_count++))
            } || print_warning "⚠️  Could not remove: $item"
        fi
    done < <(find . -name "$pattern" 2>/dev/null || true)

    if [ $found_count -eq 0 ]; then
        print_status "No $description found"
    else
        print_success "✅ Removed $found_count $description"
    fi
}

# Clean remaining artifacts
find_and_remove "node_modules" "node_modules directories"
find_and_remove ".next" "Next.js builds"
find_and_remove "dist" "dist directories"
find_and_remove "build" "build directories"
find_and_remove ".turbo" "Turbo caches"
find_and_remove "yarn.lock" "yarn locks"
find_and_remove "*.log" "log files"
find_and_remove ".DS_Store" "macOS files"

echo ""

###############################################################################
# STEP 4: DEEP DOCKER CLEANUP (Optional)
###############################################################################

if [ "$1" = "--docker-deep-clean" ]; then
    if command -v docker &> /dev/null; then
        print_warning "⚠️  Step 4: Performing deep Docker cleanup..."

        # Remove logistics images
        print_status "Removing logistics Docker images..."
        docker images --filter "reference=*logistics*" -q | xargs -r docker rmi -f 2>/dev/null || true

        # Remove dangling images
        print_status "Removing dangling images..."
        docker image prune -f 2>/dev/null || true

        # Remove logistics volumes
        print_status "Removing logistics volumes..."
        docker volume ls --filter "name=logistics" -q | xargs -r docker volume rm 2>/dev/null || true

        # Remove logistics networks
        print_status "Removing logistics networks..."
        docker network ls --filter "name=logistics" -q | xargs -r docker network rm 2>/dev/null || true

        # Clean build cache
        print_status "Cleaning Docker build cache..."
        docker builder prune -f 2>/dev/null || true

        print_success "✅ Deep Docker cleanup completed"
        echo ""
    fi
fi

###############################################################################
# STEP 5: FINAL CLEANUP
###############################################################################

print_status "🧽 Step 5: Final cleanup..."

# Clean yarn cache
if command -v yarn &> /dev/null; then
    print_status "Cleaning yarn cache..."
    yarn cache clean 2>/dev/null || true
    print_success "✅ yarn cache cleaned"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Cleanup completed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "✅ All node_modules directories removed"
print_success "✅ All build directories removed"
print_success "✅ Docker containers and volumes cleaned"
if [ "$1" = "--docker-deep-clean" ]; then
    print_success "✅ Deep Docker cleanup completed"
fi
echo ""
print_status "📋 Next steps:"
echo "   yarn dev               # Start all services (auto-installs dependencies)"
echo "   yarn setup:dev         # Full setup with environment files"
echo ""
print_warning "⚠️  Dependencies will auto-install when containers start (via entrypoint.sh)"
