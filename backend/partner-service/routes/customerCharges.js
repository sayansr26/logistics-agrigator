const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const CustomerChargeController = require("../controllers/customerChargeController");
const { validateBody } = require("../middleware/validate");
const {
  partnerManagementLimiter,
  customerChargeManagementLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerCharge:
 *       type: object
 *       required:
 *         - type
 *         - chargeType
 *         - value
 *       properties:
 *         customerId:
 *           type: string
 *           description: Customer ID (optional for global charges)
 *           example: "customer_123"
 *         type:
 *           type: string
 *           enum: [fsc, cod, insurance, handling, pickup, delivery, fragile, oversized, priority, weekend, remote, other]
 *           description: Type of charge
 *           example: "fsc"
 *         chargeType:
 *           type: string
 *           enum: [percentage, flat, per_kg, slab, tiered]
 *           description: Calculation method for the charge
 *           example: "percentage"
 *         value:
 *           type: number
 *           format: float
 *           description: Charge value (percentage, flat amount, or per kg rate)
 *           example: 3.5
 *         minKg:
 *           type: number
 *           format: float
 *           description: Minimum weight threshold
 *           example: 0.5
 *         maxKg:
 *           type: number
 *           format: float
 *           description: Maximum weight threshold
 *           example: 10.0
 *         minValue:
 *           type: number
 *           format: float
 *           description: Minimum shipment value threshold
 *           example: 100.0
 *         maxValue:
 *           type: number
 *           format: float
 *           description: Maximum shipment value threshold
 *           example: 10000.0
 *         otherChargeType:
 *           type: string
 *           description: Description for other charge types
 *           example: "handling"
 *         status:
 *           type: boolean
 *           description: Active status of the charge
 *           example: true
 *     CustomerChargeCalculation:
 *       type: object
 *       required:
 *         - customerId
 *         - shipmentValue
 *         - weight
 *       properties:
 *         customerId:
 *           type: string
 *           description: Customer ID
 *           example: "customer_123"
 *         shipmentValue:
 *           type: number
 *           format: float
 *           description: Shipment value for calculation
 *           example: 5000.0
 *         weight:
 *           type: number
 *           format: float
 *           description: Package weight in kg
 *           example: 2.5
 *         chargeTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Types of charges to calculate
 *           example: ["fsc", "cod", "insurance"]
 *         additionalParams:
 *           type: object
 *           description: Additional calculation parameters
 *     BulkCustomerCharges:
 *       type: object
 *       required:
 *         - charges
 *       properties:
 *         charges:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CustomerCharge'
 *           description: Array of customer charge configurations
 *     CustomerChargePreview:
 *       type: object
 *       required:
 *         - type
 *         - chargeType
 *         - value
 *         - shipmentValue
 *         - weight
 *       properties:
 *         customerId:
 *           type: string
 *           description: Customer ID (optional for preview)
 *           example: "customer_123"
 *         type:
 *           type: string
 *           enum: [fsc, cod, insurance, handling, pickup, delivery, fragile, oversized, priority, weekend, remote, other]
 *           description: Type of charge
 *           example: "fsc"
 *         chargeType:
 *           type: string
 *           enum: [percentage, flat, per_kg, slab, tiered]
 *           description: Calculation method for the charge
 *           example: "percentage"
 *         value:
 *           type: number
 *           format: float
 *           description: Charge value
 *           example: 3.5
 *         shipmentValue:
 *           type: number
 *           format: float
 *           description: Shipment value for preview calculation
 *           example: 5000.0
 *         weight:
 *           type: number
 *           format: float
 *           description: Package weight in kg
 *           example: 2.5
 *         minKg:
 *           type: number
 *           format: float
 *           description: Minimum weight threshold
 *           example: 0.5
 *         maxKg:
 *           type: number
 *           format: float
 *           description: Maximum weight threshold
 *           example: 10.0
 */

/**
 * @swagger
 * /api/v1/customer-charges:
 *   get:
 *     tags: [Customer Charge Management]
 *     summary: Get customer charge configurations
 *     description: Retrieve customer charge configurations with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter by partner ID
 *         example: "partner_001"
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Filter by customer ID
 *         example: "customer_123"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [fsc, cod, insurance, handling, pickup, delivery, fragile, oversized, priority, weekend, remote, other]
 *         description: Filter by charge type
 *         example: "fsc"
 *       - in: query
 *         name: chargeType
 *         schema:
 *           type: string
 *           enum: [percentage, flat, per_kg, slab, tiered]
 *         description: Filter by calculation type
 *         example: "percentage"
 *       - in: query
 *         name: status
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Customer charges retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     charges:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CustomerCharge'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                 message:
 *                   type: string
 *                   example: "Customer charges retrieved successfully"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations"]),
  CustomerChargeController.getCustomerCharges,
);

/**
 * @swagger
 * /api/v1/customer-charges:
 *   post:
 *     tags: [Customer Charge Management]
 *     summary: Create new customer charge configuration
 *     description: Create a new customer charge configuration for a partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerCharge'
 *           example:
 *             customerId: "customer_123"
 *             type: "fsc"
 *             chargeType: "percentage"
 *             value: 3.5
 *             minKg: 10
 *             maxKg: 15.0
 *             otherChargeType: "handling"
 *             status: true
 *     responses:
 *       201:
 *         description: Customer charge created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     charge:
 *                       $ref: '#/components/schemas/CustomerCharge'
 *                 message:
 *                   type: string
 *                   example: "Customer charge created successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations"]),
  customerChargeManagementLimiter,
  CustomerChargeController.createCustomerCharge,
);

/**
 * @swagger
 * /api/v1/customer-charges/{chargeId}:
 *   get:
 *     tags: [Customer Charge Management]
 *     summary: Get customer charge by ID
 *     description: Retrieve a specific customer charge configuration by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chargeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer charge ID
 *         example: "charge_12345"
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     responses:
 *       200:
 *         description: Customer charge retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     charge:
 *                       $ref: '#/components/schemas/CustomerCharge'
 *                 message:
 *                   type: string
 *                   example: "Customer charge retrieved successfully"
 *       404:
 *         description: Customer charge not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:chargeId",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations"]),
  CustomerChargeController.getCustomerChargeById,
);

/**
 * @swagger
 * /api/v1/customer-charges/{chargeId}:
 *   put:
 *     tags: [Customer Charge Management]
 *     summary: Update customer charge configuration
 *     description: Update an existing customer charge configuration
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chargeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer charge ID
 *         example: "charge_12345"
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerCharge'
 *     responses:
 *       200:
 *         description: Customer charge updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     charge:
 *                       $ref: '#/components/schemas/CustomerCharge'
 *                 message:
 *                   type: string
 *                   example: "Customer charge updated successfully"
 *       400:
 *         description: Validation error
 *       404:
 *         description: Customer charge not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:chargeId",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations"]),
  customerChargeManagementLimiter,
  CustomerChargeController.updateCustomerCharge,
);

/**
 * @swagger
 * /api/v1/customer-charges/{chargeId}:
 *   delete:
 *     tags: [Customer Charge Management]
 *     summary: Delete customer charge configuration
 *     description: Delete an existing customer charge configuration
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chargeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer charge ID
 *         example: "charge_12345"
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     responses:
 *       200:
 *         description: Customer charge deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Customer charge deleted successfully"
 *       404:
 *         description: Customer charge not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:chargeId",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations"]),
  customerChargeManagementLimiter,
  CustomerChargeController.deleteCustomerCharge,
);

/**
 * @swagger
 * /api/v1/customer-charges/bulk:
 *   post:
 *     tags: [Customer Charge Management]
 *     summary: Create multiple customer charges
 *     description: Create multiple customer charge configurations in bulk
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkCustomerCharges'
 *           example:
 *             charges:
 *               - type: "fsc"
 *                 chargeType: "percentage"
 *                 value: 3.5
 *                 minKg: 0.5
 *                 maxKg: 10.0
 *               - customerId: "customer_123"
 *                 type: "cod"
 *                 chargeType: "flat"
 *                 value: 25.0
 *               - type: "insurance"
 *                 chargeType: "percentage"
 *                 value: 0.5
 *                 minKg: 0.1
 *                 maxKg: 50.0
 *     responses:
 *       201:
 *         description: Bulk customer charges created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     successCount:
 *                       type: integer
 *                       example: 3
 *                     failureCount:
 *                       type: integer
 *                       example: 0
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                 message:
 *                   type: string
 *                   example: "Bulk customer charges created successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/bulk",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations"]),
  customerChargeManagementLimiter,
  CustomerChargeController.createBulkCustomerCharges,
);

/**
 * @swagger
 * /api/v1/customer-charges/calculate:
 *   post:
 *     tags: [Customer Charge Management]
 *     summary: Calculate customer charges
 *     description: Calculate customer charges for given parameters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerChargeCalculation'
 *     responses:
 *       200:
 *         description: Customer charges calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCharges:
 *                       type: number
 *                       format: float
 *                       example: 200.5
 *                     chargeBreakdown:
 *                       type: object
 *                       properties:
 *                         fsc:
 *                           type: number
 *                           format: float
 *                           example: 175.0
 *                         cod:
 *                           type: number
 *                           format: float
 *                           example: 25.0
 *                         insurance:
 *                           type: number
 *                           format: float
 *                           example: 0.5
 *                 message:
 *                   type: string
 *                   example: "Customer charges calculated successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/calculate",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations", "client"]),
  CustomerChargeController.calculateCustomerCharges,
);

/**
 * @swagger
 * /api/v1/customer-charges/preview:
 *   post:
 *     tags: [Customer Charge Management]
 *     summary: Preview customer charge calculation
 *     description: Preview customer charge calculation without saving the configuration
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerChargePreview'
 *     responses:
 *       200:
 *         description: Customer charge preview calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     previewCharge:
 *                       type: number
 *                       format: float
 *                       example: 175.0
 *                     calculationDetails:
 *                       type: object
 *                 message:
 *                   type: string
 *                   example: "Customer charge preview calculated successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/preview",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations", "client"]),
  CustomerChargeController.previewCustomerCharges,
);

/**
 * @swagger
 * /api/v1/customer-charges/types:
 *   get:
 *     tags: [Customer Charge Management]
 *     summary: Get available charge types
 *     description: Retrieve available charge types and their configurations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     responses:
 *       200:
 *         description: Charge types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     types:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: "fsc"
 *                           displayName:
 *                             type: string
 *                             example: "Fuel Surcharge"
 *                           description:
 *                             type: string
 *                             example: "Additional fuel cost charge"
 *                           supportedCalculationTypes:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["percentage", "flat"]
 *                 message:
 *                   type: string
 *                   example: "Charge types retrieved successfully"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/types",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations", "client"]),
  CustomerChargeController.getChargeTypes,
);

/**
 * @swagger
 * /api/v1/customers/{customerId}/charges:
 *   get:
 *     tags: [Customer Charge Management]
 *     summary: Get customer charges by customer ID
 *     description: Retrieve all charges for a specific customer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *         example: "customer_123"
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *       - in: query
 *         name: status
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by charge type
 *         example: "fsc"
 *     responses:
 *       200:
 *         description: Customer-specific charges retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     charges:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CustomerCharge'
 *                 message:
 *                   type: string
 *                   example: "Customer-specific charges retrieved successfully"
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/customers/:customerId/charges",
  authMiddleware.authenticate,
  authMiddleware.authorize(["admin", "operations", "client"]),
  CustomerChargeController.getCustomerSpecificCharges,
);

module.exports = router;
