/**
 * AI Charge Routes (Charges Engine v3)
 *
 * Mounted at /api/v1/charge-configs/ai — MUST be mounted before the
 * charge-configs router or its /:id route would capture "ai".
 *
 * explain-quote and cod-risk are available to any authenticated user
 * (outlets use them from the booking UI); config drafting, legacy import,
 * suggestion review, and anomaly scans are admin-level (partner permissions).
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const aiChargeController = require("../controllers/aiChargeController");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const { aiCharges: schemas } = require("../validation/aiChargeSchemas");
const {
  chargesManagementLimiter,
  chargesReadLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * /api/v1/charge-configs/ai/draft-from-text:
 *   post:
 *     tags: [AI Charges]
 *     summary: Draft charge configs from a natural-language description (stored for review)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/draft-from-text",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "create", "all"),
  validateBody(schemas.draftFromText.body),
  aiChargeController.draftFromText,
);

/**
 * @swagger
 * /api/v1/charge-configs/ai/import-legacy:
 *   post:
 *     tags: [AI Charges]
 *     summary: Convert a legacy charge-rules export into draft v3 configs (stored for review)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/import-legacy",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "create", "all"),
  validateBody(schemas.importLegacy.body),
  aiChargeController.importLegacy,
);

/**
 * @swagger
 * /api/v1/charge-configs/ai/suggestions:
 *   get:
 *     tags: [AI Charges]
 *     summary: List AI config suggestions (review inbox)
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/suggestions",
  chargesReadLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateQuery(schemas.listSuggestions.query),
  aiChargeController.listSuggestions,
);

/**
 * @swagger
 * /api/v1/charge-configs/ai/suggestions/{id}/approve:
 *   post:
 *     tags: [AI Charges]
 *     summary: Approve a pending suggestion (materializes definitions/configs)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/suggestions/:id/approve",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "create", "all"),
  validateParams(schemas.suggestionAction.params),
  aiChargeController.approveSuggestion,
);

/**
 * @swagger
 * /api/v1/charge-configs/ai/suggestions/{id}/reject:
 *   post:
 *     tags: [AI Charges]
 *     summary: Reject a pending suggestion
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/suggestions/:id/reject",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "update", "all"),
  validateParams(schemas.suggestionAction.params),
  aiChargeController.rejectSuggestion,
);

/**
 * @swagger
 * /api/v1/charge-configs/ai/explain-quote:
 *   post:
 *     tags: [AI Charges]
 *     summary: Plain-language explanation of a quote breakdown
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/explain-quote",
  chargesReadLimiter,
  authMiddleware.authenticate,
  validateBody(schemas.explainQuote.body),
  aiChargeController.explainQuote,
);

/**
 * @swagger
 * /api/v1/charge-configs/ai/cod-risk:
 *   post:
 *     tags: [AI Charges]
 *     summary: Predict COD delivery risk (degrades to band UNKNOWN when AI is down)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/cod-risk",
  chargesReadLimiter,
  authMiddleware.authenticate,
  validateBody(schemas.codRisk.body),
  aiChargeController.codRisk,
);

/**
 * @swagger
 * /api/v1/charge-configs/ai/anomaly-scan:
 *   post:
 *     tags: [AI Charges]
 *     summary: Audit active charge configs for anomalies (findings land in the suggestion inbox)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/anomaly-scan",
  chargesManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateBody(schemas.anomalyScan.body),
  aiChargeController.anomalyScan,
);

module.exports = router;
