/**
 * Admin Logs Controller for Wallet Service
 */

const { prisma } = require("../config/database");
const {
  createAdminLogsController,
} = require("../shared/utils/adminLogsHelper");

const AdminLogsController = createAdminLogsController(prisma, "wallet-service");

module.exports = AdminLogsController;
