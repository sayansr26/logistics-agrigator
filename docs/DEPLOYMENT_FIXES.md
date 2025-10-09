# Deployment Fixes Guide

This document provides solutions for common deployment issues encountered in the Logistics Aggregator Portal.

## Table of Contents

1. [Logger Permission Issues (EACCES)](#logger-permission-issues)
2. [Missing Dependencies](#missing-dependencies)
3. [Redis Memory Overcommit Warning](#redis-memory-overcommit)
4. [CI/CD Considerations](#cicd-considerations)

---

## Logger Permission Issues

### Problem

```
EACCES: permission denied, mkdir '/app/logs/service-name'
```

### Root Cause

Docker containers run with non-root user (`nodejs:1001`) but the logger tries to create log directories after switching users, causing permission errors.

### Solution Applied

**1. Updated `shared/lib/logger.js`** (Line 60-69)

Added graceful error handling to trigger console fallback when log directory creation fails:

```javascript
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (mkdirError) {
  // Trigger fallback to console logger
  throw new Error(
    `Cannot create logs directory: ${mkdirError.message}. Will use console fallback.`,
  );
}
```

**2. Updated All Service Dockerfiles**

Created logs directories with correct permissions BEFORE switching to non-root user:

```dockerfile
# Create logs directory with service-specific subdirectory
RUN mkdir -p logs/service-name

# Change ownership (including logs)
RUN chown -R nodejs:nodejs /app

USER nodejs
```

**Services Updated:**

- ✅ `backend/api-gateway/Dockerfile`
- ✅ `backend/auth-service/Dockerfile` (already correct)
- ✅ `backend/user-service/Dockerfile`
- ✅ `backend/shipment-service/Dockerfile`
- ✅ `backend/partner-service/Dockerfile`
- ✅ `backend/wallet-service/Dockerfile`
- ✅ `backend/support-service/Dockerfile`
- ✅ `backend/platform-service/Dockerfile`

### Verification

After rebuild, logs should show:

```
✅ Good: [2025-10-09T12:19:55.302Z] INFO [api-gateway] Enhanced logging initialized
❌ Bad: Winston not available, using enhanced console logger fallback
```

---

## Missing Dependencies

### Problem

```
Error: Cannot find module 'axios'
Require stack:
- /app/services/partnerIntegrationService.js
```

### Root Cause

Dependencies defined in `package.json` but not installed in Docker container during build.

### Solution

The Dockerfile already has `RUN pnpm install`, but the issue occurs when:

1. **Build context issue**: Source files not properly copied
2. **Cache issue**: Docker uses old layer without new dependencies
3. **pnpm workspace issue**: Dependencies not hoisted correctly

### Fix Commands

**Force Rebuild Without Cache:**

```bash
# Rebuild specific service
docker-compose build --no-cache shipment-service

# Rebuild all services
docker-compose build --no-cache

# Or full cleanup + rebuild
docker-compose down -v
docker system prune -f
docker-compose up --build
```

### Prevention in CI/CD

Add to CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml or equivalent
- name: Build Docker images
  run: |
    docker-compose build --no-cache --pull

- name: Verify dependencies
  run: |
    docker-compose run shipment-service pnpm list axios
```

---

## Redis Memory Overcommit

### Problem

```
WARNING Memory overcommit must be enabled! Without it, a background save or
replication may fail under low memory condition.
```

### Severity

⚠️ **WARNING** (Not Critical) - Redis will work but may have issues during background saves in low-memory situations.

### Root Cause

Linux kernel setting `vm.overcommit_memory` is set to `0` (default) instead of `1`, which Redis recommends for better stability.

### Production Solution

**Option 1: System-wide fix (Recommended for production)**

```bash
# On the host server (NOT inside Docker container)
sudo sysctl vm.overcommit_memory=1

# Make it permanent across reboots
echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**Option 2: Docker Compose override**

Add to `docker-compose.yml` under redis service:

```yaml
redis:
  image: redis:7.4-alpine
  sysctls:
    - net.core.somaxconn=511
  # Note: vm.overcommit_memory requires privileged mode or host-level setting
  privileged: true # Only if absolutely necessary
```

⚠️ **Warning**: Avoid `privileged: true` in production for security reasons.

**Option 3: Accept the warning (Development)**

The warning is non-critical for development environments. Redis will function normally with occasional warnings.

### Verification

```bash
# Check current setting on host
sysctl vm.overcommit_memory

# Expected output after fix: vm.overcommit_memory = 1

# Restart Redis after applying fix
docker-compose restart redis
```

### References

- [Redis Documentation: Background Saving](https://redis.io/docs/management/admin/)
- [Jemalloc Issue #1328](https://github.com/jemalloc/jemalloc/issues/1328)

---

## CI/CD Considerations

### Automatic Deployment Checklist

When your CI/CD pipeline deploys changes automatically, ensure:

**1. Pre-deployment Checks**

```bash
# Verify Docker images build successfully
docker-compose build --no-cache

# Run health checks before switching traffic
docker-compose up -d
sleep 10
curl -f http://localhost:3001/health || exit 1
curl -f http://localhost:3002/health || exit 1
```

**2. Gradual Rollout**

```bash
# Blue-green deployment pattern
docker-compose -f docker-compose.yml -f docker-compose.blue.yml up -d
# Wait for health checks
# Switch traffic
# Stop old stack
docker-compose -f docker-compose.green.yml down
```

**3. Rollback Strategy**

```bash
# Tag images with git commit SHA
docker build -t logistics-shipment-service:${COMMIT_SHA} .

# Keep last 3 working versions
docker images | grep logistics-shipment-service | tail -n +4 | awk '{print $3}' | xargs docker rmi
```

**4. Log Persistence**

Ensure logs are persisted outside containers:

```yaml
# docker-compose.yml
services:
  shipment-service:
    volumes:
      - ./logs:/app/logs # Persist logs on host
```

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [master, main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Images
        run: docker-compose build --no-cache --pull

      - name: Run Tests
        run: docker-compose run --rm shipment-service pnpm test

      - name: Deploy
        run: |
          docker-compose up -d
          sleep 15

      - name: Health Checks
        run: |
          curl -f http://localhost:3001/health
          curl -f http://localhost:3002/health
          curl -f http://localhost:3004/health

      - name: Cleanup Old Images
        run: docker system prune -af --filter "until=72h"
```

---

## Summary of Fixes Applied

| Issue                    | Status        | Files Modified                         |
| ------------------------ | ------------- | -------------------------------------- |
| Logger permission errors | ✅ Fixed      | `shared/lib/logger.js` + 8 Dockerfiles |
| Missing axios dependency | ✅ Fixed      | Rebuild with `--no-cache`              |
| Redis memory warning     | ⚠️ Documented | Production server config needed        |
| CI/CD guidelines         | ✅ Documented | This file                              |

---

## Deployment Commands

### Fresh Deployment

```bash
# Stop all containers
docker-compose down -v

# Clean Docker system
docker system prune -af

# Rebuild without cache
docker-compose build --no-cache --pull

# Start services
docker-compose up -d

# View logs
docker-compose logs -f --tail=50
```

### Verify Services

```bash
# Check all services are running
docker-compose ps

# Check health endpoints
curl http://localhost:3001/health | jq .
curl http://localhost:3002/health | jq .
curl http://localhost:3003/health | jq .
curl http://localhost:3004/health | jq .
curl http://localhost:3005/health | jq .
curl http://localhost:3006/health | jq .
curl http://localhost:3007/health | jq .
curl http://localhost:3008/health | jq .

# Check logs for errors
docker-compose logs | grep -i "error\|warn"
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs for specific service
docker-compose logs shipment-service --tail=100

# Rebuild single service
docker-compose build --no-cache shipment-service
docker-compose up -d shipment-service

# Enter container for debugging
docker-compose exec shipment-service sh
```

### Database Connection Issues

```bash
# Check if PostgreSQL is ready
docker-compose logs postgres | grep "ready to accept connections"

# Test database connectivity
docker-compose exec shipment-service npx prisma db pull

# Reset database (CAUTION: DATA LOSS)
docker-compose down -v
docker-compose up -d postgres redis
sleep 5
docker-compose up -d
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose logs redis --tail=20

# Test Redis connectivity
docker-compose exec redis redis-cli ping
# Expected: PONG

# Check service can connect to Redis
docker-compose exec shipment-service sh -c 'npm install -g redis-cli && redis-cli -h redis ping'
```

---

**Last Updated**: 2025-10-09
**Applies To**: All backend microservices
**Next Review**: After next major deployment
