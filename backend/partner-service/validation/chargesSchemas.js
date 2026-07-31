/**
 * Validation Schemas for Charges Rule Management
 *
 * New field set (charges engine redesign):
 * - No kind field.
 * - base: INVOICE_VALUE | COD_VALUE | WEIGHT | ZONE_TO_ZONE_WEIGHT | DISTANCE_BASE_WEIGHT
 * - For INVOICE_VALUE/COD_VALUE/WEIGHT: exactly one of chargesTypeId or pincodeTypeId.
 * - For INVOICE_VALUE: minValue + percentageValue (applied to the invoice value).
 * - For COD_VALUE: minValue + percentageValue (applied to the COD amount instead).
 * - For WEIGHT/ZONE_TO_ZONE_WEIGHT/DISTANCE_BASE_WEIGHT: minValue + perKg + perKgCharge.
 * - For ZONE_TO_ZONE_WEIGHT: fromZoneId + toZoneId (required).
 * - For DISTANCE_BASE_WEIGHT: zoneMilestoneId (required).
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validBases = [
  "INVOICE_VALUE",
  "COD_VALUE",
  "WEIGHT",
  "ZONE_TO_ZONE_WEIGHT",
  "DISTANCE_BASE_WEIGHT",
];

// Bases priced as a percentage of a monetary amount (percentageValue + minValue),
// as opposed to the per-kg weight bases. Both require exactly one type FK.
const percentageBases = ["INVOICE_VALUE", "COD_VALUE"];

// ========================================
// CREATE CHARGE RULE
// ========================================

const createChargeRule = {
  body: Joi.object({
    partnerId: Joi.string().required().messages({
      "any.required": "Partner ID is required",
    }),

    base: Joi.string()
      .valid(...validBases)
      .required()
      .messages({
        "any.required": "Charge rule base is required",
        "any.only": `Base must be one of: ${validBases.join(", ")}`,
      }),

    // For INVOICE_VALUE, COD_VALUE and WEIGHT: exactly one of chargesTypeId or
    // pincodeTypeId is required.
    chargesTypeId: Joi.string()
      .pattern(uuidPattern)
      .optional()
      .allow(null)
      .messages({
        "string.pattern.base": "Invalid chargesTypeId UUID format",
      }),

    pincodeTypeId: Joi.string()
      .pattern(uuidPattern)
      .optional()
      .allow(null)
      .messages({
        "string.pattern.base": "Invalid pincodeTypeId UUID format",
      }),

    // ---- Shared min value (all bases) ----
    minValue: Joi.number().min(0).precision(2).required().messages({
      "any.required": "minValue is required",
    }),

    // ---- INVOICE_VALUE / COD_VALUE fields ----
    percentageValue: Joi.number()
      .min(0)
      .precision(4)
      .when("base", {
        is: Joi.valid(...percentageBases),
        then: Joi.required().messages({
          "any.required": `percentageValue is required for ${percentageBases.join("/")} base`,
        }),
        otherwise: Joi.optional().allow(null),
      }),

    // ---- WEIGHT / ZONE_TO_ZONE_WEIGHT / DISTANCE_BASE_WEIGHT fields ----
    perKg: Joi.number()
      .min(0)
      .precision(3)
      .when("base", {
        is: Joi.valid("WEIGHT", "ZONE_TO_ZONE_WEIGHT", "DISTANCE_BASE_WEIGHT"),
        then: Joi.required().messages({
          "any.required":
            "perKg is required for WEIGHT/ZONE_TO_ZONE_WEIGHT/DISTANCE_BASE_WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      }),

    perKgCharge: Joi.number()
      .min(0)
      .precision(2)
      .when("base", {
        is: Joi.valid("WEIGHT", "ZONE_TO_ZONE_WEIGHT", "DISTANCE_BASE_WEIGHT"),
        then: Joi.required().messages({
          "any.required":
            "perKgCharge is required for WEIGHT/ZONE_TO_ZONE_WEIGHT/DISTANCE_BASE_WEIGHT base",
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

    // ---- DISTANCE_BASE_WEIGHT fields ----
    zoneMilestoneId: Joi.string()
      .pattern(uuidPattern)
      .when("base", {
        is: "DISTANCE_BASE_WEIGHT",
        then: Joi.required().messages({
          "any.required":
            "zoneMilestoneId is required for DISTANCE_BASE_WEIGHT base",
        }),
        otherwise: Joi.optional().allow(null),
      })
      .messages({
        "string.pattern.base": "Invalid zoneMilestoneId UUID format",
      }),

    isActive: Joi.boolean().default(true),
  }).custom((value, helpers) => {
    // XOR validation: for INVOICE_VALUE, COD_VALUE and WEIGHT, exactly one of
    // chargesTypeId or pincodeTypeId
    const { base, chargesTypeId, pincodeTypeId } = value;
    const typedBases = [...percentageBases, "WEIGHT"];
    if (typedBases.includes(base)) {
      const label = typedBases.join("/");
      const hasChargesType = !!chargesTypeId;
      const hasPincodeType = !!pincodeTypeId;
      if (!hasChargesType && !hasPincodeType) {
        return helpers.error("any.custom", {
          message: `Either chargesTypeId or pincodeTypeId is required for ${label} base`,
        });
      }
      if (hasChargesType && hasPincodeType) {
        return helpers.error("any.custom", {
          message: `Only one of chargesTypeId or pincodeTypeId can be set for ${label} base`,
        });
      }
    }
    return value;
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
    chargesTypeId: Joi.string().pattern(uuidPattern).optional(),
    pincodeTypeId: Joi.string().pattern(uuidPattern).optional(),
    base: Joi.string()
      .valid(...validBases)
      .optional(),
    isActive: Joi.boolean().optional(),
    search: Joi.string().min(1).max(100).optional(),
    sortBy: Joi.string()
      .valid("createdAt", "updatedAt", "base")
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
    base: Joi.string()
      .valid(...validBases)
      .optional(),
    chargesTypeId: Joi.string().pattern(uuidPattern).optional().allow(null),
    pincodeTypeId: Joi.string().pattern(uuidPattern).optional().allow(null),
    minValue: Joi.number().min(0).precision(2).optional().allow(null),
    percentageValue: Joi.number().min(0).precision(4).optional().allow(null),
    perKg: Joi.number().min(0).precision(3).optional().allow(null),
    perKgCharge: Joi.number().min(0).precision(2).optional().allow(null),
    fromZoneId: Joi.string().pattern(uuidPattern).optional().allow(null),
    toZoneId: Joi.string().pattern(uuidPattern).optional().allow(null),
    zoneMilestoneId: Joi.string().pattern(uuidPattern).optional().allow(null),
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
