// Affiliate Routes - Affiliate and commission management endpoints
// Handles affiliate dashboard, commissions, and customer linking

const express = require("express");
const affiliateController = require("../controllers/affiliateController");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { authMiddleware } = require("../shared/lib/auth");
const {
  linkCustomerSchema,
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
 *                             linkedCustomers:
 *                               type: number
 *                         recentCommissions:
 *                           type: array
 *                           items:
 *                             type: object
 *                         linkedCustomers:
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
 * /api/v1/affiliate/customers:
 *   get:
 *     summary: List customers referred by the authenticated affiliate
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referred customers retrieved successfully
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
 *                     customers:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 */
router.get(
  "/customers",
  authenticate,
  authMiddleware.requirePermission("affiliate", "read", "own"),
  affiliateController.listReferredCustomers,
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
 * /api/v1/affiliate/customers/{customerId}/link:
 *   post:
 *     summary: Link customer to affiliate for referral tracking
 *     tags: [Affiliate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
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
 *               - affiliateId
 *             properties:
 *               affiliateId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Customer linked to affiliate successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Customer not found
 */
router.post(
  "/customers/:customerId/link",
  authenticate,
  authMiddleware.requirePermission("customer", "update", "assigned"),
  validate(uuidParamSchema, "params"),
  validate(linkCustomerSchema),
  affiliateController.linkCustomer,
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
