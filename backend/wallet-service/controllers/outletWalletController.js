const { getExternalWalletClient } = require("../services/externalWalletClient");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * Get transaction history for the authenticated outlet user
 * Uses the user's phone number as the wallet userId
 */
async function getMyTransactionHistory(req, res) {
  try {
    const userId = req.user?.phone;
    if (!userId) {
      return res
        .status(400)
        .json(APIResponse.error("User phone number not available", 400));
    }

    const { page, size } = req.query;

    logger.info("Outlet fetching own transaction history", { userId });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.getUserTransactionHistory(userId, {
      page,
      size,
    });

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error fetching outlet transaction history:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch transaction history",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Get transaction statistics for the authenticated outlet user
 * Uses the user's phone number as the wallet userId
 */
async function getMyTransactionStatistics(req, res) {
  try {
    const userId = req.user?.phone;
    if (!userId) {
      return res
        .status(400)
        .json(APIResponse.error("User phone number not available", 400));
    }

    logger.info("Outlet fetching own transaction statistics", { userId });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.getUserTransactionStatistics(userId);

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error fetching outlet transaction statistics:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch transaction statistics",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Get wallet info for the authenticated outlet user
 * Uses the user's phone number as the wallet userId
 */
async function getMyWalletInfo(req, res) {
  try {
    const userId = req.user?.phone;
    if (!userId) {
      return res
        .status(400)
        .json(APIResponse.error("User phone number not available", 400));
    }

    const clientCode =
      req.user?.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";

    logger.info("Outlet fetching own wallet info", { userId, clientCode });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.getUserWalletInfo(clientCode, userId);

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error fetching outlet wallet info:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch wallet info",
          error.statusCode || 500,
        ),
      );
  }
}

module.exports = {
  getMyTransactionHistory,
  getMyTransactionStatistics,
  getMyWalletInfo,
};
