const express = require("express");
const router = express.Router();

// Import middleware
const { authMiddleware } = require("../shared/lib/auth");
const { validate } = require("../middleware/validate");
const {
  createShipmentLimiter,
  trackingLimiter,
  generalLimiter,
  bulkOperationsLimiter,
} = require("../middleware/rateLimiter");
const { uploadShipmentFile } = require("../middleware/upload");

// Import controllers
const {
  createShipment,
  assignPartner,
  retryCourierBooking,
  refreshFromProvider,
  fetchCourierLabel,
  cancelWithProvider,
  getShipmentDocuments,
  getShipmentTransactions,
  getShipments,
  getShipmentById,
  updateShipment,
  cancelShipment,
  getShipmentTracking,
  addTrackingEvent,
  calculateRates,
  selectPartner,
  checkServiceability,
  getShipmentQuotes,
  rerateShipment,
  rerateShipmentPreview,
  bulkRerateShipments,
  // New SHIP-004 endpoints
  trackByAwbNumber,
  recordDeliveryConfirmation,
  getTrackingAnalytics,
  // Phase 4: Webhook ingestion
  handleProviderWebhook,
  // SHIP-005: Bulk Operations and Advanced Features
  processBulkShipments,
  getBulkJobStatus,
  uploadBulkShipments,
  getBulkJobs,
  getBulkJobById,
  downloadBulkTemplate,
  createNDRCase,
  getNDRCases,
  takeNDRAction,
  generateShippingLabel,
  downloadShippingLabel,
  generateBulkLabels,
  createManifest,
  schedulePickup,
  getPickupSchedules,
  updatePickupStatus,
  cancelPickup,
  getAvailableTimeSlots,
} = require("../controllers/shipmentController");

// Import validation schemas
const {
  createShipmentSchema,
  assignPartnerSchema,
  updateShipmentSchema,
  trackingEventSchema,
  getShipmentsQuerySchema,
  rateCalculationSchema,
  partnerSelectionSchema,
  serviceabilitySchema,
  shipmentQuoteSchema,
  rerateShipmentSchema,
  rerateShipmentPreviewSchema,
  bulkRerateSchema,
  // Phase 3: Lifecycle validation schemas
  refreshFromProviderSchema,
  fetchCourierLabelSchema,
  cancelShipmentSchema,
  cancelWithProviderSchema,
  // New SHIP-004 validation schemas
  deliveryConfirmationSchema,
  analyticsQuerySchema,
  // SHIP-005 validation schemas
  processBulkShipmentsSchema,
  createNDRCaseSchema,
  takeNDRActionSchema,
  generateShippingLabelSchema,
  downloadShippingLabelQuerySchema,
  generateBulkLabelsSchema,
  createManifestSchema,
  schedulePickupSchema,
  updatePickupStatusSchema,
  retryBookingSchema,
} = require("../validation/shipmentSchemas");

/**
 * @swagger
 * /api/v1/shipments:
 *   post:
 *     tags: [Shipments]
 *     summary: Create a new shipment
 *     description: Create a shipment with pickup and delivery addresses, package details
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShipmentRequest'
 *           example:
 *             orderId: "ORD-2024-001"
 *             pickupAddress:
 *               name: "John Store"
 *               phone: "+919876543210"
 *               email: "store@example.com"
 *               addressLine1: "123 Business Street"
 *               addressLine2: "Ground Floor"
 *               landmark: "Near Metro Station"
 *               city: "Mumbai"
 *               state: "Maharashtra"
 *               pincode: "400001"
 *               country: "India"
 *             deliveryAddress:
 *               name: "Jane Customer"
 *               phone: "+919123456789"
 *               email: "customer@example.com"
 *               addressLine1: "456 Residential Road"
 *               city: "Delhi"
 *               state: "Delhi"
 *               pincode: "110001"
 *               country: "India"
 *             packageDetails:
 *               weight: 2.5
 *               dimensions:
 *                 length: 30.0
 *                 width: 25.0
 *                 height: 15.0
 *               description: "Electronics - Mobile Phone"
 *               value: 25000.00
 *               fragile: true
 *             paymentType: "PREPAID"
 *             serviceType: "STANDARD"
 *             specialInstructions: "Handle with care"
 *     responses:
 *       201:
 *         description: Shipment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         shipment:
 *                           $ref: '#/components/schemas/Shipment'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate order ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  createShipmentLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "create", "own"),
  validate(createShipmentSchema),
  createShipment,
);

router.post(
  "/:id/assign-partner",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "own"),
  validate(assignPartnerSchema),
  assignPartner,
);

/**
 * POST /api/v1/shipments/:id/retry-booking
 * Retry courier booking for an existing shipment (e.g., after fixing Delhivery pickup location config).
 */
