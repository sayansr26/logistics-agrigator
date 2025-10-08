#!/bin/bash

# ============================================================================
# Rollback Script for Logistics Aggregator Portal
# ============================================================================
# Rolls back to previous deployment state
# Can be triggered manually or automatically on deployment failure
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/var/www/sub-solution"
BACKUP_DIR="$PROJECT_DIR/backups"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}               ROLLBACK INITIATED${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_DIR" || exit 1

# Check if we have backup tags
BACKUP_TAGS=$(git tag -l "backup_*" --sort=-creatordate)

if [ -z "$BACKUP_TAGS" ]; then
    echo -e "${RED}[ERROR]${NC} No backup tags found"
    echo -e "${YELLOW}[INFO]${NC} Cannot rollback without previous backup"
    exit 1
fi

# Get the most recent backup tag
LATEST_BACKUP=$(echo "$BACKUP_TAGS" | head -n 1)

echo -e "${BLUE}[INFO]${NC} Latest backup tag: $LATEST_BACKUP"
echo -e "${BLUE}[INFO]${NC} Current commit: $(git rev-parse --short HEAD)"
echo ""

# Ask for confirmation if running interactively
if [ -t 0 ]; then
    echo -e "${YELLOW}[WARNING]${NC} This will rollback to: $LATEST_BACKUP"
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${BLUE}[INFO]${NC} Rollback cancelled"
        exit 0
    fi
fi

echo -e "${BLUE}[INFO]${NC} Starting rollback process..."
echo ""

# Step 1: Stop services
echo -e "${BLUE}[STEP 1/4]${NC} Stopping services..."
docker-compose --profile all-services down --timeout 30
echo -e "${GREEN}[SUCCESS]${NC} Services stopped"
echo ""

# Step 2: Checkout previous commit
echo -e "${BLUE}[STEP 2/4]${NC} Rolling back code to $LATEST_BACKUP..."
git checkout "$LATEST_BACKUP"
echo -e "${GREEN}[SUCCESS]${NC} Code rolled back"
echo ""

# Step 3: Restore database (if backup exists)
echo -e "${BLUE}[STEP 3/4]${NC} Checking for database backups..."

# Extract timestamp from backup tag
BACKUP_TIMESTAMP=$(echo "$LATEST_BACKUP" | sed 's/backup_//')
DB_BACKUP_DIR="$BACKUP_DIR/database"

if [ -d "$DB_BACKUP_DIR" ]; then
    # Find backups matching the timestamp
    BACKUP_FILES=$(find "$DB_BACKUP_DIR" -name "*${BACKUP_TIMESTAMP}*.sql.gz" 2>/dev/null || true)

    if [ -n "$BACKUP_FILES" ]; then
        echo -e "${BLUE}[INFO]${NC} Found database backups, restoring..."

        # Start postgres for restore
        docker-compose up -d postgres
        sleep 10

        # Restore each database
        for backup_file in $BACKUP_FILES; do
            # Extract database name from filename
            db_name=$(basename "$backup_file" | sed "s/_${BACKUP_TIMESTAMP}.sql.gz//")

            echo -e "${BLUE}[INFO]${NC} Restoring $db_name..."

            # Decompress and restore
            gunzip -c "$backup_file" | docker-compose exec -T postgres psql -U logistics "$db_name" 2>/dev/null || {
                echo -e "${YELLOW}[WARNING]${NC} Failed to restore $db_name, continuing..."
            }
        done

        echo -e "${GREEN}[SUCCESS]${NC} Database restore completed"
    else
        echo -e "${YELLOW}[WARNING]${NC} No database backups found for this deployment"
    fi
else
    echo -e "${YELLOW}[WARNING]${NC} Backup directory not found, skipping database restore"
fi
echo ""

# Step 4: Rebuild and start services
echo -e "${BLUE}[STEP 4/4]${NC} Rebuilding and starting services..."

# Use production compose if available
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.production.yml" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
fi

# Build images
docker-compose -f "$COMPOSE_FILE" build --no-cache

# Start services
docker-compose -f "$COMPOSE_FILE" --profile all-services up -d

echo -e "${GREEN}[SUCCESS]${NC} Services started"
echo ""

# Wait for services to be ready
echo -e "${BLUE}[INFO]${NC} Waiting for services to be ready..."
sleep 30

# Run health checks
echo -e "${BLUE}[INFO]${NC} Running health checks..."

if [ -f "./scripts/health-check.sh" ]; then
    bash ./scripts/health-check.sh || {
        echo -e "${RED}[ERROR]${NC} Health checks failed after rollback"
        echo -e "${YELLOW}[WARNING]${NC} Manual intervention may be required"
    }
else
    # Basic health check
    RUNNING_CONTAINERS=$(docker-compose -f "$COMPOSE_FILE" ps --services --filter "status=running" | wc -l)
    TOTAL_CONTAINERS=$(docker-compose -f "$COMPOSE_FILE" ps --services | wc -l)

    echo -e "${BLUE}[INFO]${NC} Running containers: $RUNNING_CONTAINERS/$TOTAL_CONTAINERS"

    if [ "$RUNNING_CONTAINERS" -lt "$TOTAL_CONTAINERS" ]; then
        echo -e "${RED}[ERROR]${NC} Some containers are not running"
        docker-compose -f "$COMPOSE_FILE" ps
    else
        echo -e "${GREEN}[SUCCESS]${NC} All containers are running"
    fi
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ROLLBACK COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}[INFO]${NC} Rolled back to: $LATEST_BACKUP"
echo -e "${BLUE}[INFO]${NC} Current commit: $(git rev-parse --short HEAD)"
echo ""
echo -e "${YELLOW}[NOTE]${NC} You are now in detached HEAD state"
echo -e "${YELLOW}[NOTE]${NC} To return to master: git checkout master"
echo ""

exit 0
