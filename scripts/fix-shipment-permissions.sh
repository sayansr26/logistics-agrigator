#!/bin/bash

# ============================================================================
# IMMEDIATE FIX FOR SHIPMENT SERVICE PERMISSION ISSUE
# ============================================================================
# This script fixes the EACCES permission denied error preventing axios installation
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}    FIXING SHIPMENT SERVICE PERMISSION ISSUE${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Step 1: Stop ALL containers using the volume
echo -e "${BLUE}[1/7]${NC} Stopping ALL containers using shipment volume..."
docker-compose stop shipment-service || true
# Find and stop any other containers using the volume
docker ps -a --filter "volume=shipment_node_modules" -q | xargs -r docker stop 2>/dev/null || true
echo -e "${GREEN}✅ Containers stopped${NC}"

# Step 2: Remove containers
echo -e "${BLUE}[2/7]${NC} Removing shipment-service container..."
docker-compose rm -f shipment-service || true
# Remove any other containers using the volume
docker ps -a --filter "volume=shipment_node_modules" -q | xargs -r docker rm -f 2>/dev/null || true
echo -e "${GREEN}✅ Containers removed${NC}"

# Step 3: Force remove the problematic volume
echo -e "${BLUE}[3/7]${NC} Force removing old node_modules volume..."
# Try different volume name patterns
docker volume rm -f logistics-main_shipment_node_modules 2>/dev/null || \
docker volume rm -f logistics_shipment_node_modules 2>/dev/null || \
docker volume rm -f sub-solution_shipment_node_modules 2>/dev/null || \
docker volume rm -f shipment_node_modules 2>/dev/null || \
echo -e "${YELLOW}⚠️  Volume might already be removed${NC}"

# List any remaining volumes with shipment in the name
echo -e "${BLUE}[INFO]${NC} Checking for remaining shipment volumes..."
docker volume ls | grep shipment || echo "No shipment volumes found"
echo -e "${GREEN}✅ Volume cleanup complete${NC}"

# Step 4: Pull latest code (if needed)
if [ -d ".git" ]; then
    echo -e "${BLUE}[4/7]${NC} Pulling latest code..."
    git pull origin master || git pull origin main || echo "Already up to date"
    echo -e "${GREEN}✅ Code updated${NC}"
else
    echo -e "${YELLOW}[4/7]${NC} Skipping git pull (not in git directory)"
fi

# Step 5: Rebuild the image with new Dockerfile (NO CACHE)
echo -e "${BLUE}[5/7]${NC} Rebuilding shipment-service image with permission fixes..."
docker-compose build --no-cache --pull shipment-service || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}
echo -e "${GREEN}✅ Image rebuilt with permission fixes${NC}"

# Step 6: Start the service (will create fresh volume with proper permissions)
echo -e "${BLUE}[6/7]${NC} Starting shipment-service with fresh volume..."
docker-compose up -d shipment-service || {
    echo -e "${RED}❌ Failed to start service${NC}"
    exit 1
}
echo -e "${GREEN}✅ Service started${NC}"

# Step 7: Wait and verify
echo -e "${BLUE}[7/7]${NC} Waiting for service to initialize (20 seconds)..."
sleep 20

# Check if axios is installed
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}                    VERIFICATION${NC}"
echo -e "${BLUE}============================================================${NC}"

# Check for axios in node_modules
echo -e "${BLUE}[CHECK]${NC} Looking for axios in node_modules..."
if docker-compose exec shipment-service ls /app/node_modules/axios 2>/dev/null; then
    echo -e "${GREEN}✅ AXIOS FOUND! - Module is properly installed${NC}"
else
    echo -e "${YELLOW}⚠️  Axios not found yet, checking if install is running...${NC}"
    docker-compose logs --tail=20 shipment-service
fi

# Check for permission errors
echo ""
echo -e "${BLUE}[CHECK]${NC} Checking for permission errors..."
if docker-compose logs shipment-service 2>&1 | grep -q "EACCES"; then
    echo -e "${RED}❌ Permission errors still present${NC}"
    echo "Recent logs:"
    docker-compose logs --tail=30 shipment-service
else
    echo -e "${GREEN}✅ No permission errors found${NC}"
fi

# Check for module not found errors
echo ""
echo -e "${BLUE}[CHECK]${NC} Checking for 'Cannot find module' errors..."
if docker-compose logs shipment-service 2>&1 | grep -q "Cannot find module"; then
    echo -e "${YELLOW}⚠️  Module errors found, but service might still be installing...${NC}"
    echo "Recent logs:"
    docker-compose logs --tail=20 shipment-service
else
    echo -e "${GREEN}✅ No module errors found${NC}"
fi

# Health check
echo ""
echo -e "${BLUE}[CHECK]${NC} Testing health endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/health" 2>/dev/null || echo "000")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed! Service is running${NC}"
    curl -s http://localhost:3004/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3004/health
else
    echo -e "${YELLOW}⚠️  Health check returned: $response${NC}"
    echo "Service might still be starting. Check with:"
    echo "  docker-compose logs -f shipment-service"
fi

# Final summary
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}                    SUMMARY${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "The Dockerfile has been updated with:"
echo "  ✅ Proper write permissions for /app directory (755)"
echo "  ✅ Write permissions for node_modules (775)"
echo "  ✅ pnpm store directory with correct permissions"
echo "  ✅ Startup script that runs pnpm install if needed"
echo ""
echo "Commands to monitor progress:"
echo "  📋 View logs:        docker-compose logs -f shipment-service"
echo "  🔍 Check axios:      docker-compose exec shipment-service ls node_modules/axios"
echo "  🏥 Health check:     curl http://localhost:3004/health"
echo "  📦 Check packages:   docker-compose exec shipment-service pnpm list"
echo ""
echo -e "${GREEN}🎯 Fix applied! The service should now be able to install dependencies.${NC}"
echo -e "${YELLOW}Note: First startup may take 1-2 minutes while dependencies install.${NC}"