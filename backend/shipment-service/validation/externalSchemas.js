/**
 * External API validation.
 *
 * Two differences from the internal `validate` middleware
 * (`shared/lib/validation.js`), both of which matter here:
 *   1. It validates but DISCARDS Joi's coerced output, so defaults never reach
 *      `req`. The External API depends on defaults (e.g. `selection`), and the
 *      one-step booking flow must read post-coercion values — the quote token's
 *      claims are asserted against them later.
 *   2. Its error shape is the internal envelope.
 */

const Joi = require("joi");
const { sendExternalError } = require("../middleware/externalEnvelope");

const JOI_OPTIONS = {
  abortEarly: false,
  convert: true,
  stripUnknown: true,
  allowUnknown: false,
};

/**
 * Validate one or more request parts and WRITE BACK the coerced values.
 *
 * @param {Object} schemas - { body?, query?, params? } Joi schemas
 */
function validateExternal(schemas) {
  return (req, res, next) => {
    const details = [];

    for (const part of ["params", "query", "body"]) {
      const schema = schemas[part];
      if (!schema) continue;

      const { error, value } = schema.validate(req[part] || {}, JOI_OPTIONS);

      if (error) {
        details.push(
          ...error.details.map((d) => ({
            param: d.path.join("."),
            message: d.message.replace(/"/g, ""),
            in: part,
          })),
        );
        continue;
      }

      // Express 5 makes req.query a getter; assign defensively.
      try {
        req[part] = value;
      } catch {
        Object.defineProperty(req, part, { value, writable: true });
      }
    }

    if (details.length) {
      return sendExternalError(
        res,
        400,
        "invalid_request_error",
        "validation_failed",
        details[0].message,
        details,
      );
    }

    return next();
  };
}

// ---------------------------------------------------------------------------
// Building blocks (mirroring validation/shipmentSchemas.js)
// ---------------------------------------------------------------------------

const addressSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string()
    .pattern(/^\+91[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "phone must be in +91XXXXXXXXXX format",
    }),
  email: Joi.string().email().optional().allow(null, ""),
  addressLine1: Joi.string().min(5).max(255).required(),
  addressLine2: Joi.string().max(255).optional().allow(null, ""),
  landmark: Joi.string().max(100).optional().allow(null, ""),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(100).required(),
  pincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({ "string.pattern.base": "pincode must be 6 digits" }),
  country: Joi.string().max(100).default("India"),
});

const dimensionsSchema = Joi.object({
  length: Joi.number().positive().max(500).required(),
  width: Joi.number().positive().max(500).required(),
  height: Joi.number().positive().max(500).required(),
});

const packageSchema = Joi.object({
  weight: Joi.number().positive().max(1000).required(),
  dimensions: dimensionsSchema.required(),
  description: Joi.string().max(500).optional().allow(null, ""),
  value: Joi.number().min(0).optional(),
  fragile: Joi.boolean().default(false),
});

const vasSelectionSchema = Joi.object({
  chargeCode: Joi.string()
    .pattern(/^[A-Z0-9_]{2,60}$/)
    .required(),
  answer: Joi.any().required(),
});

// ---------------------------------------------------------------------------
// Endpoint schemas
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/external/shipments
 *
 * Two booking modes:
 *   two-step — pass `quoteToken` (+ `partnerId`, `quoteSnapshot`) from a prior
 *              /rates call
 *   one-step — omit the token; give a `partnerId` or a `selection` strategy and
 *              the server quotes, picks, signs and books in one request
 */
