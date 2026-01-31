#!/bin/bash
###############################################################################
# MIGRATION DIAGNOSTIC SCRIPT
# Diagnoses migration issues for production services
# Usage: ./scripts/diagnose-migrations.sh [service-name]
# Example: ./scripts/diagnose-migrations.sh partner-service
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Get service name from argument or detect
SERVICE_NAME="${1:-}"
COMPOSE_FILE="${2:-docker-compose.production.yml}"

if [ -z "$SERVICE_NAME" ]; then
    echo "Usage: $0 <service-name> [compose-file]"
    echo "Example: $0 partner-service"
    echo "Example: $0 auth-service docker-compose.yml"
    exit 1
fi

print_header "MIGRATION DIAGNOSTIC TOOL - $SERVICE_NAME"

# Detect compose file
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Compose file not found: $COMPOSE_FILE"
    exit 1
fi

print_info "Using compose file: $COMPOSE_FILE"

# Step 1: Check if service is running
print_section "Step 1: Checking Service Status"

if docker-compose -f "$COMPOSE_FILE" ps | grep -q "${SERVICE_NAME}.*Up"; then
    print_success "$SERVICE_NAME is running"
else
    print_error "$SERVICE_NAME is not running!"
    print_info "Start it with: docker-compose -f $COMPOSE_FILE up -d $SERVICE_NAME"
    exit 1
fi

# Step 2: Find Prisma schema location
print_section "Step 2: Finding Prisma Schema"

