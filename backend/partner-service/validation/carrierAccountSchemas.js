const Joi = require("joi");

const SERVICE_TYPES = ["SURFACE", "AIR", "EXPRESS"];
const BUSINESS_TYPES = ["B2B", "B2C", "BOTH"];
const PAYMENT_MODES = ["COD", "PREPAID"];

// Cross-field range checks shared by create/update payloads
const rangeChecks = (value, helpers) => {
  if (
    value.maxWeight !== null &&
    value.maxWeight !== undefined &&
    value.minWeight !== undefined &&
    value.maxWeight < value.minWeight
  ) {
    return helpers.error("any.invalid", {
      message: "maxWeight must be greater than or equal to minWeight",
    });
  }
  if (
    value.maxOrderAmount !== null &&
    value.maxOrderAmount !== undefined &&
    value.minOrderAmount !== null &&
    value.minOrderAmount !== undefined &&
    value.maxOrderAmount < value.minOrderAmount
  ) {
    return helpers.error("any.invalid", {
      message: "maxOrderAmount must be greater than or equal to minOrderAmount",
    });
  }
  return value;
};

const accountSchema = Joi.object({
  channelName: Joi.string().trim().min(1).max(150).required().messages({
    "string.empty": 'Channel name is required (e.g. "Delhivery B2C")',
  }),
  accountRef: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": 'Account reference is required (e.g. "Account 1")',
  }),
  serviceType: Joi.string()
    .valid(...SERVICE_TYPES)
    .default("SURFACE"),
  businessType: Joi.string()
    .valid(...BUSINESS_TYPES)
    .default("BOTH"),
  minWeight: Joi.number().min(0).default(0),
  // null / omitted maxWeight = open-ended ("All Weight")
  maxWeight: Joi.number().min(0).allow(null).optional(),
  // null / omitted bounds = open-ended order amount
  minOrderAmount: Joi.number().min(0).allow(null).optional(),
  maxOrderAmount: Joi.number().min(0).allow(null).optional(),
  // Empty array = channel accepts all payment modes
  paymentModes: Joi.array()
    .items(Joi.string().valid(...PAYMENT_MODES))
    .unique()
    .default([]),
  channelConfigId: Joi.string().uuid().allow(null).optional(),
  // Per-channel credential overrides: { apiUrl, apiKey, aggregatorType, aggregatorConfig, webhookSecret, volumetricDivisor }
  credentials: Joi.object().allow(null).optional(),
  isActive: Joi.boolean().default(true),
  priority: Joi.number().integer().min(1).max(100).default(1),
})
  .custom(rangeChecks, "rule-ranges")
  .custom((value, helpers) => {
    // An active channel must be able to resolve credentials somewhere
    if (
      value.isActive !== false &&
      !value.channelConfigId &&
      !value.credentials
    ) {
      return helpers.error("any.invalid", {
        message:
          "An active channel requires channelConfigId (credential account) or credentials overrides",
      });
    }
    return value;
  }, "credential-source");

const createCarrierAccountSchema = Joi.object({
  partnerId: Joi.string().optional(), // comes from URL param
  accounts: Joi.array()
    .items(accountSchema)
    .min(1)
    .max(50)
    .required()
    .messages({
      "array.min": "At least one carrier account is required",
      "array.max": "Maximum 50 carrier accounts allowed",
    }),
});

const updateCarrierAccountSchema = Joi.object({
  channelName: Joi.string().trim().min(1).max(150).optional(),
  accountRef: Joi.string().trim().min(1).max(100).optional(),
  serviceType: Joi.string()
    .valid(...SERVICE_TYPES)
    .optional(),
  businessType: Joi.string()
    .valid(...BUSINESS_TYPES)
    .optional(),
  minWeight: Joi.number().min(0).optional(),
  maxWeight: Joi.number().min(0).allow(null).optional(),
  minOrderAmount: Joi.number().min(0).allow(null).optional(),
  maxOrderAmount: Joi.number().min(0).allow(null).optional(),
  paymentModes: Joi.array()
    .items(Joi.string().valid(...PAYMENT_MODES))
    .unique()
    .optional(),
  channelConfigId: Joi.string().uuid().allow(null).optional(),
  credentials: Joi.object().allow(null).optional(),
  isActive: Joi.boolean().optional(),
  priority: Joi.number().integer().min(1).max(100).optional(),
})
  .min(1)
  .custom(rangeChecks, "rule-ranges");

const selectChannelQuerySchema = Joi.object({
  weight: Joi.number().min(0).required(),
  businessType: Joi.string().valid("B2B", "B2C").default("B2C"),
  orderAmount: Joi.number().min(0).optional(),
  paymentType: Joi.string()
    .valid(...PAYMENT_MODES)
    .optional(),
  serviceType: Joi.string()
    .valid(...SERVICE_TYPES)
    .optional(),
});

module.exports = {
  SERVICE_TYPES,
  BUSINESS_TYPES,
  PAYMENT_MODES,
  accountSchema,
  createCarrierAccountSchema,
  updateCarrierAccountSchema,
  selectChannelQuerySchema,
};
