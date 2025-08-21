# 🛠️ Scripts Guide - Logistics Aggregator Portal

This guide covers all the automation scripts available in the Logistics Aggregator Portal project.

## 📋 Quick Reference

| Command                   | Description              | Use Case                        |
| ------------------------- | ------------------------ | ------------------------------- |
| `pnpm run cleanup`        | Clean all artifacts      | When having dependency issues   |
| `pnpm run cleanup:deep`   | Deep clean + Docker      | When Docker is acting up        |
| `pnpm run setup:dev`      | Full stack setup         | First time setup or fresh start |
| `pnpm run setup:frontend` | Frontend only setup      | Frontend development only       |
| `pnpm run setup:backend`  | Backend only setup       | Backend development only        |
| `pnpm run fresh:install`  | Cleanup + Full setup     | Complete fresh installation     |
| `pnpm run fresh:frontend` | Cleanup + Frontend setup | Fresh frontend installation     |
| `pnpm run fresh:backend`  | Cleanup + Backend setup  | Fresh backend installation      |

## 🚀 Getting Started

### First Time Setup

```bash
# Clone the repository
git clone <repository-url>
cd logistics-main

# Complete automated setup
pnpm run setup:dev

# Start development
# The setup script will guide you to run:
# pnpm run dev
```

### Troubleshooting Issues

```bash
# If you're having any issues, start fresh:
pnpm run fresh:install

# This will:
# 1. Clean everything
# 2. Setup all .env files
# 3. Install dependencies
# 4. Generate Prisma clients
# 5. Start all services
```

## 🧹 Cleanup Scripts

### `pnpm run cleanup`

**What it does:**

