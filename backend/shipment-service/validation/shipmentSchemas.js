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
  length: Joi.number().positive().precision(2).required().messages({
    "number.base": "Length must be a valid number",
    "number.positive": "Length must be positive",
  }),

  width: Joi.number().positive().precision(2).required().messages({
    "number.base": "Width must be a valid number",
    "number.positive": "Width must be positive",
  }),

  height: Joi.number().positive().precision(2).required().messages({
    "number.base": "Height must be a valid number",
    "number.positive": "Height must be positive",
  }),
});

// Package details validation schema
const packageSchema = Joi.object({
  weight: Joi.number().positive().precision(3).required().messages({
    "number.base": "Weight must be a valid number",
    "number.positive": "Weight must be positive",
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

// Invoice schema for B2B shipments
const invoiceItemSchema = Joi.object({
  eWayBillNo: Joi.string().trim().max(50).optional().allow(null, ""),
  invoiceNo: Joi.string().trim().max(100).required().messages({
    "string.empty": "Invoice number is required",
  }),
  invoiceAmt: Joi.number()
    .positive()
    .precision(2)
    .max(10000000)
    .required()
    .messages({
      "number.base": "Invoice amount must be a valid number",
      "number.positive": "Invoice amount must be positive",
    }),
  invoiceDate: Joi.date().iso().required().messages({
    "date.base": "Invoice date is required",
  }),
  attachmentUrl: Joi.string().trim().max(500).optional().allow(null, ""),
});

// Box dimensions schema for multi-box B2B shipments
const boxItemSchema = Joi.object({
  boxNumber: Joi.number().integer().min(1).required(),
  length: Joi.number().positive().precision(2).required().messages({
    "number.positive": "Length must be positive",
  }),
  width: Joi.number().positive().precision(2).required().messages({
    "number.positive": "Width must be positive",
  }),
  height: Joi.number().positive().precision(2).required().messages({
    "number.positive": "Height must be positive",
  }),
});

// RTO address schema (optional, only when rtoSameAsPickup is false)
const rtoAddressSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string()
    .pattern(/^\+91[0-9]{10}$/)
    .required(),
  addressLine1: Joi.string().trim().min(5).max(255).required(),
  addressLine2: Joi.string().trim().max(255).optional().allow(null, ""),
  landmark: Joi.string().trim().max(100).optional().allow(null, ""),
  city: Joi.string().trim().min(2).max(50).required(),
  state: Joi.string().trim().min(2).max(50).required(),
  pincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),
  country: Joi.string().trim().default("India"),
});

// Create shipment validation schema
const createShipmentSchema = Joi.object({
  orderId: Joi.string().trim().min(3).max(100).required().messages({
    "string.empty": "Order ID is required",
    "string.min": "Order ID must be at least 3 characters long",
    "string.max": "Order ID cannot exceed 100 characters",
  }),

  shipmentType: Joi.string().valid("B2B", "B2C").default("B2C").messages({
    "any.only": "Shipment type must be either B2B or B2C",
  }),

  shipmentDirection: Joi.string()
    .valid("FORWARD", "REVERSE")
    .default("FORWARD")
    .messages({
      "any.only": "Shipment direction must be either FORWARD or REVERSE",
    }),

  outletId: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Outlet ID must be a valid UUID",
  }),

  outletUserId: Joi.string().optional().allow(null, "").messages({
    "string.base": "Outlet User ID must be a string",
  }),

  pickupAddressId: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Pickup address ID must be a valid UUID",
  }),

  // Optional registered warehouse/pickup location name (needed for some couriers like Delhivery).
  // Frontend should pass the selected address label (warehouse name).
  pickupLocation: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .allow(null, ""),

  pickupAddress: addressSchema.required(),

  deliveryAddress: addressSchema.required(),

  rtoSameAsPickup: Joi.boolean().default(true),

  rtoAddress: Joi.when("rtoSameAsPickup", {
    is: false,
    then: rtoAddressSchema.required().messages({
      "any.required": "RTO address is required when not same as pickup",
    }),
    otherwise: Joi.optional().allow(null),
  }),

  productDescription: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow(null, "")
    .messages({
      "string.max": "Product description cannot exceed 1000 characters",
    }),

  hsnCode: Joi.string().trim().max(20).optional().allow(null, ""),

  gstPercentage: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .optional()
    .allow(null),

  packageDetails: packageSchema.required(),

  numberOfBoxes: Joi.number().integer().min(1).max(100).default(1).messages({
    "number.base": "Number of boxes must be a valid number",
    "number.integer": "Number of boxes must be an integer",
    "number.min": "Number of boxes must be at least 1",
    "number.max": "Number of boxes cannot exceed 100",
  }),

  boxes: Joi.array().items(boxItemSchema).optional().allow(null).messages({
    "array.base": "Boxes must be an array",
  }),

  invoices: Joi.array()
    .items(invoiceItemSchema)
    .optional()
    .allow(null)
    .messages({
      "array.base": "Invoices must be an array",
    }),

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
    otherwise: Joi.number().optional().allow(null, 0),
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

  selectedPartnerId: Joi.string().optional().allow(null).messages({
    "string.base": "Selected partner ID must be a string",
  }),

  quoteSnapshot: Joi.object().optional().allow(null),
});

