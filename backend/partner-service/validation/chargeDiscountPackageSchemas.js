/**
 * Charge Discount Package Validation Schemas
 *
 * Joi validation for charge discount package CRUD operations.
 * Follows existing chargesSchemas.js patterns.
 */

const Joi = require("joi");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_BADGES = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];

const VALID_DISCOUNT_TYPES = ["FLAT", "PERCENTAGE"];

// ========================================
// SCHEMAS
// ========================================

const chargeDiscountPackages = {
  createPackage: {
    body: Joi.object({
      partnerId: Joi.string().required().messages({
        "any.required": "Partner ID is required",
        "string.empty": "Partner ID cannot be empty",
      }),
      name: Joi.string().max(200).required().messages({
        "any.required": "Package name is required",
        "string.max": "Package name must be at most 200 characters",
      }),
      badge: Joi.string()
        .valid(...VALID_BADGES)
        .required()
        .messages({
          "any.required": "Badge tier is required",
          "any.only": `Badge must be one of: ${VALID_BADGES.join(", ")}`,
        }),
      isActive: Joi.boolean().default(true),
      items: Joi.array()
        .items(
          Joi.object({
            chargeRuleId: Joi.string()
              .pattern(UUID_PATTERN)
              .required()
              .messages({
                "any.required": "Charge rule ID is required",
                "string.pattern.base": "Charge rule ID must be a valid UUID",
              }),
            discountType: Joi.string()
              .valid(...VALID_DISCOUNT_TYPES)
              .required()
              .messages({
                "any.required": "Discount type is required",
                "any.only": `Discount type must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`,
              }),
            discountValue: Joi.number()
              .min(0)
              .precision(2)
              .required()
              .messages({
                "any.required": "Discount value is required",
                "number.min": "Discount value must be >= 0",
              }),
          }).custom((value, helpers) => {
            // PERCENTAGE must be 0-100
            if (
              value.discountType === "PERCENTAGE" &&
              value.discountValue > 100
            ) {
              return helpers.error("any.custom", {
                message: "Percentage discount value must be between 0 and 100",
              });
            }
            return value;
          }),
        )
        .min(1)
        .required()
        .messages({
          "array.min": "At least one discount item is required",
          "any.required": "Items array is required",
        }),
    }),
  },

  updatePackage: {
    params: Joi.object({
      id: Joi.string().pattern(UUID_PATTERN).required().messages({
        "string.pattern.base": "Package ID must be a valid UUID",
      }),
    }),
    body: Joi.object({
      name: Joi.string().max(200).optional(),
      badge: Joi.string()
        .valid(...VALID_BADGES)
        .optional(),
      isActive: Joi.boolean().optional(),
      items: Joi.array()
        .items(
          Joi.object({
            chargeRuleId: Joi.string()
              .pattern(UUID_PATTERN)
              .required()
              .messages({
                "any.required": "Charge rule ID is required",
                "string.pattern.base": "Charge rule ID must be a valid UUID",
              }),
            discountType: Joi.string()
              .valid(...VALID_DISCOUNT_TYPES)
              .required()
              .messages({
                "any.required": "Discount type is required",
                "any.only": `Discount type must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`,
              }),
            discountValue: Joi.number()
              .min(0)
              .precision(2)
              .required()
              .messages({
                "any.required": "Discount value is required",
                "number.min": "Discount value must be >= 0",
              }),
          }).custom((value, helpers) => {
            if (
              value.discountType === "PERCENTAGE" &&
              value.discountValue > 100
            ) {
              return helpers.error("any.custom", {
                message: "Percentage discount value must be between 0 and 100",
              });
            }
            return value;
          }),
        )
        .min(1)
        .optional(),
    })
      .min(1)
      .messages({
        "object.min": "At least one field must be provided for update",
      }),
  },

  getPackage: {
    params: Joi.object({
      id: Joi.string().pattern(UUID_PATTERN).required().messages({
        "string.pattern.base": "Package ID must be a valid UUID",
      }),
    }),
  },

  deletePackage: {
    params: Joi.object({
      id: Joi.string().pattern(UUID_PATTERN).required().messages({
        "string.pattern.base": "Package ID must be a valid UUID",
      }),
    }),
  },

  listPackages: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      partnerId: Joi.string().optional(),
      badge: Joi.string()
        .valid(...VALID_BADGES)
        .optional(),
      isActive: Joi.string().valid("true", "false").optional(),
      search: Joi.string().max(100).optional(),
      sortBy: Joi.string()
        .valid("createdAt", "updatedAt", "name")
        .default("createdAt"),
      sortOrder: Joi.string().valid("asc", "desc").default("desc"),
    }),
  },
};

module.exports = { chargeDiscountPackages };
