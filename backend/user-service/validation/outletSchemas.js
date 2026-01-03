// Outlet Validation Schemas
// Joi validation for outlet and address management

const Joi = require("joi");

// Create outlet schema
const createOutletSchema = Joi.object({
  // Basic info (required)
  name: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),

  // Optional company info
  companyName: Joi.string().min(2).max(200).optional().allow("", null),
  category: Joi.string().max(100).optional().allow("", null),
  tanPan: Joi.string().max(50).optional().allow("", null),
  gst: Joi.string().max(50).optional().allow("", null),
  companyAddress: Joi.object({
    street: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    postalCode: Joi.string().max(10).optional(),
    country: Joi.string().max(100).optional(),
  })
    .optional()
    .allow(null),

  // Optional initial addresses
  addresses: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().max(100).required(),
        addressType: Joi.string()
          .valid("GENERAL", "PICKUP", "RETURN")
          .default("GENERAL"),
        name: Joi.string().max(100).required(),
        phone: Joi.string()
          .pattern(/^\+?[1-9]\d{1,14}$/)
          .required(),
        email: Joi.string().email().optional().allow("", null),
        addressLine1: Joi.string().max(255).required(),
        addressLine2: Joi.string().max(255).optional().allow("", null),
        landmark: Joi.string().max(100).optional().allow("", null),
        city: Joi.string().max(100).required(),
        state: Joi.string().max(100).required(),
        pincode: Joi.string()
          .pattern(/^[0-9]{6}$/)
          .required(),
        country: Joi.string().max(100).default("India"),
        isDefaultPickup: Joi.boolean().default(false),
        isDefaultReturn: Joi.boolean().default(false),
      }),
    )
    .optional()
    .default([]),
});

// Update outlet schema
const updateOutletSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional(),
  companyName: Joi.string().min(2).max(200).optional().allow("", null),
  category: Joi.string().max(100).optional().allow("", null),
  tanPan: Joi.string().max(50).optional().allow("", null),
  gst: Joi.string().max(50).optional().allow("", null),
  companyAddress: Joi.object({
    street: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    postalCode: Joi.string().max(10).optional(),
    country: Joi.string().max(100).optional(),
  })
    .optional()
    .allow(null),
  isActive: Joi.boolean().optional(),
});

// Create address schema
const createAddressSchema = Joi.object({
  label: Joi.string().max(100).required(),
  addressType: Joi.string()
    .valid("GENERAL", "PICKUP", "RETURN")
    .default("GENERAL"),
  name: Joi.string().max(100).required(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
  email: Joi.string().email().optional().allow("", null),
  addressLine1: Joi.string().max(255).required(),
  addressLine2: Joi.string().max(255).optional().allow("", null),
  landmark: Joi.string().max(100).optional().allow("", null),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).required(),
  pincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),
  country: Joi.string().max(100).default("India"),
  isDefaultPickup: Joi.boolean().default(false),
  isDefaultReturn: Joi.boolean().default(false),
});

// Update address schema
const updateAddressSchema = Joi.object({
  label: Joi.string().max(100).optional(),
  addressType: Joi.string().valid("GENERAL", "PICKUP", "RETURN").optional(),
  name: Joi.string().max(100).optional(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional(),
  email: Joi.string().email().optional().allow("", null),
  addressLine1: Joi.string().max(255).optional(),
  addressLine2: Joi.string().max(255).optional().allow("", null),
  landmark: Joi.string().max(100).optional().allow("", null),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  pincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .optional(),
  country: Joi.string().max(100).optional(),
  isDefaultPickup: Joi.boolean().optional(),
  isDefaultReturn: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
});

// List outlets query schema
const listOutletsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().min(1).max(255).optional(),
  isActive: Joi.boolean().optional(),
  sortBy: Joi.string()
    .valid("createdAt", "updatedAt", "name", "email")
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

module.exports = {
  createOutletSchema,
  updateOutletSchema,
  createAddressSchema,
  updateAddressSchema,
  listOutletsQuerySchema,
};

