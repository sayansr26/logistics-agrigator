# GitLab CI/CD Deployment Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Server Setup](#initial-server-setup)
4. [GitLab Configuration](#gitlab-configuration)
5. [First Deployment](#first-deployment)
6. [Ongoing Deployments](#ongoing-deployments)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Overview

This guide covers the complete setup and usage of the GitLab CI/CD pipeline for automatic deployment to the production server.

### Deployment Flow

```
Developer Push → GitLab CI/CD → SSH to Server → Pull Code →
Backup DB → Rebuild Images → Migrate DB → Restart Services → Health Check
```

### Server Details

- **IP Address**: 103.17.193.231
- **Project Directory**: `/var/www/sub-solution`
- **OS**: Ubuntu VPS

---

## Prerequisites

### Required Tools

- Git
- GitLab account with repository access
- SSH access to production server

### Required Knowledge

- Basic Linux command line
- Docker and Docker Compose
- Git basics

---

## Initial Server Setup

### Step 1: Connect to Server

```bash
ssh root@103.17.193.231
# Password: Cool@@##2025
```

### Step 2: Install Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PNPM
npm install -g pnpm@8.15.1

# Install Git
apt install -y git

# Verify installations
docker --version
docker-compose --version
node --version
pnpm --version
git --version
```

### Step 3: Create Deployment User (Recommended)

```bash
# Create gitlab-runner user
adduser gitlab-runner

# Add to docker group
usermod -aG docker gitlab-runner

# Grant sudo privileges
usermod -aG sudo gitlab-runner

# Switch to gitlab-runner user
su - gitlab-runner
```

### Step 4: Setup SSH Keys

```bash
# Generate SSH key pair (on server as gitlab-runner user)
ssh-keygen -t ed25519 -C "gitlab-deploy@logistics-portal" -f ~/.ssh/gitlab_deploy

# Display public key (copy this)
cat ~/.ssh/gitlab_deploy.pub

# Display private key (use in GitLab CI/CD variables)
cat ~/.ssh/gitlab_deploy
```

### Step 5: Configure Git for Server

```bash
# Configure Git
git config --global user.name "GitLab CI/CD"
git config --global user.email "cicd@yourdomain.com"

# Add GitLab to known hosts
ssh-keyscan -H gitlab.com >> ~/.ssh/known_hosts
```

### Step 6: Clone Repository

```bash
# Create project directory
sudo mkdir -p /var/www/sub-solution
sudo chown gitlab-runner:gitlab-runner /var/www/sub-solution

# Clone repository
cd /var/www
git clone git@gitlab.com:your-username/logistics-main.git sub-solution

cd sub-solution
```

### Step 7: Setup Production Environment

```bash
# Copy and configure production environment
cp .env.production.example .env.production

# Edit with actual credentials
nano .env.production

# Important: Fill in:
# - POSTGRES_PASSWORD
# - REDIS_PASSWORD
# - JWT_SECRET
# - All external API credentials
```

### Step 8: Initial Deployment

```bash
# Install dependencies
pnpm install

# Make scripts executable
chmod +x scripts/*.sh

# Run initial setup (if needed)
./scripts/setup.sh

# Start services
docker-compose -f docker-compose.production.yml --profile all-services up -d

# Check status
docker-compose ps

# Run health check
./scripts/health-check.sh
```

---

## GitLab Configuration

### Step 1: Add Deploy Key to GitLab

1. Go to your GitLab project
2. Navigate to **Settings → Repository → Deploy Keys**
3. Add a new deploy key:
   - **Title**: Production Server
   - **Key**: Paste the public key from `~/.ssh/gitlab_deploy.pub`
   - ✅ Check "Grant write permissions" (for pulling)
   - Click "Add key"

### Step 2: Configure CI/CD Variables

1. Go to **Settings → CI/CD → Variables**
2. Add the following variables:

| Variable          | Value                             | Type     | Masked | Protected |
| ----------------- | --------------------------------- | -------- | ------ | --------- |
| `SSH_PRIVATE_KEY` | Content of `~/.ssh/gitlab_deploy` | File     | ✅     | ✅        |
| `SERVER_HOST`     | `103.17.193.231`                  | Variable | ❌     | ✅        |
| `SERVER_USER`     | `gitlab-runner`                   | Variable | ❌     | ✅        |
| `SERVER_PORT`     | `22`                              | Variable | ❌     | ✅        |
| `DEPLOY_PATH`     | `/var/www/sub-solution`           | Variable | ❌     | ✅        |

**Optional (for notifications):**

- `SLACK_WEBHOOK` - Slack webhook URL
- `DISCORD_WEBHOOK` - Discord webhook URL

### Step 3: Protect Master Branch

1. Go to **Settings → Repository → Protected Branches**
2. Protect `master` branch:
   - **Allowed to merge**: Maintainers
   - **Allowed to push**: Maintainers
   - ✅ Require approval
   - ✅ Enable merge request

---

## First Deployment

### Manual Trigger (Recommended for First Time)

1. Go to **CI/CD → Pipelines** in GitLab
2. Click **Run Pipeline**
3. Select branch: `master`
4. Click **Run pipeline**
5. In the pipeline view, find `deploy:production` job
6. Click ▶️ (Play button) to trigger manual deployment

### Monitoring Deployment

1. Click on the running job to see live logs
2. Watch for each deployment step:
   - ✅ SSH connection
   - ✅ Code pull
   - ✅ Database backup
   - ✅ Docker image build
   - ✅ Database migrations
   - ✅ Service restart
   - ✅ Health checks

### Verify Deployment

After deployment completes:

```bash
# SSH to server
ssh gitlab-runner@103.17.193.231

# Check deployment log
cd /var/www/sub-solution
tail -f logs/deployment_*.log

# Check service status
docker-compose ps

# Run health check
./scripts/health-check.sh

# Check API endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
```

---

## Ongoing Deployments

### Automatic Deployment Workflow

1. **Develop and test locally**

   ```bash
   git checkout -b feature/new-feature
   # Make changes
   pnpm run dev
   # Test locally
   ```

2. **Commit and push**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

3. **Create Merge Request**
   - Go to GitLab
   - Create MR from `feature/new-feature` to `master`
   - CI/CD runs tests automatically

4. **Review and Merge**
   - Code review
   - Approve and merge to `master`

5. **Deploy to Production**
   - Pipeline triggers automatically on master
   - Go to **CI/CD → Pipelines**
   - Click ▶️ on `deploy:production` job
   - Monitor deployment

### Quick Deploy from Command Line

```bash
# On your local machine
git checkout master
git pull origin master
git push origin master

# Then trigger deployment in GitLab UI
```

---

## Rollback Procedures

### Automatic Rollback

If deployment fails health checks, automatic rollback occurs.

### Manual Rollback via GitLab

1. Go to **CI/CD → Pipelines**
2. Find the latest pipeline
3. Click ▶️ on `rollback:production` job
4. Monitor rollback process

### Manual Rollback on Server

```bash
# SSH to server
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution

# Run rollback script
./scripts/rollback.sh

# Verify
./scripts/health-check.sh
```

### Rollback to Specific Commit

```bash
# SSH to server
cd /var/www/sub-solution

# Stop services
docker-compose down

# Checkout specific commit
git checkout <commit-hash>

# Rebuild and restart
./scripts/deploy-production.sh
```

---

## Troubleshooting

### Issue: SSH Connection Failed

**Error**: `Permission denied (publickey)`

**Solution**:

```bash
# On server, verify SSH key
cat ~/.ssh/gitlab_deploy.pub

# On GitLab, verify Deploy Key is added
# Settings → Repository → Deploy Keys

# Test SSH connection
ssh -T git@gitlab.com
```

### Issue: Docker Build Failed

**Error**: `docker: command not found` or build errors

**Solution**:

```bash
# Check Docker installation
docker --version

# Restart Docker
sudo systemctl restart docker

# Check Docker logs
sudo journalctl -u docker

# Rebuild manually
cd /var/www/microloan
docker-compose build --no-cache
```

### Issue: Database Migration Failed

**Error**: Migration errors during deployment

**Solution**:

```bash
# SSH to server
cd /var/www/sub-solution

# Check PostgreSQL
docker-compose ps postgres

# Manual migration
docker-compose exec auth-service pnpm run migrate:deploy

# Check migration status
docker-compose exec auth-service npx prisma migrate status
```

### Issue: Service Health Check Failed

**Error**: Health checks failing after deployment

**Solution**:

```bash
# Check service logs
docker-compose logs -f auth-service

# Check specific service health
curl http://localhost:3002/health

# Restart specific service
docker-compose restart auth-service

# Check container status
docker ps -a

# Check container resources
docker stats
```

### Issue: Port Already in Use

**Error**: `Bind for 0.0.0.0:3001 failed: port is already allocated`

**Solution**:

```bash
# Find process using port
sudo lsof -i :3001

# Kill process if needed
sudo kill -9 <PID>

# Or stop all services and restart
docker-compose down
docker-compose up -d
```

### Issue: Disk Space Full

**Error**: `no space left on device`

**Solution**:

```bash
# Check disk space
df -h

# Clean Docker
docker system prune -a --volumes

# Clean old backups
cd /var/www/microloan/backups
ls -lt | tail -n +11 | xargs rm -rf

# Clean logs
find /var/www/microloan/logs -name "*.log" -mtime +30 -delete
```

---

## Maintenance

### Regular Tasks

#### Daily

- Monitor service health
- Check application logs

#### Weekly

- Review deployment logs
- Check disk space
- Review database backups

#### Monthly

- Update system packages
- Rotate secrets (if needed)
- Clean old Docker images
- Review and optimize resources

### Maintenance Commands

```bash
# SSH to server
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Check disk space
df -h
du -sh backups/

# Backup database manually
./scripts/backup-database.sh

# Health check
./scripts/health-check.sh

# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean Docker
docker system prune -f

# Clean old backups (keep last 10)
cd backups/database
ls -t | tail -n +11 | xargs rm -f
```

### Security Maintenance

```bash
# Update secrets regularly (every 90 days)
nano .env.production

# Rotate JWT secret
openssl rand -hex 32

# Update GitLab CI/CD variables with new secrets

# Restart services after secret rotation
docker-compose restart
```

### Performance Monitoring

```bash
# Check resource usage
docker stats

# Check database size
docker-compose exec postgres psql -U logistics -c "SELECT pg_size_pretty(pg_database_size('logistics_main'));"

# Check Redis memory
docker-compose exec redis redis-cli INFO memory

# Check application metrics
curl http://localhost:3001/health | jq .
```

---

## Advanced Topics

### Blue-Green Deployment (Future)

For zero-downtime deployments, consider setting up:

- Two identical environments (blue and green)
- Load balancer to switch traffic
- Automated testing before switch

### Monitoring and Alerting

Consider integrating:

- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Sentry** - Error tracking
- **Uptime monitoring** - Health check monitoring

### Backup Strategy

Current strategy:

- Database: Automatic backup before deployment
- Retention: Last 10 backups
- Location: `/var/www/sub-solution/backups`

Recommended improvements:

- Off-site backups (S3, backup server)
- Automated backup schedule (cron)
- Disaster recovery plan

---

## Support and Documentation

### Related Documentation

- [README.md](../README.md) - Project overview
- [CLAUDE.md](../CLAUDE.md) - Development guide
- [SystemArchitecture.md](./SystemArchitecture.md) - Architecture details

### Getting Help

1. Check logs first: `docker-compose logs -f`
2. Run health check: `./scripts/health-check.sh`
3. Review deployment logs in `/var/www/sub-solution/logs/`
4. Contact DevOps team or repository maintainers

---

## Changelog

### Version 1.0.0 (2025-01-08)

- Initial CI/CD setup
- Automated deployment pipeline
- Health checks and rollback procedures
- Complete documentation

---

**Last Updated**: 2025-01-08
**Maintained By**: DevOps Team
**Server**: 103.17.193.231 (Ubuntu VPS)