PRISMA_SCHEMA=$(docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" sh -c '
    for location in \
        /app/prisma/schema.prisma \
        /app/backend/"$SERVICE_NAME"/prisma/schema.prisma \
        ./prisma/schema.prisma
    do
        if [ -f "$location" ]; then
            echo "$location"
            exit 0
        fi
    done
    exit 1
' 2>/dev/null || echo "")

if [ -n "$PRISMA_SCHEMA" ]; then
    print_success "Found schema at: $PRISMA_SCHEMA"
    PRISMA_DIR=$(dirname "$PRISMA_SCHEMA")
else
    print_error "Prisma schema not found in container"
    exit 1
fi

# Step 3: Check migrations folder
print_section "Step 3: Checking Migrations Folder"

MIGRATIONS_INFO=$(docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" sh -c "
    if [ -d \"$PRISMA_DIR/migrations\" ]; then
        echo \"EXISTS\"
        ls -1 \"$PRISMA_DIR/migrations\" 2>/dev/null | grep -v 'migration_lock.toml' | wc -l
    else
        echo \"NOT_FOUND\"
    fi
" 2>/dev/null || echo "NOT_FOUND")

MIGRATION_STATUS=$(echo "$MIGRATIONS_INFO" | head -1)
MIGRATION_COUNT=$(echo "$MIGRATIONS_INFO" | tail -1 | tr -d ' ')

if [ "$MIGRATION_STATUS" = "EXISTS" ]; then
    print_success "Migrations folder exists"
    print_info "Migration folders found: $MIGRATION_COUNT"

    # List migrations
    echo ""
    echo -e "${CYAN}Migrations found:${NC}"
    docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" sh -c "ls -1 \"$PRISMA_DIR/migrations\" 2>/dev/null | grep -v 'migration_lock.toml' | head -20" 2>/dev/null || echo "  None"
else
    print_error "Migrations folder not found at: $PRISMA_DIR/migrations"
fi

# Step 4: Check _prisma_migrations table
print_section "Step 4: Checking Migration History"

# Get database URL from environment (we need to extract it)
DB_INFO=$(docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" sh -c 'echo $DATABASE_URL' 2>/dev/null || echo "")

if [ -n "$DB_INFO" ]; then
    # Extract database name from URL
    DB_NAME=$(echo "$DB_INFO" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    print_info "Database: $DB_NAME"

    # Check if _prisma_migrations table exists
    MIGRATION_TABLE_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = '_prisma_migrations');" 2>/dev/null || echo "0")

    if [ "$MIGRATION_TABLE_EXISTS" = "t" ]; then
        print_success "_prisma_migrations table exists"

        echo ""
        echo -e "${CYAN}Applied migrations:${NC}"
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d "$DB_NAME" -c "SELECT migration_name, substr(finished_at, 1, 19) as applied_at FROM _prisma_migrations ORDER BY started_at;" 2>/dev/null || print_error "Could not query migrations table"
    else
        print_warning "_prisma_migrations table does not exist"
        print_info "This suggests the database was initialized with db push instead of migrations"
    fi
else
    print_warning "Could not determine database name"
fi

# Step 5: Check specific tables
print_section "Step 5: Checking Feature Tables"

# Tables to check for partner-service
TABLES_TO_CHECK=""
if [ "$SERVICE_NAME" = "partner-service" ]; then
    TABLES_TO_CHECK="charges_types pincode_types"
fi

if [ -n "$TABLES_TO_CHECK" ]; then
    for table in $TABLES_TO_CHECK; do
        TABLE_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = '$table');" 2>/dev/null || echo "0")

        if [ "$TABLE_EXISTS" = "t" ]; then
            ROW_COUNT=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "?")
            print_success "Table '$table' exists ($ROW_COUNT rows)"
        else
            print_error "Table '$table' does NOT exist"
        fi
    done
else
    print_info "No specific tables to check for $SERVICE_NAME"
fi

# Step 6: Check migration lock file
print_section "Step 6: Checking Migration Lock"

MIGRATION_LOCK=$(docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" cat "$PRISMA_DIR/migrations/migration_lock.toml" 2>/dev/null || echo "")

if [ -n "$MIGRATION_LOCK" ]; then
    print_success "Migration lock file found"
    echo ""
    echo -e "${CYAN}Lock file content:${NC}"
    echo "$MIGRATION_LOCK"
else
    print_warning "Migration lock file not found or empty"
fi

# Step 7: Recommendations
print_section "Step 7: Recommendations"

# Determine issues and provide recommendations
if [ "$MIGRATION_STATUS" != "EXISTS" ]; then
    print_warning "No migrations folder - ensure migrations are included in Docker build"
    echo "   → Check Dockerfile.prod includes: COPY backend/$SERVICE_NAME ./backend/$SERVICE_NAME"
fi

if [ "$MIGRATION_TABLE_EXISTS" != "t" ]; then
    print_warning "No migration history - database may have been initialized with db push"
    echo "   → To fix: ./scripts/fix-partner-migrations.sh"
fi

if [ "$MIGRATION_STATUS" = "EXISTS" ] && [ "$MIGRATION_TABLE_EXISTS" = "t" ]; then
    APPLIED_COUNT=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM _prisma_migrations;" 2>/dev/null || echo "0")

    if [ "$MIGRATION_COUNT" != "$APPLIED_COUNT" ]; then
        print_warning "Migration count mismatch!"
        print_info "  Migrations in folder: $MIGRATION_COUNT"
        print_info "  Migrations applied: $APPLIED_COUNT"
        echo "   → Some migrations were not applied. To fix: ./scripts/fix-partner-migrations.sh"
    fi
fi

# Check for specific missing tables
if [ "$SERVICE_NAME" = "partner-service" ]; then
    if [ -n "$DB_NAME" ]; then
        CHARGES_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'charges_types');" 2>/dev/null || echo "0")
        PINCODE_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'pincode_types');" 2>/dev/null || echo "0")

        if [ "$CHARGES_EXISTS" != "t" ] || [ "$PINCODE_EXISTS" != "t" ]; then
            print_error "Feature tables missing - migrations were not applied correctly"
            echo "   → Run: ./scripts/fix-partner-migrations.sh"
        fi
    fi
fi

print_header "DIAGNOSTIC COMPLETE"
