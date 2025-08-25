const {
  getWalletServiceClient,
  WalletServiceError,
} = require("./walletService");
const logger = require("./logger");
const APIResponse = require("./response");

/**
 * Wallet Middleware for Balance Validation and Payment Processing
 *
 * Provides middleware functions for:
 * - Balance validation before processing orders
 * - Payment reservation and confirmation
 * - Transaction audit logging
 * - Error handling for wallet operations
 */

/**
 * Middleware to check if user has sufficient balance
 * @param {number} requiredAmount - Minimum required amount
 * @param {string} currency - Currency code (default: INR)
 * @returns {Function} Express middleware function
 */
function requireSufficientBalance(requiredAmount, currency = "INR") {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json(
            APIResponse.error(
              "Authentication required for balance check",
              "UNAUTHORIZED",
            ),
          );
      }

      // If requiredAmount is a function, call it with request data
      const amount =
        typeof requiredAmount === "function"
          ? requiredAmount(req)
          : requiredAmount;

      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json(
            APIResponse.error(
              "Invalid amount for balance check",
              "INVALID_AMOUNT",
            ),
          );
      }

      const walletClient = getWalletServiceClient();

      logger.info("Checking wallet balance", {
        service: "wallet-middleware",
        userId,
        requiredAmount: amount,
        currency,
        endpoint: req.path,
      });

      const balanceResult = await walletClient.getBalance(userId, currency);

      if (!balanceResult.success) {
        logger.error("Failed to check wallet balance", {
          service: "wallet-middleware",
          userId,
          error: balanceResult.error,
        });

        return res
          .status(503)
          .json(
            APIResponse.error(
              "Wallet service unavailable",
              "WALLET_SERVICE_ERROR",
            ),
          );
      }

      const { balance, availableBalance } = balanceResult.data;

      // Check if user has sufficient available balance
      if (availableBalance < amount) {
        logger.warn("Insufficient wallet balance", {
          service: "wallet-middleware",
          userId,
          requiredAmount: amount,
          availableBalance,
          currency,
        });

        return res.status(402).json(
          APIResponse.error(
            `Insufficient balance. Required: ${amount} ${currency}, Available: ${availableBalance} ${currency}`,
            "INSUFFICIENT_BALANCE",
            {
              requiredAmount: amount,
              availableBalance,
              currency,
              shortfall: amount - availableBalance,
            },
          ),
        );
      }

      // Add wallet info to request for downstream use
      req.walletInfo = {
        userId,
        balance,
        availableBalance,
        currency,
        checkedAmount: amount,
        timestamp: new Date().toISOString(),
      };

      logger.info("Balance check passed", {
        service: "wallet-middleware",
        userId,
        requiredAmount: amount,
        availableBalance,
        currency,
      });

      next();
    } catch (error) {
      logger.error("Balance check middleware error", {
        service: "wallet-middleware",
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof WalletServiceError) {
        return res.status(error.statusCode || 503).json(
          APIResponse.error(error.message, "WALLET_SERVICE_ERROR", {
            details: error.details,
          }),
        );
      }

      return res
        .status(500)
        .json(
          APIResponse.error(
            "Internal error during balance check",
            "INTERNAL_ERROR",
          ),
        );
    }
  };
}

/**
 * Middleware to reserve amount in user's wallet
 * @param {number|Function} amount - Amount to reserve or function to calculate amount
 * @param {string} currency - Currency code (default: INR)
 * @param {Function} getReferenceId - Function to generate reference ID from request
 * @returns {Function} Express middleware function
 */
function reserveWalletAmount(amount, currency = "INR", getReferenceId) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json(
            APIResponse.error(
              "Authentication required for payment reservation",
              "UNAUTHORIZED",
            ),
          );
      }

      // Calculate amount if it's a function
      const reserveAmount = typeof amount === "function" ? amount(req) : amount;

      if (!reserveAmount || reserveAmount <= 0) {
        return res
          .status(400)
          .json(
            APIResponse.error(
              "Invalid amount for reservation",
              "INVALID_AMOUNT",
            ),
          );
      }

      // Generate reference ID
      const referenceId = getReferenceId
        ? getReferenceId(req)
        : `${Date.now()}-${userId}`;

      const walletClient = getWalletServiceClient();

      logger.info("Reserving wallet amount", {
        service: "wallet-middleware",
        userId,
        amount: reserveAmount,
        currency,
        referenceId,
        endpoint: req.path,
      });

      const reservationResult = await walletClient.reserveAmount(
        userId,
        reserveAmount,
        currency,
        referenceId,
        {
          endpoint: req.path,
          userAgent: req.get("User-Agent"),
          ipAddress: req.ip,
          requestId: req.id,
        },
      );

      if (!reservationResult.success) {
        logger.error("Failed to reserve wallet amount", {
          service: "wallet-middleware",
          userId,
          amount: reserveAmount,
          referenceId,
          error: reservationResult.error,
        });

        return res
          .status(503)
          .json(
            APIResponse.error(
              "Failed to reserve payment",
              "PAYMENT_RESERVATION_FAILED",
            ),
          );
      }

      // Add reservation info to request
      req.walletReservation = {
        reservationId: reservationResult.data.reservationId,
        userId,
        amount: reserveAmount,
        currency,
        referenceId,
        status: "reserved",
        createdAt: reservationResult.data.createdAt,
        expiresAt: reservationResult.data.expiresAt,
      };

      logger.info("Wallet amount reserved successfully", {
        service: "wallet-middleware",
        userId,
        amount: reserveAmount,
        currency,
        referenceId,
        reservationId: reservationResult.data.reservationId,
      });

      next();
    } catch (error) {
      logger.error("Wallet reservation middleware error", {
        service: "wallet-middleware",
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof WalletServiceError) {
        return res.status(error.statusCode || 503).json(
          APIResponse.error(error.message, "WALLET_SERVICE_ERROR", {
            details: error.details,
          }),
        );
      }

      return res
        .status(500)
        .json(
          APIResponse.error(
            "Internal error during payment reservation",
            "INTERNAL_ERROR",
          ),
        );
    }
  };
}

