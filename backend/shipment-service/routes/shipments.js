const express = require("express");
const router = express.Router();

// Import middleware
const authMiddleware = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  createShipmentLimiter,
  trackingLimiter,
  generalLimiter,
} = require("../middleware/rateLimiter");

// Import controllers
const {
  createShipment,
  getShipments,
  getShipmentById,
  updateShipment,
  cancelShipment,
  getShipmentTracking,
  addTrackingEvent,
  calculateRates,
  selectPartner,
  checkServiceability,
  // New SHIP-004 endpoints
  trackByAwbNumber,
  recordDeliveryConfirmation,
  getTrackingAnalytics,
} = require("../controllers/shipmentController");

// Import validation schemas
const {
  createShipmentSchema,
  updateShipmentSchema,
  trackingEventSchema,
  getShipmentsQuerySchema,
  rateCalculationSchema,
  partnerSelectionSchema,
  serviceabilitySchema,
  // New SHIP-004 validation schemas
  deliveryConfirmationSchema,
  analyticsQuerySchema,
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
  validate(createShipmentSchema),
  createShipment,
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
  validate(getShipmentsQuerySchema, "query"),
  getShipments,
);

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
router.get(
  "/:id",
  generalLimiter,
  authMiddleware.authenticate,
  authMiddleware.enrichUserContext,
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
  authMiddleware.operationsOrHigher,
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
  validate(serviceabilitySchema),
  checkServiceability,
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
  authMiddleware.authorize(["admin", "operations"]),
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
  validate(analyticsQuerySchema, "query"),
  getTrackingAnalytics,
);

module.exports = router;
