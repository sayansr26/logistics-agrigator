/**
 * Validation Schemas for Pincode Type Service Charge Management
 *
 * Joi validation schemas for all pincode type service charge endpoints.
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

  uuidOptional: Joi.string().pattern(uuidPattern).optional().messages({
    "string.pattern.base": "Invalid UUID format",
  }),

  // For Partner ID (CUID format)
  cuid: Joi.string().required().messages({
    "any.required": "Partner ID is required",
  }),

  cuidOptional: Joi.string().optional().messages({}),
};

// ========================================
// PINCODE TYPE SERVICE CHARGE CRUD SCHEMAS
// ========================================

/**
 * POST /api/v1/pincode-type-service-charges - Create Charge(s)
 * Supports bulk creation: multiple pincode types x multiple partners
 */
const createChargeSchema = {
  body: Joi.object({
    pincodeTypeIds: Joi.array().items(schemas.uuid).min(1).required().messages({
      "array.min": "At least one pincode type is required",
      "any.required": "Pincode type IDs array is required",
    }),

    partnerIds: Joi.array().items(schemas.cuid).min(1).required().messages({
      "array.min": "At least one partner is required",
      "any.required": "Partner IDs array is required",
    }),

    baseCharge: Joi.number().positive().precision(2).required().messages({
      "number.base": "Base charge must be a number",
      "number.positive": "Base charge must be greater than 0",
      "number.precision": "Base charge can have maximum 2 decimal places",
      "any.required": "Base charge is required",
    }),

    isActive: Joi.boolean().optional().default(true).messages({
      "boolean.base": "isActive must be a boolean",
    }),
  }),
};

/**
 * GET /api/v1/pincode-type-service-charges - List All Charges
 */
const listChargesSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),

    limit: Joi.number().integer().min(1).max(100).optional().messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),

    pincodeTypeId: schemas.uuidOptional,

    partnerId: schemas.cuidOptional,

    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),

    sortBy: Joi.string()
      .valid("baseCharge", "createdAt", "updatedAt")
      .optional()
      .default("createdAt")
      .messages({
        "any.only": "sortBy must be one of: baseCharge, createdAt, updatedAt",
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
 * GET /api/v1/pincode-type-service-charges/:id - Get Charge by ID
 */
const getChargeByIdSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/pincode-type-service-charges/:id - Update Charge
 */
const updateChargeSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),

  body: Joi.object({
    baseCharge: Joi.number().positive().precision(2).optional().messages({
      "number.base": "Base charge must be a number",
      "number.positive": "Base charge must be greater than 0",
      "number.precision": "Base charge can have maximum 2 decimal places",
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
 * DELETE /api/v1/pincode-type-service-charges/:id - Soft Delete Charge
 */
const deleteChargeSchema = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * GET /api/v1/pincode-type-service-charges/type/:pincodeTypeId - Get Charges by Pincode Type
 */
const getChargesByPincodeTypeSchema = {
  params: Joi.object({
    pincodeTypeId: schemas.uuid,
  }),

  query: Joi.object({
    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
  }),
};

/**
 * GET /api/v1/pincode-type-service-charges/partner/:partnerId - Get Charges by Partner
 */
const getChargesByPartnerSchema = {
  params: Joi.object({
    partnerId: schemas.cuid,
  }),

  query: Joi.object({
    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
  }),
};

module.exports = {
  createChargeSchema,
  listChargesSchema,
  getChargeByIdSchema,
  updateChargeSchema,
  deleteChargeSchema,
  getChargesByPincodeTypeSchema,
  getChargesByPartnerSchema,
};
