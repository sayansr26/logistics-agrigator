#!/bin/bash

# Logistics Aggregator Portal - Server Deployment Script
# Forces rebuild of Docker images and deploys services

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

echo "🚀 Starting Logistics Portal Deployment..."
echo ""

# Step 1: Pull latest code
print_status "📥 Pulling latest code from repository..."
git pull origin master || {
    print_error "Failed to pull latest code"
    exit 1
}
print_success "✅ Code updated"

# Step 2: Stop all running containers
print_status "🛑 Stopping all running containers..."
docker-compose down || true
print_success "✅ Containers stopped"

# Step 3: Clean up old images (optional - uncomment if needed)
# print_warning "🧹 Cleaning up old Docker images..."
# docker images --filter "reference=*logistics*" -q | xargs -r docker rmi -f 2>/dev/null || true

# Step 4: Rebuild all images WITHOUT cache
print_status "🔨 Rebuilding all Docker images (this may take a few minutes)..."
docker-compose build --no-cache --pull || {
    print_error "Failed to rebuild images"
    exit 1
}
print_success "✅ Images rebuilt successfully"

# Step 5: Start all services
print_status "▶️  Starting all services..."
docker-compose --profile all-services up -d || {
    print_error "Failed to start services"
    exit 1
}
print_success "✅ All services started"

# Step 6: Wait for services to initialize
print_status "⏳ Waiting for services to initialize (15 seconds)..."
sleep 15

# Step 7: Health checks
print_status "🏥 Performing health checks..."
echo ""

services=(
    "http://localhost:3001/health:API Gateway"
    "http://localhost:3002/health:Auth Service"
    "http://localhost:3003/health:User Service"
    "http://localhost:3004/health:Shipment Service"
    "http://localhost:3005/health:Partner Service"
    "http://localhost:3006/health:Wallet Service"
    "http://localhost:3007/health:Support Service"
    "http://localhost:3008/health:Platform Service"
)

all_healthy=true

for service_info in "${services[@]}"; do
    IFS=: read -r url name <<< "$service_info"

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
        print_success "✅ $name is healthy"
    else
        print_error "❌ $name is not responding (HTTP $response)"
        all_healthy=false
    fi
done

echo ""

# Step 8: Check for permission errors in logs
print_status "🔍 Checking for permission errors in logs..."
permission_errors=$(docker-compose logs | grep -i "EACCES" | wc -l)

if [ "$permission_errors" -eq 0 ]; then
    print_success "✅ No permission errors found"
else
    print_warning "⚠️  Found $permission_errors permission error(s) in logs"
    print_warning "Run 'docker-compose logs | grep EACCES' to see details"
fi

# Step 9: Check for missing dependencies
print_status "🔍 Checking for missing dependencies..."
dependency_errors=$(docker-compose logs | grep -i "Cannot find module" | wc -l)

if [ "$dependency_errors" -eq 0 ]; then
    print_success "✅ No dependency errors found"
else
    print_error "❌ Found $dependency_errors dependency error(s)"
    print_warning "Run 'docker-compose logs | grep \"Cannot find module\"' to see details"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"

if [ "$all_healthy" = true ] && [ "$permission_errors" -eq 0 ] && [ "$dependency_errors" -eq 0 ]; then
    print_success "🎉 Deployment completed successfully!"
    echo ""
    print_status "📋 Service URLs:"
    echo "   Frontend:          http://localhost:3000"
    echo "   API Gateway:       http://localhost:3001"
    echo "   Auth Service:      http://localhost:3002"
    echo "   User Service:      http://localhost:3003"
    echo "   Shipment Service:  http://localhost:3004"
    echo "   Partner Service:   http://localhost:3005"
    echo "   Wallet Service:    http://localhost:3006"
    echo "   Support Service:   http://localhost:3007"
    echo "   Platform Service:  http://localhost:3008"
else
    print_warning "⚠️  Deployment completed with warnings"
    echo ""
    print_status "📋 Troubleshooting commands:"
    echo "   View logs:          docker-compose logs -f"
    echo "   Check status:       docker ps"
    echo "   Restart service:    docker-compose restart [service-name]"
    echo "   View specific logs: docker-compose logs [service-name]"
fi

echo "═══════════════════════════════════════════════════════════"
echo ""