/**
 * Utility function to confirm wallet reservation
 * @param {string} reservationId - Reservation ID to confirm
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Confirmation result
 */
async function confirmWalletReservation(reservationId, metadata = {}) {
  try {
    const walletClient = getWalletServiceClient();

    logger.info("Confirming wallet reservation", {
      service: "wallet-middleware",
      reservationId,
      metadata,
    });

    const result = await walletClient.confirmReservation(
      reservationId,
      metadata,
    );

    if (result.success) {
      logger.info("Wallet reservation confirmed", {
        service: "wallet-middleware",
        reservationId,
        transactionId: result.data.transactionId,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to confirm wallet reservation", {
      service: "wallet-middleware",
      reservationId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Utility function to cancel wallet reservation
 * @param {string} reservationId - Reservation ID to cancel
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelWalletReservation(reservationId, metadata = {}) {
  try {
    const walletClient = getWalletServiceClient();

    logger.info("Cancelling wallet reservation", {
      service: "wallet-middleware",
      reservationId,
      metadata,
    });

    const result = await walletClient.cancelReservation(
      reservationId,
      metadata,
    );

    if (result.success) {
      logger.info("Wallet reservation cancelled", {
        service: "wallet-middleware",
        reservationId,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to cancel wallet reservation", {
      service: "wallet-middleware",
      reservationId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Utility function to process direct wallet debit
 * @param {string} userId - User ID
 * @param {number} amount - Amount to debit
 * @param {string} currency - Currency code
 * @param {string} reference - Transaction reference
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Debit result
 */
async function debitWalletAmount(
  userId,
  amount,
  currency = "INR",
  reference,
  metadata = {},
) {
  try {
    const walletClient = getWalletServiceClient();

    logger.info("Processing wallet debit", {
      service: "wallet-middleware",
      userId,
      amount,
      currency,
      reference,
    });

    const result = await walletClient.debitAmount(
      userId,
      amount,
      currency,
      reference,
      metadata,
    );

    if (result.success) {
      logger.info("Wallet debit processed", {
        service: "wallet-middleware",
        userId,
        amount,
        currency,
        reference,
        transactionId: result.data.transactionId,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to process wallet debit", {
      service: "wallet-middleware",
      userId,
      amount,
      currency,
      reference,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Utility function to process wallet credit
 * @param {string} userId - User ID
 * @param {number} amount - Amount to credit
 * @param {string} currency - Currency code
 * @param {string} reference - Transaction reference
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Credit result
 */
async function creditWalletAmount(
  userId,
  amount,
  currency = "INR",
  reference,
  metadata = {},
) {
  try {
    const walletClient = getWalletServiceClient();

    logger.info("Processing wallet credit", {
      service: "wallet-middleware",
      userId,
      amount,
      currency,
      reference,
    });

    const result = await walletClient.creditAmount(
      userId,
      amount,
      currency,
      reference,
      metadata,
    );

    if (result.success) {
      logger.info("Wallet credit processed", {
        service: "wallet-middleware",
        userId,
        amount,
        currency,
        reference,
        transactionId: result.data.transactionId,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to process wallet credit", {
      service: "wallet-middleware",
      userId,
      amount,
      currency,
      reference,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Middleware to handle wallet errors and cleanup
 * @returns {Function} Express error middleware function
 */
function walletErrorHandler() {
  return (error, req, res, next) => {
    // If there's a wallet reservation that needs cleanup
    if (req.walletReservation && error) {
      const { reservationId } = req.walletReservation;

      // Async cleanup - don't wait for it
      cancelWalletReservation(reservationId, {
        reason: "error_cleanup",
        error: error.message,
        timestamp: new Date().toISOString(),
      }).catch((cleanupError) => {
        logger.error("Failed to cleanup wallet reservation", {
          service: "wallet-middleware",
          reservationId,
          originalError: error.message,
          cleanupError: cleanupError.message,
        });
      });
    }

    // Pass error to next error handler
    next(error);
  };
}

module.exports = {
  requireSufficientBalance,
  reserveWalletAmount,
  confirmWalletReservation,
  cancelWalletReservation,
  debitWalletAmount,
  creditWalletAmount,
  walletErrorHandler,
};
