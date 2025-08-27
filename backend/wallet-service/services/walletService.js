const { prisma } = require("../config/database");
const { getRedisClient } = require("../config/redis");
const logger = require("../shared/lib/logger");
const { ValidationError } = require("../shared/lib/errors");

// Custom error for insufficient funds
class InsufficientFundsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InsufficientFundsError";
    this.statusCode = 400;
  }
}
const { getExternalWalletClient } = require("./externalWalletClient");

/**
 * Get user wallet, create if doesn't exist (AUTO WALLET CREATION - REQUIREMENT)
 * @param {string} userId - User ID
 * @param {string} clientCode - Client code (optional)
 * @returns {Promise<Object>} Wallet object
 */
async function getUserWallet(userId, clientCode = "DEFAULT") {
  try {
    if (!userId) {
      throw new ValidationError("User ID is required");
    }

    logger.debug("Getting wallet for user", { userId, clientCode });

    // Check cache first
    const redis = getRedisClient();
    const cacheKey = `wallet:${userId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      logger.debug("Wallet found in cache", { userId });
      return JSON.parse(cached);
    }

    // Check database
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5, // Last 5 transactions for context
        },
        _count: {
          select: {
            transactions: true,
            paymentGateways: true,
          },
        },
      },
    });

    // AUTO-CREATE WALLET IF DOESN'T EXIST (CRITICAL REQUIREMENT)
    if (!wallet) {
      logger.info("Wallet not found, creating new wallet", {
        userId,
        clientCode,
      });
      wallet = await createWalletForUser(userId, clientCode);
    }

    // Cache wallet for 10 minutes
    await redis.setex(cacheKey, 600, JSON.stringify(wallet));

    logger.debug("Wallet retrieved successfully", {
      userId,
      walletId: wallet.id,
      balance: wallet.balance,
    });

    return wallet;
  } catch (error) {
    logger.error("Error getting user wallet", { userId, error: error.message });
    throw error;
  }
}

/**
 * Create wallet for user (internal function)
 * @param {string} userId - User ID
 * @param {string} clientCode - Client code
 * @returns {Promise<Object>} Created wallet
 */
async function createWalletForUser(userId, clientCode = "DEFAULT") {
  try {
    logger.info("Creating new wallet for user", { userId, clientCode });

    // Create external wallet first
    const externalClient = getExternalWalletClient();
    let externalWalletId = null;

    try {
      const externalWallet = await externalClient.createWallet(
        userId,
        clientCode,
      );
      externalWalletId = externalWallet.walletId || externalWallet.id;
      logger.info("External wallet created", { userId, externalWalletId });
    } catch (error) {
      logger.warn(
        "Failed to create external wallet, proceeding with local wallet",
        {
          userId,
          error: error.message,
        },
      );
      // Continue without external wallet - service should be resilient
    }

    // Create local wallet record
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 0,
        externalWalletId,
        clientCode,
        status: "ACTIVE",
        metadata: {
          createdSource: "auto-creation",
          externalWalletStatus: externalWalletId ? "linked" : "unlinked",
        },
      },
      include: {
        transactions: true,
        _count: {
          select: {
            transactions: true,
            paymentGateways: true,
          },
        },
      },
    });

    // Clear user cache
    const redis = getRedisClient();
    await redis.del(`wallet:${userId}`);

    logger.info("Wallet created successfully", {
      userId,
      walletId: wallet.id,
      externalWalletId: wallet.externalWalletId,
    });

    return wallet;
  } catch (error) {
    logger.error("Error creating wallet for user", {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get wallet balance (with external sync if available)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Balance information
 */
async function getWalletBalance(userId) {
  try {
    logger.debug("Getting wallet balance", { userId });

    const wallet = await getUserWallet(userId);
    let externalBalance = null;

    // Try to get external balance if external wallet exists
    if (wallet.externalWalletId) {
      try {
        const externalClient = getExternalWalletClient();
        const externalData = await externalClient.getWalletBalance(
          wallet.externalWalletId,
        );
        externalBalance = externalData.balance;

        // Update local balance if external balance differs significantly
        const balanceDiff = Math.abs(
          parseFloat(wallet.balance) - parseFloat(externalBalance),
        );
        if (balanceDiff > 0.01) {
          // More than 1 paisa difference
          logger.warn("Balance mismatch detected", {
            userId,
            localBalance: wallet.balance,
            externalBalance,
            difference: balanceDiff,
          });

          // Optional: sync balance (uncomment if needed)
          // await prisma.wallet.update({
          //   where: { id: wallet.id },
          //   data: { balance: externalBalance },
          // });
        }
      } catch (error) {
        logger.warn("Failed to get external balance", {
          userId,
          error: error.message,
        });
      }
    }

    const balanceInfo = {
      userId,
      walletId: wallet.id,
      balance: wallet.balance,
      externalBalance,
      currency: "INR",
      status: wallet.status,
      lastUpdated: wallet.updatedAt,
      externalWalletLinked: !!wallet.externalWalletId,
    };

    return balanceInfo;
  } catch (error) {
    logger.error("Error getting wallet balance", {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Debit wallet (for shipment charges - REQUIREMENT)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to debit
 * @param {string} reference - Reference (shipment ID, order ID, etc.)
 * @param {string} description - Transaction description
 * @returns {Promise<Object>} Transaction record
 */
async function debitWallet(userId, amount, reference, description = null) {
  try {
    if (!userId || !amount || !reference) {
      throw new ValidationError("User ID, amount, and reference are required");
    }

    if (amount <= 0) {
      throw new ValidationError("Debit amount must be positive");
    }

    logger.info("Debiting wallet", { userId, amount, reference });

    const wallet = await getUserWallet(userId);

    // Check if wallet has sufficient balance
    if (parseFloat(wallet.balance) < amount) {
      throw new InsufficientFundsError(
        `Insufficient balance. Available: ${wallet.balance}, Required: ${amount}`,
      );
    }

    // Process external debit first if external wallet exists
    let externalTransactionId = null;
    if (wallet.externalWalletId) {
      try {
        const externalClient = getExternalWalletClient();
        const externalTx = await externalClient.debitWallet(
          wallet.externalWalletId,
          amount,
          reference,
          description,
        );
        externalTransactionId = externalTx.transactionId;
        logger.info("External wallet debited", {
          userId,
          externalTransactionId,
        });
      } catch (error) {
        logger.error("External debit failed", { userId, error: error.message });
        throw error; // Fail the transaction if external debit fails
      }
    }

    // Create local transaction and update balance
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          amount,
          description: description || `Debit for ${reference}`,
          reference,
          status: "COMPLETED",
          metadata: {
            externalTransactionId,
            processedAt: new Date().toISOString(),
          },
        },
      });

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      return { transaction, wallet: updatedWallet };
    });

    // Clear cache
    const redis = getRedisClient();
    await redis.del(`wallet:${userId}`);
    await redis.del(`wallet_transactions:${userId}:*`);

    logger.info("Wallet debited successfully", {
      userId,
      amount,
      reference,
      transactionId: result.transaction.id,
      newBalance: result.wallet.balance,
    });

    return result.transaction;
  } catch (error) {
    logger.error("Error debiting wallet", {
      userId,
      amount,
      reference,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Credit wallet (for refunds - REQUIREMENT)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to credit
 * @param {string} reference - Reference (refund ID, adjustment ID, etc.)
 * @param {string} description - Transaction description
 * @returns {Promise<Object>} Transaction record
 */
async function creditWallet(userId, amount, reference, description = null) {
  try {
    if (!userId || !amount || !reference) {
      throw new ValidationError("User ID, amount, and reference are required");
    }

    if (amount <= 0) {
      throw new ValidationError("Credit amount must be positive");
    }

    logger.info("Crediting wallet", { userId, amount, reference });

    const wallet = await getUserWallet(userId);

    // Process external credit first if external wallet exists
    let externalTransactionId = null;
    if (wallet.externalWalletId) {
      try {
        const externalClient = getExternalWalletClient();
        const externalTx = await externalClient.creditWallet(
          wallet.externalWalletId,
          amount,
          reference,
          description,
        );
        externalTransactionId = externalTx.transactionId;
        logger.info("External wallet credited", {
          userId,
          externalTransactionId,
        });
      } catch (error) {
        logger.warn("External credit failed, continuing with local credit", {
          userId,
          error: error.message,
        });
        // Don't fail the transaction if external credit fails for refunds
      }
    }

    // Create local transaction and update balance
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          amount,
          description: description || `Credit for ${reference}`,
          reference,
          status: "COMPLETED",
          metadata: {
            externalTransactionId,
            processedAt: new Date().toISOString(),
          },
        },
      });

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      return { transaction, wallet: updatedWallet };
    });

    // Clear cache
    const redis = getRedisClient();
    await redis.del(`wallet:${userId}`);
    await redis.del(`wallet_transactions:${userId}:*`);

    logger.info("Wallet credited successfully", {
      userId,
      amount,
      reference,
      transactionId: result.transaction.id,
      newBalance: result.wallet.balance,
    });

    return result.transaction;
  } catch (error) {
    logger.error("Error crediting wallet", {
      userId,
      amount,
      reference,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Load balance manually (Admin only - REQUIREMENT)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to load
 * @param {string} reference - Reference for the balance load
 * @param {string} description - Description
 * @param {string} adminUserId - Admin user ID who is loading the balance
 * @returns {Promise<Object>} Transaction record
 */
async function loadBalance(
  userId,
  amount,
  reference,
  description = null,
  adminUserId = null,
) {
  try {
    if (!userId || !amount || !reference) {
      throw new ValidationError("User ID, amount, and reference are required");
    }

    if (amount <= 0) {
      throw new ValidationError("Load amount must be positive");
    }

    logger.info("Loading balance (admin operation)", {
      userId,
      amount,
      reference,
      adminUserId,
    });

    const wallet = await getUserWallet(userId);

    // Create local transaction and update balance
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "LOAD_BALANCE",
          amount,
          description: description || `Balance loaded by admin - ${reference}`,
          reference,
          status: "COMPLETED",
          metadata: {
            adminUserId,
            loadType: "manual",
            processedAt: new Date().toISOString(),
          },
        },
      });

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      return { transaction, wallet: updatedWallet };
    });

    // Clear cache
    const redis = getRedisClient();
    await redis.del(`wallet:${userId}`);
    await redis.del(`wallet_transactions:${userId}:*`);

    logger.info("Balance loaded successfully", {
      userId,
      amount,
      reference,
      adminUserId,
      transactionId: result.transaction.id,
      newBalance: result.wallet.balance,
    });

    return result.transaction;
  } catch (error) {
    logger.error("Error loading balance", {
      userId,
      amount,
      reference,
      adminUserId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get wallet transaction history with pagination
 * @param {string} userId - User ID
 * @param {Object} options - Query options (page, limit, type, status, etc.)
 * @returns {Promise<Object>} Paginated transaction history
 */
async function getTransactionHistory(userId, options = {}) {
  try {
    const {
      page = 1,
      limit = 20,
      type = null,
      status = null,
      reference = null,
      startDate = null,
      endDate = null,
    } = options;

    logger.debug("Getting transaction history", { userId, options });

    const wallet = await getUserWallet(userId);

    // Build where clause
    const where = {
      walletId: wallet.id,
      ...(type && { type }),
      ...(status && { status }),
      ...(reference && {
        reference: { contains: reference, mode: "insensitive" },
      }),
      ...(startDate &&
        endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    // Get total count
    const total = await prisma.transaction.count({ where });

    // Get paginated transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    const result = {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        status: wallet.status,
      },
    };

    return result;
  } catch (error) {
    logger.error("Error getting transaction history", {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get all wallets (Admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated wallets list
 */
async function getAllWallets(options = {}) {
  try {
    const {
      page = 1,
      limit = 50,
      status = null,
      clientCode = null,
      searchUserId = null,
    } = options;

    logger.debug("Getting all wallets (admin)", { options });

    // Build where clause
    const where = {
      ...(status && { status }),
      ...(clientCode && { clientCode }),
      ...(searchUserId && {
        userId: { contains: searchUserId, mode: "insensitive" },
      }),
    };

    // Get total count
    const total = await prisma.wallet.count({ where });

    // Get paginated wallets
    const wallets = await prisma.wallet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: {
            transactions: true,
            paymentGateways: true,
          },
        },
      },
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    const result = {
      wallets,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };

    return result;
  } catch (error) {
    logger.error("Error getting all wallets", { error: error.message });
    throw error;
  }
}

/**
 * Get all transactions (Admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated transactions list
 */
async function getAllTransactions(options = {}) {
  try {
    const {
      page = 1,
      limit = 50,
      type = null,
      status = null,
      userId = null,
      reference = null,
      startDate = null,
      endDate = null,
    } = options;

    logger.debug("Getting all transactions (admin)", { options });

    // Build where clause
    const where = {
      ...(type && { type }),
      ...(status && { status }),
      ...(reference && {
        reference: { contains: reference, mode: "insensitive" },
      }),
      ...(startDate &&
        endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(userId && {
        wallet: {
          userId: { contains: userId, mode: "insensitive" },
        },
      }),
    };

    // Get total count
    const total = await prisma.transaction.count({ where });

    // Get paginated transactions
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        wallet: {
          select: {
            id: true,
            userId: true,
            clientCode: true,
          },
        },
      },
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    const result = {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };

    return result;
  } catch (error) {
    logger.error("Error getting all transactions", { error: error.message });
    throw error;
  }
}

module.exports = {
  getUserWallet,
  createWalletForUser,
  getWalletBalance,
  debitWallet,
  creditWallet,
  loadBalance,
  getTransactionHistory,
  getAllWallets,
  getAllTransactions,
};
