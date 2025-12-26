// Use shared validation middleware
const { validate } = require("../shared/lib/validation");

/**
 * Validate request body against a Joi schema
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: error.details[0].message,
          details: error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message,
          })),
        },
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Validate request params against a Joi schema
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: error.details[0].message,
          details: error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message,
          })),
        },
      });
    }

    req.params = value;
    next();
  };
};

/**
 * Validate request query against a Joi schema
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: error.details[0].message,
          details: error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message,
          })),
        },
      });
    }

    req.query = value;
    next();
  };
};

// Export validation functions
module.exports = {
  validate,
  validateBody,
  validateParams,
  validateQuery,
};
