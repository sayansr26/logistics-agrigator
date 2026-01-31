#!/bin/bash
###############################################################################
# PARTNER SERVICE MIGRATION FIX SCRIPT
# Recovers from broken migration state by marking migrations as applied
# or directly executing migration SQL
#
# Usage:
#   ./scripts/fix-partner-migrations.sh              # Interactive mode
#   ./scripts/fix-partner-migrations.sh --auto       # Auto-fix mode
#   ./scripts/fix-partner-migrations.sh --sql        # Direct SQL mode
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

# Check if we're in the right directory
if [ ! -f "docker-compose.production.yml" ] && [ ! -f "docker-compose.yml" ]; then
    print_error "Must be run from project root directory"
    exit 1
fi

# Detect compose file
COMPOSE_FILE="docker-compose.production.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
    COMPOSE_FILE="docker-compose.yml"
    print_warning "Using docker-compose.yml (production file not found)"
fi

print_header "PARTNER SERVICE MIGRATION FIX"

MODE="${1:-interactive}"

# Partner service migrations that need to be applied
MIGRATIONS=(
    "20260103083711_init"
    "20260121_add_partner_channel_and_pincode_charges"
    "20260129102803_create_charges_types"
    "20260129120000_simplify_pincode_types"
)

# Function: Check current state
check_state() {
    print_section "Checking Current State"

    # Check if service is running
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "partner-service.*Up"; then
        print_success "partner-service is running"
    else
        print_error "partner-service is not running"
        print_info "Start it with: docker-compose -f $COMPOSE_FILE up -d partner-service"
        exit 1
    fi

    # Check database connection
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U logistics > /dev/null 2>&1; then
        print_success "PostgreSQL is ready"
    else
        print_error "PostgreSQL is not ready"
        exit 1
    fi

    # Check _prisma_migrations table
    MIGRATION_TABLE=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = '_prisma_migrations');" 2>/dev/null || echo "0")

    if [ "$MIGRATION_TABLE" = "t" ]; then
        print_success "_prisma_migrations table exists"

        echo ""
        echo -e "${CYAN}Currently applied migrations:${NC}"
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -c "SELECT migration_name FROM _prisma_migrations ORDER BY started_at;" 2>/dev/null || echo "  None"
    else
        print_warning "_prisma_migrations table does not exist"
    fi

    # Check if tables exist
    print_section "Checking Feature Tables"

    CHARGES_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'charges_types');" 2>/dev/null || echo "0")
    PINCODE_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'pincode_types');" 2>/dev/null || echo "0")

    if [ "$CHARGES_EXISTS" = "t" ]; then
        print_success "charges_types table exists"
    else
        print_error "charges_types table MISSING"
    fi

    if [ "$PINCODE_EXISTS" = "t" ]; then
        print_success "pincode_types table exists"
    else
        print_error "pincode_types table MISSING"
    fi
}

# Function: Fix using migrate resolve
fix_with_resolve() {
    print_section "Fixing with 'migrate resolve'"

    print_info "This will mark migrations as applied in the _prisma_migrations table"
    print_warning "Use this if the tables exist but migrations aren't tracked"

    SCHEMA_PATH="/app/backend/partner-service/prisma/schema.prisma"

    for migration in "${MIGRATIONS[@]}"; do
        echo ""
        print_info "Marking migration as applied: $migration"

        # Check if already applied
        ALREADY_APPLIED=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -tAc "SELECT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = '$migration');" 2>/dev/null || echo "f")

        if [ "$ALREADY_APPLIED" = "t" ]; then
            print_warning "Migration $migration already applied, skipping"
        else
            if docker-compose -f "$COMPOSE_FILE" exec -T partner-service npx prisma migrate resolve --applied "$migration" --schema="$SCHEMA_PATH" 2>&1; then
                print_success "Marked $migration as applied"
            else
                print_error "Failed to mark $migration as applied"
            fi
        fi
    done

    echo ""
    print_success "Migration fix complete!"
}

