# GitLab CI/CD Testing Guide

## 🔐 Step 1: Configure GitLab Deploy Key

1. **Go to your GitLab project**
   - Navigate to: **Settings → Repository → Deploy Keys**

2. **Add Deploy Key**
   - Click **"Add new key"** or **"Expand"** under Deploy Keys
   - Fill in the form:

     ```
     Title: Production Server Deploy Key

     Key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJBFaUN5ehMdhINO+VYUcE3S94XLxFYTibwK+TrwSy53 gitlab-deploy

     ✅ Grant write permissions: CHECKED (Important!)
     ```

   - Click **"Add key"**

3. **Verify**
   - You should see the key listed under "Deploy keys enabled for this project"

---

## 🔧 Step 2: Configure GitLab CI/CD Variables

1. **Go to CI/CD Settings**
   - Navigate to: **Settings → CI/CD → Variables**
   - Click **"Expand"** under Variables section

2. **Add Required Variables** (Click "Add variable" for each)

### Variable 1: SSH_PRIVATE_KEY

```
Key: SSH_PRIVATE_KEY

Value:
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCQRWlDeXoTHYSDTvlWFHBN0veFy8RWE4m8Cvk68EsudwAAAJBIChs2SAob
NgAAAAtzc2gtZWQyNTUxOQAAACCQRWlDeXoTHYSDTvlWFHBN0veFy8RWE4m8Cvk68Esudw
AAAEBYCddE3HJyAhlvIs21nhYKDHaNJTEtuikI6yCc1dzwx5BFaUN5ehMdhINO+VYUcE3S
94XLxFYTibwK+TrwSy53AAAADWdpdGxhYi1kZXBsb3k=
-----END OPENSSH PRIVATE KEY-----

Type: Variable (not File)
Flags:
  ✅ Protect variable
  ✅ Mask variable
  ❌ Expand variable reference
```

### Variable 2: SERVER_HOST

```
Key: SERVER_HOST
Value: 103.17.193.231
Type: Variable
Flags:
  ✅ Protect variable
  ❌ Mask variable
  ❌ Expand variable reference
```

### Variable 3: SERVER_USER

```
Key: SERVER_USER
Value: gitlab-runner
Type: Variable
Flags:
  ✅ Protect variable
  ❌ Mask variable
  ❌ Expand variable reference
```

### Variable 4: DEPLOY_PATH

```
Key: DEPLOY_PATH
Value: /var/www/sub-solution
Type: Variable
Flags:
  ✅ Protect variable
  ❌ Mask variable
  ❌ Expand variable reference
```

### Variable 5: SERVER_PORT (Optional)

```
Key: SERVER_PORT
Value: 22
Type: Variable
Flags:
  ❌ Protect variable
  ❌ Mask variable
  ❌ Expand variable reference
```

3. **Verify All Variables Are Added**
   - You should see 4-5 variables listed
   - SSH_PRIVATE_KEY should show as masked (**\***)

---

## 🛡️ Step 3: Protect Master Branch (Recommended)

1. **Go to Protected Branches**
   - Navigate to: **Settings → Repository → Protected Branches**

2. **Protect master branch**
   - Branch: `master`
   - Allowed to merge: `Maintainers`
   - Allowed to push: `Maintainers`
   - Click **"Protect"**

---

## 🧪 Step 4: Test CI/CD Pipeline

### Option A: Test by Committing These Changes

1. **Commit all CI/CD files to your repository**

   ```bash
   git add .gitlab-ci.yml
   git add scripts/deploy-production.sh
   git add scripts/backup-database.sh
   git add scripts/rollback.sh
   git add scripts/health-check.sh
   git add docker-compose.production.yml
   git add .env.production.example
   git add docs/deployment-guide.md
   git add DEPLOYMENT-QUICKSTART.md

   git commit -m "feat: add GitLab CI/CD pipeline for automated deployment"

   git push origin master
   ```

2. **Watch Pipeline Execute**
   - Go to: **CI/CD → Pipelines** in GitLab
   - You should see a new pipeline running
   - Click on it to see the stages

### Option B: Test with Manual Pipeline Run

1. **Go to GitLab Pipelines**
   - Navigate to: **CI/CD → Pipelines**

