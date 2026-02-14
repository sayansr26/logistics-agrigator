/**
 * Validation Schemas for Partner Pincode Assignment
 *
 * Joi validation schemas for partner pincode assignment CRUD endpoints.
 * Following existing validation patterns from pincodeTypeSchemas.js
 */

const Joi = require("joi");

/**
 * POST /api/partners/:partnerId/pincodes
 * Assign pincode to partner with type values
 */
const assignPartnerPincodeSchema = {
  body: Joi.object({
    pincodeId: Joi.string().uuid().required().messages({
      "string.guid": "Pincode ID must be a valid UUID",
      "any.required": "Pincode ID is required",
    }),
    pincodeTypeValues: Joi.array()
      .items(
        Joi.object({
          pincodeTypeId: Joi.string().uuid().required().messages({
            "string.guid": "Pincode Type ID must be a valid UUID",
            "any.required": "Pincode Type ID is required",
          }),
          value: Joi.string().max(255).required().messages({
            "any.required": "Value is required",
            "string.max": "Value must not exceed 255 characters",
          }),
        }),
      )
      .optional()
      .messages({
        "array.base": "Pincode type values must be an array",
      }),
  }).messages({
    "object.unknown": "Unknown field in request body",
  }),

  params: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),
  }).messages({
    "object.unknown": "Unknown field in request params",
  }),
};

/**
 * GET /api/partners/:partnerId/pincodes
 * List assigned pincodes for a partner with pagination
 */
const listPartnerPincodesSchema = {
  params: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),
  }).messages({
    "object.unknown": "Unknown field in request params",
  }),

  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).optional().messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit must not exceed 100",
      }),
    search: Joi.string()
      .max(6)
      .pattern(/^[0-9]*$/)
      .optional()
      .messages({
        "string.max": "Search term must not exceed 6 characters",
        "string.pattern.base": "Search term must contain only numbers",
      }),
    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
    sortBy: Joi.string()
      .valid("pincodeCode", "city", "state", "createdAt", "updatedAt")
      .default("createdAt")
      .optional()
      .messages({
        "any.only":
          "sortBy must be one of: pincodeCode, city, state, createdAt, updatedAt",
      }),
    sortOrder: Joi.string()
      .valid("asc", "desc")
      .default("desc")
      .optional()
      .messages({
        "any.only": "sortOrder must be either 'asc' or 'desc'",
      }),
  }).messages({
    "object.unknown": "Unknown field in query parameters",
  }),
};

/**
 * GET /api/partners/:partnerId/pincodes/:id
 * Get specific pincode assignment by ID
 */
const getPartnerPincodeByIdSchema = {
  params: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),
    id: Joi.string().uuid().required().messages({
      "string.guid": "Assignment ID must be a valid UUID",
      "any.required": "Assignment ID is required",
    }),
  }).messages({
    "object.unknown": "Unknown field in request params",
  }),
};

/**
 * PUT /api/partners/:partnerId/pincodes/:id
 * Update pincode assignment type values
 */
const updatePartnerPincodeSchema = {
  params: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),
    id: Joi.string().uuid().required().messages({
      "string.guid": "Assignment ID must be a valid UUID",
      "any.required": "Assignment ID is required",
    }),
  }).messages({
    "object.unknown": "Unknown field in request params",
  }),

  body: Joi.object({
    pincodeTypeValues: Joi.array()
      .items(
        Joi.object({
          pincodeTypeId: Joi.string().uuid().required().messages({
            "string.guid": "Pincode Type ID must be a valid UUID",
            "any.required": "Pincode Type ID is required",
          }),
          value: Joi.string().max(255).required().messages({
            "any.required": "Value is required",
            "string.max": "Value must not exceed 255 characters",
          }),
        }),
      )
      .optional()
      .messages({
        "array.base": "Pincode type values must be an array",
      }),
    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
  }).messages({
    "object.unknown": "Unknown field in request body",
  }),
};

/**
 * DELETE /api/partners/:partnerId/pincodes/:id
 * Soft delete pincode assignment (set isActive to false)
 */
const deletePartnerPincodeSchema = {
  params: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),
    id: Joi.string().uuid().required().messages({
      "string.guid": "Assignment ID must be a valid UUID",
      "any.required": "Assignment ID is required",
    }),
  }).messages({
    "object.unknown": "Unknown field in request params",
  }),
};

/**
 * GET /api/pincodes/search
 * DEPRECATED: Autocomplete search for pincodes
 * Use /api/v1/geography/pincodes/search instead.
 */
const searchPincodesSchema = {
  query: Joi.object({
    q: Joi.string()
      .min(1)
      .max(6)
      .pattern(/^[0-9]*$/)
      .optional()
      .messages({
        "string.min": "Search term must be at least 1 character",
        "string.max": "Search term must not exceed 6 characters",
        "string.pattern.base": "Search term must contain only numbers",
      }),
    code: Joi.string()
      .min(1)
      .max(6)
      .pattern(/^[0-9]*$/)
      .optional()
      .messages({
        "string.min": "Search term must be at least 1 character",
        "string.max": "Search term must not exceed 6 characters",
        "string.pattern.base": "Search term must contain only numbers",
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .default(10)
      .optional()
      .messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit must not exceed 50",
      }),
  })
    .or("q", "code")
    .messages({
      "object.unknown": "Unknown field in query parameters",
      "object.missing": "Search term 'q' or 'code' is required",
    }),
};

/**
 * POST /api/partners/:partnerId/pincodes/import
 * Bulk import pincodes from Excel file
 */
const importPincodesSchema = {
  params: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),
  }).messages({
    "object.unknown": "Unknown field in request params",
  }),

  // File validation handled by multer middleware
};

/**
 * GET /api/partners/:partnerId/pincodes/export
 * Export assigned pincodes to Excel
 */
const exportPincodesSchema = {
  params: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),
  }).messages({
    "object.unknown": "Unknown field in request params",
  }),

  query: Joi.object({
    isActive: Joi.boolean().optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
  }).messages({
    "object.unknown": "Unknown field in query parameters",
  }),
};

module.exports = {
  assignPartnerPincodeSchema,
  listPartnerPincodesSchema,
  getPartnerPincodeByIdSchema,
  updatePartnerPincodeSchema,
  deletePartnerPincodeSchema,
  searchPincodesSchema,
  importPincodesSchema,
  exportPincodesSchema,
};
