const express = require("express");
const router = express.Router();
const activationController = require("../controllers/activationController");
const { authMiddleware } = require("../shared/lib/auth");
const { rateLimitLicense } = require("../middleware/licenseMiddleware");
const { validateRequest } = require("../middleware/validation");
const Joi = require("joi");

// Validation schemas
const activateLicenseSchema = Joi.object({
  licenseKey: Joi.string().required(),
  machineId: Joi.string().optional(),
  serverIP: Joi.string().ip().optional(),
  hostname: Joi.string().optional(),
  services: Joi.array().items(Joi.string()).default([]),
  nodeVersion: Joi.string().optional(),
  dockerVersion: Joi.string().optional(),
  osInfo: Joi.object().optional(),
});

const deactivateLicenseSchema = Joi.object({
  licenseKey: Joi.string().required(),
  machineId: Joi.string().required(),
  reason: Joi.string().optional(),
});

const heartbeatSchema = Joi.object({
  licenseKey: Joi.string().required(),
  machineId: Joi.string().required(),
  metrics: Joi.object().default({}),
});

const activationStatusSchema = Joi.object({
  licenseKey: Joi.string().required(),
  machineId: Joi.string().required(),
});

/**
 * @swagger
 * /api/v1/activate:
 *   post:
 *     summary: Activate a license on a machine
 *     tags: [Activation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 description: The license key to activate
 *               machineId:
 *                 type: string
 *                 description: Machine fingerprint (auto-generated if not provided)
 *               serverIP:
 *                 type: string
 *                 format: ipv4
 *                 description: Server IP address
 *               hostname:
 *                 type: string
 *                 description: Machine hostname
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of services to deploy
 *               nodeVersion:
 *                 type: string
 *                 description: Node.js version
 *               dockerVersion:
 *                 type: string
 *                 description: Docker version
 *               osInfo:
 *                 type: object
 *                 description: Operating system information
 *     responses:
 *       200:
 *         description: License activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activation:
 *                   $ref: '#/components/schemas/Activation'
 *                 license:
 *                   type: object
 *                 configuration:
 *                   type: object
 *                   description: Environment configuration for the client
 *                 heartbeatInterval:
 *                   type: integer
 *                   description: Heartbeat interval in milliseconds
 *       400:
 *         description: Invalid request
 *       403:
 *         description: License validation failed
 *       429:
 *         description: Too many activation attempts
 */
router.post(
  "/",
  rateLimitLicense,
  validateRequest(activateLicenseSchema),
  activationController.activateLicense,
);

/**
 * @swagger
 * /api/v1/activate/deactivate:
 *   post:
 *     summary: Deactivate a license on a machine
 *     tags: [Activation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *               - machineId
 *             properties:
 *               licenseKey:
 *                 type: string
 *               machineId:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: License deactivated successfully
 *       404:
 *         description: License or activation not found
 */
router.post(
  "/deactivate",
  validateRequest(deactivateLicenseSchema),
  activationController.deactivateLicense,
);

/**
 * @swagger
 * /api/v1/activate/heartbeat:
 *   post:
 *     summary: Send heartbeat for an active license
 *     tags: [Activation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *               - machineId
 *             properties:
 *               licenseKey:
 *                 type: string
 *               machineId:
 *                 type: string
 *               metrics:
 *                 type: object
 *                 description: Usage metrics
 *     responses:
 *       200:
 *         description: Heartbeat received
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 nextHeartbeat:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: License invalid or expired
 *       404:
 *         description: Activation not found
 */
router.post(
  "/heartbeat",
  validateRequest(heartbeatSchema),
  activationController.sendHeartbeat,
);

/**
 * @swagger
 * /api/v1/activate/status:
 *   get:
 *     summary: Get activation status
 *     tags: [Activation]
 *     parameters:
 *       - in: query
 *         name: licenseKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: machineId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activation status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [active, inactive, suspended]
 *                 activation:
 *                   type: object
 *       404:
 *         description: License or activation not found
 */
router.get(
  "/status",
  validateRequest(activationStatusSchema, "query"),
  activationController.getActivationStatus,
);

/**
 * @swagger
 * /api/v1/activate/list/{licenseId}:
 *   get:
 *     summary: List all activations for a license
 *     tags: [Activation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: licenseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED, REVOKED]
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
 *     responses:
 *       200:
 *         description: List of activations
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get(
  "/list/:licenseId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("license", "read", "assigned"),
  activationController.listActivations,
);

module.exports = router;
