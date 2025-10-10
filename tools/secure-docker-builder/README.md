# Logistics Secure Docker Builder

## Overview

A zero-source-code Docker image builder that creates secure, license-protected deployments for clients. All business logic is compiled to binary and obfuscated, ensuring complete protection of intellectual property.

## Features

- 🔒 **Binary Compilation** - JavaScript compiled to native binary using pkg
- 🛡️ **Code Obfuscation** - Advanced JavaScript obfuscation before compilation
- 🐳 **Single Docker Image** - Everything packaged in one deployable image
- 🔐 **License Enforcement** - Hardware-bound activation with heartbeat monitoring
- 🚀 **Automated Deployment** - Single command with interactive prompts
- 📦 **Service Selection** - Choose which microservices to include
- 🔄 **Registry Integration** - Push to private Docker registries

## Installation

```bash
cd tools/secure-docker-builder
npm install
```

## Usage

### Interactive Configuration

```bash
node src/cli.js generate-config
```

This will prompt for:
- Client ID (UUID)
- Client Name
- Services to include
- License Type (TRIAL/STANDARD/PROFESSIONAL/ENTERPRISE)
- Docker Registry URL
- License Server URL

### Build Secure Image

```bash
# With configuration file
node src/cli.js build --config build-config.json

# Interactive mode (default)
node src/cli.js build --interactive

# With specific output
node src/cli.js build --config config.json --output my-image:latest

# Skip registry push
node src/cli.js build --config config.json --no-push
```

### Push to Registry

```bash
node src/cli.js push <image> \
  --registry registry.example.com \
  --username admin \
  --password secret
```

### Test Run Locally

```bash
# Interactive mode
node src/cli.js run logistics/secure-platform:latest

# Detached mode
node src/cli.js run logistics/secure-platform:latest --detached
```

## Configuration File Format

```json
{
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "clientName": "ABC Corporation",
  "services": [
    "auth-service",
    "user-service",
    "api-gateway",
    "shipment-service",
    "partner-service"
  ],
  "licenseType": "STANDARD",
  "registry": "registry.logistics.io",
  "licenseServer": "api.logistics-license.com",
  "enableMonitoring": true,
  "secretKey": "auto-generated-if-not-provided",
  "tag": "abc-corp-v1",
  "outputImage": "logistics/secure-abc:v1",
  "push": true
}
```

## Build Process

1. **Prepare Build Directory**
   - Creates temporary build environment
   - Copies necessary files

2. **Compile Activation Binary**
   - Injects configuration into runtime-activator.js
   - Obfuscates JavaScript code
   - Compiles to native binary using pkg

3. **Create Orchestrator Image**
   - Alpine Linux base
   - Includes activation binary
   - Entrypoint script for activation flow

4. **Build Service Images**
   - Multi-stage Docker builds
   - Source code stripped
   - Production dependencies only
   - JavaScript minification

5. **Create Deployment Image**
   - Docker-in-Docker base
   - Orchestrator binary embedded
   - Single command deployment

## Security Features

### Code Protection
- JavaScript obfuscation with 20+ techniques
- Binary compilation removes source access
- Multi-stage builds strip development files
- Minification of all JavaScript code

### License Protection
- Hardware fingerprinting (MAC, CPU, hostname)
- HMAC-SHA256 signature verification
- Heartbeat monitoring (5-minute intervals)
- Auto-shutdown on license violation

### Runtime Security
- Encrypted environment variables
- Secure password generation
- Restricted file permissions (0600)
- Docker socket access control

## Client Deployment

The generated image can be deployed with a single command:

```bash
docker run -it \
  --name logistics-platform \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v logistics-data:/opt/logistics \
  -p 3000-3011:3000-3011 \
  --privileged \
  logistics/secure-platform:client-abc
```

The image will:
1. Prompt for license key
2. Validate with license server
3. Pull service images
4. Generate configuration
5. Start all services
6. Monitor with heartbeat

## File Structure

```
secure-docker-builder/
├── src/
│   ├── cli.js                 # CLI interface
│   ├── image-builder.js       # Docker image builder
│   └── runtime-activator.js   # Activation logic
├── package.json               # Dependencies
├── test-config.json          # Example configuration
└── README.md                 # This file
```

## Dependencies

- **commander** - CLI framework
- **inquirer** - Interactive prompts
- **javascript-obfuscator** - Code obfuscation
- **pkg** - Binary compilation
- **dockerode** - Docker API client
- **chalk** - Terminal styling
- **ora** - Loading spinners

## Environment Variables

During build:
- `BUILD_LICENSE_SERVER` - Injected into binary
- `BUILD_SECRET_KEY` - Injected into binary
- `BUILD_REGISTRY` - Injected into binary

At runtime (client-side):
- `LICENSE_KEY` - Set by activation
- `CLIENT_ID` - Set by activation
- `ACTIVATION_ID` - Set by activation

## Error Handling

Common errors and solutions:

### Build Errors
- **"Module not found"** - Run `npm install`
- **"Docker not found"** - Ensure Docker is installed
- **"Image build failed"** - Check Docker daemon is running

### Activation Errors
- **"Invalid license key"** - Check key format (128+ chars)
- **"License expired"** - Contact admin for renewal
- **"Max activations"** - Deactivate other instances

## Testing

Test the build process:
```bash
# Create test config
node src/cli.js generate-config -o test-config.json

# Build test image
node src/cli.js build --config test-config.json

# Run test deployment
node src/cli.js run logistics/secure-test:latest
```

## License

© 2025 Logistics Platform. Proprietary and confidential.

## Support

For issues or questions:
- Internal: devops@logistics.com
- Client: support@logistics.com

---

**Version**: 2.0.0
**Last Updated**: January 2025
**Status**: Production Ready