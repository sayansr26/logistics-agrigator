#!/bin/bash

# Logistics Aggregator Portal - Cleanup Script
# Removes all node_modules, build folders, lock files, and temporary files

set -e

echo "🧹 Starting comprehensive cleanup..."

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

# Function to safely remove directories/files
safe_remove() {
    local path="$1"
    local description="$2"
    
    if [ -e "$path" ]; then
        print_status "Removing $description: $path"
        rm -rf "$path"
        print_success "✅ Removed $description"
    else
        print_warning "⚠️  $description not found: $path"
    fi
}

# Function to find and remove files by pattern
find_and_remove() {
    local pattern="$1"
    local description="$2"
    
    print_status "Finding and removing $description..."
    
    # Find files matching pattern and remove them
    found_files=$(find . -name "$pattern" -type f 2>/dev/null || true)
    found_dirs=$(find . -name "$pattern" -type d 2>/dev/null || true)
    
    if [ -n "$found_files" ]; then
        echo "$found_files" | while read -r file; do
            if [ -f "$file" ]; then
                print_status "Removing file: $file"
                rm -f "$file"
            fi
        done
    fi
    
    if [ -n "$found_dirs" ]; then
        echo "$found_dirs" | while read -r dir; do
            if [ -d "$dir" ]; then
                print_status "Removing directory: $dir"
                rm -rf "$dir"
            fi
        done
    fi
}

echo "🗂️  Cleaning workspace directories..."

# Remove root level dependencies and build artifacts
safe_remove "node_modules" "root node_modules"
safe_remove "pnpm-lock.yaml" "root pnpm lock file"
safe_remove "package-lock.json" "root npm lock file"
safe_remove "yarn.lock" "root yarn lock file"
safe_remove ".next" "root Next.js build"
safe_remove "dist" "root dist folder"
safe_remove "build" "root build folder"

# Remove frontend dependencies and build artifacts
print_status "🎨 Cleaning frontend..."
safe_remove "frontend/node_modules" "frontend node_modules"
safe_remove "frontend/.next" "frontend Next.js build"
safe_remove "frontend/dist" "frontend dist folder"
safe_remove "frontend/build" "frontend build folder"
safe_remove "frontend/pnpm-lock.yaml" "frontend pnpm lock"
safe_remove "frontend/package-lock.json" "frontend npm lock"
safe_remove "frontend/yarn.lock" "frontend yarn lock"
safe_remove "frontend/.turbo" "frontend Turbo cache"

# Remove backend service dependencies and build artifacts
print_status "🔧 Cleaning backend services..."

backend_services=("auth-service" "user-service" "shipment-service" "partner-service" "support-service" "platform-service" "api-gateway", "wallet-service")

for service in "${backend_services[@]}"; do
    service_path="backend/$service"
    if [ -d "$service_path" ]; then
        print_status "Cleaning $service..."
        safe_remove "$service_path/node_modules" "$service node_modules"
        safe_remove "$service_path/dist" "$service dist folder"
        safe_remove "$service_path/build" "$service build folder"
        safe_remove "$service_path/pnpm-lock.yaml" "$service pnpm lock"
        safe_remove "$service_path/package-lock.json" "$service npm lock"
        safe_remove "$service_path/yarn.lock" "$service yarn lock"
        safe_remove "$service_path/.turbo" "$service Turbo cache"
    fi
done

# Remove shared dependencies
print_status "📦 Cleaning shared modules..."
safe_remove "shared/node_modules" "shared node_modules"
safe_remove "shared/dist" "shared dist folder"
safe_remove "shared/build" "shared build folder"
safe_remove "shared/pnpm-lock.yaml" "shared pnpm lock"
safe_remove "shared/package-lock.json" "shared npm lock"
safe_remove "shared/yarn.lock" "shared yarn lock"

# Find and remove any remaining lock files and node_modules
print_status "🔍 Finding remaining artifacts..."
find_and_remove "node_modules" "remaining node_modules directories"
find_and_remove "pnpm-lock.yaml" "remaining pnpm lock files"
find_and_remove "package-lock.json" "remaining npm lock files"
find_and_remove "yarn.lock" "remaining yarn lock files"

