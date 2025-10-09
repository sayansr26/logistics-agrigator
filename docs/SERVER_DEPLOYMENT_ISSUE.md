# Server Deployment Issue - Root Cause Analysis

## Issue Summary

**Problem**: Server shows errors despite having latest code at commit 05b47f84

- ❌ Cannot find module 'axios'
- ❌ Cannot find module './shared/lib/logger'
- ❌ Permission denied errors (secondary issue, skipping for now)

**Status**: Server has pulled latest code BUT hasn't rebuilt Docker images

## Root Cause

### The Docker Image Cache Problem

When you pull code with `git pull`, it only updates the source files on the server filesystem. However, Docker containers run from **images**, not directly from source files.

**What happens:**

1. **You push code** → GitHub/GitLab receives new code ✅
2. **Server pulls code** → `/v/w/sub-solution` has latest files ✅
3. **Docker still uses OLD images** → Containers run outdated code ❌

**Why the errors occur:**

```
Error: Cannot find module 'axios'
```

- The old Docker image was built when package.json was different
- Running `pnpm install` in OLD image doesn't pick up new dependencies
- The `node_modules` volume is a NAMED volume that persists old state

```
Error: Cannot find module './shared/lib/logger'
```

- After nodemon restarts (file changes detected)
- The old Docker image doesn't have proper `COPY shared ./shared` command
- Volume mount tries to fix it but node_modules is out of sync

## Verification

### ✅ Code is Correct (Verified)

**package.json has axios:**

```json
{
  "dependencies": {
    "axios": "^1.6.2" // ✅ Present in line 20
  }
}
```

**Dockerfile copies shared correctly:**

```dockerfile
# Line 10 - Copies shared library
COPY shared ./shared

# Line 13 - Copies service code
COPY backend/shipment-service .

# Line 16 - Installs dependencies (including axios)
RUN pnpm install
```

**docker-compose.yml mounts volumes correctly:**

```yaml
volumes:
  - ./backend/shipment-service:/app
  - ./shared:/app/shared # ✅ Shared is mounted
  - ./logs:/app/logs
  - shipment_node_modules:/app/node_modules # ⚠️ Named volume (persists old state)
```

### ❌ Docker Image is Outdated

The running container was built from an image created BEFORE:

- axios was added to package.json
- Proper COPY commands were added to Dockerfile
- Dependencies were updated in pnpm-lock.yaml

## Solution

### Quick Fix (Manual Rebuild)

On the production server, run:

```bash
cd /v/w/sub-solution

# Stop all containers
docker-compose down

# Rebuild images WITHOUT cache (critical!)
docker-compose build --no-cache --pull

# Start all services
docker-compose --profile all-services up -d

# Verify services are healthy
docker-compose logs shipment-service --tail=50
curl http://localhost:3004/health
```

### Automated Solution

Use the provided deployment script:

```bash
cd /v/w/sub-solution
bash scripts/deploy-server.sh
```

This script automatically:

1. Pulls latest code
2. Stops containers
3. Rebuilds images with `--no-cache` flag
4. Starts all services
5. Performs health checks
6. Detects errors in logs
7. Provides troubleshooting commands

## Why `--no-cache` is Critical

Docker caches build layers for performance. Without `--no-cache`:

```bash
# ❌ WRONG - Uses cached layers
docker-compose build

# Layer 1: FROM node:18-alpine        → CACHED (uses old)
# Layer 2: COPY shared ./shared       → CACHED (old shared)
# Layer 3: COPY backend/service .     → NEW (updated)
# Layer 4: RUN pnpm install           → CACHED (old dependencies!)
```

```bash
# ✅ CORRECT - Rebuilds everything
docker-compose build --no-cache

# Layer 1: FROM node:18-alpine        → FRESH (pulls latest)
# Layer 2: COPY shared ./shared       → FRESH (copies current shared)
# Layer 3: COPY backend/service .     → FRESH (copies current code)
# Layer 4: RUN pnpm install           → FRESH (installs from current package.json)
```

## Why Local Works But Server Fails

### Local Development:

