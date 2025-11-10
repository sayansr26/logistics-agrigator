const Joi = require("joi");

/**
 * Validation schemas for distance calculation endpoints
 */

// Pincode distance calculation schema
const pincodeDistanceSchema = Joi.object({
  fromPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.pattern.base": "From pincode must be a 6-digit number",
      "string.empty": "From pincode is required",
      "any.required": "From pincode is required",
    }),
  toPincode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.pattern.base": "To pincode must be a 6-digit number",
      "string.empty": "To pincode is required",
      "any.required": "To pincode is required",
    }),
});

// City distance calculation schema
const cityDistanceSchema = Joi.object({
  fromCityId: Joi.string().uuid().required().messages({
    "string.guid": "From city ID must be a valid UUID",
    "string.empty": "From city ID is required",
    "any.required": "From city ID is required",
  }),
  toCityId: Joi.string().uuid().required().messages({
    "string.guid": "To city ID must be a valid UUID",
    "string.empty": "To city ID is required",
    "any.required": "To city ID is required",
  }),
});

// State distance calculation schema
const stateDistanceSchema = Joi.object({
  fromStateId: Joi.string().uuid().required().messages({
    "string.guid": "From state ID must be a valid UUID",
    "string.empty": "From state ID is required",
    "any.required": "From state ID is required",
  }),
  toStateId: Joi.string().uuid().required().messages({
    "string.guid": "To state ID must be a valid UUID",
    "string.empty": "To state ID is required",
    "any.required": "To state ID is required",
  }),
});

// Area distance calculation schema
const areaDistanceSchema = Joi.object({
  fromAreaId: Joi.string().uuid().required().messages({
    "string.guid": "From area ID must be a valid UUID",
    "string.empty": "From area ID is required",
    "any.required": "From area ID is required",
  }),
  toAreaId: Joi.string().uuid().required().messages({
    "string.guid": "To area ID must be a valid UUID",
    "string.empty": "To area ID is required",
    "any.required": "To area ID is required",
  }),
});

// Coordinate distance calculation schema
const coordinateDistanceSchema = Joi.object({
  from: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      "number.base": "Latitude must be a number",
      "number.min": "Latitude must be between -90 and 90",
      "number.max": "Latitude must be between -90 and 90",
      "any.required": "From latitude is required",
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      "number.base": "Longitude must be a number",
      "number.min": "Longitude must be between -180 and 180",
      "number.max": "Longitude must be between -180 and 180",
      "any.required": "From longitude is required",
    }),
  }).required(),
  to: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      "number.base": "Latitude must be a number",
      "number.min": "Latitude must be between -90 and 90",
      "number.max": "Latitude must be between -90 and 90",
      "any.required": "To latitude is required",
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      "number.base": "Longitude must be a number",
      "number.min": "Longitude must be between -180 and 180",
      "number.max": "Longitude must be between -180 and 180",
      "any.required": "To longitude is required",
    }),
  }).required(),
});

// Batch calculation schema
const batchDistanceSchema = Joi.object({
  calculations: Joi.array()
    .items(
      Joi.alternatives().try(
        // Pincode calculation
        Joi.object({
          type: Joi.string().valid("pincode").required(),
          from: Joi.string()
            .pattern(/^[0-9]{6}$/)
            .required(),
          to: Joi.string()
            .pattern(/^[0-9]{6}$/)
            .required(),
        }),
        // City calculation
        Joi.object({
          type: Joi.string().valid("city").required(),
          from: Joi.string().uuid().required(),
          to: Joi.string().uuid().required(),
        }),
        // State calculation
        Joi.object({
          type: Joi.string().valid("state").required(),
          from: Joi.string().uuid().required(),
          to: Joi.string().uuid().required(),
        }),
        // Area calculation
        Joi.object({
          type: Joi.string().valid("area").required(),
          from: Joi.string().uuid().required(),
          to: Joi.string().uuid().required(),
        }),
        // Coordinate calculation
        Joi.object({
          type: Joi.string().valid("coordinates").required(),
          from: Joi.object({
            latitude: Joi.number().min(-90).max(90).required(),
            longitude: Joi.number().min(-180).max(180).required(),
          }).required(),
          to: Joi.object({
            latitude: Joi.number().min(-90).max(90).required(),
            longitude: Joi.number().min(-180).max(180).required(),
          }).required(),
        }),
      ),
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one calculation is required",
      "array.max": "Maximum 100 calculations allowed per batch",
      "any.required": "Calculations array is required",
    }),
});

// Clear cache schema
const clearCacheSchema = Joi.object({
  pattern: Joi.string().default("distance:*").messages({
    "string.base": "Pattern must be a string",
  }),
});

module.exports = {
  pincodeDistanceSchema,
  cityDistanceSchema,
  stateDistanceSchema,
  areaDistanceSchema,
  coordinateDistanceSchema,
  batchDistanceSchema,
  clearCacheSchema,
};
