/**
 * Courier Operation Routes
 *
 * API endpoints for courier operations: booking, cancellation, tracking,
 * pickup, labels, manifests, and serviceability checks.
 *
 * All routes require authentication. Business logic in controller only.
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const courierOperationController = require("../controllers/courierOperationController");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const {
  bookShipmentSchema,
  cancelShipmentSchema,
  trackShipmentParamsSchema,
  requestPickupSchema,
  getLabelParamsSchema,
  getLabelQuerySchema,
  generateManifestSchema,
  checkServiceabilityParamsSchema,
} = require("../validation/courierOperationSchemas");
const { courierOperationLimiter } = require("../middleware/rateLimiter");

// Apply rate limiter to all courier operation routes
router.use(courierOperationLimiter);

// ========================================
// COURIER OPERATION ROUTES
// ========================================

/**
 * POST /book - Book a shipment with a courier partner
 */
router.post(
  "/book",
  authMiddleware.authenticate,
  validateBody(bookShipmentSchema),
  courierOperationController.bookShipment,
);

/**
 * POST /cancel - Cancel a courier shipment
 */
router.post(
  "/cancel",
  authMiddleware.authenticate,
  validateBody(cancelShipmentSchema),
  courierOperationController.cancelShipment,
);

/**
 * GET /track/:partnerId/:awbNumber - Track a courier shipment
 */
router.get(
  "/track/:partnerId/:awbNumber",
  authMiddleware.authenticate,
  courierOperationController.trackShipment,
);

/**
 * POST /pickup - Request pickup from courier
 */
router.post(
  "/pickup",
  authMiddleware.authenticate,
  validateBody(requestPickupSchema),
  courierOperationController.requestPickup,
);

/**
 * GET /label/:partnerId/:awbNumber - Get shipping label
 */
router.get(
  "/label/:partnerId/:awbNumber",
  authMiddleware.authenticate,
  validateQuery(getLabelQuerySchema),
  courierOperationController.getShippingLabel,
);

/**
 * POST /manifest - Generate manifest for multiple AWBs
 */
router.post(
  "/manifest",
  authMiddleware.authenticate,
  validateBody(generateManifestSchema),
  courierOperationController.generateManifest,
);

/**
 * GET /serviceability/:partnerId/:pincode - Check courier serviceability
 */
router.get(
  "/serviceability/:partnerId/:pincode",
  authMiddleware.authenticate,
  validateParams(checkServiceabilityParamsSchema),
  courierOperationController.checkServiceability,
);

/**
 * GET /supported-aggregators - List supported aggregator types
 */
router.get(
  "/supported-aggregators",
  authMiddleware.authenticate,
  courierOperationController.getSupportedAggregators,
);

module.exports = router;
