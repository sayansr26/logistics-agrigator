const { getExternalWalletClient } = require("../services/externalWalletClient");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * Get paginated list of all wallets for a client from external wallet API
 */
async function getClientWallets(req, res) {
  try {
    const clientCode =
      req.query.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const { page, size, sortBy, sortDir, status } = req.query;

    logger.info("Admin fetching client wallets", { clientCode });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.listClientWallets(clientCode, {
      page,
      size,
      sortBy,
      sortDir,
      status,
    });

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error fetching client wallets:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch client wallets",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Get paginated list of all transactions for a client from external wallet API
 */
async function getClientTransactions(req, res) {
  try {
    const clientCode =
      req.query.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const { page, size, sortBy, sortDir, type, status, userId, referenceId } =
      req.query;

    logger.info("Admin fetching client transactions", {
      clientCode,
      userId,
      referenceId,
    });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.listClientTransactions(clientCode, {
      page,
      size,
      sortBy,
      sortDir,
      type,
      status,
      userId,
      // Substring match on the wallet's reference_id. Every movement we create
      // embeds the shipment id (SHIPMENT_<id>, SHIPMENT_<id>_RERATE_<ts>,
      // ..._REVERSAL, REFUND_<id>), so passing a bare shipment id returns that
      // shipment's complete wallet history.
      referenceId,
    });

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error fetching client transactions:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch client transactions",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Get or create wallet for a specific user under a client
 */
async function getWallet(req, res) {
  try {
    const clientCode =
      req.query.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const { userId } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json(APIResponse.error("userId query parameter is required", 400));
    }

    logger.info("Admin fetching wallet for user", { clientCode, userId });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.getOrCreateWallet(clientCode, userId);

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error fetching wallet:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to fetch wallet",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Update user status under a client
 */
async function updateUserStatus(req, res) {
  try {
    const clientCode =
      req.body.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const { userId, status } = req.body;

    if (!userId) {
      return res.status(400).json(APIResponse.error("userId is required", 400));
    }
    if (!status) {
      return res.status(400).json(APIResponse.error("status is required", 400));
    }

    logger.info("Admin updating user status", { clientCode, userId, status });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.updateUserStatus(
      clientCode,
      userId,
      status,
    );

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error updating user status:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to update user status",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Top up a user's wallet
 */
async function topupWallet(req, res) {
  try {
    const clientCode =
      req.body.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const {
      userId,
      amount,
      currency,
      reference_id,
      description,
      metadata,
      remarks,
    } = req.body;

    if (!userId) {
      return res.status(400).json(APIResponse.error("userId is required", 400));
    }

    logger.info("Admin topping up wallet", { clientCode, userId, amount });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.topup(clientCode, userId, {
      amount,
      currency,
      reference_id,
      description,
      metadata,
      remarks,
    });

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error topping up wallet:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to topup wallet",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Debit a user's wallet
 */
async function debitWallet(req, res) {
  try {
    const clientCode =
      req.body.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const {
      userId,
      amount,
      currency,
      reference_id,
      description,
      metadata,
      remarks,
    } = req.body;

    if (!userId) {
      return res.status(400).json(APIResponse.error("userId is required", 400));
    }

    logger.info("Admin debiting wallet", { clientCode, userId, amount });

    const externalClient = getExternalWalletClient();
    const data = await externalClient.debit(clientCode, userId, {
      amount,
      currency,
      reference_id,
      description,
      metadata,
      remarks,
    });

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error debiting wallet:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to debit wallet",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Refund to a user's wallet
 */
async function refundWallet(req, res) {
  try {
    const clientCode =
      req.body.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const {
      userId,
      amount,
      currency,
      reference_id,
      transaction_id,
      description,
      metadata,
      remarks,
    } = req.body;

    if (!userId) {
      return res.status(400).json(APIResponse.error("userId is required", 400));
    }

    logger.info("Admin refunding wallet", {
      clientCode,
      userId,
      amount,
      transaction_id,
    });

    const externalClient = getExternalWalletClient();
    const refundBody = {
      amount,
      currency,
      reference_id,
      description,
      metadata,
      remarks,
    };
    if (transaction_id) refundBody.transaction_id = transaction_id;
    const data = await externalClient.refund(clientCode, userId, refundBody);

    return res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error refunding wallet:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to refund wallet",
          error.statusCode || 500,
        ),
      );
  }
}

/**
 * Sync wallets for a batch of user IDs (rate-limited, balanced)
 * Calls getOrCreateWallet for each userId sequentially with delays
 */
async function syncWallets(req, res) {
  try {
    const clientCode =
      req.body.clientCode || process.env.DEFAULT_CLIENT_CODE || "DEFAULT";
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "userIds array is required and must not be empty",
            400,
          ),
        );
    }

    if (userIds.length > 100) {
      return res
        .status(400)
        .json(APIResponse.error("Maximum 100 userIds per sync request", 400));
    }

    logger.info("Admin syncing wallets", { clientCode, count: userIds.length });

    const externalClient = getExternalWalletClient();
    const results = { created: [], existing: [], failed: [] };

    // Process in small batches of 3 with 500ms delay between batches
    const BATCH_SIZE = 3;
    const DELAY_MS = 500;

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (userId) => {
          try {
            const data = await externalClient.getOrCreateWallet(
              clientCode,
              userId,
            );
            return { userId, data, status: "ok" };
          } catch (err) {
            return { userId, error: err.message, status: "error" };
          }
        }),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          const val = result.value;
          if (val.status === "error") {
            results.failed.push({ userId: val.userId, error: val.error });
          } else {
            // Check if wallet was just created or already existed
            const wallet = val.data?.data || val.data;
            if (wallet && wallet.created_at === wallet.updated_at) {
              results.created.push(val.userId);
            } else {
              results.existing.push(val.userId);
            }
          }
        } else {
          results.failed.push({
            userId: "unknown",
            error: result.reason?.message,
          });
        }
      }

      // Delay between batches to not overwhelm the external API
      if (i + BATCH_SIZE < userIds.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    logger.info("Wallet sync complete", {
      clientCode,
      created: results.created.length,
      existing: results.existing.length,
      failed: results.failed.length,
    });

    return res.json(
      APIResponse.success({
        total: userIds.length,
        created: results.created.length,
        existing: results.existing.length,
        failed: results.failed.length,
        details: results,
      }),
    );
  } catch (error) {
    logger.error("Error syncing wallets:", error);
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message || "Failed to sync wallets",
          error.statusCode || 500,
        ),
      );
  }
}

module.exports = {
  getClientWallets,
  getClientTransactions,
  getWallet,
  updateUserStatus,
  topupWallet,
  debitWallet,
  refundWallet,
  syncWallets,
};
