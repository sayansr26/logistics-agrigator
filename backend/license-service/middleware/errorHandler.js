const logger = require("../shared/lib/logger");
const {
  APIError,
  errorUtils,
} = require("../shared/lib/errors");

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error("Error occurred:", {
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  });

  // If response already sent, pass to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Prisma errors
  if (err.code && err.code.startsWith("P")) {
    const prismaError = errorUtils.handlePrismaError(err);
    return res
      .status(prismaError.statusCode)
      .json(errorUtils.formatErrorResponse(prismaError));
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      status: "error",
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
      },
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      error: {
        code: "TOKEN_EXPIRED",
        message: "Authentication token has expired",
      },
    });
  }

  // Handle Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      status: "error",
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      },
    });
  }

  // Handle APIError instances
  if (err instanceof APIError) {
    return res.status(err.statusCode).json(errorUtils.formatErrorResponse(err));
  }

  // Default server error
  res.status(500).json({
    status: "error",
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    },
  });
};

module.exports = { errorHandler };
