const jwt = require("jsonwebtoken");
const logger = require("../shared/lib/logger");

/**
 * Public paths that don't require authentication
 * These endpoints are accessible without a valid JWT token
 */
const publicPaths = [
  "/health",
  "/openapi.json",
  "/api-docs",
  "/swagger",
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/refresh-token",
];

/**
 * Check if the request path matches any public path
 * @param {string} path - Request path
 * @returns {boolean} - True if path is public
 */
function isPublicPath(path) {
  return publicPaths.some((publicPath) => {
    // Exact match or starts with match (for paths with parameters)
    return path === publicPath || path.startsWith(publicPath);
  });
}

/**
 * JWT Validation Middleware
 * Validates JWT tokens from Authorization header
 * Adds user information to request object and headers for backend services
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateJWT = async (req, res, next) => {
  try {
    // Skip authentication for public endpoints
    if (isPublicPath(req.path)) {
      logger.debug(`Public endpoint accessed: ${req.path}`);
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn(`No authorization header provided for ${req.path}`, {
        ip: req.ip,
        method: req.method,
      });
      return res.status(401).json({
        status: "error",
        error: {
          code: "NO_TOKEN",
          message: "No authentication token provided",
        },
        meta: {
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    // Check for Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      logger.warn(`Invalid authorization header format for ${req.path}`, {
        ip: req.ip,
      });
      return res.status(401).json({
        status: "error",
        error: {
          code: "INVALID_TOKEN_FORMAT",
          message: "Authorization header must be in format: Bearer <token>",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Extract token
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        status: "error",
        error: {
          code: "NO_TOKEN",
          message: "No authentication token provided",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user information to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email, // May be undefined if not in token
      role: decoded.role,
      clientId: decoded.clientId,
      permissions: decoded.permissions || [],
    };

    // Add user information to headers for backend services
    // This allows backend services to access user context without re-validating JWT
    req.headers["x-user-id"] = decoded.userId;

    // Only set x-user-email if email exists in token (optional field)
    if (decoded.email) {
      req.headers["x-user-email"] = decoded.email;
    }

    req.headers["x-user-role"] = decoded.role;
    if (decoded.clientId) {
      req.headers["x-user-client-id"] = decoded.clientId;
    }

    // Add internal request header for backend service validation
    req.headers["x-internal-request"] = process.env.INTERNAL_SECRET;

    logger.debug(`JWT validated successfully for user ${decoded.userId}`, {
      path: req.path,
      method: req.method,
      role: decoded.role,
    });

    next();
  } catch (error) {
    logger.error("JWT validation failed:", {
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        error: {
          code: "TOKEN_EXPIRED",
          message: "Authentication token has expired",
          expiredAt: error.expiredAt,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid authentication token",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (error.name === "NotBeforeError") {
      return res.status(401).json({
        status: "error",
        error: {
          code: "TOKEN_NOT_ACTIVE",
          message: "Token is not yet active",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Generic error response
    return res.status(401).json({
      status: "error",
      error: {
        code: "AUTHENTICATION_FAILED",
        message: "Authentication failed",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Optional JWT Validation Middleware
 * Similar to validateJWT but doesn't fail if no token is provided
 * Useful for endpoints that can work with or without authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.optionalJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // If no token provided, continue without user context
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return next();
    }

    // Try to verify token, but don't fail if invalid
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = {
        userId: decoded.userId,
        email: decoded.email, // May be undefined if not in token
        role: decoded.role,
        clientId: decoded.clientId,
        permissions: decoded.permissions || [],
      };

      req.headers["x-user-id"] = decoded.userId;

      // Only set x-user-email if email exists in token (optional field)
      if (decoded.email) {
        req.headers["x-user-email"] = decoded.email;
      }

      req.headers["x-user-role"] = decoded.role;
      if (decoded.clientId) {
        req.headers["x-user-client-id"] = decoded.clientId;
      }
    } catch (error) {
      // Log but don't fail
      logger.debug("Optional JWT validation failed, continuing without auth", {
        error: error.message,
      });
    }

    next();
  } catch (error) {
    logger.error("Optional JWT middleware error:", error);
    next();
  }
};
