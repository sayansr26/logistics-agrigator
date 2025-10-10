const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const { adminOnly, rateLimitLicense } = require('../middleware/licenseMiddleware');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Validation schemas
const generateLicenseSchema = Joi.object({
  clientId: Joi.string().uuid().required(),
  type: Joi.string().valid('TRIAL', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM').default('STANDARD'),
  plan: Joi.string().valid('MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'COMMISSION_BASED', 'PAY_AS_YOU_GO').default('MONTHLY'),
  allowedServices: Joi.array().items(Joi.string()).default(['auth-service', 'user-service', 'api-gateway']),
  maxActivations: Joi.number().integer().min(1).default(1),
  validityDays: Joi.number().integer().min(1).default(30),
  allowedIPs: Joi.array().items(Joi.string().ip()).default([]),
  allowedMachineIds: Joi.array().items(Joi.string()).default([]),
  features: Joi.object().default({}),
  limits: Joi.object().default({}),
  commissionRate: Joi.number().min(0).max(1).optional(),
  encryptedConfig: Joi.object().optional()
});

const validateLicenseSchema = Joi.object({
  licenseKey: Joi.string().required(),
  machineId: Joi.string().optional(),
  serverIP: Joi.string().ip().optional()
});

const extendLicenseSchema = Joi.object({
  days: Joi.number().integer().min(1).default(30)
});

const listLicensesSchema = Joi.object({
  clientId: Joi.string().uuid().optional(),
  status: Joi.string().valid('INACTIVE', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED').optional(),
  type: Joi.string().valid('TRIAL', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM').optional(),
  plan: Joi.string().valid('MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'COMMISSION_BASED').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'validUntil', 'type', 'plan').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * @swagger
 * /api/v1/licenses/generate:
 *   post:
 *     summary: Generate a new license
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/License'
 *     responses:
 *       201:
 *         description: License generated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/generate',
  adminOnly,
  rateLimitLicense,
  validateRequest(generateLicenseSchema),
  licenseController.generateLicense
);

/**
 * @swagger
 * /api/v1/licenses/validate:
 *   post:
 *     summary: Validate a license
 *     tags: [Licenses]
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
 *               machineId:
 *                 type: string
 *               serverIP:
 *                 type: string
 *     responses:
 *       200:
 *         description: License validation result
 *       400:
 *         description: Invalid request
 *       403:
 *         description: License validation failed
 */
router.post(
  '/validate',
  rateLimitLicense,
  validateRequest(validateLicenseSchema),
  licenseController.validateLicense
);

/**
 * @swagger
 * /api/v1/licenses/{id}:
 *   get:
 *     summary: Get license details
 *     tags: [Licenses]
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
 *         description: License details
 *       404:
 *         description: License not found
 */
router.get(
  '/:id',
  adminOnly,
  licenseController.getLicenseDetails
);

/**
 * @swagger
 * /api/v1/licenses/{id}/revoke:
 *   put:
 *     summary: Revoke a license
 *     tags: [Licenses]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: License revoked successfully
 *       404:
 *         description: License not found
 */
router.put(
  '/:id/revoke',
  adminOnly,
  licenseController.revokeLicense
);

/**
 * @swagger
 * /api/v1/licenses/{id}/extend:
 *   put:
 *     summary: Extend license validity
 *     tags: [Licenses]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: integer
 *                 minimum: 1
 *                 default: 30
 *     responses:
 *       200:
 *         description: License extended successfully
 *       404:
 *         description: License not found
 */
router.put(
  '/:id/extend',
  adminOnly,
  validateRequest(extendLicenseSchema),
  licenseController.extendLicense
);

/**
 * @swagger
 * /api/v1/licenses:
 *   get:
 *     summary: List all licenses
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [INACTIVE, ACTIVE, SUSPENDED, EXPIRED, REVOKED]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [TRIAL, STANDARD, PROFESSIONAL, ENTERPRISE, CUSTOM]
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
 *         description: List of licenses
 */
router.get(
  '/',
  adminOnly,
  validateRequest(listLicensesSchema, 'query'),
  licenseController.listLicenses
);

module.exports = router;