/**
 * Admin Logs Routes for Auth Service
 * All routes require admin role and internal request validation
 */

const express = require("express");
const router = express.Router();
const AdminLogsController = require("../controllers/adminLogsController");
const {
  validateQuery,
  getAuditLogsQuerySchema,
  getRuntimeLogsQuerySchema,
} = require("../shared/validation/logsValidation");
const logger = require("../shared/lib/logger");

/**
 * Middleware to validate internal requests from API Gateway
 */
router.use((req, res, next) => {
  const internalSecret = req.headers["x-internal-request"];

  if (internalSecret !== process.env.INTERNAL_SECRET) {
    logger.warn("Unauthorized admin logs access attempt", {
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({
      status: "error",
      error: {
        code: "UNAUTHORIZED",
        message: "Internal request validation failed",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  // For internal requests from Gateway, extract user info from headers
  if (!req.user || !req.user.userId) {
    const userId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];
    const clientId = req.headers["x-user-client-id"];

    if (!userId || !userRole) {
      return res.status(401).json({
        status: "error",
        error: {
          code: "UNAUTHORIZED",
          message: "User context required",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Set req.user from headers for internal requests
    req.user = {
      userId,
      role: userRole,
      ...(clientId && { clientId }),
    };
  }

  // Require superadmin role
  if (req.user.role !== "superadmin") {
    logger.warn("Non-superadmin attempted to access admin logs", {
      userId: req.user?.userId,
      role: req.user?.role,
      path: req.path,
    });
    return res.status(403).json({
      status: "error",
      error: {
        code: "FORBIDDEN",
        message: "Superadmin role required",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  next();
});

/**
 * @route   GET /admin/audit-logs
 * @desc    Get audit logs from database with cursor pagination
 * @access  Superadmin (via Gateway with internal secret)
 */
router.get(
  "/audit-logs",
  validateQuery(getAuditLogsQuerySchema),
  AdminLogsController.getAuditLogs,
);

/**
 * @route   GET /admin/runtime-logs
 * @desc    Get runtime logs from Winston log files
 * @access  Superadmin (via Gateway with internal secret)
 */
router.get(
  "/runtime-logs",
  validateQuery(getRuntimeLogsQuerySchema),
  AdminLogsController.getRuntimeLogs,
);

/**
 * @route   GET /admin/log-files
 * @desc    List available log files
 * @access  Superadmin (via Gateway with internal secret)
 */
router.get("/log-files", AdminLogsController.listLogFiles);

module.exports = router;
