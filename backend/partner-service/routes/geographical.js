/**
 * Geographical Routes
 *
 * Public API routes for hierarchical geographical data:
 * - States, Cities, Areas, Pincodes
 * - Search and lookup operations
 * - Batch operations for multiple entities
 *
 * Authentication: Not required (public geographical data)
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const geographicalController = require("../controllers/geographicalController");
const { validate } = require("../middleware/validate");
const { geographicalSearchLimiter } = require("../middleware/rateLimiter");
const zoneSchemas = require("../validation/zoneSchemas");

// Apply rate limiting to all geographical routes
router.use(geographicalSearchLimiter);

/**
 * GET /api/v1/geography/states
 * Get all active Indian states and UTs
 * Public endpoint - no authentication required
 */
router.get("/states", geographicalController.getStates);

/**
 * GET /api/v1/geography/states/search?name=text
 * Search states by name
 * Query params: name (optional), code (optional), page, limit
 */
router.get("/states/search", geographicalController.searchStates);

/**
 * GET /api/v1/geography/cities?stateId=uuid
 * Get cities by state ID with optional filtering
 * Query params: stateId (optional), stateIds (comma-separated), page, limit
 */
router.get("/cities", geographicalController.getCities);

/**
 * GET /api/v1/geography/areas?cityId=uuid&cityIds=uuid1,uuid2&stateIds=uuid1,uuid2
 * Get areas by city/state with optional filtering
 * Query params: cityId (optional), cityIds (comma-separated), stateIds (comma-separated), page, limit
 */
router.get("/areas", geographicalController.getAreas);

/**
 * GET /api/v1/geography/pincodes?areaId=uuid&cityId=uuid&stateId=uuid
 * Get pincodes by area/city/state
 * Query params: areaId, cityId, or stateId (at least one required)
 */
router.get(
  "/pincodes",
  validate(zoneSchemas.geographical.getPincodesByArea),
  geographicalController.getPincodesByArea,
);

/**
 * GET /api/v1/geography/pincodes/search?code=123&city=name&state=name
 * Search pincodes with multiple criteria
 * Query params: code, city, state, district (at least one required)
 */
router.get(
  "/pincodes/search",
  validate(zoneSchemas.geographical.searchPincodes),
  geographicalController.searchPincodes,
);

/**
 * GET /api/v1/geography/pincodes/:code
 * Get complete pincode details with hierarchy
 * Path params: code (6-digit pincode)
 */
router.get(
  "/pincodes/:code",
  validate(zoneSchemas.geographical.getPincodeDetails),
  geographicalController.getPincodeDetails,
);

/**
 * POST /api/v1/geography/cities/by-states
 * Batch get cities for multiple states
 * Body: { stateIds: [uuid1, uuid2, ...] }
 * Max 50 states per request
 */
router.post(
  "/cities/by-states",
  validate(zoneSchemas.geographical.getCitiesByStates),
  geographicalController.getCitiesByStates,
);

/**
 * POST /api/v1/geography/areas/by-cities
 * Batch get areas for multiple cities
 * Body: { cityIds: [uuid1, uuid2, ...] }
 * Max 100 cities per request
 */
router.post(
  "/areas/by-cities",
  validate(zoneSchemas.geographical.getAreasByCities),
  geographicalController.getAreasByCities,
);

/**
 * POST /api/v1/geography/pincodes/by-areas
 * Batch get pincodes for multiple areas
 * Body: { areaIds: [uuid1, uuid2, ...] }
 * Max 100 areas per request
 */
router.post(
  "/pincodes/by-areas",
  validate(zoneSchemas.geographical.getPincodesByAreas),
  geographicalController.getPincodesByAreas,
);

/**
 * PATCH /api/v1/geography/states/:id/toggle-status
 * Toggle state status (active/inactive)
 * Path params: id (UUID)
 */
router.patch(
  "/states/:id/toggle-status",
  geographicalController.toggleStateStatus,
);

/**
 * PATCH /api/v1/geography/cities/:id/toggle-status
 * Toggle city status (active/inactive)
 * Path params: id (UUID)
 */
router.patch(
  "/cities/:id/toggle-status",
  geographicalController.toggleCityStatus,
);

/**
 * PATCH /api/v1/geography/areas/:id/toggle-status
 * Toggle area status (active/inactive)
 * Path params: id (UUID)
 */
router.patch(
  "/areas/:id/toggle-status",
  geographicalController.toggleAreaStatus,
);

/**
 * PATCH /api/v1/geography/pincodes/:id/toggle-status
 * Toggle pincode status (active/inactive)
 * Path params: id (UUID)
 */
router.patch(
  "/pincodes/:id/toggle-status",
  geographicalController.togglePincodeStatus,
);

module.exports = router;