- ✅ Removes all `node_modules` directories
- ✅ Removes all lock files (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`)
- ✅ Removes all build directories (`.next`, `dist`, `build`)
- ✅ Removes all cache directories (`.turbo`, `.eslintcache`)
- ✅ Removes temporary files (`*.log`, `*.tmp`, `.DS_Store`)
- ✅ Stops and removes Docker containers
- ✅ Cleans Docker build cache
- ✅ Cleans pnpm store cache

**When to use:**

- Dependency conflicts
- Build issues
- Cache problems
- Before fresh installation

### `pnpm run cleanup:deep`

**Additional actions:**

- ✅ Docker system prune (removes unused images, networks, volumes)

**When to use:**

- Docker is consuming too much space
- Docker containers are behaving strangely
- Complete system cleanup needed

## 🚀 Setup Scripts

### `pnpm run setup:dev` (Full Stack)

**What it does:**

- ✅ Creates root `.env` from `.env.example`
- ✅ Creates `.env` files for all backend services:
  - `backend/auth-service/.env`
  - `backend/user-service/.env`
  - `backend/shipment-service/.env`
  - `backend/support-service/.env`
  - `backend/platform-service/.env`
  - `backend/api-gateway/.env`
- ✅ Creates `frontend/.env.local`
- ✅ Installs all dependencies with pnpm
- ✅ Generates Prisma clients for all services

**Environment Configuration:**

- Each service gets its own PostgreSQL database
- All services configured for inter-service communication
- Frontend configured to connect to API Gateway
- External service placeholders configured
- Service-specific settings from dedicated `.env.example` files

**Service-Specific Features:**

- **Auth Service**: JWT configuration, 2FA settings, session management
- **User Service**: File upload paths, avatar management, document handling
- **Shipment Service**: Tracking URLs, courier webhooks, SMS/email notifications
- **Support Service**: Ticket management, live chat, escalation timers
- **Platform Service**: Shopify/Amazon/WooCommerce/Magento API credentials
- **API Gateway**: CORS settings, rate limiting, load balancing, circuit breaker

### `pnpm run setup:frontend` (Frontend Only)

**What it does:**

- ✅ Creates `frontend/.env.local` with:
  - API Gateway URL configuration
  - Service URLs for direct calls
  - Application metadata
  - External service URLs
- ✅ Installs dependencies

### `pnpm run setup:backend` (Backend Only)

**What it does:**

- ✅ Creates root `.env`
- ✅ Creates `.env` files for all backend services
- ✅ Installs dependencies
- ✅ Generates Prisma clients

## 🔄 Fresh Install Scripts

These combine cleanup + setup for complete fresh installations:

### `pnpm run fresh:install`

```bash
# Equivalent to:
pnpm run cleanup
pnpm run setup:dev
```

### `pnpm run fresh:frontend`

```bash
# Equivalent to:
pnpm run cleanup
pnpm run setup:frontend
```

### `pnpm run fresh:backend`

```bash
# Equivalent to:
pnpm run cleanup
pnpm run setup:backend
```

## 📁 Generated Environment Files

### Root Level

- `.env` - Main environment configuration

### Backend Services

Each service gets a dedicated `.env` file with:

| Service          | Database              | Port | .env Location                   |
| ---------------- | --------------------- | ---- | ------------------------------- |
| auth-service     | `logistics_auth`      | 8001 | `backend/auth-service/.env`     |
| user-service     | `logistics_users`     | 8002 | `backend/user-service/.env`     |
| shipment-service | `logistics_shipments` | 8003 | `backend/shipment-service/.env` |
| support-service  | `logistics_support`   | 8004 | `backend/support-service/.env`  |
| platform-service | `logistics_platforms` | 8005 | `backend/platform-service/.env` |
| api-gateway      | `logistics_gateway`   | 8000 | `backend/api-gateway/.env`      |

### Frontend

- `frontend/.env.local` - Next.js environment variables

## 🔧 Configuration Details

### Database URLs

Each service is configured with its own database:

```bash
# Example for user-service
DATABASE_URL="postgresql://logistics:logistics123@localhost:5432/logistics_users"
```

### Inter-Service Communication

All services are configured to communicate with each other:

```bash
AUTH_SERVICE_URL="http://localhost:8001"
USER_SERVICE_URL="http://localhost:8002"
SHIPMENT_SERVICE_URL="http://localhost:8003"
# ... etc
```

### External Services

Placeholders for external service integration:

```bash
WALLET_SERVICE_URL="http://localhost:8006"
WALLET_SERVICE_API_KEY="your_wallet_service_api_key"
PARTNER_SERVICE_URL="http://localhost:8007"
PARTNER_SERVICE_API_KEY="your_partner_service_api_key"
```

### Security Configuration

Default security settings (⚠️ **Change in production!**):

```bash
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="3600"
BCRYPT_ROUNDS=12
```

## 🎯 Common Workflows

### Starting Development

```bash
# Option 1: Fresh start (recommended for first time)
pnpm run fresh:install

# Option 2: If already set up
pnpm run dev
```

### Frontend Development Only

```bash
# Setup frontend only
pnpm run setup:frontend

# Start frontend
pnpm run dev:frontend
```

### Backend Development Only

```bash
# Setup backend only
pnpm run setup:backend

# Start backend services
pnpm run dev:backend
```

### Fixing Dependency Issues

```bash
# Clean and reinstall everything
pnpm run fresh:install
```

### Fixing Docker Issues

```bash
# Deep clean including Docker
pnpm run cleanup:deep
pnpm run setup:dev
```

### Updating Environment Files

```bash
# Force recreate all .env files
./scripts/setup.sh --force
```

## 🚨 Important Notes

### Production Considerations

Before deploying to production, update these values:

1. **JWT_SECRET** - Use a strong, unique secret
2. **Database credentials** - Use secure credentials
3. **External API keys** - Add your actual API keys
4. **Service URLs** - Update to production URLs

### Script Permissions

If you get permission errors:

```bash
chmod +x scripts/cleanup.sh
chmod +x scripts/setup.sh
```

### pnpm Requirement

These scripts require pnpm. Install it if needed:

```bash
npm install -g pnpm@8.15.1
```

## 🔍 Troubleshooting

### "Command not found" errors

Make sure scripts are executable:

```bash
chmod +x scripts/*.sh
```

### Docker permission errors

Make sure Docker is running and you have permissions:

```bash
docker --version
docker ps
```

### pnpm not found

Install pnpm globally:

```bash
npm install -g pnpm@8.15.1
```

### .env files not created

Try forcing recreation:

```bash
./scripts/setup.sh --force
```

### Prisma client errors

Regenerate Prisma clients:

```bash
pnpm -r run generate
```

## 📚 Additional Resources

- [Scripts Directory README](./scripts/README.md) - Detailed script documentation
- [Main README](./README.md) - Project overview and setup
- [Backend Task Management](./backend/BACKEND_TASK.md) - Development tasks
- [Auth Service Archive](./backend/BACKEND_AUTH_TASK.md) - Completed auth tasks

## 🎉 Success Indicators

After running setup scripts, you should see:

1. ✅ All `.env` files created in their respective directories
2. ✅ `node_modules` installed in all workspaces
3. ✅ Prisma clients generated successfully
4. ✅ No error messages in the output
5. ✅ Clear next steps provided by the script

If you see all these indicators, your development environment is ready! 🚀
