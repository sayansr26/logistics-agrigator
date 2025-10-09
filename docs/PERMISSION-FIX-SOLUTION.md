# Universal Permission Fix Solution

## Problem Statement

The logistics platform services were experiencing `EACCES: permission denied` errors when running as non-root users in Docker containers. This prevented:

- Installation of dependencies (`pnpm install`)
- Creation of temporary files
- Writing to log directories
- Next.js build processes

### Root Cause

Docker containers running with non-root users (nodejs user with UID 1001) lacked proper write permissions to the `/app` directory and subdirectories. When `pnpm` attempted to create temporary files or install dependencies, it failed with permission errors.

## Solution Overview

We've implemented a comprehensive permission fix that:

1. **Updates ALL Dockerfiles** with proper permission structure
2. **Removes old volumes** to ensure fresh installations
3. **Creates startup scripts** that handle dependency installation
4. **Integrates into deployment pipeline** for automatic fixing

## Implementation Details

### 1. Dockerfile Changes (All Services)

Every service Dockerfile now includes:

```dockerfile
# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# CRITICAL FIX: Ensure /app directory and all subdirectories are writable
RUN chown -R nodejs:nodejs /app
RUN chmod -R 755 /app
RUN chmod -R 775 /app/node_modules 2>/dev/null || true

# Create .pnpm-store directory for pnpm cache with proper permissions
RUN mkdir -p /app/.pnpm-store && chown -R nodejs:nodejs /app/.pnpm-store && chmod 775 /app/.pnpm-store

# Create startup script that ensures dependencies are installed before starting
RUN printf '#!/bin/sh\n...' > /app/start.sh
RUN chmod +x /app/start.sh
RUN chown nodejs:nodejs /app/start.sh

USER nodejs

CMD ["/app/start.sh"]
```

### 2. Services Updated

All 9 services have been updated with permission fixes:

#### Backend Services (8)

- `auth-service` (port 3002)
- `user-service` (port 3003)
- `shipment-service` (port 3004)
- `partner-service` (port 3005)
- `wallet-service` (port 3006)
- `support-service` (port 3007)
- `platform-service` (port 3008)
- `api-gateway` (port 3001)

#### Frontend Service (1)

- `frontend` (port 3000) - Next.js with additional .next directory permissions

### 3. Deployment Scripts

#### `scripts/fix-all-permissions.sh`

Complete permission fix for all services:

- Stops all containers
- Removes old node_modules volumes
- Rebuilds all images with permission fixes
- Starts services with fresh volumes
- Verifies each service health

#### `scripts/update-dockerfiles-permissions.sh`

Updates all Dockerfiles programmatically:

- Adds permission fixes to each Dockerfile
- Creates backups before modification
- Ensures consistent structure across services

#### `scripts/deploy-production.sh` (Updated)

Now includes automatic permission fixing:

```bash
# Fix permissions for all services (CRITICAL)
./scripts/update-dockerfiles-permissions.sh

# Remove old node_modules volumes
for volume in $(docker volume ls -q | grep -E "node_modules"); do
    docker volume rm -f "$volume" 2>/dev/null || true
done

# Rebuild with no cache
docker-compose build --no-cache --pull
```

## Usage Instructions

### For Immediate Fix on Production Server

```bash
# SSH into server
ssh user@production-server

# Navigate to project directory
cd /var/www/sub-solution

# Pull latest code
git pull origin master

# Run the universal permission fix
bash scripts/fix-all-permissions.sh

# Monitor services
docker-compose logs -f
```

### For Regular Deployment

The permission fix is now integrated into the deployment pipeline:

```bash
# Standard deployment (includes permission fixes)
bash scripts/deploy-production.sh
```

### For CI/CD Pipeline

GitLab CI/CD will automatically:

1. Pull latest code
2. Update Dockerfiles with permission fixes
3. Remove old volumes
4. Rebuild all services
5. Deploy with proper permissions

## Verification

After running the fix, verify services are working:

```bash
# Check all service health endpoints
curl http://localhost:3001/health  # API Gateway
curl http://localhost:3002/health  # Auth Service
curl http://localhost:3003/health  # User Service
curl http://localhost:3004/health  # Shipment Service
curl http://localhost:3005/health  # Partner Service
curl http://localhost:3006/health  # Wallet Service
curl http://localhost:3007/health  # Support Service
curl http://localhost:3008/health  # Platform Service
curl http://localhost:3000          # Frontend

# Check for permission errors
docker-compose logs | grep EACCES

# Check for module errors
docker-compose logs | grep "Cannot find module"

# Check specific service (e.g., shipment-service)
docker-compose exec shipment-service ls -la node_modules/axios
```

## What This Fixes

### Before Fix

- ❌ EACCES: permission denied errors
- ❌ Cannot find module 'axios' errors
- ❌ Cannot write to /app/_tmp_\* files
- ❌ Services failing to start
- ❌ Dependencies not installing

### After Fix

- ✅ All services run as non-root user securely
- ✅ Dependencies install correctly
- ✅ Temporary files can be created
- ✅ Logs can be written
- ✅ Next.js can build and run

## Key Improvements

1. **Security**: Services run as non-root user (nodejs, UID 1001)
2. **Consistency**: All services follow the same permission pattern
3. **Automation**: Permission fixes are integrated into deployment
4. **Reliability**: Startup scripts ensure dependencies are always installed
5. **Maintenance**: Old volumes are automatically cleaned up

## Troubleshooting

If you still encounter permission issues:

1. **Check volume status**:

   ```bash
   docker volume ls | grep node_modules
   ```

2. **Force remove stubborn volumes**:

   ```bash
   docker-compose down -v
   docker volume prune -f
   ```

3. **Check container user**:

   ```bash
   docker-compose exec [service-name] whoami
   # Should return: nodejs
   ```

4. **Check directory permissions**:

   ```bash
   docker-compose exec [service-name] ls -la /app
   # Should show nodejs:nodejs ownership
   ```

5. **Manual dependency install** (if needed):
   ```bash
   docker-compose exec -u root [service-name] pnpm install
   docker-compose exec -u root [service-name] chown -R nodejs:nodejs /app
   docker-compose restart [service-name]
   ```

## Prevention

To prevent future permission issues:

1. **Always use the deployment scripts** - Don't manually rebuild
2. **Remove volumes when updating dependencies** - Use `docker-compose down -v`
3. **Test locally first** - Ensure Dockerfiles work before deploying
4. **Monitor CI/CD logs** - Check for permission errors in pipeline

## Summary

This comprehensive permission fix ensures all services in the logistics platform can:

- Run securely as non-root users
- Install and update dependencies
- Create temporary files
- Write logs
- Build and serve applications

The fix is integrated into the deployment pipeline, making it automatic and consistent across all environments.

---

**Created**: 2025-10-09
**Issue**: EACCES permission denied preventing dependency installation
**Resolution**: Universal permission fix for all services with automated deployment integration
**Status**: ✅ IMPLEMENTED AND TESTED
