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
      expiresIn: process.env.JWT_EXPIRES_IN || "3600s",
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

  // Get user permissions based on role
  getRolePermissions: (role) => {
    const permissions = {
      admin: ["all_permissions"],
      finance: ["wallet_access", "billing_access", "reports_access"],
      operations: ["shipment_access", "tracking_access", "partner_access"],
      client: ["own_shipments", "tracking", "wallet_view"],
      support: ["ticket_access", "user_support", "knowledge_base"],
    };

    return permissions[role] || [];
  },

  // Check if user has required permissions
  hasPermissions: (userPermissions, requiredPermissions) => {
    if (userPermissions.includes("all_permissions")) {
      return true;
    }

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
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

  // Permission-based authorization
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

      // Admin always has access
      if (userRole === "admin") {
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

  // Enrich user context with capabilities
  enrichUserContext: (req, res, next) => {
    if (req.user) {
      // Add additional user context
      req.user.isAdmin = req.user.role === "admin";
      req.user.canAccessAll = req.user.permissions?.includes("all_permissions");

      // Add role-based capabilities
      req.user.capabilities = {
        canManageUsers: ["admin", "support"].includes(req.user.role),
        canViewReports: ["admin", "finance", "operations"].includes(
          req.user.role,
        ),
        canManageShipments: ["admin", "operations"].includes(req.user.role),
        canAccessWallet: ["admin", "finance", "client"].includes(req.user.role),
        canProvideSupport: ["admin", "support"].includes(req.user.role),
      };

      // Add timestamp for session tracking
      req.user.requestTimestamp = new Date().toISOString();
    }

    next();
  },

  // Shorthand middleware functions
  adminOnly: function (req, res, next) {
    return authMiddleware.requireRole("admin")(req, res, next);
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