// Booking actions an outlet performs on ITS OWN shipment. Scope matching is
// exact server-side, so "assigned" blocked the outlet role (which holds
// shipment:update:own) from retrying a push on a parcel it owns. Each handler
// runs authUtils.applyScopeFilter over the lookup and 404s on a miss, so
// lowering the flag does not widen which shipments are reachable.
router.post(
  "/:id/retry-booking",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "own"),
  validate(retryBookingSchema),
  retryCourierBooking,
);

/**
 * POST /api/v1/shipments/:id/refresh
 * Refresh shipment data from courier provider and sync local records.
 */
router.post(
  "/:id/refresh",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "own"),
  validate(refreshFromProviderSchema),
  refreshFromProvider,
);

/**
 * POST /api/v1/shipments/:id/courier-label
 * Fetch courier label from provider.
 */
router.post(
  "/:id/courier-label",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(fetchCourierLabelSchema),
  fetchCourierLabel,
);

/**
 * POST /api/v1/shipments/:id/cancel-with-provider
 * Cancel shipment — calls provider first, then cancels internally.
 */
router.post(
  "/:id/cancel-with-provider",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "delete", "own"),
  validate(cancelWithProviderSchema),
  cancelWithProvider,
);

/**
 * GET /api/v1/shipments/:id/transactions
 * Every wallet movement (debits, reversals, refunds) caused by this shipment
 */
router.get(
  "/:id/transactions",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getShipmentTransactions,
);

/**
 * GET /api/v1/shipments/:id/documents
 * Get shipment documents (labels, POD, invoices, etc.)
 */
router.get(
  "/:id/documents",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getShipmentDocuments,
);

/**
 * @swagger
 * /api/v1/shipments:
 *   get:
 *     tags: [Shipments]
 *     summary: Get shipments with filtering and pagination
 *     description: Retrieve shipments for the authenticated user/client with optional filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of shipments per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [CREATED, BOOKED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RTO]
 *         description: Filter by shipment status
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *           enum: [PREPAID, COD]
 *         description: Filter by payment type
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter shipments from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter shipments until this date
 *     responses:
 *       200:
 *         description: Shipments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         shipments:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Shipment'
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             totalCount:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *                             hasNext:
 *                               type: boolean
 *                             hasPrev:
 *                               type: boolean
 */
router.get(
  "/",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(getShipmentsQuerySchema, "query"),
  getShipments,
);

/**
 * POST /api/v1/shipments/webhook/:provider
 * Global webhook endpoint for courier providers to push status updates.
 * PUBLIC — no JWT authentication required. Uses webhook secret verification.
 */
router.post("/webhook/:provider", generalLimiter, handleProviderWebhook);

/**
 * @swagger
 * /api/v1/shipments/{id}:
 *   get:
 *     tags: [Shipments]
 *     summary: Get shipment by ID
 *     description: Retrieve detailed shipment information including tracking events
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shipment ID
 *     responses:
 *       200:
 *         description: Shipment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         shipment:
 *                           allOf:
 *                             - $ref: '#/components/schemas/Shipment'
 *                             - type: object
 *                               properties:
 *                                 trackingEvents:
 *                                   type: array
 *                                   items:
 *                                     $ref: '#/components/schemas/TrackingEvent'
 *       404:
 *         description: Shipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @swagger
 * /api/v1/shipments/ndr:
 *   get:
 *     tags: [NDR Management]
 *     summary: Get NDR cases with filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [OPEN, ASSIGNED, IN_PROGRESS, REATTEMPT_SCHEDULED, ADDRESS_UPDATED, RTO_INITIATED, RESOLVED, CLOSED]
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: NDR cases retrieved
 */
