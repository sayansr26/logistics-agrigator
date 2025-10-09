#!/bin/bash

# ============================================================================
# UPDATE ALL DOCKERFILES WITH PROPER PERMISSIONS
# ============================================================================
# This script updates all service Dockerfiles to ensure proper permissions
# ============================================================================

set -e

# Colors for output
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

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}    UPDATING ALL DOCKERFILES WITH PERMISSION FIXES${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Define all backend services
BACKEND_SERVICES=(
    "auth-service"
    "user-service"
    "shipment-service"
    "partner-service"
    "wallet-service"
    "support-service"
    "platform-service"
    "api-gateway"
)

# Function to update a backend service Dockerfile
update_dockerfile() {
    local service=$1
    local dockerfile="backend/${service}/Dockerfile"

    if [ ! -f "$dockerfile" ]; then
        echo -e "${YELLOW}[SKIP]${NC} ${service}: Dockerfile not found"
        return
    fi

    print_status "Updating ${service} Dockerfile..."

    # Check if already has the fix
    if grep -q "CRITICAL FIX: Ensure /app directory" "$dockerfile" 2>/dev/null; then
        print_status "${service}: Already has permission fixes"
        return
    fi

    # Create backup
    cp "$dockerfile" "${dockerfile}.backup"

    # Read the Dockerfile and apply fixes
    awk '
    /^USER nodejs/ {
        if (!printed) {
            print "# CRITICAL FIX: Ensure /app directory and all subdirectories are writable by nodejs user"
            print "# This allows pnpm to create temp files and install dependencies when running as nodejs user"
            print "RUN chown -R nodejs:nodejs /app"
            print "RUN chmod -R 755 /app"
            print "RUN chmod -R 775 /app/node_modules 2>/dev/null || true"
            print ""
            print "# Create .pnpm-store directory for pnpm cache with proper permissions"
            print "RUN mkdir -p /app/.pnpm-store && chown -R nodejs:nodejs /app/.pnpm-store && chmod 775 /app/.pnpm-store"
            print ""
            print "# Create startup script that ensures dependencies are installed before starting"
            print "RUN printf '\''#!/bin/sh\\necho \"Checking and installing dependencies if needed...\"\\npnpm install --frozen-lockfile 2>/dev/null || pnpm install\\necho \"Running Prisma migrations...\"\\nnpx prisma migrate deploy || echo \"Migration failed or no migrations to apply\"\\necho \"Starting server with auto-reload...\"\\nexec pnpm run dev\\n'\'' > /app/start.sh"
            print "RUN chmod +x /app/start.sh"
            print "RUN chown nodejs:nodejs /app/start.sh"
            print ""
            printed = 1
        }
    }
    {print}
    /^CMD/ {
        # Replace CMD with our startup script
        if ($0 !~ /start\.sh/) {
            gsub(/^CMD.*/, "CMD [\"/app/start.sh\"]")
        }
    }
    ' "$dockerfile" > "${dockerfile}.tmp"

    # Move the updated file back
    mv "${dockerfile}.tmp" "$dockerfile"

    print_success "${service}: Dockerfile updated with permission fixes"
}

# Update frontend Dockerfile
update_frontend_dockerfile() {
    local dockerfile="frontend/Dockerfile"

    if [ ! -f "$dockerfile" ]; then
        echo -e "${YELLOW}[SKIP]${NC} Frontend: Dockerfile not found"
        return
    fi

    print_status "Updating frontend Dockerfile..."

    # Check if already has the fix
    if grep -q "CRITICAL FIX: Ensure /app directory" "$dockerfile" 2>/dev/null; then
        print_status "Frontend: Already has permission fixes"
        return
    fi

    # Create backup
    cp "$dockerfile" "${dockerfile}.backup"

    # Add permission fixes for frontend (Next.js specific)
    awk '
    /^USER (nodejs|nextjs)/ {
        if (!printed) {
            print "# CRITICAL FIX: Ensure /app directory is writable for Next.js"
            print "RUN chown -R nodejs:nodejs /app"
            print "RUN chmod -R 755 /app"
            print "RUN chmod -R 775 /app/node_modules 2>/dev/null || true"
            print "RUN chmod -R 775 /app/.next 2>/dev/null || true"
            print ""
            print "# Create directories Next.js needs with proper permissions"
            print "RUN mkdir -p /app/.next && chown -R nodejs:nodejs /app/.next"
            print "RUN mkdir -p /app/.pnpm-store && chown -R nodejs:nodejs /app/.pnpm-store && chmod 775 /app/.pnpm-store"
            print ""
            printed = 1
        }
    }
    {print}
    ' "$dockerfile" > "${dockerfile}.tmp"

    # Move the updated file back
    mv "${dockerfile}.tmp" "$dockerfile"

    print_success "Frontend: Dockerfile updated with permission fixes"
}

# Process all backend services
for service in "${BACKEND_SERVICES[@]}"; do
    update_dockerfile "$service"
done

# Process frontend
update_frontend_dockerfile

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}                    SUMMARY${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
print_success "All Dockerfiles have been updated with permission fixes!"
echo ""
echo "Changes made to each Dockerfile:"
echo "  ✅ Added proper ownership (chown -R nodejs:nodejs /app)"
echo "  ✅ Set directory permissions (chmod -R 755 /app)"
echo "  ✅ Set node_modules permissions (chmod -R 775 /app/node_modules)"
echo "  ✅ Created .pnpm-store with correct permissions"
echo "  ✅ Added startup script that ensures dependencies are installed"
echo ""
echo "Backup files created: *.Dockerfile.backup"
echo ""
echo "Next steps:"
echo "  1. Run: bash scripts/fix-all-permissions.sh"
echo "  2. Or integrate into deployment: bash scripts/deploy-production.sh"
echo ""