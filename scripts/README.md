# Scripts Directory

This directory contains utility scripts for the Logistics Aggregator Portal project.

## Available Scripts

### 🧹 Cleanup Script (`cleanup.sh`)

Comprehensive cleanup script that removes all build artifacts, dependencies, and temporary files.

**Usage:**

```bash
# Basic cleanup
pnpm run cleanup
# or
./scripts/cleanup.sh

# Deep cleanup (includes Docker system prune)
pnpm run cleanup:deep
# or
./scripts/cleanup.sh --docker-deep-clean
```

**What it cleans:**

- ✅ All `node_modules` directories
- ✅ All lock files (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`)
- ✅ All build directories (`.next`, `dist`, `build`)
- ✅ All cache directories (`.turbo`, `.eslintcache`)
- ✅ Temporary files (`*.log`, `*.tmp`, `.DS_Store`)
- ✅ Docker containers and volumes
- ✅ Docker build cache
- ✅ pnpm store cache

### 🚀 Setup Script (`setup.sh`)

Intelligent setup script that automatically configures environment files and installs dependencies.

**Usage:**

```bash
# Full stack setup (frontend + backend)
pnpm run setup:dev
# or
./scripts/setup.sh

# Frontend only setup
pnpm run setup:frontend
# or
./scripts/setup.sh --frontend

# Backend only setup
pnpm run setup:backend
# or
./scripts/setup.sh --backend

# Force overwrite existing .env files
./scripts/setup.sh --force
```

**What it does:**

- ✅ Creates `.env` files from service-specific `.env.example` templates
- ✅ Generates service-specific `.env` files for all backend services with proper configurations
- ✅ Creates frontend `.env.local` with proper configuration
- ✅ Installs all dependencies with pnpm
- ✅ Generates Prisma clients for backend services
- ✅ Provides next steps and configuration guidance

**Service-Specific Configurations:**

- ✅ **Auth Service**: JWT, session management, 2FA settings
- ✅ **User Service**: File uploads, avatar management, document handling
- ✅ **Shipment Service**: Tracking URLs, courier integration, SMS/email notifications
- ✅ **Support Service**: Ticket management, live chat, escalation settings
- ✅ **Platform Service**: Shopify, Amazon, WooCommerce, Magento integrations
- ✅ **API Gateway**: CORS, rate limiting, load balancing, circuit breaker

### 🔄 Fresh Install Commands

Complete cleanup and setup in one command:

```bash
# Fresh full stack install
pnpm run fresh:install

# Fresh frontend install
pnpm run fresh:frontend

# Fresh backend install
pnpm run fresh:backend
```

## Environment File Structure

The setup script automatically creates the following environment files:

### Root Level

- `.env` - Main environment configuration (from `.env.example`)

### Backend Services

Each service gets its own `.env` file with:

- Database URL (service-specific database)
- Redis URL
- JWT configuration
- Service ports
- Inter-service communication URLs
- External service configurations

**Services:**

- `backend/auth-service/.env`
- `backend/user-service/.env`
- `backend/shipment-service/.env`
- `backend/support-service/.env`
- `backend/platform-service/.env`
- `backend/api-gateway/.env`

### Frontend

- `frontend/.env.local` - Next.js environment variables

## Database Configuration

Each backend service is configured with its own PostgreSQL database:

| Service          | Database Name         | Port |
| ---------------- | --------------------- | ---- |
| auth-service     | `logistics_auth`      | 8001 |
| user-service     | `logistics_users`     | 8002 |
| shipment-service | `logistics_shipments` | 8003 |
| support-service  | `logistics_support`   | 8004 |
| platform-service | `logistics_platforms` | 8005 |
| api-gateway      | `logistics_gateway`   | 8000 |

## Usage Examples

### Starting Fresh Development

```bash
# Complete fresh start
pnpm run fresh:install

# This will:
# 1. Clean all artifacts
# 2. Setup all .env files
# 3. Install dependencies
# 4. Generate Prisma clients
# 5. Start all services
```

### Troubleshooting Development Issues

```bash
# If you're having dependency issues
pnpm run cleanup
pnpm run setup:dev

# If Docker is acting up
pnpm run cleanup:deep  # Includes Docker system prune
pnpm run setup:dev
```

### Frontend-Only Development

```bash
# Setup and start frontend only
pnpm run fresh:frontend

# This will:
# 1. Clean frontend artifacts
# 2. Setup frontend .env.local
# 3. Install dependencies
# 4. Start frontend development server
```

### Backend-Only Development

```bash
# Setup and start backend only
pnpm run fresh:backend

# This will:
# 1. Clean backend artifacts
# 2. Setup all backend .env files
# 3. Install dependencies
# 4. Generate Prisma clients
# 5. Start backend services
```

## Configuration Notes

### JWT Secret

- Default: `your-super-secret-jwt-key-change-in-production`
- **⚠️ IMPORTANT**: Change this in production!

### Database Credentials

- Default: `logistics:logistics123@localhost:5432`
- **⚠️ IMPORTANT**: Use secure credentials in production!

### External Services

The setup script creates placeholders for:

- Wallet Service API Key
- Partner Service API Key
- Shopify OAuth credentials
- SMS/Email service keys

**Update these with your actual credentials before running in production.**

## Troubleshooting

### Permission Issues

If you get permission errors:

```bash
chmod +x scripts/cleanup.sh
chmod +x scripts/setup.sh
```

### Docker Issues

If Docker commands fail:

```bash
# Make sure Docker is running
docker --version

# Try deep cleanup
pnpm run cleanup:deep
```

### pnpm Issues

If pnpm is not found:

```bash
npm install -g pnpm@8.15.1
```

### Environment File Issues

If .env files are not created properly:

```bash
# Force recreate all .env files
./scripts/setup.sh --force
```

## Script Maintenance

These scripts are designed to be:

- **Safe**: Won't delete important files outside the project
- **Verbose**: Clear output showing what's happening
- **Flexible**: Options for different use cases
- **Robust**: Handle missing files/directories gracefully

To modify the scripts:

1. Edit the `.sh` files in this directory
2. Test thoroughly before committing
3. Update this README if behavior changes
4. Ensure scripts remain executable (`chmod +x`)
