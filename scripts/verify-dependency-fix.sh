#!/bin/bash

###############################################################################
# Verify Docker Dependency Fix Implementation
# This script verifies that all services have the enhanced entrypoint
###############################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Docker Dependency Fix Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVICES=(
    "api-gateway"
    "auth-service"
    "user-service"
    "shipment-service"
    "partner-service"
    "wallet-service"
    "support-service"
    "platform-service"
    "license-service"
)

FAILED=0
PASSED=0

# Check 1: Entrypoint script exists
echo "1️⃣  Checking entrypoint script..."
if [ -f "scripts/entrypoint.sh" ]; then
    echo -e "${GREEN}✅ scripts/entrypoint.sh exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ scripts/entrypoint.sh missing${NC}"
    ((FAILED++))
fi
echo ""

# Check 2: .dockerignore allows entrypoint
echo "2️⃣  Checking .dockerignore configuration..."
if grep -q "!scripts/entrypoint.sh" .dockerignore 2>/dev/null; then
    echo -e "${GREEN}✅ .dockerignore allows entrypoint.sh${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ .dockerignore not configured${NC}"
    ((FAILED++))
fi
echo ""

# Check 3: Verify all Dockerfiles
echo "3️⃣  Checking service Dockerfiles..."
for service in "${SERVICES[@]}"; do
    dockerfile="backend/$service/Dockerfile"

    if [ ! -f "$dockerfile" ]; then
        echo -e "${YELLOW}⚠️  $service: Dockerfile not found${NC}"
        continue
    fi

    # Check for entrypoint COPY
    if grep -q "COPY scripts/entrypoint.sh" "$dockerfile"; then
        # Check for ENTRYPOINT directive
        if grep -q "ENTRYPOINT.*entrypoint.sh" "$dockerfile"; then
            echo -e "${GREEN}✅ $service: Entrypoint configured${NC}"
            ((PASSED++))
        else
            echo -e "${RED}❌ $service: Missing ENTRYPOINT directive${NC}"
            ((FAILED++))
        fi
    else
        echo -e "${RED}❌ $service: Missing entrypoint COPY${NC}"
        ((FAILED++))
    fi
done
echo ""

# Check 4: Verify running containers have entrypoint
echo "4️⃣  Checking running containers..."
CONTAINER_CHECK_PASSED=0
CONTAINER_CHECK_FAILED=0

for service in "${SERVICES[@]}"; do
    container="logistics-$service"

    if docker ps --format '{{.Names}}' | grep -q "^$container$" 2>/dev/null; then
        if docker exec "$container" ls /usr/local/bin/entrypoint.sh >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $container: entrypoint.sh installed${NC}"
            ((CONTAINER_CHECK_PASSED++))
        else
            echo -e "${YELLOW}⚠️  $container: entrypoint.sh not found (rebuild needed)${NC}"
            ((CONTAINER_CHECK_FAILED++))
        fi
    else
        echo -e "${YELLOW}⚠️  $container: not running${NC}"
    fi
done

if [ $CONTAINER_CHECK_FAILED -eq 0 ]; then
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Some containers need rebuild${NC}"
fi
echo ""

# Check 5: Documentation exists
echo "5️⃣  Checking documentation..."
if [ -f "memory-bank/dockerDependencyFix.md" ]; then
    echo -e "${GREEN}✅ Comprehensive documentation exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Documentation missing${NC}"
    ((FAILED++))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo "The dependency fix is properly implemented."
    echo ""
    echo "Usage:"
    echo "  docker-compose restart [service]  # Dependencies auto-sync"
    echo "  docker-compose down -v && up -d   # Works even after cleanup"
    exit 0
else
    echo -e "${RED}❌ Some checks failed!${NC}"
    echo "Review the errors above and ensure:"
    echo "  1. scripts/entrypoint.sh exists"
    echo "  2. .dockerignore allows entrypoint.sh"
    echo "  3. All Dockerfiles have ENTRYPOINT directive"
    echo "  4. Containers rebuilt with: docker-compose build"
    exit 1
fi
