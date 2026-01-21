/**
 * Validation Schemas for Pincode Type Management
 *
 * Joi validation schemas for all pincode type endpoints.
 * Following auth-service patterns with comprehensive validation rules.
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

// UUID validation pattern
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pincode validation pattern (6 digits)
const pincodePattern = /^\d{6}$/;

// Reusable field schemas
const schemas = {
  uuid: Joi.string().pattern(uuidPattern).required().messages({
    "string.pattern.base": "Invalid UUID format",
    "any.required": "UUID is required",
  }),

  uuidOptional: Joi.string().pattern(uuidPattern).optional().messages({
    "string.pattern.base": "Invalid UUID format",
  }),

  pincode: Joi.string().pattern(pincodePattern).required().messages({
    "string.pattern.base": "Pincode must be 6 digits",
    "any.required": "Pincode is required",
  }),

  pincodeOptional: Joi.string().pattern(pincodePattern).optional().messages({
    "string.pattern.base": "Pincode must be 6 digits",
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

    description: Joi.string().max(255).optional().allow(null, "").messages({
      "string.max": "Description cannot exceed 255 characters",
    }),

    isActive: Joi.boolean().optional().default(true).messages({
      "boolean.base": "isActive must be a boolean",
    }),

    // Required: At least one pincode must be assigned
    pincodeCodes: Joi.array()
      .items(schemas.pincode)
      .min(1)
      .max(1000)
      .required()
      .messages({
        "array.min": "At least one pincode is required",
        "array.max": "Cannot assign more than 1000 pincodes at once",
        "any.required": "pincodeCodes array is required",
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
      .valid("name", "createdAt", "updatedAt")
      .optional()
      .default("createdAt")
      .messages({
        "any.only": "sortBy must be one of: name, createdAt, updatedAt",
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

    description: Joi.string().max(255).optional().allow(null, "").messages({
      "string.max": "Description cannot exceed 255 characters",
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

// ========================================
// PINCODE ASSIGNMENT SCHEMAS
// ========================================

/**
 * POST /api/v1/pincode-types/:id/assign - Bulk Assign Pincodes
 */
const assignPincodesSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    pincodeCodes: Joi.array()
      .items(schemas.pincode)
      .min(1)
      .max(1000)
      .required()
      .messages({
        "array.min": "At least one pincode is required",
        "array.max": "Cannot assign more than 1000 pincodes at once",
        "any.required": "pincodeCodes array is required",
      }),
  }),
};

/**
 * DELETE /api/v1/pincode-types/:id/unassign - Bulk Unassign Pincodes
 */
const unassignPincodesSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    pincodeCodes: Joi.array()
      .items(schemas.pincode)
      .min(1)
      .max(1000)
      .required()
      .messages({
        "array.min": "At least one pincode is required",
        "array.max": "Cannot unassign more than 1000 pincodes at once",
        "any.required": "pincodeCodes array is required",
      }),
  }),
};

/**
 * GET /api/v1/pincode-types/:id/pincodes - Get Assigned Pincodes
 */
const getAssignedPincodesSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(1000).default(100).messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 1000",
    }),
    search: Joi.string().max(6).optional().messages({
      "string.max": "Search term cannot exceed 6 characters",
    }),
  }),
};

/**
 * GET /api/v1/pincodes/:code/types - Get Types for a Pincode
 */
const getTypesByPincodeSchema = {
  params: Joi.object({
    code: schemas.pincode,
  }),
  query: Joi.object({}),
};

module.exports = {
  createPincodeTypeSchema,
  listPincodeTypesSchema,
  getPincodeTypeByIdSchema,
  updatePincodeTypeSchema,
  deletePincodeTypeSchema,
  assignPincodesSchema,
  unassignPincodesSchema,
  getAssignedPincodesSchema,
  getTypesByPincodeSchema,
};
