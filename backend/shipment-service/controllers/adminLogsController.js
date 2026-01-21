/**
 * Admin Logs Controller for Shipment Service
 */

const { prisma } = require("../config/database");
const {
  createAdminLogsController,
} = require("../shared/utils/adminLogsHelper");

const AdminLogsController = createAdminLogsController(
  prisma,
  "shipment-service",
);

module.exports = AdminLogsController;
