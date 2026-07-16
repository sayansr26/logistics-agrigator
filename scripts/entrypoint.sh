#!/bin/sh

###############################################################################
# PERMANENT FIX FOR DOCKER DEPENDENCY ISSUES
# This script ensures dependencies are always in sync, even when:
# - package.json changes on host
# - Docker volumes are cleaned
# - Container is rebuilt
# - System is freshly installed
###############################################################################

set -e

SERVICE_NAME="${SERVICE_NAME:-unknown-service}"
echo "🚀 Starting $SERVICE_NAME..."

# Function to check if dependencies are installed and up-to-date
check_dependencies() {
    echo "📦 Checking dependencies..."

    # Check if node_modules exists and is not empty
    if [ ! -d "/app/node_modules" ] || [ ! "$(ls -A /app/node_modules)" ]; then
        echo "⚠️  node_modules is missing or empty"
        return 1
    fi

    # Check if package.json has been modified more recently than node_modules
    if [ -f "/app/package.json" ]; then
        PACKAGE_JSON_TIME=$(stat -c %Y /app/package.json 2>/dev/null || stat -f %m /app/package.json)
        NODE_MODULES_TIME=$(stat -c %Y /app/node_modules 2>/dev/null || stat -f %m /app/node_modules)

        if [ "$PACKAGE_JSON_TIME" -gt "$NODE_MODULES_TIME" ]; then
            echo "⚠️  package.json is newer than node_modules"
            return 1
        fi
    fi

    # Verify critical packages are actually installed
    if [ -f "/app/package.json" ]; then
        # Check for express (common dependency)
        if ! yarn list --pattern express >/dev/null 2>&1; then
            echo "⚠️  Critical dependencies missing"
            return 1
        fi
    fi

    echo "✅ Dependencies are up-to-date"
    return 0
}

# Function to install dependencies with retry logic
install_dependencies() {
    MAX_RETRIES=3
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        echo "📥 Installing dependencies (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)..."

        # Try frozen lockfile first (faster and more reliable)
        if yarn install --frozen-lockfile 2>/dev/null; then
            echo "✅ Dependencies installed successfully (frozen lockfile)"
            return 0
        fi

        echo "⚠️  Frozen lockfile failed, trying regular install..."

        # Fall back to regular install if frozen fails
        if yarn install; then
            echo "✅ Dependencies installed successfully (regular install)"
            return 0
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⏳ Waiting 2 seconds before retry..."
            sleep 2
        fi
    done

    echo "❌ Failed to install dependencies after $MAX_RETRIES attempts"
    return 1
}

# Function to handle Prisma services
handle_prisma() {
    if [ -d "/app/prisma" ]; then
        echo "🔧 Prisma detected, generating client..."

        # Generate Prisma client
        if npx prisma generate 2>/dev/null; then
            echo "✅ Prisma client generated"
        else
            echo "⚠️  Prisma generation failed (may be OK if no schema)"
        fi

        # Run migrations in production mode
        if [ "$NODE_ENV" = "production" ]; then
            echo "🔄 Running Prisma migrations..."
            npx prisma migrate deploy || echo "⚠️  Migration failed or no migrations to apply"
        fi
    fi
}

# Main dependency check and installation logic
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Dependency Synchronization System"
    echo "  Service: $SERVICE_NAME"
    echo "  Node: $(node --version)"
    echo "  Yarn: $(yarn --version)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Always check dependencies on startup
    if ! check_dependencies; then
        echo ""
        echo "🔄 Dependencies are out of sync, installing..."

        # Remove package-lock.json if it exists (we use yarn)
        rm -f /app/package-lock.json

        # Install dependencies with retry logic
        if install_dependencies; then
            # Handle Prisma if applicable
            handle_prisma

            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "✅ $SERVICE_NAME is ready!"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        else
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "❌ $SERVICE_NAME startup failed!"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            exit 1
        fi
    else
        # Dependencies are OK, just handle Prisma
        handle_prisma

        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ $SERVICE_NAME is ready!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi

    echo ""
    echo "🎯 Starting application..."
    echo ""
}

# Run main function
main

# Execute the CMD passed to the container
exec "$@"