// Outlet markup commission ledger (charges-engine v3).
// NOTE: must precede "/:id" — Express would otherwise capture "earnings" as
// a shipment ID.
const {
  getOutletEarnings,
  getOutletEarningsSummary,
} = require("../controllers/outletEarningsController");

// Read-only operations-dashboard aggregation endpoints (no schema changes;
// each handler applies authUtils.applyScopeFilter and Redis-caches its
// result — see controllers/dashboardController.js for details).
const {
  getDashboardSummary,
  getDashboardTrend,
  getDashboardCouriers,
  getDashboardOutlets,
  getDashboardAdjustments,
} = require("../controllers/dashboardController");

/**
 * @swagger
 * /api/v1/shipments/earnings:
 *   get:
 *     tags: [Earnings]
 *     summary: List outlet markup earnings (scoped by role)
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/earnings",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getOutletEarnings,
);

/**
 * @swagger
 * /api/v1/shipments/earnings/summary:
 *   get:
 *     tags: [Earnings]
 *     summary: Outlet earnings totals (accrued/cancelled/month-to-date)
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/earnings/summary",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getOutletEarningsSummary,
);

// NOTE: must precede "/:id" - Express matches in registration order, and
// "/:id" would otherwise capture "dashboard" as a shipment ID.
router.get(
  "/dashboard/summary",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getDashboardSummary,
);

router.get(
  "/dashboard/trend",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getDashboardTrend,
);

router.get(
  "/dashboard/couriers",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getDashboardCouriers,
);

router.get(
  "/dashboard/outlets",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getDashboardOutlets,
);

router.get(
  "/dashboard/adjustments",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getDashboardAdjustments,
);

// NOTE: must precede "/:id" - Express matches in registration order, and
// "/:id" would otherwise capture "ndr" as a shipment ID.
router.get(
  "/ndr",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "assigned"),
  getNDRCases,
);

router.get(
  "/:id",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  // "own", not "assigned". Server-side scope matching is EXACT (no
  // own < assigned < parent hierarchy), and an outlet holds shipment:read:own —
  // so `assigned` let an outlet LIST its shipments (GET / is read:own) but not
  // open one. Every handler lowered here runs authUtils.applyScopeFilter and
  // 404s on a miss, so the row-level isolation is unchanged.
  authMiddleware.requirePermission("shipment", "read", "own"),
  getShipmentById,
);

/**
 * @swagger
 * /api/v1/shipments/{id}:
 *   put:
 *     tags: [Shipments]
 *     summary: Update shipment
 *     description: Update shipment status or special instructions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shipment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CREATED, BOOKED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RTO]
 *               specialInstructions:
 *                 type: string
 *                 maxLength: 500
 *           example:
 *             status: "PICKED_UP"
 *             specialInstructions: "Updated delivery instructions"
 *     responses:
 *       200:
 *         description: Shipment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Shipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  "/:id",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  // "own", not "parent": an outlet holds shipment:update:own and server-side
  // scope matching is EXACT, so "parent" locked outlets out of editing their
  // own shipments. updateShipment runs authUtils.applyScopeFilter over the
  // lookup and 404s on a miss, so an outlet still cannot touch anyone else's.
  authMiddleware.requirePermission("shipment", "update", "own"),
  validate(updateShipmentSchema),
  updateShipment,
);

/**
 * @swagger
 * /api/v1/shipments/{id}/cancel:
 *   post:
 *     tags: [Shipments]
 *     summary: Cancel shipment
 *     description: Cancel a shipment and process refund if applicable
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shipment ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Cancellation reason
 *           example:
 *             reason: "Customer requested cancellation"
 *     responses:
 *       200:
 *         description: Shipment cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Cannot cancel shipment at this stage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Shipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/:id/cancel",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "delete", "own"),
  validate(cancelShipmentSchema),
  cancelShipment,
);

/**
 * @swagger
 * /api/v1/shipments/{id}/tracking:
 *   get:
 *     tags: [Tracking]
 *     summary: Get shipment tracking
 *     description: Retrieve tracking information and events for a shipment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shipment ID
 *     responses:
 *       200:
 *         description: Tracking information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         shipment:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             orderId:
 *                               type: string
 *                             status:
 *                               type: string
 *                             awbNumber:
 *                               type: string
 *                             partnerId:
 *                               type: string
 *                             partnerName:
 *                               type: string
 *                             estimatedDelivery:
 *                               type: string
 *                               format: date-time
 *                             actualDelivery:
 *                               type: string
 *                               format: date-time
 *                               nullable: true
 *                             trackingEvents:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/TrackingEvent'
 *       404:
 *         description: Shipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:id/tracking",
  trackingLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getShipmentTracking,
);

/**
 * @swagger
 * /api/v1/shipments/{id}/tracking/events:
 *   post:
 *     tags: [Tracking]
 *     summary: Add tracking event
 *     description: Add a new tracking event to a shipment (admin/operations only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shipment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, message]
 *             properties:
 *               status:
 *                 type: string
 *                 maxLength: 50
 *                 description: Event status
 *               message:
 *                 type: string
 *                 maxLength: 500
 *                 description: Event description
 *               location:
 *                 type: string
 *                 maxLength: 100
 *                 description: Event location
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Event timestamp (optional, defaults to now)
 *           example:
 *             status: "IN_TRANSIT"
 *             message: "Package arrived at Mumbai sorting facility"
 *             location: "Mumbai Hub"
 *     responses:
 *       201:
 *         description: Tracking event added successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         trackingEvent:
 *                           $ref: '#/components/schemas/TrackingEvent'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Shipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/:id/tracking/events",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "all"),
  validate(trackingEventSchema),
  addTrackingEvent,
);

/**
 * @swagger
 * /api/v1/shipments/calculate-rates:
 *   post:
 *     tags: [Partner Integration]
 *     summary: Calculate shipping rates
 *     description: Calculate shipping rates from all available partners via Partner Service
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromPincode
 *               - toPincode
 *               - weight
 *             properties:
 *               fromPincode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: Origin pincode
 *                 example: "110001"
 *               toPincode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: Destination pincode
 *                 example: "400001"
 *               weight:
 *                 type: number
 *                 format: float
 *                 minimum: 0.001
 *                 maximum: 50
 *                 description: Package weight in kg
 *                 example: 2.5
 *               serviceType:
 *                 type: string
 *                 enum: [STANDARD, EXPRESS, ECONOMY]
 *                 default: STANDARD
 *                 description: Service type
 *               dimensions:
 *                 type: object
 *                 properties:
 *                   length:
 *                     type: number
 *                     example: 20
 *                   width:
 *                     type: number
 *                     example: 15
 *                   height:
 *                     type: number
 *                     example: 10
 *               codAmount:
 *                 type: number
 *                 format: float
 *                 description: COD amount if applicable
 *                 example: 1500.0
 *     responses:
 *       200:
 *         description: Rate calculation results
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/APIResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         rates:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               partnerId:
 *                                 type: string
 *                               partnerName:
 *                                 type: string
 *                               totalAmount:
 *                                 type: number
 *                               deliveryDays:
 *                                 type: integer
 *                         cheapestRate:
 *                           type: object
 *                         fastestRate:
 *                           type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/calculate-rates",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(rateCalculationSchema),
  calculateRates,
);

/**
 * @swagger
 * /api/v1/shipments/select-partner:
 *   post:
 *     tags: [Partner Integration]
 *     summary: Select optimal courier partner
 *     description: Select the best courier partner based on specified strategy
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromPincode
 *               - toPincode
 *               - weight
 *             properties:
 *               fromPincode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: Origin pincode
 *                 example: "110001"
 *               toPincode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: Destination pincode
 *                 example: "400001"
 *               weight:
 *                 type: number
 *                 format: float
 *                 minimum: 0.001
 *                 maximum: 50
 *                 description: Package weight in kg
 *                 example: 2.5
 *               serviceType:
 *                 type: string
 *                 enum: [STANDARD, EXPRESS, ECONOMY]
 *                 default: STANDARD
 *                 description: Service type
 *               dimensions:
 *                 type: object
 *                 properties:
 *                   length:
 *                     type: number
 *                     example: 20
 *                   width:
 *                     type: number
 *                     example: 15
 *                   height:
 *                     type: number
 *                     example: 10
 *               codAmount:
 *                 type: number
 *                 format: float
 *                 description: COD amount if applicable
 *                 example: 1500.0
 *               strategy:
 *                 type: string
 *                 enum: [cheapest, fastest, balanced]
 *                 default: cheapest
 *                 description: Selection strategy
 *     responses:
 *       200:
 *         description: Partner selection results
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/APIResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         selectedCourier:
 *                           type: object
 *                         alternativeOptions:
 *                           type: array
 *                         selectionReason:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/select-partner",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(partnerSelectionSchema),
  selectPartner,
);

/**
 * @swagger
 * /api/v1/shipments/serviceability:
 *   post:
 *     tags: [Partner Integration]
 *     summary: Check serviceability
 *     description: Check if partners can service a route via Partner Service
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromPincode
 *               - toPincode
 *             properties:
 *               fromPincode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: Origin pincode
 *                 example: "110001"
 *               toPincode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: Destination pincode
 *                 example: "400001"
 *               serviceType:
 *                 type: string
 *                 enum: [STANDARD, EXPRESS, ECONOMY]
 *                 default: STANDARD
 *                 description: Service type
 *     responses:
 *       200:
 *         description: Serviceability check results
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/APIResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         serviceability:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               partnerId:
 *                                 type: string
 *                               partnerName:
 *                                 type: string
 *                               serviceable:
 *                                 type: boolean
 *                         summary:
 *                           type: object
 *                           properties:
 *                             serviceablePartners:
 *                               type: integer
 *                             totalPartners:
 *                               type: integer
 *                             isServiceable:
 *                               type: boolean
 *                             serviceabilityPercentage:
 *                               type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/serviceability",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(serviceabilitySchema),
  checkServiceability,
);

/**
 * @swagger
 * /api/v1/shipments/quotes:
 *   post:
 *     tags: [Shipment Creation Flow]
 *     summary: Get partner quotes for shipment creation
 *     description: Returns per-partner charge breakdown with recommended option for the staged creation flow
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/quotes",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "create", "own"),
  validate(shipmentQuoteSchema),
  getShipmentQuotes,
);

/**
 * @swagger
 * /api/v1/shipments/bulk/rerate:
 *   post:
 *     tags: [Shipment Operations]
 *     summary: Bulk re-rate shipments by AWB with new weight/dimensions/courier charge
 *     security:
 *       - bearerAuth: []
 */
