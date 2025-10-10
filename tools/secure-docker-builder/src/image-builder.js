#!/usr/bin/env node

/**
 * Secure Docker Image Builder
 * Creates a single Docker image with embedded activation logic
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const JavaScriptObfuscator = require('javascript-obfuscator');
const ora = require('ora');
const chalk = require('chalk');

const execAsync = promisify(exec);

class SecureImageBuilder {
  constructor(config) {
    this.config = config;
    this.buildDir = path.join(process.cwd(), '.build-temp');
    this.outputDir = path.join(process.cwd(), 'secure-images');
  }

  /**
   * Build secure Docker image
   */
  async build() {
    const spinner = ora('Building secure Docker image...').start();

    try {
      // Step 1: Prepare build directory
      spinner.text = 'Preparing build environment...';
      await this.prepareBuildDirectory();

      // Step 2: Compile activation binary
      spinner.text = 'Compiling activation binary...';
      await this.compileActivationBinary();

      // Step 3: Create orchestrator image
      spinner.text = 'Creating orchestrator image...';
      await this.createOrchestratorImage();

      // Step 4: Build service images
      spinner.text = 'Building service images...';
      await this.buildServiceImages();

      // Step 5: Create deployment image
      spinner.text = 'Creating deployment image...';
      await this.createDeploymentImage();

      // Step 6: Don't clean up yet - needed for multi-platform build
      // Cleanup will happen after push in cli.js

      spinner.succeed(chalk.green('Secure Docker image built successfully!'));

      return {
        imageName: this.config.outputImage || `logistics/secure-platform:${this.config.tag || 'latest'}`,
        registry: this.config.registry,
        size: await this.getImageSize(),
        buildDir: this.buildDir  // Return build directory for multi-platform rebuild
      };

    } catch (error) {
      spinner.fail(chalk.red('Build failed'));
      throw error;
    }
  }

  /**
   * Prepare build directory
   */
  async prepareBuildDirectory() {
    await fs.rm(this.buildDir, { recursive: true, force: true });
    await fs.mkdir(this.buildDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  /**
   * Compile activation binary
   */
  async compileActivationBinary() {
    // First, obfuscate the JavaScript
    const sourceCode = await fs.readFile(
      path.join(__dirname, 'runtime-activator.js'),
      'utf8'
    );

    // Inject configuration - properly escape strings for JavaScript
    const configuredCode = sourceCode.replace(
      /BUILD_LICENSE_SERVER/g,
      `'${this.config.licenseServer || 'api.logistics-license.com'}'`
    ).replace(
      /BUILD_SECRET_KEY/g,
      `'${this.config.secretKey || crypto.randomBytes(32).toString('hex')}'`
    ).replace(
      /BUILD_REGISTRY/g,
      `'${this.config.registry || 'registry.logistics.io'}'`
    );

    // Obfuscate the code
    const obfuscated = JavaScriptObfuscator.obfuscate(configuredCode, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 1,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      debugProtection: true,
      debugProtectionInterval: 4000,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: true,
      renameGlobals: true,
      selfDefending: true,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 5,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayEncoding: ['base64', 'rc4'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 5,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 5,
      stringArrayWrappersType: 'function',
      stringArrayThreshold: 1,
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    });

    // Write obfuscated code (we'll use Node.js to run it instead of compiling to binary)
    const obfuscatedPath = path.join(this.buildDir, 'activator.js');
    await fs.writeFile(obfuscatedPath, obfuscated.getObfuscatedCode());
  }

  /**
   * Create orchestrator image (contains the activation logic)
   * NOTE: This is not used in multi-platform builds, kept for reference
   */
  async createOrchestratorImage() {
    // Skip building orchestrator image - we now copy activator.js directly in deployment image
    // This avoids multi-platform issues with the orchestrator image
    return;
  }

  /**
   * Build service images without source code
   */
  async buildServiceImages() {
    const services = this.config.services || [
      'auth-service',
      'user-service',
      'api-gateway'
    ];

    for (const service of services) {
      await this.buildServiceImage(service);
    }
  }

  /**
   * Build individual service image
   */
  async buildServiceImage(service) {
    // Frontend service has different build process
    if (service === 'frontend') {
      await this.buildFrontendImage();
      return;
    }

    // Backend service build process
    const dockerfile = `
# Production image for ${service}
FROM node:18-alpine AS builder

# Build stage - compile and minimize
WORKDIR /build
COPY backend/${service}/package*.json ./
COPY backend/${service}/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --production

COPY backend/${service} .
COPY shared /shared

# Remove source maps and development files
RUN find . -name "*.map" -delete
RUN find . -name "*.test.js" -delete
RUN find . -name "*.spec.js" -delete
RUN rm -rf test tests __tests__ docs

# Minify JavaScript
RUN npm install -g terser
RUN find . -name "*.js" -type f ! -path "./node_modules/*" \
    -exec terser {} -o {} -c -m \\;

# Production stage
FROM node:18-alpine

# Install runtime dependencies only
RUN apk add --no-cache openssl curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /build /app
COPY --from=builder --chown=nodejs:nodejs /shared /app/shared

# License check script (embedded)
RUN echo '#!/bin/sh' > /app/check-license.sh && \\
    echo 'if [ -z "$LICENSE_KEY" ]; then' >> /app/check-license.sh && \\
    echo '  echo "No license configured"' >> /app/check-license.sh && \\
    echo '  exit 1' >> /app/check-license.sh && \\
    echo 'fi' >> /app/check-license.sh && \\
    echo 'exit 0' >> /app/check-license.sh && \\
    chmod +x /app/check-license.sh

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \\
    echo '/app/check-license.sh || exit 1' >> /app/start.sh && \\
    echo 'exec node server.js' >> /app/start.sh && \\
    chmod +x /app/start.sh

USER nodejs

EXPOSE ${this.getServicePort(service)}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${this.getServicePort(service)}/health || exit 1

CMD ["/app/start.sh"]
`;

    await fs.writeFile(
      path.join(this.buildDir, `Dockerfile.${service}`),
      dockerfile
    );

    // Build service image
    const projectRoot = path.resolve(__dirname, '../../..');
    await execAsync(`
      cd ${projectRoot} && \
      docker build -f ${this.buildDir}/Dockerfile.${service} \
        -t logistics/${service}:secure .
    `);
  }

  /**
   * Build frontend service image (Next.js production build)
   */
  async buildFrontendImage() {
    const dockerfile = `
# Frontend production image
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.1

# Copy package files
COPY frontend/package*.json ./
COPY frontend/pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY frontend .

# Build Next.js application
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built Next.js application
COPY --from=builder --chown=nodejs:nodejs /app/.next ./.next
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/next.config.mjs ./

# License check script (embedded)
RUN echo '#!/bin/sh' > /app/check-license.sh && \\
    echo 'if [ -z "$LICENSE_KEY" ]; then' >> /app/check-license.sh && \\
    echo '  echo "No license configured"' >> /app/check-license.sh && \\
    echo '  exit 1' >> /app/check-license.sh && \\
    echo 'fi' >> /app/check-license.sh && \\
    echo 'exit 0' >> /app/check-license.sh && \\
    chmod +x /app/check-license.sh

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \\
    echo '/app/check-license.sh || exit 1' >> /app/start.sh && \\
    echo 'exec pnpm start' >> /app/start.sh && \\
    chmod +x /app/start.sh

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["/app/start.sh"]
`;

    await fs.writeFile(
      path.join(this.buildDir, 'Dockerfile.frontend'),
      dockerfile
    );

    // Build frontend image
    const projectRoot = path.resolve(__dirname, '../../..');
    await execAsync(`
      cd ${projectRoot} && \
      docker build -f ${this.buildDir}/Dockerfile.frontend \
        -t logistics/frontend:secure .
    `);
  }

  /**
   * Create final deployment image
   */
  async createDeploymentImage() {
    const dockerfile = `
# Final deployment image - Single image to rule them all
FROM docker:24-dind

# Install Node.js, Docker Compose and dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    docker-compose \
    bash \
    curl \
    openssl \
    ca-certificates

# Create working directory
WORKDIR /logistics

# Copy activator JavaScript (obfuscated, will run with Node.js)
COPY activator.js /usr/local/bin/activator.js

# Create activation wrapper that runs the JS with Node
RUN echo '#!/bin/bash' > /usr/local/bin/logistics-deploy && \\
    echo 'set -e' >> /usr/local/bin/logistics-deploy && \\
    echo '' >> /usr/local/bin/logistics-deploy && \\
    echo 'echo "Starting Logistics Platform Deployment..."' >> /usr/local/bin/logistics-deploy && \\
    echo '' >> /usr/local/bin/logistics-deploy && \\
    echo '# Start Docker daemon if not running' >> /usr/local/bin/logistics-deploy && \\
    echo 'if ! docker info >/dev/null 2>&1; then' >> /usr/local/bin/logistics-deploy && \\
    echo '  dockerd-entrypoint.sh &' >> /usr/local/bin/logistics-deploy && \\
    echo '  sleep 5' >> /usr/local/bin/logistics-deploy && \\
    echo 'fi' >> /usr/local/bin/logistics-deploy && \\
    echo '' >> /usr/local/bin/logistics-deploy && \\
    echo '# Run activation with Node.js' >> /usr/local/bin/logistics-deploy && \\
    echo 'node /usr/local/bin/activator.js' >> /usr/local/bin/logistics-deploy && \\
    chmod +x /usr/local/bin/logistics-deploy

# Set up volumes
VOLUME ["/var/lib/docker", "/opt/logistics"]

# Expose ports
EXPOSE 3000-3011

# Default command
CMD ["logistics-deploy"]
`;

    await fs.writeFile(
      path.join(this.buildDir, 'Dockerfile.deployment'),
      dockerfile
    );

    // Build final deployment image locally
    const imageName = this.config.outputImage || 'logistics/secure-platform:latest';

    await execAsync(`
      cd ${this.buildDir} && \
      docker build -f Dockerfile.deployment \
        -t ${imageName} .
    `);
  }

  /**
   * Get service port
   */
  getServicePort(service) {
    const ports = {
      'api-gateway': 3001,
      'auth-service': 3002,
      'user-service': 3003,
      'shipment-service': 3004,
      'partner-service': 3005,
      'wallet-service': 3006,
      'support-service': 3007,
      'platform-service': 3008
    };
    return ports[service] || 3000;
  }

  /**
   * Get image size
   */
  async getImageSize() {
    try {
      const imageName = this.config.outputImage || `logistics/secure-platform:${this.config.tag || 'latest'}`;
      const { stdout } = await execAsync(
        `docker images --format "{{.Size}}" ${imageName}`
      );
      return stdout.trim();
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Clean up build directory
   */
  async cleanup() {
    await fs.rm(this.buildDir, { recursive: true, force: true });
  }
}

module.exports = SecureImageBuilder;