#!/bin/sh
###############################################################################
# PRODUCTION ENTROYPOINT SCRIPT
# Runs Prisma migrations and seeds before starting the service
# Usage: Add to Dockerfile.prod as ENTRYPOINT
###############################################################################

set -e

SERVICE_NAME="${SERVICE_NAME:-unknown-service}"
echo "🚀 Starting $SERVICE_NAME (Production)..."

# Find and run Prisma migrations if Prisma is used
# Check multiple possible locations for prisma schema
PRISMA_SCHEMA_LOCATIONS="
  /app/prisma/schema.prisma
  /app/backend/${SERVICE_NAME}/prisma/schema.prisma
  /app/backend/auth-service/prisma/schema.prisma
  /app/backend/user-service/prisma/schema.prisma
  /app/backend/shipment-service/prisma/schema.prisma
  /app/backend/partner-service/prisma/schema.prisma
  /app/backend/wallet-service/prisma/schema.prisma
  /app/backend/support-service/prisma/schema.prisma
  /app/backend/platform-service/prisma/schema.prisma
  /app/backend/license-service/prisma/schema.prisma
"

# Find the prisma schema location
PRISMA_SCHEMA=""
for location in $PRISMA_SCHEMA_LOCATIONS; do
  if [ -f "$location" ]; then
    PRISMA_SCHEMA="$location"
    echo "✅ Found Prisma schema at: $PRISMA_SCHEMA"
    break
  fi
done

# Run migrations and seeds if schema found
if [ -n "$PRISMA_SCHEMA" ]; then
  # Get the directory containing the schema
  PRISMA_DIR=$(dirname "$PRISMA_SCHEMA")

  echo "🔄 Running Prisma migrations..."

  # Check if migrations folder exists and has migrations
  if [ -d "$PRISMA_DIR/migrations" ] && [ -n "$(ls -A $PRISMA_DIR/migrations 2>/dev/null | grep -v 'migration_lock.toml')" ]; then
    echo "📂 Migrations folder found, using prisma migrate deploy"

    # Wait for database to be ready (simple connection check)
    TIMEOUT=30
    ELAPSED=0
    while [ $ELAPSED -lt $TIMEOUT ]; do
      if npx prisma db execute --stdin --schema="$PRISMA_SCHEMA" <<< "SELECT 1" >/dev/null 2>&1; then
        echo "✅ Database is ready"
        break
      fi
      echo "⏳ Waiting for database... ($((ELAPSED + 1))/$TIMEOUT)"
      sleep 1
      ELAPSED=$((ELAPSED + 1))
    done

    if [ $ELAPSED -ge $TIMEOUT ]; then
      echo "❌ Database connection timeout after $TIMEOUT seconds"
      exit 1
    fi

    # Deploy migrations with proper error handling
    echo "📋 Applying migrations..."
    if npx prisma migrate deploy --schema="$PRISMA_SCHEMA"; then
      echo "✅ Migrations applied successfully"
    else
      echo "❌ Migration deployment failed!"
      echo "📋 To diagnose: ./scripts/diagnose-migrations.sh"
      exit 1
    fi
  else
    echo "⚠️  No migrations folder found, falling back to db push"
    echo "⚠️  This is not recommended for production - migrations should be used"

    # Wait for database to be ready
    TIMEOUT=30
    ELAPSED=0
    while [ $ELAPSED -lt $TIMEOUT ]; do
      if npx prisma db execute --stdin --schema="$PRISMA_SCHEMA" <<< "SELECT 1" >/dev/null 2>&1; then
        echo "✅ Database is ready"
        break
      fi
      echo "⏳ Waiting for database... ($((ELAPSED + 1))/$TIMEOUT)"
      sleep 1
      ELAPSED=$((ELAPSED + 1))
    done

    if npx prisma db push --skip-generate --schema="$PRISMA_SCHEMA"; then
      echo "✅ Schema synced with db push"
    else
      echo "❌ db push failed"
      exit 1
    fi
  fi

  # Run seed script for auth-service (creates superadmin user)
  if [ "$SERVICE_NAME" = "auth-service" ]; then
    echo "🌱 Running seed script..."

    # Run seed script directly with node (avoiding Prisma's path resolution issues)
    if [ -f "$PRISMA_DIR/seed.js" ]; then
      (cd "$PRISMA_DIR" && node seed.js) && echo "✅ Seed completed successfully" || echo "⚠️  Seed failed or no seed data needed"
    else
      echo "⚠️  Seed script not found at $PRISMA_DIR/seed.js"
    fi
  fi
else
  echo "ℹ️  No Prisma schema found, skipping migrations"
fi

echo ""
echo "🎯 Starting $SERVICE_NAME..."
echo ""

# Execute the CMD passed to the container (from original working directory)
exec "$@"
