const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const DiscountController = require("../controllers/discountController");
const { validateBody } = require("../middleware/validate");
const {
  partnerManagementLimiter,
  discountManagementLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * components:
 *   schemas:
 *     Discount:
 *       type: object
 *       required:
 *         - partnerId
 *         - discountName
 *         - discountType
 *         - applicableOn
 *         - discountValue
 *       properties:
 *         discountId:
 *           type: string
 *           description: Unique discount identifier
 *           example: "DISC_001"
 *         partnerId:
 *           type: string
 *           description: Partner ID this discount belongs to
 *           example: "PARTNER_123"
 *         discountName:
 *           type: string
 *           description: Name of the discount
 *           example: "New Customer Discount"
 *         discountType:
 *           type: string
 *           enum: [PERCENTAGE, FLAT, TIERED, BUY_X_GET_Y, MINIMUM_ORDER]
 *           description: Type of discount
 *           example: "PERCENTAGE"
 *         applicableOn:
 *           type: string
 *           enum: [PACKAGE, CUSTOMER_CHARGE, TOTAL, SHIPPING, COD]
 *           description: What the discount applies to
 *           example: "TOTAL"
 *         discountValue:
 *           type: number
 *           format: float
 *           description: Discount value (percentage or flat amount)
 *           example: 15.0
 *         conditions:
 *           type: object
 *           description: Discount conditions and rules
 *           properties:
 *             minimumOrderValue:
 *               type: number
 *               format: float
 *               example: 500.0
 *             maximumDiscountAmount:
 *               type: number
 *               format: float
 *               example: 100.0
 *             applicableZones:
 *               type: array
 *               items:
 *                 type: integer
 *               example: [1, 2, 3]
 *             customerTypes:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["NEW", "PREMIUM"]
 *         validFrom:
 *           type: string
 *           format: date-time
 *           description: Discount valid from date
 *           example: "2024-01-01T00:00:00Z"
 *         validTo:
 *           type: string
 *           format: date-time
 *           description: Discount valid until date
 *           example: "2024-12-31T23:59:59Z"
 *         isActive:
 *           type: boolean
 *           description: Whether the discount is currently active
 *           example: true
 *         usageLimit:
 *           type: integer
 *           description: Maximum number of times this discount can be used
 *           example: 1000
 *         usageCount:
 *           type: integer
 *           description: Current usage count
 *           example: 150
 *         createdBy:
 *           type: string
 *           description: User who created the discount
 *           example: "user_123"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *           example: "2024-01-01T10:00:00Z"
 *         updatedBy:
 *           type: string
 *           description: User who last updated the discount
 *           example: "user_456"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2024-01-15T14:30:00Z"
 *     DiscountCalculation:
 *       type: object
 *       required:
 *         - partnerId
 *         - baseAmount
 *         - applicableOn
 *       properties:
 *         partnerId:
 *           type: string
 *           description: Partner ID
 *           example: "PARTNER_123"
 *         baseAmount:
 *           type: number
 *           format: float
 *           description: Base amount to calculate discount on
 *           example: 1000.0
 *         applicableOn:
 *           type: string
 *           enum: [PACKAGE, CUSTOMER_CHARGE, TOTAL, SHIPPING, COD]
 *           description: What the discount applies to
 *           example: "TOTAL"
 *         conditions:
 *           type: object
 *           description: Additional conditions for calculation
 *           properties:
 *             customerType:
 *               type: string
 *               example: "PREMIUM"
 *             zoneId:
 *               type: integer
 *               example: 5
 *             orderDate:
 *               type: string
 *               format: date-time
 *               example: "2024-01-15T10:00:00Z"
 *     DiscountCalculationResult:
 *       type: object
 *       properties:
 *         baseAmount:
 *           type: number
 *           format: float
 *           description: Original base amount
 *           example: 1000.0
 *         applicableDiscounts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               discountId:
 *                 type: string
 *                 example: "DISC_001"
 *               discountName:
 *                 type: string
 *                 example: "New Customer Discount"
 *               discountType:
 *                 type: string
 *                 example: "PERCENTAGE"
 *               discountValue:
 *                 type: number
 *                 format: float
 *                 example: 15.0
 *               calculatedDiscount:
 *                 type: number
 *                 format: float
 *                 example: 150.0
 *         totalDiscount:
 *           type: number
 *           format: float
 *           description: Total discount amount
 *           example: 150.0
 *         finalAmount:
 *           type: number
 *           format: float
 *           description: Final amount after discount
 *           example: 850.0
 *         discountBreakdown:
 *           type: object
 *           description: Detailed breakdown of discount calculations
 *     DiscountAnalytics:
 *       type: object
 *       properties:
 *         totalDiscounts:
 *           type: integer
 *           description: Total number of discounts
 *           example: 25
 *         activeDiscounts:
 *           type: integer
 *           description: Number of currently active discounts
 *           example: 18
 *         totalSavings:
 *           type: number
 *           format: float
 *           description: Total savings provided by discounts
 *           example: 15750.50
 *         averageDiscountPercentage:
 *           type: number
 *           format: float
 *           description: Average discount percentage
 *           example: 12.5
 *         topDiscounts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               discountId:
 *                 type: string
 *                 example: "DISC_001"
 *               discountName:
 *                 type: string
 *                 example: "Premium Customer Discount"
 *               usageCount:
 *                 type: integer
 *                 example: 450
 *               totalSavings:
 *                 type: number
 *                 format: float
 *                 example: 8500.0
 *         discountsByType:
 *           type: object
 *           properties:
 *             PERCENTAGE:
 *               type: integer
 *               example: 15
 *             FLAT:
 *               type: integer
 *               example: 8
 *             TIERED:
 *               type: integer
 *               example: 2
 *     BulkDiscountRequest:
 *       type: object
 *       required:
 *         - discounts
 *       properties:
 *         discounts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Discount'
 *           description: Array of discount objects to create
 *           minItems: 1
 *           maxItems: 100
 *     BulkDiscountResponse:
 *       type: object
 *       properties:
 *         successful:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               discountId:
 *                 type: string
 *                 example: "DISC_001"
 *               discountName:
 *                 type: string
 *                 example: "Bulk Discount 1"
 *               status:
 *                 type: string
 *                 example: "CREATED"
 *         failed:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               index:
 *                 type: integer
 *                 example: 2
 *               discountName:
 *                 type: string
 *                 example: "Invalid Discount"
 *               error:
 *                 type: string
 *                 example: "Invalid discount type"
 *         summary:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 10
 *             successful:
 *               type: integer
 *               example: 8
 *             failed:
 *               type: integer
 *               example: 2
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Discounts
 *   description: Discount management and configuration operations
 */

/**
 * @swagger
 * /api/v1/discounts:
 *   get:
 *     summary: Get discounts with filtering options
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter by partner ID
 *         example: "PARTNER_123"
 *       - in: query
 *         name: discountType
 *         schema:
 *           type: string
 *           enum: [PERCENTAGE, FLAT, TIERED, BUY_X_GET_Y, MINIMUM_ORDER]
 *         description: Filter by discount type
 *         example: "PERCENTAGE"
 *       - in: query
 *         name: applicableOn
 *         schema:
 *           type: string
 *           enum: [PACKAGE, CUSTOMER_CHARGE, TOTAL, SHIPPING, COD]
 *         description: Filter by what discount applies to
 *         example: "TOTAL"
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *       - in: query
 *         name: validFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by valid from date
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: validTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by valid to date
 *         example: "2024-12-31T23:59:59Z"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Discounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discounts retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     discounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Discount'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           example: 150
 *                         totalPages:
 *                           type: integer
 *                           example: 8
 *       400:
 *         description: Bad request - Invalid parameters
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Create a new discount
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Discount'
 *           example:
 *             partnerId: "PARTNER_123"
 *             discountName: "New Customer Discount"
 *             discountType: "PERCENTAGE"
 *             applicableOn: "TOTAL"
 *             discountValue: 15.0
 *             conditions:
 *               minimumOrderValue: 500.0
 *               maximumDiscountAmount: 100.0
 *               customerTypes: ["NEW"]
 *             validFrom: "2024-01-01T00:00:00Z"
 *             validTo: "2024-12-31T23:59:59Z"
 *             isActive: true
 *             usageLimit: 1000
 *     responses:
 *       201:
 *         description: Discount created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discount created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Discount'
 *       400:
 *         description: Bad request - Invalid discount data
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       409:
 *         description: Conflict - Discount already exists
 *       500:
 *         description: Internal server error
 */
router.get("/", authMiddleware.authenticate, DiscountController.getDiscounts);
router.post(
  "/",
  authMiddleware.authenticate,
  discountManagementLimiter,
  DiscountController.createDiscount,
);

/**
 * @swagger
 * /api/v1/discounts/bulk:
 *   post:
 *     summary: Create multiple discounts in bulk
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkDiscountRequest'
 *           example:
 *             discounts:
 *               - partnerId: "PARTNER_123"
 *                 discountName: "Bulk Discount 1"
 *                 discountType: "PERCENTAGE"
 *                 applicableOn: "TOTAL"
 *                 discountValue: 10.0
 *                 validFrom: "2024-01-01T00:00:00Z"
 *                 validTo: "2024-12-31T23:59:59Z"
 *                 isActive: true
 *               - partnerId: "PARTNER_123"
 *                 discountName: "Bulk Discount 2"
 *                 discountType: "FLAT"
 *                 applicableOn: "SHIPPING"
 *                 discountValue: 50.0
 *                 validFrom: "2024-01-01T00:00:00Z"
 *                 validTo: "2024-12-31T23:59:59Z"
 *                 isActive: true
 *     responses:
 *       201:
 *         description: Bulk discount creation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bulk discount creation completed"
 *                 data:
 *                   $ref: '#/components/schemas/BulkDiscountResponse'
 *       400:
 *         description: Bad request - Invalid discount data or too many discounts
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Internal server error
 */
router.post(
  "/bulk",
  authMiddleware.authenticate,
  discountManagementLimiter,
  DiscountController.bulkCreateDiscounts,
);

/**
 * @swagger
 * /api/v1/discounts/calculate:
 *   post:
 *     summary: Calculate discount for given parameters
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DiscountCalculation'
 *           example:
 *             partnerId: "PARTNER_123"
 *             baseAmount: 1000.0
 *             applicableOn: "TOTAL"
 *             conditions:
 *               customerType: "PREMIUM"
 *               zoneId: 5
 *               orderDate: "2024-01-15T10:00:00Z"
 *     responses:
 *       200:
 *         description: Discount calculation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discount calculation completed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/DiscountCalculationResult'
 *       400:
 *         description: Bad request - Invalid calculation parameters
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Internal server error
 */
router.post(
  "/calculate",
  authMiddleware.authenticate,
  DiscountController.calculateDiscount,
);

/**
 * @swagger
 * /api/v1/discounts/active:
 *   get:
 *     summary: Get active discounts for a partner
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID to get active discounts for
 *         example: "PARTNER_123"
 *       - in: query
 *         name: applicableOn
 *         schema:
 *           type: string
 *           enum: [PACKAGE, CUSTOMER_CHARGE, TOTAL, SHIPPING, COD]
 *         description: Filter by what discount applies to
 *         example: "TOTAL"
 *     responses:
 *       200:
 *         description: Active discounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Active discounts retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     discounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Discount'
 *       400:
 *         description: Bad request - Partner ID is required
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Internal server error
 */
router.get(
  "/active",
  authMiddleware.authenticate,
  DiscountController.getActiveDiscounts,
);

/**
 * @swagger
 * /api/v1/discounts/analytics:
 *   get:
 *     summary: Get discount performance analytics
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter analytics by partner ID
 *         example: "PARTNER_123"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics period
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics period
 *         example: "2024-01-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Discount analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discount analytics retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/DiscountAnalytics'
 *       400:
 *         description: Bad request - Invalid date range
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Internal server error
 */
router.get(
  "/analytics",
  authMiddleware.authenticate,
  DiscountController.getDiscountAnalytics,
);

/**
 * @swagger
 * /api/v1/discounts/validate-conflicts:
 *   post:
 *     summary: Validate discount conflicts before creation
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partnerId
 *               - discountData
 *             properties:
 *               partnerId:
 *                 type: string
 *                 description: Partner ID
 *                 example: "PARTNER_123"
 *               discountData:
 *                 $ref: '#/components/schemas/Discount'
 *           example:
 *             partnerId: "PARTNER_123"
 *             discountData:
 *               discountName: "Test Discount"
 *               discountType: "PERCENTAGE"
 *               applicableOn: "TOTAL"
 *               discountValue: 20.0
 *               validFrom: "2024-01-01T00:00:00Z"
 *               validTo: "2024-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Discount conflict validation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discount conflict validation completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasConflicts:
 *                       type: boolean
 *                       example: false
 *                     conflicts:
 *                       type: array
 *                       items:
 *                         type: object
 *                       example: []
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *                     validationPassed:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Bad request - Invalid validation data
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Internal server error
 */
router.post(
  "/validate-conflicts",
  authMiddleware.authenticate,
  DiscountController.validateDiscountConflicts,
);

/**
 * @swagger
 * /api/v1/discounts/{id}:
 *   get:
 *     summary: Get discount details by ID
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Discount ID
 *         example: "DISC_001"
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Partner ID for additional filtering
 *         example: "PARTNER_123"
 *     responses:
 *       200:
 *         description: Discount details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discount details retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Discount'
 *       400:
 *         description: Bad request - Invalid discount ID
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       404:
 *         description: Not found - Discount not found
 *       500:
 *         description: Internal server error
 *   put:
 *     summary: Update an existing discount
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Discount ID
 *         example: "DISC_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               discountName:
 *                 type: string
 *                 example: "Updated Discount Name"
 *               discountValue:
 *                 type: number
 *                 format: float
 *                 example: 20.0
 *               conditions:
 *                 type: object
 *                 properties:
 *                   minimumOrderValue:
 *                     type: number
 *                     format: float
 *                     example: 750.0
 *               isActive:
 *                 type: boolean
 *                 example: false
 *           example:
 *             discountName: "Updated New Customer Discount"
 *             discountValue: 20.0
 *             conditions:
 *               minimumOrderValue: 750.0
 *               maximumDiscountAmount: 150.0
 *             isActive: true
 *     responses:
 *       200:
 *         description: Discount updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discount updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Discount'
 *       400:
 *         description: Bad request - Invalid update data
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       404:
 *         description: Not found - Discount not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete a discount
 *     tags: [Discounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Discount ID
 *         example: "DISC_001"
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Partner ID for additional validation
 *         example: "PARTNER_123"
 *     responses:
 *       200:
 *         description: Discount deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Discount deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Discount deleted successfully"
 *       400:
 *         description: Bad request - Invalid discount ID
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       404:
 *         description: Not found - Discount not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id",
  authMiddleware.authenticate,
  DiscountController.getDiscountById,
);
router.put(
  "/:id",
  authMiddleware.authenticate,
  discountManagementLimiter,
  DiscountController.updateDiscount,
);
router.delete(
  "/:id",
  authMiddleware.authenticate,
  discountManagementLimiter,
  DiscountController.deleteDiscount,
);

module.exports = router;
