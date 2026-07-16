# 🔒 Secure Docker Deployment Guide

## Overview

The **Logistics Secure Docker Builder** is a zero-source-code distribution system that creates secure Docker images for client deployment. The system ensures:

- ✅ **No source code exposure** - All code is compiled to binary
- ✅ **Single command deployment** - One Docker command to run everything
- ✅ **Automated activation** - Interactive prompts guide the entire process
- ✅ **License enforcement** - Hardware-bound activation with heartbeat monitoring
- ✅ **Tamper-proof** - Binary compilation + JavaScript obfuscation

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  ADMIN SIDE                             │
├─────────────────────────────────────────────────────────┤
│  1. Generate License (via License Service)              │
│  2. Build Secure Docker Image (via CLI)                 │
│  3. Push to Private Registry                            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  CLIENT SIDE                            │
├─────────────────────────────────────────────────────────┤
│  Single Command:                                        │
│  docker run -it logistics/secure-platform:client-xyz    │
│                                                         │
│  Automated Flow:                                        │
│  1. Prompts for license key                            │
│  2. Validates with license server                       │
│  3. Pulls service images from registry                  │
│  4. Generates secure configuration                      │
│  5. Starts all services                                 │
│  6. Monitors with heartbeat                             │
└─────────────────────────────────────────────────────────┘
```

## Admin Guide

### Prerequisites

1. Docker 20.10+ installed
2. Node.js 18+ installed
3. License Service running (`yarn run dev:license`)
4. Private Docker registry configured

### Step 1: Generate License

#### Option A: Using Test Script (Easiest)

```bash
# Run the automated test script
cd backend/license-service
./test-license-api.sh
```

#### Option B: Manual API Calls

```bash
# Step 1a: Login to get admin token
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logistics.com",
    "password": "Admin@123456"
  }'

# Response will contain: { "data": { "accessToken": "..." } }
# Copy the accessToken value

# Step 1b: Generate license with admin token
curl -X POST http://localhost:3011/api/v1/licenses/generate \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN_HERE>" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "STANDARD",
    "plan": "MONTHLY",
    "allowedServices": ["auth-service", "user-service", "api-gateway", "shipment-service"],
    "maxActivations": 2,
    "validityDays": 30
  }'

# Save the returned license key for the client
```

**Note**: If you don't have an admin user, create one first:

```bash
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logistics.com",
    "password": "Admin@123456",
    "name": "Admin User",
    "role": "admin"
  }'
```

### Step 2: Build Secure Docker Image

#### Interactive Mode (Recommended)

```bash
# Run the secure build CLI
yarn run secure:generate-config

# Answer the prompts:
# - Client ID (UUID)
# - Client Name
# - Services to include
# - License Type
# - Registry URL
# - License Server URL

# Build the secure image
yarn run secure:build --config build-config.json
```

#### Programmatic Mode

```bash
# Create configuration file
cat > client-config.json << EOF
{
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "clientName": "ABC Corporation",
  "services": ["auth-service", "user-service", "api-gateway", "shipment-service"],
  "licenseType": "STANDARD",
  "registry": "registry.logistics.io",
  "licenseServer": "api.logistics-license.com",
  "enableMonitoring": false,
  "secretKey": "your-secret-key-here",
  "tag": "abc-corp-v1",
  "outputImage": "logistics/secure-abc:v1",
  "push": true
}
EOF

# Build the image
yarn run secure:build --config client-config.json
```

### Step 3: Push to Registry

```bash
# Push to configured registry
yarn run secure:push logistics/secure-abc:v1 \
  --registry registry.logistics.io \
  --username admin \
  --password <registry-password>
```

### Step 4: Provide to Client

Share with the client:

1. The Docker image name: `registry.logistics.io/logistics/secure-abc:v1`
2. The license key generated in Step 1
3. The deployment instructions (see Client Guide below)

## Client Guide

### Prerequisites

- Docker 20.10+ installed
- 8GB RAM minimum
- 50GB disk space
- Internet connection for activation
- Ports 3000-3011 available

### Deployment Instructions

#### Step 1: Run the Docker Image

```bash
docker run -it \
  --name logistics-platform \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v logistics-data:/opt/logistics \
  -p 3000-3011:3000-3011 \
  --privileged \
  registry.logistics.io/logistics/secure-abc:v1
```

#### Step 2: Follow Activation Prompts

The system will automatically prompt for:

```
╔═══════════════════════════════════════════════════════════╗
║             LOGISTICS PLATFORM DEPLOYMENT                 ║
║                   Enterprise Edition                      ║
╚═══════════════════════════════════════════════════════════╝

Welcome to Logistics Platform Deployment

Enter License Key: **************
Do you accept the Terms and Conditions? (yes/no): yes
Company Email Address: admin@company.com
Set Admin Password (min 8 chars): ********

🔍 Gathering system information...
  Machine ID: a1b2c3d4e5f67890...
  Platform: linux
  Hostname: client-server

🔐 Validating license...
✓ License validated successfully
  Client: ABC Corporation
  Type: STANDARD
  Valid Until: 2025-02-10
  Services: auth-service, user-service, api-gateway, shipment-service

Proceed with deployment? (yes/no): yes

🐳 Pulling Docker images...
  Pulling auth-service... ✓
  Pulling user-service... ✓
  Pulling api-gateway... ✓
  Pulling shipment-service... ✓
  Pulling infrastructure services... ✓

⚙️  Generating configuration... ✓
📦 Creating deployment configuration... ✓
🚀 Starting services... ✓

✅ Deployment successful!

═══════════════════════════════════════════════════════════
ACCESS INFORMATION
═══════════════════════════════════════════════════════════

Web Interface: http://localhost:3000
API Gateway: http://localhost:3001

