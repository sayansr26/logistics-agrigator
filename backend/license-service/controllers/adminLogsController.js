/**
 * Admin Logs Controller for License Service
 */

const { prisma } = require("../config/database");
const {
  createAdminLogsController,
} = require("../shared/utils/adminLogsHelper");

const AdminLogsController = createAdminLogsController(
  prisma,
  "license-service",
);

module.exports = AdminLogsController;
