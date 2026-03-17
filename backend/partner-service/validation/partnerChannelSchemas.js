const Joi = require("joi");

const ALLOWED_AGGREGATOR_TYPES = ["DELHIVERY", "BLUEDART"];

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
  apiKey: Joi.string().trim().min(1).max(500).allow("", null).optional(),
  isActive: Joi.boolean().default(true),
  isPrimary: Joi.boolean().default(false),
  priority: Joi.number().integer().min(1).max(100).default(1),
  aggregatorType: Joi.string()
    .valid(...ALLOWED_AGGREGATOR_TYPES)
    .required()
    .messages({
      "any.only": "Aggregator type must be one of: DELHIVERY, BLUEDART",
      "any.required": "Aggregator type is required",
    }),
  aggregatorConfig: Joi.object().optional().allow(null),
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
  aggregatorConfig: Joi.object().optional().allow(null),
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
