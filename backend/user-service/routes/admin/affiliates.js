// Admin Affiliate Routes - Admin endpoints for affiliate management
// Handles affiliate registration, commission settings, and performance metrics

const express = require("express");
const affiliateController = require("../../controllers/affiliateController");
const { validate } = require("../../middleware/validate");
const { authenticate } = require("../../middleware/auth");
const { authMiddleware } = require("../../shared/lib/auth");
const {
  registerAffiliateSchema,
  updateCommissionSettingsSchema,
  listCommissionsQuerySchema,
  uuidParamSchema,
} = require("../../validation/affiliateSchemas");
const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../../shared/lib/response");
const logger = require("../../shared/lib/logger");

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   name: Admin - Affiliates
 *   description: Admin endpoints for affiliate management
 */

/**
 * @swagger
 * /api/v1/admin/affiliates/register:
 *   post:
 *     summary: Register a new affiliate user (superadmin only)
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - commissionRate
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID from auth-service with affiliate role
 *               commissionType:
 *                 type: string
 *                 enum: [FLAT, PERCENTAGE]
 *                 default: PERCENTAGE
 *               commissionRate:
 *                 type: number
 *                 description: Commission rate (0-100 for PERCENTAGE, any positive number for FLAT)
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Affiliate registered successfully
 *       400:
 *         description: Invalid commission rate
 *       403:
 *         description: Access denied - superadmin only
 */
router.post(
  "/register",
  authenticate,
  authMiddleware.requirePermission("user", "create", "all"),
  validate(registerAffiliateSchema),
  affiliateController.registerAffiliate,
);

/**
 * @swagger
 * /api/v1/admin/affiliates:
 *   get:
 *     summary: List all affiliates with statistics
 *     tags: [Admin - Affiliates]
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *     responses:
 *       200:
 *         description: Affiliates retrieved successfully
 */
