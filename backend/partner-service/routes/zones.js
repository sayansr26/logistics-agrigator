/**
 * Zone Management Routes
 *
 * Authenticated API routes for partner-specific zone management:
 * - Create, read, update, delete zones
 * - Manage geographical associations (states, cities, areas, pincodes)
 * - Configure service types (PICKUP, DELIVERY, COD, PREPAID, ODA, HILL)
 *
 * Authentication: Required (JWT with partnerId)
 * Authorization: Partner-scoped (users can only access their own zones)
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const zoneController = require("../controllers/zoneController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { zoneManagementLimiter } = require("../middleware/rateLimiter");
const zoneSchemas = require("../validation/zoneSchemas");

// Apply authentication and rate limiting to all zone routes
router.use(authMiddleware.authenticate);
router.use(zoneManagementLimiter);

/**
 * POST /api/v1/zones
 * Create a new zone with geographical associations and service configurations
 * Body: { name, description, geographical: {...}, services: [...] }
 * Auth: Required (partnerId from req.user)
 */
router.post(
  "/",
  validate(zoneSchemas.zones.createZone),
  zoneController.createZone,
);

/**
 * GET /api/v1/zones
 * List zones with pagination and filters
 * Query params: page, limit, status, search
 * Auth: Required
 */
router.get(
  "/",
  validate(zoneSchemas.zones.listZones),
  zoneController.listZones,
);

/**
 * GET /api/v1/zones/:id
 * Get basic zone details
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.get("/:id", validate(zoneSchemas.zones.getZone), zoneController.getZone);

/**
 * GET /api/v1/zones/:id/complete
 * Get zone with all geographical associations and services
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.get(
  "/:id/complete",
  validate(zoneSchemas.zones.getZoneComplete),
  zoneController.getZoneComplete,
);

/**
 * PUT /api/v1/zones/:id
 * Update zone basic details (name, description, status)
 * Path params: id (zone UUID)
 * Body: { name?, description?, status? }
 * Auth: Required
 */
router.put(
  "/:id",
  validate(zoneSchemas.zones.updateZone),
  zoneController.updateZone,
);

/**
 * DELETE /api/v1/zones/:id
 * Soft delete zone (sets status to false)
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.delete(
  "/:id",
  validate(zoneSchemas.zones.deleteZone),
  zoneController.deleteZone,
);

/**
 * GET /api/v1/zones/:id/services
 * Get zone service type configurations
 * Returns: Array of service types with availability and charges
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.get(
  "/:id/services",
  validate(zoneSchemas.zones.getZoneServices),
  zoneController.getZoneServices,
);

/**
 * PUT /api/v1/zones/:id/services
 * Update zone service type configurations
 * Body: { services: [{ serviceType, isAvailable, additionalCharges, remarks }] }
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.put(
  "/:id/services",
  validate(zoneSchemas.zones.updateZoneServices),
  zoneController.updateZoneServices,
);

/**
 * GET /api/v1/zones/:id/geography
 * Get zone geographical associations
 * Returns: { stateIds, cityIds, areaIds, pincodes }
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.get(
  "/:id/geography",
  validate(zoneSchemas.zones.getZoneGeography),
  zoneController.getZoneGeography,
);

/**
 * PUT /api/v1/zones/:id/geography
 * Update zone geographical associations
 * Body: { geographical: { stateIds?, cityIds?, areaIds?, pincodes? } }
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.put(
  "/:id/geography",
  validate(zoneSchemas.zones.updateZoneGeography),
  zoneController.updateZoneGeography,
);

module.exports = router;
