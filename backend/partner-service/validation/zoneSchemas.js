/**
 * Validation Schemas for Zone Management
 *
 * Joi validation schemas for all zone-related endpoints.
 * Supports both GEOLOGICAL (geographical-based) and DISTANCE (milestone-based) zones.
 * Following auth-service patterns with comprehensive validation rules.
 */

const Joi = require("joi");

// ========================================
// COMMON PATTERNS & REUSABLE SCHEMAS
// ========================================

// UUID validation pattern
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CUID validation pattern (for partner IDs)
const cuidPattern = /^c[a-z0-9]{24}$/i;

// Pincode validation pattern (6 digits)
const pincodePattern = /^\d{6}$/;

// Valid zone types
const validZoneTypes = ["DISTANCE", "GEOLOGICAL"];

// Reusable field schemas
const schemas = {
  uuid: Joi.string().pattern(uuidPattern).required().messages({
    "string.pattern.base": "Invalid UUID format",
    "any.required": "UUID is required",
  }),

  uuidOptional: Joi.string().pattern(uuidPattern).optional().messages({
    "string.pattern.base": "Invalid UUID format",
  }),

  // Partner ID can be CUID format
  partnerId: Joi.string().pattern(cuidPattern).messages({
    "string.pattern.base": "Invalid partner ID format (must be CUID)",
  }),

  partnerIdOptional: Joi.string().pattern(cuidPattern).optional().messages({
    "string.pattern.base": "Invalid partner ID format (must be CUID)",
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

  zoneType: Joi.string()
    .valid(...validZoneTypes)
    .messages({
      "any.only": `Zone type must be one of: ${validZoneTypes.join(", ")}`,
    }),

  // Milestone schema for DISTANCE zones
  milestone: Joi.object({
    minKm: Joi.number().integer().min(0).required().messages({
      "number.base": "minKm must be a number",
      "number.min": "minKm must be at least 0",
      "any.required": "minKm is required",
    }),
    maxKm: Joi.number().integer().min(Joi.ref("minKm")).required().messages({
      "number.base": "maxKm must be a number",
      "number.min": "maxKm must be greater than or equal to minKm",
      "any.required": "maxKm is required",
    }),
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
 * Also accepts 'q' as alias for 'code' (for frontend compatibility)
 */
const searchPincodes = {
  query: Joi.object({
    code: Joi.string().min(1).max(6).optional().messages({
      "string.min": "Code must be at least 1 character",
      "string.max": "Code cannot exceed 6 characters",
    }),
    q: Joi.string().min(1).max(6).optional().messages({
      "string.min": "Search query must be at least 1 character",
      "string.max": "Search query cannot exceed 6 characters",
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
    .or("code", "q", "city", "state", "district")
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
 * POST /api/v1/zones - Create Zone (Unified endpoint for both GEOLOGICAL and DISTANCE)
 *
 * For GEOLOGICAL zones (default):
 *   - Uses req.user.partnerId as the single partner
 *   - Can include geographical associations
 *
 * For DISTANCE zones:
 *   - Requires admin/operations role
 *   - Requires partnerIds[] array (multi-partner)
 *   - Requires milestones[] array
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

    // Zone type (GEOLOGICAL is default)
    zoneType: schemas.zoneType.default("GEOLOGICAL"),

    // For DISTANCE zones: partner IDs (required when zoneType=DISTANCE)
    partnerIds: Joi.array()
      .items(schemas.partnerId)
      .min(1)
      .max(100)
      .when("zoneType", {
        is: "DISTANCE",
        then: Joi.required().messages({
          "any.required": "partnerIds is required for DISTANCE zones",
        }),
        otherwise: Joi.forbidden().messages({
          "any.unknown": "partnerIds is only allowed for DISTANCE zones",
        }),
      }),

    // For DISTANCE zones: milestones (required when zoneType=DISTANCE)
    milestones: Joi.array()
      .items(schemas.milestone)
      .min(1)
      .max(26)
      .when("zoneType", {
        is: "DISTANCE",
        then: Joi.required().messages({
          "any.required": "milestones is required for DISTANCE zones",
          "array.min": "At least one milestone is required",
          "array.max": "Cannot have more than 26 milestones (A-Z)",
        }),
        otherwise: Joi.forbidden().messages({
          "any.unknown": "milestones is only allowed for DISTANCE zones",
        }),
      }),

    // For GEOLOGICAL zones: geographical associations (optional)
    geographical: Joi.object({
      stateIds: Joi.array().items(schemas.uuid).optional(),
      cityIds: Joi.array().items(schemas.uuid).optional(),
      areaIds: Joi.array().items(schemas.uuid).optional(),
      pincodes: Joi.array().items(schemas.pincode).optional(),
    }).when("zoneType", {
      is: "DISTANCE",
      then: Joi.forbidden().messages({
        "any.unknown": "geographical is not allowed for DISTANCE zones",
      }),
      otherwise: Joi.optional(),
    }),
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
    zoneType: schemas.zoneType.optional(),
    partnerId: Joi.string().optional(),
    search: Joi.string().min(1).max(100).optional().messages({
      "string.min": "Search term must be at least 1 character",
      "string.max": "Search term cannot exceed 100 characters",
    }),
    sortBy: Joi.string().valid("createdAt", "name", "updatedAt").optional(),
    sortOrder: Joi.string().valid("asc", "desc").optional(),
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

// NOTE: Zone services endpoints (getZoneServices, updateZoneServices) have been
// removed in Zone System v2. Use Pincode Types for service-based configuration.

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
// DISTANCE ZONE SCHEMAS
// ========================================

/**
 * GET /api/v1/zones/:id/milestones - Get Zone Milestones (DISTANCE zones only)
 */
const getMilestones = {
  params: Joi.object({
    id: schemas.uuid,
  }),
};

/**
 * PUT /api/v1/zones/:id/milestones - Update Zone Milestones (DISTANCE zones only)
 */
const updateMilestones = {
  params: Joi.object({
    id: schemas.uuid,
  }),
  body: Joi.object({
    milestones: Joi.array()
      .items(schemas.milestone)
      .min(1)
      .max(26)
      .required()
      .messages({
        "array.min": "At least one milestone is required",
        "array.max": "Cannot have more than 26 milestones (A-Z)",
        "any.required": "milestones array is required",
      }),
  }),
};

/**
 * POST /api/v1/zones/calculate-distance - Calculate distance between pincodes
 */
const calculateDistance = {
  body: Joi.object({
    fromPincode: schemas.pincode,
    toPincode: schemas.pincode,
  }),
};

/**
 * POST /api/v1/zones/match - Match zone by distance
 */
const matchZone = {
  body: Joi.object({
    fromPincode: schemas.pincode,
    toPincode: schemas.pincode,
    partnerId: schemas.partnerIdOptional,
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

  // Zone management endpoints (8) - services endpoints removed
  zones: {
    createZone,
    listZones,
    getZone,
    getZoneComplete,
    updateZone,
    deleteZone,
    getZoneGeography,
    updateZoneGeography,
  },

  // Distance zone endpoints (4)
  distance: {
    getMilestones,
    updateMilestones,
    calculateDistance,
    matchZone,
  },

  // Coverage validation endpoints (5)
  coverage: {
    checkServiceability,
    getZonesByPincode,
    findCoverageGaps,
    validateZoneCoverage,
  },
};
