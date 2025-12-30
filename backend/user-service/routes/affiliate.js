// Affiliate Routes - Affiliate and commission management endpoints
// Handles affiliate dashboard and commissions

const express = require("express");
const affiliateController = require("../controllers/affiliateController");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { authMiddleware } = require("../shared/lib/auth");
const {
  listCommissionsQuerySchema,
  uuidParamSchema,
} = require("../validation/affiliateSchemas");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Affiliate
 *   description: Affiliate commission and referral management
 */

/**
 * @swagger
 * /api/v1/affiliate/dashboard:
 *   get:
 *     summary: Get affiliate dashboard with commission stats
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                     dashboard:
 *                       type: object
 *                       properties:
 *                         affiliateId:
 *                           type: string
 *                           format: uuid
 *                         stats:
 *                           type: object
 *                           properties:
 *                             totalCommissions:
 *                               type: number
 *                             pendingAmount:
 *                               type: number
 *                             approvedAmount:
 *                               type: number
 *                             paidAmount:
 *                               type: number
 *                             totalEarnings:
 *                               type: number
 *                         recentCommissions:
 *                           type: array
 *                           items:
 *                             type: object
 *                         referrals:
 *                           type: array
 *                           items:
 *                             type: object
 *       403:
 *         description: Access denied - not an affiliate
 */
router.get(
  "/dashboard",
  authenticate,
  authMiddleware.requirePermission("affiliate", "read", "own"),
  affiliateController.getAffiliateDashboard,
);

/**
 * @swagger
 * /api/v1/affiliate/commissions:
 *   get:
 *     summary: List all commissions for the authenticated affiliate
 *     tags: [Affiliate]
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
 *           enum: [PENDING, APPROVED, PAID, CANCELLED]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Commissions retrieved successfully
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
 *                     commissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 */
router.get(
  "/commissions",
  authenticate,
  authMiddleware.requirePermission("affiliate", "read", "own"),
  validate(listCommissionsQuerySchema, "query"),
  affiliateController.listCommissions,
);

/**
 * @swagger
 * /api/v1/affiliate/referrals:
 *   get:
 *     summary: List referrals by the authenticated affiliate (currently disabled)
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referrals retrieved (feature disabled)
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
 *                     referrals:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 */
router.get(
  "/referrals",
  authenticate,
  authMiddleware.requirePermission("affiliate", "read", "own"),
  affiliateController.listReferrals,
);

/**
 * @swagger
 * /api/v1/affiliate/profile/{affiliateId}:
 *   get:
 *     summary: Get affiliate profile with statistics
 *     tags: [Affiliate]
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
 *         description: Affiliate profile retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Affiliate not found
 */
router.get(
  "/profile/:affiliateId",
  authenticate,
  validate(uuidParamSchema, "params"),
  affiliateController.getAffiliateProfile,
);

/**
 * @swagger
 * /api/v1/affiliate/stats:
 *   get:
 *     summary: Get affiliate statistics (for internal service calls)
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Affiliate statistics retrieved successfully
 */
router.get("/stats", authenticate, affiliateController.getAffiliateProfile);

module.exports = router;
