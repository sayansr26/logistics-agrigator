# Cleanup Commands Guide

This guide explains the safe cleanup commands for the Logistics Aggregator Portal, especially important when running on servers with multiple Docker projects.

## Table of Contents

1. [Overview](#overview)
2. [Safe Cleanup Commands](#safe-cleanup-commands)
3. [What Gets Cleaned](#what-gets-cleaned)
4. [Multi-Project Server Safety](#multi-project-server-safety)
5. [Examples](#examples)

---

## Overview

The cleanup scripts have been designed to be **multi-project server safe**. They will only clean Docker resources related to the Logistics project and will NOT affect other Docker containers, images, volumes, or networks on your server.

### Key Safety Features

✅ **Project-Specific Filtering** - Only targets resources with "logistics" in the name
✅ **Docker Compose Scope** - Uses docker-compose to clean only this project's resources
✅ **No System-Wide Prune** - Doesn't run dangerous `docker system prune -af`
✅ **Preserves Other Projects** - Won't touch containers/images from other projects

---

## Safe Cleanup Commands

### Standard Cleanup (Recommended)

**Linux/macOS:**

```bash
pnpm run cleanup
# or
./scripts/cleanup.sh
```

**Windows:**

```bash
pnpm run cleanup:win
# or
scripts\cleanup.bat
```

**What it does:**

- ✅ Removes all node_modules directories
- ✅ Removes all lock files (pnpm-lock.yaml, package-lock.json)
- ✅ Removes all build artifacts (.next, dist, build)
- ✅ Stops and removes logistics containers via docker-compose
- ✅ Cleans Docker build cache (safe, no layer deletion)
- ❌ Does NOT remove Docker images
- ❌ Does NOT remove Docker volumes
- ❌ Does NOT affect other projects

### Deep Cleanup (Use with Caution)

**Linux/macOS:**

```bash
pnpm run cleanup:deep
# or
./scripts/cleanup.sh --docker-deep-clean
```

**Windows:**

```bash
pnpm run cleanup:deep:win
# or
scripts\cleanup.bat --docker-deep-clean
```

**What it does (IN ADDITION to standard cleanup):**

- ✅ Removes Docker images with "logistics" in name
- ✅ Removes Docker volumes with "logistics" in name
- ✅ Removes Docker networks with "logistics" in name
- ✅ Removes dangling/unused images
- ❌ Does NOT remove other projects' resources

---

## What Gets Cleaned

### File System Cleanup (Both Standard & Deep)

| Item              | Pattern                                            | Description               |
| ----------------- | -------------------------------------------------- | ------------------------- |
| Dependencies      | `node_modules/`                                    | All npm/pnpm dependencies |
| Lock Files        | `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` | Package manager locks     |
| Build Artifacts   | `.next/`, `dist/`, `build/`                        | Compiled/built code       |
| Cache Directories | `.turbo/`                                          | Turbo cache               |
| Temporary Files   | `*.log`, `*.tmp`                                   | Log and temp files        |
| System Files      | `.DS_Store`, `Thumbs.db`                           | OS-specific files         |
| IDE Files         | `.eslintcache`                                     | Editor caches             |

### Docker Cleanup Comparison

| Resource Type            | Standard Cleanup     | Deep Cleanup            |
| ------------------------ | -------------------- | ----------------------- |
| **Logistics Containers** | ✅ Stopped & Removed | ✅ Stopped & Removed    |
| **Logistics Images**     | ❌ Kept              | ✅ Removed              |
| **Logistics Volumes**    | ❌ Kept              | ✅ Removed (with data!) |
| **Logistics Networks**   | ❌ Kept              | ✅ Removed              |
| **Build Cache**          | ✅ Cleaned           | ✅ Cleaned              |
| **Other Projects**       | ✅ Untouched         | ✅ Untouched            |

---

## Multi-Project Server Safety

### How We Ensure Safety

#### 1. Container Filtering

```bash
# Only stops containers with "logistics-" prefix
docker ps -q --filter "name=logistics-"
```

**Example:**

- ✅ Stops: `logistics-auth-service`, `logistics-postgres`, `logistics-redis`
- ❌ Ignores: `myapp-postgres`, `webapp-redis`, `cms-nginx`

#### 2. Image Filtering

```bash
# Only removes images with "logistics" in name
docker images --filter "reference=*logistics*" -q
```

**Example:**

- ✅ Removes: `logistics-shipment-service:latest`, `logistics-auth-service:dev`
- ❌ Keeps: `postgres:15`, `redis:7`, `nginx:latest`, `myapp-backend:latest`

#### 3. Volume Filtering

```bash
# Only removes volumes with "logistics" in name
docker volume ls --filter "name=logistics" -q
```

**Example:**

- ✅ Removes: `logistics_postgres_data`, `logistics_redis_data`
- ❌ Keeps: `myapp_db_data`, `cms_uploads`, `webapp_cache`

#### 4. Network Filtering

```bash
# Only removes networks with "logistics" in name
docker network ls --filter "name=logistics" -q
```

**Example:**

- ✅ Removes: `logistics_default`, `logistics_backend_network`
- ❌ Keeps: `myapp_network`, `bridge`, `host`

### Docker Compose Scoping

The scripts use `docker-compose down -v` which ONLY affects:

- Containers defined in this project's `docker-compose.yml`
- Networks created by this project
- Volumes defined in this project (when using `-v` flag)

**It will NEVER affect:**

- Containers from other projects
- System networks (bridge, host, none)
- Volumes from other projects

---

## Examples

### Scenario 1: Development Server with Multiple Projects

**Your Server Has:**

- Logistics Portal (this project)
- E-commerce Website
- CMS Application
- WordPress Blog

**Running `pnpm run cleanup:deep`:**

✅ **Cleaned (Logistics Only):**

```
logistics-auth-service     (stopped & removed)
logistics-postgres         (stopped & removed)
logistics-redis            (stopped & removed)
logistics-shipment-service (stopped & removed)
logistics_postgres_data    (volume removed)
logistics_redis_data       (volume removed)
```

✅ **Preserved (Other Projects):**

```
ecommerce-backend    (untouched)
ecommerce-postgres   (untouched)
cms-app              (untouched)
cms-mysql            (untouched)
wordpress            (untouched)
wordpress-db         (untouched)
```

### Scenario 2: CI/CD Server

**Before Cleanup:**

```
CONTAINER ID   IMAGE                          STATUS
abc123         logistics-auth-service         Up 2 hours
def456         logistics-postgres             Up 2 hours
ghi789         myapp-backend                  Up 5 days
jkl012         myapp-postgres                 Up 5 days
```

**After `pnpm run cleanup`:**

```
CONTAINER ID   IMAGE                          STATUS
ghi789         myapp-backend                  Up 5 days
jkl012         myapp-postgres                 Up 5 days

# logistics containers removed, myapp containers untouched ✅
```

### Scenario 3: Shared Development Server

**Team Members Working On:**

- Developer A: Logistics Portal
- Developer B: Mobile API
- Developer C: Analytics Dashboard

**Developer A runs `pnpm run cleanup:deep`:**

✅ **Result:**

- Only Logistics Portal resources cleaned
- Developer B's Mobile API containers keep running
- Developer C's Analytics Dashboard unaffected
- No conflicts or disruptions to other developers

---

## When to Use Each Command

### Use Standard Cleanup When:

- 🔄 Switching branches
- 🐛 Fixing dependency issues
- 🧹 Regular maintenance
- 🚀 Before fresh installation
- 📦 Updating packages

**Safe to use anytime** - doesn't remove images or data

### Use Deep Cleanup When:

- 💾 Freeing up disk space
- 🔨 Major refactoring
- 🏗️ Rebuilding everything from scratch
- 🗑️ Removing old/unused images
- 🐳 Docker storage issues

**⚠️ Warning:** Removes Docker volumes (data will be lost!)

### Never Needed:

- ❌ `docker system prune -af` - Too destructive!
- ❌ `docker stop $(docker ps -q)` - Stops ALL containers!
- ❌ `docker rm $(docker ps -aq)` - Removes ALL containers!
- ❌ `docker rmi $(docker images -q)` - Removes ALL images!

These commands are DANGEROUS on multi-project servers!

---

## Verification Commands

### Check What Will Be Affected

**Before running cleanup, verify:**

```bash
# List logistics containers
docker ps -a --filter "name=logistics-"

# List logistics images
docker images --filter "reference=*logistics*"

# List logistics volumes
docker volume ls --filter "name=logistics"

# List logistics networks
docker network ls --filter "name=logistics"
```

### After Cleanup Verification

```bash
# Verify logistics containers removed
docker ps -a --filter "name=logistics-"
# Should show: empty or only newly started containers

# Verify other projects untouched
docker ps -a | grep -v "logistics"
# Should show: all other project containers still running

# Check disk space freed
docker system df
```

---

## Troubleshooting

### Problem: "Permission Denied" on cleanup.sh

**Solution:**

```bash
chmod +x scripts/cleanup.sh
pnpm run cleanup
```

### Problem: Cleanup is too slow

**Cause:** Large node_modules directories

**Solution:** Use parallel cleanup (already implemented in scripts)

### Problem: Docker cleanup fails

**Check:**

1. Docker daemon is running: `docker ps`
2. You have permissions: `docker info`
3. No containers are locked: `docker ps -a`

### Problem: Other project containers stopped

**This should NEVER happen!**

If it does:

1. Check cleanup script filters (should have `--filter "name=logistics-"`)
2. Verify you're using the updated scripts
3. Report issue with details

---

## Best Practices

### For Development

1. **Use standard cleanup regularly** (safe, no data loss)

   ```bash
   pnpm run cleanup && pnpm run setup:dev
   ```

2. **Use deep cleanup sparingly** (removes data)

   ```bash
   # Only when absolutely needed
   pnpm run cleanup:deep
   ```

3. **Check before deep clean**
   ```bash
   # List what will be removed
   docker ps -a --filter "name=logistics-"
   docker volume ls --filter "name=logistics"
   ```

### For CI/CD

1. **Standard cleanup before builds**

   ```yaml
   - name: Cleanup
     run: pnpm run cleanup
   ```

2. **Deep cleanup weekly** (scheduled job)
   ```yaml
   - name: Deep Cleanup (Weekly)
     if: github.event.schedule == '0 0 * * 0'
     run: pnpm run cleanup:deep
   ```

### For Production Servers

1. **NEVER run cleanup:deep on production!**
   - Will delete database volumes
   - Will lose all data

2. **Use specific container restarts instead**

   ```bash
   docker-compose restart auth-service
   ```

3. **For maintenance, stop services properly**
   ```bash
   docker-compose down
   # Do maintenance
   docker-compose up -d
   ```

---

## Summary

### ✅ Safe Commands (Multi-Project Servers)

```bash
pnpm run cleanup              # Standard cleanup
pnpm run cleanup:deep         # Deep cleanup (logistics only)
docker-compose down           # Stop this project's containers
```

### ❌ Dangerous Commands (Avoid!)

```bash
docker system prune -af       # Removes ALL unused Docker resources
docker stop $(docker ps -q)   # Stops ALL running containers
docker rm $(docker ps -aq)    # Removes ALL containers
docker rmi $(docker images -q) # Removes ALL images
```

### 📋 Quick Reference

| Goal               | Command                                       | Safe for Multi-Project? |
| ------------------ | --------------------------------------------- | ----------------------- |
| Clean dependencies | `pnpm run cleanup`                            | ✅ Yes                  |
| Rebuild everything | `pnpm run cleanup:deep && pnpm run setup:dev` | ✅ Yes                  |
| Free disk space    | `pnpm run cleanup:deep`                       | ✅ Yes                  |
| Remove all Docker  | `docker system prune -af`                     | ❌ **NO!**              |

---

**Last Updated**: 2025-10-09
**Applies To**: All deployment environments
**Safety Level**: Multi-project server compatible ✅