// NOTE: must be registered BEFORE "/:id/rerate" — otherwise "/bulk/rerate"
// is captured by the ":id" pattern (id="bulk").
router.post(
  "/bulk/rerate",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "all"),
  validate(bulkRerateSchema),
  bulkRerateShipments,
);

/**
 * @swagger
 * /api/v1/shipments/{id}/rerate/preview:
 *   post:
 *     tags: [Shipment Operations]
 *     summary: Preview a re-rate (dry-run) — no wallet mutation or DB write
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/rerate/preview",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "all"),
  validate(rerateShipmentPreviewSchema),
  rerateShipmentPreview,
);

/**
 * @swagger
 * /api/v1/shipments/{id}/rerate:
 *   post:
 *     tags: [Shipment Operations]
 *     summary: Dispute re-rate a shipment with courier-validated dimensions
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/rerate",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "all"),
  validate(rerateShipmentSchema),
  rerateShipment,
);

// SHIP-004: New tracking endpoints

/**
 * @swagger
 * /api/v1/shipments/track/{awbNumber}:
 *   get:
 *     tags: [Public Tracking]
 *     summary: Track shipment by AWB number (Public)
 *     description: |
 *       Public endpoint to track shipment by AWB number.
 *       No authentication required - designed for customer tracking pages.
 *       Returns sanitized tracking information without sensitive data.
 *     parameters:
 *       - in: path
 *         name: awbNumber
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{10,20}$'
 *         description: AWB number to track
 *         example: "ABC123456789"
 *     responses:
 *       200:
 *         description: Tracking information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Shipment tracking retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     awbNumber:
 *                       type: string
 *                       example: "ABC123456789"
 *                     status:
 *                       type: string
 *                       example: "IN_TRANSIT"
 *                     partnerName:
 *                       type: string
 *                       example: "Blue Dart"
 *                     estimatedDelivery:
 *                       type: string
 *                       format: date-time
 *                     actualDelivery:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     destination:
 *                       type: object
 *                       properties:
 *                         city:
 *                           type: string
 *                           example: "Mumbai"
 *                         state:
 *                           type: string
 *                           example: "Maharashtra"
 *                         pincode:
 *                           type: string
 *                           example: "400001"
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             example: "IN_TRANSIT"
 *                           message:
 *                             type: string
 *                             example: "Package is in transit"
 *                           location:
 *                             type: string
 *                             nullable: true
 *                             example: "Mumbai Hub"
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *       404:
 *         description: Shipment not found with this AWB number
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/track/:awbNumber", trackingLimiter, trackByAwbNumber);

/**
 * @swagger
 * /api/v1/shipments/{id}/delivery-confirmation:
 *   post:
 *     tags: [Tracking]
 *     summary: Record delivery confirmation with POD
 *     description: |
 *       Record delivery confirmation with Proof of Delivery (POD) information.
 *       Admin and operations roles only. Creates DELIVERED tracking event.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shipment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientName
 *             properties:
 *               recipientName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Name of person who received the package
 *                 example: "John Smith"
 *               recipientSignature:
 *                 type: string
 *                 format: uri
 *                 description: URL to recipient signature image
 *                 example: "https://storage.example.com/signatures/abc123.png"
 *               deliveryImage:
 *                 type: string
 *                 format: uri
 *                 description: URL to delivery confirmation image
 *                 example: "https://storage.example.com/deliveries/def456.jpg"
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: OTP provided by recipient
 *                 example: "123456"
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Additional delivery notes
 *                 example: "Package delivered to security guard"
 *               deliveryPersonName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Name of delivery person
 *                 example: "Delivery Partner"
 *               deliveryTime:
 *                 type: string
 *                 format: date-time
 *                 description: Actual delivery time (if different from current time)
 *     responses:
 *       201:
 *         description: Delivery confirmation recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Delivery confirmation recorded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deliveryEvent:
 *                       $ref: '#/components/schemas/TrackingEvent'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Shipment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/:id/delivery-confirmation",
  trackingLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "all"),
  validate(deliveryConfirmationSchema),
  recordDeliveryConfirmation,
);

/**
 * @swagger
 * /api/v1/shipments/analytics/tracking:
 *   get:
 *     tags: [Analytics]
 *     summary: Get tracking analytics and performance metrics
 *     description: |
 *       Get comprehensive tracking analytics including status distribution,
 *       delivery performance, event statistics, and NDR analysis.
 *       Admin users see global analytics, clients see their own data only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 30d, 90d]
 *           default: 7d
 *         description: Time range for analytics
 *         example: "7d"
 *     responses:
 *       200:
 *         description: Tracking analytics generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Tracking analytics generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeRange:
 *                       type: string
 *                       example: "7d"
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     statusDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             example: "DELIVERED"
 *                           count:
 *                             type: number
 *                             example: 150
 *                     deliveryPerformance:
 *                       type: object
 *                       properties:
 *                         totalDelivered:
 *                           type: number
 *                           example: 150
 *                     eventsBySource:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           source:
 *                             type: string
 *                             example: "PARTNER"
 *                           count:
 *                             type: number
 *                             example: 245
 *                     ndrStats:
 *                       type: object
 *                       properties:
 *                         totalNDRs:
 *                           type: number
 *                           example: 12
 *                         breakdown:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: "NDR"
 *                               count:
 *                                 type: number
 *                                 example: 12
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/analytics/tracking",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("analytics", "read", "parent"),
  validate(analyticsQuerySchema, "query"),
  getTrackingAnalytics,
);

// SHIP-005: Bulk Operations and Advanced Features

/**
 * @swagger
 * /api/v1/shipments/bulk:
 *   post:
 *     tags: [Bulk Operations]
 *     summary: Process bulk shipments from CSV/Excel file
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or Excel file containing shipment data
 *               clientId:
 *                 type: string
 *                 description: Client ID for multi-tenant support
 *     responses:
 *       202:
 *         description: Bulk processing started
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
/**
 * @swagger
 * /api/v1/shipments/bulk/template:
 *   get:
 *     tags: [Bulk Operations]
 *     summary: Download the bulk shipment CSV template
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
// NOTE: must precede "/bulk/:jobId/status" so "template" is not read as a jobId
router.get(
  "/bulk/template",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "assigned"),
  downloadBulkTemplate,
);

/**
 * @swagger
 * /api/v1/shipments/bulk/jobs:
 *   get:
 *     tags: [Bulk Operations]
 *     summary: List bulk upload jobs (upload history)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED]
 *       - name: search
 *         in: query
 *         description: Filter by file name
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bulk jobs retrieved with pagination and summary counts
 */
