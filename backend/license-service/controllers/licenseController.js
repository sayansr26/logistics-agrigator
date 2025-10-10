const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const forge = require('node-forge');
const { v4: uuidv4 } = require('uuid');
const logger = require('../shared/lib/logger');
const APIResponse = require('../shared/lib/response');
const { APIError, ValidationError } = require('../shared/lib/errors');
const { getDatabase } = require('../config/database');
const { licenseOps } = require('../config/redis');

// License encryption keys (should be stored securely in production)
const LICENSE_SECRET_KEY = process.env.LICENSE_SECRET_KEY || 'ultra-secure-license-key-min-32-chars-required!!';
const LICENSE_SIGNING_KEY = process.env.LICENSE_SIGNING_KEY || 'signing-key-for-license-validation-hmac-sha256!!';

/**
 * Generate a unique license key
 */
const generateLicenseKey = (clientId, type = 'STANDARD') => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  const payload = {
    clientId,
    type,
    timestamp,
    random,
    version: '1.0'
  };

  // Create JWT token as license key
  const token = jwt.sign(payload, LICENSE_SECRET_KEY, {
    algorithm: 'HS256',
    noTimestamp: true
  });

  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', LICENSE_SIGNING_KEY);
  hmac.update(token);
  const signature = hmac.digest('hex');

  // Combine token and signature
  return `${token}.${signature}`;
};

/**
 * Validate license key structure and signature
 */
const validateLicenseKey = (licenseKey) => {
  try {
    const parts = licenseKey.split('.');
    if (parts.length < 4) {
      return { valid: false, error: 'Invalid license format' };
    }

    // Extract token and signature
    const token = parts.slice(0, -1).join('.');
    const signature = parts[parts.length - 1];

    // Verify signature
    const hmac = crypto.createHmac('sha256', LICENSE_SIGNING_KEY);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid license signature' };
    }

    // Verify JWT token
    const decoded = jwt.verify(token, LICENSE_SECRET_KEY, {
      algorithms: ['HS256']
    });

    return { valid: true, data: decoded };
  } catch (error) {
    logger.error('License validation error:', error);
    return { valid: false, error: error.message };
  }
};

/**
 * Generate RSA key pair for advanced encryption
 */
const generateKeyPair = () => {
  const keypair = forge.pki.rsa.generateKeyPair(2048);
  return {
    publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
    privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
  };
};

/**
 * Encrypt configuration data with AES
 */
const encryptConfiguration = (config) => {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(LICENSE_SECRET_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex')
  };
};

/**
 * Decrypt configuration data
 */
