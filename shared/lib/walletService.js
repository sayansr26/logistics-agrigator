const logger = require("./logger");

/**
 * Wallet Service Client for External Wallet API Integration
 *
 * Provides secure communication with external wallet service for:
 * - Balance checking and validation
 * - Payment processing (debit/credit/reserve)
 * - Transaction management with audit logging
 * - Comprehensive error handling and retry logic
 */
class WalletServiceClient {
  constructor(options = {}) {
    this.baseURL =
      options.baseURL ||
      process.env.WALLET_SERVICE_URL ||
      "http://localhost:8006";
    this.apiKey = options.apiKey || process.env.WALLET_SERVICE_API_KEY;
    this.timeout = options.timeout || 10000; // 10 seconds
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second

    // Validate required configuration
    if (!this.apiKey) {
      logger.warn("Wallet Service API key not configured", {
        service: "wallet-client",
        baseURL: this.baseURL,
      });
    }
  }

  /**
   * Make authenticated HTTP request to wallet service
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options (method, body, etc.)
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const requestOptions = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Service": "logistics-platform",
        ...options.headers,
      },
      timeout: this.timeout,
      ...options,
    };

    if (options.body && typeof options.body === "object") {
      requestOptions.body = JSON.stringify(options.body);
    }

    let lastError;

    // Retry logic for failed requests
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.info("Making wallet service request", {
          service: "wallet-client",
          url,
          method: requestOptions.method,
          attempt,
          maxAttempts: this.retryAttempts,
        });

        const response = await this.fetchWithTimeout(url, requestOptions);

        if (!response.ok) {
          const errorText = await response.text();
          throw new WalletServiceError(
            `Wallet API error: ${response.status} ${response.statusText}`,
            response.status,
            errorText,
          );
        }

        const data = await response.json();

        logger.info("Wallet service request successful", {
          service: "wallet-client",
          url,
          method: requestOptions.method,
          status: response.status,
          attempt,
        });

        return data;
      } catch (error) {
        lastError = error;

        logger.error("Wallet service request failed", {
          service: "wallet-client",
          url,
          method: requestOptions.method,
          attempt,
          maxAttempts: this.retryAttempts,
          error: error.message,
          stack: error.stack,
        });

        // Don't retry on authentication errors or client errors (4xx)
        if (
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500
        ) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Fetch with timeout support
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new WalletServiceError(
          `Wallet service request timeout after ${this.timeout}ms`,
          408,
          "Request Timeout",
        );
      }
      throw error;
    }
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check user's wallet balance
   * @param {string} userId - User ID
   * @param {string} currency - Currency code (default: INR)
   * @returns {Promise<Object>} Balance information
   */
  async getBalance(userId, currency = "INR") {
    if (!userId) {
      throw new WalletServiceError(
        "User ID is required for balance check",
        400,
      );
    }

    try {
      const response = await this.makeRequest(
        `/api/v1/wallet/balance/${userId}`,
        {
          method: "GET",
          headers: {
            "X-Currency": currency,
          },
        },
      );

      return {
        success: true,
        data: {
          userId,
          currency,
          balance: response.balance || 0,
          availableBalance: response.availableBalance || 0,
          reservedBalance: response.reservedBalance || 0,
          lastUpdated: response.lastUpdated || new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to get wallet balance", {
        service: "wallet-client",
        userId,
        currency,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reserve amount in user's wallet for pending transaction
   * @param {string} userId - User ID
   * @param {number} amount - Amount to reserve
   * @param {string} currency - Currency code
   * @param {string} reference - Transaction reference
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} Reservation result
   */
  async reserveAmount(
    userId,
    amount,
    currency = "INR",
    reference,
    metadata = {},
  ) {
    if (!userId || !amount || !reference) {
      throw new WalletServiceError(
        "User ID, amount, and reference are required",
        400,
      );
    }

    if (amount <= 0) {
      throw new WalletServiceError("Amount must be greater than zero", 400);
    }

    try {
      const response = await this.makeRequest("/api/v1/wallet/reserve", {
        method: "POST",
        body: {
          userId,
          amount,
          currency,
          reference,
          metadata: {
            service: "logistics-platform",
            timestamp: new Date().toISOString(),
            ...metadata,
          },
        },
      });

      logger.info("Amount reserved successfully", {
        service: "wallet-client",
        userId,
        amount,
        currency,
        reference,
        reservationId: response.reservationId,
      });

      return {
        success: true,
        data: {
          reservationId: response.reservationId,
          userId,
          amount,
          currency,
          reference,
          status: "reserved",
          expiresAt: response.expiresAt,
          createdAt: response.createdAt || new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to reserve amount", {
        service: "wallet-client",
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
   * Debit amount from user's wallet
   * @param {string} userId - User ID
   * @param {number} amount - Amount to debit
   * @param {string} currency - Currency code
   * @param {string} reference - Transaction reference
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} Debit result
   */
  async debitAmount(
    userId,
    amount,
    currency = "INR",
    reference,
    metadata = {},
  ) {
    if (!userId || !amount || !reference) {
      throw new WalletServiceError(
        "User ID, amount, and reference are required",
        400,
      );
    }

    if (amount <= 0) {
      throw new WalletServiceError("Amount must be greater than zero", 400);
    }

    try {
      const response = await this.makeRequest("/api/v1/wallet/debit", {
        method: "POST",
        body: {
          userId,
          amount,
          currency,
          reference,
          metadata: {
            service: "logistics-platform",
            timestamp: new Date().toISOString(),
            ...metadata,
          },
        },
      });

      logger.info("Amount debited successfully", {
        service: "wallet-client",
        userId,
        amount,
        currency,
        reference,
        transactionId: response.transactionId,
      });

      return {
        success: true,
        data: {
          transactionId: response.transactionId,
          userId,
          amount,
          currency,
          reference,
          status: "completed",
          balanceAfter: response.balanceAfter,
          createdAt: response.createdAt || new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to debit amount", {
        service: "wallet-client",
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
   * Credit amount to user's wallet
   * @param {string} userId - User ID
   * @param {number} amount - Amount to credit
   * @param {string} currency - Currency code
   * @param {string} reference - Transaction reference
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} Credit result
   */
  async creditAmount(
    userId,
    amount,
    currency = "INR",
    reference,
    metadata = {},
  ) {
    if (!userId || !amount || !reference) {
      throw new WalletServiceError(
        "User ID, amount, and reference are required",
        400,
      );
    }

    if (amount <= 0) {
      throw new WalletServiceError("Amount must be greater than zero", 400);
    }

    try {
      const response = await this.makeRequest("/api/v1/wallet/credit", {
        method: "POST",
        body: {
          userId,
          amount,
          currency,
          reference,
          metadata: {
            service: "logistics-platform",
            timestamp: new Date().toISOString(),
            ...metadata,
          },
        },
      });

      logger.info("Amount credited successfully", {
        service: "wallet-client",
        userId,
        amount,
        currency,
        reference,
        transactionId: response.transactionId,
      });

      return {
        success: true,
        data: {
          transactionId: response.transactionId,
          userId,
          amount,
          currency,
          reference,
          status: "completed",
          balanceAfter: response.balanceAfter,
          createdAt: response.createdAt || new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to credit amount", {
        service: "wallet-client",
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
   * Confirm reserved amount (convert reservation to actual debit)
   * @param {string} reservationId - Reservation ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmReservation(reservationId, metadata = {}) {
    if (!reservationId) {
      throw new WalletServiceError("Reservation ID is required", 400);
    }

    try {
      const response = await this.makeRequest(
        `/api/v1/wallet/reserve/${reservationId}/confirm`,
        {
          method: "POST",
          body: {
            metadata: {
              service: "logistics-platform",
              timestamp: new Date().toISOString(),
              ...metadata,
            },
          },
        },
      );

      logger.info("Reservation confirmed successfully", {
        service: "wallet-client",
        reservationId,
        transactionId: response.transactionId,
      });

      return {
        success: true,
        data: {
          reservationId,
          transactionId: response.transactionId,
          status: "confirmed",
          confirmedAt: response.confirmedAt || new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to confirm reservation", {
        service: "wallet-client",
        reservationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel reserved amount (release reservation)
   * @param {string} reservationId - Reservation ID
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelReservation(reservationId, metadata = {}) {
    if (!reservationId) {
      throw new WalletServiceError("Reservation ID is required", 400);
    }

    try {
      const response = await this.makeRequest(
        `/api/v1/wallet/reserve/${reservationId}/cancel`,
        {
          method: "POST",
          body: {
            metadata: {
              service: "logistics-platform",
              timestamp: new Date().toISOString(),
              ...metadata,
            },
          },
        },
      );

      logger.info("Reservation cancelled successfully", {
        service: "wallet-client",
        reservationId,
      });

      return {
        success: true,
        data: {
          reservationId,
          status: "cancelled",
          cancelledAt: response.cancelledAt || new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to cancel reservation", {
        service: "wallet-client",
        reservationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get transaction history for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options (limit, offset, dateFrom, dateTo)
   * @returns {Promise<Object>} Transaction history
   */
  async getTransactionHistory(userId, options = {}) {
    if (!userId) {
      throw new WalletServiceError("User ID is required", 400);
    }

    const queryParams = new URLSearchParams();
    if (options.limit) queryParams.append("limit", options.limit);
    if (options.offset) queryParams.append("offset", options.offset);
    if (options.dateFrom) queryParams.append("dateFrom", options.dateFrom);
    if (options.dateTo) queryParams.append("dateTo", options.dateTo);

    try {
      const response = await this.makeRequest(
        `/api/v1/wallet/transactions/${userId}?${queryParams.toString()}`,
        { method: "GET" },
      );

      return {
        success: true,
        data: {
          userId,
          transactions: response.transactions || [],
          total: response.total || 0,
          limit: options.limit || 50,
          offset: options.offset || 0,
        },
      };
    } catch (error) {
      logger.error("Failed to get transaction history", {
        service: "wallet-client",
        userId,
        options,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Health check for wallet service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest("/health", {
        method: "GET",
      });

      return {
        success: true,
        data: {
          status: "healthy",
          service: "wallet-service",
          timestamp: new Date().toISOString(),
          ...response,
        },
      };
    } catch (error) {
      logger.error("Wallet service health check failed", {
        service: "wallet-client",
        error: error.message,
      });

      return {
        success: false,
        error: {
          message: "Wallet service unavailable",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

/**
 * Custom error class for wallet service errors
 */
class WalletServiceError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "WalletServiceError";
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Create singleton instance
let walletServiceInstance = null;

/**
 * Get wallet service client instance
 * @param {Object} options - Configuration options
 * @returns {WalletServiceClient} Wallet service client
 */
function getWalletServiceClient(options = {}) {
  if (!walletServiceInstance) {
    walletServiceInstance = new WalletServiceClient(options);
  }
  return walletServiceInstance;
}

module.exports = {
  WalletServiceClient,
  WalletServiceError,
  getWalletServiceClient,
};
