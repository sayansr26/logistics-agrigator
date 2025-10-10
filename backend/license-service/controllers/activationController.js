const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const os = require('os');
const logger = require('../shared/lib/logger');
const { APIResponse } = require('../shared/lib/response');
const { APIError, ValidationError } = require('../shared/lib/errors');
const { getDatabase } = require('../config/database');
const { licenseOps } = require('../config/redis');
const { validateLicenseKey, decryptConfiguration } = require('./licenseController');

/**
 * Get machine fingerprint
 */
const getMachineFingerprint = () => {
  try {
    // Get machine ID (hardware-based)
    const machineId = machineIdSync(true);

    // Get additional system info for fingerprinting
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();
    const platform = os.platform();
    const arch = os.arch();

    // Create a composite fingerprint
    const fingerprint = {
      machineId,
      platform,
      arch,
      cpuModel: cpus[0]?.model || 'unknown',
      cpuCores: cpus.length,
      hostname: os.hostname()
    };

    // Generate hash of fingerprint
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprint))
      .digest('hex');

    return {
      machineId: hash,
      systemInfo: fingerprint
    };
  } catch (error) {
    logger.error('Error generating machine fingerprint:', error);
    // Fallback to random ID if hardware detection fails
    return {
      machineId: crypto.randomBytes(32).toString('hex'),
      systemInfo: { fallback: true }
    };
  }
};

/**
 * Get public IP address
 */
const getPublicIP = async () => {
  try {
    // In production, this would call an external service
    // For now, return the request IP
    return 'pending';
  } catch (error) {
    logger.error('Error getting public IP:', error);
    return null;
  }
};

/**
 * Activate a license
 */
async function activateLicense(req, res) {
  try {
    const prisma = getDatabase();
    const {
      licenseKey,
      machineId: providedMachineId,
      serverIP,
      hostname,
      services = [],
      nodeVersion,
      dockerVersion,
      osInfo
    } = req.body;

    // Validate license key
    if (!licenseKey) {
      throw new ValidationError('License key is required');
    }

    // Check rate limiting
    const rateLimitKey = serverIP || req.ip;
    const rateLimit = await licenseOps.checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      throw new APIError(`Too many activation attempts. Try again in ${rateLimit.resetIn} seconds`, 429);
    }

    // Validate license key format
    const validation = validateLicenseKey(licenseKey);
    if (!validation.valid) {
      throw new ValidationError(`Invalid license: ${validation.error}`);
    }

    // Use provided machine ID or generate one
    const machineFingerprint = providedMachineId || getMachineFingerprint().machineId;

    // Find license in database
    const license = await prisma.license.findUnique({
      where: { key: licenseKey },
      include: {
        activations: {
          where: {
            status: 'ACTIVE'
          }
        }
      }
    });

    if (!license) {
      throw new APIError('License not found', 404);
    }

    // Perform license validations
    const now = new Date();

    if (license.status === 'REVOKED') {
      throw new APIError('License has been revoked', 403);
    }

    if (license.status === 'SUSPENDED') {
      throw new APIError('License is suspended', 403);
    }

    if (now < license.validFrom) {
      throw new APIError('License not yet valid', 403);
    }

    if (now > license.validUntil) {
      throw new APIError('License has expired', 403);
    }

    // Check IP restrictions
    const actualIP = serverIP || req.ip;
    if (license.allowedIPs.length > 0 && !license.allowedIPs.includes(actualIP)) {
      throw new APIError('IP address not authorized for this license', 403);
    }

    // Check machine restrictions
    if (license.allowedMachineIds.length > 0 && !license.allowedMachineIds.includes(machineFingerprint)) {
      throw new APIError('Machine not authorized for this license', 403);
    }

    // Check if machine already has an activation
    let activation = await prisma.licenseActivation.findFirst({
      where: {
        licenseId: license.id,
        machineId: machineFingerprint,
        status: 'ACTIVE'
      }
    });

    if (activation) {
      // Update existing activation
      activation = await prisma.licenseActivation.update({
        where: { id: activation.id },
        data: {
          lastSeenAt: new Date(),
          lastHeartbeatAt: new Date(),
          serverIP: actualIP,
          hostname: hostname || activation.hostname,
          deployedServices: services.length > 0 ? services : activation.deployedServices,
          nodeVersion: nodeVersion || activation.nodeVersion,
          dockerVersion: dockerVersion || activation.dockerVersion,
          osInfo: osInfo || activation.osInfo,
          missedHeartbeats: 0
        }
      });

      logger.info('Existing activation updated', {
        activationId: activation.id,
        licenseId: license.id,
        machineId: machineFingerprint
      });
    } else {
      // Check activation limit
      if (license.currentActivations >= license.maxActivations) {
        throw new APIError('Maximum activations reached for this license', 403);
      }

      // Create new activation
      activation = await prisma.licenseActivation.create({
        data: {
          licenseId: license.id,
          machineId: machineFingerprint,
          serverIP: actualIP,
          hostname: hostname || os.hostname(),
          status: 'ACTIVE',
          deployedServices: services,
          nodeVersion: nodeVersion || process.version,
          dockerVersion,
          osInfo: osInfo || {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem()
          },
          lastHeartbeatAt: new Date()
        }
      });

      // Update license activation count
      await prisma.license.update({
        where: { id: license.id },
        data: {
          currentActivations: {
            increment: 1
          },
          status: 'ACTIVE'
        }
      });

      logger.info('New activation created', {
        activationId: activation.id,
        licenseId: license.id,
        machineId: machineFingerprint
      });
    }

    // Store activation in Redis for quick access
    await licenseOps.setActivation(licenseKey, {
      activationId: activation.id,
      licenseId: license.id,
      machineId: machineFingerprint,
      status: 'ACTIVE',
      activatedAt: activation.activatedAt
    }, 3600);

    // Create usage log
    await prisma.licenseUsageLog.create({
      data: {
        licenseId: license.id,
        eventType: 'ACTIVATION',
        metricsData: {
          machineId: machineFingerprint,
          serverIP: actualIP,
          services,
          timestamp: new Date().toISOString()
        },
        ipAddress: actualIP,
        machineId: machineFingerprint
      }
    });

    // Prepare response with configuration
    let configuration = {
      NODE_ENV: 'production',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      DATABASE_URL: process.env.CLIENT_DATABASE_URL || 'postgresql://user:pass@localhost/db',
      REDIS_URL: process.env.CLIENT_REDIS_URL || 'redis://localhost:6379',
      LICENSE_KEY: licenseKey,
      CLIENT_ID: license.clientId,
      ALLOWED_SERVICES: license.allowedServices
    };

    // Add decrypted config if available
    if (license.encryptedConfig) {
      try {
        const encryptedData = JSON.parse(license.encryptedConfig);
        const decrypted = decryptConfiguration(encryptedData.encrypted, encryptedData.iv);
        configuration = { ...configuration, ...decrypted };
      } catch (error) {
        logger.error('Error decrypting configuration:', error);
      }
    }

    res.status(200).json(APIResponse.success({
      activation: {
        id: activation.id,
        status: activation.status,
        machineId: activation.machineId,
        activatedAt: activation.activatedAt
      },
      license: {
        id: license.id,
        type: license.type,
        plan: license.plan,
        validUntil: license.validUntil,
        allowedServices: license.allowedServices,
        features: license.features,
        limits: license.limits
      },
      configuration,
      heartbeatInterval: 300000, // 5 minutes
      message: 'License activated successfully'
    }));
  } catch (error) {
    logger.error('Error activating license:', error);

    // Log failed activation attempt
    try {
      const prisma = getDatabase();
      await prisma.auditLog.create({
        data: {
          action: 'FAILED_ACTIVATION',
          resource: 'License',
          metadata: {
            error: error.message,
            licenseKey: req.body.licenseKey?.substring(0, 10) + '...',
            ipAddress: req.ip
          },
          success: false,
          errorMessage: error.message,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          requestId: req.requestId
        }
      });
    } catch (logError) {
      logger.error('Error logging failed activation:', logError);
    }

    throw error;
  }
}

