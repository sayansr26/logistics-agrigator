const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

/**
 * RBAC Permission Checker Middleware
 * Validates user permissions for requested resources
 * Uses Redis caching for performance optimization
 */

/**
 * Permission matching helper
 * Checks if a required permission matches a user's permission
 *
 * Format: module:action:scope
 * Examples:
 *   - shipment:create:own
 *   - customer:read:assigned
 *   - wallet:manage:all
 *   - *:*:* (superadmin - all permissions)
 *
 * @param {string} required - Required permission
 * @param {string} userPermission - User's permission
 * @returns {boolean} - True if permission matches
 */
function matchesPermission(required, userPermission) {
  const [reqModule, reqAction, reqScope] = required.split(":");
  const [userModule, userAction, userScope] = userPermission.split(":");

  // Wildcard permission (*:*:*) grants all access
  if (userModule === "*" && userAction === "*" && userScope === "*") {
    return true;
  }

  // Check module match
  if (userModule !== "*" && userModule !== reqModule) {
    return false;
  }

  // Check action match
  if (userAction !== "*" && userAction !== reqAction) {
    return false;
  }

  // Check scope match
  if (userScope !== "*" && userScope !== reqScope) {
    return false;
  }

  return true;
}

/**
 * Check if user has required permission
 * @param {Array<string>} userPermissions - User's permissions
 * @param {string} requiredPermission - Required permission
 * @returns {boolean} - True if user has permission
 */
function hasPermission(userPermissions, requiredPermission) {
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }

  // Check if any user permission matches the required permission
  return userPermissions.some((userPerm) =>
    matchesPermission(requiredPermission, userPerm),
  );
}

/**
 * Get cached permissions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array<string>|null>} - Cached permissions or null
 */
async function getCachedPermissions(userId) {
  try {
    const redis = getRedisClient();
    const cacheKey = `permissions:${userId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      logger.debug(`Permission cache hit for user ${userId}`);
      return JSON.parse(cached);
    }

    logger.debug(`Permission cache miss for user ${userId}`);
    return null;
  } catch (error) {
    logger.error("Error getting cached permissions:", error);
    return null;
  }
}

/**
 * Cache user permissions
 * @param {string} userId - User ID
 * @param {Array<string>} permissions - Permissions to cache
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 */
async function cachePermissions(userId, permissions, ttl = 300) {
  try {
    const redis = getRedisClient();
    const cacheKey = `permissions:${userId}`;
    await redis.setex(cacheKey, ttl, JSON.stringify(permissions));
    logger.debug(`Cached permissions for user ${userId} (TTL: ${ttl}s)`);
  } catch (error) {
    logger.error("Error caching permissions:", error);
  }
}

/**
 * Invalidate cached permissions for a user
 * Should be called when user permissions change
 *
 * @param {string} userId - User ID
 */
async function invalidatePermissionCache(userId) {
  try {
    const redis = getRedisClient();
    const cacheKey = `permissions:${userId}`;
    await redis.del(cacheKey);
    logger.info(`Invalidated permission cache for user ${userId}`);
  } catch (error) {
    logger.error("Error invalidating permission cache:", error);
  }
}

/**
 * Middleware to require specific permission
 * Usage in routes:
 *   router.post('/shipments', requirePermission('shipment:create:own'), handler)
 *
 * @param {string|Array<string>} requiredPermissions - Permission(s) required
 * @returns {Function} - Express middleware function
 */
function requirePermission(requiredPermissions) {
  // Convert single permission to array
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        logger.warn("RBAC check failed: No user context", {
          path: req.path,
          method: req.method,
        });
        return res.status(401).json({
          status: "error",
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      const userId = req.user.userId;
      const userRole = req.user.role;

      // Superadmin always has access
      if (userRole === "superadmin") {
        logger.debug(`Superadmin access granted for user ${userId}`);
        return next();
      }

      // Get user permissions (from token or cache)
      let userPermissions = req.user.permissions || [];

      // If permissions not in token, try to get from cache
      if (userPermissions.length === 0) {
        const cachedPermissions = await getCachedPermissions(userId);
        if (cachedPermissions) {
          userPermissions = cachedPermissions;
        }
      }

      // Check if user has at least one of the required permissions
      const hasRequiredPermission = permissions.some((requiredPerm) =>
        hasPermission(userPermissions, requiredPerm),
      );

      if (!hasRequiredPermission) {
        logger.warn("RBAC check failed: Insufficient permissions", {
          userId,
          role: userRole,
          required: permissions,
          userPermissions,
          path: req.path,
          method: req.method,
        });

        return res.status(403).json({
          status: "error",
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to perform this action",
            requiredPermissions: permissions,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Permission granted
      logger.debug(`RBAC check passed for user ${userId}`, {
        required: permissions,
        path: req.path,
      });

      next();
    } catch (error) {
      logger.error("RBAC middleware error:", {
        error: error.message,
        stack: error.stack,
        path: req.path,
      });

      return res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Permission check failed",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

/**
 * Middleware to require specific role
 * Usage in routes:
 *   router.get('/admin', requireRole(['admin', 'superadmin']), handler)
 *
 * @param {string|Array<string>} requiredRoles - Role(s) required
 * @returns {Function} - Express middleware function
 */
function requireRole(requiredRoles) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      const userRole = req.user.role;

      if (!roles.includes(userRole)) {
        logger.warn("Role check failed", {
          userId: req.user.userId,
          userRole,
          requiredRoles: roles,
          path: req.path,
        });

        return res.status(403).json({
          status: "error",
          error: {
            code: "FORBIDDEN",
            message:
              "You do not have the required role to access this resource",
            requiredRoles: roles,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      logger.debug(`Role check passed for user ${req.user.userId}`, {
        role: userRole,
        path: req.path,
      });

      next();
    } catch (error) {
      logger.error("Role check middleware error:", error);

      return res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Role check failed",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

module.exports = {
  requirePermission,
  requireRole,
  hasPermission,
  matchesPermission,
  getCachedPermissions,
  cachePermissions,
  invalidatePermissionCache,
};
