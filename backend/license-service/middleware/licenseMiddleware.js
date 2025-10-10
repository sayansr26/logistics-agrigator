const jwt = require("jsonwebtoken");
const logger = require("../shared/lib/logger");
const { APIError } = require("../shared/lib/errors");
const { getDatabase } = require("../config/database");
const { licenseOps } = require("../config/redis");

/**
 * Middleware to validate license for incoming requests
 */
async function validateLicenseMiddleware(req, res, next) {
  try {
    // Extract license key from headers or query
    const licenseKey = req.headers["x-license-key"] || req.query.license_key;

    if (!licenseKey) {
      throw new APIError("License key is required", 401);
    }

    // Check Redis cache first
    let licenseData = await licenseOps.getCachedLicense(licenseKey);

    if (!licenseData) {
      // Basic license key format validation
      if (!licenseKey || licenseKey.length < 100) {
        throw new APIError("Invalid license key format", 401);
      }

      // Fetch from database
      const prisma = getDatabase();
      const license = await prisma.license.findUnique({
        where: { key: licenseKey },
      });

      if (!license) {
        throw new APIError("License not found", 401);
      }

      // Check license status
      if (license.status !== "ACTIVE") {
        throw new APIError(`License is ${license.status.toLowerCase()}`, 403);
      }

      // Check validity period
      const now = new Date();
      if (now > license.validUntil) {
        throw new APIError("License has expired", 403);
      }

      // Cache for next time
      await licenseOps.cacheLicense(license.id, license, 600);
      licenseData = license;
    }

    // Attach license info to request
    req.license = {
      id: licenseData.id,
      clientId: licenseData.clientId,
      type: licenseData.type,
      plan: licenseData.plan,
      allowedServices: licenseData.allowedServices,
      features: licenseData.features,
      limits: licenseData.limits,
    };

    // Log API usage
    const prisma = getDatabase();
    await prisma.licenseUsageLog
      .create({
        data: {
          licenseId: licenseData.id,
          eventType: "API_CALL",
          metricsData: {
            endpoint: req.path,
            method: req.method,
            timestamp: new Date().toISOString(),
          },
          ipAddress: req.ip,
        },
      })
      .catch((error) => {
        // Don't fail the request if logging fails
        logger.error("Error logging API usage:", error);
      });

    next();
  } catch (error) {
    logger.error("License validation failed:", error);
    next(error);
  }
}

/**
 * Middleware to check if a service is allowed for the license
 */
function checkServiceAccess(serviceName) {
  return async (req, res, next) => {
    try {
      if (!req.license) {
        throw new APIError("License validation required", 401);
      }

      // Check if service is allowed
      if (
        !req.license.allowedServices.includes(serviceName) &&
        !req.license.allowedServices.includes("*")
      ) {
        throw new APIError(
          `Service '${serviceName}' is not allowed for this license`,
          403,
        );
      }

      next();
    } catch (error) {
      logger.error("Service access check failed:", error);
      next(error);
    }
  };
}

/**
 * Middleware to check feature access
 */
function checkFeatureAccess(featureName) {
  return async (req, res, next) => {
    try {
      if (!req.license) {
        throw new APIError("License validation required", 401);
      }

      // Check if feature is enabled
      const features = req.license.features || {};
      if (!features[featureName] && features["*"] !== true) {
        throw new APIError(
          `Feature '${featureName}' is not enabled for this license`,
          403,
        );
      }

      next();
    } catch (error) {
      logger.error("Feature access check failed:", error);
      next(error);
    }
  };
}

/**
 * Middleware to check usage limits
 */
