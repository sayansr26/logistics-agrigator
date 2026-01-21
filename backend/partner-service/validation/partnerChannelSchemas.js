const Joi = require("joi");

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
    .required()
    .messages({ "string.uri": "API URL must be a valid URL" }),
  apiKey: Joi.string().trim().min(1).max(500).allow("", null).optional(),
  isActive: Joi.boolean().default(true),
  isPrimary: Joi.boolean().default(false),
  priority: Joi.number().integer().min(1).max(100).default(1),
});

const channelModeSchema = Joi.object({
  channelMode: Joi.string().valid("SINGLE", "MULTI").default("SINGLE"),
});

const createChannelSchema = Joi.object({
  partnerId: Joi.string().uuid().required(),
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
});

const switchChannelModeSchema = Joi.object({
  mode: Joi.string().valid("SINGLE", "MULTI").required(),
  migrateConfig: Joi.boolean().default(true),
});

module.exports = {
  channelConfigSchema,
  channelModeSchema,
  createChannelSchema,
  updateChannelSchema,
  switchChannelModeSchema,
};
