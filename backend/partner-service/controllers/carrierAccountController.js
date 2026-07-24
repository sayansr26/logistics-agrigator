/**
 * Carrier Account Controller
 *
 * HTTP surface for carrier service channels (weight-slab shipping products/accounts).
 * Business logic is delegated to carrierAccountService. Follows auth-service patterns.
 */

const carrierAccountService = require("../services/carrierAccountService");
const logger = require("../shared/lib/logger");

class CarrierAccountController {
  /**
   * List carrier accounts for a partner
   */
  async listAccounts(req, res) {
    try {
      const { partnerId } = req.params;
      const accounts = await carrierAccountService.listAccounts(partnerId);
      res.status(200).json({
        status: "success",
        data: { accounts, total: accounts.length },
      });
    } catch (error) {
      logger.error("Error in listAccounts controller", {
        error: error.message,
      });
      res.status(500).json({
        status: "error",
        error: { code: "INTERNAL_ERROR", message: error.message },
      });
    }
  }

  /**
   * Select the best-matching channel for a shipment profile.
   * Used by shipment-service at rating/booking time.
   * Query: ?weight=<kg>&businessType=<B2B|B2C>&orderAmount=<INR>&paymentType=<COD|PREPAID>&serviceType=<SURFACE|AIR|EXPRESS>
   */
  async selectAccount(req, res) {
    try {
      const { partnerId } = req.params;
      const { weight, businessType, orderAmount, paymentType, serviceType } =
        req.query;

      const selection = await carrierAccountService.selectChannel(partnerId, {
        weight: parseFloat(weight),
        businessType: businessType || "B2C",
        orderAmount:
          orderAmount !== undefined && orderAmount !== ""
            ? parseFloat(orderAmount)
            : null,
        paymentType: paymentType || null,
        serviceType: serviceType || null,
      });

      if (selection.mode === "NO_MATCH") {
        return res.status(404).json({
          status: "error",
          error: {
            code: "CHANNEL_NOT_MATCHED",
            message:
              "No channel matches the shipment profile (type/weight/amount/payment)",
          },
        });
      }

      res.status(200).json({
        status: "success",
        data: { mode: selection.mode, channel: selection.channel || null },
      });
    } catch (error) {
      logger.error("Error in selectAccount controller", {
        error: error.message,
      });
      res.status(500).json({
        status: "error",
        error: { code: "INTERNAL_ERROR", message: error.message },
      });
    }
  }

  /**
   * Create carrier account(s) for a partner (bulk-capable)
   */
  async createAccounts(req, res) {
    try {
      const { partnerId } = req.params;
      const { accounts } = req.body;
      const userId = req.user?.id;

      const results = await carrierAccountService.createAccounts({
        partnerId,
        accounts,
        userId,
      });

      res.status(201).json({
        status: "success",
        data: { accounts: results, total: results.length },
        meta: {
          message: `Successfully created ${results.length} carrier account(s)`,
        },
      });
    } catch (error) {
      logger.error("Error in createAccounts controller", {
        error: error.message,
      });
      const statusCode = error.message.includes("not found")
        ? 404
        : error.message.includes("already exists")
          ? 409
          : 500;
      res.status(statusCode).json({
        status: "error",
        error: {
          code: statusCode === 409 ? "CONFLICT" : "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Update a carrier account
   */
  async updateAccount(req, res) {
    try {
      const { accountId } = req.params;
      const updates = req.body;
      const userId = req.user?.id;

      const account = await carrierAccountService.updateAccount({
        accountId,
        updates,
        userId,
      });

      res.status(200).json({ status: "success", data: account });
    } catch (error) {
      logger.error("Error in updateAccount controller", {
        error: error.message,
      });
      const statusCode =
        error.message.includes("not found") ||
        error.message.includes("Record to update not found")
          ? 404
          : error.message.includes("already exists")
            ? 409
            : 500;
      res.status(statusCode).json({
        status: "error",
        error: {
          code: statusCode === 409 ? "CONFLICT" : "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Delete a carrier account
   */
  async deleteAccount(req, res) {
    try {
      const { accountId } = req.params;
      const userId = req.user?.id;

      await carrierAccountService.deleteAccount(accountId, userId);

      res.status(200).json({
        status: "success",
        data: { message: "Carrier account deleted successfully" },
      });
    } catch (error) {
      logger.error("Error in deleteAccount controller", {
        error: error.message,
      });
      const statusCode =
        error.message.includes("not found") ||
        error.message.includes("Record to delete does not exist")
          ? 404
          : 500;
      res.status(statusCode).json({
        status: "error",
        error: { code: "INTERNAL_ERROR", message: error.message },
      });
    }
  }
}

module.exports = new CarrierAccountController();
