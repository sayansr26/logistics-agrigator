#!/bin/bash

# Fix Server Node Modules - Shipment Service
# This script fixes the "Cannot find module 'axios'" error by recreating node_modules volumes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo "🔧 Fixing Shipment Service node_modules issue..."
echo ""

# Step 1: Stop shipment service
print_status "🛑 Stopping shipment-service..."
docker-compose stop shipment-service || true
print_success "✅ Service stopped"

# Step 2: Remove the container
print_status "🗑️  Removing shipment-service container..."
docker-compose rm -f shipment-service || true
print_success "✅ Container removed"

# Step 3: Delete the old node_modules volume
print_status "💥 Deleting old node_modules volume (this fixes the axios issue)..."
docker volume rm logistics-main_shipment_node_modules 2>/dev/null || \
docker volume rm logistics_shipment_node_modules 2>/dev/null || \
docker volume rm sub-solution_shipment_node_modules 2>/dev/null || \
print_warning "Volume might not exist or already deleted"
print_success "✅ Volume deleted"

# Step 4: Rebuild the image (to ensure latest Dockerfile)
print_status "🔨 Rebuilding shipment-service image..."
docker-compose build --no-cache shipment-service || {
    print_error "Failed to rebuild image"
    exit 1
}
print_success "✅ Image rebuilt"

# Step 5: Start the service (will create fresh node_modules with axios)
print_status "▶️  Starting shipment-service..."
docker-compose up -d shipment-service || {
    print_error "Failed to start service"
    exit 1
}
print_success "✅ Service started"

# Step 6: Wait for service to initialize
print_status "⏳ Waiting for service to initialize (15 seconds)..."
sleep 15

# Step 7: Check logs
print_status "📋 Checking logs for errors..."
echo ""
docker-compose logs --tail=30 shipment-service

echo ""
print_status "🔍 Checking for axios error..."
if docker-compose logs shipment-service | grep -q "Cannot find module 'axios'"; then
    print_error "❌ Axios error still present!"
    echo ""
    print_warning "Try these steps:"
    echo "1. docker-compose exec shipment-service ls -la /app/node_modules/axios"
    echo "2. docker-compose exec shipment-service pnpm list axios"
    echo "3. docker-compose exec shipment-service pnpm install axios"
    exit 1
else
    print_success "✅ No axios errors found"
fi

# Step 8: Health check
print_status "🏥 Performing health check..."
sleep 5
response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/health" 2>/dev/null || echo "000")

if [ "$response" = "200" ]; then
    print_success "✅ Shipment Service is healthy!"
    echo ""
    curl -s http://localhost:3004/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3004/health
else
    print_error "❌ Health check failed (HTTP $response)"
    echo ""
    print_warning "Check logs with: docker-compose logs shipment-service"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
print_success "🎉 Fix script completed!"
echo ""
print_status "📋 Verification commands:"
echo "   View logs:          docker-compose logs -f shipment-service"
echo "   Check health:       curl http://localhost:3004/health"
echo "   Check axios:        docker-compose exec shipment-service ls node_modules/axios"
echo "   Check modules:      docker-compose exec shipment-service pnpm list"
echo "═══════════════════════════════════════════════════════════"
echo ""
