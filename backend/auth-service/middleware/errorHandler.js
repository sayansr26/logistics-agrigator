// Use shared error handling utilities
const { errorUtils } = require("../shared/lib/errors");
const APIResponse = require("../shared/lib/response");

const errorHandler = (err, req, res, next) => {
  console.error("Auth Service Error:", err.stack);

  // Handle Prisma errors
  if (err.code && err.code.startsWith("P")) {
    const prismaError = errorUtils.handlePrismaError(err);
    const errorResponse = errorUtils.formatErrorResponse(prismaError);
    return res.status(prismaError.statusCode).json(errorResponse);
  }

  // Handle PostgreSQL errors
  if (err.code === "23505") {
    // Unique constraint violation
    const errorResponse = APIResponse.error(
      "Resource already exists",
      "DUPLICATE_ENTRY",
      null,
      409,
    );
    return res.status(409).json(errorResponse);
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    const errorResponse = APIResponse.error(
      "Invalid token",
      "INVALID_TOKEN",
      null,
      401,
    );
    return res.status(401).json(errorResponse);
  }

  if (err.name === "TokenExpiredError") {
    const errorResponse = APIResponse.error(
      "Token has expired",
      "TOKEN_EXPIRED",
      null,
      401,
    );
    return res.status(401).json(errorResponse);
  }

  // Handle custom API errors
  if (errorUtils.isOperationalError(err)) {
    const errorResponse = errorUtils.formatErrorResponse(err);
    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle unexpected errors
  const errorResponse = APIResponse.error(
    "Internal server error",
    "INTERNAL_ERROR",
    null,
    500,
  );
  res.status(500).json(errorResponse);
};

module.exports = { errorHandler };
