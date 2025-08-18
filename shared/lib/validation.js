const Joi = require('joi');

// Common validation schemas
const schemas = {
  // User validation
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required(),
  phone: Joi.string().pattern(/^\+91-[0-9]{10}$/).required(),
  
  // Address validation
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
  
  // Common fields
  uuid: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),
  
  // Shipment validation
  weight: Joi.number().positive().max(50).required(),
  dimensions: Joi.object({
    length: Joi.number().positive().max(100).required(),
    width: Joi.number().positive().max(100).required(),
    height: Joi.number().positive().max(100).required()
  }),
  
  // Financial validation
  amount: Joi.number().positive().max(100000).required(),
  currency: Joi.string().valid('INR').default('INR')
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details
        }
      });
    }
    next();
  };
};

module.exports = {
  schemas,
  validate
};