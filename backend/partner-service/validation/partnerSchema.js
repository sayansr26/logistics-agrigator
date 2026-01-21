const Joi = require("joi");

const partnerSchema = {
  create: Joi.object({
    name: Joi.string().required().trim().max(100),
    code: Joi.string().required().trim().uppercase().max(50),
    displayName: Joi.string().required().trim().max(100),
    isActive: Joi.boolean().default(true),

    // Channel Mode (Single/Multi API endpoints)
    channelMode: Joi.string().valid("SINGLE", "MULTI").default("SINGLE"),

    // API Configuration - Support both field names
    apiUrl: Joi.string().uri().when("channelMode", {
      is: "SINGLE",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    apiEndpoint: Joi.string().uri(), // Alias for apiUrl (frontend compatibility)
    apiToken: Joi.string().trim().allow("", null),
    apiKey: Joi.string().trim().allow("", null), // Alias for apiToken
    apiVersion: Joi.string().trim().allow("", null),

    // Multi-channel configuration (only for MULTI mode)
    channelConfigs: Joi.when("channelMode", {
      is: "MULTI",
      then: Joi.array()
        .items(
          Joi.object({
            channelName: Joi.string().trim().min(1).max(100).required(),
            apiUrl: Joi.string().uri().required(),
            apiKey: Joi.string()
              .trim()
              .min(1)
              .max(500)
              .allow("", null)
              .optional(),
            isActive: Joi.boolean().default(true),
            isPrimary: Joi.boolean().default(false),
            priority: Joi.number().integer().min(1).max(100).default(1),
          }),
        )
        .min(1)
        .max(20)
        .required(),
      otherwise: Joi.array().max(0).optional(),
    }),

    // Service Configuration
    supportsCOD: Joi.boolean().default(false),
    supportsReverse: Joi.boolean().default(false),
    minWeight: Joi.number().positive().allow(null), // Added for frontend compatibility
    maxWeight: Joi.number().positive().allow(null),
    maxDimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
    }).allow(null),

    // Pricing Configuration
    baseRate: Joi.number().positive().allow(null),
    perKgRate: Joi.number().positive().allow(null),
    codChargePercent: Joi.number().min(0).max(100).allow(null),
    fuelSurcharge: Joi.number().min(0).max(100).allow(null),

    // Service Areas - Allow empty array
    servicePincodes: Joi.array()
      .items(Joi.string().pattern(/^\d{6}$/))
      .default([]),
  }),

  update: Joi.object({
    name: Joi.string().trim().max(100),
    code: Joi.string().trim().uppercase().max(50),
    displayName: Joi.string().trim().max(100),
    isActive: Joi.boolean(),

    // Channel Mode (Single/Multi API endpoints)
    channelMode: Joi.string().valid("SINGLE", "MULTI"),

    // API Configuration - Support both field names
    apiUrl: Joi.string().uri(),
    apiEndpoint: Joi.string().uri(), // Alias for apiUrl
    apiToken: Joi.string().trim().allow("", null),
    apiKey: Joi.string().trim().allow("", null), // Alias for apiToken
    apiVersion: Joi.string().trim().allow("", null),

    // Multi-channel configuration (only for MULTI mode)
    channelConfigs: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().optional(),
          channelName: Joi.string().trim().min(1).max(100).required(),
          apiUrl: Joi.string().uri().required(),
          apiKey: Joi.string()
            .trim()
            .min(1)
            .max(500)
            .allow("", null)
            .optional(),
          isActive: Joi.boolean().default(true),
          isPrimary: Joi.boolean().default(false),
          priority: Joi.number().integer().min(1).max(100).default(1),
        }),
      )
      .min(1)
      .max(20)
      .optional(),

    // Service Configuration
    supportsCOD: Joi.boolean(),
    supportsReverse: Joi.boolean(),
    minWeight: Joi.number().positive().allow(null), // Added for frontend compatibility
    maxWeight: Joi.number().positive().allow(null),
    maxDimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
    }).allow(null),

    // Pricing Configuration
    baseRate: Joi.number().positive().allow(null),
    perKgRate: Joi.number().positive().allow(null),
    codChargePercent: Joi.number().min(0).max(100).allow(null),
    fuelSurcharge: Joi.number().min(0).max(100).allow(null),

    // Service Areas - Allow empty array
    servicePincodes: Joi.array()
      .items(Joi.string().pattern(/^\d{6}$/))
      .default([]),
  }),

  calculateRate: Joi.object({
    fromPincode: Joi.string()
      .pattern(/^\d{6}$/)
      .required(),
    toPincode: Joi.string()
      .pattern(/^\d{6}$/)
      .required(),
    weight: Joi.number().positive().required(),
    serviceType: Joi.string().valid("SURFACE", "AIR", "EXPRESS"),
    codAmount: Joi.number().min(0),
    partnerId: Joi.string(),
  }),

  checkServiceability: Joi.object({
    fromPincode: Joi.string()
      .pattern(/^\d{6}$/)
      .required(),
    toPincode: Joi.string()
      .pattern(/^\d{6}$/)
      .required(),
    partnerId: Joi.string(),
  }),
};

module.exports = { partnerSchema };