const createShipmentSchema = Joi.object({
  orderId: Joi.string().min(3).max(100).required(),
  shipmentType: Joi.string().valid("B2B", "B2C").default("B2C"),
  shipmentDirection: Joi.string()
    .valid("FORWARD", "REVERSE")
    .default("FORWARD"),

  pickupAddress: addressSchema.required(),
  deliveryAddress: addressSchema.required(),
  rtoSameAsPickup: Joi.boolean().default(true),
  rtoAddress: Joi.when("rtoSameAsPickup", {
    is: false,
    then: addressSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  billingSameAsDelivery: Joi.boolean().default(true),
  billingAddress: Joi.when("billingSameAsDelivery", {
    is: false,
    then: addressSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  pickupLocation: Joi.string().max(200).optional().allow(null, ""),

  productDescription: Joi.string().max(500).optional().allow(null, ""),
  hsnCode: Joi.string().max(20).optional().allow(null, ""),
  gstPercentage: Joi.number().min(0).max(100).optional(),

  packageDetails: packageSchema.required(),
  numberOfBoxes: Joi.number().integer().min(1).max(100).default(1),

  paymentType: Joi.string().valid("PREPAID", "COD").default("PREPAID"),
  codAmount: Joi.when("paymentType", {
    is: "COD",
    then: Joi.number().positive().max(100000).required(),
    otherwise: Joi.number().optional().allow(null),
  }),
  serviceType: Joi.string()
    .valid("STANDARD", "EXPRESS", "ECONOMY")
    .default("STANDARD"),
  specialInstructions: Joi.string().max(1000).optional().allow(null, ""),
  vasSelections: Joi.array().items(vasSelectionSchema).max(20).default([]),
  markup: Joi.object({
    type: Joi.string().valid("FLAT", "PERCENTAGE").required(),
    value: Joi.number().min(0).required(),
  }).optional(),

  // Partner selection
  partnerId: Joi.string().uuid().optional(),
  selection: Joi.string().valid("cheapest", "fastest").default("cheapest"),
  quoteToken: Joi.string().max(2048).optional(),
  quoteSnapshot: Joi.object().unknown(true).optional(),

  // Platform-level (superadmin) credentials must name the acting outlet.
  outletId: Joi.string().uuid().optional(),
  outletUserId: Joi.string().max(20).optional(),
}).custom((value, helpers) => {
  // A quote token is only meaningful alongside the partner and snapshot it
  // was signed for — createShipment rejects a partial set anyway.
  if (value.quoteToken && (!value.partnerId || !value.quoteSnapshot)) {
    return helpers.message(
      "quoteToken requires partnerId and quoteSnapshot (two-step booking)",
    );
  }
  return value;
});

/** POST /api/v1/external/shipments/rates */
const ratesSchema = Joi.object({
  fromPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),
  toPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),
  weight: Joi.number().positive().max(1000).required(),
  dimensions: dimensionsSchema.required(),
  numberOfBoxes: Joi.number().integer().min(1).max(100).default(1),
  serviceType: Joi.string()
    .valid("STANDARD", "EXPRESS", "ECONOMY")
    .default("STANDARD"),
  paymentType: Joi.string().valid("PREPAID", "COD").default("PREPAID"),
  codAmount: Joi.when("paymentType", {
    is: "COD",
    then: Joi.number().positive().max(100000).required(),
    otherwise: Joi.number().optional().allow(null),
  }),
  shipmentType: Joi.string().valid("B2B", "B2C").default("B2C"),
  declaredValue: Joi.number().min(0).default(0),
  isFragile: Joi.boolean().default(false),
  vasSelections: Joi.array().items(vasSelectionSchema).max(20).default([]),
  sortBy: Joi.string().valid("cheapest", "fastest").default("cheapest"),
  outletId: Joi.string().uuid().optional(),
});

/** GET /api/v1/external/shipments */
const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
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
      "NDR",
      "HOLD",
    )
    .optional(),
  paymentType: Joi.string().valid("PREPAID", "COD").optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
});

/** PATCH /api/v1/external/shipments/:id */
const updateShipmentSchema = Joi.object({
  pickupAddress: addressSchema.optional(),
  deliveryAddress: addressSchema.optional(),
  packageDetails: packageSchema.optional(),
  numberOfBoxes: Joi.number().integer().min(1).max(100).optional(),
  paymentType: Joi.string().valid("PREPAID", "COD").optional(),
  codAmount: Joi.number().positive().max(100000).optional().allow(null),
  serviceType: Joi.string().valid("STANDARD", "EXPRESS", "ECONOMY").optional(),
  productDescription: Joi.string().max(500).optional().allow(null, ""),
  specialInstructions: Joi.string().max(1000).optional().allow(null, ""),
}).min(1);

/** POST /api/v1/external/shipments/:id/cancel */
const cancelSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required(),
});

/** POST /api/v1/external/shipments/serviceability */
const serviceabilitySchema = Joi.object({
  fromPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),
  toPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required(),
  weight: Joi.number().positive().max(1000).optional(),
  paymentType: Joi.string().valid("PREPAID", "COD").default("PREPAID"),
});

const idParamSchema = Joi.object({
  id: Joi.string().required(),
});

const awbParamSchema = Joi.object({
  awbNumber: Joi.string().min(3).max(60).required(),
});

module.exports = {
  validateExternal,
  createShipmentSchema,
  ratesSchema,
  listQuerySchema,
  updateShipmentSchema,
  cancelSchema,
  serviceabilitySchema,
  idParamSchema,
  awbParamSchema,
};
