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
  "/api/v1/auth/refresh",
  "/api/v1/geography", // All geographical data endpoints (public)
  "/api/v1/shipments/webhook", // Courier provider webhook callbacks (public)
  // External API credential exchange. NOTE: only this exact path is public -
  // the rest of /api/v1/external/auth (credential CRUD) requires a session JWT.
  "/api/v1/external/auth/token",
];

/**
 * Path prefix owned by the External (public) API. Tokens minted for external
 * API credentials carry aud="external-api" and are confined to this prefix.
 */
const EXTERNAL_API_PREFIX = "/api/v1/external";
const EXTERNAL_API_AUDIENCE = "external-api";

/**
 * Check if the request path matches any public path
 * @param {string} path - Request path
 * @returns {boolean} - True if path is public
 */
function isPublicPath(path) {
  return publicPaths.some((publicPath) => {
    // Exact match, or a true sub-path. Must NOT be a bare startsWith: that
    // would make "/api/v1/external/auth/token" whitelist the sibling
    // "/api/v1/external/auth/token-credentials" style paths too.
    return path === publicPath || path.startsWith(`${publicPath}/`);
  });
}

/**
 * True when the request targets the External (public) API.
 */
function isExternalApiPath(path) {
  return (
    path === EXTERNAL_API_PREFIX || path.startsWith(`${EXTERNAL_API_PREFIX}/`)
  );
}

/**
 * Reject a request in the envelope appropriate to its surface.
 *
 * The External API is a public contract, so its failures must use the public
 * error shape even when the gateway rejects them before they reach the service.
 */
function reject(req, res, statusCode, code, message, externalType) {
  if (isExternalApiPath(req.path)) {
    return res.status(statusCode).json({
      success: false,
      error: {
        type: externalType || "authentication_error",
        code: code.toLowerCase(),
        message,
      },
      request_id: null,
    });
  }

  return res.status(statusCode).json({
    status: "error",
    error: { code, message },
    meta: { timestamp: new Date().toISOString(), path: req.path },
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
      return reject(
        req,
        res,
        401,
        "NO_TOKEN",
        "No authentication token provided",
      );
    }

    // Check for Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      logger.warn(`Invalid authorization header format for ${req.path}`, {
        ip: req.ip,
      });
      return reject(
        req,
        res,
        401,
        "INVALID_TOKEN_FORMAT",
        "Authorization header must be in format: Bearer <token>",
      );
    }

    // Extract token
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return reject(
        req,
        res,
        401,
        "NO_TOKEN",
        "No authentication token provided",
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ==================================================================
    // Audience <-> path binding.
    //
    // Every token in this system is signed with the same JWT_SECRET, so
    // without this check an External API token would be accepted by every
    // internal service too (wallet, users, ...) - turning an API key leak
    // into a full account takeover. The gateway is the only public ingress,
    // so this is the one place the confinement can be enforced.
    // ==================================================================
    const isExternalPath = isExternalApiPath(req.path);
    const isExternalToken = decoded.aud === EXTERNAL_API_AUDIENCE;

    if (isExternalToken && !isExternalPath) {
      logger.warn(`External API token rejected outside its scope`, {
        path: req.path,
        userId: decoded.userId,
        apiCredentialId: decoded.apiCredentialId,
      });
      return reject(
        req,
        res,
        401,
        "EXTERNAL_TOKEN_PATH_SCOPE",
        "This token is only valid for the External API (/api/v1/external/*).",
      );
    }

    if (isExternalPath && !isExternalToken) {
      logger.warn(`Session token rejected on External API path`, {
        path: req.path,
        userId: decoded.userId,
      });
      return reject(
        req,
        res,
        401,
        "SESSION_TOKEN_NOT_ALLOWED",
        "The External API requires a token issued by POST /api/v1/external/auth/token.",
      );
    }

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
      return reject(
        req,
        res,
        401,
        "TOKEN_EXPIRED",
        "Authentication token has expired",
      );
    }

    if (error.name === "JsonWebTokenError") {
      return reject(
        req,
        res,
        401,
        "INVALID_TOKEN",
        "Invalid authentication token",
      );
    }

    if (error.name === "NotBeforeError") {
      return reject(
        req,
        res,
        401,
        "TOKEN_NOT_ACTIVE",
        "Token is not yet active",
      );
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
