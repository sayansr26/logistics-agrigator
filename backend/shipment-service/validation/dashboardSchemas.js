const Joi = require("joi");

/**
 * Query schema shared by every dashboard endpoint that windows on `days`.
 */
const daysQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30).messages({
    "number.base": "days must be a valid number",
    "number.integer": "days must be an integer",
    "number.min": "days must be at least 1",
    "number.max": "days cannot exceed 365",
  }),
});

/**
 * Query schema for endpoints that also accept a result-size `limit`.
 */
const daysLimitQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30).messages({
    "number.base": "days must be a valid number",
    "number.integer": "days must be an integer",
    "number.min": "days must be at least 1",
    "number.max": "days cannot exceed 365",
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "limit must be a valid number",
    "number.integer": "limit must be an integer",
    "number.min": "limit must be at least 1",
    "number.max": "limit cannot exceed 100",
  }),
});

module.exports = {
  daysQuerySchema,
  daysLimitQuerySchema,
};
