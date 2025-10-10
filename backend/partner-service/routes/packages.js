const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const PackageController = require("../controllers/packageController");
const { validateBody } = require("../middleware/validate");
const {
  partnerManagementLimiter,
  packageManagementLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * components:
 *   schemas:
 *     PackageCharge:
 *       type: object
 *       required:
 *         - packageName
 *         - baseWeight
 *         - baseCharge
 *       properties:
 *         packageName:
 *           type: string
 *           description: Name of the package type
 *           example: "Express Package"
 *         baseWeight:
 *           type: number
 *           format: float
 *           description: Base weight for the package (in kg)
 *           example: 2.0
 *         baseCharge:
 *           type: number
 *           format: float
 *           description: Base charge for the package
 *           example: 75.0
 *         addonWeight:
 *           type: number
 *           format: float
 *           description: Additional weight increment (in kg)
 *           example: 0.5
 *         addonCharge:
 *           type: number
 *           format: float
 *           description: Additional charge per increment
 *           example: 20.0
 *         fromZoneId:
 *           type: integer
 *           description: Source zone ID
 *           example: 1
 *         toZoneId:
 *           type: integer
 *           description: Destination zone ID
 *           example: 15
 *         status:
 *           type: boolean
 *           description: Active status of the package charge
 *           example: true
 *     PackageChargeCalculation:
 *       type: object
 *       required:
 *         - weight
 *         - fromZoneId
 *         - toZoneId
 *       properties:
 *         weight:
 *           type: number
 *           format: float
 *           description: Package weight in kg
 *           example: 3.5
 *         fromZoneId:
 *           type: integer
 *           description: Source zone ID
 *           example: 1
 *         toZoneId:
 *           type: integer
 *           description: Destination zone ID
 *           example: 15
 *         packageType:
 *           type: string
 *           description: Package type/name
 *           example: "Express Package"
 *     BulkPackageCharges:
 *       type: object
 *       required:
 *         - packages
 *       properties:
 *         packages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PackageCharge'
 *           description: Array of package charge configurations
 */

/**
 * @swagger
 * /api/v1/packages/charges:
 *   get:
 *     tags: [Package Management]
 *     summary: Get package charges with filtering
 *     description: Retrieve package charge configurations with optional filtering
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
 *         name: packageName
 *         schema:
 *           type: string
 *         description: Filter by package name
 *         example: "Express Package"
 *       - in: query
 *         name: fromZoneId
 *         schema:
 *           type: integer
 *         description: Filter by source zone ID
 *         example: 1
 *       - in: query
 *         name: toZoneId
 *         schema:
 *           type: integer
 *         description: Filter by destination zone ID
 *         example: 15
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
 *         description: Package charges retrieved successfully
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
 *                     packages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PackageCharge'
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
 *                   example: "Package charges retrieved successfully"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/charges",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  PackageController.getPackageCharges,
);

/**
 * @swagger
 * /api/v1/packages/charges:
 *   post:
 *     tags: [Package Management]
 *     summary: Create new package charge configuration
 *     description: Create a new package charge configuration for a partner
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
 *             $ref: '#/components/schemas/PackageCharge'
 *     responses:
 *       201:
 *         description: Package charge created successfully
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
 *                     package:
 *                       $ref: '#/components/schemas/PackageCharge'
 *                 message:
 *                   type: string
 *                   example: "Package charge created successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/charges",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  packageManagementLimiter,
  PackageController.createPackageCharge,
);

/**
 * @swagger
 * /api/v1/packages/charges/{packageId}:
 *   get:
 *     tags: [Package Management]
 *     summary: Get package charge by ID
 *     description: Retrieve a specific package charge configuration by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Package charge ID
 *         example: "pkg_12345"
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     responses:
 *       200:
 *         description: Package charge retrieved successfully
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
 *                     package:
 *                       $ref: '#/components/schemas/PackageCharge'
 *                 message:
 *                   type: string
 *                   example: "Package charge retrieved successfully"
 *       404:
 *         description: Package charge not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/charges/:packageId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  PackageController.getPackageChargeById,
);

/**
 * @swagger
 * /api/v1/packages/charges/{packageId}:
 *   put:
 *     tags: [Package Management]
 *     summary: Update package charge configuration
 *     description: Update an existing package charge configuration
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Package charge ID
 *         example: "pkg_12345"
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
 *             $ref: '#/components/schemas/PackageCharge'
 *     responses:
 *       200:
 *         description: Package charge updated successfully
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
 *                     package:
 *                       $ref: '#/components/schemas/PackageCharge'
 *                 message:
 *                   type: string
 *                   example: "Package charge updated successfully"
 *       400:
 *         description: Validation error
 *       404:
 *         description: Package charge not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put(
  "/charges/:packageId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  packageManagementLimiter,
  PackageController.updatePackageCharge,
);

/**
 * @swagger
 * /api/v1/packages/charges/{packageId}:
 *   delete:
 *     tags: [Package Management]
 *     summary: Delete package charge configuration
 *     description: Delete an existing package charge configuration
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Package charge ID
 *         example: "pkg_12345"
 *       - in: query
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *         example: "partner_001"
 *     responses:
 *       200:
 *         description: Package charge deleted successfully
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
 *                   example: "Package charge deleted successfully"
 *       404:
 *         description: Package charge not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/charges/:packageId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  packageManagementLimiter,
  PackageController.deletePackageCharge,
);

/**
 * @swagger
 * /api/v1/packages/charges/bulk:
 *   post:
 *     tags: [Package Management]
 *     summary: Create multiple package charges
 *     description: Create multiple package charge configurations in bulk
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
 *             $ref: '#/components/schemas/BulkPackageCharges'
 *           example:
 *             packages:
 *               - packageName: "Standard Package"
 *                 baseWeight: 1.0
 *                 baseCharge: 50.0
 *                 addonWeight: 0.5
 *                 addonCharge: 15.0
 *                 status: true
 *               - packageName: "Express Package"
 *                 baseWeight: 2.0
 *                 baseCharge: 75.0
 *                 addonWeight: 0.5
 *                 addonCharge: 20.0
 *                 fromZoneId: 1
 *                 toZoneId: 15
 *                 status: true
 *     responses:
 *       201:
 *         description: Bulk package charges created successfully
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
 *                       example: 2
 *                     failureCount:
 *                       type: integer
 *                       example: 0
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                 message:
 *                   type: string
 *                   example: "Bulk package charges created successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/charges/bulk",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  packageManagementLimiter,
  PackageController.createBulkPackageCharges,
);

/**
 * @swagger
 * /api/v1/packages/charges/calculate:
 *   post:
 *     tags: [Package Management]
 *     summary: Calculate package charges
 *     description: Calculate package charges for given weight and zones
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
 *             $ref: '#/components/schemas/PackageChargeCalculation'
 *     responses:
 *       200:
 *         description: Package charges calculated successfully
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
 *                     totalCharge:
 *                       type: number
 *                       format: float
 *                       example: 95.0
 *                     baseCharge:
 *                       type: number
 *                       format: float
 *                       example: 75.0
 *                     addonCharge:
 *                       type: number
 *                       format: float
 *                       example: 20.0
 *                     breakdown:
 *                       type: object
 *                 message:
 *                   type: string
 *                   example: "Package charges calculated successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/charges/calculate",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "own"),
  PackageController.calculatePackageCharges,
);

/**
 * @swagger
 * /api/v1/partners/{partnerId}/packages/charges:
 *   get:
 *     tags: [Package Management]
 *     summary: Get package charges by partner ID
 *     description: Retrieve all package charges for a specific partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
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
 *         description: Partner package charges retrieved successfully
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
 *                     packages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PackageCharge'
 *                     pagination:
 *                       type: object
 *                 message:
 *                   type: string
 *                   example: "Partner package charges retrieved successfully"
 *       404:
 *         description: Partner not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:partnerId/charges",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  PackageController.getPartnerPackageCharges,
);

module.exports = router;
