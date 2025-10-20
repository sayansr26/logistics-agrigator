# Database Setup & Migration Guide

## Overview

This guide explains how to set up databases, run migrations, and seed data for the Logistics Aggregator Portal.

## Quick Start

### Initial Setup (Recommended)

For a complete fresh installation with .env files, containers, migrations, and seeds:

```bash
pnpm run setup:dev
```

**What it does:**

1. ✅ Runs `./scripts/setup.sh` - Creates .env files for all services
2. ✅ Starts Docker containers - `docker-compose --profile all-services up -d`
3. ✅ Waits for containers to be healthy
4. ✅ Deploys migrations to all services
5. ✅ Runs seed data (if available)

### Quick Setup (Skip .env creation)

If you already have .env files configured:

```bash
pnpm run setup:dev:quick
```

**What it does:**

1. ✅ Starts Docker containers
2. ✅ Deploys migrations
3. ✅ Runs seeds

## Manual Commands

### Database Initialization

Run migrations and seeds for all services:

```bash
pnpm run db:init
```

**Alias:**

```bash
pnpm run db:migrate
```

Both commands execute `./scripts/init-databases.sh` which:

- Waits for PostgreSQL and Redis to be healthy
- Deploys migrations for all services
- Runs seed data for all services

### Migration Commands

**Deploy migrations to specific services:**

```bash
pnpm run migrate:deploy
```

Deploys migrations to: auth-service, user-service, wallet-service, license-service

**Deploy migrations to ALL services:**

```bash
pnpm run migrate:deploy:all
```

### Seed Commands

**Run seeds for all services:**

```bash
pnpm run db:seed
```

**Run seeds for specific services:**

```bash
pnpm run db:seed:auth       # Auth service only
pnpm run db:seed:user       # User service only
pnpm run db:seed:wallet     # Wallet service only
pnpm run db:seed:partner    # Partner service only
pnpm run db:seed:shipment   # Shipment service only
```

## Service-Level Commands

Each service has its own database commands accessible inside containers:

```bash
# Execute inside a specific service container
docker-compose exec auth-service pnpm run migrate:deploy  # Deploy migrations
docker-compose exec auth-service pnpm run db:seed         # Run seeds
docker-compose exec auth-service pnpm run generate        # Generate Prisma client
```

## Workflow Examples

### Scenario 1: First Time Setup

```bash
# Complete fresh installation
pnpm run fresh:install

# OR manually
pnpm run cleanup              # Clean up old containers
pnpm run setup:dev            # Full setup with migrations & seeds
```

### Scenario 2: After Pulling New Code

```bash
# If migrations changed
pnpm run db:migrate           # Deploy new migrations

# If seed data changed
pnpm run db:seed             # Re-run seeds
```

### Scenario 3: Containers Already Running

```bash
# Just deploy migrations and seeds
pnpm run db:init
```

### Scenario 4: Reset Everything

```bash
# Clean everything and start fresh
pnpm run clean               # Remove containers and volumes
pnpm run setup:dev          # Complete fresh setup
```

## Database Services

The project uses a microservices architecture with separate databases:

| Service          | Database Name       | Port |
| ---------------- | ------------------- | ---- |
| Auth Service     | logistics_auth      | 3002 |
| User Service     | logistics_users     | 3003 |
| Shipment Service | logistics_shipments | 3004 |
| Partner Service  | logistics_partners  | 3005 |
| Wallet Service   | logistics_wallet    | 3006 |
| Support Service  | logistics_support   | 3007 |
| Platform Service | logistics_platforms | 3008 |
| License Service  | logistics_license   | 3011 |

**PostgreSQL Container:**

- Host: `postgres` (inside Docker network)
- Port: `3009` (external), `5432` (internal)
- User: `logistics`
- Password: `logistics123`

## Troubleshooting

### Migrations Fail

**Problem:** Migrations fail to deploy

**Solutions:**

1. **Check if containers are running:**

   ```bash
   docker-compose ps
   ```

2. **Check service logs:**

   ```bash
   pnpm run logs:auth        # Auth service logs
   docker-compose logs postgres  # Database logs
   ```

3. **Restart the service:**

   ```bash
   docker-compose restart auth-service
   ```

4. **Reset and try again:**
   ```bash
   pnpm run clean
   pnpm run setup:dev
   ```

### Seeds Fail

**Problem:** Seed execution fails

**Cause:** Seeds may fail if:

- Migrations haven't been deployed
- Database constraints prevent duplicate data
- Service doesn't have a seed file

**Solutions:**

1. **Check if migrations are deployed:**

   ```bash
   docker-compose exec auth-service npx prisma migrate status
   ```

2. **Deploy migrations first:**

   ```bash
   pnpm run migrate:deploy:all
   ```

3. **View service logs:**
   ```bash
   docker-compose logs auth-service
   ```

### Container Not Healthy

**Problem:** Containers stuck in "starting" state

**Solutions:**

1. **Wait longer** - Some services take 30-60 seconds to start

2. **Check health:**

   ```bash
   docker-compose ps
   ```

3. **View logs:**

   ```bash
   docker-compose logs postgres
   docker-compose logs redis
   ```

4. **Restart containers:**
   ```bash
   docker-compose restart postgres redis
   ```

## Advanced Usage

### Generate Prisma Client in Container

```bash
docker-compose exec auth-service pnpm run generate
```

### Access Prisma Studio

```bash
pnpm run prisma:studio        # Default: auth-service
pnpm run prisma:license:studio # License service
```

### Create New Migration

```bash
# Inside service container
docker-compose exec auth-service npx prisma migrate dev --name your_migration_name
```

### Reset Database (Development Only)

```bash
# Inside service container
docker-compose exec auth-service npx prisma migrate reset
```

**⚠️ WARNING:** This will:

- Drop the database
- Create new database
- Apply all migrations
- Run seeds

## Files Reference

- `scripts/init-databases.sh` - Main database initialization script
- `scripts/setup.sh` - Environment and dependency setup
- `backend/*/prisma/schema.prisma` - Database schema definitions
- `backend/*/prisma/migrations/` - Migration files
- `backend/*/prisma/seed.js` - Seed data scripts

## Best Practices

1. ✅ **Always run migrations** before seeds
2. ✅ **Use `pnpm run setup:dev`** for first-time setup
3. ✅ **Use `pnpm run db:init`** to refresh databases
4. ✅ **Check logs** if something fails
5. ✅ **Test in development** before deploying to production
6. ❌ **Never run `migrate reset`** in production
7. ❌ **Never delete migration files** after they're deployed

## Production Deployment

For production, use deployment-specific commands:

```bash
# Deploy migrations (no seeds in production)
docker-compose exec -T auth-service pnpm run migrate:deploy
docker-compose exec -T user-service pnpm run migrate:deploy
docker-compose exec -T wallet-service pnpm run migrate:deploy
# ... for each service
```

Or use the automated script (without seeds):

```bash
pnpm run migrate:deploy:all
```

## Support

If you encounter issues not covered here:

1. Check service logs: `pnpm run logs:[service]`
2. Check Docker logs: `docker-compose logs [service]`
3. Verify .env files are correctly configured
4. Ensure Docker and PostgreSQL are running
5. Try a fresh installation: `pnpm run fresh:install`

---

**Last Updated:** January 2025
**Version:** 1.0.0
