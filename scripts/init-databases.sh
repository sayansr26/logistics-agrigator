#!/bin/bash

# Logistics Aggregator Portal - Database Initialization Script
# Waits for containers, deploys migrations, and runs seeds

set -euo pipefail

# Compose configuration (dev by default, production when NODE_ENV=production)
COMPOSE_FILE_PATH="docker-compose.yml"
ENV_FILE_PATH=".env"

if [ "${NODE_ENV:-}" = "production" ]; then
    COMPOSE_FILE_PATH="docker-compose.production.yml"
    ENV_FILE_PATH=".env.production"
fi

if [ -f "$COMPOSE_FILE_PATH" ]; then
    COMPOSE_CMD=(docker-compose -f "$COMPOSE_FILE_PATH")
else
    COMPOSE_CMD=(docker-compose)
fi

if [ -f "$ENV_FILE_PATH" ]; then
    COMPOSE_CMD+=(--env-file "$ENV_FILE_PATH")
fi

# Colors for output
RED='\033[0;31m'
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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

dc() {
    "${COMPOSE_CMD[@]}" "$@"
}

echo "🗄️  Starting database initialization..."
print_status "Using compose file: $COMPOSE_FILE_PATH"
if [ -f "$ENV_FILE_PATH" ]; then
    print_status "Using env file: $ENV_FILE_PATH"
fi
echo ""

# Function to wait for a service to be healthy
wait_for_service() {
    local service_name=$1
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be healthy..."

    while [ $attempt -le $max_attempts ]; do
        # Prefer direct exec probe over parsing docker-compose ps output.
        # If exec works, the container is running and reachable.
        if dc exec -T "$service_name" sh -c 'exit 0' > /dev/null 2>&1; then
            print_success "✅ $service_name is ready"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    print_error "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    print_status "Waiting for PostgreSQL to be ready..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if dc exec -T postgres sh -lc 'pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' > /dev/null 2>&1; then
            print_success "✅ PostgreSQL is ready"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    print_error "❌ PostgreSQL failed to be ready after $max_attempts attempts"
    return 1
}