// NOTE: must precede "/bulk/:jobId/status" so "jobs" is not read as a jobId
router.get(
  "/bulk/jobs",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "assigned"),
  getBulkJobs,
);

/**
 * @swagger
 * /api/v1/shipments/bulk/jobs/{jobId}:
 *   get:
 *     tags: [Bulk Operations]
 *     summary: Get a single bulk job with live progress
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bulk job retrieved
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/bulk/jobs/:jobId",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "assigned"),
  getBulkJobById,
);

/**
 * @swagger
 * /api/v1/shipments/bulk/upload:
 *   post:
 *     tags: [Bulk Operations]
 *     summary: Upload a CSV/Excel file to create shipments in bulk
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or Excel file (max 10MB, max 1000 rows)
 *     responses:
 *       200:
 *         description: File processed; per-row results returned
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/bulk/upload",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "create", "assigned"),
  bulkOperationsLimiter,
  // Multipart body - parsed by multer, so no JSON validator here
  ...uploadShipmentFile,
  uploadBulkShipments,
);

router.post(
  "/bulk",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "create", "assigned"),
  bulkOperationsLimiter,
  validate(processBulkShipmentsSchema),
  processBulkShipments,
);

/**
 * @swagger
 * /api/v1/shipments/bulk/{jobId}/status:
 *   get:
 *     tags: [Bulk Operations]
 *     summary: Get bulk job status
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status retrieved
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/bulk/:jobId/status",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "assigned"),
  getBulkJobStatus,
);

/**
 * @swagger
 * /api/v1/shipments/{shipmentId}/ndr:
 *   post:
 *     tags: [NDR Management]
 *     summary: Create NDR case for failed delivery
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: shipmentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [ADDRESS_INCORRECT, CONSIGNEE_UNAVAILABLE, REFUSED_BY_CONSIGNEE, DAMAGE_DURING_TRANSIT, OTHER]
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       201:
 *         description: NDR case created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/:shipmentId/ndr",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "assigned"),
  validate(createNDRCaseSchema),
  createNDRCase,
);

/**
 * @swagger
 * /api/v1/shipments/ndr/{ndrCaseId}/action:
 *   post:
 *     tags: [NDR Management]
 *     summary: Take action on NDR case
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: ndrCaseId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [REATTEMPT_DELIVERY, RETURN_TO_ORIGIN, MARK_RESOLVED]
 *               notes:
 *                 type: string
 *               preferredDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: NDR action completed
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/ndr/:ndrCaseId/action",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "assigned"),
  validate(takeNDRActionSchema),
  takeNDRAction,
);

/**
 * @swagger
 * /api/v1/shipments/{shipmentId}/label:
 *   post:
 *     tags: [Label Generation]
 *     summary: Generate shipping label
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: shipmentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [A4, A4_4, "4x6", "6x4"]
 *               copies:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *     responses:
 *       201:
 *         description: Label generated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/:shipmentId/label",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(generateShippingLabelSchema),
  generateShippingLabel,
);

/**
 * GET /api/v1/shipments/:shipmentId/label
 * Download the white-label (outlet/client branded) shipping label PDF.
 */
