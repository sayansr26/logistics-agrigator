#!/bin/bash

# ============================================================================
# Logistics Aggregator Portal - Production Deployment Script
# ============================================================================
# This script handles automatic deployment to production server
# Called by GitLab CI/CD pipeline on master branch push
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_step() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC} $1"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_DIR="/var/www/sub-solution"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_TAG="backup_$TIMESTAMP"
LOG_FILE="$PROJECT_DIR/logs/deployment_$TIMESTAMP.log"
ENV_FILE="$PROJECT_DIR/.env"

# Create necessary directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$PROJECT_DIR/logs"

# Redirect all output to log file while still showing on console
exec > >(tee -a "$LOG_FILE")
exec 2>&1

log_step "🚀 STARTING PRODUCTION DEPLOYMENT"
log_info "Timestamp: $TIMESTAMP"
log_info "Project Directory: $PROJECT_DIR"
log_info "Backup Directory: $BACKUP_DIR"
log_info "Log File: $LOG_FILE"

# ============================================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================================

log_step "🔍 PRE-DEPLOYMENT CHECKS"

# Check if running as appropriate user
if [ "$EUID" -eq 0 ]; then
    log_warning "Running as root. Consider using a dedicated deployment user."
fi

# Check if required commands exist
for cmd in docker docker-compose pnpm git; do
    if ! command -v $cmd &> /dev/null; then
        log_error "$cmd is not installed"
        exit 1
    else
        log_success "$cmd is available"
    fi
done

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    log_error "Project directory does not exist: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1
log_success "Changed to project directory"

# Check if git repository
if [ ! -d ".git" ]; then
    log_error "Not a git repository"
    exit 1
fi

log_success "Pre-deployment checks passed"

# ============================================================================
# BACKUP CURRENT STATE
# ============================================================================

log_step "💾 CREATING BACKUP"

# Run backup script
if [ -f "./scripts/backup-database.sh" ]; then
    log_info "Running database backup..."
    bash ./scripts/backup-database.sh
    log_success "Database backup completed"
else
    log_warning "Database backup script not found, skipping..."
fi

# Create git tag for current state (for easy rollback)
log_info "Creating git tag for current deployment..."
git tag -f "$BACKUP_TAG" HEAD 2>/dev/null || true
log_success "Created git tag: $BACKUP_TAG"

# ============================================================================
# PULL LATEST CODE
# ============================================================================

log_step "📥 PULLING LATEST CODE"

# Ensure we're on master branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "master" ]; then
    log_warning "Not on master branch, switching..."
    git checkout master
fi

# Get current commit before pull
OLD_COMMIT=$(git rev-parse HEAD)
log_info "Current commit: $OLD_COMMIT"

# Pull latest code
log_info "Pulling latest changes from origin/master..."
git pull origin master

NEW_COMMIT=$(git rev-parse HEAD)
log_info "New commit: $NEW_COMMIT"

if [ "$OLD_COMMIT" == "$NEW_COMMIT" ]; then
    log_info "No new commits, deployment may not be necessary"
else
    log_success "Updated to latest commit"

    # Show changes
    log_info "Changes in this deployment:"
    git log --oneline --graph --decorate --all $OLD_COMMIT..$NEW_COMMIT | head -10
fi

# ============================================================================
# CHECK AND SETUP ENVIRONMENT
# ============================================================================

log_step "🔧 CHECKING ENVIRONMENT SETUP"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    log_warning ".env file not found, running initial setup..."

    # Copy example env if exists
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
        log_info "Created .env from .env.example"
    fi

    # Run setup:dev command
    log_info "Running pnpm setup:dev..."
    pnpm run setup:dev || {
        log_warning "setup:dev failed, continuing with deployment..."
    }
else
    log_success ".env file exists"
fi

# ============================================================================
# INSTALL/UPDATE DEPENDENCIES
# ============================================================================

log_step "📦 UPDATING DEPENDENCIES"

log_info "Installing/updating pnpm dependencies..."
pnpm install --frozen-lockfile --prefer-offline

log_success "Dependencies updated"

# ============================================================================
# BUILD DOCKER IMAGES
# ============================================================================

log_step "🐳 BUILDING DOCKER IMAGES"

# Determine which docker-compose file to use
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.production.yml" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
    log_info "Using production docker-compose configuration"
else
    log_info "Using standard docker-compose configuration"
fi

log_info "Building Docker images with rebuild (this may take a while)..."
docker-compose -f "$COMPOSE_FILE" build --no-cache --pull

