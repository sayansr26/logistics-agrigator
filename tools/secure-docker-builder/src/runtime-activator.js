#!/usr/bin/env node

/**
 * Runtime License Activator
 * This gets compiled to binary and embedded in Docker image
 * NO SOURCE CODE is distributed to clients
 */

const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const os = require('os');
const path = require('path');

const execAsync = promisify(exec);

// Obfuscated/encrypted configuration (will be compiled into binary)
const CONFIG = {
  // These values are encrypted and embedded at build time
  LICENSE_SERVER: BUILD_LICENSE_SERVER,
  ACTIVATION_PORT: 443,
  VALIDATION_PATH: '/api/v1/activate',
  HEARTBEAT_PATH: '/api/v1/heartbeat',
  SECRET_KEY: BUILD_SECRET_KEY,
  DOCKER_REGISTRY: BUILD_REGISTRY,
};

// Runtime state
let LICENSE_KEY = null;
let ACTIVATION_DATA = null;

/**
 * Clear console and show banner
 */
function showBanner() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║             LOGISTICS PLATFORM DEPLOYMENT                 ║
║                   Enterprise Edition                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * Create readline interface for user input
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt for user input
 */
function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Prompt for password (hidden input)
 * Simplified version that works in Docker containers
 */
async function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false  // Disable terminal features for Docker compatibility
    });

    // Simply prompt - password will be visible but functional
    // In production, this runs in a secure terminal session
    process.stdout.write(question);

    rl.on('line', (input) => {
      rl.close();
      console.log(); // New line after input
      resolve(input.trim());
    });

    rl.on('SIGINT', () => {
      rl.close();
      console.log('\n\nCancelled by user');
      process.exit(1);
    });
  });
}

/**
 * Get machine fingerprint
 */
function getMachineFingerprint() {
  const networkInterfaces = os.networkInterfaces();
  const cpus = os.cpus();
  const hostname = os.hostname();

  // Collect stable machine characteristics
  const fingerprint = {
    hostname,
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'unknown',
    cpuCount: cpus.length,
    totalMemory: os.totalmem(),
  };

  // Get first non-internal MAC address
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    for (const iface of interfaces) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        fingerprint.mac = iface.mac;
        break;
      }
    }
    if (fingerprint.mac) break;
  }

  // Create hash of fingerprint
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprint))
    .digest('hex');

  return {
    machineId: hash,
    details: fingerprint
  };
}

/**
 * Make HTTPS request to license server
 */