router.get(
  "/:shipmentId/label",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  validate(downloadShippingLabelQuerySchema, "query"),
  downloadShippingLabel,
);

/**
 * @swagger
 * /api/v1/shipments/labels/bulk:
 *   post:
 *     tags: [Label Generation]
 *     summary: Generate bulk shipping labels
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shipmentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               format:
 *                 type: string
 *                 enum: [A4, A4_4, "4x6", "6x4"]
 *     responses:
 *       200:
 *         description: Bulk labels generated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/labels/bulk",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "assigned"),
  validate(generateBulkLabelsSchema),
  generateBulkLabels,
);

/**
 * @swagger
 * /api/v1/shipments/manifest:
 *   post:
 *     tags: [Label Generation]
 *     summary: Create manifest for multiple shipments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partnerId:
 *                 type: string
 *               shipmentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Manifest created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/manifest",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "manage", "assigned"),
  validate(createManifestSchema),
  createManifest,
);

/**
 * @swagger
 * /api/v1/shipments/pickup/schedule:
 *   post:
 *     tags: [Pickup Scheduling]
 *     summary: Schedule pickup for shipments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partnerId:
 *                 type: string
 *               shipmentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *               timeSlot:
 *                 type: string
 *                 enum: ["09:00-12:00", "10:00-13:00", "11:00-14:00", "12:00-15:00", "14:00-17:00", "15:00-18:00"]
 *               pickupAddress:
 *                 type: object
 *     responses:
 *       201:
 *         description: Pickup scheduled successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/pickup/schedule",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "create", "assigned"),
  validate(schedulePickupSchema),
  schedulePickup,
);

/**
 * @swagger
 * /api/v1/shipments/pickup/schedules:
 *   get:
 *     tags: [Pickup Scheduling]
 *     summary: Get pickup schedules
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED]
 *       - name: partnerId
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pickup schedules retrieved
 */
router.get(
  "/pickup/schedules",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "assigned"),
  getPickupSchedules,
);

/**
 * @swagger
 * /api/v1/shipments/pickup/{pickupScheduleId}:
 *   put:
 *     tags: [Pickup Scheduling]
 *     summary: Update pickup status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pickupScheduleId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pickup status updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put(
  "/pickup/:pickupScheduleId",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "assigned"),
  validate(updatePickupStatusSchema),
  updatePickupStatus,
);

/**
 * @swagger
 * /api/v1/shipments/pickup/{pickupScheduleId}:
 *   delete:
 *     tags: [Pickup Scheduling]
 *     summary: Cancel pickup
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pickupScheduleId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pickup cancelled
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete(
  "/pickup/:pickupScheduleId",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "update", "assigned"),
  cancelPickup,
);

/**
 * @swagger
 * /api/v1/shipments/pickup/slots:
 *   get:
 *     tags: [Pickup Scheduling]
 *     summary: Get available time slots for pickup
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: date
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: partnerId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available time slots retrieved
 */
router.get(
  "/pickup/slots",
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
  authMiddleware.requirePermission("shipment", "read", "own"),
  getAvailableTimeSlots,
);

module.exports = router;