function checkUsageLimit(limitType) {
  return async (req, res, next) => {
    try {
      if (!req.license) {
        throw new APIError("License validation required", 401);
      }

      const limits = req.license.limits || {};
      const limit = limits[limitType];

      if (!limit) {
        // No limit defined, allow access
        return next();
      }

      // Check current usage against limit
      const prisma = getDatabase();
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const usage = await prisma.licenseUsageLog.count({
        where: {
          licenseId: req.license.id,
          eventType: "API_CALL",
          createdAt: {
            gte: startOfMonth,
          },
        },
      });

      if (usage >= limit) {
        throw new APIError(`Usage limit exceeded for '${limitType}'`, 429);
      }

      // Store remaining quota in response headers
      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - usage));
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(
          startOfMonth.getFullYear(),
          startOfMonth.getMonth() + 1,
          1,
        ).toISOString(),
      );

      next();
    } catch (error) {
      logger.error("Usage limit check failed:", error);
      next(error);
    }
  };
}

/**
 * Middleware to validate machine-specific license
 */
async function validateMachineLicense(req, res, next) {
  try {
    const licenseKey = req.headers["x-license-key"];
    const machineId = req.headers["x-machine-id"];

    if (!licenseKey || !machineId) {
      throw new APIError("License key and machine ID are required", 401);
    }

    // Check if this machine has an active activation
    const activation = await licenseOps.getActivation(licenseKey);

    if (!activation || activation.machineId !== machineId) {
      // Verify in database
      const prisma = getDatabase();
      const license = await prisma.license.findUnique({
        where: { key: licenseKey },
      });

      if (!license) {
        throw new APIError("License not found", 401);
      }

      const dbActivation = await prisma.licenseActivation.findFirst({
        where: {
          licenseId: license.id,
          machineId,
          status: "ACTIVE",
        },
      });

      if (!dbActivation) {
        throw new APIError("No active activation found for this machine", 403);
      }

      // Cache for next time
      await licenseOps.setActivation(
        licenseKey,
        {
          activationId: dbActivation.id,
          licenseId: license.id,
          machineId,
          status: "ACTIVE",
        },
        3600,
      );
    }

    req.activation = activation;
    next();
  } catch (error) {
    logger.error("Machine license validation failed:", error);
    next(error);
  }
}

/**
 * Rate limiting middleware for license operations
 */
async function rateLimitLicense(req, res, next) {
  try {
    const identifier = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const endpoint = req.path;

    // Different limits for different endpoints
    let maxAttempts = 100;
    let windowSeconds = 3600;

    if (endpoint.includes("/activate")) {
      maxAttempts = 5;
      windowSeconds = 3600;
    } else if (endpoint.includes("/validate")) {
      maxAttempts = 50;
      windowSeconds = 300;
    }

    const rateLimit = await licenseOps.checkRateLimit(
      `${identifier}:${endpoint}`,
      maxAttempts,
      windowSeconds,
    );

    if (!rateLimit.allowed) {
      res.setHeader("X-RateLimit-Limit", maxAttempts);
      res.setHeader("X-RateLimit-Remaining", rateLimit.remaining);
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(Date.now() + rateLimit.resetIn * 1000).toISOString(),
      );

      throw new APIError("Too many requests", 429);
    }

    res.setHeader("X-RateLimit-Limit", maxAttempts);
    res.setHeader("X-RateLimit-Remaining", rateLimit.remaining);

    next();
  } catch (error) {
    if (error.statusCode === 429) {
      next(error);
    } else {
      logger.error("Rate limiting error:", error);
      // Don't fail if rate limiting check fails
      next();
    }
  }
}

/**
 * Admin-only middleware
 */
async function adminOnly(req, res, next) {
  try {
    // Check for admin JWT token
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new APIError("Admin authentication required", 401);
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET ||
        "your-super-secret-jwt-key-change-in-production",
    );

    if (decoded.role !== "admin" && decoded.role !== "superadmin") {
      throw new APIError("Admin access required", 403);
    }

    req.admin = {
      id: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      next(new APIError("Invalid token", 401));
    } else if (error.name === "TokenExpiredError") {
      next(new APIError("Token expired", 401));
    } else {
      next(error);
    }
  }
}

module.exports = {
  validateLicenseMiddleware,
  checkServiceAccess,
  checkFeatureAccess,
  checkUsageLimit,
  validateMachineLicense,
  rateLimitLicense,
  adminOnly,
};
