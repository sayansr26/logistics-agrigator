// Internal Routes - For inter-service communication
// These endpoints are protected by X-Internal-Request header validation

const express = require("express");
const router = express.Router();

// Controllers
const bootstrapController = require("../controllers/bootstrapController");
const internalOutletController = require("../controllers/internalOutletController");

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
 * /api/v1/internal/bootstrap-user:
 *   post:
 *     summary: Bootstrap a new user profile from signup
 *     description: Creates UserProfile record. Called by auth-service after user creation.
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
 *         description: User profile bootstrapped successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized - missing internal request header
 *       409:
 *         description: User profile already exists
 */
router.post(
  "/bootstrap-user",
  requireInternalRequest,
  bootstrapController.bootstrapUser,
);

/**
 * @swagger
 * /api/v1/internal/bootstrap-user/{userId}:
 *   delete:
 *     summary: Rollback bootstrap (delete user profile records)
 *     description: Deletes UserProfile records. Used for cleanup on failed signup.
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
  "/bootstrap-user/:userId",
  requireInternalRequest,
  bootstrapController.rollbackBootstrap,
);

/**
 * @swagger
 * /api/v1/internal/bootstrap-user/{userId}/status:
 *   get:
 *     summary: Check bootstrap status for a user
 *     description: Returns whether the user has been bootstrapped (has profile records)
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
  "/bootstrap-user/:userId/status",
  requireInternalRequest,
  bootstrapController.checkBootstrapStatus,
);

/**
 * @swagger
 * /api/v1/internal/user-context/{userId}:
 *   get:
 *     summary: Get user context for authentication enrichment
 *     description: Returns clientId for JWT token enrichment. Called by auth-service during login.
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
 *         description: The auth-service user ID
 *     responses:
 *       200:
 *         description: User context retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     clientId:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *                     found:
 *                       type: boolean
 *       403:
 *         description: Unauthorized - missing internal request header
 */
router.get(
  "/user-context/:userId",
  requireInternalRequest,
  bootstrapController.getUserContext,
);

/**
 * @swagger
 * /api/v1/internal/outlets/by-user/{userId}:
 *   get:
 *     summary: Get outlet badge by user ID
 *     description: Resolves outlet and badge tier for a given userId. Called by partner-service for discount packages.
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
 *         description: The auth-service user ID
 *     responses:
 *       200:
 *         description: Outlet badge resolved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     found:
 *                       type: boolean
 *                     outletId:
 *                       type: string
 *                       format: uuid
 *                     badge:
 *                       type: string
 *                       enum: [BASIC, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND]
 *                     outletName:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       403:
 *         description: Unauthorized - missing internal request header
 */
router.get(
  "/outlets/by-user/:userId",
  requireInternalRequest,
  internalOutletController.getOutletByUser,
);

/**
 * @swagger
 * /api/v1/internal/outlets/{outletId}/badge:
 *   get:
 *     summary: Get outlet badge by outlet ID
 *     description: Resolves badge tier directly by outletId. Used when admin creates shipment on behalf of an outlet.
 *     tags: [Internal]
 *     security:
 *       - internalAuth: []
 *     parameters:
 *       - in: path
 *         name: outletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The outlet ID
 *     responses:
 *       200:
 *         description: Outlet badge resolved
 *       403:
 *         description: Unauthorized - missing internal request header
 */
router.get(
  "/outlets/:outletId/badge",
  requireInternalRequest,
  internalOutletController.getOutletBadgeById,
);

module.exports = router;
