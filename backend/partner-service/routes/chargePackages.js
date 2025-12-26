/**
 * Charge Package Routes
 *
 * API endpoints for managing charge packages (WEIGHT, DISTANCE, GENERIC).
 * All routes require authentication and appropriate permissions.
 * Following auth-service patterns (controller-only, no inline logic).
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const chargePackageController = require("../controllers/chargePackageController");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const {
  chargePackages: schemas,
} = require("../validation/chargePackageSchemas");
const { chargePackageManagementLimiter } = require("../middleware/rateLimiter");

// ========================================
// SWAGGER COMPONENTS
// ========================================

/**
 * @swagger
 * components:
 *   schemas:
 *     ChargePackage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Package UUID
 *         partnerId:
 *           type: string
 *           description: Partner ID (CUID)
 *         name:
 *           type: string
 *           description: Package name (unique per partner)
 *         type:
 *           type: string
 *           enum: [WEIGHT, DISTANCE, GENERIC]
 *           description: Package type
 *         baseCharge:
 *           type: number
 *           description: Base charge amount
 *         baseUnit:
 *           type: number
 *           nullable: true
 *           description: Base unit (kg for WEIGHT, km for DISTANCE)
 *         addonUnit:
 *           type: number
 *           nullable: true
 *           description: Additional unit size
 *         addonCharge:
 *           type: number
 *           nullable: true
 *           description: Charge per addon unit
 *         appliesTo:
 *           type: string
 *           enum: [ANY, COD, PREPAID]
 *           description: Payment type filter (GENERIC only)
 *         calcType:
 *           type: string
 *           enum: [FLAT, PERCENTAGE_OF_COD, PERCENTAGE_OF_DECLARED_VALUE]
 *           description: Calculation type (GENERIC only)
 *         metadata:
 *           type: object
 *           nullable: true
 *           description: Additional metadata
 *         isActive:
 *           type: boolean
 *           description: Active status
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         partner:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             displayName:
 *               type: string
 *
 *     CreateChargePackageRequest:
 *       type: object
 *       required:
 *         - partnerIds
 *         - name
 *         - type
 *         - baseCharge
 *       properties:
 *         partnerIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Partner IDs to create package for
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         type:
 *           type: string
 *           enum: [WEIGHT, DISTANCE, GENERIC]
 *         baseCharge:
 *           type: number
 *           minimum: 0
 *         baseUnit:
 *           type: number
 *           minimum: 0
 *           description: Required for WEIGHT/DISTANCE
 *         addonUnit:
 *           type: number
 *           minimum: 0
 *           description: Required for WEIGHT/DISTANCE
 *         addonCharge:
 *           type: number
 *           minimum: 0
 *           description: Required for WEIGHT/DISTANCE
 *         appliesTo:
 *           type: string
 *           enum: [ANY, COD, PREPAID]
 *           description: For GENERIC type only
 *         calcType:
 *           type: string
 *           enum: [FLAT, PERCENTAGE_OF_COD, PERCENTAGE_OF_DECLARED_VALUE]
 *           description: For GENERIC type only
 *         metadata:
 *           type: object
 *         isActive:
 *           type: boolean
 *           default: true
 */

// ========================================
// ROUTES
// ========================================

/**
 * @swagger
 * /api/v1/charge-packages:
 *   post:
 *     tags: [Charge Packages]
 *     summary: Create charge packages for one or more partners
 *     description: Creates identical charge package configurations for multiple partners at once
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChargePackageRequest'
 *     responses:
 *       201:
 *         description: Packages created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     packages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ChargePackage'
 *                     summary:
 *                       type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Package with same name already exists for partner
 */
router.post(
  "/",
  chargePackageManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "create", "all"),
  validateBody(schemas.createChargePackage.body),
  chargePackageController.createChargePackage,
);

/**
 * @swagger
 * /api/v1/charge-packages:
 *   get:
 *     tags: [Charge Packages]
 *     summary: List charge packages
 *     description: Retrieve charge packages with filtering and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Filter by partner ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [WEIGHT, DISTANCE, GENERIC]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by package name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, type, baseCharge, createdAt, updatedAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of charge packages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     packages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ChargePackage'
 *                     pagination:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateQuery(schemas.listChargePackages.query),
  chargePackageController.listChargePackages,
);

/**
 * @swagger
 * /api/v1/charge-packages/partner/{partnerId}:
 *   get:
 *     tags: [Charge Packages]
 *     summary: Get packages by partner
 *     description: Get all charge packages for a specific partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [WEIGHT, DISTANCE, GENERIC]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Partner's packages
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/partner/:partnerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getPackagesByPartner.params),
  validateQuery(schemas.getPackagesByPartner.query),
  chargePackageController.getPackagesByPartner,
);

/**
 * @swagger
 * /api/v1/charge-packages/partner/{partnerId}/grouped:
 *   get:
 *     tags: [Charge Packages]
 *     summary: Get packages by partner grouped by type
 *     description: Get all charge packages for a partner, grouped by WEIGHT/DISTANCE/GENERIC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Grouped packages
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/partner/:partnerId/grouped",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getPackagesByPartner.params),
  chargePackageController.getPackagesByPartnerGrouped,
);

/**
 * @swagger
 * /api/v1/charge-packages/{id}:
 *   get:
 *     tags: [Charge Packages]
 *     summary: Get charge package by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Package details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     package:
 *                       $ref: '#/components/schemas/ChargePackage'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getChargePackage.params),
  chargePackageController.getChargePackageById,
);

/**
 * @swagger
 * /api/v1/charge-packages/{id}:
 *   put:
 *     tags: [Charge Packages]
 *     summary: Update charge package
 *     description: Update an existing charge package. Type cannot be changed.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               baseCharge:
 *                 type: number
 *               baseUnit:
 *                 type: number
 *               addonUnit:
 *                 type: number
 *               addonCharge:
 *                 type: number
 *               appliesTo:
 *                 type: string
 *               calcType:
 *                 type: string
 *               metadata:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Package updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Name conflict
 */
router.put(
  "/:id",
  chargePackageManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "update", "all"),
  validateParams(schemas.updateChargePackage.params),
  validateBody(schemas.updateChargePackage.body),
  chargePackageController.updateChargePackage,
);

/**
 * @swagger
 * /api/v1/charge-packages/{id}:
 *   delete:
 *     tags: [Charge Packages]
 *     summary: Delete (disable) charge package
 *     description: Soft-deletes a charge package by setting isActive to false
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Package disabled
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  "/:id",
  chargePackageManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "delete", "all"),
  validateParams(schemas.deleteChargePackage.params),
  chargePackageController.deleteChargePackage,
);

module.exports = router;
