/**
 * Validation Schemas for Geological Zone Management
 *
 * Joi validation schemas for all zone-related endpoints.
 * Following auth-service patterns with comprehensive validation rules.
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

// UUID validation pattern
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pincode validation pattern (6 digits)
const pincodePattern = /^\d{6}$/;

// Reusable field schemas
const schemas = {
  uuid: Joi.string().pattern(uuidPattern).required().messages({
    "string.pattern.base": "Invalid UUID format",
    "any.required": "UUID is required",
  }),

  uuidOptional: Joi.string().pattern(uuidPattern).optional().messages({
    "string.pattern.base": "Invalid UUID format",
  }),

  pincode: Joi.string().pattern(pincodePattern).required().messages({
    "string.pattern.base": "Pincode must be 6 digits",
    "any.required": "Pincode is required",
  }),

  pincodeOptional: Joi.string().pattern(pincodePattern).optional().messages({
    "string.pattern.base": "Pincode must be 6 digits",
  }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
  }),

  status: Joi.boolean().optional().messages({
    "boolean.base": "Status must be a boolean",
  }),
};

// ========================================
// GEOGRAPHICAL ENDPOINT SCHEMAS
// ========================================

/**
 * GET /api/v1/geography/cities?stateId=uuid
 */
const getCitiesByState = {
  query: Joi.object({
    stateId: schemas.uuid,
  }),
};

/**
 * GET /api/v1/geography/areas?cityId=uuid
 */
const getAreasByCity = {
  query: Joi.object({
    cityId: schemas.uuid,
  }),
};

/**
 * GET /api/v1/geography/pincodes?areaId=uuid&cityId=uuid&stateId=uuid&limit=100
 */
const getPincodesByArea = {
  query: Joi.object({
    areaId: schemas.uuidOptional,
    cityId: schemas.uuidOptional,
    stateId: schemas.uuidOptional,
    page: Joi.number().integer().min(1).optional().messages({
      "number.base": "Page must be a number",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(1000).optional().messages({
      "number.base": "Limit must be a number",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 1000",
    }),
  }),
  // Removed .or() requirement - allow fetching all pincodes with optional filters
};

/**
 * GET /api/v1/geography/pincodes/search?code=123&city=name&state=name&district=name
 */
const searchPincodes = {
  query: Joi.object({
    code: Joi.string().min(1).max(6).optional().messages({
      "string.min": "Code must be at least 1 character",
      "string.max": "Code cannot exceed 6 characters",
    }),
    city: Joi.string().min(2).max(100).optional().messages({
      "string.min": "City must be at least 2 characters",
      "string.max": "City cannot exceed 100 characters",
    }),
    state: Joi.string().min(2).max(100).optional().messages({
      "string.min": "State must be at least 2 characters",
      "string.max": "State cannot exceed 100 characters",
    }),
    district: Joi.string().min(2).max(100).optional().messages({
      "string.min": "District must be at least 2 characters",
      "string.max": "District cannot exceed 100 characters",
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
  })
    .or("code", "city", "state", "district")
    .messages({
      "object.missing": "At least one search parameter is required",
    }),
};

/**
 * GET /api/v1/geography/pincodes/:code
 */
const getPincodeDetails = {
  params: Joi.object({
    code: schemas.pincode,
  }),
};

/**
 * POST /api/v1/geography/cities/by-states
 */
const getCitiesByStates = {
  body: Joi.object({
    stateIds: Joi.array()
      .items(schemas.uuid)
      .min(1)
      .max(50)
      .required()
      .messages({
        "array.min": "At least one state ID is required",
        "array.max": "Cannot request more than 50 states at once",
        "any.required": "stateIds array is required",
      }),
  }),
};

/**
 * POST /api/v1/geography/areas/by-cities
 */
const getAreasByCities = {
  body: Joi.object({
    cityIds: Joi.array()
      .items(schemas.uuid)
      .min(1)
      .max(100)
      .required()
      .messages({
        "array.min": "At least one city ID is required",
        "array.max": "Cannot request more than 100 cities at once",
        "any.required": "cityIds array is required",
      }),
  }),
};

/**
 * POST /api/v1/geography/pincodes/by-areas
 */
const getPincodesByAreas = {
  body: Joi.object({
    areaIds: Joi.array()
      .items(schemas.uuid)
      .min(1)
      .max(100)
      .required()
      .messages({
        "array.min": "At least one area ID is required",
        "array.max": "Cannot request more than 100 areas at once",
        "any.required": "areaIds array is required",
      }),
  }),
};

// ========================================
// ZONE MANAGEMENT SCHEMAS
// ========================================

/**
 * POST /api/v1/zones - Create Zone
 */
const createZone = {
  body: Joi.object({
    name: Joi.string().min(3).max(255).required().messages({
      "string.min": "Zone name must be at least 3 characters",
      "string.max": "Zone name cannot exceed 255 characters",
      "any.required": "Zone name is required",
    }),
    description: Joi.string().max(1000).optional().allow("", null).messages({
      "string.max": "Description cannot exceed 1000 characters",
    }),
    status: schemas.status.default(true),

    // Geographical associations (optional during creation)
    geographical: Joi.object({
      stateIds: Joi.array().items(schemas.uuid).optional(),
      cityIds: Joi.array().items(schemas.uuid).optional(),
      areaIds: Joi.array().items(schemas.uuid).optional(),
      pincodes: Joi.array().items(schemas.pincode).optional(),
    }).optional(),

    // Service type configurations (optional during creation)
    services: Joi.array()
      .items(
        Joi.object({
          serviceType: Joi.string()
            .valid("PICKUP", "DELIVERY", "COD", "PREPAID", "ODA", "HILL")
            .required()
            .messages({
              "any.only":
                "Service type must be one of: PICKUP, DELIVERY, COD, PREPAID, ODA, HILL",
              "any.required": "Service type is required",
            }),
          isAvailable: Joi.boolean().default(true),
          additionalCharges: Joi.number()
            .min(0)
            .max(999999.99)
            .optional()
            .messages({
              "number.min": "Additional charges cannot be negative",
              "number.max": "Additional charges cannot exceed 999,999.99",
            }),
          remarks: Joi.string().max(500).optional().allow("", null).messages({
            "string.max": "Remarks cannot exceed 500 characters",
          }),
        }),
      )
      .optional(),
  }),
};

/**
 * GET /api/v1/zones - List Zones
 */
const listZones = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.boolean().optional(),
    search: Joi.string().min(1).max(100).optional().messages({
      "string.min": "Search term must be at least 1 character",
      "string.max": "Search term cannot exceed 100 characters",
    }),
  }),
};

/**
 * GET /api/v1/zones/:id - Get Zone
 */
const getZone = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * GET /api/v1/zones/:id/complete - Get Zone Complete
 */
const getZoneComplete = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/zones/:id - Update Zone
 */
const updateZone = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    name: Joi.string().min(3).max(255).optional().messages({
      "string.min": "Zone name must be at least 3 characters",
      "string.max": "Zone name cannot exceed 255 characters",
    }),
    description: Joi.string().max(1000).optional().allow("", null).messages({
      "string.max": "Description cannot exceed 1000 characters",
    }),
    status: schemas.status,
  })
    .min(1)
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};

