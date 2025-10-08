# GitLab CI/CD Quick Start Guide

## 🚀 Server Setup (One-Time)

### 1. Install Dependencies on Server

```bash
ssh root@103.17.193.231
# Password: Cool@@##2025

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Install Docker Compose, Node.js, PNPM, Git
apt install -y docker-compose
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git
npm install -g pnpm@8.15.1
```

### 2. Create Deployment User

```bash
adduser gitlab-runner
usermod -aG docker gitlab-runner
usermod -aG sudo gitlab-runner
su - gitlab-runner
```

### 3. Setup SSH Keys

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "gitlab-deploy" -f ~/.ssh/gitlab_deploy

# Copy public key (add to GitLab Deploy Keys)
cat ~/.ssh/gitlab_deploy.pub

# Copy private key (add to GitLab CI/CD Variables)
cat ~/.ssh/gitlab_deploy
```

### 4. Clone and Setup Project

```bash
sudo mkdir -p /var/www/sub-solution
sudo chown gitlab-runner:gitlab-runner /var/www/sub-solution
git clone git@gitlab.com:your-repo/logistics-main.git /var/www/sub-solution
cd /var/www/sub-solution

# Setup environment
cp .env.production.example .env.production
nano .env.production  # Edit with real credentials

# Make scripts executable
chmod +x scripts/*.sh

# Initial deployment
./scripts/deploy-production.sh
```

---

## ⚙️ GitLab Configuration (One-Time)

### 1. Add Deploy Key

- **GitLab** → Settings → Repository → Deploy Keys
- Add public key from `~/.ssh/gitlab_deploy.pub`
- ✅ Grant write permissions

### 2. Add CI/CD Variables

- **GitLab** → Settings → CI/CD → Variables

| Variable          | Value                   | Masked | Protected |
| ----------------- | ----------------------- | ------ | --------- |
| `SSH_PRIVATE_KEY` | Private key content     | ✅     | ✅        |
| `SERVER_HOST`     | `103.17.193.231`        | ❌     | ✅        |
| `SERVER_USER`     | `gitlab-runner`         | ❌     | ✅        |
| `DEPLOY_PATH`     | `/var/www/sub-solution` | ❌     | ✅        |

### 3. Protect Master Branch

- **GitLab** → Settings → Repository → Protected Branches
- Protect `master` branch

---

## 📦 Deploy to Production

### Automatic Deployment

1. Push to master branch:

   ```bash
   git push origin master
   ```

2. In GitLab, go to **CI/CD → Pipelines**

3. Click ▶️ (Play button) on `deploy:production` job

4. Monitor deployment in job logs

### Manual Deployment (On Server)

```bash
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution
./scripts/deploy-production.sh
```

---

## ⏪ Rollback

### Via GitLab

- **CI/CD → Pipelines** → Click ▶️ on `rollback:production`

### On Server

```bash
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution
./scripts/rollback.sh
```

---

## 🏥 Health Check

### Via GitLab

- **CI/CD → Pipelines** → Click ▶️ on `health:check`

### On Server

```bash
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution
./scripts/health-check.sh
```

---

## 🔧 Common Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f auth-service

# Restart specific service
docker-compose restart auth-service

# Stop all services
docker-compose down

# Start all services
docker-compose -f docker-compose.production.yml --profile all-services up -d

# Backup database
./scripts/backup-database.sh

# Check deployment logs
tail -f logs/deployment_*.log
```

---

## 🔐 Security Checklist

- [ ] Changed database password
- [ ] Changed Redis password
- [ ] Changed JWT secret (32+ characters)
- [ ] Setup firewall (UFW)
- [ ] Configured SSH keys (no password login)
- [ ] Added all external API credentials
- [ ] Enabled GitLab branch protection
- [ ] Configured CI/CD masked variables

---

## 📚 Full Documentation

Read **docs/deployment-guide.md** for complete instructions, troubleshooting, and maintenance procedures.

---

**Server**: 103.17.193.231
**Project Path**: `/var/www/sub-solution`
**User**: `gitlab-runner`
