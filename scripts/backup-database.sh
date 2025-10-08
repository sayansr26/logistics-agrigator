#!/bin/bash

# ============================================================================
# Database Backup Script for Logistics Aggregator Portal
# ============================================================================
# Creates backups of all PostgreSQL databases
# Can be run manually or called by deployment script
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/var/www/sub-solution"
BACKUP_DIR="$PROJECT_DIR/backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
POSTGRES_USER="${POSTGRES_USER:-logistics}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-logistics123}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# Databases to backup
DATABASES=(
    "logistics_main"
    "logistics_auth"
    "logistics_users"
    "logistics_partners"
    "logistics_wallet"
    "logistics_shipments"
    "logistics_support"
    "logistics_platforms"
)

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}          DATABASE BACKUP - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Export password for pg_dump
export PGPASSWORD="$POSTGRES_PASSWORD"

# Backup each database
BACKUP_COUNT=0
FAILED_COUNT=0

for db in "${DATABASES[@]}"; do
    echo -e "${BLUE}[INFO]${NC} Backing up database: $db"

    BACKUP_FILE="$BACKUP_DIR/${db}_${TIMESTAMP}.sql"

    # Check if database exists
    if docker-compose exec -T postgres psql -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -qw "$db"; then
        # Create backup
        if docker-compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$db" > "$BACKUP_FILE" 2>/dev/null; then
            # Compress backup
            gzip "$BACKUP_FILE"

            # Get file size
            SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)

            echo -e "${GREEN}[SUCCESS]${NC} Backed up $db (${SIZE})"
            ((BACKUP_COUNT++))
        else
            echo -e "${RED}[ERROR]${NC} Failed to backup $db"
            ((FAILED_COUNT++))
        fi
    else
        echo -e "${YELLOW}[WARNING]${NC} Database $db does not exist, skipping..."
    fi
done

# Unset password
unset PGPASSWORD

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}[SUMMARY]${NC} Backed up $BACKUP_COUNT databases"
if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "${RED}[WARNING]${NC} $FAILED_COUNT databases failed"
fi
echo -e "${BLUE}[LOCATION]${NC} $BACKUP_DIR"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Cleanup old backups (keep last 10 days)
echo ""
echo -e "${BLUE}[INFO]${NC} Cleaning up old backups (keeping last 10 days)..."
find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +10 -delete
echo -e "${GREEN}[SUCCESS]${NC} Cleanup completed"

# Create backup metadata
cat > "$BACKUP_DIR/backup_${TIMESTAMP}.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date '+%Y-%m-%d %H:%M:%S')",
  "databases_backed_up": $BACKUP_COUNT,
  "databases_failed": $FAILED_COUNT,
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
}
EOF

echo -e "${GREEN}[SUCCESS]${NC} Backup completed successfully"

exit 0
