const axios = require("axios");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const {
  ValidationError,
  APIError,
  ConflictError,
} = require("../shared/lib/errors");

/**
 * Payment Processing Service for Wallet Integration
 *
 * Follows auth-service patterns with:
 * - Function-based exports (not class-based)
 * - Real Wallet Service API integration
 * - Comprehensive error handling and logging
 * - Circuit breaker pattern for reliability
 * - Redis caching for performance
 * - Audit logging integration
 */

class PaymentProcessingService {
  constructor() {
    this.walletServiceUrl =
      process.env.WALLET_SERVICE_URL || "http://localhost:3006";
    this.timeout = 10000; // 10 second timeout
    this.retryAttempts = 3;
    this.circuitBreakerThreshold = 5;
    this.circuitBreakerTimeout = 60000; // 60 seconds

    // Circuit breaker state
    this.failures = 0;
    this.lastFailureTime = null;
    this.circuitOpen = false;

    // Create axios instance with default config
    this.httpClient = axios.create({
      baseURL: this.walletServiceUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "shipment-service/1.0.0",
        "X-Internal-Request":
          process.env.INTERNAL_SECRET || "internal-service-secret",
        // Service principal: booking-time wallet movement is an action taken
        // BY this service, not by the booking user (who holds only
        // wallet:read:own). The gateway strips this header from inbound client
        // requests, so it can only originate on the internal network.
        "X-Service-Token": process.env.INTERNAL_SECRET || "",
        "X-Service-Name": "shipment-service",
      },
    });

