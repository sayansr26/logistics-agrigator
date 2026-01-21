/**
 * Admin Logs Routes for Wallet Service
 */

const express = require("express");
const router = express.Router();
const AdminLogsController = require("../controllers/adminLogsController");
const {
  validateQuery,
  getAuditLogsQuerySchema,
  getRuntimeLogsQuerySchema,
} = require("../shared/validation/logsValidation");

router.use((req, res, next) => {
  if (req.headers["x-internal-request"] !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({
      status: "error",
      error: {
        code: "UNAUTHORIZED",
        message: "Internal request validation failed",
      },
      meta: { timestamp: new Date().toISOString() },
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
        error: { code: "UNAUTHORIZED", message: "User context required" },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    req.user = { userId, role: userRole, ...(clientId && { clientId }) };
  }

  if (req.user.role !== "superadmin") {
    return res.status(403).json({
      status: "error",
      error: { code: "FORBIDDEN", message: "Superadmin role required" },
      meta: { timestamp: new Date().toISOString() },
    });
  }
  next();
});

router.get(
  "/audit-logs",
  validateQuery(getAuditLogsQuerySchema),
  AdminLogsController.getAuditLogs,
);
router.get(
  "/runtime-logs",
  validateQuery(getRuntimeLogsQuerySchema),
  AdminLogsController.getRuntimeLogs,
);
router.get("/log-files", AdminLogsController.listLogFiles);

module.exports = router;