- You run `docker-compose up` frequently
- Docker detects file changes and rebuilds automatically
- Even with cache, recent builds have correct structure
- Volume mounts work because image structure is current

### Production Server:

- CI/CD pulls code but **doesn't rebuild images**
- Containers restart with OLD images
- Volume mounts can't fix structural issues (node_modules)
- Only source code updates, not dependencies

## Understanding Volume Mounts vs Docker Images

### Volume Mounts (Hot Reload)

```yaml
volumes:
  - ./backend/shipment-service:/app # Source code - LIVE updates ✅
  - ./shared:/app/shared # Shared library - LIVE updates ✅
  - shipment_node_modules:/app/node_modules # Dependencies - PERSISTED ❌
```

**What updates live:**

- ✅ Source code changes (server.js, controllers, routes)
- ✅ Shared library changes (logger.js, response.js)

**What does NOT update live:**

- ❌ package.json dependencies (requires rebuild)
- ❌ Dockerfile changes (requires rebuild)
- ❌ Prisma schema changes (requires rebuild + migration)

### Docker Image Build

```dockerfile
RUN pnpm install  # Runs ONCE during build
RUN npx prisma generate  # Runs ONCE during build
```

These commands run during `docker-compose build`, NOT during container startup.

## Dependencies That Need Rebuild

After changing these files, you MUST rebuild images:

- ✅ `package.json` - New/updated dependencies
- ✅ `Dockerfile` - Build process changes
- ✅ `prisma/schema.prisma` - Database model changes
- ✅ `pnpm-lock.yaml` - Dependency lock changes

After changing these files, restart is enough:

- 🔄 `server.js` - Entry point code
- 🔄 `controllers/*.js` - Business logic
- 🔄 `routes/*.js` - API routes
- 🔄 `shared/lib/*.js` - Shared utilities

## Commit History (Context)

```
05b47f84 - feat: add comprehensive server deployment script
5ae8f0cb - fix: update all Dockerfiles with proper log directory permissions
1fc8d95f - fix: make cleanup script safe for multi-project servers
0eb65f7a - fix: logger permission errors across all services
```

The fixes are in the code since commit 0eb65f7a, but the server's Docker images predate this.

## Action Required

**Immediate**: Run rebuild on production server

```bash
# Option 1: Use deployment script (RECOMMENDED)
bash scripts/deploy-server.sh

# Option 2: Manual rebuild
docker-compose build --no-cache --pull && docker-compose --profile all-services up -d

# Option 3: Rebuild specific service only
docker-compose build --no-cache shipment-service && docker-compose up -d shipment-service
```

**Long-term**: Update CI/CD pipeline to rebuild images on code push

```yaml
# Example CI/CD step (adjust for your platform)
deploy:
  script:
    - git pull origin master
    - docker-compose build --no-cache --pull # ← Add this
    - docker-compose --profile all-services up -d
    - docker-compose ps
```

## Expected Result After Rebuild

```bash
$ docker-compose logs shipment-service --tail=20

logistics-shipment-service  | [nodemon] starting `node server.js`
logistics-shipment-service  | [2025-10-09T...] INFO [shipment-service] Enhanced console logger initialized
logistics-shipment-service  | [2025-10-09T...] INFO Database connected via Prisma
logistics-shipment-service  | [2025-10-09T...] INFO Redis connected
logistics-shipment-service  | [2025-10-09T...] INFO 🚀 Shipment Service running on port 3004

$ curl http://localhost:3004/health

{
  "status": "ok",
  "service": "shipment-service",
  "database": "connected",
  "redis": "connected",
  ...
}
```

## Summary

- ✅ **Code is correct** - All fixes are committed
- ✅ **Server has latest code** - git pull successful
- ❌ **Docker images are outdated** - Built before fixes
- 🔧 **Solution** - Rebuild images with `--no-cache` flag
- 📝 **Script provided** - `scripts/deploy-server.sh` automates this

---

**Created**: 2025-10-09
**Related Issues**: Logger permissions, missing axios, shared library imports
**Resolution**: Rebuild Docker images on production server
