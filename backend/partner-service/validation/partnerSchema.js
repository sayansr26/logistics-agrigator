const Joi = require("joi");

const partnerSchema = {
  create: Joi.object({
    name: Joi.string().required().trim().max(100),
    code: Joi.string().required().trim().uppercase().max(50),
    displayName: Joi.string().required().trim().max(100),
    isActive: Joi.boolean().default(true),

    // API Configuration - Support both field names
    // apiUrl is optional — channels are managed separately via Manage Channels page
    apiUrl: Joi.string().uri().allow("", null).optional(),
    apiEndpoint: Joi.string().uri(), // Alias for apiUrl (frontend compatibility)
    apiToken: Joi.string().trim().allow("", null),
    apiKey: Joi.string().trim().allow("", null), // Alias for apiToken
    apiVersion: Joi.string().trim().allow("", null),

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

    // API Configuration - Support both field names
    apiUrl: Joi.string().uri(),
    apiEndpoint: Joi.string().uri(), // Alias for apiUrl
    apiToken: Joi.string().trim().allow("", null),
    apiKey: Joi.string().trim().allow("", null), // Alias for apiToken
    apiVersion: Joi.string().trim().allow("", null),

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
    serviceType: Joi.string().valid(
      "SURFACE",
      "AIR",
      "EXPRESS",
      "STANDARD",
      "ECONOMY",
    ),
    codAmount: Joi.number().min(0),
    partnerId: Joi.string(),
    declaredValue: Joi.number().min(0),
    shipmentValue: Joi.number().min(0),
    paymentMode: Joi.string().valid("PREPAID", "COD", "prepaid", "cod"),
    dimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
    }),
    isFragile: Joi.boolean().default(false),
    outletId: Joi.string().allow("", null),
    sortBy: Joi.string().valid("cheapest", "highest"),
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
