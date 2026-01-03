#!/bin/bash

# Logistics Aggregator Portal - Database Initialization Script
# Waits for containers, deploys migrations, and runs seeds

set -e

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

echo "🗄️  Starting database initialization..."
echo ""

# Function to wait for a service to be healthy
wait_for_service() {
    local service_name=$1
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be healthy..."

    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps | grep -q "$service_name.*Up.*healthy" || docker-compose ps | grep -q "$service_name.*Up"; then
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
        if docker-compose exec -T postgres pg_isready -U logistics -d logistics_main > /dev/null 2>&1; then
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

# Function to check if migrations exist
check_migrations_exist() {
    local service=$1
    
    # Check if migrations directory has any migration folders (not just migration_lock.toml)
    local migration_count=$(docker-compose exec -T $service sh -c 'ls -1 prisma/migrations/ 2>/dev/null | grep -v "migration_lock.toml" | wc -l' 2>/dev/null || echo "0")
    
    if [ "$migration_count" -gt 0 ]; then
        return 0  # Migrations exist
    else
        return 1  # No migrations
    fi
}

# Function to create initial migration
create_initial_migration() {
    local service=$1
    
    print_status "Creating initial migration for $service..."
    
    if docker-compose exec -T $service npx prisma migrate dev --name init --create-only > /dev/null 2>&1; then
        print_success "✅ Initial migration created for $service"
        return 0
    else
        print_warning "⚠️  Failed to create migration for $service (may not have schema.prisma)"
        return 1
    fi
}

# Function to deploy migrations for a service
deploy_migrations() {
    local service=$1
    local service_name="${service//-/_}" # Convert hyphens to underscores for display

    print_status "Deploying migrations for $service..."

    if docker-compose ps | grep -q "$service.*Up"; then
        # Check if migrations exist, if not create them
        if ! check_migrations_exist "$service"; then
            print_warning "⚠️  No migrations found for $service, creating initial migration..."
            if ! create_initial_migration "$service"; then
                return 1
            fi
        fi
        
        # Deploy migrations
        if docker-compose exec -T $service npx prisma migrate deploy > /dev/null 2>&1; then
            print_success "✅ Migrations deployed for $service"
            return 0
        else
            print_warning "⚠️  Migration deployment failed for $service"
            return 1
        fi
    else
        print_warning "⚠️  $service is not running, skipping migrations"
        return 1
    fi
}

# Function to run seeds for a service
run_seeds() {
    local service=$1

    print_status "Running seeds for $service..."

    if docker-compose ps | grep -q "$service.*Up"; then
        # Try pnpm run db:seed first, then fallback to direct seed script execution
        if docker-compose exec -T $service pnpm run db:seed > /dev/null 2>&1; then
            print_success "✅ Seeds executed for $service"
            return 0
        elif docker-compose exec -T $service sh -c 'test -f prisma/seed.js && node prisma/seed.js' > /dev/null 2>&1; then
            print_success "✅ Seeds executed for $service (direct execution)"
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
for service in "${SERVICES_WITH_PRISMA[@]}"; do
    if deploy_migrations "$service"; then
        migration_count=$((migration_count + 1))
    fi
done

echo ""
print_success "✅ Deployed migrations for $migration_count services"
echo ""

# Step 3: Run seeds (optional - only for services that need seed data)
print_status "Step 3: Running seed data..."
echo ""

seed_count=0
for service in "${SERVICES_WITH_PRISMA[@]}"; do
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
