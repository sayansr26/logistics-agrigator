#!/bin/bash

# ============================================================================
# Logistics Aggregator Portal - Local Development Startup Script
# Run all services without Docker
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Logistics Aggregator Portal - Local Dev${NC}"
echo -e "${BLUE}============================================${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a service is running
check_service() {
    local port=$1
    local name=$2
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is already running on port $port"
        return 0
    else
        return 1
    fi
}

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}✗ Node.js is not installed. Please install Node.js >= 18${NC}"
    exit 1
fi

if ! command_exists pnpm; then
    echo -e "${RED}✗ pnpm is not installed. Please run: npm install -g pnpm${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v)"
echo -e "${GREEN}✓${NC} pnpm $(pnpm -v)"

# Check PostgreSQL
echo -e "\n${YELLOW}Checking PostgreSQL...${NC}"
if ! pg_isready -q 2>/dev/null; then
    echo -e "${RED}✗ PostgreSQL is not running.${NC}"
    echo -e "  Start it with: ${YELLOW}brew services start postgresql@15${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} PostgreSQL is running"

# Check Redis
echo -e "\n${YELLOW}Checking Redis...${NC}"
if ! redis-cli ping >/dev/null 2>&1; then
    echo -e "${RED}✗ Redis is not running.${NC}"
    echo -e "  Start it with: ${YELLOW}brew services start redis${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Redis is running"

# Function to start a service
start_service() {
    local name=$1
    local dir=$2
    local port=$3
    
    if check_service $port "$name"; then
        return 0
    fi
    
    echo -e "${BLUE}Starting $name on port $port...${NC}"
    cd "$PROJECT_ROOT/$dir"
    pnpm run dev &
    sleep 2
}

# Start services in order
echo -e "\n${YELLOW}Starting backend services...${NC}"

start_service "Auth Service" "backend/auth-service" 3002
start_service "API Gateway" "backend/api-gateway" 3001
start_service "User Service" "backend/user-service" 3003
start_service "Partner Service" "backend/partner-service" 3005
start_service "Wallet Service" "backend/wallet-service" 3006
start_service "Shipment Service" "backend/shipment-service" 3004
start_service "License Service" "backend/license-service" 3011

echo -e "\n${YELLOW}Starting frontend...${NC}"
start_service "Frontend" "frontend" 3000

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  All services started!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e ""
echo -e "  Frontend:      ${BLUE}http://localhost:3000${NC}"
echo -e "  API Gateway:   ${BLUE}http://localhost:3001${NC}"
echo -e "  Auth Service:  ${BLUE}http://localhost:3002${NC}"
echo -e ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo -e ""

# Wait for all background processes
wait
