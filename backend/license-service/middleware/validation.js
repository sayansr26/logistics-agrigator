const Joi = require('joi');
const { ValidationError } = require('../shared/lib/errors');
const logger = require('../shared/lib/logger');

/**
 * Middleware to validate request body/query/params against Joi schema
 */
function validateRequest(schema, source = 'body') {
  return async (req, res, next) => {
    try {
      const dataToValidate = req[source];

      if (!dataToValidate) {
        throw new ValidationError(`No ${source} data provided`);
      }

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false, // Return all errors, not just the first
        stripUnknown: true, // Remove unknown keys
        convert: true // Type conversion
      });

      if (error) {
        const details = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Validation error:', {
          source,
          errors: details,
          requestId: req.requestId
        });

        throw new ValidationError('Validation failed', details);
      }

      // Replace with validated and sanitized data
      req[source] = value;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
const commonSchemas = {
  uuid: Joi.string().uuid(),
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  ipAddress: Joi.string().ip(),
  url: Joi.string().uri(),
  date: Joi.date().iso(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

/**
 * License-specific validation schemas
 */
const licenseSchemas = {
  licenseKey: Joi.string().min(100).required(),
  machineId: Joi.string().hex().length(64),
  licenseType: Joi.string().valid('TRIAL', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'),
  subscriptionPlan: Joi.string().valid('MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'COMMISSION_BASED', 'PAY_AS_YOU_GO'),
  licenseStatus: Joi.string().valid('INACTIVE', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'),
  billingCycle: Joi.string().valid('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'LIFETIME', 'CUSTOM'),
  paymentMethod: Joi.string().valid('MANUAL', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'UPI', 'PAYPAL', 'RAZORPAY', 'STRIPE', 'CRYPTO')
};

/**
 * Custom validation functions
 */
const customValidators = {
  /**
   * Validate license key format
   */
  isValidLicenseKey: (value) => {
    try {
      const parts = value.split('.');
      return parts.length >= 4;
    } catch {
      return false;
    }
  },

  /**
   * Validate machine ID format
   */
  isValidMachineId: (value) => {
    return /^[a-f0-9]{64}$/.test(value);
  },

  /**
   * Validate IP address range
   */
  isValidIPRange: (value) => {
    const ipRangeRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    return ipRangeRegex.test(value);
  }
};

/**
 * Sanitization functions
 */
const sanitizers = {
  /**
   * Sanitize string input
   */
  sanitizeString: (value) => {
    if (typeof value !== 'string') return value;
    return value.trim().replace(/[<>]/g, '');
  },

  /**
   * Sanitize email
   */
  sanitizeEmail: (value) => {
    if (typeof value !== 'string') return value;
    return value.toLowerCase().trim();
  },

  /**
   * Sanitize array of strings
   */
  sanitizeStringArray: (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => sanitizers.sanitizeString(item)).filter(Boolean);
  }
};

module.exports = {
  validateRequest,
  commonSchemas,
  licenseSchemas,
  customValidators,
  sanitizers
};