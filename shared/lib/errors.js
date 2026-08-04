// Shared error utilities and custom error classes

class APIError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends APIError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.details = details;
  }
}

class AuthenticationError extends APIError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends APIError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

class NotFoundError extends APIError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

class ConflictError extends APIError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT_ERROR");
    this.name = "ConflictError";
  }
}

// AI provider unreachable / returned unusable output. Callers must degrade
// gracefully — AI availability may never block quoting or booking.
class AiUnavailableError extends APIError {
  constructor(message = "AI provider unavailable", details = null) {
    super(message, 503, "AI_UNAVAILABLE");
    this.name = "AiUnavailableError";
    this.details = details;
  }
}

// Error handling utilities
const errorUtils = {
  // Handle Prisma errors
  handlePrismaError: (error) => {
    if (error.code === "P2002") {
      return new ConflictError("A record with this data already exists");
    }

    if (error.code === "P2025") {
      return new NotFoundError("The requested record was not found");
    }

    if (error.code === "P2003") {
      return new ValidationError("Invalid reference to related record");
    }

    return new APIError(error.message || "Database operation failed");
  },

  // Format error response
  formatErrorResponse: (error) => {
    if (error instanceof APIError) {
      return {
        status: "error",
        error: {
          code: error.code,
          message: error.message,
          details: error.details || null,
        },
      };
    }

    // Default error response
    return {
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    };
  },

  // Check if error is operational (expected)
  isOperationalError: (error) => {
    return error instanceof APIError;
  },
};

module.exports = {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  AiUnavailableError,
  errorUtils,
};
