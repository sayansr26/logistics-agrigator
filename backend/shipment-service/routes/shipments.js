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
} = require("../controllers/shipmentController");

// Import validation schemas
const {
  createShipmentSchema,
  updateShipmentSchema,
  trackingEventSchema,
  getShipmentsQuerySchema,
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

module.exports = router;
