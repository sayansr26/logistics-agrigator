// Affiliate Validation Schemas
// Joi validation schemas for affiliate and commission endpoints

const Joi = require("joi");

/**
 * Register affiliate schema
 */
const registerAffiliateSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.guid": "userId must be a valid UUID",
    "any.required": "userId is required",
  }),
  commissionType: Joi.string()
    .valid("FLAT", "PERCENTAGE")
    .default("PERCENTAGE")
    .messages({
      "any.only": "commissionType must be either FLAT or PERCENTAGE",
    }),
  commissionRate: Joi.number().min(0).required().messages({
    "number.base": "commissionRate must be a number",
    "number.min": "commissionRate must be greater than or equal to 0",
    "any.required": "commissionRate is required",
  }),
  metadata: Joi.object().optional(),
});

/**
 * Update commission settings schema
 */
const updateCommissionSettingsSchema = Joi.object({
  commissionType: Joi.string().valid("FLAT", "PERCENTAGE").optional().messages({
    "any.only": "commissionType must be either FLAT or PERCENTAGE",
  }),
  commissionRate: Joi.number().min(0).optional().messages({
    "number.base": "commissionRate must be a number",
    "number.min": "commissionRate must be greater than or equal to 0",
  }),
  metadata: Joi.object().optional(),
});

/**
 * List commissions query schema
 */
const listCommissionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "page must be a number",
    "number.min": "page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": "limit must be a number",
    "number.min": "limit must be at least 1",
    "number.max": "limit must not exceed 100",
  }),
  sortBy: Joi.string()
    .valid("createdAt", "commissionAmount", "status")
    .default("createdAt")
    .messages({
      "any.only": "sortBy must be one of: createdAt, commissionAmount, status",
    }),
  sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "sortOrder must be either asc or desc",
  }),
  status: Joi.string()
    .valid("PENDING", "APPROVED", "PAID", "CANCELLED")
    .optional()
    .messages({
      "any.only": "status must be one of: PENDING, APPROVED, PAID, CANCELLED",
    }),
  startDate: Joi.date().iso().optional().messages({
    "date.base": "startDate must be a valid ISO date",
  }),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().messages({
    "date.base": "endDate must be a valid ISO date",
    "date.min": "endDate must be after or equal to startDate",
  }),
  affiliateId: Joi.string().uuid().optional().messages({
    "string.guid": "affiliateId must be a valid UUID",
  }),
});

/**
 * Request payout schema
 */
const requestPayoutSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    "number.base": "amount must be a number",
    "number.positive": "amount must be a positive number",
    "any.required": "amount is required",
  }),
  metadata: Joi.object().optional(),
});

/**
 * Approve payout schema
 */
const approvePayoutSchema = Joi.object({
  notes: Joi.string().max(500).optional().messages({
    "string.max": "notes must not exceed 500 characters",
  }),
});

/**
 * Reject payout schema
 */
const rejectPayoutSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required().messages({
    "string.base": "reason must be a string",
    "string.min": "reason must be at least 10 characters",
    "string.max": "reason must not exceed 500 characters",
    "any.required": "reason is required",
  }),
});

/**
 * UUID parameter schema
 */
const uuidParamSchema = Joi.object({
  affiliateId: Joi.string().uuid().optional().messages({
    "string.guid": "affiliateId must be a valid UUID",
  }),
  payoutId: Joi.string().uuid().optional().messages({
    "string.guid": "payoutId must be a valid UUID",
  }),
});

module.exports = {
  registerAffiliateSchema,
  updateCommissionSettingsSchema,
  listCommissionsQuerySchema,
  requestPayoutSchema,
  approvePayoutSchema,
  rejectPayoutSchema,
  uuidParamSchema,
};
