/**
 * Admin Logs Controller for Platform Service
 * Note: Platform Service does NOT have AuditLog model yet
 * Only provides runtime logs access
 */

const {
  createAdminLogsController,
} = require("../shared/utils/adminLogsHelper");

// Since platform-service doesn't have AuditLog model, we only use the runtime logs methods
// We need a prisma instance for consistency, even though we don't use it for audit logs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create controller with audit logs disabled
const AdminLogsController = createAdminLogsController(
  prisma,
  "platform-service",
  {
    hasAuditLog: false,
  },
);

module.exports = AdminLogsController;