    // Request/Response interceptors for logging and error handling
    this.setupInterceptors();
  }

  /**
   * Set up HTTP interceptors for logging and error handling
   */
  setupInterceptors() {
    // Request interceptor - add authorization header
    this.httpClient.interceptors.request.use(
      (config) => {
        // Add authorization header if available from request context
        const authToken = this.getCurrentAuthToken();
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`;
        }

        logger.debug("Wallet Service request", {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? Object.keys(config.data) : null,
          service: "payment-processing-service",
        });

        return config;
      },
      (error) => {
        logger.error("Wallet Service request error:", error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging and metrics
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug("Wallet Service response", {
          status: response.status,
          url: response.config.url,
          service: "payment-processing-service",
        });

        // Reset circuit breaker on successful response
        this.resetCircuitBreaker();

        return response;
      },
      (error) => {
        this.handleRequestError(error);
        return Promise.reject(error);
      },
    );
  }

  /**
   * Get current auth token from request context
   * This will be set by the caller when making requests
   */
  getCurrentAuthToken() {
    return this.currentAuthToken || null;
  }

  /**
   * Set auth token for requests
   */
  setAuthToken(token) {
    this.currentAuthToken = token;
  }

  /**
   * Handle HTTP request errors and circuit breaker logic
   */
  handleRequestError(error) {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.circuitBreakerThreshold) {
      this.circuitOpen = true;
      logger.warn("Wallet Service circuit breaker opened", {
        failures: this.failures,
        threshold: this.circuitBreakerThreshold,
        service: "payment-processing-service",
      });
    }

    logger.error("Wallet Service error", {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
      service: "payment-processing-service",
    });
  }

  /**
   * Reset circuit breaker on successful requests
   */
  resetCircuitBreaker() {
    if (this.failures > 0) {
      logger.info("Wallet Service circuit breaker reset", {
        previousFailures: this.failures,
        service: "payment-processing-service",
      });
    }
    this.failures = 0;
    this.circuitOpen = false;
    this.lastFailureTime = null;
  }

  /**
   * Check if circuit breaker should allow requests
   */
  isCircuitBreakerOpen() {
    if (!this.circuitOpen) return false;

    // Check if circuit breaker timeout has passed
    if (Date.now() - this.lastFailureTime > this.circuitBreakerTimeout) {
      logger.info(
        "Wallet Service circuit breaker timeout expired, attempting reset",
        {
          service: "payment-processing-service",
        },
      );
      this.circuitOpen = false;
      return false;
    }

    return true;
  }

  /**
   * Make HTTP request with retry logic and circuit breaker
   */
  async makeRequest(config, authToken = null) {
    if (this.isCircuitBreakerOpen()) {
      throw new APIError(
        "Wallet Service temporarily unavailable (circuit breaker open)",
        503,
      );
    }

    // Set auth token for this request
    if (authToken) {
      this.setAuthToken(authToken);
    }

    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.httpClient(config);
        return response.data;
      } catch (error) {
        lastError = error;

        // Don't retry on authentication or validation errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }

        // Don't retry on last attempt
        if (attempt === this.retryAttempts) {
          break;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.warn(`Wallet Service request failed, retrying in ${delay}ms`, {
          attempt,
          maxAttempts: this.retryAttempts,
          error: error.message,
          service: "payment-processing-service",
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries failed, throw the last error
    if (lastError.response?.status === 404) {
      throw new ValidationError("Wallet not found for user");
    } else if (lastError.response?.status === 400) {
      throw new ValidationError(
        lastError.response?.data?.error?.message ||
          "Invalid request to Wallet Service",
      );
    } else if (lastError.response?.status === 409) {
      throw new ConflictError("Insufficient balance or wallet conflict");
    }

    throw new APIError("Wallet Service unavailable after retries", 503, {
      originalError: lastError.message,
    });
  }

  /**
   * Get wallet info via admin endpoint (uses external wallet API with phone-based userId)
   */
  async getUserWallet(userId, clientCode, authToken) {
    const resolvedClientCode =
      clientCode || process.env.DEFAULT_CLIENT_CODE || "LOGISTICS";
    logger.info("Getting user wallet via admin endpoint", {
      userId,
      clientCode: resolvedClientCode,
      service: "payment-processing-service",
    });

    const cacheKey = `wallet:${userId}:${resolvedClientCode}`;
    const redis = getRedisClient();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      logger.warn("Redis cache error, proceeding without cache", {
        error: cacheError.message,
      });
    }

    const response = await this.makeRequest(
      {
        method: "GET",
        url: `/api/v1/wallet/admin/wallet`,
        params: { userId, clientCode: resolvedClientCode },
      },
      authToken,
    );

    const wallet = response.data;

    try {
      await redis.setEx(cacheKey, 300, JSON.stringify(wallet));
    } catch (cacheError) {
      logger.warn("Failed to cache wallet data", { error: cacheError.message });
    }

    logger.info("Wallet retrieved successfully", {
      userId,
      balance: wallet?.wallet?.balance || wallet?.balance,
      service: "payment-processing-service",
    });

    return wallet;
  }

  /**
   * Get wallet balance via admin endpoint
   */
  async getWalletBalance(userId, authToken) {
    logger.debug("Getting wallet balance via admin endpoint", {
      userId,
      service: "payment-processing-service",
    });

    const cacheKey = `balance:${userId}`;
    const redis = getRedisClient();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      logger.warn("Redis cache error, proceeding without cache", {
        error: cacheError.message,
      });
    }

    const walletInfo = await this.getUserWallet(userId, null, authToken);
    const balance = walletInfo?.wallet?.balance ?? walletInfo?.balance ?? 0;

    const balanceInfo = {
      userId,
      balance: parseFloat(balance),
      currency: "INR",
      walletStatus:
        walletInfo?.wallet?.status || walletInfo?.status || "ACTIVE",
    };

    try {
      await redis.setEx(cacheKey, 60, JSON.stringify(balanceInfo));
    } catch (cacheError) {
      logger.warn("Failed to cache balance data", {
        error: cacheError.message,
      });
    }

    return balanceInfo;
  }

  /**
   * Validate sufficient balance for shipment
   */
  async validateSufficientBalance(userId, requiredAmount, authToken) {
    logger.info("Validating sufficient balance", {
      userId,
      requiredAmount,
      service: "payment-processing-service",
    });

    const balanceInfo = await this.getWalletBalance(userId, authToken);
    const availableBalance = parseFloat(balanceInfo.balance);

    if (availableBalance < requiredAmount) {
      logger.warn("Insufficient balance", {
        userId,
        availableBalance,
        requiredAmount,
        shortfall: requiredAmount - availableBalance,
        service: "payment-processing-service",
      });

      throw new ConflictError(
        `Insufficient balance. Available: ₹${availableBalance}, Required: ₹${requiredAmount}`,
        {
          availableBalance,
          requiredAmount,
          shortfall: requiredAmount - availableBalance,
        },
      );
    }

    logger.info("Balance validation successful", {
      userId,
      availableBalance,
      requiredAmount,
      service: "payment-processing-service",
    });

    return {
      valid: true,
      availableBalance,
      requiredAmount,
    };
  }

  /**
   * Debit wallet for shipment charges via admin endpoint
   */
  async debitWalletForShipment(
    userId,
    amount,
    shipmentId,
    description,
    authToken,
  ) {
    logger.info("Debiting wallet for shipment via admin endpoint", {
      userId,
      amount,
      shipmentId,
      service: "payment-processing-service",
    });

    const clientCode = process.env.DEFAULT_CLIENT_CODE || "LOGISTICS";

    const response = await this.makeRequest(
      {
        method: "POST",
        url: `/api/v1/wallet/admin/debit`,
        data: {
          userId,
          clientCode,
          amount,
          reference_id: `SHIPMENT_${shipmentId}`,
          description: description || `Shipment charge for order ${shipmentId}`,
        },
      },
      authToken,
    );

    const transaction = response.data;

    const redis = getRedisClient();
    try {
      await redis.del(`balance:${userId}`);
      await redis.del(`wallet:${userId}:${clientCode}`);
    } catch (cacheError) {
      logger.warn("Failed to clear wallet cache after debit", {
        error: cacheError.message,
      });
    }

    logger.info("Wallet debited successfully", {
      userId,
      amount,
      transactionId: transaction?.id || transaction?.transaction_id,
      service: "payment-processing-service",
    });

    return transaction;
  }

  /**
   * Credit wallet for refunds via admin endpoint
   */
  async creditWalletForRefund(
    userId,
    amount,
    shipmentId,
    description,
    authToken,
  ) {
    logger.info("Crediting wallet for refund via admin endpoint", {
      userId,
      amount,
      shipmentId,
      service: "payment-processing-service",
    });

    const clientCode = process.env.DEFAULT_CLIENT_CODE || "LOGISTICS";

    const response = await this.makeRequest(
      {
        method: "POST",
        url: `/api/v1/wallet/admin/refund`,
        data: {
          userId,
          clientCode,
          amount,
          reference_id: `REFUND_${shipmentId}`,
          description:
            description || `Refund for cancelled shipment ${shipmentId}`,
        },
      },
      authToken,
    );

    const transaction = response.data;

    const redis = getRedisClient();
    try {
      await redis.del(`balance:${userId}`);
      await redis.del(`wallet:${userId}:${clientCode}`);
    } catch (cacheError) {
      logger.warn("Failed to clear wallet cache after credit", {
        error: cacheError.message,
      });
    }

    logger.info("Wallet credited successfully", {
      userId,
      amount,
      transactionId: transaction?.id || transaction?.transaction_id,
      service: "payment-processing-service",
    });

    return transaction;
  }

  /**
   * Process payment for shipment (validation + debit)
   */
  async processShipmentPayment(
    userId,
    amount,
    shipmentId,
    description,
    authToken,
  ) {
    logger.info("Processing shipment payment", {
      userId,
      amount,
      shipmentId,
      service: "payment-processing-service",
    });

    try {
      // Step 1: Validate sufficient balance
      await this.validateSufficientBalance(userId, amount, authToken);

      // Step 2: Debit wallet
      const transaction = await this.debitWalletForShipment(
        userId,
        amount,
        shipmentId,
        description,
        authToken,
      );

      logger.info("Shipment payment processed successfully", {
        userId,
        shipmentId,
        amount,
        transactionId: transaction.id,
        service: "payment-processing-service",
      });

      return {
        success: true,
        transaction,
        paymentReference: transaction.reference,
        walletTransactionId: transaction.id,
      };
    } catch (error) {
      logger.error("Failed to process shipment payment", {
        userId,
        shipmentId,
        amount,
        error: error.message,
        service: "payment-processing-service",
      });

      throw error;
    }
  }

  /**
   * Process refund for cancelled shipment
   */
  async processShipmentRefund(userId, amount, shipmentId, reason, authToken) {
    logger.info("Processing shipment refund", {
      userId,
      amount,
      shipmentId,
      reason,
      service: "payment-processing-service",
    });

    try {
      const description = `Refund for cancelled shipment ${shipmentId}. Reason: ${reason}`;

      const transaction = await this.creditWalletForRefund(
        userId,
        amount,
        shipmentId,
        description,
        authToken,
      );

      logger.info("Shipment refund processed successfully", {
        userId,
        shipmentId,
        amount,
        transactionId: transaction.id,
        service: "payment-processing-service",
      });

      return {
        success: true,
        transaction,
        refundReference: transaction.reference,
        refundTransactionId: transaction.id,
      };
    } catch (error) {
      logger.error("Failed to process shipment refund", {
        userId,
        shipmentId,
        amount,
        error: error.message,
        service: "payment-processing-service",
      });

      throw error;
    }
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(userId, page = 1, limit = 20, authToken) {
    logger.debug("Getting wallet transactions", {
      userId,
      page,
      limit,
      service: "payment-processing-service",
    });

    const response = await this.makeRequest(
      {
        method: "GET",
        url: `/api/v1/wallet/${userId}/transactions`,
        params: { page, limit },
      },
      authToken,
    );

    return response.data;
  }

  /**
   * Health check for Wallet Service integration
   */
  async healthCheck() {
    try {
      const start = Date.now();
      const response = await this.httpClient.get("/health", { timeout: 5000 });
      const responseTime = Date.now() - start;

      return {
        status: "healthy",
        responseTime,
        version: response.data?.version || "unknown",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        note: "Wallet service unavailable, COD shipments still available",
      };
    }
  }
}

// Create singleton instance
const paymentProcessingService = new PaymentProcessingService();

/**
 * Function-based exports following auth-service patterns
 * All functions are async and handle errors appropriately
 */

/**
 * Get or create wallet for user
 */
async function getUserWallet(userId, clientCode, authToken) {
  return paymentProcessingService.getUserWallet(userId, clientCode, authToken);
}

/**
 * Get wallet balance
 */
async function getWalletBalance(userId, authToken) {
  return paymentProcessingService.getWalletBalance(userId, authToken);
}

/**
 * Validate sufficient balance
 */
async function validateSufficientBalance(userId, amount, authToken) {
  return paymentProcessingService.validateSufficientBalance(
    userId,
    amount,
    authToken,
  );
}

/**
 * Process payment for shipment (validation + debit)
 */
async function processShipmentPayment(
  userId,
  amount,
  shipmentId,
  description,
  authToken,
) {
  return paymentProcessingService.processShipmentPayment(
    userId,
    amount,
    shipmentId,
    description,
    authToken,
  );
}

/**
 * Process refund for cancelled shipment
 */
async function processShipmentRefund(
  userId,
  amount,
  shipmentId,
  reason,
  authToken,
) {
  return paymentProcessingService.processShipmentRefund(
    userId,
    amount,
    shipmentId,
    reason,
    authToken,
  );
}

/**
 * Get wallet transactions
 */
async function getWalletTransactions(userId, page, limit, authToken) {
  return paymentProcessingService.getWalletTransactions(
    userId,
    page,
    limit,
    authToken,
  );
}

/**
 * Health check for wallet service integration
 */
async function healthCheck() {
  return paymentProcessingService.healthCheck();
}

// Export functions following auth-service pattern
module.exports = {
  getUserWallet,
  getWalletBalance,
  validateSufficientBalance,
  processShipmentPayment,
  processShipmentRefund,
  getWalletTransactions,
  healthCheck,
};
