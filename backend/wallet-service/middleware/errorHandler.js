const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
} = require("../shared/lib/errors");

const errorHandler = (error, req, res, _next) => {
  logger.error("Unhandled error:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Handle known operational errors
  if (error.isOperational) {
    return res
      .status(error.statusCode)
      .json(APIResponse.error(error.message, error.statusCode, error.details));
  }

  // Handle Joi validation errors
  if (error.isJoi) {
    const details = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res
      .status(400)
      .json(APIResponse.error("Validation failed", 400, details));
  }

  // Handle Prisma errors
  if (error.code === "P2002") {
    return res
      .status(409)
      .json(APIResponse.error("Resource already exists", 409));
  }

  if (error.code === "P2025") {
    return res.status(404).json(APIResponse.error("Resource not found", 404));
  }

  if (error.code && error.code.startsWith("P")) {
    return res
      .status(400)
      .json(APIResponse.error("Database operation failed", 400));
  }

  // Handle JWT errors
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json(APIResponse.error("Invalid token", 401));
  }

  if (error.name === "TokenExpiredError") {
    return res.status(401).json(APIResponse.error("Token expired", 401));
  }

  // Handle custom application errors
  if (error instanceof ValidationError) {
    return res
      .status(400)
      .json(APIResponse.error(error.message, 400, error.details));
  }

  if (error instanceof AuthenticationError) {
    return res.status(401).json(APIResponse.error(error.message, 401));
  }

  if (error instanceof AuthorizationError) {
    return res.status(403).json(APIResponse.error(error.message, 403));
  }

  // Handle external API errors
  if (error.response && error.response.status) {
    const statusCode = error.response.status;
    const message = error.response.data?.message || "External service error";

    return res
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .json(APIResponse.error(message, statusCode));
  }

  // Handle network errors
  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    return res
      .status(503)
      .json(APIResponse.error("Service temporarily unavailable", 503));
  }

  // Unknown error - don't leak details in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message;

  return res.status(500).json(APIResponse.error(message, 500));
};

module.exports = {
  errorHandler,
};
