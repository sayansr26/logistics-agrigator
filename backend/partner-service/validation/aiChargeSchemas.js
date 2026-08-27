/**
 * Joi schemas — AI brain endpoints (Charges Engine v3)
 */

const Joi = require("joi");

const uuid = Joi.string().uuid();

const aiCharges = {
  draftFromText: {
    body: Joi.object({
      description: Joi.string().min(10).max(4000).required(),
      // Partner ids are CUIDs, not uuids — hence the loose string.
      partnerId: Joi.string().max(40).allow(null),
      // PartnerServiceChannel id (the weight-slab shipping product), NOT a
      // PartnerChannelConfig credential id. Null/absent means partner-wide.
      channelId: uuid.allow(null),
    }),
  },

  importLegacy: {
    body: Joi.object({
      legacyExport: Joi.object().unknown(true).required(),
    }),
  },

  listSuggestions: {
    query: Joi.object({
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100),
      kind: Joi.string().valid(
        "CONFIG_FROM_NL",
        "LEGACY_IMPORT",
        "ANOMALY",
        "CONFIG_TUNE",
      ),
      status: Joi.string().valid("PENDING", "APPROVED", "REJECTED", "APPLIED"),
    }),
  },

  suggestionAction: {
    params: Joi.object({ id: uuid.required() }),
  },

  explainQuote: {
    body: Joi.object({
      breakdown: Joi.array()
        .items(Joi.object().unknown(true))
        .max(50)
        .required(),
      pricing: Joi.object().unknown(true).allow(null),
      context: Joi.object().unknown(true).allow(null),
    }),
  },

  codRisk: {
    body: Joi.object({
      codAmount: Joi.number().min(0).required(),
      invoiceValue: Joi.number().min(0),
      toPincode: Joi.string().pattern(/^\d{6}$/),
      deliveryCity: Joi.string().max(100),
      deliveryState: Joi.string().max(100),
      weight: Joi.number().min(0),
      addressLine: Joi.string().max(500),
      phoneValid: Joi.boolean(),
      shipmentType: Joi.string().valid("B2B", "B2C"),
    }).unknown(true),
  },

  anomalyScan: {
    body: Joi.object({
      partnerId: Joi.string().max(40).allow(null),
    }),
  },
};

module.exports = { aiCharges };
