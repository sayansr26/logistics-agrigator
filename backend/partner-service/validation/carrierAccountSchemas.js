const Joi = require("joi");

const SERVICE_TYPES = ["SURFACE", "AIR", "EXPRESS"];

const accountSchema = Joi.object({
  channelName: Joi.string().trim().min(1).max(150).required().messages({
    "string.empty": "Channel name is required (e.g. \"Delhivery Surface A\")",
  }),
  accountRef: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Account reference is required (e.g. \"Account 1\")",
  }),
  serviceType: Joi.string()
    .valid(...SERVICE_TYPES)
    .default("SURFACE"),
  minWeight: Joi.number().min(0).default(0),
  // null / omitted maxWeight = open-ended ("All Weight")
  maxWeight: Joi.number().min(0).allow(null).optional(),
  channelConfigId: Joi.string().uuid().allow(null).optional(),
  credentials: Joi.object().allow(null).optional(),
  isActive: Joi.boolean().default(true),
  priority: Joi.number().integer().min(1).max(100).default(1),
}).custom((value, helpers) => {
  if (
    value.maxWeight !== null &&
    value.maxWeight !== undefined &&
    value.maxWeight < value.minWeight
  ) {
    return helpers.error("any.invalid", {
      message: "maxWeight must be greater than or equal to minWeight",
    });
  }
  return value;
}, "weight-slab-range");

const createCarrierAccountSchema = Joi.object({
  partnerId: Joi.string().optional(), // comes from URL param
  accounts: Joi.array().items(accountSchema).min(1).max(50).required().messages({
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
  minWeight: Joi.number().min(0).optional(),
  maxWeight: Joi.number().min(0).allow(null).optional(),
  channelConfigId: Joi.string().uuid().allow(null).optional(),
  credentials: Joi.object().allow(null).optional(),
  isActive: Joi.boolean().optional(),
  priority: Joi.number().integer().min(1).max(100).optional(),
}).min(1);

module.exports = {
  SERVICE_TYPES,
  accountSchema,
  createCarrierAccountSchema,
  updateCarrierAccountSchema,
};
