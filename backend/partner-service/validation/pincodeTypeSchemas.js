/**
 * Validation Schemas for Pincode Type Management (Simplified)
 *
 * Joi validation schemas for pincode type CRUD endpoints.
 * Following auth-service patterns with comprehensive validation rules.
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

// UUID validation pattern
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reusable field schemas
const schemas = {
  uuid: Joi.string().pattern(uuidPattern).required().messages({
    "string.pattern.base": "Invalid UUID format",
    "any.required": "UUID is required",
  }),
};

// ========================================
// PINCODE TYPE CRUD SCHEMAS
// ========================================

/**
 * POST /api/v1/pincode-types - Create Pincode Type
 */
const createPincodeTypeSchema = {
  body: Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[A-Za-z0-9_-]+$/)
      .required()
      .messages({
        "string.min": "Name must be at least 2 characters",
        "string.max": "Name cannot exceed 50 characters",
        "string.pattern.base":
          "Name can only contain letters, numbers, underscores, and hyphens",
        "any.required": "Name is required",
      }),

    type: Joi.string().valid("yes_no", "number").required().messages({
      "any.only": "Type must be either 'yes_no' or 'number'",
      "any.required": "Type is required",
    }),

    isActive: Joi.boolean().optional().default(true).messages({
      "boolean.base": "isActive must be a boolean",
    }),
  }),
};

/**
 * GET /api/v1/pincode-types - List Pincode Types
 */
const listPincodeTypesSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
    search: Joi.string().max(50).optional().messages({
      "string.max": "Search term cannot exceed 50 characters",
    }),
    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
    sortBy: Joi.string()
      .valid("name", "type", "createdAt", "updatedAt")
      .optional()
      .default("createdAt")
      .messages({
        "any.only": "sortBy must be one of: name, type, createdAt, updatedAt",
      }),
    sortOrder: Joi.string()
      .valid("asc", "desc")
      .optional()
      .default("desc")
      .messages({
        "any.only": "sortOrder must be either 'asc' or 'desc'",
      }),
  }),
};

/**
 * GET /api/v1/pincode-types/:id - Get Pincode Type by ID
 */
const getPincodeTypeByIdSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/pincode-types/:id - Update Pincode Type
 */
const updatePincodeTypeSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[A-Za-z0-9_-]+$/)
      .optional()
      .messages({
        "string.min": "Name must be at least 2 characters",
        "string.max": "Name cannot exceed 50 characters",
        "string.pattern.base":
          "Name can only contain letters, numbers, underscores, and hyphens",
      }),

    type: Joi.string().valid("yes_no", "number").optional().messages({
      "any.only": "Type must be either 'yes_no' or 'number'",
    }),

    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
  })
    .min(1)
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};

/**
 * DELETE /api/v1/pincode-types/:id - Delete (soft) Pincode Type
 */
const deletePincodeTypeSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

module.exports = {
  createPincodeTypeSchema,
  listPincodeTypesSchema,
  getPincodeTypeByIdSchema,
  updatePincodeTypeSchema,
  deletePincodeTypeSchema,
};
