#!/bin/bash

# ============================================================================
# Simplified Production Deployment Script
# ============================================================================
# Just uses the existing docker-compose.yml that already works
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}       PRODUCTION DEPLOYMENT STARTED${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Change to project directory
cd /var/www/sub-solution || exit 1

# Pull latest code (already done by GitLab CI)
echo -e "${BLUE}[INFO]${NC} Current directory: $(pwd)"
echo -e "${BLUE}[INFO]${NC} Current commit: $(git rev-parse HEAD)"

# Setup production environment variables
echo -e "${BLUE}[INFO]${NC} Setting up production environment..."
chmod +x scripts/setup-production-env.sh
./scripts/setup-production-env.sh

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[INFO]${NC} .env file not found, running setup..."

    # Copy .env.example if it exists
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}[SUCCESS]${NC} Created .env from .env.example"

        # Setup production URLs
        ./scripts/setup-production-env.sh
    fi

    # Run setup:dev which creates .env files and starts services
    echo -e "${BLUE}[INFO]${NC} Running setup:dev..."
    pnpm run setup:dev
else
    echo -e "${GREEN}[SUCCESS]${NC} .env file exists"

    # Just update dependencies and restart services
    echo -e "${BLUE}[INFO]${NC} Installing dependencies..."
    pnpm install --frozen-lockfile --prefer-offline

    echo -e "${BLUE}[INFO]${NC} Restarting services..."

    # Stop services with force and remove volumes/networks
    docker-compose down --timeout 30 --remove-orphans || true

    # Force remove any remaining containers
    docker ps -aq --filter "name=logistics-" | xargs -r docker rm -f 2>/dev/null || true

    # Remove the network explicitly if it exists
    docker network rm sub-solution_logistics-network 2>/dev/null || true

    # Prune unused networks
    docker network prune -f 2>/dev/null || true

    # Start services in detached mode (same as dev but with -d)
    docker-compose --profile all-services up -d --build
fi

# Wait for services to be ready
echo -e "${BLUE}[INFO]${NC} Waiting for services to start..."
sleep 30

# Simple health check
echo -e "${BLUE}[INFO]${NC} Checking container status..."
docker ps --format "table {{.Names}}\t{{.Status}}"

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}       DEPLOYMENT COMPLETED${NC}"
echo -e "${GREEN}=====================================================${NC}"

exit 0