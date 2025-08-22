const Joi = require("joi");

const partnerSchema = {
  create: Joi.object({
    name: Joi.string().required().trim().max(100),
    code: Joi.string().required().trim().uppercase().max(50),
    displayName: Joi.string().required().trim().max(100),
    isActive: Joi.boolean().default(true),

    // API Configuration
    apiUrl: Joi.string().required().uri(),
    apiToken: Joi.string().trim(),
    apiVersion: Joi.string().trim(),

    // Service Configuration
    supportsCOD: Joi.boolean().default(false),
    supportsReverse: Joi.boolean().default(false),
    maxWeight: Joi.number().positive(),
    maxDimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
    }),

    // Pricing Configuration
    baseRate: Joi.number().positive(),
    perKgRate: Joi.number().positive(),
    codChargePercent: Joi.number().min(0).max(100),
    fuelSurcharge: Joi.number().min(0).max(100),

    // Service Areas
    servicePincodes: Joi.array()
      .items(Joi.string().pattern(/^\d{6}$/))
      .min(1),
  }),

  update: Joi.object({
    name: Joi.string().trim().max(100),
    code: Joi.string().trim().uppercase().max(50),
    displayName: Joi.string().trim().max(100),
    isActive: Joi.boolean(),

    // API Configuration
    apiUrl: Joi.string().uri(),
    apiToken: Joi.string().trim(),
    apiVersion: Joi.string().trim(),

    // Service Configuration
    supportsCOD: Joi.boolean(),
    supportsReverse: Joi.boolean(),
    maxWeight: Joi.number().positive(),
    maxDimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
    }),

    // Pricing Configuration
    baseRate: Joi.number().positive(),
    perKgRate: Joi.number().positive(),
    codChargePercent: Joi.number().min(0).max(100),
    fuelSurcharge: Joi.number().min(0).max(100),

    // Service Areas
    servicePincodes: Joi.array()
      .items(Joi.string().pattern(/^\d{6}$/))
      .min(1),
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