# Function to deploy migrations for a service
find_schema_path() {
    local service=$1
    # Try dev layout first (WORKDIR=/app, schema copied directly: prisma/schema.prisma)
    # then production layout (WORKDIR=/app, service in subdirectory: backend/<service>/prisma/schema.prisma)
    for candidate in "prisma/schema.prisma" "backend/${service}/prisma/schema.prisma"; do
        if dc exec -T "$service" sh -c "test -f $candidate" 2>/dev/null; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

deploy_migrations() {
    local service=$1

    print_status "Deploying migrations for $service..."

    # db:init must never silently skip a service.
    # Wait for each service explicitly and fail if unavailable.
    wait_for_service "$service" || return 1

    # Detect schema path (works for both dev and production container layouts)
    local schema_path
    schema_path=$(find_schema_path "$service") || {
        print_error "❌ prisma/schema.prisma not found in $service"
        return 1
    }

    local migrations_dir="${schema_path%/schema.prisma}/migrations"
    if ! dc exec -T "$service" sh -c "test -d $migrations_dir" 2>/dev/null; then
        print_error "❌ prisma/migrations directory not found in $service"
        return 1
    fi

    # Helper: baseline all migrations in the migrations_dir as applied
    baseline_all() {
        local migration_names
        # Match any folder starting with digits (handles both YYYYMMDDHHMMSS and YYYYMMDD prefixes)
        migration_names=$(dc exec -T "$service" sh -c "ls '$migrations_dir'" 2>/dev/null | grep -E '^[0-9]')

        if [ -z "$migration_names" ]; then
            print_error "❌ No migrations found to baseline for $service"
            return 1
        fi

        for migration in $migration_names; do
            if dc exec -T "$service" npx prisma migrate resolve --applied "$migration" --schema="$schema_path" > /dev/null 2>&1; then
                print_status "  Baselined: $migration"
            else
                print_warning "  ⚠️  Could not baseline $migration (may already be recorded)"
            fi
        done
        return 0
    }

    # Deploy committed migrations only (never generate new migrations in init script).
    local migrate_output migrate_exit
    migrate_output=$(dc exec -T "$service" npx prisma migrate deploy --schema="$schema_path" 2>&1)
    migrate_exit=$?

    if [ $migrate_exit -eq 0 ]; then
        print_success "✅ Migrations deployed for $service"
        return 0
    fi

    # P3005: DB has tables but no _prisma_migrations history (created via db push / first deploy).
    # Baseline all migrations then re-deploy.
    if echo "$migrate_output" | grep -q "P3005"; then
        print_warning "⚠️  $service: database has schema but no migration history. Baselining..."
        baseline_all || { echo "$migrate_output" | tail -10; return 1; }

        migrate_output=$(dc exec -T "$service" npx prisma migrate deploy --schema="$schema_path" 2>&1)
        migrate_exit=$?
        if [ $migrate_exit -eq 0 ]; then
            print_success "✅ Migrations deployed for $service (baselined)"
            return 0
        fi
    fi

    # P3018: a previous migration is in failed state (e.g. schema already exists from db push).
    # Resolve it as applied, then re-deploy.
    if echo "$migrate_output" | grep -q "P3018"; then
        local failed_migration
        failed_migration=$(echo "$migrate_output" | grep "Migration name:" | awk '{print $NF}' | tr -d '[:space:]')
        if [ -n "$failed_migration" ]; then
            print_warning "⚠️  $service: migration '$failed_migration' in failed state (schema already applied). Resolving..."
            if dc exec -T "$service" npx prisma migrate resolve --applied "$failed_migration" --schema="$schema_path" > /dev/null 2>&1; then
                print_status "  Resolved: $failed_migration"
                migrate_output=$(dc exec -T "$service" npx prisma migrate deploy --schema="$schema_path" 2>&1)
                migrate_exit=$?
                if [ $migrate_exit -eq 0 ]; then
                    print_success "✅ Migrations deployed for $service (P3018 resolved)"
                    return 0
                fi
            else
                print_error "❌ Could not resolve failed migration $failed_migration"
            fi
        fi
    fi

    print_error "❌ Migration deployment failed for $service"
    echo "$migrate_output" | tail -20
    return 1
}

# Function to run seeds for a service
run_seeds() {
    local service=$1

    print_status "Running seeds for $service..."

    if dc exec -T "$service" sh -c 'exit 0' > /dev/null 2>&1; then
        local schema_path
        schema_path=$(find_schema_path "$service") || true
        local seed_dir="${schema_path%/schema.prisma}"

        # Try service-level pnpm db:seed, then direct seed.js execution
        if dc exec -T "$service" sh -c "cd \$(dirname $schema_path) 2>/dev/null && test -f seed.js && node seed.js" > /dev/null 2>&1; then
            print_success "✅ Seeds executed for $service (direct execution)"
            return 0
        elif dc exec -T "$service" pnpm run db:seed > /dev/null 2>&1; then
            print_success "✅ Seeds executed for $service"
            return 0
        else
            print_warning "⚠️  Seed execution failed for $service (service may not have seed file)"
            return 1
        fi
    else
        print_warning "⚠️  $service is not running, skipping seeds"
        return 1
    fi
}

# Wait for core infrastructure
print_status "Step 1: Waiting for infrastructure services..."
wait_for_postgres || exit 1
wait_for_service "redis" || exit 1

echo ""
print_success "✅ Infrastructure is ready"
echo ""

# Define services with Prisma (in order of dependency)
SERVICES_WITH_PRISMA=(
    "auth-service"
    "user-service"
    "wallet-service"
    "partner-service"
    "shipment-service"
    "support-service"
    "platform-service"
    "license-service"
)

# Step 2: Deploy migrations
print_status "Step 2: Deploying migrations..."
echo ""

migration_count=0
failed_migrations=()
migrated_services=()
for service in "${SERVICES_WITH_PRISMA[@]}"; do
    if deploy_migrations "$service"; then
        migration_count=$((migration_count + 1))
        migrated_services+=("$service")
    else
        failed_migrations+=("$service")
    fi
done

echo ""
if [ ${#failed_migrations[@]} -gt 0 ]; then
    print_error "❌ Migration deployment failed for: ${failed_migrations[*]}"
    print_error "db:init aborted to prevent partial migration state."
    exit 1
else
    print_success "✅ Deployed migrations for $migration_count services"
fi

# Step 3: Run seeds (optional - only for services that need seed data)
print_status "Step 3: Running seed data..."
echo ""

seed_count=0
for service in "${migrated_services[@]}"; do
    if run_seeds "$service"; then
        seed_count=$((seed_count + 1))
    fi
done

echo ""
if [ $seed_count -gt 0 ]; then
    print_success "✅ Executed seeds for $seed_count services"
else
    print_warning "⚠️  No seeds were executed (this is normal if services don't have seed files)"
fi

echo ""
echo "🎉 Database initialization completed!"
echo ""
print_status "📋 Summary:"
echo "   - Migrations deployed: $migration_count services"
echo "   - Seeds executed: $seed_count services"
echo ""
print_status "Next steps:"
echo "   - Access frontend at http://localhost:3000"
echo "   - Access API Gateway at http://localhost:3001"
echo "   - View logs with: pnpm run logs"
echo ""