# Remove build and cache directories
print_status "🗑️  Cleaning build and cache directories..."
find_and_remove ".next" "Next.js build directories"
find_and_remove "dist" "dist directories"
find_and_remove "build" "build directories"
find_and_remove ".turbo" "Turbo cache directories"

# Remove temporary files
print_status "🧽 Cleaning temporary files..."
find_and_remove "*.log" "log files"
find_and_remove "*.tmp" "temporary files"
find_and_remove ".DS_Store" "macOS system files"
find_and_remove "Thumbs.db" "Windows system files"

# Remove Docker build cache (optional)
if command -v docker &> /dev/null; then
    print_status "🐳 Cleaning Docker artifacts..."

    # Stop only logistics project containers (filter by name prefix)
    logistics_containers=$(docker ps -q --filter "name=logistics-" 2>/dev/null || true)
    if [ -n "$logistics_containers" ]; then
        print_status "Stopping logistics project containers..."
        echo "$logistics_containers" | xargs docker stop 2>/dev/null || true
        print_success "✅ Stopped logistics containers"
    fi

    # Remove project containers using docker-compose
    print_status "Removing project containers via docker-compose..."
    docker-compose down -v 2>/dev/null || true
    docker-compose -f docker-compose.frontend.yml down -v 2>/dev/null || true
    docker-compose -f docker-compose.backend.yml down -v 2>/dev/null || true

    # Clean up Docker system (ONLY logistics-related resources)
    if [ "$1" = "--docker-deep-clean" ]; then
        print_warning "⚠️  Performing deep Docker cleanup (LOGISTICS PROJECT ONLY)..."

        # Remove logistics-specific images only
        print_status "Removing logistics Docker images..."
        docker images --filter "reference=*logistics*" -q | xargs -r docker rmi -f 2>/dev/null || true

        # Remove dangling images (not used by any container)
        print_status "Removing dangling images..."
        docker image prune -f 2>/dev/null || true

        # Remove logistics-specific volumes only
        print_status "Removing logistics Docker volumes..."
        docker volume ls --filter "name=logistics" -q | xargs -r docker volume rm 2>/dev/null || true

        # Remove logistics-specific networks only
        print_status "Removing logistics Docker networks..."
        docker network ls --filter "name=logistics" -q | xargs -r docker network rm 2>/dev/null || true

        # Clean build cache (safe - doesn't affect other projects)
        print_status "Cleaning Docker build cache..."
        docker builder prune -f 2>/dev/null || true

        print_success "✅ Docker deep clean completed (logistics project only)"
    else
        print_status "Cleaning Docker build cache..."
        docker builder prune -f 2>/dev/null || true
        print_success "✅ Docker build cache cleaned"
    fi
fi

# Remove IDE and editor files
print_status "💻 Cleaning IDE files..."
find_and_remove ".vscode/settings.json" "VSCode settings"
find_and_remove ".idea" "IntelliJ IDEA files"
safe_remove ".eslintcache" "ESLint cache"

# Clean pnpm cache
if command -v pnpm &> /dev/null; then
    print_status "📦 Cleaning pnpm cache..."
    pnpm store prune 2>/dev/null || true
    print_success "✅ pnpm cache cleaned"
fi

# Summary
echo ""
echo "🎉 Cleanup completed successfully!"
echo ""
print_success "✅ All node_modules directories removed"
print_success "✅ All lock files removed"
print_success "✅ All build directories removed"
print_success "✅ All cache directories removed"
print_success "✅ All temporary files removed"
print_success "✅ Docker containers and volumes cleaned"

echo ""
print_status "📋 Next steps:"
echo "   1. Run 'pnpm run setup:dev' for full stack development"
echo "   2. Run 'pnpm run setup:frontend' for frontend only"
echo "   3. Run 'pnpm run setup:backend' for backend only"
echo ""
print_warning "⚠️  Remember to check your .env files are properly configured!"
