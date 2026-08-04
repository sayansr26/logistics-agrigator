/**
 * Joi schemas — Partner Charge Config CRUD (Charges Engine v3)
 */

const Joi = require("joi");

const uuid = Joi.string().uuid();

const conditionsSchema = Joi.object({
  all: Joi.array().items(Joi.object().unknown(true)),
  any: Joi.array().items(Joi.object().unknown(true)),
})
  .or("all", "any")
  .unknown(false);

const partnerChargeConfigs = {
  createConfig: {
    body: Joi.object({
      partnerId: Joi.string().max(40).required(),
      channelId: uuid.allow(null),
      chargeDefinitionId: uuid.required(),
      config: Joi.object().unknown(true).required(),
      conditions: conditionsSchema.allow(null),
      priority: Joi.number().integer().min(1).max(1000),
      isActive: Joi.boolean(),
      effectiveFrom: Joi.date().iso().allow(null),
      effectiveTo: Joi.date().iso().min(Joi.ref("effectiveFrom")).allow(null),
    }),
  },

  listConfigs: {
    query: Joi.object({
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(200),
      partnerId: Joi.string().max(40),
      chargeDefinitionId: uuid,
      channelId: uuid,
      isActive: Joi.boolean(),
    }),
  },

  getConfig: {
    params: Joi.object({ id: uuid.required() }),
  },

  updateConfig: {
    params: Joi.object({ id: uuid.required() }),
    body: Joi.object({
      channelId: uuid.allow(null),
      config: Joi.object().unknown(true),
      conditions: conditionsSchema.allow(null),
      priority: Joi.number().integer().min(1).max(1000),
      isActive: Joi.boolean(),
      effectiveFrom: Joi.date().iso().allow(null),
      effectiveTo: Joi.date().iso().allow(null),
    }).min(1),
  },

  deleteConfig: {
    params: Joi.object({ id: uuid.required() }),
  },
};

module.exports = { partnerChargeConfigs };
