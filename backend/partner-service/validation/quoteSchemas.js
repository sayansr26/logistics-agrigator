/**
 * Joi schemas — Charges Engine v3 quote endpoints
 */

const Joi = require("joi");

const vasSelectionSchema = Joi.object({
  chargeCode: Joi.string()
    .pattern(/^[A-Z0-9_]{2,60}$/)
    .required(),
  answer: Joi.alternatives()
    .try(
      Joi.string().max(200),
      Joi.number(),
      Joi.boolean(),
      Joi.object().unknown(true).max(10),
    )
    .required(),
});

const quoteSchemas = {
  calculateRatesV3: Joi.object({
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
    paymentType: Joi.string().valid("PREPAID", "COD", "prepaid", "cod"),
    dimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
    }),
    numberOfBoxes: Joi.number().integer().min(1).default(1),
    isFragile: Joi.boolean().default(false),
    outletId: Joi.string().allow("", null),
    skipServiceabilityCheck: Joi.boolean().default(false),
    sortBy: Joi.string().valid("cheapest", "highest"),
    shipmentType: Joi.string().valid("B2B", "B2C").default("B2C"),
    shipmentDirection: Joi.string()
      .valid("FORWARD", "REVERSE")
      .default("FORWARD"),
    vasSelections: Joi.array().items(vasSelectionSchema).max(20).default([]),
    // Outlet markup priced inside the taxable subtotal. Caps are enforced by
    // the caller (shipment-service) against the outlet's admin-set limits.
    markup: Joi.object({
      type: Joi.string().valid("FLAT", "PERCENTAGE").required(),
      value: Joi.number().min(0).required(),
    })
      .allow(null)
      .default(null),
  }),

  eventChargeQuote: Joi.object({
    partnerId: Joi.string().required(),
    chargeCode: Joi.string()
      .pattern(/^[A-Z0-9_]{2,60}$/)
      .required(),
    eventParams: Joi.object({
      units: Joi.number().min(0),
      days: Joi.number().min(0),
      attempts: Joi.number().min(0),
    }).default({}),
    shipmentContext: Joi.object({
      chargeableWeight: Joi.number().min(0),
      codAmount: Joi.number().min(0),
      invoiceValue: Joi.number().min(0),
      paymentType: Joi.string().valid("PREPAID", "COD"),
      shipmentType: Joi.string().valid("B2B", "B2C"),
    }).default({}),
  }),
};

module.exports = { quoteSchemas, vasSelectionSchema };
