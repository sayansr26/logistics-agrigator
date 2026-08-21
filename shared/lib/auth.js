const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getRedisClient } = require("./redis");

// Shared authentication utilities
const authUtils = {
  // Hash password
  hashPassword: async (password) => {
    return await bcrypt.hash(password, 12);
  },

  // Compare password
  comparePassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },

  // Generate JWT token
  generateToken: (payload, options = {}) => {
    const defaultOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    };
    return jwt.sign(payload, process.env.JWT_SECRET, {
      ...defaultOptions,
      ...options,
    });
  },

  // Verify JWT token
  verifyToken: (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
  },

  // Generate refresh token
  generateRefreshToken: (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30d" });
  },

  // Get user permissions based on role (LEGACY - use getEffectivePermissions instead)
  getRolePermissions: (role) => {
    const permissions = {
      superadmin: ["all_permissions"],
      admin: ["all_permissions"],
      finance: ["wallet_access", "billing_access", "reports_access"],
      operations: ["shipment_access", "tracking_access", "partner_access"],
      client: ["own_shipments", "tracking", "wallet_view"],
      support: ["ticket_access", "user_support", "knowledge_base"],
    };

    return permissions[role] || [];
  },

  // Check if user has required permissions (LEGACY - use checkPermission instead)
  hasPermissions: (userPermissions, requiredPermissions) => {
    if (userPermissions.includes("all_permissions")) {
      return true;
    }

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  },

  /**
   * Check if user has specific permission (with Redis caching)
   * @param {Object} user - User object from JWT (must have id and role)
   * @param {string} module - Permission module (e.g., 'shipment')
   * @param {string} action - Permission action (e.g., 'create')
   * @param {string} scope - Permission scope (e.g., 'own', 'parent', 'all')
   * @returns {Promise<boolean>}
   */
  checkPermission: async (user, module, action, scope = "all") => {
    try {
      // Super admin has all permissions
      if (user.role === "superadmin") return true;

      // Build cache key. Keep external API tokens on their own namespace so a
      // scoped credential can never read a decision cached for the same user's
      // full-permission dashboard session (see getEffectivePermissions).
      const cacheKey = user.apiCredentialId
        ? `perm:apicred:${user.apiCredentialId}:${module}:${action}:${scope}`
        : `perm:${user.id}:${module}:${action}:${scope}`;

      // Check cache first (5 minute TTL)
      const redisClient = getRedisClient();
      const cached = await redisClient.get(cacheKey);
      if (cached !== null) return cached === "true";

      // Get effective permissions (role + user-specific)
      const permissions = await authUtils.getEffectivePermissions(user);

      // Check for exact match or wildcard using matchesPermission from constants
      const { matchesPermission } = require("../constants/permissions");
      const hasPermission = permissions.some((p) =>
        matchesPermission(
          `${module}:${action}:${scope}`,
          `${p.module}:${p.action}:${p.scope}`,
        ),
      );

      // Cache result for 5 minutes
      await redisClient.setEx(cacheKey, 300, hasPermission ? "true" : "false");

      return hasPermission;
    } catch (error) {
      console.error("Error checking permission:", error);
      // Fail secure - deny permission on error
      return false;
    }
  },

  /**
   * Get all effective permissions for user (role-based + user-specific overrides)
   * @param {Object} user - User object with id and role
   * @returns {Promise<Array>} Array of permission objects {module, action, scope, description}
   */
  getEffectivePermissions: async (user) => {
    try {
      // Check cache first.
      // External API tokens carry a NARROWER permission set than the same
      // user's dashboard session (credential scopes are intersected with the
      // role defaults at mint time), so they must never share a cache entry
      // with that session - otherwise a scoped key inherits full permissions.
      const cacheKey = user.apiCredentialId
        ? `perms:apicred:${user.apiCredentialId}`
        : `perms:${user.id}`;
      const redisClient = getRedisClient();
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // Fetch from auth-service via HTTP API
      const axios = require("axios");
      const authServiceUrl =
        process.env.AUTH_SERVICE_URL || "http://auth-service:3002";

      try {
        const response = await axios.get(
          `${authServiceUrl}/api/v1/permissions/user/${user.id}`,
          {
            headers: {
              Authorization: `Bearer ${user.token || ""}`,
              "X-Internal-Request": "true",
            },
            timeout: 5000,
          },
        );

        const effectivePermissions = response.data.data || [];

        // Cache for 5 minutes
        await redisClient.setEx(
          cacheKey,
          300,
          JSON.stringify(effectivePermissions),
        );

        return effectivePermissions;
      } catch (httpError) {
        console.warn(
          "Failed to fetch permissions from auth-service:",
          httpError.message,
        );

        // Fallback: use JWT-embedded permissions (set during login)
        if (user.permissions && Array.isArray(user.permissions)) {
          return user.permissions.map((p) => {
            const [module, action, scope] = p.split(":");
            return { module, action, scope };
          });
        }

        return [];
      }
    } catch (error) {
      console.error("Error getting effective permissions:", error);

      // Fallback: use JWT-embedded permissions
      if (user.permissions && Array.isArray(user.permissions)) {
        return user.permissions.map((p) => {
          const [module, action, scope] = p.split(":");
          return { module, action, scope };
        });
      }

      return [];
    }
  },

  /**
   * Invalidate permission cache for user
   * MUST be called when user permissions or role changes
   * @param {string} userId - User ID
   */
  invalidatePermissionCache: async (userId) => {
    try {
      const redisClient = getRedisClient();

      // Delete effective permissions cache
      await redisClient.del(`perms:${userId}`);

      // Delete all specific permission checks for this user
      const keys = await redisClient.keys(`perm:${userId}:*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }

      console.log(`Permission cache invalidated for user ${userId}`);
    } catch (error) {
      console.error("Error invalidating permission cache:", error);
      // Continue execution even if cache invalidation fails
    }
  },

  /**
   * Apply scope-based filtering to Prisma queries
   * @param {Object} req - Express request object with authenticated user
   * @param {Object} baseWhere - Base Prisma where clause
   * @param {Object} options - Options for filtering
   * @param {string} options.userIdField - Field name for user ID (default: 'userId')
   * @param {string} options.clientIdField - Field name for client ID (default: 'clientId')
   * @param {string} options.createdByField - Field name for creator ID (optional)
   * @param {string} options.parentClientIdField - Field name for parent client ID (optional)
   * @returns {Object} Modified where clause with scope filters applied
   */
  applyScopeFilter: (req, baseWhere = {}, options = {}) => {
    const user = req.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Normalize user ID (some tokens use userId, some use id)
    const userId = user.id || user.userId;

    // Extract field mappings from options with defaults
    const {
      userIdField = "userId",
      clientIdField = "clientId",
      createdByField = null,
      parentClientIdField = null,
    } = options;

    // Superadmin has access to all data
    if (user.role === "superadmin") {
      return baseWhere;
    }

    // Admin has access to all data within the system
    if (user.role === "admin") {
      return baseWhere;
    }

    // Outlet role - access to own data only (strict isolation)
    if (user.role === "outlet") {
      return {
        ...baseWhere,
        [userIdField]: userId,
      };
    }

    // Client role - access to all data within their client scope
    if (user.role === "client") {
      const orConditions = [];

      // User's own client data
      if (user.clientId) {
        orConditions.push({ [clientIdField]: user.clientId });
      }

      // Parent client relationship (if field exists)
      if (parentClientIdField && user.clientId) {
        orConditions.push({ [parentClientIdField]: user.clientId });
      }

      // Created by user (if field exists)
      if (createdByField) {
        orConditions.push({ [createdByField]: userId });
      }

      // Fallback: user's own data
      if (orConditions.length === 0) {
        orConditions.push({ [userIdField]: userId });
      }

      return {
        ...baseWhere,
        OR: orConditions,
      };
    }

    // Client sub-users (accounts, sales, support) - access based on accessLevel
    if (["accounts", "sales", "support"].includes(user.role)) {
      if (user.accessLevel === "FULL") {
        const orConditions = [];

        // Parent client's data
        if (user.parentClientId) {
          orConditions.push({ [clientIdField]: user.parentClientId });
        }

        // Parent client relationship (if field exists)
        if (parentClientIdField && user.parentClientId) {
          orConditions.push({ [parentClientIdField]: user.parentClientId });
        }

        // Fallback: own data
        if (orConditions.length === 0) {
          orConditions.push({ [userIdField]: userId });
        }

        return {
          ...baseWhere,
          OR: orConditions,
        };
      } else if (user.accessLevel === "RESTRICTED" && user.assignedIds) {
        return {
          ...baseWhere,
          OR: [{ id: { in: user.assignedIds } }, { [userIdField]: userId }],
        };
      }
    }

    // Affiliate - access to assigned entities only
    if (user.role === "affiliate") {
      return {
        ...baseWhere,
        id: { in: user.assignedIds || [] },
      };
    }

    // Default: own data only
    const orConditions = [{ [userIdField]: userId }];
    if (createdByField) {
      orConditions.push({ [createdByField]: userId });
    }

    return {
      ...baseWhere,
      OR: orConditions,
    };
  },
};

// Shared middleware functions for other services
const authMiddleware = {
  // Authentication middleware
  authenticate: async (req, res, next) => {
    try {
      const authHeader = req.header("Authorization");
      const token = authHeader
        ? String(authHeader)
            .replace(/^Bearer\s+/i, "")
            .trim()
        : null;

      if (!token) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "UNAUTHORIZED",
            message: "Access denied. No token provided.",
          },
        });
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if token is blacklisted (if Redis is available)
      try {
        const redisClient = getRedisClient();
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);

        if (isBlacklisted) {
          return res.status(401).json({
            status: "error",
            error: {
              code: "TOKEN_BLACKLISTED",
              message: "Token has been blacklisted.",
            },
          });
        }

        if (decoded.aud === "external-api") {
          // External API tokens are minted from API credentials, not from a
          // portal login, so there is no `session:<userId>` key to check.
          // Their liveness check is credential/token revocation instead.
          // This branch is also what lets shipment-service forward the
          // caller's Authorization to partner-service and wallet-service
          // (which re-run this middleware) without a spurious 401.
          const [credRevoked, tokenRevoked] = await Promise.all([
            decoded.apiCredentialId
              ? redisClient.get(`apicred:revoked:${decoded.apiCredentialId}`)
              : null,
            decoded.jti
              ? redisClient.get(`apitoken:revoked:${decoded.jti}`)
              : null,
          ]);

          if (credRevoked || tokenRevoked) {
            return res.status(401).json({
              status: "error",
              error: {
                code: "CREDENTIAL_REVOKED",
                message: "API credential has been revoked.",
              },
            });
          }
        } else {
          // Check if session exists in Redis
          const session = await redisClient.get(`session:${decoded.userId}`);

          if (!session) {
            return res.status(401).json({
              status: "error",
              error: {
                code: "INVALID_SESSION",
                message: "Invalid session.",
              },
            });
          }
        }
      } catch (redisError) {
        // If Redis is not available, continue without session validation
        console.warn(
          "Redis not available for session validation:",
          redisError.message,
        );
      }

      // Normalize token payload: ensure 'id' is always available (some code uses user.id, some uses user.userId)
      req.user = {
        ...decoded,
        id: decoded.userId || decoded.id, // Normalize userId to id for backward compatibility
        token, // Attach bearer token so getEffectivePermissions() can call auth-service
      };
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          status: "error",
          error: {
            code: "TOKEN_EXPIRED",
            message: "Token expired.",
          },
        });
      }

      res.status(401).json({
        status: "error",
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid token.",
        },
      });
    }
  },

  /**
   * Authorize either a trusted SERVICE principal or a user permission.
   *
   * Some operations are performed BY a service ON BEHALF OF a user, where the
   * user legitimately lacks the permission the operation needs. The canonical
   * case is the booking-time wallet debit: shipment-service must move money
   * (`wallet:manage:all`), but the outlet booking the shipment holds only
   * `wallet:read:own`. Authorizing that hop against the caller's permissions
   * makes booking impossible for every non-admin role.
   *
   * A service principal proves itself with `X-Service-Token` === INTERNAL_SECRET.
   * That header is stripped from inbound client requests at the API gateway, so
   * it can only originate from a service on the internal network.
   *
   * @param {string} module
   * @param {string} action
   * @param {string} scope
   */
  requirePermissionOrService: (module, action, scope = "all") => {
    return async (req, res, next) => {
      const presented = req.header("X-Service-Token");
      const expected = process.env.INTERNAL_SECRET;

      if (expected && presented && presented === expected) {
        req.isServicePrincipal = true;
        req.servicePrincipalName = req.header("X-Service-Name") || "unknown";
        return next();
      }

      return authMiddleware.requirePermission(module, action, scope)(
        req,
        res,
        next,
      );
    };
  },

  // Permission-based authorization (LEGACY - use requirePermission instead)
  authorize: (requiredPermissions) => {
    return (req, res, next) => {
      const userPermissions = req.user.permissions || [];

      // Convert single permission to array for consistency
      const permissionsArray = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      // Admin and superadmin always have access
      if (req.user.role === "admin" || req.user.role === "superadmin") {
        return next();
      }

      if (!authUtils.hasPermissions(userPermissions, permissionsArray)) {
        return res.status(403).json({
          status: "error",
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions.",
          },
        });
      }

      next();
    };
  },

  // Role-based authorization
  requireRole: (requiredRoles) => {
    return (req, res, next) => {
      const userRole = req.user.role;

      if (!userRole) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "UNAUTHORIZED",
            message: "User role not found.",
          },
        });
      }

      // Convert single role to array for consistency
      const rolesArray = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];

      // Admin and superadmin always have access
      if (userRole === "admin" || userRole === "superadmin") {
        return next();
      }

      // Check if user has required role
      if (!rolesArray.includes(userRole)) {
        return res.status(403).json({
          status: "error",
          error: {
            code: "FORBIDDEN",
            message: `Access denied. Required role(s): ${rolesArray.join(", ")}. Your role: ${userRole}`,
          },
        });
      }

      next();
    };
  },

  /**
   * Require specific permission (module:action:scope)
   * @param {string} module - Permission module
   * @param {string} action - Permission action
   * @param {string} scope - Permission scope
   * @returns {Function} Express middleware
   */
  requirePermission: (module, action, scope = "all") => {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            status: "error",
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required",
            },
          });
        }

        const hasPermission = await authUtils.checkPermission(
          req.user,
          module,
          action,
          scope,
        );

        if (!hasPermission) {
          const logger = require("./logger");
          logger.warn(
            `Permission denied: ${req.user.email} attempted ${module}:${action}:${scope}`,
          );

          return res.status(403).json({
            status: "error",
            error: {
              code: "FORBIDDEN",
              message: `Insufficient permissions. Required: ${module}:${action}:${scope}`,
            },
          });
        }

        next();
      } catch (error) {
        const logger = require("./logger");
        logger.error("Permission check error:", error);

        return res.status(500).json({
          status: "error",
          error: {
            code: "PERMISSION_CHECK_FAILED",
            message: "Failed to verify permissions",
          },
        });
      }
    };
  },

  // Enrich user context with capabilities
  enrichUserContext: (req, res, next) => {
    if (req.user) {
      // Add additional user context
      req.user.isAdmin =
        req.user.role === "admin" || req.user.role === "superadmin";
      req.user.canAccessAll =
        req.user.permissions?.includes("all_permissions") ||
        req.user.role === "superadmin";

      // Add role-based capabilities
      req.user.capabilities = {
        canManageUsers: ["superadmin", "admin", "support"].includes(
          req.user.role,
        ),
        canViewReports: [
          "superadmin",
          "admin",
          "finance",
          "operations",
        ].includes(req.user.role),
        canManageShipments: ["superadmin", "admin", "operations"].includes(
          req.user.role,
        ),
        canAccessWallet: ["superadmin", "admin", "finance", "client"].includes(
          req.user.role,
        ),
        canProvideSupport: ["superadmin", "admin", "support"].includes(
          req.user.role,
        ),
      };

      // Add timestamp for session tracking
      req.user.requestTimestamp = new Date().toISOString();
    }

    next();
  },

  // Shorthand middleware functions
  adminOnly: function (req, res, next) {
    return authMiddleware.requireRole(["admin", "superadmin"])(req, res, next);
  },

  clientOrHigher: function (req, res, next) {
    return authMiddleware.requireRole([
      "client",
      "operations",
      "finance",
      "admin",
    ])(req, res, next);
  },

  operationsOrHigher: function (req, res, next) {
    return authMiddleware.requireRole(["operations", "finance", "admin"])(
      req,
      res,
      next,
    );
  },

  financeOrAdmin: function (req, res, next) {
    return authMiddleware.requireRole(["finance", "admin"])(req, res, next);
  },
};

module.exports = { authUtils, authMiddleware };