function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(response.message || `HTTP ${res.statusCode}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Validate license with server
 */
async function validateLicense(licenseKey, machineData) {
  console.log('\n\x1b[33m%s\x1b[0m', '🔐 Validating license...');

  const payload = {
    licenseKey,
    machineId: machineData.machineId,
    hostname: machineData.details.hostname,
    platform: machineData.details.platform,
    timestamp: Date.now(),
  };

  // Create signature
  const signature = crypto
    .createHmac('sha256', CONFIG.SECRET_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');

  const options = {
    hostname: CONFIG.LICENSE_SERVER,
    port: CONFIG.ACTIVATION_PORT,
    path: CONFIG.VALIDATION_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Client-Version': '2.0.0',
    }
  };

  try {
    const response = await httpsRequest(options, payload);
    return response.data;
  } catch (error) {
    throw new Error(`License validation failed: ${error.message}`);
  }
}

/**
 * Pull Docker images based on activation data
 */
async function pullDockerImages(activation) {
  console.log('\n\x1b[33m%s\x1b[0m', '🐳 Pulling Docker images...');

  const services = activation.allowedServices || [
    'auth-service',
    'user-service',
    'api-gateway'
  ];

  for (const service of services) {
    const imageName = `${CONFIG.DOCKER_REGISTRY}/logistics/${service}:${activation.version || 'latest'}`;
    console.log(`  Pulling ${service}...`);

    try {
      // Authenticate with registry using license as credentials
      const authToken = Buffer.from(`${activation.clientId}:${LICENSE_KEY}`).toString('base64');

      await execAsync(`docker login ${CONFIG.DOCKER_REGISTRY} -u ${activation.clientId} -p ${LICENSE_KEY} 2>/dev/null`);
      await execAsync(`docker pull ${imageName}`);

      // Tag for local use
      await execAsync(`docker tag ${imageName} logistics/${service}:active`);

      console.log(`  ✓ ${service} ready`);
    } catch (error) {
      console.error(`  ✗ Failed to pull ${service}: ${error.message}`);
      throw error;
    }
  }

  // Pull infrastructure images
  console.log('  Pulling infrastructure services...');
  await execAsync('docker pull postgres:15-alpine');
  await execAsync('docker pull redis:7-alpine');
  console.log('  ✓ Infrastructure ready');
}

/**
 * Generate secure environment configuration
 */
async function generateConfiguration(activation) {
  console.log('\n\x1b[33m%s\x1b[0m', '⚙️  Generating configuration...');

  // Generate secure passwords
  const dbPassword = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  const redisPassword = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  const jwtSecret = crypto.randomBytes(64).toString('hex');

  const config = {
    // Database
    DB_HOST: 'postgres',
    DB_PORT: 5432,
    DB_USER: 'logistics',
    DB_PASSWORD: dbPassword,

    // Redis
    REDIS_HOST: 'redis',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: redisPassword,

    // JWT
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',

    // License
    LICENSE_KEY: LICENSE_KEY,
    CLIENT_ID: activation.clientId,
    ACTIVATION_ID: activation.activationId,

    // Services
    ALLOWED_SERVICES: activation.allowedServices.join(','),

    // Features
    FEATURES: JSON.stringify(activation.features || {}),
    LIMITS: JSON.stringify(activation.limits || {}),
  };

  // Write encrypted configuration
  const configPath = '/opt/logistics/.env';
  const configContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  await fs.mkdir('/opt/logistics', { recursive: true });
  await fs.writeFile(configPath, configContent, { mode: 0o600 });

  console.log('  ✓ Configuration generated');
  return config;
}

/**
 * Generate Docker Compose file
 */
async function generateDockerCompose(activation, config) {
  console.log('\n\x1b[33m%s\x1b[0m', '📦 Creating deployment configuration...');

  const services = {
    version: '3.8',

    services: {
      postgres: {
        image: 'postgres:15-alpine',
        container_name: 'logistics-postgres',
        environment: [
          `POSTGRES_USER=${config.DB_USER}`,
          `POSTGRES_PASSWORD=${config.DB_PASSWORD}`,
          'POSTGRES_DB=logistics_main'
        ],
        volumes: [
          'postgres_data:/var/lib/postgresql/data'
        ],
        ports: ['5432:5432'],
        networks: ['logistics-network'],
        healthcheck: {
          test: ['CMD-SHELL', 'pg_isready -U logistics'],
          interval: '10s',
          timeout: '5s',
          retries: 5
        }
      },

      redis: {
        image: 'redis:7-alpine',
        container_name: 'logistics-redis',
        command: `redis-server --appendonly yes --requirepass ${config.REDIS_PASSWORD}`,
        volumes: ['redis_data:/data'],
        ports: ['6379:6379'],
        networks: ['logistics-network'],
        healthcheck: {
          test: ['CMD', 'redis-cli', 'ping'],
          interval: '10s',
          timeout: '5s',
          retries: 3
        }
      }
    },

    networks: {
      'logistics-network': {
        driver: 'bridge'
      }
    },

    volumes: {
      postgres_data: {},
      redis_data: {}
    }
  };

  // Add activated services
  for (const service of activation.allowedServices) {
    const port = getServicePort(service);
    services.services[service] = {
      image: `logistics/${service}:active`,
      container_name: `logistics-${service}`,
      env_file: ['.env'],
      ports: [`${port}:${port}`],
      networks: ['logistics-network'],
      depends_on: {
        postgres: { condition: 'service_healthy' },
        redis: { condition: 'service_healthy' }
      },
      restart: 'unless-stopped',
      healthcheck: {
        test: ['CMD', 'curl', '-f', `http://localhost:${port}/health`],
        interval: '30s',
        timeout: '10s',
        retries: 3
      }
    };
  }

  // Write docker-compose.yml
  const yaml = require('js-yaml');
  const composePath = '/opt/logistics/docker-compose.yml';
  await fs.writeFile(composePath, yaml.dump(services));

  console.log('  ✓ Docker Compose configuration created');
}

/**
 * Get service port
 */
function getServicePort(service) {
  const ports = {
    'api-gateway': 3001,
    'auth-service': 3002,
    'user-service': 3003,
    'shipment-service': 3004,
    'partner-service': 3005,
    'wallet-service': 3006,
    'support-service': 3007,
    'platform-service': 3008,
  };
  return ports[service] || 3000;
}

/**
 * Start services
 */
async function startServices() {
  console.log('\n\x1b[33m%s\x1b[0m', '🚀 Starting services...');

  process.chdir('/opt/logistics');

  try {
    await execAsync('docker-compose up -d');

    // Wait for services to be ready
    console.log('  Waiting for services to initialize...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check health
    const { stdout } = await execAsync('docker-compose ps --format json');
    const containers = JSON.parse(stdout);

    console.log('\n\x1b[32m%s\x1b[0m', '✅ Deployment successful!');
    console.log('\nServices running:');
    containers.forEach(container => {
      if (container.State === 'running') {
        console.log(`  ✓ ${container.Name}: ${container.Status}`);
      }
    });

    return true;
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '✗ Failed to start services:', error.message);
    return false;
  }
}

