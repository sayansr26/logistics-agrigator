#!/bin/bash

###############################################################################
# QUICK CLEANUP - Fast cleanup without deep Docker operations
# Use this for quick resets without waiting for Docker deep clean
###############################################################################

set -e

echo "⚡ Quick Cleanup Starting..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Stop containers
echo -e "${BLUE}[1/3]${NC} Stopping containers..."
docker-compose down 2>/dev/null || true
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

# Remove volumes
echo -e "${BLUE}[2/3]${NC} Removing Docker volumes..."
docker-compose down -v 2>/dev/null || true
echo -e "${GREEN}✅ Volumes removed${NC}"
echo ""

# Clean build cache
echo -e "${BLUE}[3/3]${NC} Cleaning build cache..."
docker builder prune -f 2>/dev/null || true
echo -e "${GREEN}✅ Build cache cleaned${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Quick cleanup complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Note:${NC} node_modules in services are Docker volumes"
echo "They will auto-sync when containers start (via entrypoint.sh)"
echo ""
echo "Next steps:"
echo "  pnpm run dev           # Start all services"
echo "  docker-compose up -d   # Start in background"
echo ""
