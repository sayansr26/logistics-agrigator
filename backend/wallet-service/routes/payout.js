// Payout Routes - Affiliate payout management endpoints
// Handles payout requests, approvals, rejections, and history

const express = require("express");
const payoutController = require("../controllers/payoutController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const Joi = require("joi");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payouts
 *   description: Affiliate payout management
 */

// Validation schemas
const requestPayoutSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    "number.base": "amount must be a number",
    "number.positive": "amount must be a positive number",
    "any.required": "amount is required",
  }),
  metadata: Joi.object().optional(),
});

const approvePayoutSchema = Joi.object({
  notes: Joi.string().max(500).optional().messages({
    "string.max": "notes must not exceed 500 characters",
  }),
});

const rejectPayoutSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required().messages({
    "string.base": "reason must be a string",
    "string.min": "reason must be at least 10 characters",
    "string.max": "reason must not exceed 500 characters",
    "any.required": "reason is required",
  }),
});

const listPayoutRequestsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid("createdAt", "amount").default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  status: Joi.string()
    .valid("PENDING", "COMPLETED", "CANCELLED")
    .default("PENDING"),
});

const uuidParamSchema = Joi.object({
  payoutId: Joi.string().uuid().optional(),
  affiliateId: Joi.string().uuid().optional(),
});

/**
 * @swagger
 * /api/v1/payout/request:
 *   post:
 *     summary: Request payout for affiliate commissions
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Payout amount to request
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Payout request created successfully
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
 *                     payoutRequest:
 *                       type: object
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid amount or insufficient balance
 *       403:
 *         description: Access denied - affiliate only
 */
router.post(
  "/request",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "create", "own"),
  validate(requestPayoutSchema),
  payoutController.requestPayout,
);

/**
 * @swagger
 * /api/v1/payout/requests:
 *   get:
 *     summary: List all payout requests (admin only)
 *     tags: [Payouts]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELLED]
 *           default: PENDING
 *     responses:
 *       200:
 *         description: Payout requests retrieved successfully
 */
router.get(
  "/requests",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "read", "all"),
  validate(listPayoutRequestsQuerySchema, "query"),
  payoutController.listPayoutRequests,
);

/**
 * @swagger
 * /api/v1/payout/{payoutId}/approve:
 *   post:
 *     summary: Approve payout and credit affiliate wallet (admin only)
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
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
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Payout approved successfully
 *       400:
 *         description: Invalid payout status
 *       404:
 *         description: Payout request not found
 */
router.post(
  "/:payoutId/approve",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validate(uuidParamSchema, "params"),
  validate(approvePayoutSchema),
  payoutController.approvePayout,
);

/**
 * @swagger
 * /api/v1/payout/{payoutId}/reject:
 *   post:
 *     summary: Reject payout request (admin only)
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
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
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Payout rejected successfully
 *       400:
 *         description: Invalid payout status or missing reason
 *       404:
 *         description: Payout request not found
 */
router.post(
  "/:payoutId/reject",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validate(uuidParamSchema, "params"),
  validate(rejectPayoutSchema),
  payoutController.rejectPayout,
);

/**
 * @swagger
 * /api/v1/payout/history/{affiliateId}:
 *   get:
 *     summary: Get payout history for affiliate
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payout history retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get(
  "/history/:affiliateId",
  authMiddleware.authenticate,
  validate(uuidParamSchema, "params"),
  payoutController.getPayoutHistory,
);

module.exports = router;
