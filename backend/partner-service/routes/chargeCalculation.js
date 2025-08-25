const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { chargeCalculationLimiter } = require("../middleware/rateLimiter");
const chargeCalculationController = require("../controllers/chargeCalculationController");

// Apply authentication and rate limiting to all routes
router.use(authenticate);
router.use(chargeCalculationLimiter);

/**
 * @swagger
 * components:
 *   schemas:
 *     SurchargeCalculationRequest:
 *       type: object
 *       required:
 *         - shipmentValue
 *         - weight
 *         - serviceType
 *       properties:
 *         shipmentValue:
 *           type: number
 *           minimum: 1
 *           description: Shipment declared value
 *           example: 5000
 *         weight:
 *           type: number
 *           minimum: 0.1
 *           description: Shipment weight in grams
 *           example: 2500
 *         serviceType:
 *           type: string
 *           enum: [STANDARD, EXPRESS, OVERNIGHT]
 *           description: Service type for calculation
 *           example: "EXPRESS"
 *         dimensions:
 *           type: object
 *           properties:
 *             length:
 *               type: number
 *               example: 30
 *             width:
 *               type: number
 *               example: 20
 *             height:
 *               type: number
 *               example: 10
 *         additionalServices:
 *           type: array
 *           items:
 *             type: string
 *           example: ["COD", "INSURANCE"]
 *
 *     ShipmentChargeCalculationRequest:
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
 *             - declaredValue
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
 *               minimum: 1
 *               example: 3500
 *             paymentType:
 *               type: string
 *               enum: [COD, PREPAID]
 *               example: "COD"
 *             serviceTypes:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["PICKUP", "DELIVERY", "EXPRESS"]
 *         calculationOptions:
 *           type: object
 *           properties:
 *             includeBreakdown:
 *               type: boolean
 *               default: true
 *             includeTaxes:
 *               type: boolean
 *               default: true
 *             includeDiscounts:
 *               type: boolean
 *               default: false
 *             currency:
 *               type: string
 *               default: "INR"
 *
 *     ChargeValidationRequest:
 *       type: object
 *       required:
 *         - chargeData
 *       properties:
 *         chargeData:
 *           type: object
 *           properties:
 *             totalCharges:
 *               type: number
 *               example: 150
 *             partnerQuotes:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   partnerId:
 *                     type: string
 *                   partnerName:
 *                     type: string
 *                   totalCharge:
 *                     type: number
 *         validationRules:
 *           type: object
 *           properties:
 *             customRules:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   condition:
 *                     type: string
 *
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/v1/surcharge-calculation/{partnerId}/calculate:
 *   post:
 *     summary: Calculate surcharges for a specific partner
 *     description: Calculate comprehensive surcharges for a shipment with a specific partner
 *     tags: [Charge Calculation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID for surcharge calculation
 *         example: "PARTNER_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SurchargeCalculationRequest'
 *     responses:
 *       200:
 *         description: Surcharge calculation completed successfully
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
 *                   example: "Surcharge calculation completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     calculationId:
 *                       type: string
 *                       example: "SC_1721123456789_abc123"
 *                     partnerId:
 *                       type: string
 *                       example: "PARTNER_001"
 *                     totalSurcharge:
 *                       type: number
 *                       example: 45.50
 *                     currency:
 *                       type: string
 *                       example: "INR"
 *                     surchargeBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           description:
 *                             type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:partnerId/calculate",
  chargeCalculationController.calculateSurcharges,
);

/**
 * @swagger
 * /api/v1/shipments/calculate-charges:
 *   post:
 *     summary: Calculate comprehensive charges for shipment
 *     description: Calculate detailed charges for a shipment across multiple partners
 *     tags: [Charge Calculation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShipmentChargeCalculationRequest'
 *     responses:
 *       200:
 *         description: Shipment charge calculation completed successfully
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
 *                   example: "Shipment charge calculation completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     calculationId:
 *                       type: string
 *                       example: "SCC_1721123456789_xyz789"
 *                     shipmentId:
 *                       type: string
 *                       example: "SH_1721123456789"
 *                     totalCharges:
 *                       type: number
 *                       example: 150.75
 *                     currency:
 *                       type: string
 *                       example: "INR"
 *                     partnerQuotes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partnerId:
 *                             type: string
 *                           partnerName:
 *                             type: string
 *                           totalCharge:
 *                             type: number
 *                           estimatedDeliveryTime:
 *                             type: string
 *                     chargeBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
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
  "/calculate-charges",
  chargeCalculationController.calculateShipmentCharges,
);

/**
 * @swagger
 * /api/v1/charges/validate:
 *   post:
 *     summary: Validate charge calculation against business rules
 *     description: Validate calculated charges against predefined business rules and constraints
 *     tags: [Charge Calculation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChargeValidationRequest'
 *     responses:
 *       200:
 *         description: Charge validation completed successfully
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
 *                   example: "Charge validation completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                       example: true
 *                     validationScore:
 *                       type: number
 *                       example: 85
 *                     warnings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           message:
 *                             type: string
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
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
router.post("/validate", chargeCalculationController.validateCharges);

/**
 * @swagger
 * /api/v1/charges/breakdown/{calculationId}:
 *   get:
 *     summary: Get charge calculation breakdown and analytics
 *     description: Retrieve detailed breakdown of a specific charge calculation
 *     tags: [Charge Calculation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: calculationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Calculation ID to retrieve breakdown for
 *         example: "SCC_1721123456789_xyz789"
 *     responses:
 *       200:
 *         description: Charge breakdown retrieved successfully
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
 *                   example: "Charge breakdown retrieved successfully"
 *                 data:
 *                   type: object
 *                   description: Detailed charge breakdown data
 *       400:
 *         description: Invalid calculation ID
 *       401:
 *         description: Unauthorized access
 *       404:
 *         description: Calculation not found or expired
 *       500:
 *         description: Internal server error
 */
router.get(
  "/breakdown/:calculationId",
  chargeCalculationController.getChargeBreakdown,
);

/**
 * @swagger
 * /api/v1/charges/cache/clear:
 *   delete:
 *     summary: Clear charge calculation cache
 *     description: Clear cached charge calculation data (admin only)
 *     tags: [Charge Calculation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pattern
 *         schema:
 *           type: string
 *         description: Cache pattern to clear (optional)
 *         example: "partner_*"
 *     responses:
 *       200:
 *         description: Cache cleared successfully
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
 *                   example: "Charge cache cleared successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     keysCleared:
 *                       type: number
 *                       example: 15
 *                     pattern:
 *                       type: string
 *                       example: "*"
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.delete("/cache/clear", chargeCalculationController.clearChargeCache);

/**
 * @swagger
 * /api/v1/charges/statistics:
 *   get:
 *     summary: Get charge calculation statistics and analytics
 *     description: Retrieve statistics and analytics for charge calculations
 *     tags: [Charge Calculation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: "24h"
 *         description: Time frame for statistics
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter by specific partner ID
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                   example: "Charge statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeframe:
 *                       type: string
 *                       example: "24h"
 *                     totalCalculations:
 *                       type: number
 *                       example: 1250
 *                     averageCalculationTime:
 *                       type: number
 *                       example: 1.2
 *                     cacheHitRate:
 *                       type: number
 *                       example: 75.5
 *                     topPartners:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get("/statistics", chargeCalculationController.getChargeStatistics);

module.exports = router;