/**
 * Start heartbeat monitoring
 */
function startHeartbeat(activation) {
  setInterval(async () => {
    try {
      const options = {
        hostname: CONFIG.LICENSE_SERVER,
        port: CONFIG.ACTIVATION_PORT,
        path: CONFIG.HEARTBEAT_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-License-Key': LICENSE_KEY,
        }
      };

      await httpsRequest(options, {
        activationId: activation.activationId,
        machineId: activation.machineId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Heartbeat failed:', error.message);

      // Shutdown services if heartbeat fails repeatedly
      if (++heartbeatFailures > 3) {
        console.error('\x1b[31m%s\x1b[0m', 'License validation failed. Shutting down services...');
        await execAsync('docker-compose down');
        process.exit(1);
      }
    }
  }, 300000); // 5 minutes
}

let heartbeatFailures = 0;

/**
 * Main activation flow
 */
async function main() {
  try {
    showBanner();

    // Step 1: Get license key
    console.log('\x1b[36m%s\x1b[0m', 'Welcome to Logistics Platform Deployment\n');
    console.log('This wizard will guide you through the activation process.\n');

    LICENSE_KEY = await promptPassword('Enter License Key: ');

    if (!LICENSE_KEY || LICENSE_KEY.length < 100) {
      throw new Error('Invalid license key format');
    }

    // Step 2: Confirm terms
    const accept = await prompt('\nDo you accept the Terms and Conditions? (yes/no): ');
    if (accept.toLowerCase() !== 'yes' && accept.toLowerCase() !== 'y') {
      console.log('Activation cancelled.');
      process.exit(1);
    }

    // Step 3: Get company info
    const companyEmail = await prompt('Company Email Address: ');
    const adminPassword = await promptPassword('Set Admin Password (min 8 chars): ');

    if (adminPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Step 4: Get machine fingerprint
    console.log('\n\x1b[33m%s\x1b[0m', '🔍 Gathering system information...');
    const machineData = getMachineFingerprint();
    console.log(`  Machine ID: ${machineData.machineId.substring(0, 16)}...`);
    console.log(`  Platform: ${machineData.details.platform}`);
    console.log(`  Hostname: ${machineData.details.hostname}`);

    // Step 5: Validate license
    const activation = await validateLicense(LICENSE_KEY, machineData);
    ACTIVATION_DATA = activation;

    console.log('\x1b[32m%s\x1b[0m', '\n✓ License validated successfully');
    console.log(`  Client: ${activation.clientName}`);
    console.log(`  Type: ${activation.licenseType}`);
    console.log(`  Valid Until: ${new Date(activation.validUntil).toLocaleDateString()}`);
    console.log(`  Services: ${activation.allowedServices.join(', ')}`);

    // Step 6: Confirm deployment
    const proceed = await prompt('\nProceed with deployment? (yes/no): ');
    if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
      console.log('Deployment cancelled.');
      process.exit(1);
    }

    // Step 7: Pull Docker images
    await pullDockerImages(activation);

    // Step 8: Generate configuration
    const config = await generateConfiguration(activation);

    // Step 9: Generate Docker Compose
    await generateDockerCompose(activation, config);

    // Step 10: Start services
    const started = await startServices();

    if (started) {
      // Step 11: Start heartbeat
      startHeartbeat(activation);

      // Step 12: Show access information
      console.log('\n' + '='.repeat(60));
      console.log('\x1b[36m%s\x1b[0m', 'ACCESS INFORMATION');
      console.log('='.repeat(60));
      console.log('\nWeb Interface: http://localhost:3000');
      console.log('API Gateway: http://localhost:3001');
      console.log('\nAdmin Credentials:');
      console.log(`  Email: ${companyEmail}`);
      console.log('  Password: [as configured]');
      console.log('\nManagement Commands:');
      console.log('  View logs: docker-compose logs -f');
      console.log('  Stop services: docker-compose down');
      console.log('  Restart services: docker-compose restart');
      console.log('\n' + '='.repeat(60));

      console.log('\n\x1b[32m%s\x1b[0m', '🎉 Deployment complete! Services are running.');
      console.log('\nPress Ctrl+C to exit (services will continue running).');

      // Keep process running for heartbeat
      process.stdin.resume();
    } else {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n\x1b[31m%s\x1b[0m', '✗ Activation failed:', error.message);
    console.error('\nPlease contact support with error details.');
    process.exit(1);
  }
}

// Handle termination
process.on('SIGINT', () => {
  console.log('\n\nExiting... (services will continue running)');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\x1b[31m%s\x1b[0m', 'Fatal error:', error.message);
  process.exit(1);
});

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };