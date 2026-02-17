/**
 * Charge Discount Package Routes
 *
 * API endpoints for managing charge discount packages (partner + badge tier).
 * All routes require authentication and superadmin/admin role.
 * Following auth-service patterns (controller-only, no inline logic).
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const chargeDiscountPackageController = require("../controllers/chargeDiscountPackageController");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const {
  chargeDiscountPackages: schemas,
} = require("../validation/chargeDiscountPackageSchemas");
const { chargesManagementLimiter } = require("../middleware/rateLimiter");

// ========================================
// ROUTES
// ========================================

/**
 * @swagger
 * /api/v1/charge-discount-packages:
 *   post:
 *     tags: [Charge Discount Packages]
 *     summary: Create a charge discount package
 *     description: Create a new discount package for a partner + badge tier combination with per-rule discounts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [partnerId, name, badge, items]
 *             properties:
 *               partnerId:
 *                 type: string
 *               name:
 *                 type: string
 *               badge:
 *                 type: string
 *                 enum: [BASIC, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND]
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     chargeRuleId:
 *                       type: string
 *                       format: uuid
 *                     discountType:
 *                       type: string
 *                       enum: [FLAT, PERCENTAGE]
 *                     discountValue:
 *                       type: number
 *     responses:
 *       201:
 *         description: Package created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  validateBody(schemas.createPackage.body),
  chargeDiscountPackageController.createPackage,
);

/**
 * @swagger
 * /api/v1/charge-discount-packages:
 *   get:
 *     tags: [Charge Discount Packages]
 *     summary: List charge discount packages
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
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: badge
 *         schema:
 *           type: string
 *           enum: [BASIC, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of packages
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateQuery(schemas.listPackages.query),
  chargeDiscountPackageController.listPackages,
);

/**
 * @swagger
 * /api/v1/charge-discount-packages/{id}:
 *   get:
 *     tags: [Charge Discount Packages]
 *     summary: Get charge discount package by ID
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
 *       404:
 *         description: Not found
 */
router.get(
  "/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getPackage.params),
  chargeDiscountPackageController.getPackageById,
);

/**
 * @swagger
 * /api/v1/charge-discount-packages/{id}:
 *   put:
 *     tags: [Charge Discount Packages]
 *     summary: Update charge discount package
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
 *     responses:
 *       200:
 *         description: Package updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
router.put(
  "/:id",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  validateParams(schemas.updatePackage.params),
  validateBody(schemas.updatePackage.body),
  chargeDiscountPackageController.updatePackage,
);

/**
 * @swagger
 * /api/v1/charge-discount-packages/{id}:
 *   delete:
 *     tags: [Charge Discount Packages]
 *     summary: Delete charge discount package
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
 *         description: Package deleted
 *       404:
 *         description: Not found
 */
router.delete(
  "/:id",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "manage", "all"),
  validateParams(schemas.deletePackage.params),
  chargeDiscountPackageController.deletePackage,
);

module.exports = router;
