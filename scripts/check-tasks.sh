#!/bin/bash

# Task Management Auto-Detection Script
# Usage: ./scripts/check-tasks.sh [--start]

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         LOGISTICS PLATFORM - TASK AUTO-DETECTOR           ║${NC}"
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Function to extract task status from markdown
extract_tasks() {
    local file=$1
    local prefix=$2

    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ File not found: $file${NC}"
        return
    fi

    echo -e "${BLUE}📋 Analyzing: $file${NC}"
    echo ""

    # Extract NOT_STARTED tasks with P0 priority
    local p0_tasks=$(grep -A5 "Status.*NOT_STARTED" "$file" | grep -B5 "Priority.*P0" | grep "Task ID:" | sed 's/.*Task ID: //' | sed 's/ //g' || true)

    if [ -n "$p0_tasks" ]; then
        echo -e "${RED}🔴 CRITICAL TASKS (P0 - NOT STARTED):${NC}"
        echo "$p0_tasks" | while read task; do
            # Get task name
            local task_name=$(grep -A2 "Task ID: $task" "$file" | grep "Task Name:" | sed 's/.*Task Name.*: //' | sed 's/\*\*//g')
            echo -e "  ${RED}● $task${NC} - $task_name"
        done
        echo ""
    fi

    # Extract IN_PROGRESS tasks
    local progress_tasks=$(grep -A5 "Status.*IN_PROGRESS" "$file" | grep "Task ID:" | sed 's/.*Task ID: //' | sed 's/ //g' || true)

    if [ -n "$progress_tasks" ]; then
        echo -e "${YELLOW}🟡 IN PROGRESS:${NC}"
        echo "$progress_tasks" | while read task; do
            local task_name=$(grep -A2 "Task ID: $task" "$file" | grep "Task Name:" | sed 's/.*Task Name.*: //' | sed 's/\*\*//g')
            echo -e "  ${YELLOW}● $task${NC} - $task_name"
        done
        echo ""
    fi

    # Extract COMPLETED tasks
    local completed_tasks=$(grep -A5 "Status.*COMPLETED" "$file" | grep "Task ID:" | sed 's/.*Task ID: //' | sed 's/ //g' || true)

    if [ -n "$completed_tasks" ]; then
        echo -e "${GREEN}🟢 COMPLETED:${NC}"
        echo "$completed_tasks" | while read task; do
            local task_name=$(grep -A2 "Task ID: $task" "$file" | grep "Task Name:" | sed 's/.*Task Name.*: //' | sed 's/\*\*//g')
            echo -e "  ${GREEN}✓ $task${NC} - $task_name"
        done
        echo ""
    fi
}

# Check Backend Tasks
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}              BACKEND GATEWAY TASKS                         ${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo ""
extract_tasks "backend/BACKEND_GATEWAY_TASK.md" "GATE"

# Check Frontend Tasks
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}          FRONTEND ARCHITECTURE TASKS                       ${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo ""
extract_tasks "frontend/FRONTEND_ARCHITECTURE_TASK.md" "FE"

# Summary and Recommendations
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    RECOMMENDATIONS                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if GATE-001 is ready to start
if grep -q "GATE-001.*NOT_STARTED" "backend/BACKEND_GATEWAY_TASK.md" 2>/dev/null; then
    echo -e "${RED}🎯 NEXT CRITICAL ACTION:${NC}"
    echo -e "   ${YELLOW}1. Backup docker-compose.yml${NC}"
    echo -e "   ${YELLOW}2. Start GATE-001: Remove external service ports${NC}"
    echo ""
    echo -e "${BLUE}💡 To auto-start implementation:${NC}"
    echo -e "   ${GREEN}Ask Claude: 'Start implementing GATE-001'${NC}"
    echo ""
fi

# Check dependencies
echo -e "${BLUE}📊 DEPENDENCY STATUS:${NC}"
echo ""

# Count completed vs pending
backend_completed=$(grep -c "Status.*COMPLETED" "backend/BACKEND_GATEWAY_TASK.md" 2>/dev/null || echo "0")
backend_total=$(grep -c "Task ID:" "backend/BACKEND_GATEWAY_TASK.md" 2>/dev/null || echo "0")

frontend_completed=$(grep -c "Status.*COMPLETED" "frontend/FRONTEND_ARCHITECTURE_TASK.md" 2>/dev/null || echo "0")
frontend_total=$(grep -c "Task ID:" "frontend/FRONTEND_ARCHITECTURE_TASK.md" 2>/dev/null || echo "0")

echo -e "   Backend:  ${GREEN}$backend_completed${NC}/${BLUE}$backend_total${NC} completed"
echo -e "   Frontend: ${GREEN}$frontend_completed${NC}/${BLUE}$frontend_total${NC} completed"
echo ""

# Calculate progress
if [ "$backend_total" -gt 0 ]; then
    backend_percent=$((backend_completed * 100 / backend_total))
    echo -e "   Backend Progress:  ${CYAN}$backend_percent%${NC}"
fi

if [ "$frontend_total" -gt 0 ]; then
    frontend_percent=$((frontend_completed * 100 / frontend_total))
    echo -e "   Frontend Progress: ${CYAN}$frontend_percent%${NC}"
fi

echo ""
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for --start flag
if [ "$1" == "--start" ]; then
    echo -e "${GREEN}🚀 Auto-start mode detected!${NC}"
    echo -e "${YELLOW}Ready to begin implementation...${NC}"
    echo ""
fi
