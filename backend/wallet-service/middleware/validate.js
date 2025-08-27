const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Include all errors
      stripUnknown: true, // Remove unknown fields
      convert: true, // Convert types where possible
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      logger.warn("Validation failed", {
        property,
        details,
        url: req.url,
        method: req.method,
        userId: req.user?.id,
      });

      return res
        .status(400)
        .json(APIResponse.error("Validation failed", 400, details));
    }

    // Replace the original property with the validated (and potentially transformed) value
    req[property] = value;
    next();
  };
};

/**
 * Validate request body
 * @param {Object} schema - Joi schema for request body
 * @returns {Function} Express middleware
 */
const validateBody = (schema) => validate(schema, "body");

/**
 * Validate request parameters
 * @param {Object} schema - Joi schema for request params
 * @returns {Function} Express middleware
 */
const validateParams = (schema) => validate(schema, "params");

/**
 * Validate request query parameters
 * @param {Object} schema - Joi schema for request query
 * @returns {Function} Express middleware
 */
const validateQuery = (schema) => validate(schema, "query");

module.exports = {
  validate,
  validateBody,
  validateParams,
  validateQuery,
};