// Quote request for staged shipment creation
const shipmentQuoteSchema = Joi.object({
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

  weight: Joi.number().positive().precision(3).required().messages({
    "number.base": "Weight must be a valid number",
    "number.positive": "Weight must be positive",
  }),

  numberOfBoxes: Joi.number().integer().min(1).max(100).default(1).messages({
    "number.base": "Number of boxes must be a valid number",
    "number.integer": "Number of boxes must be an integer",
    "number.min": "Number of boxes must be at least 1",
    "number.max": "Number of boxes cannot exceed 100",
  }),

  dimensions: dimensionsSchema.required(),

  serviceType: Joi.string()
    .valid("STANDARD", "EXPRESS", "ECONOMY")
    .default("STANDARD")
    .messages({
      "any.only": "Service type must be STANDARD, EXPRESS, or ECONOMY",
    }),

  paymentType: Joi.string()
    .valid("PREPAID", "COD")
    .default("PREPAID")
    .messages({
      "any.only": "Payment type must be PREPAID or COD",
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

  shipmentType: Joi.string().valid("B2B", "B2C").default("B2C"),

  declaredValue: Joi.number()
    .min(0)
    .precision(2)
    .max(10000000)
    .optional()
    .messages({
      "number.base": "Declared value must be a valid number",
      "number.min": "Declared value cannot be negative",
      "number.max": "Declared value cannot exceed ₹1,00,00,000",
    }),

  shipmentValue: Joi.number().min(0).precision(2).max(10000000).optional(),

  isFragile: Joi.boolean().optional().default(false),

  outletId: Joi.string().optional().allow("", null),

  sortBy: Joi.string().valid("cheapest", "highest").default("cheapest"),
});

// Dispute re-rate schema
const rerateShipmentSchema = Joi.object({
  disputedWeight: Joi.number().positive().precision(3).optional().messages({
    "number.positive": "Disputed weight must be positive",
  }),

  disputedLength: Joi.number().positive().precision(2).optional().messages({
    "number.positive": "Disputed length must be positive",
  }),

  disputedWidth: Joi.number().positive().precision(2).optional().messages({
    "number.positive": "Disputed width must be positive",
  }),

  disputedHeight: Joi.number().positive().precision(2).optional().messages({
    "number.positive": "Disputed height must be positive",
  }),

  reason: Joi.string().trim().min(5).max(500).required().messages({
    "string.empty": "Reason is required",
    "string.min": "Reason must be at least 5 characters",
    "string.max": "Reason cannot exceed 500 characters",
  }),

  codAction: Joi.string()
    .valid("DEDUCT_WALLET", "UPDATE_COD")
    .optional()
    .messages({
      "any.only": "codAction must be DEDUCT_WALLET or UPDATE_COD",
    }),

  // Optional manual courier cost (purchase amount). When omitted, the courier
  // cost is taken from the rate engine cost side if available, else left unknown.
  courierCharge: Joi.number().min(0).precision(2).optional().messages({
    "number.min": "Courier charge cannot be negative",
  }),
}).min(2);

// Re-rate preview (dry-run) — all fields optional, no reason/wallet side effects
const rerateShipmentPreviewSchema = Joi.object({
  disputedWeight: Joi.number().positive().precision(3).optional(),
  disputedLength: Joi.number().positive().precision(2).optional(),
  disputedWidth: Joi.number().positive().precision(2).optional(),
  disputedHeight: Joi.number().positive().precision(2).optional(),
  courierCharge: Joi.number().min(0).precision(2).optional(),
}).min(1);

// Bulk re-rate — array of rows keyed by AWB number
const bulkRerateRowSchema = Joi.object({
  awbNumber: Joi.string().trim().min(1).required().messages({
    "any.required": "awbNumber is required",
    "string.empty": "awbNumber is required",
  }),
  newWeight: Joi.number().positive().precision(3).optional(),
  newLength: Joi.number().positive().precision(2).optional(),
  newWidth: Joi.number().positive().precision(2).optional(),
  newHeight: Joi.number().positive().precision(2).optional(),
  courierCharge: Joi.number().min(0).precision(2).optional(),
  codAction: Joi.string().valid("DEDUCT_WALLET", "UPDATE_COD").optional(),
}).or("newWeight", "newLength", "newWidth", "newHeight", "courierCharge");

const bulkRerateSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    "string.min": "Reason must be at least 5 characters",
  }),
  rows: Joi.array().items(bulkRerateRowSchema).min(1).max(500).required().messages({
    "array.min": "At least one row is required",
    "array.max": "Maximum 500 rows per bulk re-rate",
  }),
});

