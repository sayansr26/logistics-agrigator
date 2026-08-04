/**
 * Joi schemas — Charge Definition CRUD (Charges Engine v3)
 */

const Joi = require("joi");

const uuid = Joi.string().uuid();

const METHOD_VALUES = [
  "FLAT",
  "PERCENT_WITH_MIN",
  "PER_UNIT",
  "SLAB",
  "MATRIX",
  "PER_UNIT_TIME",
  "RATE_ADJUSTMENT",
  "OPTION_RATE",
  "DISCOUNT",
];

const CATEGORY_VALUES = [
  "BASE",
  "COD",
  "VAS",
  "PICKUP_DELIVERY",
  "SURCHARGE",
  "RISK",
  "TAX",
  "NOTIFICATION",
  "EVENT",
  "DISCOUNT",
];

const computationSchema = Joi.object({
  method: Joi.string()
    .valid(...METHOD_VALUES)
    .required(),
  basis: Joi.string().max(40),
  subtotalOf: Joi.string().max(40),
  answerPath: Joi.string().max(100),
  optionsBy: Joi.string().max(60),
  paramsSchema: Joi.object().unknown(true),
}).unknown(false);

const bookingQuestionSchema = Joi.object({
  key: Joi.string().max(60).required(),
  label: Joi.string().max(200).required(),
  description: Joi.string().max(500),
  type: Joi.string()
    .valid("boolean", "select", "datetime", "number")
    .required(),
  options: Joi.array().items(
    Joi.object({
      value: Joi.alternatives()
        .try(Joi.string().max(60), Joi.number())
        .required(),
      label: Joi.string().max(200).required(),
      priceHint: Joi.string().max(100),
    }),
  ),
  default: Joi.alternatives().try(
    Joi.string().max(60),
    Joi.number(),
    Joi.boolean(),
  ),
  followUp: Joi.array().items(
    Joi.object({
      when: Joi.alternatives()
        .try(Joi.string().max(60), Joi.number(), Joi.boolean())
        .required(),
      key: Joi.string().max(60).required(),
      label: Joi.string().max(200).required(),
      type: Joi.string()
        .valid("boolean", "select", "datetime", "number")
        .required(),
      options: Joi.array().items(
        Joi.object({
          value: Joi.alternatives()
            .try(Joi.string().max(60), Joi.number())
            .required(),
          label: Joi.string().max(200).required(),
        }),
      ),
    }),
  ),
}).unknown(false);

const conditionsSchema = Joi.object({
  all: Joi.array().items(Joi.object().unknown(true)),
  any: Joi.array().items(Joi.object().unknown(true)),
})
  .or("all", "any")
  .unknown(false);

const aggregationSchema = Joi.object({
  group: Joi.string().max(40).required(),
  strategy: Joi.string().valid("HIGHEST", "SUM").required(),
  perSide: Joi.boolean(),
}).unknown(false);

const flagsSchema = Joi.object({
  fuelApplicable: Joi.boolean(),
  taxable: Joi.boolean(),
  addToCodCollectable: Joi.boolean(),
  aiAssisted: Joi.boolean(),
}).unknown(false);

const baseFields = {
  name: Joi.string().max(150),
  description: Joi.string().max(2000).allow(null, ""),
  category: Joi.string().valid(...CATEGORY_VALUES),
  applyStage: Joi.string().valid("QUOTE", "BOOKING_OPTION", "EVENT"),
  phase: Joi.number().integer().min(1).max(999),
  computation: computationSchema,
  bookingQuestion: bookingQuestionSchema.allow(null),
  conditions: conditionsSchema.allow(null),
  aggregation: aggregationSchema.allow(null),
  flags: flagsSchema.allow(null),
  isActive: Joi.boolean(),
};

const chargeDefinitions = {
  createDefinition: {
    body: Joi.object({
      code: Joi.string()
        .pattern(/^[A-Z0-9_]{2,60}$/)
        .required(),
      ...baseFields,
      name: baseFields.name.required(),
      category: baseFields.category.required(),
      applyStage: baseFields.applyStage.required(),
      computation: computationSchema.required(),
    }),
  },

  listDefinitions: {
    query: Joi.object({
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(200),
      category: Joi.string().valid(...CATEGORY_VALUES),
      applyStage: Joi.string().valid("QUOTE", "BOOKING_OPTION", "EVENT"),
      isActive: Joi.boolean(),
      search: Joi.string().max(100),
    }),
  },

  getDefinition: {
    params: Joi.object({ id: uuid.required() }),
  },

  updateDefinition: {
    params: Joi.object({ id: uuid.required() }),
    body: Joi.object({
      code: Joi.string().pattern(/^[A-Z0-9_]{2,60}$/),
      ...baseFields,
    }).min(1),
  },

  deleteDefinition: {
    params: Joi.object({ id: uuid.required() }),
  },

  getVersions: {
    params: Joi.object({ id: uuid.required() }),
  },

  bookingQuestions: {
    query: Joi.object({
      partnerId: Joi.string().max(40),
    }),
  },
};

module.exports = { chargeDefinitions };
