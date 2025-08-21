const jwt = require("jsonwebtoken");
const { getRedisClient } = require("../config/redis");

const authenticate = async (req, res, next) => {
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

    // Check if token is blacklisted
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
};

const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions || [];

    // Admin has all permissions
    if (userPermissions.includes("all_permissions")) {
      return next();
    }

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
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
};

// Role-based authorization middleware
const requireRole = (requiredRoles) => {
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
};

// Combined authentication and authorization middleware
const authenticateAndAuthorize = (
  requiredPermissions = [],
  requiredRoles = []
) => {
  return async (req, res, next) => {
    // First authenticate
    await new Promise((resolve, reject) => {
      authenticate(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }).catch(() => {
      return; // Authentication already sent response
    });

    // If authentication failed, stop here
    if (!req.user) {
      return;
    }

    // Check roles if specified
    if (requiredRoles.length > 0) {
      const roleCheck = requireRole(requiredRoles);
      await new Promise((resolve, reject) => {
        roleCheck(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }).catch(() => {
        return; // Role check already sent response
      });

      // If role check failed, stop here
      if (res.headersSent) {
        return;
      }
    }

    // Check permissions if specified
    if (requiredPermissions.length > 0) {
      const permissionCheck = authorize(requiredPermissions);
      await new Promise((resolve, reject) => {
        permissionCheck(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }).catch(() => {
        return; // Permission check already sent response
      });

      // If permission check failed, stop here
      if (res.headersSent) {
        return;
      }
    }

    next();
  };
};

// Middleware to extract and enrich user context
const enrichUserContext = async (req, res, next) => {
  if (req.user) {
    // Add additional user context
    req.user.isAdmin = req.user.role === "admin";
    req.user.canAccessAll = req.user.permissions?.includes("all_permissions");

    // Add role-based capabilities
    req.user.capabilities = {
      canManageUsers: ["admin", "support"].includes(req.user.role),
      canViewReports: ["admin", "finance", "operations"].includes(
        req.user.role
      ),
      canManageShipments: ["admin", "operations"].includes(req.user.role),
      canAccessWallet: ["admin", "finance", "client"].includes(req.user.role),
      canProvideSupport: ["admin", "support"].includes(req.user.role),
    };

    // Add timestamp for session tracking
    req.user.requestTimestamp = new Date().toISOString();
  }

  next();
};

// Admin-only middleware (shorthand)
const adminOnly = requireRole("admin");

// Client or higher middleware (client, operations, finance, admin)
const clientOrHigher = requireRole([
  "client",
  "operations",
  "finance",
  "admin",
]);

// Operations or higher middleware (operations, finance, admin)
const operationsOrHigher = requireRole(["operations", "finance", "admin"]);

// Finance or admin middleware
const financeOrAdmin = requireRole(["finance", "admin"]);

module.exports = {
  authenticate,
  authorize,
  requireRole,
  authenticateAndAuthorize,
  enrichUserContext,
  adminOnly,
  clientOrHigher,
  operationsOrHigher,
  financeOrAdmin,
};
