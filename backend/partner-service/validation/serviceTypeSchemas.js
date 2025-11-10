/**
 * Validation Schemas for Service Type Management
 *
 * Joi validation schemas for all service type endpoints.
 * Following auth-service patterns with comprehensive validation rules.
 */

const Joi = require("joi");

// ========================================
// SERVICE TYPE VALIDATION SCHEMAS
// ========================================

/**
 * Create Service Type Schema
 * Validates data for creating a new service type
 */
const createServiceTypeSchema = {
  body: Joi.object({
    name: Joi.string()
      .uppercase()
      .pattern(/^[A-Z0-9_]{2,50}$/)
      .required()
      .messages({
        "string.pattern.base":
          "Name must be uppercase alphanumeric (2-50 characters)",
        "any.required": "Name is required",
      }),

    displayName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Display name must be at least 2 characters",
      "string.max": "Display name cannot exceed 100 characters",
      "any.required": "Display name is required",
    }),

    category: Joi.string()
      .valid("LOGISTICS", "PAYMENT", "LOCATION", "SPECIAL")
      .required()
      .messages({
        "any.only":
          "Category must be one of: LOGISTICS, PAYMENT, LOCATION, SPECIAL",
        "any.required": "Category is required",
      }),

    description: Joi.string().max(500).optional().allow(null, "").messages({
      "string.max": "Description cannot exceed 500 characters",
    }),

    isAvailable: Joi.boolean().optional().default(true).messages({
      "boolean.base": "isAvailable must be a boolean",
    }),

    baseCharge: Joi.string()
      .pattern(/^\d+(\.\d{1,2})?$/)
      .optional()
      .default("0")
      .messages({
        "string.pattern.base": "Base charge must be a valid decimal number",
      }),

    sortOrder: Joi.number()
      .integer()
      .min(0)
      .max(9999)
      .optional()
      .default(100)
      .messages({
        "number.base": "Sort order must be a number",
        "number.min": "Sort order must be at least 0",
        "number.max": "Sort order cannot exceed 9999",
      }),

    additionalInfo: Joi.object().optional().default({}).messages({
      "object.base": "Additional info must be an object",
    }),
  }),
};

/**
 * Update Service Type Schema
 * Validates data for updating an existing service type
 */
const updateServiceTypeSchema = {
  params: Joi.object({
    id: Joi.string()
      .pattern(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
      .required()
      .messages({
        "string.pattern.base": "ID must be a valid UUID",
        "any.required": "ID is required",
      }),
  }),
  body: Joi.object({
    displayName: Joi.string().min(2).max(100).optional().messages({
      "string.min": "Display name must be at least 2 characters",
      "string.max": "Display name cannot exceed 100 characters",
    }),

    category: Joi.string()
      .valid("LOGISTICS", "PAYMENT", "LOCATION", "SPECIAL")
      .optional()
      .messages({
        "any.only":
          "Category must be one of: LOGISTICS, PAYMENT, LOCATION, SPECIAL",
      }),

    description: Joi.string().max(500).optional().allow(null, "").messages({
      "string.max": "Description cannot exceed 500 characters",
    }),

    isAvailable: Joi.boolean().optional().messages({
      "boolean.base": "isAvailable must be a boolean",
    }),

    baseCharge: Joi.string()
      .pattern(/^\d+(\.\d{1,2})?$/)
      .optional()
      .messages({
        "string.pattern.base": "Base charge must be a valid decimal number",
      }),

    sortOrder: Joi.number().integer().min(0).max(9999).optional().messages({
      "number.base": "Sort order must be a number",
      "number.min": "Sort order must be at least 0",
      "number.max": "Sort order cannot exceed 9999",
    }),

    additionalInfo: Joi.object().optional().messages({
      "object.base": "Additional info must be an object",
    }),
  })
    .min(1)
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};

/**
 * Query Service Types Schema
 * Validates query parameters for listing service types
 */
const queryServiceTypesSchema = {
  query: Joi.object({
    search: Joi.string().max(100).optional().messages({
      "string.max": "Search term cannot exceed 100 characters",
    }),

    category: Joi.string()
      .valid("LOGISTICS", "PAYMENT", "LOCATION", "SPECIAL")
      .optional()
      .messages({
        "any.only":
          "Category must be one of: LOGISTICS, PAYMENT, LOCATION, SPECIAL",
      }),

    status: Joi.string()
      .valid("ACTIVE", "INACTIVE", "ALL")
      .optional()
      .default("ACTIVE")
      .messages({
        "any.only": "Status must be one of: ACTIVE, INACTIVE, ALL",
      }),

    page: Joi.number().integer().min(1).optional().default(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),

    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .messages({
        "number.base": "Limit must be a number",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),

    sortBy: Joi.string()
      .valid(
        "name",
        "displayName",
        "category",
        "sortOrder",
        "createdAt",
        "updatedAt",
      )
      .optional()
      .default("sortOrder")
      .messages({
        "any.only":
          "sortBy must be one of: name, displayName, category, sortOrder, createdAt, updatedAt",
      }),

    sortOrder: Joi.string()
      .valid("asc", "desc")
      .optional()
      .default("asc")
      .messages({
        "any.only": "sortOrder must be either 'asc' or 'desc'",
      }),
  }),
};

/**
 * Service Type ID Parameter Schema
 * Validates the ID parameter in URL paths
 */
const serviceTypeIdParamSchema = {
  params: Joi.object({
    id: Joi.string()
      .pattern(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
      .required()
      .messages({
        "string.pattern.base": "ID must be a valid UUID",
        "any.required": "ID is required",
      }),
  }),
};

module.exports = {
  createServiceTypeSchema,
  updateServiceTypeSchema,
  queryServiceTypesSchema,
  serviceTypeIdParamSchema,
};
