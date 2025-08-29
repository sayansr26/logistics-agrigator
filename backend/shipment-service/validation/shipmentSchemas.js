const Joi = require("joi");

// Address validation schema
const addressSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 100 characters",
  }),

  phone: Joi.string()
    .pattern(/^\+91[0-9]{10}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Phone number must be in format +91XXXXXXXXXX",
    }),

  email: Joi.string().email().optional().allow(null, "").messages({
    "string.email": "Please provide a valid email address",
  }),

  addressLine1: Joi.string().trim().min(5).max(255).required().messages({
    "string.empty": "Address line 1 is required",
    "string.min": "Address line 1 must be at least 5 characters long",
    "string.max": "Address line 1 cannot exceed 255 characters",
  }),

  addressLine2: Joi.string()
    .trim()
    .max(255)
    .optional()
    .allow(null, "")
    .messages({
      "string.max": "Address line 2 cannot exceed 255 characters",
    }),

  landmark: Joi.string().trim().max(100).optional().allow(null, "").messages({
    "string.max": "Landmark cannot exceed 100 characters",
  }),

  city: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "City is required",
    "string.min": "City must be at least 2 characters long",
    "string.max": "City cannot exceed 50 characters",
  }),

  state: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "State is required",
    "string.min": "State must be at least 2 characters long",
    "string.max": "State cannot exceed 50 characters",
  }),

  pincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "Pincode is required",
      "string.pattern.base": "Pincode must be exactly 6 digits",
    }),

  country: Joi.string().trim().default("India").messages({
    "string.max": "Country cannot exceed 50 characters",
  }),
});

// Package dimensions validation schema
const dimensionsSchema = Joi.object({
  length: Joi.number().positive().precision(2).max(200).required().messages({
    "number.base": "Length must be a valid number",
    "number.positive": "Length must be positive",
    "number.max": "Length cannot exceed 200 cm",
  }),

  width: Joi.number().positive().precision(2).max(200).required().messages({
    "number.base": "Width must be a valid number",
    "number.positive": "Width must be positive",
    "number.max": "Width cannot exceed 200 cm",
  }),

  height: Joi.number().positive().precision(2).max(200).required().messages({
    "number.base": "Height must be a valid number",
    "number.positive": "Height must be positive",
    "number.max": "Height cannot exceed 200 cm",
  }),
});

// Package details validation schema
const packageSchema = Joi.object({
  weight: Joi.number().positive().precision(3).max(50).required().messages({
    "number.base": "Weight must be a valid number",
    "number.positive": "Weight must be positive",
    "number.max": "Weight cannot exceed 50 kg",
  }),

  dimensions: dimensionsSchema.required(),

  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow(null, "")
    .messages({
      "string.max": "Description cannot exceed 500 characters",
    }),

  value: Joi.number()
    .positive()
    .precision(2)
    .max(1000000)
    .optional()
    .allow(null)
    .messages({
      "number.base": "Package value must be a valid number",
      "number.positive": "Package value must be positive",
      "number.max": "Package value cannot exceed ₹10,00,000",
    }),

  fragile: Joi.boolean().default(false).messages({
    "boolean.base": "Fragile must be true or false",
  }),
});

// Create shipment validation schema
const createShipmentSchema = Joi.object({
  orderId: Joi.string().trim().min(3).max(100).required().messages({
    "string.empty": "Order ID is required",
    "string.min": "Order ID must be at least 3 characters long",
    "string.max": "Order ID cannot exceed 100 characters",
  }),

  pickupAddress: addressSchema.required(),

  deliveryAddress: addressSchema.required(),

  packageDetails: packageSchema.required(),

  paymentType: Joi.string()
    .valid("PREPAID", "COD")
    .default("PREPAID")
    .messages({
      "any.only": "Payment type must be either PREPAID or COD",
    }),

  codAmount: Joi.when("paymentType", {
    is: "COD",
    then: Joi.number().positive().precision(2).max(100000).required().messages({
      "number.base": "COD amount must be a valid number",
      "number.positive": "COD amount must be positive",
      "number.max": "COD amount cannot exceed ₹1,00,000",
      "any.required": "COD amount is required when payment type is COD",
    }),
    otherwise: Joi.forbidden().messages({
      "any.unknown": "COD amount should not be provided for prepaid shipments",
    }),
  }),

  serviceType: Joi.string()
    .valid("STANDARD", "EXPRESS", "ECONOMY")
    .default("STANDARD")
    .messages({
      "any.only": "Service type must be STANDARD, EXPRESS, or ECONOMY",
    }),

  specialInstructions: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow(null, "")
    .messages({
      "string.max": "Special instructions cannot exceed 500 characters",
    }),
});