router.get(
  "/",
  authenticate,
  authMiddleware.requirePermission("user", "read", "all"),
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;
      const skip = (page - 1) * limit;

      // Get all commissions grouped by affiliate to get affiliate IDs
      const affiliateCommissions = await prisma.commission.groupBy({
        by: ["affiliateId"],
        _count: {
          id: true,
        },
        _sum: {
          commissionAmount: true,
        },
      });

      // Get unique affiliate IDs
      const affiliateIds = affiliateCommissions.map((a) => a.affiliateId);

      // Note: Actual affiliate user data is in auth-service
      // This endpoint returns commission statistics for known affiliates

      const affiliatesWithStats = affiliateCommissions.slice(
        skip,
        skip + parseInt(limit),
      );

      const total = affiliateCommissions.length;
      const hasMore = skip + affiliatesWithStats.length < total;
      const totalPages = Math.ceil(total / limit);

      res.json(
        APIResponse.success({
          affiliates: affiliatesWithStats.map((a) => ({
            affiliateId: a.affiliateId,
            totalCommissions: a._count.id,
            totalEarnings: a._sum.commissionAmount || 0,
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasMore,
            hasPrevious: page > 1,
          },
        }),
      );
    } catch (error) {
      logger.error("List affiliates error", {
        error: error.message,
        userId: req.user.id,
        service: "user-service",
      });
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/admin/affiliates/{affiliateId}/commission-settings:
 *   post:
 *     summary: Update affiliate commission settings (superadmin only)
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
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
 *             properties:
 *               commissionType:
 *                 type: string
 *                 enum: [FLAT, PERCENTAGE]
 *               commissionRate:
 *                 type: number
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Commission settings updated successfully
 *       400:
 *         description: Invalid commission rate
 *       403:
 *         description: Access denied
 */
router.post(
  "/:affiliateId/commission-settings",
  authenticate,
  authMiddleware.requirePermission("user", "update", "all"),
  validate(uuidParamSchema, "params"),
  validate(updateCommissionSettingsSchema),
  affiliateController.updateCommissionSettings,
);

/**
 * @swagger
 * /api/v1/admin/affiliates/{affiliateId}/performance:
 *   get:
 *     summary: Get affiliate performance metrics
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Performance metrics retrieved successfully
 *       404:
 *         description: Affiliate not found
 */
router.get(
  "/:affiliateId/performance",
  authenticate,
  authMiddleware.requirePermission("analytics", "read", "all"),
  validate(uuidParamSchema, "params"),
  async (req, res, next) => {
    try {
      const { affiliateId } = req.params;
      const { startDate, endDate } = req.query;

      // Build where clause
      const where = { affiliateId };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Get performance metrics
      const [
        totalCommissions,
        commissionsByStatus,
        topCustomers,
        monthlyTrend,
      ] = await Promise.all([
        prisma.commission.count({ where }),
        prisma.commission.groupBy({
          by: ["status"],
          where,
          _count: { id: true },
          _sum: { commissionAmount: true },
        }),
        prisma.commission.groupBy({
          by: ["customerId"],
          where,
          _count: { id: true },
          _sum: { commissionAmount: true },
          orderBy: {
            _sum: {
              commissionAmount: "desc",
            },
          },
          take: 10,
        }),
        prisma.$queryRaw`
          SELECT
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as commission_count,
            SUM(commission_amount) as total_amount
          FROM commissions
          WHERE affiliate_id = ${affiliateId}::uuid
          ${startDate ? prisma.$queryRaw`AND created_at >= ${new Date(startDate)}::timestamp` : prisma.$queryRaw``}
          ${endDate ? prisma.$queryRaw`AND created_at <= ${new Date(endDate)}::timestamp` : prisma.$queryRaw``}
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `,
      ]);

      res.json(
        APIResponse.success({
          performance: {
            affiliateId,
            period: {
              startDate: startDate || null,
              endDate: endDate || null,
            },
            totalCommissions,
            commissionsByStatus,
            topCustomers,
            monthlyTrend,
          },
        }),
      );
    } catch (error) {
      logger.error("Get affiliate performance error", {
        error: error.message,
        affiliateId: req.params.affiliateId,
        userId: req.user.id,
        service: "user-service",
      });
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/admin/affiliates/{affiliateId}/commissions:
 *   get:
 *     summary: List all commissions for a specific affiliate (admin view)
 *     tags: [Admin - Affiliates]
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
 *         description: Commissions retrieved successfully
 */
router.get(
  "/:affiliateId/commissions",
  authenticate,
  authMiddleware.requirePermission("affiliate", "read", "all"),
  validate(uuidParamSchema, "params"),
  validate(listCommissionsQuerySchema, "query"),
  affiliateController.listCommissions,
);

/**
 * @swagger
 * /api/v1/admin/affiliates/{affiliateId}/mark-commissions-paid:
 *   post:
 *     summary: Mark commissions as paid (called by wallet-service after payout)
 *     tags: [Admin - Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affiliateId
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
 *               - amount
 *               - payoutId
 *             properties:
 *               amount:
 *                 type: number
 *               payoutId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Commissions marked as paid successfully
 */
router.post(
  "/:affiliateId/mark-commissions-paid",
  authenticate,
  authMiddleware.requirePermission("wallet", "manage", "all"),
  validate(uuidParamSchema, "params"),
  async (req, res, next) => {
    try {
      const { affiliateId } = req.params;
      const { amount, payoutId } = req.body;

      // Get approved commissions totaling the payout amount
      const approvedCommissions = await prisma.commission.findMany({
        where: {
          affiliateId,
          status: "APPROVED",
        },
        orderBy: { createdAt: "asc" },
      });

      let remainingAmount = amount;
      const commissionIdsToUpdate = [];

      for (const commission of approvedCommissions) {
        if (remainingAmount <= 0) break;

        commissionIdsToUpdate.push(commission.id);
        remainingAmount -= parseFloat(commission.commissionAmount);
      }

      // Update commissions to PAID
      const result = await prisma.commission.updateMany({
        where: {
          id: { in: commissionIdsToUpdate },
        },
        data: {
          status: "PAID",
          paidAt: new Date(),
          payoutId,
        },
      });

      logger.info("Commissions marked as paid", {
        affiliateId,
        payoutId,
        amount,
        commissionsUpdated: result.count,
        service: "user-service",
      });

      res.json(
        APIResponse.success({
          message: "Commissions marked as paid successfully",
          updated: result.count,
          payoutId,
        }),
      );
    } catch (error) {
      logger.error("Mark commissions paid error", {
        error: error.message,
        affiliateId: req.params.affiliateId,
        requestBody: req.body,
        service: "user-service",
      });
      next(error);
    }
  },
);

module.exports = router;
