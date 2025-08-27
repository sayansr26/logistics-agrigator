const walletService = require("../services/walletService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { prisma } = require("../config/database");

/**
 * Get or create wallet for user (AUTO WALLET CREATION - REQUIREMENT)
 */
async function getWallet(req, res) {
  try {
    const { userId } = req.params;
    const clientCode =
      req.query.clientCode || req.body?.clientCode || "DEFAULT";

    logger.debug("Getting wallet", { userId, clientCode });

    const wallet = await walletService.getUserWallet(userId, clientCode);

    // Audit logging (MANDATORY per rules)
    await prisma.auditLog.create({
      data: {
        walletId: wallet.id,
        userId: req.user?.id || "anonymous",
        action: "GET_WALLET",
        resource: "Wallet",
        resourceId: wallet.id,
        details: {
          targetUserId: userId,
          clientCode,
          wasCreated: wallet._count?.transactions === 0, // New wallet indicator
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(APIResponse.success(wallet, "Wallet retrieved successfully"));
  } catch (error) {
    logger.error("Error getting wallet:", error);
    throw error;
  }
}

/**
 * Get wallet balance
 */
async function getBalance(req, res) {
  try {
    const { userId } = req.params;

    logger.debug("Getting wallet balance", { userId });

    const balanceInfo = await walletService.getWalletBalance(userId);

    res.json(
      APIResponse.success(balanceInfo, "Balance retrieved successfully"),
    );
  } catch (error) {
    logger.error("Error getting balance:", error);
    throw error;
  }
}

/**
 * Debit wallet (for shipment charges - REQUIREMENT)
 */
async function debitWallet(req, res) {
  try {
    const { userId } = req.params;
    const { amount, reference, description } = req.body;

    logger.info("Debiting wallet", { userId, amount, reference });

    const transaction = await walletService.debitWallet(
      userId,
      amount,
      reference,
      description,
    );

    // Audit logging (MANDATORY per rules)
    await prisma.auditLog.create({
      data: {
        walletId: transaction.walletId,
        userId: req.user?.id || "system",
        action: "DEBIT_WALLET",
        resource: "Transaction",
        resourceId: transaction.id,
        details: {
          targetUserId: userId,
          amount,
          reference,
          description,
          transactionType: "DEBIT",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(APIResponse.success(transaction, "Wallet debited successfully"));
  } catch (error) {
    logger.error("Error debiting wallet:", error);
    throw error;
  }
}

/**
 * Credit wallet (for refunds - REQUIREMENT)
 */
async function creditWallet(req, res) {
  try {
    const { userId } = req.params;
    const { amount, reference, description } = req.body;

    logger.info("Crediting wallet", { userId, amount, reference });

    const transaction = await walletService.creditWallet(
      userId,
      amount,
      reference,
      description,
    );

    // Audit logging (MANDATORY per rules)
    await prisma.auditLog.create({
      data: {
        walletId: transaction.walletId,
        userId: req.user?.id || "system",
        action: "CREDIT_WALLET",
        resource: "Transaction",
        resourceId: transaction.id,
        details: {
          targetUserId: userId,
          amount,
          reference,
          description,
          transactionType: "CREDIT",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(APIResponse.success(transaction, "Wallet credited successfully"));
  } catch (error) {
    logger.error("Error crediting wallet:", error);
    throw error;
  }
}

/**
 * Get wallet transaction history
 */
async function getTransactions(req, res) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type, status } = req.query;

    logger.debug("Getting wallet transactions", {
      userId,
      page,
      limit,
      type,
      status,
    });

    const transactions = await walletService.getTransactionHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status,
    });

    res.json(
      APIResponse.success(transactions, "Transactions retrieved successfully"),
    );
  } catch (error) {
    logger.error("Error getting transactions:", error);
    throw error;
  }
}

/**
 * Get wallet details with full information
 */
async function getWalletDetails(req, res) {
  try {
    const { userId } = req.params;

    logger.debug("Getting wallet details", { userId });

    const walletDetails = await walletService.getWalletDetails(userId);

    res.json(
      APIResponse.success(
        walletDetails,
        "Wallet details retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting wallet details:", error);
    throw error;
  }
}

/**
 * Admin: Load balance manually (ADMIN ONLY - REQUIREMENT)
 */
async function loadBalance(req, res) {
  try {
    const { userId } = req.params;
    const { amount, reference, description } = req.body;
    const adminId = req.user?.id;

    logger.info("Admin loading balance", {
      userId,
      amount,
      reference,
      adminId,
    });

    const transaction = await walletService.loadBalance(
      userId,
      amount,
      reference,
      description,
      adminId,
    );

    // Audit logging (MANDATORY per rules)
    await prisma.auditLog.create({
      data: {
        walletId: transaction.walletId,
        userId: adminId,
        action: "ADMIN_LOAD_BALANCE",
        resource: "Transaction",
        resourceId: transaction.id,
        details: {
          targetUserId: userId,
          amount,
          reference,
          description,
          transactionType: "ADMIN_LOAD",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(APIResponse.success(transaction, "Balance loaded successfully"));
  } catch (error) {
    logger.error("Error loading balance:", error);
    throw error;
  }
}

/**
 * Admin: Get all wallets (ADMIN ONLY)
 */
async function getAllWallets(req, res) {
  try {
    const { page = 1, limit = 20, status, clientCode } = req.query;

    logger.debug("Admin getting all wallets", {
      page,
      limit,
      status,
      clientCode,
    });

    const wallets = await walletService.getAllWallets({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      clientCode,
    });

    res.json(
      APIResponse.success(wallets, "All wallets retrieved successfully"),
    );
  } catch (error) {
    logger.error("Error getting all wallets:", error);
    throw error;
  }
}

/**
 * Admin: Get all transactions (ADMIN ONLY)
 */
async function getAllTransactions(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      status,
      userId,
      startDate,
      endDate,
    } = req.query;

    logger.debug("Admin getting all transactions", {
      page,
      limit,
      type,
      status,
      userId,
      startDate,
      endDate,
    });

    const transactions = await walletService.getAllTransactions({
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status,
      userId,
      startDate,
      endDate,
    });

    res.json(
      APIResponse.success(
        transactions,
        "All transactions retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting all transactions:", error);
    throw error;
  }
}

/**
 * Initiate payment gateway transaction (FUTURE EXPANSION)
 */
async function initiatePayment(req, res) {
  try {
    const { amount, orderId, returnUrl, userId } = req.body;

    logger.info("Initiating payment gateway transaction", {
      amount,
      orderId,
      userId,
    });

    const paymentTransaction = await walletService.initiatePaymentGateway({
      amount,
      orderId,
      returnUrl,
      userId,
    });

    res.json(
      APIResponse.success(paymentTransaction, "Payment initiated successfully"),
    );
  } catch (error) {
    logger.error("Error initiating payment:", error);
    throw error;
  }
}

/**
 * Handle payment gateway webhook (FUTURE EXPANSION)
 */
async function handlePaymentWebhook(req, res) {
  try {
    const webhookData = req.body;

    logger.info("Processing payment webhook", { webhookData });

    const result = await walletService.processPaymentWebhook(webhookData);

    res.json(APIResponse.success(result, "Webhook processed successfully"));
  } catch (error) {
    logger.error("Error processing webhook:", error);
    throw error;
  }
}

/**
 * Get payment gateway status (FUTURE EXPANSION)
 */
async function getPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;

    logger.debug("Getting payment status", { paymentId });

    const paymentStatus = await walletService.getPaymentStatus(paymentId);

    res.json(
      APIResponse.success(
        paymentStatus,
        "Payment status retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error getting payment status:", error);
    throw error;
  }
}

/**
 * Detailed health check with external service monitoring
 */
async function getDetailedHealth(req, res) {
  try {
    const startTime = Date.now();

    const healthStatus = {
      service: "wallet-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
      dependencies: {},
    };

    let isHealthy = true;

    // Check database connectivity
    try {
      const pgStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const pgTime = Date.now() - pgStart;

      healthStatus.dependencies.postgres = {
        status: "healthy",
        responseTime: pgTime,
      };
    } catch (error) {
      isHealthy = false;
      healthStatus.dependencies.postgres = {
        status: "unhealthy",
        error: error.message,
      };
    }

    // Check external wallet API
    try {
      const {
        getExternalWalletClient,
      } = require("../services/externalWalletClient");
      const externalClient = getExternalWalletClient();
      const externalHealth = await externalClient.healthCheck();

      healthStatus.dependencies.externalWalletAPI = externalHealth;
    } catch (error) {
      healthStatus.dependencies.externalWalletAPI = {
        status: "unhealthy",
        error: error.message,
      };
    }

    healthStatus.responseTime = Date.now() - startTime;

    if (!isHealthy) {
      healthStatus.status = "degraded";
      return res
        .status(503)
        .json(APIResponse.error("Service is degraded", 503, healthStatus));
    }

    res.json(
      APIResponse.success(healthStatus, "Detailed health check completed"),
    );
  } catch (error) {
    logger.error("Error in detailed health check:", error);
    res
      .status(500)
      .json(
        APIResponse.error("Health check failed", 500, { error: error.message }),
      );
  }
}

// Export all functions (auth-service pattern)
module.exports = {
  getWallet,
  getBalance,
  debitWallet,
  creditWallet,
  getTransactions,
  getWalletDetails,
  loadBalance,
  getAllWallets,
  getAllTransactions,
  initiatePayment,
  handlePaymentWebhook,
  getPaymentStatus,
  getDetailedHealth,
};
