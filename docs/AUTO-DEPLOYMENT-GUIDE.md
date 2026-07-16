# Automatic Deployment Guide

## 🚀 How It Works

This project now has **fully automatic deployment** to production. Every push to `master` branch automatically deploys to the server.

---

## 📋 Deployment Flow

```
Push to master → GitLab Pipeline Triggers → SSH to Server →
Pull Latest Code → Check/Create .env → Install Dependencies →
Rebuild Docker Images → Stop Old Containers → Start Fresh Containers →
Run Migrations → Health Checks → ✅ Deployed
```

---

## ⚙️ What Happens Automatically

### 1. **Code Update**

- Fetches latest code from GitLab
- Resets to `origin/master` (hard reset)
- Cleans untracked files

### 2. **Environment Setup**

- Checks if `.env` file exists
- If not found:
  - Copies from `.env.example`
  - Runs `yarn setup:dev` for initial setup
- If found: continues deployment

### 3. **Dependencies**

- Installs/updates all dependencies with `yarn install`
- Uses frozen lockfile for consistency

### 4. **Docker Rebuild** (Complete Rebuild Every Time)

- Builds all images with `--no-cache` (no cache used)
- Pulls latest base images with `--pull`
- Ensures fresh builds every deployment

### 5. **Container Restart** (Full Cleanup)

- Stops all running containers
- Removes old containers
- Prunes unused images
- Prunes unused volumes
- Starts fresh containers from new images
- Waits 45 seconds for startup

### 6. **Database Migrations**

- Runs Prisma migrations for all services
- Applies new schema changes

### 7. **Health Checks**

- Verifies all services are running
- Checks API endpoints
- Auto-rollback if health checks fail

---

## 🔧 One-Time Server Setup

### Prerequisites

1. **Install Required Software on Server**

   ```bash
   ssh root@103.17.193.231

   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh

   # Install Docker Compose
   apt install docker-compose -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt install -y nodejs

   # Install yarn
   npm install -g yarn

   # Install Git
   apt install -y git
   ```

2. **Create Deployment User**

   ```bash
   adduser gitlab-runner
   usermod -aG docker gitlab-runner
   usermod -aG sudo gitlab-runner
   ```

3. **Setup Project Directory**

   ```bash
   mkdir -p /var/www/sub-solution
   chown -R gitlab-runner:gitlab-runner /var/www/sub-solution

   # Switch to gitlab-runner
   su - gitlab-runner
   cd /var/www

   # Clone repository
   git clone git@gitlab.com:YOUR_USERNAME/logistics-v2.git sub-solution
   cd sub-solution
   ```

4. **Setup Environment File**

   ```bash
   # Create .env file (or let first deployment create it)
   cp .env.example .env
   nano .env

   # Fill in:
   # - Database credentials
   # - Redis password
   # - JWT secret
   # - API keys
   ```

### GitLab Configuration

1. **Add CI/CD Variables** (Settings → CI/CD → Variables)

   | Variable          | Value                   | Protect | Mask |
   | ----------------- | ----------------------- | ------- | ---- |
   | `SSH_PRIVATE_KEY` | _(your private key)_    | ✅      | ✅   |
   | `SERVER_HOST`     | `103.17.193.231`        | ✅      | ❌   |
   | `SERVER_USER`     | `gitlab-runner`         | ✅      | ❌   |
   | `DEPLOY_PATH`     | `/var/www/sub-solution` | ✅      | ❌   |

2. **Add Deploy Key** (Settings → Repository → Deploy Keys)
   ```
   Title: Production Server
   Key: ssh-ed25519 AAAA... gitlab-deploy
   ✅ Grant write permissions
   ```

---

## 💡 Usage

### Deploy to Production

**Simple:** Just push to master!

```bash
git add .
git commit -m "feat: add new feature"
git push origin master
```

**That's it!** The deployment happens automatically.

### Monitor Deployment

1. Go to: **GitLab → CI/CD → Pipelines**
2. Watch the `deploy:production` job
3. See live deployment logs

### Check Deployment Status on Server

```bash
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution

# View latest deployment log
tail -f logs/deployment_*.log

# Check running containers
docker-compose ps

# View service logs
docker-compose logs -f auth-service

# Run health check
./scripts/health-check.sh
```

---

## 🔄 What Gets Rebuilt Every Time

✅ **All Docker Images** - Built from scratch with `--no-cache`
✅ **All Containers** - Stopped, removed, and recreated
✅ **Dependencies** - Reinstalled/updated with yarn
✅ **Database Schema** - Migrations applied

This ensures:

- Latest code is always running
- No stale containers or images
- Fresh environment every deployment
- Consistent builds

---

## 📊 Deployment Timeline

Typical deployment takes **5-10 minutes**:

