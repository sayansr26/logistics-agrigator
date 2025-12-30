// Dashboard Routes - RBAC-006 Role-based Dashboard APIs
// Routes for role-specific dashboard endpoints

const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { authMiddleware } = require("../shared/lib/auth");

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Role-based dashboard endpoints (RBAC-006)
 */

/**
 * @swagger
 * /api/v1/dashboard/client:
 *   get:
 *     summary: Get client dashboard
 *     description: Get dashboard with client metrics (users, license) - Permission analytics:read:parent
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client dashboard data
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
 *                     client:
 *                       type: object
 *                     users:
 *                       type: object
 *                     summary:
 *                       type: object
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/v1/dashboard/client",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("analytics", "read", "parent"),
  dashboardController.getClientDashboard,
);

/**
 * @swagger
 * /api/v1/dashboard/team:
 *   get:
 *     summary: Get team member dashboard
 *     description: Get dashboard for team member - Permission analytics:read:assigned
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team member dashboard data
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
 *                     user:
 *                       type: object
 *                     summary:
 *                       type: object
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 */
router.get(
  "/v1/dashboard/team",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("analytics", "read", "assigned"),
  dashboardController.getTeamDashboard,
);

module.exports = router;
