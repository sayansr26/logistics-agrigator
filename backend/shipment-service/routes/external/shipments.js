/**
 * External Shipment API routes — /api/v1/external/shipments
 *
 * Middleware order is load-bearing:
 *   envelope -> externalAuth -> rate limit -> scope -> idempotency -> validate
 *
 * The rate limiter comes AFTER auth so it can key on the API credential; the
 * internal routes put their limiter first, where req.user is undefined and the
 * key collapses to "ip:anonymous".
 */

const express = require("express");

const router = express.Router();

const { externalAuth, requireScope } = require("../../middleware/externalAuth");
const { externalEnvelope } = require("../../middleware/externalEnvelope");
const { idempotency } = require("../../middleware/idempotency");
const {
  globalLimiter,
  bookingLimiter,
  quoteLimiter,
  trackingLimiter,
  documentsLimiter,
} = require("../../middleware/externalRateLimiter");
const {
  validateExternal,
  createShipmentSchema,
  ratesSchema,
  listQuerySchema,
  updateShipmentSchema,
  cancelSchema,
  serviceabilitySchema,
  idParamSchema,
  awbParamSchema,
} = require("../../validation/externalSchemas");
const controller = require("../../controllers/external/shipmentExternalController");

// Envelope first so even auth failures carry a request id and the public shape.
router.use(externalEnvelope);
router.use(externalAuth);
router.use(globalLimiter);

/**
 * @swagger
 * /api/v1/external/shipments/rates:
 *   post:
 *     tags: [External API]
 *     summary: Get rate quotes for a prospective shipment
 *     description: |
 *       Returns every serviceable partner with a price breakdown. Each
 *       serviceable quote carries a `quoteToken` valid for 15 minutes that can
 *       be passed to `POST /shipments` for two-step booking.
 *     security: [{ externalAuth: [] }]
 */
router.post(
  "/rates",
  quoteLimiter,
  requireScope("shipment:create:own"),
  validateExternal({ body: ratesSchema }),
  controller.getRates,
);

/**
 * @swagger
 * /api/v1/external/shipments/serviceability:
 *   post:
 *     tags: [External API]
 *     summary: Check whether a route is serviceable
 *     security: [{ externalAuth: [] }]
 */
router.post(
  "/serviceability",
  quoteLimiter,
  requireScope("shipment:read:own"),
  validateExternal({ body: serviceabilitySchema }),
  controller.checkServiceability,
);

/**
 * @swagger
 * /api/v1/external/shipments/track/{awbNumber}:
 *   get:
 *     tags: [External API]
 *     summary: Track a shipment by AWB number
 *     security: [{ externalAuth: [] }]
 */
// Registered before /:id so "track" is not captured as an identifier.
router.get(
  "/track/:awbNumber",
  trackingLimiter,
  requireScope("shipment:read:own"),
  validateExternal({ params: awbParamSchema }),
  controller.trackByAwb,
);

/**
 * @swagger
 * /api/v1/external/shipments:
 *   post:
 *     tags: [External API]
 *     summary: Book a shipment
 *     description: |
 *       Two modes. **One-step** (recommended): omit `quoteToken` and pass either
 *       a `partnerId` or `selection` (`cheapest` | `fastest`) — the server
 *       prices, picks, and books in a single call. **Two-step**: pass the
 *       `quoteToken`, `partnerId` and `quoteSnapshot` from a prior `/rates`
 *       call.
 *
 *       Send an `Idempotency-Key` header; retries with the same key replay the
 *       original response instead of booking (and charging) twice.
 *     security: [{ externalAuth: [] }]
 *   get:
 *     tags: [External API]
 *     summary: List shipments
 *     security: [{ externalAuth: [] }]
 */
router.post(
  "/",
  bookingLimiter,
  requireScope("shipment:create:own"),
  validateExternal({ body: createShipmentSchema }),
  idempotency({ required: false }),
  controller.bookShipment,
);

router.get(
  "/",
  requireScope("shipment:read:own"),
  validateExternal({ query: listQuerySchema }),
  controller.listShipments,
);

/**
 * @swagger
 * /api/v1/external/shipments/{id}:
 *   get:
 *     tags: [External API]
 *     summary: Get a shipment by id, AWB number or your own order id
 *     security: [{ externalAuth: [] }]
 *   patch:
 *     tags: [External API]
 *     summary: Edit a shipment before it is booked with the carrier
 *     security: [{ externalAuth: [] }]
 */
router.get(
  "/:id",
  requireScope("shipment:read:own"),
  validateExternal({ params: idParamSchema }),
  controller.getShipment,
);

router.patch(
  "/:id",
  requireScope("shipment:update:own"),
  validateExternal({ params: idParamSchema, body: updateShipmentSchema }),
  idempotency(),
  controller.updateShipment,
);

/**
 * @swagger
 * /api/v1/external/shipments/{id}/cancel:
 *   post:
 *     tags: [External API]
 *     summary: Cancel a shipment
 *     description: Refunds to the wallet where the shipment's state allows it.
 *     security: [{ externalAuth: [] }]
 */
router.post(
  "/:id/cancel",
  requireScope("shipment:delete:own"),
  validateExternal({ params: idParamSchema, body: cancelSchema }),
  idempotency(),
  controller.cancelShipment,
);

/**
 * @swagger
 * /api/v1/external/shipments/{id}/tracking:
 *   get:
 *     tags: [External API]
 *     summary: Get the tracking history of a shipment
 *     security: [{ externalAuth: [] }]
 */
router.get(
  "/:id/tracking",
  trackingLimiter,
  requireScope("shipment:read:own"),
  validateExternal({ params: idParamSchema }),
  controller.getTracking,
);

/**
 * @swagger
 * /api/v1/external/shipments/{id}/documents:
 *   get:
 *     tags: [External API]
 *     summary: List a shipment's documents (labels, invoices, POD)
 *     security: [{ externalAuth: [] }]
 */
router.get(
  "/:id/documents",
  documentsLimiter,
  requireScope("shipment:read:own"),
  validateExternal({ params: idParamSchema }),
  controller.getDocuments,
);

/**
 * @swagger
 * /api/v1/external/shipments/{id}/label:
 *   post:
 *     tags: [External API]
 *     summary: Fetch the carrier shipping label
 *     security: [{ externalAuth: [] }]
 */
router.post(
  "/:id/label",
  documentsLimiter,
  requireScope("shipment:read:own"),
  validateExternal({ params: idParamSchema }),
  controller.getLabel,
);

module.exports = router;