/**
 * DELETE /api/v1/zones/:id - Delete Zone
 */
const deleteZone = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * GET /api/v1/zones/:id/services - Get Zone Services
 */
const getZoneServices = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/zones/:id/services - Update Zone Services
 */
const updateZoneServices = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    services: Joi.array()
      .items(
        Joi.object({
          serviceType: Joi.string()
            .valid("PICKUP", "DELIVERY", "COD", "PREPAID", "ODA", "HILL")
            .required()
            .messages({
              "any.only":
                "Service type must be one of: PICKUP, DELIVERY, COD, PREPAID, ODA, HILL",
              "any.required": "Service type is required",
            }),
          isAvailable: Joi.boolean().required().messages({
            "any.required": "isAvailable is required",
          }),
          additionalCharges: Joi.number()
            .min(0)
            .max(999999.99)
            .optional()
            .allow(null)
            .messages({
              "number.min": "Additional charges cannot be negative",
              "number.max": "Additional charges cannot exceed 999,999.99",
            }),
          remarks: Joi.string().max(500).optional().allow("", null).messages({
            "string.max": "Remarks cannot exceed 500 characters",
          }),
        }),
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one service configuration is required",
        "any.required": "Services array is required",
      }),
  }),
};

/**
 * GET /api/v1/zones/:id/geography - Get Zone Geography
 */
const getZoneGeography = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/zones/:id/geography - Update Zone Geography
 */
const updateZoneGeography = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    geographical: Joi.object({
      stateIds: Joi.array().items(schemas.uuid).optional().allow(null),
      cityIds: Joi.array().items(schemas.uuid).optional().allow(null),
      areaIds: Joi.array().items(schemas.uuid).optional().allow(null),
      pincodes: Joi.array().items(schemas.pincode).optional().allow(null),
    })
      .min(1)
      .required()
      .messages({
        "object.min": "At least one geographical field must be provided",
        "any.required": "Geographical object is required",
      }),
  }),
};

// ========================================
// ZONE COVERAGE VALIDATION SCHEMAS
// ========================================

/**
 * POST /api/v1/zones/coverage/check - Check Serviceability
 */
const checkServiceability = {
  body: Joi.object({
    pincode: schemas.pincode,
  }),
};

/**
 * GET /api/v1/zones/coverage/pincode/:code - Get Zones by Pincode
 */
const getZonesByPincode = {
  params: Joi.object({
    code: schemas.pincode,
  }),
};

/**
 * GET /api/v1/zones/coverage/gaps - Find Coverage Gaps
 */
const findCoverageGaps = {
  query: Joi.object({
    stateId: schemas.uuidOptional,
    limit: Joi.number().integer().min(1).max(1000).default(100).messages({
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 1000",
    }),
  }),
};

/**
 * GET /api/v1/zones/:id/coverage/validate - Validate Zone Coverage
 */
const validateZoneCoverage = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
  // Common schemas
  schemas,

  // Geographical endpoints (9)
  geographical: {
    getCitiesByState,
    getAreasByCity,
    getPincodesByArea,
    searchPincodes,
    getPincodeDetails,
    getCitiesByStates,
    getAreasByCities,
    getPincodesByAreas,
  },

  // Zone management endpoints (10)
  zones: {
    createZone,
    listZones,
    getZone,
    getZoneComplete,
    updateZone,
    deleteZone,
    getZoneServices,
    updateZoneServices,
    getZoneGeography,
    updateZoneGeography,
  },

  // Coverage validation endpoints (5)
  coverage: {
    checkServiceability,
    getZonesByPincode,
    findCoverageGaps,
    validateZoneCoverage,
  },
};
