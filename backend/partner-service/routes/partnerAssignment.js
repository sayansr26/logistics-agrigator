const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { partnerAssignmentLimiter } = require("../middleware/rateLimiter");
const partnerAssignmentController = require("../controllers/partnerAssignmentController");

// Apply authentication and rate limiting to all routes
router.use(authenticate);
router.use(partnerAssignmentLimiter);

/**
 * @swagger
 * components:
 *   schemas:
 *     PartnerAvailabilityRequest:
 *       type: object
 *       required:
 *         - shipmentDetails
 *       properties:
 *         shipmentDetails:
 *           type: object
 *           required:
 *             - shipmentId
 *             - fromPincode
 *             - toPincode
 *             - weight
 *           properties:
 *             shipmentId:
 *               type: string
 *               example: "SH_1721123456789"
 *             fromPincode:
 *               type: string
 *               pattern: "^\\d{6}$"
 *               example: "110001"
 *             toPincode:
 *               type: string
 *               pattern: "^\\d{6}$"
 *               example: "400001"
 *             weight:
 *               type: number
 *               minimum: 0.1
 *               example: 2500
 *             declaredValue:
 *               type: number
 *               example: 3500
 *             shipmentType:
 *               type: string
 *               enum: [B2B, B2C, C2C]
 *               example: "B2C"
 *             paymentType:
 *               type: string
 *               enum: [COD, PREPAID]
 *               example: "COD"
 *             serviceTypes:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["PICKUP", "DELIVERY", "EXPRESS"]
 *             urgency:
 *               type: string
 *               enum: [STANDARD, EXPRESS, OVERNIGHT]
 *               example: "EXPRESS"
 *         availabilityOptions:
 *           type: object
 *           properties:
 *             includePartnerDetails:
 *               type: boolean
 *               default: true
 *             includeCostEstimate:
 *               type: boolean
 *               default: false
 *             maxPartners:
 *               type: number
 *               default: 10
 *
 *     ShipmentAssignmentRequest:
 *       type: object
 *       required:
 *         - shipmentDetails
 *       properties:
 *         shipmentDetails:
 *           $ref: '#/components/schemas/PartnerAvailabilityRequest/properties/shipmentDetails'
 *         assignmentPreferences:
 *           type: object
 *           properties:
 *             assignmentStrategy:
 *               type: string
 *               enum: [BEST_MATCH, COST_OPTIMIZED, TIME_OPTIMIZED, RELIABILITY_FOCUSED, BALANCED]
 *               default: "BEST_MATCH"
 *               example: "BEST_MATCH"
 *             preferredPartners:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["PARTNER_001", "PARTNER_002"]
 *             excludedPartners:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["PARTNER_003"]
 *             maxCost:
 *               type: number
 *               example: 200
 *             maxDeliveryTime:
 *               type: string
 *               example: "24h"
 *         options:
 *           type: object
 *           properties:
 *             includePartnerDetails:
 *               type: boolean
 *               default: true
 *             includeCostEstimate:
 *               type: boolean
 *               default: true
 *             includeAlternatives:
 *               type: boolean
 *               default: true
 *
 *     AssignmentWorkflowRequest:
 *       type: object
 *       properties:
 *         shipments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PartnerAvailabilityRequest/properties/shipmentDetails'
 *         shipmentDetails:
 *           $ref: '#/components/schemas/PartnerAvailabilityRequest/properties/shipmentDetails'
 *         strategy:
 *           type: string
 *           enum: [BEST_MATCH, COST_OPTIMIZED, TIME_OPTIMIZED, RELIABILITY_FOCUSED, BALANCED]
 *           default: "BEST_MATCH"
 *         assignmentPreferences:
 *           $ref: '#/components/schemas/ShipmentAssignmentRequest/properties/assignmentPreferences'
 *         options:
 *           type: object
 *           properties:
 *             batchSize:
 *               type: number
 *               default: 10
 *             parallelProcessing:
 *               type: boolean
 *               default: true
 *             failOnError:
 *               type: boolean
 *               default: false
 *
 *     StrategyRecommendationRequest:
 *       type: object
 *       required:
 *         - shipmentId
 *         - fromPincode
 *         - toPincode
 *         - weight
 *         - declaredValue
 *       properties:
 *         shipmentId:
 *           type: string
 *           example: "SH_1721123456789"
 *         fromPincode:
 *           type: string
 *           pattern: "^\\d{6}$"
 *           example: "110001"
 *         toPincode:
 *           type: string
 *           pattern: "^\\d{6}$"
 *           example: "400001"
 *         weight:
 *           type: number
 *           minimum: 0.1
 *           example: 2500
 *         declaredValue:
 *           type: number
 *           minimum: 1
 *           example: 3500
 *         urgency:
 *           type: string
 *           enum: [STANDARD, EXPRESS, OVERNIGHT]
 *           example: "EXPRESS"
 *         paymentType:
 *           type: string
 *           enum: [COD, PREPAID]
 *           example: "COD"
 */

