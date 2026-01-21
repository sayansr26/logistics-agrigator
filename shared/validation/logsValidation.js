/**
 * Joi Validation Schemas for Logs API
 * Used by all services and the API Gateway
 */

const Joi = require("joi");

/**
 * Common log filter schemas
 */
const commonFilters = {
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).optional(),
  limit: Joi.number().integer().min(1).max(500).default(200),
  cursor: Joi.string().max(1000).optional(),
};

/**
 * Audit logs specific filters
 */
const auditFilters = {
  service: Joi.string()
    .valid(
      "auth-service",
      "user-service",
      "shipment-service",
      "partner-service",
      "wallet-service",
      "license-service",
      "platform-service",
      "support-service",
    )
    .optional(),
  action: Joi.string().max(100).optional(),
  resource: Joi.string().max(100).optional(),
  userId: Joi.string().uuid().optional(),
  clientId: Joi.string().uuid().optional(),
  search: Joi.string().max(500).optional(), // Free-text search
};

/**
 * Runtime logs specific filters
 */
const runtimeFilters = {
  service: Joi.string()
    .valid(
      "auth-service",
      "user-service",
      "shipment-service",
      "partner-service",
      "wallet-service",
      "license-service",
      "platform-service",
      "support-service",
      "api-gateway",
    )
    .optional(),
  level: Joi.string().valid("error", "warn", "info", "debug").optional(),
  file: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}(-error)?\.log$/)
    .optional(),
};

/**
 * Query parameter schemas for GET /audit-logs
 */
const getAuditLogsQuerySchema = Joi.object({
  ...commonFilters,
  ...auditFilters,
});

/**
 * Query parameter schemas for GET /runtime-logs
 */
const getRuntimeLogsQuerySchema = Joi.object({
  ...commonFilters,
  ...runtimeFilters,
});

/**
 * Header validation for internal requests
 */
const internalRequestHeaders = Joi.object({
  "x-internal-request": Joi.string().required(),
})
  .unknown()
  .options({ allowUnknown: true });

/**
 * Log file path validation (security)
 */
const logFileSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}(-error)?\.log$/)
  .required()
  .messages({
    "string.pattern.base":
      "Invalid log file name. Must be in format YYYY-MM-DD.log or YYYY-MM-DD-error.log",
  });

/**
 * Validation middleware factory
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message,
          })),
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.query = value;
    next();
  };
}

/**
 * Validate internal request (from Gateway)
 */
function validateInternalRequest(req, res, next) {
  const { error } = internalRequestHeaders.validate(req.headers);

  if (error) {
    return res.status(401).json({
      status: "error",
      error: {
        code: "UNAUTHORIZED",
        message: "Internal request validation failed",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  next();
}

module.exports = {
  getAuditLogsQuerySchema,
  getRuntimeLogsQuerySchema,
  logFileSchema,
  validateQuery,
  validateInternalRequest,
};
