/**
 * Charges Rule Routes
 *
 * API endpoints for managing charge rules (PARTNER_CHARGES_TYPE, GEOLOGICAL, ADDON).
 * All routes require authentication and superadmin/admin role.
 * Following auth-service patterns (controller-only, no inline logic).
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const chargesController = require("../controllers/chargesController");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const { chargeRules: schemas } = require("../validation/chargesSchemas");
const { chargesManagementLimiter } = require("../middleware/rateLimiter");

// ========================================
// ROUTES
// ========================================

/**
 * @swagger
 * /api/v1/charges:
 *   post:
 *     tags: [Charges]
 *     summary: Create a charge rule
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Charge rule created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "create", "all"),
  validateBody(schemas.createChargeRule.body),
  chargesController.createChargeRule,
);

/**
 * @swagger
 * /api/v1/charges:
 *   get:
 *     tags: [Charges]
 *     summary: List charge rules
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
 *         name: kind
 *         schema:
 *           type: string
 *           enum: [PARTNER_CHARGES_TYPE, GEOLOGICAL, ADDON]
 *       - in: query
 *         name: base
 *         schema:
 *           type: string
 *           enum: [INVOICE_VALUE, WEIGHT, ZONE_TO_ZONE_WEIGHT, DISTANCE_BASE_WEIGHT]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of charge rules
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateQuery(schemas.listChargeRules.query),
  chargesController.listChargeRules,
);

/**
 * @swagger
 * /api/v1/charges/{id}:
 *   get:
 *     tags: [Charges]
 *     summary: Get charge rule by ID
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
 *         description: Charge rule details
 *       404:
 *         description: Not found
 */
router.get(
  "/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getChargeRule.params),
  chargesController.getChargeRuleById,
);

/**
 * @swagger
 * /api/v1/charges/{id}:
 *   put:
 *     tags: [Charges]
 *     summary: Update charge rule
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
 *         description: Charge rule updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
router.put(
  "/:id",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "update", "all"),
  validateParams(schemas.updateChargeRule.params),
  validateBody(schemas.updateChargeRule.body),
  chargesController.updateChargeRule,
);

/**
 * @swagger
 * /api/v1/charges/{id}:
 *   delete:
 *     tags: [Charges]
 *     summary: Delete (disable) charge rule
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
 *         description: Charge rule disabled
 *       404:
 *         description: Not found
 */
router.delete(
  "/:id",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "delete", "all"),
  validateParams(schemas.deleteChargeRule.params),
  chargesController.deleteChargeRule,
);

module.exports = router;