2. **Run Pipeline**
   - Click **"Run pipeline"** button
   - Select branch: `master`
   - Click **"Run pipeline"**

3. **Monitor the Pipeline**
   - You'll see 3 stages: `test`, `build`, `deploy`
   - Test and build stages will run automatically
   - Deploy stage requires manual trigger (safety feature)

---

## ▶️ Step 5: Trigger Production Deployment

1. **In the Pipeline View**
   - Find the `deploy:production` job (it will show a play button ▶️)
   - Click the **▶️ Play button**

2. **Monitor Deployment**
   - Click on the running job to see live logs
   - You should see these steps:
     ```
     ✅ Installing OpenSSH client
     ✅ Setting up SSH
     ✅ Connecting to server
     ✅ Navigating to project directory
     ✅ Pulling latest code
     ✅ Running deployment script
     ✅ Deployment completed successfully
     ```

3. **Watch for Success Message**
   - The job should complete with green checkmark ✅
   - Look for: "✅ DEPLOYMENT COMPLETED SUCCESSFULLY"

---

## 🔍 Step 6: Verify Deployment on Server

1. **SSH to Server**

   ```bash
   ssh gitlab-runner@103.17.193.231
   ```

2. **Check Deployment Logs**

   ```bash
   cd /var/www/sub-solution

   # View latest deployment log
   ls -lt logs/deployment_*.log | head -1
   tail -f logs/deployment_$(ls -t logs/deployment_*.log | head -1 | cut -d'/' -f2)
   ```

3. **Check Docker Containers**

   ```bash
   docker-compose ps
   ```

   **Expected Output:**

   ```
   All containers should be "Up" status:
   - logistics-postgres
   - logistics-redis
   - logistics-api-gateway
   - logistics-auth-service
   - logistics-user-service
   - etc.
   ```

4. **Run Health Check**

   ```bash
   ./scripts/health-check.sh
   ```

   **Expected Output:**

   ```
   ✓ PostgreSQL: Running
   ✓ Redis: Running
   ✓ API Gateway: Healthy
   ✓ Auth Service: Healthy
   ... etc

   ✓ ALL SYSTEMS OPERATIONAL
   ```

5. **Test API Endpoints**

   ```bash
   # Test API Gateway
   curl http://localhost:3001/health

   # Test Auth Service
   curl http://localhost:3002/health

   # Test User Service
   curl http://localhost:3003/health
   ```

---

## 🧪 Testing Scenarios

### Test 1: Simple Code Change

1. **Make a small change**

   ```bash
   # On your local machine
   echo "# CI/CD Test" >> README.md
   git add README.md
   git commit -m "test: CI/CD pipeline test"
   git push origin master
   ```

2. **Trigger Deployment**
   - Go to GitLab → CI/CD → Pipelines
   - Click ▶️ on `deploy:production`

3. **Verify on Server**
   ```bash
   ssh gitlab-runner@103.17.193.231
   cd /var/www/sub-solution
   git log -1  # Should show your test commit
   ```

### Test 2: Rollback Functionality

1. **Trigger Rollback**
   - Go to: **CI/CD → Pipelines**
   - Find `rollback:production` job
   - Click ▶️ to trigger

2. **Monitor Rollback**
   - Watch the logs
   - Should see: "⏪ ROLLING BACK PRODUCTION DEPLOYMENT"

3. **Verify Rollback on Server**
   ```bash
   ssh gitlab-runner@103.17.193.231
   cd /var/www/sub-solution
   git log -3  # Check commit history
   ```

### Test 3: Health Check Job

1. **Run Health Check**
   - Go to: **CI/CD → Pipelines**
   - Click ▶️ on `health:check` job

2. **Review Results**
   - Should see health status of all services
   - ✅ All systems operational

---

## ❌ Troubleshooting

### Issue 1: SSH Permission Denied

**Error in logs:**

```
Permission denied (publickey)
```

**Solution:**

1. Verify SSH_PRIVATE_KEY variable is correctly set in GitLab
2. Ensure Deploy Key is added with **write permissions**
3. Check that the private key matches the public key on server

**Test SSH manually:**

```bash
# On server
cat ~/.ssh/authorized_keys
# Should contain the gitlab-deploy public key
```

### Issue 2: Project Directory Not Found

**Error in logs:**