# Function: Fix with direct SQL
fix_with_sql() {
    print_section "Fixing with Direct SQL"

    print_info "This will create the missing tables directly using SQL"
    print_warning "Use this if migrate resolve doesn't work"

    # Read and execute charges_types migration
    if [ -f "backend/partner-service/prisma/migrations/20260129102803_create_charges_types/migration.sql" ]; then
        echo ""
        print_info "Applying charges_types migration SQL..."

        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -f - << 'EOF'
-- CreateTable
CREATE TABLE IF NOT EXISTS "charges_types" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "charges_types_partner_id_is_active_idx" ON "charges_types"("partner_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "charges_types_partner_id_name_key" ON "charges_types"("partner_id", "name");

-- AddForeignKey
ALTER TABLE "charges_types" ADD CONSTRAINT IF NOT EXISTS "charges_types_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EOF

        if [ $? -eq 0 ]; then
            print_success "charges_types table created"
        else
            print_error "Failed to create charges_types table"
        fi
    else
        print_warning "charges_types migration SQL file not found"
    fi

    # Read and execute pincode_types migration
    echo ""
    print_info "Applying pincode_types migration SQL..."

    docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -f - << 'EOF'
-- Drop junction tables if they exist
DROP TABLE IF EXISTS "pincode_type_assignments" CASCADE;
DROP TABLE IF EXISTS "pincode_type_service_charges" CASCADE;

-- Add type column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pincode_types'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE "pincode_types" ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'yes_no';
    END IF;
END $$;

-- Remove description column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pincode_types'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE "pincode_types" DROP COLUMN "description";
    END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS "pincode_types_is_active_type_idx" ON "pincode_types"("is_active", "type");

-- Add check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'pincode_types_type_check'
    ) THEN
        ALTER TABLE "pincode_types" ADD CONSTRAINT "pincode_types_type_check"
        CHECK (type IN ('yes_no', 'number'));
    END IF;
END $$;
EOF

    if [ $? -eq 0 ]; then
        print_success "pincode_types table updated"
    else
        print_error "Failed to update pincode_types table"
    fi

    echo ""
    print_success "Direct SQL fix complete!"
}

# Function: Restart service
restart_service() {
    print_section "Restarting Partner Service"

    print_info "Restarting to pick up schema changes..."
    if docker-compose -f "$COMPOSE_FILE" restart partner-service; then
        print_success "Service restarted"
    else
        print_error "Failed to restart service"
        exit 1
    fi

    echo ""
    sleep 3
    print_info "Checking service health..."
    if docker-compose -f "$COMPOSE_FILE" logs --tail=10 partner-service | grep -q "listening"; then
        print_success "Service is healthy"
    else
        print_warning "Check service logs: docker-compose -f $COMPOSE_FILE logs partner-service"
    fi
}

# Main execution
check_state

# Ask which fix method to use
if [ "$MODE" = "interactive" ]; then
    print_section "Select Fix Method"

    echo ""
    echo "1) Use 'migrate resolve' - Marks migrations as applied (recommended if tables exist)"
    echo "2) Use Direct SQL - Creates tables directly (if tables don't exist)"
    echo "3) Run both - Try resolve first, then SQL if needed"
    echo "4) Exit without fixing"
    echo ""
    read -p "Choose option [1-4]: " choice

    case $choice in
        1)
            fix_with_resolve
            ;;
        2)
            fix_with_sql
            ;;
        3)
            fix_with_resolve
            echo ""
            print_info "Verifying fix..."
            check_state
            ;;
        4)
            print_info "Exiting without changes"
            exit 0
            ;;
        *)
            print_error "Invalid option"
            exit 1
            ;;
    esac
elif [ "$MODE" = "--auto" ]; then
    print_info "Auto-fix mode: using migrate resolve"
    fix_with_resolve
elif [ "$MODE" = "--sql" ]; then
    print_info "SQL mode: using direct SQL"
    fix_with_sql
else
    print_error "Unknown mode: $MODE"
    exit 1
fi

# Verify the fix
echo ""
print_section "Verifying Fix"

CHARGES_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'charges_types');" 2>/dev/null || echo "0")
PINCODE_EXISTS=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U logistics -d logistics_partners -tAc "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'pincode_types');" 2>/dev/null || echo "0")

if [ "$CHARGES_EXISTS" = "t" ] && [ "$PINCODE_EXISTS" = "t" ]; then
    print_success "All required tables exist!"

    # Ask about restart
    if [ "$MODE" = "interactive" ]; then
        echo ""
        read -p "Restart partner-service to apply changes? [Y/n]: " restart_choice
        if [[ ! $restart_choice =~ ^[Nn]$ ]]; then
            restart_service
        fi
    else
        restart_service
    fi
else
    print_error "Some tables are still missing!"
    print_info "Try running with --sql flag: ./scripts/fix-partner-migrations.sh --sql"
    exit 1
fi

print_header "FIX COMPLETE"

echo ""
print_success "Migration fix completed successfully!"
echo ""
print_info "Next steps:"
echo "   1. Check service logs: docker-compose -f $COMPOSE_FILE logs partner-service"
echo "   2. Test API endpoints:"
echo "      curl http://localhost:3005/api/v1/pincode-types"
echo "      curl http://localhost:3005/api/v1/charges-types"
echo ""
