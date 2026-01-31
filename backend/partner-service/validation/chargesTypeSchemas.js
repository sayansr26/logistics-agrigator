/**
 * Validation Schemas for Charges Type Management
 *
 * Joi validation schemas for charges type CRUD endpoints.
 * Following auth-service patterns with comprehensive validation rules.
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

// UUID validation pattern
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CUID validation pattern (for partnerId)
// Prisma CUIDs are 25 characters: [a-z][a-z0-9]{24}
const cuidPattern = /^[a-z][a-z0-9]{24}$/;

// Reusable field schemas
const schemas = {
  uuid: Joi.string().pattern(uuidPattern).required().messages({
    "string.pattern.base": "Invalid UUID format",
    "any.required": "UUID is required",
  }),
  cuid: Joi.string().pattern(cuidPattern).required().messages({
    "string.pattern.base": "Invalid CUID format for partnerId",
    "any.required": "Partner ID is required",
  }),
};

// ========================================
// CHARGES TYPE CRUD SCHEMAS
// ========================================

/**
 * POST /api/v1/charges-types - Create Charges Type
 */
const createChargesTypeSchema = {
  body: Joi.object({
    partnerId: Joi.string().pattern(cuidPattern).required().messages({
      "string.pattern.base": "Invalid partner ID format (must be a valid CUID)",
      "any.required": "Partner ID is required",
    }),

    name: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*$/)
      .required()
      .messages({
        "string.min": "Name must be at least 2 characters",
        "string.max": "Name cannot exceed 100 characters",
        "string.pattern.base":
          "Name can only contain letters, numbers, underscores, hyphens, and spaces",
        "any.required": "Name is required",
      }),

    isActive: Joi.boolean().optional().default(true).messages({
      "boolean.base": "isActive must be a boolean",
    }),
  }),
};

/**
 * GET /api/v1/charges-types - List Charges Types
 */
const listChargesTypesSchema = {
  query: Joi.object({
    partnerId: Joi.string().pattern(cuidPattern).optional().messages({
      "string.pattern.base": "Invalid partner ID format (must be a valid CUID)",
    }),
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
    search: Joi.string().max(100).optional().messages({
      "string.max": "Search term cannot exceed 100 characters",
    }),
    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
    sortBy: Joi.string()
      .valid("name", "partnerId", "isActive", "createdAt", "updatedAt")
      .optional()
      .default("createdAt")
      .messages({
        "any.only":
          "sortBy must be one of: name, partnerId, isActive, createdAt, updatedAt",
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
 * GET /api/v1/charges-types/:id - Get Charges Type by ID
 */
const getChargesTypeByIdSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/charges-types/:id - Update Charges Type
 */
const updateChargesTypeSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*$/)
      .optional()
      .messages({
        "string.min": "Name must be at least 2 characters",
        "string.max": "Name cannot exceed 100 characters",
        "string.pattern.base":
          "Name can only contain letters, numbers, underscores, hyphens, and spaces",
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
 * DELETE /api/v1/charges-types/:id - Delete (soft) Charges Type
 */
const deleteChargesTypeSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

module.exports = {
  createChargesTypeSchema,
  listChargesTypesSchema,
  getChargesTypeByIdSchema,
  updateChargesTypeSchema,
  deleteChargesTypeSchema,
};
