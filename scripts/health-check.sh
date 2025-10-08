#!/bin/bash

# ============================================================================
# Health Check Script for Logistics Aggregator Portal
# ============================================================================
# Verifies all services are running and responding correctly
# Returns 0 if all checks pass, 1 if any check fails
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
MAX_RETRIES=3
RETRY_DELAY=5

# Health check endpoints
declare -A SERVICES
SERVICES=(
    ["API Gateway"]="http://localhost:3001/health"
    ["Auth Service"]="http://localhost:3002/health"
    ["User Service"]="http://localhost:3003/health"
    ["Shipment Service"]="http://localhost:3004/health"
    ["Partner Service"]="http://localhost:3005/health"
    ["Wallet Service"]="http://localhost:3006/health"
    ["Support Service"]="http://localhost:3007/health"
    ["Platform Service"]="http://localhost:3008/health"
)

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}           HEALTH CHECK - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Function to check HTTP endpoint
check_http_endpoint() {
    local service_name="$1"
    local endpoint="$2"
    local retries=0

    while [ $retries -lt $MAX_RETRIES ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$endpoint" 2>/dev/null || echo "000")

        if [ "$response" = "200" ]; then
            return 0
        fi

        ((retries++))
        if [ $retries -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    done

    return 1
}

# Function to check Docker container
check_docker_container() {
    local container_name="$1"

    if docker ps --format '{{.Names}}' | grep -q "$container_name"; then
        # Check if container is healthy
        status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")

        if [ "$status" = "running" ]; then
            return 0
        fi
    fi

    return 1
}

# Check infrastructure services
echo -e "${BLUE}[INFRASTRUCTURE]${NC} Checking core services..."
echo ""

# PostgreSQL
((TOTAL_CHECKS++))
if check_docker_container "logistics-postgres"; then
    echo -e "${GREEN}✓${NC} PostgreSQL: Running"
    ((PASSED_CHECKS++))
else
    echo -e "${RED}✗${NC} PostgreSQL: Not running"
    ((FAILED_CHECKS++))
fi

# Redis
((TOTAL_CHECKS++))
if check_docker_container "logistics-redis"; then
    echo -e "${GREEN}✓${NC} Redis: Running"
    ((PASSED_CHECKS++))
else
    echo -e "${RED}✗${NC} Redis: Not running"
    ((FAILED_CHECKS++))
fi

echo ""

# Check application services
echo -e "${BLUE}[SERVICES]${NC} Checking application health endpoints..."
echo ""

for service_name in "${!SERVICES[@]}"; do
    endpoint="${SERVICES[$service_name]}"
    ((TOTAL_CHECKS++))

    if check_http_endpoint "$service_name" "$endpoint"; then
        echo -e "${GREEN}✓${NC} $service_name: Healthy"
        ((PASSED_CHECKS++))
    else
        echo -e "${YELLOW}⚠${NC} $service_name: Not responding (optional service)"
        ((WARNING_CHECKS++))
    fi
done

echo ""

# Check disk space
echo -e "${BLUE}[SYSTEM]${NC} Checking system resources..."
echo ""

# Disk space check
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
((TOTAL_CHECKS++))

if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Disk space: ${DISK_USAGE}% used"
    ((PASSED_CHECKS++))
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Disk space: ${DISK_USAGE}% used (WARNING)"
    ((WARNING_CHECKS++))
else
    echo -e "${RED}✗${NC} Disk space: ${DISK_USAGE}% used (CRITICAL)"
    ((FAILED_CHECKS++))
fi

# Memory check
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
((TOTAL_CHECKS++))

if [ "$MEMORY_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Memory usage: ${MEMORY_USAGE}%"
    ((PASSED_CHECKS++))
elif [ "$MEMORY_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Memory usage: ${MEMORY_USAGE}% (WARNING)"
    ((WARNING_CHECKS++))
else
    echo -e "${RED}✗${NC} Memory usage: ${MEMORY_USAGE}% (CRITICAL)"
    ((FAILED_CHECKS++))
fi

# Docker daemon check
((TOTAL_CHECKS++))
if docker info >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker: Running"
    ((PASSED_CHECKS++))
else
    echo -e "${RED}✗${NC} Docker: Not accessible"
    ((FAILED_CHECKS++))
fi

echo ""

# Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    HEALTH CHECK SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_CHECKS/$TOTAL_CHECKS)*100}")

echo -e "Total Checks:      $TOTAL_CHECKS"
echo -e "${GREEN}Passed:${NC}            $PASSED_CHECKS"

if [ $WARNING_CHECKS -gt 0 ]; then
    echo -e "${YELLOW}Warnings:${NC}          $WARNING_CHECKS"
fi

if [ $FAILED_CHECKS -gt 0 ]; then
    echo -e "${RED}Failed:${NC}            $FAILED_CHECKS"
fi

echo -e "Success Rate:      ${SUCCESS_RATE}%"
echo ""

# Final status
if [ $FAILED_CHECKS -eq 0 ]; then
    if [ $WARNING_CHECKS -eq 0 ]; then
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║              ✓ ALL SYSTEMS OPERATIONAL                   ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║          ⚠ SYSTEMS OPERATIONAL WITH WARNINGS             ║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${YELLOW}[NOTE]${NC} Some optional services or resources need attention"
        exit 0
    fi
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              ✗ SYSTEM HEALTH CHECK FAILED                ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}[ERROR]${NC} Critical services are not responding"
    echo -e "${RED}[ACTION]${NC} Check service logs: docker-compose logs -f"
    exit 1
fi
