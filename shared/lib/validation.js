const Joi = require("joi");

// Common validation schemas
const schemas = {
  // User validation
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])"))
    .required(),
  phone: Joi.string()
    .pattern(/^\+91-[0-9]{10}$/)
    .required(),

  // Address validation
  pincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),

  // Common fields
  uuid: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  // Shipment validation
  weight: Joi.number().positive().max(50).required(),
  dimensions: Joi.object({
    length: Joi.number().positive().max(100).required(),
    width: Joi.number().positive().max(100).required(),
    height: Joi.number().positive().max(100).required(),
  }),

  // Financial validation
  amount: Joi.number().positive().max(100000).required(),
  currency: Joi.string().valid("INR").default("INR"),
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    // Handle both simple Joi schemas and complex schemas with query/params/body
    const errors = [];

    // Check if schema is a direct Joi schema (has validate method)
    if (typeof schema.validate === "function") {
      // Simple schema - validate body only (backward compatible)
      const { error } = schema.validate(req.body);
      if (error) {
        errors.push(...error.details);
      }
    } else {
      // Complex schema with query/params/body properties
      if (schema.query) {
        const { error } = schema.query.validate(req.query);
        if (error) {
          errors.push(...error.details);
        }
      }

      if (schema.params) {
        const { error } = schema.params.validate(req.params);
        if (error) {
          errors.push(...error.details);
        }
      }

      if (schema.body) {
        const { error } = schema.body.validate(req.body);
        if (error) {
          errors.push(...error.details);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: errors,
        },
      });
    }

    next();
  };
};

module.exports = {
  schemas,
  validate,
};
