/**
 * Zone Coverage Validation Routes
 *
 * Authenticated API routes for zone coverage validation and serviceability:
 * - Check pincode serviceability
 * - Find zones by pincode
 * - Detect overlapping zones
 * - Find coverage gaps
 * - Validate zone configuration
 *
 * Authentication: Required (JWT with partnerId)
 * Authorization: Partner-scoped (users can only check their own zones)
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const zoneCoverageController = require("../controllers/zoneCoverageController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const { zoneManagementLimiter } = require("../middleware/rateLimiter");
const zoneSchemas = require("../validation/zoneSchemas");

// Apply authentication and rate limiting to all coverage routes
router.use(authMiddleware.authenticate);
router.use(zoneManagementLimiter);

/**
 * POST /api/v1/zones/coverage/check
 * Check if a pincode is serviceable by the partner
 * Body: { pincode: "110001" }
 * Returns: { isServiceable, zones, availableServices }
 * Auth: Required (partnerId from req.user)
 */
router.post(
  "/check",
  validate(zoneSchemas.coverage.checkServiceability),
  zoneCoverageController.checkServiceability,
);

/**
 * GET /api/v1/zones/coverage/pincode/:code
 * Get all zones covering a specific pincode
 * Path params: code (6-digit pincode)
 * Returns: Array of zones with service types
 * Auth: Required
 */
router.get(
  "/pincode/:code",
  validate(zoneSchemas.coverage.getZonesByPincode),
  zoneCoverageController.getZonesByPincode,
);

/**
 * GET /api/v1/zones/coverage/overlaps
 * Detect overlapping zones (same pincode in multiple zones)
 * Returns: Array of overlapping zone pairs with pincodes
 * Auth: Required
 */
router.get("/overlaps", zoneCoverageController.detectOverlaps);

/**
 * GET /api/v1/zones/coverage/gaps
 * Find pincodes not covered by any zone
 * Query params: stateId? (optional filter), limit? (default: 100)
 * Returns: Array of uncovered pincodes with coverage percentage
 * Auth: Required
 */
router.get(
  "/gaps",
  validate(zoneSchemas.coverage.findCoverageGaps),
  zoneCoverageController.findCoverageGaps,
);

/**
 * GET /api/v1/zones/:id/coverage/validate
 * Validate complete zone coverage (check for gaps, overlaps, configuration)
 * Path params: id (zone UUID)
 * Returns: { isValid, issues: [], statistics: {} }
 * Auth: Required
 */
router.get(
  "/:id/validate",
  validate(zoneSchemas.coverage.validateZoneCoverage),
  zoneCoverageController.validateZone,
);

module.exports = router;