const assignPartnerSchema = Joi.object({
  partnerId: Joi.string().required().messages({
    "any.required": "Partner ID is required",
    "string.empty": "Partner ID is required",
  }),

  quoteSnapshot: Joi.object({
    partnerId: Joi.string().required(),
    partnerName: Joi.string().required(),
    totalAmount: Joi.number().min(0).required(),
    deliveryDays: Joi.number().integer().min(0).allow(null).optional(),
    volumetricDivisor: Joi.number().positive().optional(),
    volumetricWeight: Joi.number().positive().optional(),
    chargeableWeight: Joi.number().positive().optional(),
    actualWeight: Joi.number().positive().optional(),
  })
    .required()
    .unknown(true)
    .messages({
      "any.required": "Quote snapshot is required",
    }),

  pickupLocation: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .allow(null, ""),
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
      "HOLD",
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

  weight: Joi.number().positive().precision(3).required().messages({
    "number.base": "Weight must be a valid number",
    "number.positive": "Weight must be positive",
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

  weight: Joi.number().positive().precision(3).required().messages({
    "number.base": "Weight must be a valid number",
    "number.positive": "Weight must be positive",
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

// SHIP-005: Bulk Operations and Advanced Features validation schemas

const processBulkShipmentsSchema = Joi.object({
  file: Joi.any()
    .required()
    .description("CSV or Excel file containing shipment data"),
  clientId: Joi.string()
    .optional()
    .description("Client ID for multi-tenant support"),
});

const createNDRCaseSchema = Joi.object({
  reason: Joi.string()
    .valid(
      "ADDRESS_INCORRECT",
      "CONSIGNEE_UNAVAILABLE",
      "REFUSED_BY_CONSIGNEE",
      "DAMAGE_DURING_TRANSIT",
      "OTHER",
    )
    .required()
    .description("NDR failure reason"),

  description: Joi.string()
    .max(500)
    .optional()
    .description("Detailed description of the issue"),

  priority: Joi.string()
    .valid("LOW", "MEDIUM", "HIGH", "URGENT")
    .default("MEDIUM")
    .description("Priority level for NDR case"),
});

const takeNDRActionSchema = Joi.object({
  action: Joi.string()
    .valid("REATTEMPT_DELIVERY", "RETURN_TO_ORIGIN", "MARK_RESOLVED")
    .required()
    .description("Action to take on NDR case"),

  notes: Joi.string()
    .max(500)
    .optional()
    .description("Additional notes for the action"),

  preferredDate: Joi.date()
    .iso()
    .min("now")
    .optional()
    .description("Preferred date for reattempt (if applicable)"),
});

const generateShippingLabelSchema = Joi.object({
  format: Joi.string()
    .valid("A4", "A4_4", "4x6", "6x4")
    .default("4x6")
    .description("Label format/size"),

  copies: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(1)
    .description("Number of label copies"),
});

const generateBulkLabelsSchema = Joi.object({
  shipmentIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .max(100)
    .required()
    .description("Array of shipment IDs to generate labels for"),

  format: Joi.string()
    .valid("A4", "A4_4", "4x6", "6x4")
    .default("4x6")
    .description("Label format/size"),
});

const createManifestSchema = Joi.object({
  partnerId: Joi.string().required().description("Partner ID for the manifest"),

  shipmentIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .max(500)
    .required()
    .description("Array of shipment IDs to include in manifest"),
});

const schedulePickupSchema = Joi.object({
  partnerId: Joi.string()
    .required()
    .description("Partner ID for pickup coordination"),

  shipmentIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .max(100)
    .required()
    .description("Array of shipment IDs for pickup"),

  scheduledDate: Joi.date()
    .iso()
    .min("now")
    .required()
    .description("Preferred pickup date"),

  timeSlot: Joi.string()
    .valid(
      "09:00-12:00",
      "10:00-13:00",
      "11:00-14:00",
      "12:00-15:00",
      "14:00-17:00",
      "15:00-18:00",
    )
    .required()
    .description("Preferred pickup time slot"),

  pickupAddress: addressSchema.required().description("Pickup address details"),

  specialInstructions: Joi.string()
    .max(500)
    .optional()
    .description("Special pickup instructions"),
});

const updatePickupStatusSchema = Joi.object({
  status: Joi.string()
    .valid("CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED")
    .required()
    .description("New pickup status"),

  notes: Joi.string().max(500).optional().description("Status update notes"),

  actualPickupTime: Joi.date()
    .iso()
    .optional()
    .description("Actual pickup timestamp"),
});

// Phase 3: Lifecycle endpoint validation schemas

const refreshFromProviderSchema = Joi.object({});

const fetchCourierLabelSchema = Joi.object({
  format: Joi.string().valid("pdf", "png", "zpl").default("pdf").optional(),
});

const cancelRequestBodySchema = Joi.object({
  reason: Joi.string()
    .max(500)
    .optional()
    .default("User requested cancellation"),
});

const cancelShipmentSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required().messages({
      "string.guid": "Shipment ID must be a valid UUID",
      "any.required": "Shipment ID is required",
    }),
  }),
  body: cancelRequestBodySchema,
};

const cancelWithProviderSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required().messages({
      "string.guid": "Shipment ID must be a valid UUID",
      "any.required": "Shipment ID is required",
    }),
  }),
  body: cancelRequestBodySchema,
};

const retryBookingSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    pickupLocation: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .allow(null, ""),
  }),
};

module.exports = {
  createShipmentSchema,
  updateShipmentSchema,
  assignPartnerSchema,
  trackingEventSchema,
  getShipmentsQuerySchema,
  rateCalculationSchema,
  partnerSelectionSchema,
  serviceabilitySchema,
  shipmentQuoteSchema,
  rerateShipmentSchema,
  rerateShipmentPreviewSchema,
  bulkRerateSchema,
  addressSchema,
  packageSchema,
  dimensionsSchema,
  // New SHIP-004 schemas
  deliveryConfirmationSchema,
  analyticsQuerySchema,
  // Phase 3: Lifecycle schemas
  refreshFromProviderSchema,
  fetchCourierLabelSchema,
  cancelShipmentSchema,
  cancelWithProviderSchema,
  // SHIP-005 validation schemas
  processBulkShipmentsSchema,
  createNDRCaseSchema,
  takeNDRActionSchema,
  generateShippingLabelSchema,
  generateBulkLabelsSchema,
  createManifestSchema,
  schedulePickupSchema,
  updatePickupStatusSchema,
  retryBookingSchema,
};