1. ⏱️ **0:00-0:30** - Pipeline starts, SSH setup
2. ⏱️ **0:30-1:00** - Pull code, check environment
3. ⏱️ **1:00-2:00** - Install dependencies
4. ⏱️ **2:00-8:00** - Build Docker images (longest step)
5. ⏱️ **8:00-8:30** - Stop old containers
6. ⏱️ **8:30-9:00** - Start new containers
7. ⏱️ **9:00-9:45** - Wait for services to start
8. ⏱️ **9:45-10:00** - Health checks
9. ✅ **10:00** - Deployment complete!

---

## 🔍 Troubleshooting

### Deployment Failed?

1. **Check Pipeline Logs**
   - GitLab → CI/CD → Pipelines → Click failed job
   - Read error messages

2. **Check Server Logs**

   ```bash
   ssh gitlab-runner@103.17.193.231
   cd /var/www/sub-solution
   tail -100 logs/deployment_*.log
   ```

3. **Check Container Status**

   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

4. **Manual Health Check**
   ```bash
   ./scripts/health-check.sh
   ```

### Common Issues

**Issue: Docker build fails**

```bash
# Check Docker status
docker info

# Restart Docker
sudo systemctl restart docker

# Clean up
docker system prune -a -f
```

**Issue: Port already in use**

```bash
# Find what's using the port
sudo lsof -i :3001

# Stop all containers
docker-compose down

# Try deployment again
```

**Issue: Out of disk space**

```bash
# Check disk space
df -h

# Clean Docker
docker system prune -a --volumes -f

# Clean old backups
cd /var/www/sub-solution/backups
ls -t | tail -n +6 | xargs rm -rf
```

**Issue: Environment variables missing**

```bash
# Check .env file
cat /var/www/sub-solution/.env

# Edit if needed
nano /var/www/sub-solution/.env
```

---

## 🎯 Manual Operations

### Manual Deployment

If you need to deploy manually on the server:

```bash
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution
./scripts/deploy-production.sh
```

### Manual Rollback

```bash
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution
./scripts/rollback.sh
```

### View Logs

```bash
# Deployment logs
tail -f /var/www/sub-solution/logs/deployment_*.log

# Service logs
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
```

### Restart Specific Service

```bash
docker-compose restart auth-service
```

### Stop All Services

```bash
docker-compose down
```

### Start All Services

```bash
docker-compose up -d
```

---

## 📁 Important Files

| File                           | Purpose                             |
| ------------------------------ | ----------------------------------- |
| `.gitlab-ci.yml`               | CI/CD pipeline configuration        |
| `scripts/deploy-production.sh` | Main deployment script              |
| `scripts/health-check.sh`      | Health verification script          |
| `scripts/rollback.sh`          | Rollback script                     |
| `scripts/backup-database.sh`   | Database backup script              |
| `docker-compose.yml`           | Docker services configuration       |
| `.env`                         | Environment variables (server only) |

---

## 🔐 Security Notes

1. **Never commit `.env` to Git** - Contains secrets
2. **SSH keys are masked** - Not visible in GitLab logs
3. **Protected variables** - Only work on protected branches
4. **Limited server access** - Only `gitlab-runner` user
5. **Automatic backups** - Created before each deployment

---

## 📈 Benefits of This Setup

✅ **Fully Automatic** - No manual steps needed
✅ **Always Fresh** - Complete rebuild every time
✅ **Fast Feedback** - Know within 10 minutes if deployment worked
✅ **Easy Rollback** - One-click rollback in GitLab
✅ **Logged Everything** - Full deployment logs saved
✅ **Health Verified** - Auto-checks after deployment
✅ **No Downtime** - Services restart quickly

---

## 🚦 Deployment Best Practices

1. **Test Locally First**

   ```bash
   yarn run dev
   # Test your changes
   ```

2. **Use Feature Branches**

   ```bash
   git checkout -b feature/my-feature
   # Make changes
   git push origin feature/my-feature
   # Create MR to master
   ```

3. **Check Pipeline Before Merging**
   - Ensure tests pass
   - Review deployment logs

4. **Monitor After Deployment**
   - Check health status
   - Review logs for errors
   - Test API endpoints

5. **Keep Backups**
   - Backups are automatic
   - Stored in `/var/www/sub-solution/backups`
   - Last 10 backups retained

---

## 📞 Support

**Server Details:**

- IP: `103.17.193.231`
- User: `gitlab-runner`
- Path: `/var/www/sub-solution`

**Need Help?**

1. Check deployment logs
2. Run health check script
3. Review this guide
4. Contact DevOps team

---

**Last Updated:** 2025-01-08
**Deployment Method:** Automatic on push to master
**Server:** Production VPS (103.17.193.231)
