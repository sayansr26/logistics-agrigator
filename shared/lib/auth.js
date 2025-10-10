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

      // Build cache key
      const cacheKey = `perm:${user.id}:${module}:${action}:${scope}`;

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
      await redisClient.setex(cacheKey, 300, hasPermission ? "true" : "false");

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
      // Check cache first
      const cacheKey = `perms:${user.id}`;
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
        await redisClient.setex(
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

        // Fallback: return empty array (fail secure)
        // In production, you might want to return basic permissions based on role
        return [];
      }
    } catch (error) {
      console.error("Error getting effective permissions:", error);
      // Fail secure - return empty permissions on error
      return [];
    }
  },

  /**
   * Check if user can access specific customer
   * @param {Object} user - User object
   * @param {string} customerId - Customer ID to check access for
   * @returns {Promise<boolean>}
   */
  checkCustomerAccess: async (user, customerId) => {
    try {
      // Super admin and admin have access to all customers
      if (user.role === "superadmin" || user.role === "admin") return true;

      // Client has access to all their customers
      if (user.role === "client") {
        // Verify customer belongs to this client (via user-service)
        // For now, check if user has parent access scope
        return await authUtils.checkPermission(
          user,
          "customer",
          "read",
          "parent",
        );
      }

      // Check if user has assigned customer access (RESTRICTED access level)
      if (user.accessLevel === "RESTRICTED" && user.assignedCustomerIds) {
        return user.assignedCustomerIds.includes(customerId);
      }

      // For FULL access level, check if they have assigned scope permission
      if (user.accessLevel === "FULL") {
        return await authUtils.checkPermission(
          user,
          "customer",
          "read",
          "assigned",
        );
      }

      return false;
    } catch (error) {
      console.error("Error checking customer access:", error);
      // Fail secure - deny access on error
      return false;
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
   * @returns {Object} Modified where clause with scope filters applied
   */
  applyScopeFilter: (req, baseWhere = {}) => {
    const user = req.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Superadmin has access to all data
    if (user.role === "superadmin") {
      return baseWhere;
    }

    // Admin has access to all data within the system
    if (user.role === "admin") {
      return baseWhere;
    }

    // Client role - access to all data within their client scope
    if (user.role === "client") {
      return {
        ...baseWhere,
        OR: [
          { clientId: user.id },
          { parentClientId: user.id },
          { createdBy: user.id },
        ],
      };
    }

    // Client sub-users (accounts, sales, support) - access based on accessLevel
    if (["accounts", "sales", "support"].includes(user.role)) {
      if (user.accessLevel === "FULL") {
        // Full access to parent client's data
        return {
          ...baseWhere,
          OR: [
            { clientId: user.parentClientId },
            { parentClientId: user.parentClientId },
          ],
        };
      } else if (
        user.accessLevel === "RESTRICTED" &&
        user.assignedCustomerIds
      ) {
        // Restricted to assigned customers only
        return {
          ...baseWhere,
          OR: [
            { customerId: { in: user.assignedCustomerIds } },
            { userId: user.id },
          ],
        };
      }
    }

    // Customer role - access to own data only
    if (user.role === "customer") {
      return {
        ...baseWhere,
        OR: [
          { customerId: user.id },
          { userId: user.id },
          { createdBy: user.id },
        ],
      };
    }

    // Customer sub-users (customer_account, customer_sales, customer_support)
    if (
      ["customer_account", "customer_sales", "customer_support"].includes(
        user.role,
      )
    ) {
      return {
        ...baseWhere,
        OR: [{ customerId: user.parentUserId }, { userId: user.id }],
      };
    }

    // Affiliate - access to assigned customers only
    if (user.role === "affiliate") {
      return {
        ...baseWhere,
        customerId: { in: user.assignedCustomerIds || [] },
      };
    }

    // Default: own data only
    return {
      ...baseWhere,
      OR: [{ userId: user.id }, { createdBy: user.id }],
    };
  },
};

// Shared middleware functions for other services
const authMiddleware = {
  // Authentication middleware
  authenticate: async (req, res, next) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");

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
      } catch (redisError) {
        // If Redis is not available, continue without session validation
        console.warn(
          "Redis not available for session validation:",
          redisError.message,
        );
      }

      req.user = decoded;
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

  // Permission-based authorization (LEGACY - use requirePermission instead)
  authorize: (requiredPermissions) => {
    return (req, res, next) => {
      const userPermissions = req.user.permissions || [];

      if (!authUtils.hasPermissions(userPermissions, requiredPermissions)) {
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

  /**
   * Require customer access permission
   * Checks if user can access customer specified in route params or body
   * @param {string} customerIdField - Field name in req.params or req.body (default: 'customerId')
   * @returns {Function} Express middleware
   */
  requireCustomerAccess: (customerIdField = "customerId") => {
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

        // Get customer ID from params or body
        const customerId =
          req.params[customerIdField] || req.body[customerIdField];

        if (!customerId) {
          return res.status(400).json({
            status: "error",
            error: {
              code: "BAD_REQUEST",
              message: `${customerIdField} is required`,
            },
          });
        }

        const hasAccess = await authUtils.checkCustomerAccess(
          req.user,
          customerId,
        );

        if (!hasAccess) {
          const logger = require("./logger");
          logger.warn(
            `Customer access denied: ${req.user.email} attempted to access customer ${customerId}`,
          );

          return res.status(403).json({
            status: "error",
            error: {
              code: "FORBIDDEN",
              message: "You do not have access to this customer",
            },
          });
        }

        // Add customerId to request for use in controller
        req.validatedCustomerId = customerId;

        next();
      } catch (error) {
        const logger = require("./logger");
        logger.error("Customer access check error:", error);

        return res.status(500).json({
          status: "error",
          error: {
            code: "ACCESS_CHECK_FAILED",
            message: "Failed to verify customer access",
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
