/**
 * Validation Schemas for Charge Package Management
 *
 * Joi validation schemas for all charge-package-related endpoints.
 * Supports WEIGHT, DISTANCE, and GENERIC package types.
 * Following auth-service patterns with comprehensive validation rules.
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

// UUID validation pattern
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CUID validation pattern (for partner IDs)
const cuidPattern = /^c[a-z0-9]{24}$/i;

// Valid charge package types
const validPackageTypes = ["WEIGHT", "DISTANCE", "GENERIC"];

// Valid calc types
const validCalcTypes = [
  "FLAT",
  "PERCENTAGE_OF_COD",
  "PERCENTAGE_OF_DECLARED_VALUE",
];

// Valid appliesTo values
const validAppliesTo = ["ANY", "COD", "PREPAID"];

// Reusable field schemas
const schemas = {
  uuid: Joi.string().pattern(uuidPattern).required().messages({
    "string.pattern.base": "Invalid UUID format",
    "any.required": "UUID is required",
  }),

  uuidOptional: Joi.string().pattern(uuidPattern).optional().messages({
    "string.pattern.base": "Invalid UUID format",
  }),

  // Partner ID can be CUID format
  partnerId: Joi.string().pattern(cuidPattern).messages({
    "string.pattern.base": "Invalid partner ID format (must be CUID)",
  }),

  partnerIdOptional: Joi.string().pattern(cuidPattern).optional().messages({
    "string.pattern.base": "Invalid partner ID format (must be CUID)",
  }),

  packageType: Joi.string()
    .valid(...validPackageTypes)
    .messages({
      "any.only": `Package type must be one of: ${validPackageTypes.join(", ")}`,
    }),

  calcType: Joi.string()
    .valid(...validCalcTypes)
    .default("FLAT")
    .messages({
      "any.only": `Calc type must be one of: ${validCalcTypes.join(", ")}`,
    }),

  appliesTo: Joi.string()
    .valid(...validAppliesTo)
    .default("ANY")
    .messages({
      "any.only": `AppliesTo must be one of: ${validAppliesTo.join(", ")}`,
    }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
  }),

  isActive: Joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean",
  }),

  // Decimal value for charges (positive, up to 2 decimal places)
  charge: Joi.number().positive().precision(2).messages({
    "number.base": "Charge must be a number",
    "number.positive": "Charge must be a positive number",
  }),

  // Unit value (can be 0 for base, positive for addon)
  unit: Joi.number().min(0).precision(2).messages({
    "number.base": "Unit must be a number",
    "number.min": "Unit must be 0 or greater",
  }),
};

// ========================================
// CHARGE PACKAGE CRUD SCHEMAS
// ========================================

/**
 * POST /api/v1/charge-packages - Create Charge Package (multi-partner)
 *
 * Creates identical charge packages for one or more partners.
 * Required fields vary based on package type:
 *   - WEIGHT/DISTANCE: baseCharge, baseUnit, addonUnit, addonCharge
 *   - GENERIC: baseCharge, appliesTo, calcType
 */