// Update shipment validation schema
const updateShipmentSchema = Joi.object({
  status: Joi.string()
    .valid(
      "CREATED",
      "BOOKED",
      "PICKED_UP",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RTO",
    )
    .optional()
    .messages({
      "any.only": "Invalid shipment status",
    }),

  specialInstructions: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow(null, "")
    .messages({
      "string.max": "Special instructions cannot exceed 500 characters",
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Tracking event validation schema
const trackingEventSchema = Joi.object({
  status: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Event status is required",
    "string.min": "Status must be at least 2 characters long",
    "string.max": "Status cannot exceed 50 characters",
  }),

  message: Joi.string().trim().min(5).max(500).required().messages({
    "string.empty": "Event message is required",
    "string.min": "Message must be at least 5 characters long",
    "string.max": "Message cannot exceed 500 characters",
  }),

  location: Joi.string().trim().max(100).optional().allow(null, "").messages({
    "string.max": "Location cannot exceed 100 characters",
  }),

  timestamp: Joi.date()
    .iso()
    .optional()
    .default(() => new Date())
    .messages({
      "date.format": "Timestamp must be a valid ISO date",
    }),
});

// Query parameters validation schemas
const getShipmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a valid number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),

  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.base": "Limit must be a valid number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  status: Joi.string()
    .valid(
      "CREATED",
      "BOOKED",
      "PICKED_UP",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "RTO",
    )
    .optional()
    .messages({
      "any.only": "Invalid status filter",
    }),

  paymentType: Joi.string().valid("PREPAID", "COD").optional().messages({
    "any.only": "Payment type must be either PREPAID or COD",
  }),

  dateFrom: Joi.date().iso().optional().messages({
    "date.format": "Date from must be a valid ISO date",
  }),

  dateTo: Joi.date()
    .iso()
    .optional()
    .when("dateFrom", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("dateFrom")).messages({
        "date.min": "Date to must be after date from",
      }),
    })
    .messages({
      "date.format": "Date to must be a valid ISO date",
    }),
});

// Rate calculation validation schema
const rateCalculationSchema = Joi.object({
  fromPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "From pincode is required",
      "string.pattern.base": "From pincode must be exactly 6 digits",
    }),

  toPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "To pincode is required",
      "string.pattern.base": "To pincode must be exactly 6 digits",
    }),

  weight: Joi.number().positive().precision(3).max(50).required().messages({
    "number.base": "Weight must be a valid number",
    "number.positive": "Weight must be positive",
    "number.max": "Weight cannot exceed 50 kg",
  }),

  serviceType: Joi.string()
    .valid("STANDARD", "EXPRESS", "ECONOMY")
    .default("STANDARD")
    .messages({
      "any.only": "Service type must be STANDARD, EXPRESS, or ECONOMY",
    }),

  dimensions: dimensionsSchema.optional().default({
    length: 10,
    width: 10,
    height: 10,
  }),

  codAmount: Joi.number()
    .positive()
    .precision(2)
    .max(100000)
    .optional()
    .allow(null)
    .messages({
      "number.base": "COD amount must be a valid number",
      "number.positive": "COD amount must be positive",
      "number.max": "COD amount cannot exceed ₹1,00,000",
    }),
});

