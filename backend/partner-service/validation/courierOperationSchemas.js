const Joi = require("joi");

const addressSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  phone: Joi.string()
    .required()
    .pattern(/^(\+91)?[6-9]\d{9}$/),
  address: Joi.string().required().trim().min(5).max(500),
  city: Joi.string().required().trim(),
  state: Joi.string().required().trim(),
  pincode: Joi.string()
    .required()
    .pattern(/^\d{6}$/),
  email: Joi.string().email().optional().allow(null, ""),
});

const packageDetailsSchema = Joi.object({
  // Max raised from 50 to 5000 kg to support B2B/LTL freight channels
  // (e.g. Delhivery PTL handles consignments up to ~5000 kg).
  weight: Joi.number().required().min(0.01).max(5000),
  length: Joi.number().optional().min(1).max(200),
  width: Joi.number().optional().min(1).max(200),
  height: Joi.number().optional().min(1).max(200),
});

const bookShipmentSchema = Joi.object({
  partnerId: Joi.string().required(),
  shipmentId: Joi.string().uuid().optional(),
  orderId: Joi.string().required().trim(),
  // For Delhivery and other aggregators that require a registered warehouse/pickup location name.
  // This must match the pickup location configured in the courier panel.
  pickupLocation: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .allow(null, ""),
  pickupAddress: addressSchema.required(),
  deliveryAddress: addressSchema.required(),
  packageDetails: packageDetailsSchema.required(),
  // Business vertical of the shipment — drives rule-based channel selection
  shipmentType: Joi.string().valid("B2B", "B2C").default("B2C"),
  paymentType: Joi.string().valid("PREPAID", "COD").required(),
  codAmount: Joi.when("paymentType", {
    is: "COD",
    then: Joi.number().required().min(1),
    otherwise: Joi.number().optional().default(0),
  }),
  productDescription: Joi.string().optional().trim().max(200),
  hsnCode: Joi.string().optional().trim(),
  declaredValue: Joi.number().optional().min(0),
});

const cancelShipmentSchema = Joi.object({
  partnerId: Joi.string().required(),
  awbNumber: Joi.string().required().trim(),
  reason: Joi.string().optional().trim().max(500).default("Customer request"),
});

const trackShipmentParamsSchema = Joi.object({
  awbNumber: Joi.string().required().trim(),
});

const requestPickupSchema = Joi.object({
  partnerId: Joi.string().required(),
  pickupAddress: addressSchema.required(),
  pickupDate: Joi.date().iso().required(),
  packageCount: Joi.number().integer().min(1).required(),
  shipmentIds: Joi.array().items(Joi.string()).optional(),
  pickupTime: Joi.string().optional(),
});

const getLabelParamsSchema = Joi.object({
  awbNumber: Joi.string().required().trim(),
});

const getLabelQuerySchema = Joi.object({
  format: Joi.string()
    .valid("A4", "A4_4", "4x6", "6x4", "pdf")
    .optional()
    .default("pdf"),
});

const generateManifestSchema = Joi.object({
  partnerId: Joi.string().required(),
  awbNumbers: Joi.array().items(Joi.string().trim()).min(1).required(),
});

const checkServiceabilityParamsSchema = Joi.object({
  partnerId: Joi.string().required(),
  pincode: Joi.string()
    .required()
    .pattern(/^\d{6}$/),
});

const getCapabilitiesSchema = Joi.object({
  partnerId: Joi.string().required().messages({
    "string.empty": "Partner ID is required",
  }),
  shipmentContext: Joi.object({
    status: Joi.string().optional(),
    bookingStatus: Joi.string().optional(),
    awbNumber: Joi.string().optional().allow(null, ""),
    paymentType: Joi.string().optional(),
  }).optional(),
});

module.exports = {
  addressSchema,
  packageDetailsSchema,
  bookShipmentSchema,
  cancelShipmentSchema,
  trackShipmentParamsSchema,
  requestPickupSchema,
  getLabelParamsSchema,
  getLabelQuerySchema,
  generateManifestSchema,
  checkServiceabilityParamsSchema,
  getCapabilitiesSchema,
};