const createChargePackage = {
  body: Joi.object({
    // Partner IDs (single or multiple)
    partnerIds: Joi.array()
      .items(schemas.partnerId)
      .min(1)
      .max(100)
      .required()
      .messages({
        "array.min": "At least one partner ID is required",
        "array.max": "Cannot create for more than 100 partners at once",
        "any.required": "partnerIds array is required",
      }),

    // Package name (unique per partner)
    name: Joi.string().min(2).max(100).required().messages({
      "string.min": "Package name must be at least 2 characters",
      "string.max": "Package name cannot exceed 100 characters",
      "any.required": "Package name is required",
    }),

    // Package type
    type: schemas.packageType.required().messages({
      "any.required": "Package type is required",
    }),

    // Base charge (always required)
    baseCharge: schemas.charge.required().messages({
      "any.required": "Base charge is required",
    }),

    // Unit-based fields (required for WEIGHT and DISTANCE types)
    baseUnit: Joi.number()
      .min(0)
      .precision(2)
      .when("type", {
        is: Joi.valid("WEIGHT", "DISTANCE"),
        then: Joi.required().messages({
          "any.required": "Base unit is required for WEIGHT/DISTANCE packages",
        }),
        otherwise: Joi.forbidden().messages({
          "any.unknown":
            "Base unit is only allowed for WEIGHT/DISTANCE packages",
        }),
      }),

    addonUnit: Joi.number()
      .positive()
      .precision(2)
      .when("type", {
        is: Joi.valid("WEIGHT", "DISTANCE"),
        then: Joi.required().messages({
          "any.required": "Addon unit is required for WEIGHT/DISTANCE packages",
        }),
        otherwise: Joi.forbidden().messages({
          "any.unknown":
            "Addon unit is only allowed for WEIGHT/DISTANCE packages",
        }),
      }),

    addonCharge: Joi.number()
      .min(0)
      .precision(2)
      .when("type", {
        is: Joi.valid("WEIGHT", "DISTANCE"),
        then: Joi.required().messages({
          "any.required":
            "Addon charge is required for WEIGHT/DISTANCE packages",
        }),
        otherwise: Joi.forbidden().messages({
          "any.unknown":
            "Addon charge is only allowed for WEIGHT/DISTANCE packages",
        }),
      }),

    // GENERIC-specific fields
    appliesTo: Joi.string()
      .valid(...validAppliesTo)
      .when("type", {
        is: "GENERIC",
        then: Joi.optional().default("ANY"),
        otherwise: Joi.forbidden().messages({
          "any.unknown": "appliesTo is only allowed for GENERIC packages",
        }),
      }),

    calcType: Joi.string()
      .valid(...validCalcTypes)
      .when("type", {
        is: "GENERIC",
        then: Joi.optional().default("FLAT"),
        otherwise: Joi.forbidden().messages({
          "any.unknown": "calcType is only allowed for GENERIC packages",
        }),
      }),

    // Optional metadata for future extensibility
    metadata: Joi.object().optional().allow(null),

    // Active status (default true)
    isActive: Joi.boolean().default(true),
  }),
};

/**
 * GET /api/v1/charge-packages - List Charge Packages
 */
const listChargePackages = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    partnerId: schemas.partnerIdOptional,
    type: schemas.packageType.optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().min(1).max(100).optional().messages({
      "string.min": "Search term must be at least 1 character",
      "string.max": "Search term cannot exceed 100 characters",
    }),
    sortBy: Joi.string()
      .valid("name", "type", "baseCharge", "createdAt", "updatedAt")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),
};

/**
 * GET /api/v1/charge-packages/:id - Get Charge Package by ID
 */
const getChargePackage = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/charge-packages/:id - Update Charge Package
 *
 * Note: Type cannot be changed after creation.
 * Unit-based fields are only editable for WEIGHT/DISTANCE packages.
 * appliesTo/calcType are only editable for GENERIC packages.
 */
const updateChargePackage = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional().messages({
      "string.min": "Package name must be at least 2 characters",
      "string.max": "Package name cannot exceed 100 characters",
    }),

    baseCharge: schemas.charge.optional(),

    // Unit-based fields (will be validated in controller based on package type)
    baseUnit: Joi.number().min(0).precision(2).optional(),
    addonUnit: Joi.number().positive().precision(2).optional(),
    addonCharge: Joi.number().min(0).precision(2).optional(),

    // GENERIC-specific fields (will be validated in controller based on package type)
    appliesTo: Joi.string()
      .valid(...validAppliesTo)
      .optional(),
    calcType: Joi.string()
      .valid(...validCalcTypes)
      .optional(),

    metadata: Joi.object().optional().allow(null),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};

/**
 * DELETE /api/v1/charge-packages/:id - Delete (soft-delete) Charge Package
 */
const deleteChargePackage = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * GET /api/v1/charge-packages/partner/:partnerId - Get packages by partner
 */
const getPackagesByPartner = {
  params: Joi.object({
    partnerId: schemas.partnerId.required(),
  }),
  query: Joi.object({
    type: schemas.packageType.optional(),
    isActive: Joi.boolean().optional(),
  }),
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
  // Common schemas
  schemas,

  // Charge Package CRUD endpoints
  chargePackages: {
    createChargePackage,
    listChargePackages,
    getChargePackage,
    updateChargePackage,
    deleteChargePackage,
    getPackagesByPartner,
  },
};
