/**
 * Admin Logs Controller for Support Service
 * Note: Support Service does NOT have AuditLog model yet
 * Only provides runtime logs access
 */

const {
  createAdminLogsController,
} = require("../shared/utils/adminLogsHelper");

// Since support-service doesn't have AuditLog model, we only use the runtime logs methods
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create controller with audit logs disabled
const AdminLogsController = createAdminLogsController(
  prisma,
  "support-service",
  {
    hasAuditLog: false,
  },
);

module.exports = AdminLogsController;