const decryptConfiguration = (encryptedData, iv) => {
  const key = crypto.scryptSync(LICENSE_SECRET_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
};

/**
 * Generate a new license
 */
async function generateLicense(req, res) {
  try {
    const prisma = getDatabase();
    const {
      clientId,
      type = 'STANDARD',
      plan = 'MONTHLY',
      allowedServices = ['auth-service', 'user-service', 'api-gateway'],
      maxActivations = 1,
      validityDays = 30,
      allowedIPs = [],
      allowedMachineIds = [],
      features = {},
      limits = {},
      commissionRate = null,
      encryptedConfig = null
    } = req.body;

    // Validate input
    if (!clientId) {
      throw new ValidationError('Client ID is required');
    }

    // Generate license key
    const licenseKey = generateLicenseKey(clientId, type);

    // Calculate validity period
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    // Calculate billing dates
    let billingCycle = 'MONTHLY';
    let nextBillingDate = null;

    switch (plan) {
      case 'MONTHLY':
        billingCycle = 'MONTHLY';
        nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        billingCycle = 'QUARTERLY';
        nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
        break;
      case 'YEARLY':
        billingCycle = 'ANNUAL';
        nextBillingDate = new Date();
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        break;
      case 'LIFETIME':
        billingCycle = 'LIFETIME';
        nextBillingDate = null;
        break;
    }

    // Encrypt configuration if provided
    let encryptedConfigData = null;
    if (encryptedConfig) {
      const encrypted = encryptConfiguration(encryptedConfig);
      encryptedConfigData = JSON.stringify(encrypted);
    }

    // Create HMAC signature for the license
    const licenseData = {
      clientId,
      type,
      plan,
      allowedServices,
      validUntil: validUntil.toISOString()
    };
    const signature = crypto
      .createHmac('sha256', LICENSE_SIGNING_KEY)
      .update(JSON.stringify(licenseData))
      .digest('hex');

    // Store in database
    const license = await prisma.license.create({
      data: {
        key: licenseKey,
        clientId,
        type,
        plan,
        status: 'INACTIVE',
        allowedServices,
        maxActivations,
        currentActivations: 0,
        validFrom,
        validUntil,
        allowedIPs,
        allowedMachineIds,
        features,
        limits,
        billingCycle,
        nextBillingDate,
        commissionRate,
        signature,
        encryptedConfig: encryptedConfigData,
        metadata: {
          generatedBy: req.user?.id || 'system',
          generatedAt: new Date().toISOString(),
          ipAddress: req.ip
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        licenseId: license.id,
        action: 'GENERATE_LICENSE',
        resource: 'License',
        resourceId: license.id,
        metadata: {
          clientId,
          type,
          plan,
          validityDays
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId
      }
    });

    // Cache the license
    await licenseOps.cacheLicense(license.id, license);

    logger.info('License generated successfully', {
      licenseId: license.id,
      clientId,
      type,
      plan
    });

    res.status(201).json(APIResponse.success({
      license: {
        id: license.id,
        key: license.key,
        type: license.type,
        plan: license.plan,
        validFrom: license.validFrom,
        validUntil: license.validUntil,
        maxActivations: license.maxActivations,
        allowedServices: license.allowedServices
      },
      message: 'License generated successfully'
    }));
  } catch (error) {
    logger.error('Error generating license:', error);
    throw error;
  }
}

/**
 * Validate a license
 */
async function validateLicense(req, res) {
  try {
    const prisma = getDatabase();
    const { licenseKey, machineId, serverIP } = req.body;

    // Validate license key format
    const validation = validateLicenseKey(licenseKey);
    if (!validation.valid) {
      throw new ValidationError(`Invalid license: ${validation.error}`);
    }

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

    // Check license status
    if (license.status === 'REVOKED') {
      throw new APIError('License has been revoked', 403);
    }

    if (license.status === 'SUSPENDED') {
      throw new APIError('License is suspended', 403);
    }

    // Check validity period
    const now = new Date();
    if (now < license.validFrom) {
      throw new APIError('License not yet valid', 403);
    }

    if (now > license.validUntil) {
      // Update status to expired
      await prisma.license.update({
        where: { id: license.id },
        data: { status: 'EXPIRED' }
      });
      throw new APIError('License has expired', 403);
    }

    // Check IP restrictions
    if (license.allowedIPs.length > 0 && serverIP) {
      if (!license.allowedIPs.includes(serverIP)) {
        throw new APIError('IP address not authorized for this license', 403);
      }
    }

    // Check machine restrictions
    if (license.allowedMachineIds.length > 0 && machineId) {
      if (!license.allowedMachineIds.includes(machineId)) {
        throw new APIError('Machine not authorized for this license', 403);
      }
    }

    // Check activation limit
    if (license.currentActivations >= license.maxActivations) {
      // Check if this machine already has an activation
      const existingActivation = license.activations.find(
        a => a.machineId === machineId && a.status === 'ACTIVE'
      );

      if (!existingActivation) {
        throw new APIError('Maximum activations reached for this license', 403);
      }
    }

    // License is valid
    res.json(APIResponse.success({
      valid: true,
      license: {
        id: license.id,
        type: license.type,
        plan: license.plan,
        status: license.status,
        allowedServices: license.allowedServices,
        validUntil: license.validUntil,
        features: license.features,
        limits: license.limits
      }
    }));
  } catch (error) {
    logger.error('Error validating license:', error);
    throw error;
  }
}

/**
 * Get license details
 */
async function getLicenseDetails(req, res) {
  try {
    const prisma = getDatabase();
    const { id } = req.params;

    // Try cache first
    let license = await licenseOps.getCachedLicense(id);

    if (!license) {
      // Fetch from database
      license = await prisma.license.findUnique({
        where: { id },
        include: {
          activations: {
            orderBy: { activatedAt: 'desc' },
            take: 10
          },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          usageLogs: {
            orderBy: { createdAt: 'desc' },
            take: 100
          }
        }
      });

      if (!license) {
        throw new APIError('License not found', 404);
      }

      // Cache for next time
      await licenseOps.cacheLicense(id, license);
    }

    res.json(APIResponse.success(license));
  } catch (error) {
    logger.error('Error fetching license details:', error);
    throw error;
  }
}

/**
 * Revoke a license
 */
async function revokeLicense(req, res) {
  try {
    const prisma = getDatabase();
    const { id } = req.params;
    const { reason } = req.body;

    const license = await prisma.license.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        metadata: {
          revokedBy: req.user?.id || 'system',
          revokedReason: reason,
          revokedAt: new Date().toISOString()
        }
      },
      include: {
        activations: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    // Deactivate all active activations
    if (license.activations.length > 0) {
      await prisma.licenseActivation.updateMany({
        where: {
          licenseId: id,
          status: 'ACTIVE'
        },
        data: {
          status: 'REVOKED',
          deactivatedAt: new Date()
        }
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        licenseId: id,
        action: 'REVOKE_LICENSE',
        resource: 'License',
        resourceId: id,
        metadata: { reason },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId
      }
    });

    // Invalidate cache
    await licenseOps.invalidateLicense(id);

    logger.info('License revoked', { licenseId: id, reason });

    res.json(APIResponse.success({
      message: 'License revoked successfully',
      license: {
        id: license.id,
        status: license.status,
        revokedAt: license.revokedAt
      }
    }));
  } catch (error) {
    logger.error('Error revoking license:', error);
    throw error;
  }
}

/**
 * Extend license validity
 */
async function extendLicense(req, res) {
  try {
    const prisma = getDatabase();
    const { id } = req.params;
    const { days = 30 } = req.body;

    const license = await prisma.license.findUnique({
      where: { id }
    });

    if (!license) {
      throw new APIError('License not found', 404);
    }

    // Calculate new validity date
    const currentValidUntil = new Date(license.validUntil);
    const newValidUntil = new Date(currentValidUntil);
    newValidUntil.setDate(newValidUntil.getDate() + days);

    // Update license
    const updatedLicense = await prisma.license.update({
      where: { id },
      data: {
        validUntil: newValidUntil,
        status: license.status === 'EXPIRED' ? 'ACTIVE' : license.status
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        licenseId: id,
        action: 'EXTEND_LICENSE',
        resource: 'License',
        resourceId: id,
        changes: {
          before: { validUntil: license.validUntil },
          after: { validUntil: newValidUntil }
        },
        metadata: { extensionDays: days },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId
      }
    });

    // Invalidate cache
    await licenseOps.invalidateLicense(id);

    logger.info('License extended', {
      licenseId: id,
      days,
      newValidUntil
    });

    res.json(APIResponse.success({
      message: 'License extended successfully',
      license: {
        id: updatedLicense.id,
        validUntil: updatedLicense.validUntil,
        status: updatedLicense.status
      }
    }));
  } catch (error) {
    logger.error('Error extending license:', error);
    throw error;
  }
}

/**
 * List all licenses with filtering
 */
async function listLicenses(req, res) {
  try {
    const prisma = getDatabase();
    const {
      clientId,
      status,
      type,
      plan,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const where = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (plan) where.plan = plan;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch licenses
    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          activations: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              machineId: true,
              serverIP: true,
              lastSeenAt: true
            }
          }
        }
      }),
      prisma.license.count({ where })
    ]);

    res.json(APIResponse.success({
      licenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    logger.error('Error listing licenses:', error);
    throw error;
  }
}

module.exports = {
  generateLicense,
  validateLicense,
  getLicenseDetails,
  revokeLicense,
  extendLicense,
  listLicenses,
  generateLicenseKey,
  validateLicenseKey,
  encryptConfiguration,
  decryptConfiguration
};