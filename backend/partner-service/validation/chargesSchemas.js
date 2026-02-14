/**
 * Validation Schemas for Charges Rule Management
 *
 * Joi validation schemas for all charge-rule-related endpoints.
 * Supports PARTNER_CHARGES_TYPE, GEOLOGICAL, and ADDON kinds.
 * Supports INVOICE_VALUE, WEIGHT, ZONE_TO_ZONE_WEIGHT, DISTANCE_BASE_WEIGHT bases.
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cuidPattern = /^c[a-z0-9]{24}$/i;

const validKinds = ["PARTNER_CHARGES_TYPE", "GEOLOGICAL", "ADDON"];
const validBases = [
  "INVOICE_VALUE",
  "WEIGHT",
  "ZONE_TO_ZONE_WEIGHT",
  "DISTANCE_BASE_WEIGHT",
];
const validCalcTypes = ["FLAT", "PERCENTAGE"];

// ========================================
// CREATE CHARGE RULE
// ========================================

const createChargeRule = {
  body: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),

    kind: Joi.string()
      .valid(...validKinds)
      .required()
      .messages({
        "any.required": "Charge rule kind is required",
        "any.only": `Kind must be one of: ${validKinds.join(", ")}`,
      }),

    base: Joi.string()
      .valid(...validBases)
      .required()
      .messages({
        "any.required": "Charge rule base is required",
        "any.only": `Base must be one of: ${validBases.join(", ")}`,
      }),

    // Required when kind = PARTNER_CHARGES_TYPE
    chargesTypeId: Joi.string()
      .pattern(uuidPattern)
      .when("kind", {
        is: "PARTNER_CHARGES_TYPE",
        then: Joi.required().messages({
          "any.required":
            "chargesTypeId is required when kind is PARTNER_CHARGES_TYPE",
        }),
        otherwise: Joi.optional().allow(null),
      })
      .messages({
        "string.pattern.base": "Invalid chargesTypeId UUID format",
      }),

    // Required when kind = GEOLOGICAL
    pincodeTypeId: Joi.string()
      .pattern(uuidPattern)
      .when("kind", {
        is: "GEOLOGICAL",
        then: Joi.required().messages({
          "any.required": "pincodeTypeId is required when kind is GEOLOGICAL",
        }),
        otherwise: Joi.optional().allow(null),
      })
      .messages({
        "string.pattern.base": "Invalid pincodeTypeId UUID format",
      }),

    // ---- INVOICE_VALUE fields ----
    fromAmount: Joi.number()
      .min(0)
      .precision(2)
      .when("base", {
        is: "INVOICE_VALUE",
        then: Joi.required().messages({
          "any.required": "fromAmount is required for INVOICE_VALUE base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    toAmount: Joi.number()
      .min(0)
      .precision(2)
      .when("base", {
        is: "INVOICE_VALUE",
        then: Joi.required().messages({
          "any.required": "toAmount is required for INVOICE_VALUE base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    // ---- Shared charge + calcType (INVOICE_VALUE & WEIGHT) ----
    charge: Joi.number()
      .min(0)
      .precision(2)
      .when("base", {
        is: Joi.valid("INVOICE_VALUE", "WEIGHT"),
        then: Joi.required().messages({
          "any.required": "charge is required for INVOICE_VALUE/WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    calcType: Joi.string()
      .valid(...validCalcTypes)
      .when("base", {
        is: Joi.valid("INVOICE_VALUE", "WEIGHT"),
        then: Joi.required().messages({
          "any.required": "calcType is required for INVOICE_VALUE/WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    // ---- WEIGHT fields ----
    minKg: Joi.number()
      .min(0)
      .precision(3)
      .when("base", {
        is: "WEIGHT",
        then: Joi.required().messages({
          "any.required": "minKg is required for WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    maxKg: Joi.number()
      .min(0)
      .precision(3)
      .when("base", {
        is: "WEIGHT",
        then: Joi.required().messages({
          "any.required": "maxKg is required for WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    // ---- ZONE_TO_ZONE_WEIGHT fields ----
    fromZoneId: Joi.string()
      .pattern(uuidPattern)
      .when("base", {
        is: "ZONE_TO_ZONE_WEIGHT",
        then: Joi.required().messages({
          "any.required": "fromZoneId is required for ZONE_TO_ZONE_WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      })
      .messages({
        "string.pattern.base": "Invalid fromZoneId UUID format",
      }),

    toZoneId: Joi.string()
      .pattern(uuidPattern)
      .when("base", {
        is: "ZONE_TO_ZONE_WEIGHT",
        then: Joi.required().messages({
          "any.required": "toZoneId is required for ZONE_TO_ZONE_WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      })
      .messages({
        "string.pattern.base": "Invalid toZoneId UUID format",
      }),

    // ---- Shared weight slab fields (ZONE_TO_ZONE_WEIGHT & DISTANCE_BASE_WEIGHT) ----
    minWeightKg: Joi.number()
      .min(0)
      .precision(3)
      .when("base", {
        is: Joi.valid("ZONE_TO_ZONE_WEIGHT", "DISTANCE_BASE_WEIGHT"),
        then: Joi.required().messages({
          "any.required":
            "minWeightKg is required for ZONE_TO_ZONE/DISTANCE_BASE base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    addonWeightKg: Joi.number()
      .min(0)
      .precision(3)
      .when("base", {
        is: Joi.valid("ZONE_TO_ZONE_WEIGHT", "DISTANCE_BASE_WEIGHT"),
        then: Joi.required().messages({
          "any.required":
            "addonWeightKg is required for ZONE_TO_ZONE/DISTANCE_BASE base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    weightCharge: Joi.number()
      .min(0)
      .precision(2)
      .when("base", {
        is: Joi.valid("ZONE_TO_ZONE_WEIGHT", "DISTANCE_BASE_WEIGHT"),
        then: Joi.required().messages({
          "any.required":
            "weightCharge is required for ZONE_TO_ZONE/DISTANCE_BASE base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    addonCharge: Joi.number()
      .min(0)
      .precision(2)
      .when("base", {
        is: Joi.valid("ZONE_TO_ZONE_WEIGHT", "DISTANCE_BASE_WEIGHT"),
        then: Joi.required().messages({
          "any.required":
            "addonCharge is required for ZONE_TO_ZONE/DISTANCE_BASE base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    // ---- DISTANCE_BASE_WEIGHT fields ----
    division: Joi.string()
      .max(50)
      .when("base", {
        is: "DISTANCE_BASE_WEIGHT",
        then: Joi.required().messages({
          "any.required": "division is required for DISTANCE_BASE_WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null, ""),
      }),

    fromKm: Joi.number()
      .integer()
      .min(0)
      .when("base", {
        is: "DISTANCE_BASE_WEIGHT",
        then: Joi.required().messages({
          "any.required": "fromKm is required for DISTANCE_BASE_WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    toKm: Joi.number()
      .integer()
      .min(0)
      .when("base", {
        is: "DISTANCE_BASE_WEIGHT",
        then: Joi.required().messages({
          "any.required": "toKm is required for DISTANCE_BASE_WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    isActive: Joi.boolean().default(true),
  }),
};

// ========================================
// LIST CHARGE RULES
// ========================================

const listChargeRules = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    partnerId: Joi.string().optional(),
    kind: Joi.string()
      .valid(...validKinds)
      .optional(),
    chargesTypeId: Joi.string().pattern(uuidPattern).optional(),
    base: Joi.string()
      .valid(...validBases)
      .optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().min(1).max(100).optional(),
    sortBy: Joi.string()
      .valid("createdAt", "updatedAt", "kind", "base")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),
};

// ========================================
// GET / UPDATE / DELETE
// ========================================

const getChargeRule = {
  params: Joi.object({
    id: Joi.string().pattern(uuidPattern).required().messages({
      "string.pattern.base": "Invalid UUID format",
      "any.required": "Charge rule ID is required",
    }),
  }),
};

const updateChargeRule = {
  params: Joi.object({
    id: Joi.string().pattern(uuidPattern).required().messages({
      "string.pattern.base": "Invalid UUID format",
      "any.required": "Charge rule ID is required",
    }),
  }),
  body: Joi.object({
    kind: Joi.string()
      .valid(...validKinds)
      .optional(),
    base: Joi.string()
      .valid(...validBases)
      .optional(),
    chargesTypeId: Joi.string().pattern(uuidPattern).optional().allow(null),
    pincodeTypeId: Joi.string().pattern(uuidPattern).optional().allow(null),
    fromAmount: Joi.number().min(0).precision(2).optional().allow(null),
    toAmount: Joi.number().min(0).precision(2).optional().allow(null),
    charge: Joi.number().min(0).precision(2).optional().allow(null),
    calcType: Joi.string()
      .valid(...validCalcTypes)
      .optional()
      .allow(null),
    minKg: Joi.number().min(0).precision(3).optional().allow(null),
    maxKg: Joi.number().min(0).precision(3).optional().allow(null),
    fromZoneId: Joi.string().pattern(uuidPattern).optional().allow(null),
    toZoneId: Joi.string().pattern(uuidPattern).optional().allow(null),
    minWeightKg: Joi.number().min(0).precision(3).optional().allow(null),
    addonWeightKg: Joi.number().min(0).precision(3).optional().allow(null),
    weightCharge: Joi.number().min(0).precision(2).optional().allow(null),
    addonCharge: Joi.number().min(0).precision(2).optional().allow(null),
    division: Joi.string().max(50).optional().allow(null, ""),
    fromKm: Joi.number().integer().min(0).optional().allow(null),
    toKm: Joi.number().integer().min(0).optional().allow(null),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};

const deleteChargeRule = {
  params: Joi.object({
    id: Joi.string().pattern(uuidPattern).required().messages({
      "string.pattern.base": "Invalid UUID format",
      "any.required": "Charge rule ID is required",
    }),
  }),
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
  chargeRules: {
    createChargeRule,
    listChargeRules,
    getChargeRule,
    updateChargeRule,
    deleteChargeRule,
  },
};