// Partner selection validation schema
const partnerSelectionSchema = Joi.object({
  fromPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "From pincode is required",
      "string.pattern.base": "From pincode must be exactly 6 digits",
    }),

  toPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "To pincode is required",
      "string.pattern.base": "To pincode must be exactly 6 digits",
    }),

  weight: Joi.number().positive().precision(3).max(50).required().messages({
    "number.base": "Weight must be a valid number",
    "number.positive": "Weight must be positive",
    "number.max": "Weight cannot exceed 50 kg",
  }),

  serviceType: Joi.string()
    .valid("STANDARD", "EXPRESS", "ECONOMY")
    .default("STANDARD")
    .messages({
      "any.only": "Service type must be STANDARD, EXPRESS, or ECONOMY",
    }),

  dimensions: dimensionsSchema.optional().default({
    length: 10,
    width: 10,
    height: 10,
  }),

  codAmount: Joi.number()
    .positive()
    .precision(2)
    .max(100000)
    .optional()
    .allow(null)
    .messages({
      "number.base": "COD amount must be a valid number",
      "number.positive": "COD amount must be positive",
      "number.max": "COD amount cannot exceed ₹1,00,000",
    }),

  strategy: Joi.string()
    .valid("cheapest", "fastest", "balanced")
    .default("cheapest")
    .messages({
      "any.only": "Strategy must be cheapest, fastest, or balanced",
    }),
});

// Serviceability check validation schema
const serviceabilitySchema = Joi.object({
  fromPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "From pincode is required",
      "string.pattern.base": "From pincode must be exactly 6 digits",
    }),

  toPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.empty": "To pincode is required",
      "string.pattern.base": "To pincode must be exactly 6 digits",
    }),

  serviceType: Joi.string()
    .valid("STANDARD", "EXPRESS", "ECONOMY")
    .default("STANDARD")
    .messages({
      "any.only": "Service type must be STANDARD, EXPRESS, or ECONOMY",
    }),
});

// SHIP-004: New validation schemas for tracking features

/**
 * Delivery confirmation validation schema
 */
const deliveryConfirmationSchema = Joi.object({
  recipientName: Joi.string().min(2).max(100).required().messages({
    "string.base": "Recipient name must be a string",
    "string.empty": "Recipient name is required",
    "string.min": "Recipient name must be at least 2 characters long",
    "string.max": "Recipient name cannot exceed 100 characters",
    "any.required": "Recipient name is required",
  }),

  recipientSignature: Joi.string().uri().optional().messages({
    "string.uri": "Recipient signature must be a valid URL",
  }),

  deliveryImage: Joi.string().uri().optional().messages({
    "string.uri": "Delivery image must be a valid URL",
  }),

  otp: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .optional()
    .messages({
      "string.length": "OTP must be exactly 6 digits",
      "string.pattern.base": "OTP must contain only numeric digits",
    }),

  notes: Joi.string().max(500).optional().messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),

  deliveryPersonName: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Delivery person name must be at least 2 characters long",
    "string.max": "Delivery person name cannot exceed 100 characters",
  }),

  deliveryTime: Joi.date().iso().optional().messages({
    "date.format": "Delivery time must be a valid ISO date",
  }),
});

/**
 * Analytics query validation schema
 */
const analyticsQuerySchema = Joi.object({
  timeRange: Joi.string()
    .valid("1d", "7d", "30d", "90d")
    .default("7d")
    .messages({
      "any.only": "Time range must be one of: 1d, 7d, 30d, 90d",
    }),
});

module.exports = {
  createShipmentSchema,
  updateShipmentSchema,
  trackingEventSchema,
  getShipmentsQuerySchema,
  rateCalculationSchema,
  partnerSelectionSchema,
  serviceabilitySchema,
  addressSchema,
  packageSchema,
  dimensionsSchema,
  // New SHIP-004 schemas
  deliveryConfirmationSchema,
  analyticsQuerySchema,
};