/**
 * Deactivate a license
 */
async function deactivateLicense(req, res) {
  try {
    const prisma = getDatabase();
    const { licenseKey, machineId, reason } = req.body;

    if (!licenseKey || !machineId) {
      throw new ValidationError('License key and machine ID are required');
    }

    // Find the license
    const license = await prisma.license.findUnique({
      where: { key: licenseKey }
    });

    if (!license) {
      throw new APIError('License not found', 404);
    }

    // Find the activation
    const activation = await prisma.licenseActivation.findFirst({
      where: {
        licenseId: license.id,
        machineId,
        status: 'ACTIVE'
      }
    });

    if (!activation) {
      throw new APIError('No active activation found for this machine', 404);
    }

    // Deactivate the license
    await prisma.licenseActivation.update({
      where: { id: activation.id },
      data: {
        status: 'INACTIVE',
        deactivatedAt: new Date()
      }
    });

    // Update license activation count
    await prisma.license.update({
      where: { id: license.id },
      data: {
        currentActivations: {
          decrement: 1
        }
      }
    });

    // Remove from Redis cache
    await licenseOps.invalidateLicense(license.id);

    // Create usage log
    await prisma.licenseUsageLog.create({
      data: {
        licenseId: license.id,
        eventType: 'DEACTIVATION',
        metricsData: {
          machineId,
          reason,
          timestamp: new Date().toISOString()
        },
        ipAddress: req.ip,
        machineId
      }
    });

    logger.info('License deactivated', {
      activationId: activation.id,
      licenseId: license.id,
      machineId,
      reason
    });

    res.json(APIResponse.success({
      message: 'License deactivated successfully',
      deactivation: {
        activationId: activation.id,
        deactivatedAt: new Date()
      }
    }));
  } catch (error) {
    logger.error('Error deactivating license:', error);
    throw error;
  }
}

/**
 * Send heartbeat for license
 */
