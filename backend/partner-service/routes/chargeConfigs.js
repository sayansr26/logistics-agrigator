/**
 * Partner Charge Config Routes (Charges Engine v3)
 *
 * Per-partner charge config values CRUD + dangling-reference sweep.
 * Controller-only, no inline logic (auth-service pattern).
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const partnerChargeConfigController = require("../controllers/partnerChargeConfigController");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const {
  partnerChargeConfigs: schemas,
} = require("../validation/partnerChargeConfigSchemas");
const {
  chargesManagementLimiter,
  chargesReadLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * /api/v1/charge-configs/validate:
 *   get:
 *     tags: [ChargeConfigs]
 *     summary: Sweep all active configs for dangling zone/milestone/pincode-type references
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Validation findings
 */
router.get(
  "/validate",
  chargesReadLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  partnerChargeConfigController.validateAllConfigs,
);

/**
 * @swagger
 * /api/v1/charge-configs:
 *   post:
 *     tags: [ChargeConfigs]
 *     summary: Create a partner charge config
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  "/",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "create", "all"),
  validateBody(schemas.createConfig.body),
  partnerChargeConfigController.createConfig,
);

/**
 * @swagger
 * /api/v1/charge-configs:
 *   get:
 *     tags: [ChargeConfigs]
 *     summary: List partner charge configs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of configs
 */
router.get(
  "/",
  chargesReadLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateQuery(schemas.listConfigs.query),
  partnerChargeConfigController.listConfigs,
);

/**
 * @swagger
 * /api/v1/charge-configs/{id}:
 *   get:
 *     tags: [ChargeConfigs]
 *     summary: Get partner charge config by ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Config
 */
router.get(
  "/:id",
  chargesReadLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getConfig.params),
  partnerChargeConfigController.getConfigById,
);

/**
 * @swagger
 * /api/v1/charge-configs/{id}:
 *   put:
 *     tags: [ChargeConfigs]
 *     summary: Update partner charge config
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  "/:id",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "update", "all"),
  validateParams(schemas.updateConfig.params),
  validateBody(schemas.updateConfig.body),
  partnerChargeConfigController.updateConfig,
);

/**
 * @swagger
 * /api/v1/charge-configs/{id}:
 *   delete:
 *     tags: [ChargeConfigs]
 *     summary: Delete partner charge config
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
  "/:id",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "delete", "all"),
  validateParams(schemas.deleteConfig.params),
  partnerChargeConfigController.deleteConfig,
);

module.exports = router;