/**
 * @swagger
 * /api/v1/partners/availability/check:
 *   post:
 *     summary: Check partner availability for shipment
 *     description: Check which partners are available for a specific shipment
 *     tags: [Partner Assignment]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PartnerAvailabilityRequest'
 *     responses:
 *       200:
 *         description: Partner availability check completed successfully
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
 *                   example: "Partner availability check completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     checkId:
 *                       type: string
 *                       example: "AC_1721123456789_abc123"
 *                     availablePartners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partnerId:
 *                             type: string
 *                           partnerName:
 *                             type: string
 *                           serviceTypes:
 *                             type: array
 *                             items:
 *                               type: string
 *                           estimatedCost:
 *                             type: number
 *                           estimatedDeliveryTime:
 *                             type: string
 *                     unavailablePartners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partnerId:
 *                             type: string
 *                           reason:
 *                             type: string
 *                     totalPartnersChecked:
 *                       type: number
 *                       example: 8
 *                     availabilityScore:
 *                       type: number
 *                       example: 75
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/availability/check",
  partnerAssignmentController.checkPartnerAvailability,
);

/**
 * @swagger
 * /api/v1/shipment-assignment/assign:
 *   post:
 *     summary: Assign shipment to optimal partner
 *     description: Assign a shipment to the most suitable partner based on specified criteria
 *     tags: [Partner Assignment]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShipmentAssignmentRequest'
 *     responses:
 *       200:
 *         description: Shipment assignment completed successfully
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
 *                   example: "Shipment assignment completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignmentId:
 *                       type: string
 *                       example: "SA_1721123456789_xyz789"
 *                     assignedPartner:
 *                       type: object
 *                       properties:
 *                         partnerId:
 *                           type: string
 *                           example: "PARTNER_001"
 *                         partnerName:
 *                           type: string
 *                           example: "Express Logistics"
 *                         serviceType:
 *                           type: string
 *                           example: "EXPRESS"
 *                         reliabilityScore:
 *                           type: number
 *                           example: 95
 *                     alternativePartners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partnerId:
 *                             type: string
 *                           partnerName:
 *                             type: string
 *                           estimatedCost:
 *                             type: number
 *                     assignmentScore:
 *                       type: number
 *                       example: 92
 *                     assignmentReason:
 *                       type: string
 *                       example: "Best match based on cost and delivery time"
 *                     estimatedCost:
 *                       type: number
 *                       example: 125.50
 *                     estimatedDeliveryTime:
 *                       type: string
 *                       example: "24h"
 *                     qualityMetrics:
 *                       type: object
 *                       properties:
 *                         costEfficiency:
 *                           type: number
 *                         timeEfficiency:
 *                           type: number
 *                         reliabilityScore:
 *                           type: number
 *                         overallQuality:
 *                           type: number
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post("/assign", partnerAssignmentController.assignShipment);

/**
 * @swagger
 * /api/v1/partner-assignment-workflow:
 *   post:
 *     summary: Execute partner assignment workflow
 *     description: Execute a comprehensive partner assignment workflow for single or multiple shipments
 *     tags: [Partner Assignment]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignmentWorkflowRequest'
 *     responses:
 *       200:
 *         description: Assignment workflow completed successfully
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
 *                   example: "Assignment workflow completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     workflowId:
 *                       type: string
 *                       example: "WF_1721123456789_workflow123"
 *                     status:
 *                       type: string
 *                       enum: [IN_PROGRESS, COMPLETED, COMPLETED_WITH_ERRORS, FAILED]
 *                       example: "COMPLETED"
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: number
 *                       description: Duration in milliseconds
 *                       example: 15000
 *                     totalShipments:
 *                       type: number
 *                       example: 50
 *                     processedShipments:
 *                       type: number
 *                       example: 50
 *                     successfulAssignments:
 *                       type: number
 *                       example: 48
 *                     failedAssignments:
 *                       type: number
 *                       example: 2
 *                     assignments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           assignmentId:
 *                             type: string
 *                           shipmentId:
 *                             type: string
 *                           assignedPartner:
 *                             type: object
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           shipmentId:
 *                             type: string
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post("/workflow", partnerAssignmentController.executeAssignmentWorkflow);

/**
 * @swagger
 * /api/v1/assignment/analytics:
 *   get:
 *     summary: Get assignment performance analytics
 *     description: Retrieve performance analytics and metrics for partner assignments
 *     tags: [Partner Assignment]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: "24h"
 *         description: Time frame for analytics
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter by specific partner ID
 *       - in: query
 *         name: strategy
 *         schema:
 *           type: string
 *           enum: [BEST_MATCH, COST_OPTIMIZED, TIME_OPTIMIZED, RELIABILITY_FOCUSED, BALANCED]
 *         description: Filter by assignment strategy
 *     responses:
 *       200:
 *         description: Assignment analytics retrieved successfully
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
 *                   example: "Assignment analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAssignments:
 *                       type: number
 *                       example: 1250
 *                     successRate:
 *                       type: number
 *                       example: 96.5
 *                     averageAssignmentTime:
 *                       type: number
 *                       example: 2.3
 *                     topPartners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partnerId:
 *                             type: string
 *                           partnerName:
 *                             type: string
 *                           assignmentCount:
 *                             type: number
 *                           successRate:
 *                             type: number
 *                     strategyPerformance:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           usage:
 *                             type: number
 *                           successRate:
 *                             type: number
 *                           averageCost:
 *                             type: number
 *                     trends:
 *                       type: object
 *                       properties:
 *                         daily:
 *                           type: array
 *                           items:
 *                             type: object
 *                         hourly:
 *                           type: array
 *                           items:
 *                             type: object
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get("/analytics", partnerAssignmentController.getAssignmentAnalytics);

/**
 * @swagger
 * /api/v1/assignment/strategy-recommendations:
 *   post:
 *     summary: Get assignment strategy recommendations
 *     description: Get recommended assignment strategy based on shipment characteristics
 *     tags: [Partner Assignment]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StrategyRecommendationRequest'
 *     responses:
 *       200:
 *         description: Strategy recommendations generated successfully
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
 *                   example: "Strategy recommendations generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     primaryStrategy:
 *                       type: string
 *                       example: "TIME_OPTIMIZED"
 *                     alternativeStrategies:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["BALANCED", "RELIABILITY_FOCUSED"]
 *                     reasoning:
 *                       type: string
 *                       example: "Express delivery requirement detected"
 *                     confidenceScore:
 *                       type: number
 *                       example: 85
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/strategy-recommendations",
  partnerAssignmentController.getStrategyRecommendations,
);

/**
 * @swagger
 * /api/v1/assignment/workflow/{workflowId}/status:
 *   get:
 *     summary: Get assignment workflow status
 *     description: Retrieve the current status of a specific assignment workflow
 *     tags: [Partner Assignment]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID to check status for
 *         example: "WF_1721123456789_workflow123"
 *     responses:
 *       200:
 *         description: Workflow status retrieved successfully
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
 *                   example: "Workflow status retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     workflowId:
 *                       type: string
 *                       example: "WF_1721123456789_workflow123"
 *                     status:
 *                       type: string
 *                       enum: [IN_PROGRESS, COMPLETED, COMPLETED_WITH_ERRORS, FAILED]
 *                       example: "IN_PROGRESS"
 *                     progress:
 *                       type: object
 *                       properties:
 *                         totalShipments:
 *                           type: number
 *                         processedShipments:
 *                           type: number
 *                         successfulAssignments:
 *                           type: number
 *                         failedAssignments:
 *                           type: number
 *                         percentComplete:
 *                           type: number
 *       400:
 *         description: Invalid workflow ID
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Workflow not found or expired
 *       500:
 *         description: Internal server error
 */
router.get(
  "/workflow/:workflowId/status",
  partnerAssignmentController.getWorkflowStatus,
);

/**
 * @swagger
 * /api/v1/assignment/metrics:
 *   get:
 *     summary: Get assignment performance metrics
 *     description: Retrieve detailed performance metrics for partner assignments
 *     tags: [Partner Assignment]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: "24h"
 *         description: Time frame for metrics
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter by specific partner ID
 *     responses:
 *       200:
 *         description: Assignment metrics retrieved successfully
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
 *                   example: "Assignment metrics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeframe:
 *                       type: string
 *                       example: "24h"
 *                     totalAssignments:
 *                       type: number
 *                       example: 1250
 *                     successfulAssignments:
 *                       type: number
 *                       example: 1205
 *                     failedAssignments:
 *                       type: number
 *                       example: 45
 *                     successRate:
 *                       type: number
 *                       example: 96.4
 *                     partnerDistribution:
 *                       type: object
 *                       additionalProperties:
 *                         type: number
 *                       example:
 *                         PARTNER_001: 450
 *                         PARTNER_002: 380
 *                         PARTNER_003: 420
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get("/metrics", partnerAssignmentController.getAssignmentMetrics);

module.exports = router;