Admin Credentials:
  Email: admin@company.com
  Password: [as configured]

Management Commands:
  View logs: docker-compose logs -f
  Stop services: docker-compose down
  Restart services: docker-compose restart

🎉 Deployment complete! Services are running.
```

### Management Commands

```bash
# View service status
docker ps

# View logs
docker logs logistics-platform

# Stop platform
docker stop logistics-platform

# Restart platform
docker start logistics-platform

# Remove platform (WARNING: Deletes all data)
docker rm -f logistics-platform
docker volume rm logistics-data
```

### Troubleshooting

#### License Issues

- Ensure license key is valid and not expired
- Check internet connectivity to license server
- Verify system time is correct

#### Port Conflicts

```bash
# Check if ports are available
netstat -tuln | grep 300

# Use different ports if needed
docker run -it \
  -p 4000-4011:3000-3011 \
  [other options...]
```

#### Docker Issues

```bash
# Check Docker version
docker --version

# Verify Docker daemon is running
docker info

# Check Docker socket permissions
ls -la /var/run/docker.sock
```

## Security Features

### 1. Binary Compilation

- JavaScript code compiled to binary using `pkg`
- Platform-specific binaries (linux-x64, linux-arm64)
- No source code visible even with container inspection

### 2. JavaScript Obfuscation

```javascript
// Before obfuscation
const validateLicense = (key) => {
  return key.length === 128;
}

// After obfuscation
const _0x4a3b=['length'];(function(_0x2d8f05,_0x4a3b12){
const _0x529e49=function(_0x3a4f86){while(--_0x3a4f86){
_0x2d8f05['push'](_0x2d8f05['shift']());}};_0x529e49(++_0x4a3b12);
}(_0x4a3b,0x1a7));const _0x529e=function(_0x2d8f05,_0x4a3b12){
```

### 3. Hardware Binding

- Machine fingerprint includes:
  - MAC address
  - CPU model and count
  - Hostname
  - Platform and architecture
- Activation locked to specific hardware

### 4. Heartbeat Monitoring

- Every 5 minutes, validates license status
- Auto-shutdown if:
  - License expired
  - Maximum activations exceeded
  - License revoked
  - Network connectivity lost (after 3 failures)

### 5. Encrypted Configuration

- Secure passwords generated at runtime
- Environment variables encrypted in memory
- Configuration files with restrictive permissions (0600)

## Advanced Configuration

### Custom Docker Registry

```javascript
// In build configuration
{
  "registry": "your-registry.com:5000",
  "registryAuth": {
    "username": "client-id",
    "password": "license-key"
  }
}
```

### Service Limits

```javascript
// License configuration
{
  "limits": {
    "maxShipments": 10000,
    "maxUsers": 50,
    "maxApiCalls": 100000
  }
}
```

### Feature Flags

```javascript
// License configuration
{
  "features": {
    "bulkOperations": true,
    "advancedAnalytics": false,
    "multiTenant": true
  }
}
```

## CLI Commands Reference

### Build Commands

```bash
# Generate configuration interactively
yarn run secure:generate-config

# Build secure image
yarn run secure:build --config <config-file>
yarn run secure:build --interactive

# Build with custom options
yarn run secure:build \
  --config config.json \
  --output my-image:latest \
  --registry my-registry.com \
  --no-push
```

### Push Commands

```bash
# Push to registry
yarn run secure:push <image> \
  --registry <url> \
  --username <user> \
  --password <pass>
```

### Test Commands

```bash
# Test run locally
yarn run secure:run <image>
yarn run secure:run <image> --detached
```

## File Structure

```
tools/secure-docker-builder/
├── src/
│   ├── cli.js                 # CLI interface
│   ├── image-builder.js       # Docker image builder
│   └── runtime-activator.js   # Activation logic (compiled to binary)
├── package.json               # Dependencies
└── test-config.json          # Example configuration
```

## API Integration

### License Validation Endpoint

```
POST /api/v1/activate
Headers:
  Content-Type: application/json
  X-Signature: HMAC-SHA256 signature
Body:
  {
    "licenseKey": "...",
    "machineId": "...",
    "hostname": "...",
    "platform": "..."
  }
Response:
  {
    "activationId": "...",
    "clientName": "...",
    "allowedServices": [...],
    "validUntil": "..."
  }
```

### Heartbeat Endpoint

```
POST /api/v1/heartbeat
Headers:
  X-License-Key: ...
Body:
  {
    "activationId": "...",
    "machineId": "...",
    "timestamp": ...
  }
```

## Monitoring & Analytics

### Admin Dashboard Views

- Active licenses
- Activation history
- Usage metrics
- Revenue tracking
- Expiry alerts

### Client Metrics

- Service uptime
- API call counts
- Resource usage
- Error rates
- Performance metrics

## Support

### Common Issues

1. **"License validation failed"**
   - Check license key format
   - Verify network connectivity
   - Ensure license hasn't expired

2. **"Failed to pull Docker images"**
   - Check registry credentials
   - Verify network access to registry
   - Ensure Docker daemon is running

3. **"Port already in use"**
   - Change port mapping in docker run command
   - Stop conflicting services

4. **"Insufficient permissions"**
   - Run with --privileged flag
   - Check Docker socket permissions
   - Verify user is in docker group

### Contact Support

- Documentation: [docs.logistics.com](https://docs.logistics.com)
- Email: support@logistics.com
- Include: Client ID, error logs, system info

## Version History

- **v2.0.0** (Current) - Secure Docker builder with binary compilation
- **v1.0.0** (Deprecated) - Manual activation with JavaScript files

## License

© 2025 Logistics Platform. All rights reserved.

---

**Last Updated**: January 2025
**Status**: Production Ready
**Security Level**: Enterprise
