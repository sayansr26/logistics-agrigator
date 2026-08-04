/**
 * Charge Definition Routes (Charges Engine v3)
 *
 * Dynamic charge catalog CRUD + versions + booking-question specs.
 * Controller-only, no inline logic (auth-service pattern).
 */

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const chargeDefinitionController = require("../controllers/chargeDefinitionController");
const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middleware/validate");
const {
  chargeDefinitions: schemas,
} = require("../validation/chargeDefinitionSchemas");
const {
  chargesManagementLimiter,
  chargesReadLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * /api/v1/charge-definitions/booking-questions:
 *   get:
 *     tags: [ChargeDefinitions]
 *     summary: Booking-question specs for the dynamic VAS section of the booking form
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partnerId
 *         schema:
 *           type: string
 *         description: Only questions with an active config for this partner
 *     responses:
 *       200:
 *         description: List of booking questions
 */
router.get(
  "/booking-questions",
  chargesReadLimiter,
  authMiddleware.authenticate,
  validateQuery(schemas.bookingQuestions.query),
  chargeDefinitionController.getBookingQuestions,
);

/**
 * @swagger
 * /api/v1/charge-definitions:
 *   post:
 *     tags: [ChargeDefinitions]
 *     summary: Create a charge definition
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
  validateBody(schemas.createDefinition.body),
  chargeDefinitionController.createDefinition,
);

/**
 * @swagger
 * /api/v1/charge-definitions:
 *   get:
 *     tags: [ChargeDefinitions]
 *     summary: List charge definitions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of charge definitions
 */
router.get(
  "/",
  chargesReadLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateQuery(schemas.listDefinitions.query),
  chargeDefinitionController.listDefinitions,
);

/**
 * @swagger
 * /api/v1/charge-definitions/{id}/versions:
 *   get:
 *     tags: [ChargeDefinitions]
 *     summary: Version history of a charge definition
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Version snapshots, newest first
 */
router.get(
  "/:id/versions",
  chargesReadLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getVersions.params),
  chargeDefinitionController.getDefinitionVersions,
);

/**
 * @swagger
 * /api/v1/charge-definitions/{id}:
 *   get:
 *     tags: [ChargeDefinitions]
 *     summary: Get charge definition by ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Charge definition
 */
router.get(
  "/:id",
  chargesReadLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  validateParams(schemas.getDefinition.params),
  chargeDefinitionController.getDefinitionById,
);

/**
 * @swagger
 * /api/v1/charge-definitions/{id}:
 *   put:
 *     tags: [ChargeDefinitions]
 *     summary: Update charge definition
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
  validateParams(schemas.updateDefinition.params),
  validateBody(schemas.updateDefinition.body),
  chargeDefinitionController.updateDefinition,
);

/**
 * @swagger
 * /api/v1/charge-definitions/{id}:
 *   delete:
 *     tags: [ChargeDefinitions]
 *     summary: Delete charge definition (system definitions cannot be deleted)
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
  validateParams(schemas.deleteDefinition.params),
  chargeDefinitionController.deleteDefinition,
);

module.exports = router;
