# ACTUAL FIX - Named Volume Issue

## The Real Problem

After rebuild, the server STILL shows errors because:

### Docker Named Volumes Persist Old Data

In `docker-compose.yml`:

```yaml
volumes:
  - shipment_node_modules:/app/node_modules # ⚠️ NAMED VOLUME
```

**Named volumes PERSIST between rebuilds!**

When you run `docker-compose build --no-cache`:

- ✅ Image is rebuilt with new code
- ✅ New container is created
- ❌ **But the OLD node_modules volume is REUSED**

## Why Axios is Missing

The `shipment_node_modules` volume was created BEFORE axios was added to package.json.

**Timeline:**

1. Initial setup → Created volume → Installed packages (no axios)
2. You added axios to package.json → Committed code
3. Server pulled code → Rebuilt image
4. Container started → **REUSED OLD VOLUME without axios**

## Why Shared Library Breaks After Restart

When nodemon restarts due to file changes:

1. Container tries to reload modules
2. Finds old node_modules without proper dependencies
3. Module resolution fails

## The Solution

**DELETE the old named volume** and let Docker create a fresh one:

```bash
# Run this on the server
cd /v/w/sub-solution
bash scripts/fix-server-modules.sh
```

Or manually:

```bash
# Stop service
docker-compose stop shipment-service

# Remove container
docker-compose rm -f shipment-service

# Delete old volume (THIS IS THE KEY!)
docker volume rm logistics-main_shipment_node_modules

# Rebuild and start
docker-compose build --no-cache shipment-service
docker-compose up -d shipment-service
```

## Why rebuild Alone Didn't Fix It

```bash
# ❌ What you did before (didn't work)
docker-compose build --no-cache
docker-compose up -d

# The volume persisted:
shipment_node_modules → OLD node_modules without axios
```

```bash
# ✅ What you need to do (will work)
docker volume rm shipment_node_modules
docker-compose build --no-cache
docker-compose up -d

# Fresh volume will be created:
shipment_node_modules → NEW node_modules with axios
```

## Verification

After running the fix:

```bash
# Check if axios exists
docker-compose exec shipment-service ls -la node_modules/axios

# Should show:
drwxr-xr-x ... axios/

# Check if shared library works
docker-compose logs shipment-service --tail=20

# Should NOT show:
# ❌ Cannot find module 'axios'
# ❌ Cannot find module './shared/lib/logger'

# Should show:
# ✅ [INFO] Enhanced console logger initialized
# ✅ [INFO] Database connected via Prisma
# ✅ [INFO] 🚀 Shipment Service running on port 3004
```

## Understanding Named vs Bind Volumes

### Bind Mount (updates automatically):

```yaml
volumes:
  - ./backend/shipment-service:/app # Source code - LIVE updates
  - ./shared:/app/shared # Shared lib - LIVE updates
```

**Changes on host → Immediately visible in container**

### Named Volume (persists, doesn't auto-update):

```yaml
volumes:
  - shipment_node_modules:/app/node_modules # PERSISTED between rebuilds
```

**Must be manually deleted to get fresh dependencies**

## Why We Use Named Volumes for node_modules

Named volumes for node_modules are intentional because:

1. **Performance** - Faster than bind mounts on macOS/Windows
2. **Isolation** - Container's node_modules don't mix with host's
3. **Consistency** - Works across different host OS platforms

But the trade-off is: **You must delete them when dependencies change**

## When to Delete Volumes

Delete named volumes when you change:

- ✅ package.json (add/remove/update dependencies)
- ✅ pnpm-lock.yaml (lockfile changes)
- ✅ node version in Dockerfile
- ✅ Major refactoring that affects dependencies

You DON'T need to delete for:

- ❌ Source code changes (controllers, routes, services)
- ❌ Configuration changes (.env, server.js)
- ❌ Prisma schema changes (migrations handle this)

## CI/CD Fix

To prevent this in the future, update your CI/CD pipeline:

```yaml
deploy:
  script:
    - git pull origin master

    # Option 1: Prune old volumes (aggressive)
    - docker-compose down -v # -v flag removes volumes

    # Option 2: Remove specific volumes (safer)
    - docker volume rm $(docker volume ls -q --filter "name=shipment_node_modules")

    # Then rebuild
    - docker-compose build --no-cache
    - docker-compose --profile all-services up -d
```

## Summary

- ❌ **Your previous fix**: Rebuilt image (correct) but volume persisted (problem)
- ✅ **Actual fix**: Delete the named volume then rebuild
- 📝 **Root cause**: Named volumes persist between rebuilds by design
- 🛠️ **Solution**: Run `scripts/fix-server-modules.sh` on server

---

**Created**: 2025-10-09
**Issue**: Cannot find module 'axios' persists after rebuild
**Root Cause**: Named volume `shipment_node_modules` persisting old dependencies
**Resolution**: Delete volume before rebuild to force fresh npm install
