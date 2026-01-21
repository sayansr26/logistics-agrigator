/**
 * Logs Aggregation Routes for API Gateway
 * Provides aggregated access to audit and runtime logs from all services
 */

const express = require("express");
const router = express.Router();
const LogsAggregationController = require("../controllers/logsAggregationController");
const { requireRole } = require("../middleware/rbacChecker");
const {
  validateQuery,
  getAuditLogsQuerySchema,
  getRuntimeLogsQuerySchema,
} = require("../shared/validation/logsValidation");
const logger = require("../shared/lib/logger");

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     tags: [Logs]
 *     summary: Get system-wide audit logs (Superadmin only)
 *     description: Aggregates audit logs from all backend services with filtering and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 200
 *         description: Maximum number of logs to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor from previous response
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *           enum: [auth-service, user-service, shipment-service, partner-service, wallet-service, license-service]
 *         description: Filter by specific service
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action (e.g., CREATE, UPDATE, DELETE)
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs before this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Free-text search in action and resource fields
 *     responses:
 *       200:
 *         description: Successfully retrieved audit logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogsResponse'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - superadmin role required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/admin/audit-logs",
  requireRole("superadmin"),
  validateQuery(getAuditLogsQuerySchema),
  LogsAggregationController.getAdminAuditLogs,
);

/**
 * @swagger
 * /api/v1/admin/runtime-logs:
 *   get:
 *     tags: [Logs]
 *     summary: Get system-wide runtime logs (Superadmin only)
 *     description: Aggregates Winston runtime log files from all backend services with sensitive data redacted
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 200
 *         description: Maximum number of log lines to return per service
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *         description: Filter by specific service
 *       - in: query
 *         name: file
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-\\d{2}-\\d{2}(-error)?\\.log$"
 *         description: Specific log file to read
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *         description: Filter by log level
 *     responses:
 *       200:
 *         description: Successfully retrieved runtime logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RuntimeLogsResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - superadmin role required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/admin/runtime-logs",
  requireRole("superadmin"),
  validateQuery(getRuntimeLogsQuerySchema),
  LogsAggregationController.getAdminRuntimeLogs,
);

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     tags: [Logs]
 *     summary: Get client-scoped audit logs
 *     description: Returns audit logs scoped to the user's client/tenant. Non-superadmin users can only see their own organization's logs.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 200
 *         description: Maximum number of logs to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor from previous response
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *         description: Filter by specific service
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs before this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Free-text search
 *     responses:
 *       200:
 *         description: Successfully retrieved audit logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogsResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - client ID required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/audit-logs",
  requireRole(["admin", "client", "accounts", "sales", "support"]),
  validateQuery(getAuditLogsQuerySchema),
  LogsAggregationController.getClientAuditLogs,
);

module.exports = router;
