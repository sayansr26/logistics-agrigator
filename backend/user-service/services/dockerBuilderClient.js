/**
 * Secure Docker Builder Integration Client
 *
 * Integrates with the secure-docker-builder tool to trigger
 * Docker image builds for new client deployments.
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs").promises;
const logger = require("../shared/lib/logger");
const { APIError } = require("../shared/lib/errors");

const execAsync = promisify(exec);

const BUILDER_PATH =
  process.env.BUILDER_PATH ||
  path.join(__dirname, "../../../tools/secure-docker-builder");
const BUILD_TIMEOUT = 600000; // 10 minutes

class DockerBuilderClient {
  constructor() {
    this.builderPath = BUILDER_PATH;
    this.buildTimeout = BUILD_TIMEOUT;
  }

  /**
   * Trigger secure Docker image build for a client
   *
   * @param {Object} buildConfig - Build configuration
   * @param {string} buildConfig.clientId - Client UUID
   * @param {string} buildConfig.clientName - Client name
   * @param {string} buildConfig.licenseType - License type (TRIAL, STANDARD, PROFESSIONAL, ENTERPRISE)
   * @param {Array<string>} buildConfig.services - Services to include in build
   * @param {string} buildConfig.registry - Docker registry URL
   * @param {string} buildConfig.licenseServer - License server URL
   * @param {boolean} buildConfig.enableMonitoring - Enable monitoring
   * @param {string} buildConfig.secretKey - Secret key for image encryption
   * @returns {Promise<Object>} Build result with image details
   */
  async triggerBuild(buildConfig) {
    try {
      const {
        clientId,
        clientName,
        licenseType = "STANDARD",
        services = [
          "auth-service",
          "user-service",
          "api-gateway",
          "shipment-service",
          "partner-service",
          "wallet-service",
        ],
        registry = "docker.io/logistics-secure",
        licenseServer = process.env.LICENSE_SERVICE_URL ||
          "http://localhost:3011",
        enableMonitoring = false,
        secretKey,
      } = buildConfig;

      // Validate required fields
      if (!clientId) {
        throw new APIError("Client ID is required for Docker build", 400);
      }

      if (!clientName) {
        throw new APIError("Client name is required for Docker build", 400);
      }

      logger.info("Triggering Docker build", {
        clientId,
        clientName,
        licenseType,
        services: services.length,
      });

      // Create build configuration file
      const timestamp = Date.now();
      const tag = `${clientName.toLowerCase().replace(/\s+/g, "-")}-${timestamp}`;
      const outputImage = `logistics/secure-${clientId}:${tag}`;

      const config = {
        clientId,
        clientName,
        services,
        licenseType,
        registry,
        licenseServer,
        enableMonitoring,
        secretKey: secretKey || this.generateSecretKey(),
        tag,
        outputImage,
        timestamp: new Date().toISOString(),
      };

      const configPath = path.join(
        this.builderPath,
        `build-config-${clientId}.json`,
      );

      // Write configuration file
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      logger.info("Build configuration created", { configPath });

      // Execute build command
      const buildCommand = `cd ${this.builderPath} && node src/cli.js build --config ${configPath} --no-push`;

      logger.info("Executing build command", { buildCommand });

      let buildResult;
      try {
        const { stdout, stderr } = await execAsync(buildCommand, {
          timeout: this.buildTimeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for build output
        });

        logger.info("Docker build completed", {
          clientId,
          stdout: stdout.substring(0, 500), // Log first 500 chars
          stderr: stderr ? stderr.substring(0, 500) : null,
        });

        buildResult = {
          success: true,
          imageName: outputImage,
          registry,
          tag,
          buildStatus: "completed",
          timestamp: new Date().toISOString(),
        };
      } catch (execError) {
        logger.error("Docker build execution failed", {
          clientId,
          error: execError.message,
          stdout: execError.stdout?.substring(0, 500),
          stderr: execError.stderr?.substring(0, 500),
        });

        buildResult = {
          success: false,
          imageName: outputImage,
          registry,
          tag,
          buildStatus: "failed",
          error: execError.message,
          timestamp: new Date().toISOString(),
        };
      }

      // Clean up configuration file
      try {
        await fs.unlink(configPath);
      } catch (cleanupError) {
        logger.warn("Failed to cleanup config file", {
          configPath,
          error: cleanupError.message,
        });
      }

      // Check if image was actually created
      if (buildResult.success) {
        try {
          await this.verifyImage(outputImage);
          buildResult.verified = true;

          // Get image size
          const size = await this.getImageSize(outputImage);
          buildResult.size = size;
        } catch (verifyError) {
          logger.error("Image verification failed", {
            imageName: outputImage,
            error: verifyError.message,
          });

          buildResult.success = false;
          buildResult.buildStatus = "failed";
          buildResult.error = "Image verification failed";
        }
      }

      if (!buildResult.success) {
        throw new APIError(
          `Docker build failed: ${buildResult.error || "Unknown error"}`,
          500,
        );
      }

      logger.info("Docker build successful", {
        clientId,
        imageName: buildResult.imageName,
        size: buildResult.size,
      });

      return buildResult;
    } catch (error) {
      logger.error("Failed to trigger Docker build", {
        clientId: buildConfig.clientId,
        error: error.message,
      });

      // Re-throw if already an API Error
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(`Docker build failed: ${error.message}`, 500);
    }
  }

  /**
   * Push Docker image to registry
   *
   * @param {string} imageName - Local image name
   * @param {string} registry - Registry URL
   * @returns {Promise<string>} Pushed image name
   */
  async pushToRegistry(imageName, registry) {
    try {
      logger.info("Pushing image to registry", { imageName, registry });

      const [, tag] = imageName.split(":");
      let fullImageName;

      if (registry.includes("/")) {
        fullImageName = `${registry}:${tag}`;
      } else {
        fullImageName = `${registry}/logistics-secure-client:${tag}`;
      }

      // Tag image
      await execAsync(`docker tag ${imageName} ${fullImageName}`);

      // Push image
      await execAsync(`docker push ${fullImageName}`, {
        timeout: 300000, // 5 minutes for push
      });

      logger.info("Image pushed successfully", { fullImageName });

      return fullImageName;
    } catch (error) {
      logger.error("Failed to push image to registry", {
        imageName,
        registry,
        error: error.message,
      });

      throw new APIError(`Failed to push image: ${error.message}`, 500);
    }
  }

  /**
   * Verify that Docker image exists
   *
   * @param {string} imageName - Image name to verify
   * @returns {Promise<boolean>} True if image exists
   */
  async verifyImage(imageName) {
    try {
      const { stdout } = await execAsync(`docker images -q ${imageName}`);
      return stdout.trim().length > 0;
    } catch (error) {
      logger.error("Failed to verify image", {
        imageName,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get Docker image size
   *
   * @param {string} imageName - Image name
   * @returns {Promise<string>} Image size
   */
  async getImageSize(imageName) {
    try {
      const { stdout } = await execAsync(
        `docker images --format "{{.Size}}" ${imageName}`,
      );
      return stdout.trim() || "Unknown";
    } catch (error) {
      logger.error("Failed to get image size", {
        imageName,
        error: error.message,
      });
      return "Unknown";
    }
  }

  /**
   * Delete Docker image
   *
   * @param {string} imageName - Image name to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteImage(imageName) {
    try {
      await execAsync(`docker rmi -f ${imageName}`);
      logger.info("Image deleted successfully", { imageName });
      return true;
    } catch (error) {
      logger.error("Failed to delete image", {
        imageName,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Generate a secure random key
   *
   * @returns {string} Hex-encoded random key
   */
  generateSecretKey() {
    const crypto = require("crypto");
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Check Docker availability
   *
   * @returns {Promise<boolean>} True if Docker is available
   */
  async checkDockerAvailable() {
    try {
      await execAsync("docker info");
      return true;
    } catch (error) {
      logger.error("Docker is not available", { error: error.message });
      return false;
    }
  }

  /**
   * Generate deployment instructions for client
   *
   * @param {Object} buildResult - Build result with image details
   * @param {Object} clientInfo - Client information
   * @param {string} activationCode - License activation code
   * @returns {string} Deployment instructions
   */
  generateDeploymentInstructions(buildResult, clientInfo, activationCode) {
    return `
# Logistics Platform - Secure Deployment

## Client Information
- Client ID: ${clientInfo.id}
- Client Name: ${clientInfo.name}
- License Type: ${clientInfo.licenseType || "STANDARD"}

## Docker Image
- Image: ${buildResult.imageName}
- Size: ${buildResult.size}
- Registry: ${buildResult.registry}
- Build Date: ${buildResult.timestamp}

## Activation Code
\`\`\`
${activationCode}
\`\`\`

**Important**: Keep this activation code secure. You will need it for deployment.

## Deployment Steps

### Prerequisites
- Docker 20.10+ installed
- 8GB RAM minimum
- 50GB disk space
- Internet connection for activation

### Deploy the Platform

1. **Pull the Docker image**
   \`\`\`bash
   docker pull ${buildResult.imageName}
   \`\`\`

2. **Run the deployment**
   \`\`\`bash
   docker run -it \\
     --name logistics-platform \\
     -v /var/run/docker.sock:/var/run/docker.sock \\
     -v logistics-data:/opt/logistics \\
     -p 3000-3011:3000-3011 \\
     --privileged \\
     ${buildResult.imageName}
   \`\`\`

3. **Follow the activation prompts**
   - Enter the activation code when prompted
   - Provide admin email: ${clientInfo.email}
   - Set admin password
   - Confirm deployment

4. **Access the platform**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:3001
   - Login with admin credentials

## Management Commands

**View logs:**
\`\`\`bash
docker logs logistics-platform
\`\`\`

**Stop platform:**
\`\`\`bash
docker stop logistics-platform
\`\`\`

**Restart platform:**
\`\`\`bash
docker start logistics-platform
\`\`\`

## Support
- Documentation: https://docs.logistics.com
- Support: support@logistics.com
- Client ID: ${clientInfo.id}

Generated: ${new Date().toISOString()}
`;
  }
}

// Export singleton instance
module.exports = new DockerBuilderClient();