```
cd: /var/www/sub-solution: No such file or directory
```

**Solution:**

```bash
# SSH to server
ssh root@103.17.193.231

# Create directory and set ownership
mkdir -p /var/www/sub-solution
chown -R gitlab-runner:gitlab-runner /var/www/sub-solution

# Clone repository (as gitlab-runner)
su - gitlab-runner
cd /var/www
git clone git@gitlab.com:YOUR_USERNAME/logistics-main.git sub-solution
```

### Issue 3: Docker Not Found

**Error in logs:**

```
docker: command not found
```

**Solution:**

```bash
# SSH to server as root
ssh root@103.17.193.231

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add gitlab-runner to docker group
usermod -aG docker gitlab-runner

# Verify
su - gitlab-runner
docker ps
```

### Issue 4: PNPM Not Found

**Error:**

```
pnpm: command not found
```

**Solution:**

```bash
# SSH to server
ssh gitlab-runner@103.17.193.231

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# Install PNPM
npm install -g pnpm@8.15.1

# Verify
pnpm --version
```

### Issue 5: Environment Variables Missing

**Error:**

```
Missing required environment variables
```

**Solution:**

```bash
# SSH to server
ssh gitlab-runner@103.17.193.231
cd /var/www/sub-solution

# Create production environment file
cp .env.production.example .env.production

# Edit with actual values
nano .env.production

# Fill in:
# - POSTGRES_PASSWORD
# - REDIS_PASSWORD
# - JWT_SECRET (generate with: openssl rand -hex 32)
# - All external API credentials
```

---

## ✅ Success Checklist

Before considering CI/CD setup complete, verify:

- [ ] Deploy Key added to GitLab with write permissions
- [ ] All 4 CI/CD variables configured (SSH_PRIVATE_KEY, SERVER_HOST, SERVER_USER, DEPLOY_PATH)
- [ ] Master branch protected (optional but recommended)
- [ ] Test pipeline runs successfully
- [ ] Manual deployment triggers and completes
- [ ] All Docker containers running on server
- [ ] Health check passes (all services responding)
- [ ] API endpoints accessible
- [ ] Deployment logs created in `/var/www/sub-solution/logs/`
- [ ] Database backup created in `/var/www/sub-solution/backups/`
- [ ] Rollback job tested and working
- [ ] `.env.production` file configured on server with real credentials

---

## 📊 Pipeline Stages Explained

### Stage 1: Test (Automatic)

- Runs linting checks
- Runs TypeScript type checking
- **Allows failures** - won't block deployment

### Stage 2: Build (Automatic)

- Validates build configuration
- **Allows failures** - for informational purposes

### Stage 3: Deploy (Manual Trigger)

- **deploy:production** - Deploys to production server
- **rollback:production** - Rolls back to previous version
- **health:check** - Runs health verification

---

## 🎯 Expected Deployment Flow

```
Developer commits → Push to master →
  ↓
GitLab CI/CD triggers →
  ↓
Test stage runs (lint, type-check) →
  ↓
Build stage runs (validation) →
  ↓
Deploy stage ready (manual trigger required) →
  ↓
Developer clicks ▶️ on deploy:production →
  ↓
GitLab connects to server via SSH →
  ↓
Server pulls latest code →
  ↓
Server runs deployment script:
  1. Creates database backup
  2. Updates dependencies
  3. Builds Docker images
  4. Runs migrations
  5. Restarts services
  6. Runs health checks
  ↓
Deployment succeeds ✅
  OR
Health checks fail → Auto rollback ⏪
```

---

## 📞 Support

If you encounter issues:

1. **Check deployment logs:**

   ```bash
   ssh gitlab-runner@103.17.193.231
   cd /var/www/sub-solution
   tail -f logs/deployment_*.log
   ```

2. **Check Docker logs:**

   ```bash
   docker-compose logs -f
   # Or specific service:
   docker-compose logs -f auth-service
   ```

3. **Run health check:**

   ```bash
   ./scripts/health-check.sh
   ```

4. **Check GitLab job logs:**
   - Go to: CI/CD → Pipelines → Click on failed job

---

**Server Details:**

- IP: 103.17.193.231
- User: gitlab-runner
- Path: /var/www/sub-solution
- SSH Port: 22

**Good luck with your deployment! 🚀**
