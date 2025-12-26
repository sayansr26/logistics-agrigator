#!/bin/bash

# ============================================================================
# Setup Local Environment Files for Non-Docker Development
# ============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Creating .env files for local development..."

# API Gateway
cat > "$PROJECT_ROOT/backend/api-gateway/.env" << 'EOF'
NODE_ENV=development
PORT=3001
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CORS_ORIGIN=http://localhost:3000
SERVICE_NAME=api-gateway
AUTH_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
SHIPMENT_SERVICE_URL=http://localhost:3004
PARTNER_SERVICE_URL=http://localhost:3005
WALLET_SERVICE_URL=http://localhost:3006
SUPPORT_SERVICE_URL=http://localhost:3007
PLATFORM_SERVICE_URL=http://localhost:3008
LICENSE_SERVICE_URL=http://localhost:3011
EOF
echo "✓ Created backend/api-gateway/.env"

# Auth Service
cat > "$PROJECT_ROOT/backend/auth-service/.env" << 'EOF'
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=604800
EOF
echo "✓ Created backend/auth-service/.env"

# User Service
cat > "$PROJECT_ROOT/backend/user-service/.env" << 'EOF'
NODE_ENV=development
PORT=3003
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_users
AUTH_DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_SERVICE_URL=http://localhost:3002
EOF
echo "✓ Created backend/user-service/.env"

# Shipment Service
cat > "$PROJECT_ROOT/backend/shipment-service/.env" << 'EOF'
NODE_ENV=development
PORT=3004
SERVICE_NAME=shipment-service
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_shipments
AUTH_DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
WALLET_SERVICE_URL=http://localhost:3006
PARTNER_SERVICE_URL=http://localhost:3005
PARTNER_SERVICE_EXTERNAL_URL=https://calc.websiteduniya.com
EOF
echo "✓ Created backend/shipment-service/.env"

# Partner Service
cat > "$PROJECT_ROOT/backend/partner-service/.env" << 'EOF'
NODE_ENV=development
PORT=3005
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_partners
AUTH_DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
SHIPMENT_SERVICE_URL=http://localhost:3004
PARTNER_SERVICE_EXTERNAL_URL=https://calc.websiteduniya.com
PARTNER_SERVICE_API_KEY=your_super_secret_hmac_key_minimum_32_characters
EXTERNAL_COURIER_TIMEOUT=15000
SERVICE_ID=TESTING_1
HMAC_SECRET=hmac_super_secret_key_2024_partner_services
API_SECRET_SALT=api_secret_salt_2024_partner_services
PARTNER_SERVICE_TIMEOUT=5000
PARTNER_SERVICE_RETRY_ATTEMPTS=3
PARTNER_SERVICE_CACHE_TTL=300
EOF
echo "✓ Created backend/partner-service/.env"

# Wallet Service
cat > "$PROJECT_ROOT/backend/wallet-service/.env" << 'EOF'
NODE_ENV=development
PORT=3006
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_wallet
AUTH_DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
PARTNER_SERVICE_URL=http://localhost:3005
SHIPMENT_SERVICE_URL=http://localhost:3004
EXTERNAL_WALLET_API_URL=https://wapi.websiteduniya.com/api/v1
EXTERNAL_WALLET_SECRET_KEY=production-hmac-secret-key-256-bit-minimum-ultra-secure-change-me
EXTERNAL_WALLET_USER_ID=wallet-service
DEFAULT_CLIENT_CODE=DEFAULT
CACHE_WALLET_TTL=600
CACHE_BALANCE_TTL=300
CACHE_TRANSACTIONS_TTL=60
EOF
echo "✓ Created backend/wallet-service/.env"

# Support Service
cat > "$PROJECT_ROOT/backend/support-service/.env" << 'EOF'
NODE_ENV=development
PORT=3007
SERVICE_NAME=support-service
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_support
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
EOF
echo "✓ Created backend/support-service/.env"

# Platform Service
cat > "$PROJECT_ROOT/backend/platform-service/.env" << 'EOF'
NODE_ENV=development
PORT=3008
SERVICE_NAME=platform-service
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_platforms
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
SHIPMENT_SERVICE_URL=http://localhost:3004
EOF
echo "✓ Created backend/platform-service/.env"

# License Service
cat > "$PROJECT_ROOT/backend/license-service/.env" << 'EOF'
NODE_ENV=development
PORT=3011
SERVICE_NAME=license-service
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_license
AUTH_DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=604800
LICENSE_SECRET_KEY=ultra-secure-license-key-min-32-chars-required-change-in-prod
LICENSE_SIGNING_KEY=signing-key-for-license-validation-hmac-sha256-change-in-prod
AUTH_SERVICE_URL=http://localhost:3002
USER_SERVICE_URL=http://localhost:3003
EOF
echo "✓ Created backend/license-service/.env"

# Frontend
cat > "$PROJECT_ROOT/frontend/.env.local" << 'EOF'
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_ENV=development
EOF
echo "✓ Created frontend/.env.local"

echo ""
echo "✅ All local environment files created successfully!"
echo ""
echo "Next steps:"
echo "  1. Ensure PostgreSQL is running: brew services start postgresql@15"
echo "  2. Ensure Redis is running: brew services start redis"
echo "  3. Create databases: psql postgres -f scripts/init-databases.sql"
echo "  4. Run migrations for each service"
echo "  5. Start services: ./scripts/start-local.sh"