async function sendHeartbeat(req, res) {
  try {
    const prisma = getDatabase();
    const { licenseKey, machineId, metrics = {} } = req.body;

    if (!licenseKey || !machineId) {
      throw new ValidationError('License key and machine ID are required');
    }

    // Find the license
    const license = await prisma.license.findUnique({
      where: { key: licenseKey }
    });

    if (!license) {
      throw new APIError('License not found', 404);
    }

    // Check license status
    if (license.status !== 'ACTIVE') {
      throw new APIError(`License is ${license.status.toLowerCase()}`, 403);
    }

    // Check if license is still valid
    if (new Date() > license.validUntil) {
      await prisma.license.update({
        where: { id: license.id },
        data: { status: 'EXPIRED' }
      });
      throw new APIError('License has expired', 403);
    }

    // Find and update activation
    const activation = await prisma.licenseActivation.findFirst({
      where: {
        licenseId: license.id,
        machineId,
        status: 'ACTIVE'
      }
    });

    if (!activation) {
      throw new APIError('No active activation found for this machine', 404);
    }

    // Update heartbeat
    await prisma.licenseActivation.update({
      where: { id: activation.id },
      data: {
        lastHeartbeatAt: new Date(),
        lastSeenAt: new Date(),
        missedHeartbeats: 0
      }
    });

    // Store heartbeat in Redis
    await licenseOps.setHeartbeat(machineId, {
      licenseId: license.id,
      activationId: activation.id,
      timestamp: new Date().toISOString(),
      metrics
    });

    // Log heartbeat if significant metrics are provided
    if (Object.keys(metrics).length > 0) {
      await prisma.licenseUsageLog.create({
        data: {
          licenseId: license.id,
          eventType: 'HEARTBEAT',
          metricsData: metrics,
          ipAddress: req.ip,
          machineId
        }
      });
    }

    res.json(APIResponse.success({
      status: 'active',
      nextHeartbeat: new Date(Date.now() + 300000), // 5 minutes
      license: {
        validUntil: license.validUntil,
        status: license.status
      }
    }));
  } catch (error) {
    logger.error('Error processing heartbeat:', error);
    throw error;
  }
}

/**
 * Get activation status
 */
async function getActivationStatus(req, res) {
  try {
    const prisma = getDatabase();
    const { licenseKey, machineId } = req.query;

    if (!licenseKey || !machineId) {
      throw new ValidationError('License key and machine ID are required');
    }

    // Check Redis cache first
    const cached = await licenseOps.getActivation(licenseKey);
    if (cached && cached.machineId === machineId) {
      return res.json(APIResponse.success({
        status: cached.status,
        activation: cached
      }));
    }

    // Find in database
    const license = await prisma.license.findUnique({
      where: { key: licenseKey }
    });

    if (!license) {
      throw new APIError('License not found', 404);
    }

    const activation = await prisma.licenseActivation.findFirst({
      where: {
        licenseId: license.id,
        machineId,
        status: 'ACTIVE'
      }
    });

    if (!activation) {
      return res.json(APIResponse.success({
        status: 'inactive',
        message: 'No active activation found'
      }));
    }

    // Check for missed heartbeats
    const lastHeartbeat = activation.lastHeartbeatAt || activation.lastSeenAt;
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeat.getTime();
    const maxHeartbeatInterval = 900000; // 15 minutes

    if (timeSinceLastHeartbeat > maxHeartbeatInterval) {
      // Mark as potentially inactive
      await prisma.licenseActivation.update({
        where: { id: activation.id },
        data: {
          missedHeartbeats: {
            increment: 1
          }
        }
      });

      if (activation.missedHeartbeats > 3) {
        // Auto-suspend after 3 missed heartbeats
        await prisma.licenseActivation.update({
          where: { id: activation.id },
          data: {
            status: 'SUSPENDED'
          }
        });

        return res.json(APIResponse.success({
          status: 'suspended',
          message: 'Activation suspended due to missed heartbeats'
        }));
      }
    }

    res.json(APIResponse.success({
      status: 'active',
      activation: {
        id: activation.id,
        machineId: activation.machineId,
        activatedAt: activation.activatedAt,
        lastSeenAt: activation.lastSeenAt,
        missedHeartbeats: activation.missedHeartbeats
      }
    }));
  } catch (error) {
    logger.error('Error getting activation status:', error);
    throw error;
  }
}

/**
 * List all activations for a license
 */
async function listActivations(req, res) {
  try {
    const prisma = getDatabase();
    const { licenseId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const where = { licenseId };
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [activations, total] = await Promise.all([
      prisma.licenseActivation.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { activatedAt: 'desc' }
      }),
      prisma.licenseActivation.count({ where })
    ]);

    res.json(APIResponse.success({
      activations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    logger.error('Error listing activations:', error);
    throw error;
  }
}

module.exports = {
  activateLicense,
  deactivateLicense,
  sendHeartbeat,
  getActivationStatus,
  listActivations,
  getMachineFingerprint,
  getPublicIP
};