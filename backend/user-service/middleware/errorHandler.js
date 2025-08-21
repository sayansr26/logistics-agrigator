// User Service Error Handler Middleware
// Centralized error handling following auth-service patterns

const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

// Custom error classes for user service
class UserServiceError extends Error {
  constructor(message, code = "USER_SERVICE_ERROR", statusCode = 500, details = null) {
    super(message);
    this.name = "UserServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ProfileNotFoundError extends UserServiceError {
  constructor(userId) {
    super(
      `User profile not found for user ID: ${userId}`,
      "PROFILE_NOT_FOUND",
      404,
      { userId },
    );
  }
}

class ClientNotFoundError extends UserServiceError {
  constructor(clientId) {
    super(
      `Client not found: ${clientId}`,
      "CLIENT_NOT_FOUND",
      404,
      { clientId },
    );
  }
}

class ProfileValidationError extends UserServiceError {
  constructor(field, message) {
    super(
      `Profile validation failed: ${message}`,
      "PROFILE_VALIDATION_ERROR",
      400,
      { field, message },
    );
  }
}

class ClientAccessError extends UserServiceError {
  constructor(message = "Client access denied") {
    super(message, "CLIENT_ACCESS_DENIED", 403);
  }
}

class InvitationError extends UserServiceError {
  constructor(message, details = null) {
    super(message, "INVITATION_ERROR", 400, details);
  }
}

// Main error handler middleware
const errorHandler = (error, req, res, _next) => {
  // Log the error with context
  const errorContext = {
    method: req.method,
    url: req.url,
    userId: req.user?.userId || null,
    userRole: req.user?.role || null,
    clientId: req.user?.clientId || null,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  };

  // Determine error type and response
  let statusCode = 500;
  let errorCode = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  let details = null;

  if (error instanceof UserServiceError) {
    // Custom user service errors
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
    
    // Log as warning for client errors, error for server errors
    if (statusCode >= 400 && statusCode < 500) {
      logger.warn("User service client error", { error: error.message, ...errorContext });
    } else {
      logger.error("User service error", { error: error.message, stack: error.stack, ...errorContext });
    }
  } else if (error.name === "PrismaClientKnownRequestError") {
    // Prisma database errors
    statusCode = 400;
    errorCode = "DATABASE_ERROR";
    
    switch (error.code) {
      case "P2002":
        message = "A record with this information already exists";
        errorCode = "DUPLICATE_RECORD";
        details = { constraint: error.meta?.target };
        break;
      case "P2025":
        message = "Record not found";
        errorCode = "RECORD_NOT_FOUND";
        break;
      case "P2003":
        message = "Foreign key constraint failed";
        errorCode = "FOREIGN_KEY_ERROR";
        break;
      default:
        message = "Database operation failed";
        details = { prismaCode: error.code };
    }
    
    logger.warn("Database error", { error: error.message, code: error.code, ...errorContext });
  } else if (error.name === "ValidationError") {
    // Joi validation errors
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = error.details?.[0]?.message || "Validation failed";
    details = error.details;
    
    logger.warn("Validation error", { error: message, ...errorContext });
  } else if (error.name === "JsonWebTokenError") {
    // JWT errors (should be handled by auth middleware, but just in case)
    statusCode = 401;
    errorCode = "INVALID_TOKEN";
    message = "Invalid authentication token";
    
    logger.warn("JWT error", { error: error.message, ...errorContext });
  } else if (error.name === "TokenExpiredError") {
    // JWT expiration errors
    statusCode = 401;
    errorCode = "TOKEN_EXPIRED";
    message = "Authentication token has expired";
    
    logger.warn("Token expired", { ...errorContext });
  } else {
    // Unexpected errors
    logger.error("Unexpected error", { 
      error: error.message, 
      stack: error.stack, 
      name: error.name,
      ...errorContext, 
    });
  }

  // Send error response
  const errorResponse = APIResponse.error(message, errorCode, details, statusCode);
  
  // Add service identifier
  errorResponse.meta.service = "user-service";
  errorResponse.meta.requestId = req.id || null;

  res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
const notFoundHandler = (req, res) => {
  const errorResponse = APIResponse.error(
    `Route not found: ${req.method} ${req.path}`,
    "ROUTE_NOT_FOUND",
    {
      method: req.method,
      path: req.path,
      availableRoutes: [
        "GET /health",
        "GET /api/profiles",
        "POST /api/profiles",
        "GET /api/clients",
        "POST /api/clients",
      ],
    },
    404,
  );

  errorResponse.meta.service = "user-service";
  res.status(404).json(errorResponse);
};

// Async error wrapper for route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  // Export custom error classes
  UserServiceError,
  ProfileNotFoundError,
  ClientNotFoundError,
  ProfileValidationError,
  ClientAccessError,
  InvitationError,
};
