const Joi = require("joi");

const ALLOWED_AGGREGATOR_TYPES = ["DELHIVERY", "DELHIVERY_B2B", "BLUEDART"];

const delhiveryAggregatorConfigSchema = Joi.object({
  clientName: Joi.string().trim().min(1).required().messages({
    "any.required":
      "Delhivery clientName is required (must match your Delhivery One registered client name)",
    "string.empty":
      "Delhivery clientName cannot be empty (must match your Delhivery One registered client name)",
  }),
}).unknown(true);

// Delhivery B2B (LTL) uses a separate credential model: API username/password
// (JWT login), plus the Delhivery One-registered warehouse/pickup location.
const delhiveryB2BAggregatorConfigSchema = Joi.object({
  username: Joi.string().trim().min(1).required().messages({
    "any.required": "Delhivery B2B API username is required",
    "string.empty": "Delhivery B2B API username cannot be empty",
  }),
  password: Joi.string().min(1).required().messages({
    "any.required": "Delhivery B2B API password is required",
    "string.empty": "Delhivery B2B API password cannot be empty",
  }),
  clientId: Joi.string().trim().allow("", null).optional(),
  pickupLocationName: Joi.string().trim().min(1).required().messages({
    "any.required":
      "Delhivery B2B pickup location name is required (must match the warehouse registered in Delhivery One)",
    "string.empty": "Delhivery B2B pickup location name cannot be empty",
  }),
  ltlApiUrl: Joi.string().uri().allow("", null).optional(),
}).unknown(true);

const bluedartAggregatorConfigSchema = Joi.object({
  licenseKey: Joi.string().trim().min(1).required().messages({
    "any.required": "BlueDart licenseKey is required",
    "string.empty": "BlueDart licenseKey cannot be empty",
  }),
  loginId: Joi.string().trim().min(1).required().messages({
    "any.required": "BlueDart loginId is required",
    "string.empty": "BlueDart loginId cannot be empty",
  }),
  customerCode: Joi.string().trim().min(1).required().messages({
    "any.required": "BlueDart customerCode is required",
    "string.empty": "BlueDart customerCode cannot be empty",
  }),
}).unknown(true);

const channelConfigSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  channelName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({ "string.empty": "Channel name is required" }),
  apiUrl: Joi.string()
    .uri()
    .allow("", null)
    .optional()
    .messages({ "string.uri": "API URL must be a valid URL" }),
  apiKey: Joi.when("aggregatorType", {
    is: "DELHIVERY",
    then: Joi.string().trim().min(1).max(500).required().messages({
      "any.required": "Delhivery API token is required",
      "string.empty": "Delhivery API token cannot be empty",
    }),
    otherwise: Joi.string().trim().min(1).max(500).allow("", null).optional(),
  }),
  isActive: Joi.boolean().default(true),
  isPrimary: Joi.boolean().default(false),
  priority: Joi.number().integer().min(1).max(100).default(1),
  aggregatorType: Joi.string()
    .valid(...ALLOWED_AGGREGATOR_TYPES)
    .required()
    .messages({
      "any.only":
        "Aggregator type must be one of: DELHIVERY, DELHIVERY_B2B, BLUEDART",
      "any.required": "Aggregator type is required",
    }),
  aggregatorConfig: Joi.when("aggregatorType", {
    switch: [
      { is: "DELHIVERY", then: delhiveryAggregatorConfigSchema.required() },
      {
        is: "DELHIVERY_B2B",
        then: delhiveryB2BAggregatorConfigSchema.required(),
      },
      { is: "BLUEDART", then: bluedartAggregatorConfigSchema.required() },
    ],
    otherwise: Joi.object().optional().allow(null),
  }),
  webhookSecret: Joi.string().trim().max(500).optional().allow("", null),
});

const channelModeSchema = Joi.object({
  channelMode: Joi.string().valid("SINGLE", "MULTI").default("SINGLE"),
});

const createChannelSchema = Joi.object({
  partnerId: Joi.string().optional(), // partnerId comes from URL param, not body
  channels: Joi.array().items(channelConfigSchema).min(1).max(20).messages({
    "array.min": "At least one channel is required",
    "array.max": "Maximum 20 channels allowed",
  }),
});

const updateChannelSchema = Joi.object({
  channelName: Joi.string().trim().min(1).max(100).optional(),
  apiUrl: Joi.string().uri().optional(),
  apiKey: Joi.string().trim().min(1).max(500).allow("", null).optional(),
  isActive: Joi.boolean().optional(),
  isPrimary: Joi.boolean().optional(),
  priority: Joi.number().integer().min(1).max(100).optional(),
  aggregatorType: Joi.string()
    .valid(...ALLOWED_AGGREGATOR_TYPES)
    .optional(),
  aggregatorConfig: Joi.when("aggregatorType", {
    switch: [
      { is: "DELHIVERY", then: delhiveryAggregatorConfigSchema.required() },
      {
        is: "DELHIVERY_B2B",
        then: delhiveryB2BAggregatorConfigSchema.required(),
      },
      { is: "BLUEDART", then: bluedartAggregatorConfigSchema.required() },
    ],
    otherwise: Joi.object().optional().allow(null),
  }),
  webhookSecret: Joi.string().trim().max(500).optional().allow("", null),
});

const switchChannelModeSchema = Joi.object({
  mode: Joi.string().valid("SINGLE", "MULTI").required(),
  migrateConfig: Joi.boolean().default(true),
});

module.exports = {
  ALLOWED_AGGREGATOR_TYPES,
  channelConfigSchema,
  channelModeSchema,
  createChannelSchema,
  updateChannelSchema,
  switchChannelModeSchema,
};
