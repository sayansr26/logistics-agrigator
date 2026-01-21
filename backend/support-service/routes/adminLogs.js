/**
 * Admin Logs Routes for Support Service
 */

const express = require("express");
const router = express.Router();
const AdminLogsController = require("../controllers/adminLogsController");
const {
  validateQuery,
  getRuntimeLogsQuerySchema,
} = require("../shared/validation/logsValidation");
const logger = require("../shared/lib/logger");

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

// Support service only has runtime logs (no audit logs yet)
router.get(
  "/runtime-logs",
  validateQuery(getRuntimeLogsQuerySchema),
  AdminLogsController.getRuntimeLogs,
);
router.get("/log-files", AdminLogsController.listLogFiles);

module.exports = router;
