// Internal Routes - For inter-service communication
// These endpoints are protected by X-Internal-Request header validation

const express = require("express");
const router = express.Router();

// Controllers
const bootstrapController = require("../controllers/bootstrapController");

// Middleware
const { requireInternalRequest } = require("../middleware/internal");

/**
 * @swagger
 * tags:
 *   name: Internal
 *   description: Internal endpoints for inter-service communication
 */

/**
 * @swagger
 * /api/v1/internal/bootstrap-customer:
 *   post:
 *     summary: Bootstrap a new direct customer from signup
 *     description: Creates Customer, UserProfile, and CustomerUser records. Called by auth-service after user creation.
 *     tags: [Internal]
 *     security:
 *       - internalAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - email
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: The user ID from auth-service
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *                 description: Full name (will be split into first/last)
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               clientId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional client association
 *     responses:
 *       201:
 *         description: Customer bootstrapped successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized - missing internal request header
 *       409:
 *         description: Customer already exists
 */
router.post(
  "/bootstrap-customer",
  requireInternalRequest,
  bootstrapController.bootstrapDirectCustomer,
);

/**
 * @swagger
 * /api/v1/internal/bootstrap-customer/{userId}:
 *   delete:
 *     summary: Rollback bootstrap (delete customer records)
 *     description: Deletes Customer, UserProfile, and CustomerUser records. Used for cleanup on failed signup.
 *     tags: [Internal]
 *     security:
 *       - internalAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rollback completed
 *       403:
 *         description: Unauthorized - missing internal request header
 */
router.delete(
  "/bootstrap-customer/:userId",
  requireInternalRequest,
  bootstrapController.rollbackBootstrap,
);

/**
 * @swagger
 * /api/v1/internal/bootstrap-customer/{userId}/status:
 *   get:
 *     summary: Check bootstrap status for a user
 *     description: Returns whether the user has been bootstrapped (has customer/profile records)
 *     tags: [Internal]
 *     security:
 *       - internalAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bootstrap status
 *       403:
 *         description: Unauthorized - missing internal request header
 */
router.get(
  "/bootstrap-customer/:userId/status",
  requireInternalRequest,
  bootstrapController.checkBootstrapStatus,
);

module.exports = router;
