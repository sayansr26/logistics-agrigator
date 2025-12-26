/**
 * Zone Management Routes
 *
 * Authenticated API routes for zone management supporting both:
 * - GEOLOGICAL zones: Partner-scoped geographical associations (states, cities, areas, pincodes)
 * - DISTANCE zones: Admin/ops managed distance-based milestones (multi-partner)
 *
 * Authentication: Required (JWT with partnerId for GEOLOGICAL, or admin/ops role for DISTANCE)
 * Authorization: Partner-scoped for GEOLOGICAL, role-based for DISTANCE
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

// ==========================================
// DISTANCE-SPECIFIC ROUTES (must be before parameterized routes)
// ==========================================

/**
 * POST /api/v1/zones/calculate-distance
 * Calculate distance between two pincodes
 * Body: { fromPincode, toPincode }
 * Auth: Required
 */
router.post(
  "/calculate-distance",
  validate(zoneSchemas.distance.calculateDistance),
  zoneController.calculateDistance,
);

/**
 * POST /api/v1/zones/match
 * Match zone by distance for a shipment
 * Body: { fromPincode, toPincode, partnerId? }
 * Auth: Required (partnerId optional if req.user.partnerId exists)
 */
router.post(
  "/match",
  validate(zoneSchemas.distance.matchZone),
  zoneController.matchZone,
);

// ==========================================
// ZONE CRUD ROUTES
// ==========================================

/**
 * POST /api/v1/zones
 * Create a new zone (unified endpoint for both GEOLOGICAL and DISTANCE)
 * Body: { name, description, zoneType?, geographical?, partnerIds?, milestones? }
 * Auth: Required (GEOLOGICAL uses req.user.partnerId, DISTANCE requires admin/ops role)
 */
router.post(
  "/",
  validate(zoneSchemas.zones.createZone),
  zoneController.createZone,
);

/**
 * GET /api/v1/zones
 * List zones with pagination and filters
 * Query params: page, limit, status, search, zoneType
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

// NOTE: Zone services routes (GET/PUT /:id/services) have been removed in Zone System v2.
// Use Pincode Types for service-based configuration instead.

// ==========================================
// MILESTONE ROUTES (DISTANCE zones only)
// ==========================================

/**
 * GET /api/v1/zones/:id/milestones
 * Get zone milestones (DISTANCE zones only)
 * Returns: Array of milestones with minKm, maxKm, suffix, sortOrder
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.get(
  "/:id/milestones",
  validate(zoneSchemas.distance.getMilestones),
  zoneController.getMilestones,
);

/**
 * PUT /api/v1/zones/:id/milestones
 * Update zone milestones (replaces all existing milestones)
 * Body: { milestones: [{ minKm, maxKm }] }
 * Path params: id (zone UUID)
 * Auth: Required
 */
router.put(
  "/:id/milestones",
  validate(zoneSchemas.distance.updateMilestones),
  zoneController.updateMilestones,
);

// ==========================================
// GEOGRAPHY ROUTES (GEOLOGICAL zones)
// ==========================================

/**
 * GET /api/v1/zones/:id/geography
 * Get zone geographical associations (GEOLOGICAL zones)
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
 * Update zone geographical associations (GEOLOGICAL zones)
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