log_success "Docker images built successfully"

# ============================================================================
# RUN DATABASE MIGRATIONS
# ============================================================================

log_step "🗃️  RUNNING DATABASE MIGRATIONS"

log_info "Running Prisma migrations..."

# Run migrations for each service
SERVICES=("auth-service" "user-service" "partner-service" "wallet-service" "shipment-service")

for service in "${SERVICES[@]}"; do
    if [ -d "backend/$service/prisma" ]; then
        log_info "Running migrations for $service..."
        docker-compose -f "$COMPOSE_FILE" exec -T $service pnpm run migrate:deploy || {
            log_warning "Migration failed for $service, but continuing..."
        }
    fi
done

log_success "Migrations completed"

# ============================================================================
# RESTART SERVICES (COMPLETE REBUILD)
# ============================================================================

log_step "🔄 RESTARTING SERVICES"

# Stop all services and remove containers/volumes
log_info "Stopping all services and cleaning up..."
docker-compose -f "$COMPOSE_FILE" down --timeout 30

# Remove dangling images and volumes
log_info "Cleaning up old images and volumes..."
docker image prune -f
docker volume prune -f

# Start all services fresh
log_info "Starting all services from fresh build..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be ready
log_info "Waiting for services to start (45 seconds)..."
sleep 45

log_success "Services restarted with fresh containers"

# ============================================================================
# HEALTH CHECKS
# ============================================================================

log_step "🏥 RUNNING HEALTH CHECKS"

# Run health check script
if [ -f "./scripts/health-check.sh" ]; then
    log_info "Running health checks..."
    bash ./scripts/health-check.sh || {
        log_error "Health checks failed!"

        # Ask if should rollback
        log_warning "Deployment verification failed. Initiating automatic rollback..."

        # Run rollback
        if [ -f "./scripts/rollback.sh" ]; then
            bash ./scripts/rollback.sh
        fi

        exit 1
    }
    log_success "All health checks passed"
else
    log_warning "Health check script not found"

    # Basic health check
    log_info "Running basic health check..."
    sleep 10

    # Check if containers are running
    RUNNING_CONTAINERS=$(docker-compose -f "$COMPOSE_FILE" ps --services --filter "status=running" | wc -l)
    TOTAL_CONTAINERS=$(docker-compose -f "$COMPOSE_FILE" ps --services | wc -l)

    log_info "Running containers: $RUNNING_CONTAINERS/$TOTAL_CONTAINERS"

    if [ "$RUNNING_CONTAINERS" -lt "$TOTAL_CONTAINERS" ]; then
        log_error "Some containers are not running!"
        docker-compose -f "$COMPOSE_FILE" ps
        exit 1
    fi

    log_success "Basic health check passed"
fi

# ============================================================================
# CLEANUP
# ============================================================================

log_step "🧹 CLEANUP"

# Remove old Docker images
log_info "Cleaning up old Docker images..."
docker image prune -f --filter "dangling=true"

# Remove old backups (keep last 10)
log_info "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t | tail -n +11 | xargs -r rm --
cd "$PROJECT_DIR"

log_success "Cleanup completed"

# ============================================================================
# DEPLOYMENT SUMMARY
# ============================================================================

log_step "✅ DEPLOYMENT COMPLETED SUCCESSFULLY"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                    DEPLOYMENT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🕐 Timestamp:          $TIMESTAMP"
echo "📝 Git Commit:         $NEW_COMMIT"
echo "🏷️  Backup Tag:         $BACKUP_TAG"
echo "📁 Backup Location:    $BACKUP_DIR"
echo "📋 Log File:           $LOG_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show running services
echo "🐳 Running Services:"
docker-compose -f "$COMPOSE_FILE" ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
echo ""

log_success "Deployment completed at $(date '+%Y-%m-%d %H:%M:%S')"
log_info "For rollback, run: ./scripts/rollback.sh"
log_info "For health check, run: ./scripts/health-check.sh"
log_info "View logs: tail -f $LOG_FILE"

# ============================================================================
# OPTIONAL: SEND NOTIFICATIONS
# ============================================================================

# Uncomment and configure for Slack notifications
# if [ -n "$SLACK_WEBHOOK" ]; then
#     curl -X POST -H 'Content-type: application/json' \
#         --data "{\"text\":\"✅ Deployment completed successfully\nCommit: $NEW_COMMIT\nTimestamp: $TIMESTAMP\"}" \
#         $SLACK_WEBHOOK
# fi

exit 0
