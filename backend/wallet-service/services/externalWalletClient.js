const crypto = require("crypto");
const axios = require("axios");
const CircuitBreaker = require("opossum");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const { APIError } = require("../shared/lib/errors");

class ExternalWalletClient {
  constructor() {
    this.baseURL =
      process.env.EXTERNAL_WALLET_API_URL ||
      "https://wapi.websiteduniya.com/api/v1";
    this.secretKey =
      process.env.EXTERNAL_WALLET_SECRET_KEY ||
      "production-hmac-secret-key-256-bit-minimum-ultra-secure-change-me";
    this.userId = process.env.EXTERNAL_WALLET_USER_ID || "wallet-service";
    this.jwtToken = process.env.EXTERNAL_WALLET_JWT_TOKEN || "";

    // HTTP client configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // Circuit breaker configuration
    const breakerOptions = {
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 50, // Open circuit when 50% of requests fail
      resetTimeout: 60000, // Try again after 1 minute
      volumeThreshold: 10, // Need at least 10 requests before calculating failure rate
      name: "ExternalWalletAPI",
    };

    this.circuitBreaker = new CircuitBreaker(
      this._makeRequest.bind(this),
      breakerOptions,
    );

    // Circuit breaker event handlers
    this.circuitBreaker.on("open", () => {
      logger.error("🔴 External Wallet API circuit breaker OPEN");
    });

    this.circuitBreaker.on("halfOpen", () => {
      logger.warn("🟡 External Wallet API circuit breaker HALF-OPEN");
    });

    this.circuitBreaker.on("close", () => {
      logger.info("🟢 External Wallet API circuit breaker CLOSED");
    });

    this.circuitBreaker.on("fallback", (result) => {
      logger.warn("🔄 External Wallet API fallback triggered", { result });
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug("External Wallet API Request", {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL,
        });
        return config;
      },
      (error) => {
        logger.error("External Wallet API Request Error", error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug("External Wallet API Response", {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error("External Wallet API Response Error", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.response?.data?.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Generate HMAC signature following the Postman script pattern
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path
   * @param {string} rawBody - Raw request body (empty string if no body)
   * @param {number} timestamp - Unix timestamp
   * @returns {Object} Signature data with headers
   */
  generateHMACSignature(method, path, rawBody = "", timestamp = null) {
    try {
      // Generate timestamp if not provided
      if (!timestamp) {
        timestamp = Math.floor(Date.now() / 1000);
      }

      // Generate request ID
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Optional Body Hash (only if body exists)
      let bodyHash = "";
      if (rawBody && rawBody.trim()) {
        bodyHash = crypto
          .createHash("sha256")
          .update(rawBody)
          .digest("hex")
          .toLowerCase();
      }

      // Construct HMAC Payload: method:path:timestamp[:bodyHash]
      let payload = `${method.toUpperCase()}:${path}:${timestamp}`;
      if (bodyHash) {
        payload += `:${bodyHash}`;
      }

      // Signed Payload: timestamp:payload
      const signedPayload = `${timestamp}:${payload}`;

      // Generate HMAC-SHA256 signature
      const hmac = crypto.createHmac("sha256", this.secretKey);
      hmac.update(signedPayload);
      const signature = hmac.digest("base64");

      // Formatted signature: t=timestamp,v1=signature
      const formattedSignature = `t=${timestamp},v1=${signature}`;

      // Prepare headers
      const headers = {
        "X-Wallet-Signature": formattedSignature,
        "X-Timestamp": String(timestamp),
        "X-Request-ID": requestId,
        "X-User-ID": this.userId,
      };

      // Add Authorization header if JWT token is available
      if (this.jwtToken) {
        headers["Authorization"] = `Bearer ${this.jwtToken}`;
      }

      logger.debug("✅ HMAC Signature Generated", {
        method,
        path,
        timestamp,
        signedPayload,
        signature: signature.slice(0, 32) + "...",
        requestId,
      });

      return {
        headers,
        timestamp,
        requestId,
        signedPayload,
      };
    } catch (error) {
      logger.error("❌ HMAC signature generation failed", error);
      throw new APIError("Failed to generate HMAC signature", 500);
    }
  }

  /**
   * Make authenticated request with HMAC signature
   * @param {Object} config - Axios request configuration
   * @returns {Promise} Response data
   */
  async _makeRequest(config) {
    try {
      const { method = "GET", url, data = null, params = {} } = config;

      // Parse URL to get path
      let path = url;
      try {
        const urlObj = new URL(url, this.baseURL);
        path = urlObj.pathname;
      } catch (err) {
        // If url is already a path, use it as is
        if (!url.startsWith("/")) {
          path = "/" + url;
        }
      }

      // Prepare request body
      const rawBody = data ? JSON.stringify(data) : "";

      // Generate HMAC signature
      const { headers: authHeaders } = this.generateHMACSignature(
        method.toUpperCase(),
        path,
        rawBody,
      );

      // Make the request with HMAC headers
      const response = await this.client({
        method,
        url,
        data,
        params,
        headers: {
          ...authHeaders,
          ...config.headers,
        },
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        // HTTP error response
        const errorMessage = error.response.data?.message || error.message;
        logger.error("External Wallet API HTTP Error", {
          status: error.response.status,
          statusText: error.response.statusText,
          message: errorMessage,
          url: config.url,
        });

        throw new APIError(
          `External Wallet API Error: ${errorMessage}`,
          error.response.status,
        );
      } else if (error.request) {
        // Network error
        logger.error("External Wallet API Network Error", {
          message: error.message,
          url: config.url,
        });

        throw new APIError("External Wallet API unreachable", 503);
      } else {
        // Other error
        logger.error("External Wallet API Request Setup Error", {
          message: error.message,
          url: config.url,
        });

        throw new APIError("External Wallet API request failed", 500);
      }
    }
  }

  /**
   * Make request through circuit breaker
   * @param {Object} config - Request configuration
   * @returns {Promise} Response data
   */
  async makeRequest(config) {
    try {
      return await this.circuitBreaker.fire(config);
    } catch (error) {
      if (this.circuitBreaker.opened) {
        logger.error("Circuit breaker is open, request rejected");
        throw new APIError(
          "External Wallet service temporarily unavailable",
          503,
        );
      }
      throw error;
    }
  }

  /**
   * Health check for external wallet API
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const startTime = Date.now();

      // Try to make a simple health check request
      await this.makeRequest({
        method: "GET",
        url: "/health",
      });

      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
        circuitBreakerState: this.circuitBreaker.stats,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        circuitBreakerState: this.circuitBreaker.stats,
      };
    }
  }

  /**
   * Create wallet in external system
   * @param {string} userId - User ID
   * @param {string} clientCode - Client code (optional)
   * @returns {Promise<Object>} Wallet creation response
   */
  async createWallet(userId, clientCode = "DEFAULT") {
    logger.info("Creating external wallet", { userId, clientCode });

    const cacheKey = `external_wallet_create:${userId}:${clientCode}`;

    try {
      // Check cache first (prevent duplicate creations)
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("External wallet creation already in progress", { userId });
        return JSON.parse(cached);
      }

      const response = await this.makeRequest({
        method: "POST",
        url: "/wallets",
        data: {
          userId,
          clientCode,
          metadata: {
            source: "logistics-wallet-service",
            createdAt: new Date().toISOString(),
          },
        },
      });

      // Cache result for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(response));

      logger.info("External wallet created successfully", {
        userId,
        externalWalletId: response.walletId,
      });

      return response;
    } catch (error) {
      logger.error("Failed to create external wallet", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get wallet balance from external system
   * @param {string} externalWalletId - External wallet ID
   * @returns {Promise<Object>} Balance information
   */
  async getWalletBalance(externalWalletId) {
    logger.debug("Getting external wallet balance", { externalWalletId });

    const cacheKey = `external_wallet_balance:${externalWalletId}`;

    try {
      // Check cache first (5 minute cache)
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.makeRequest({
        method: "GET",
        url: `/wallets/${externalWalletId}/balance`,
      });

      // Cache balance for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(response));

      return response;
    } catch (error) {
      logger.error("Failed to get external wallet balance", {
        externalWalletId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Debit wallet in external system
   * @param {string} externalWalletId - External wallet ID
   * @param {number} amount - Amount to debit
   * @param {string} reference - Reference for the transaction
   * @param {string} description - Transaction description
   * @returns {Promise<Object>} Transaction response
   */
  async debitWallet(externalWalletId, amount, reference, description = null) {
    logger.info("Debiting external wallet", {
      externalWalletId,
      amount,
      reference,
    });

    try {
      const response = await this.makeRequest({
        method: "POST",
        url: `/wallets/${externalWalletId}/debit`,
        data: {
          amount,
          reference,
          description,
          metadata: {
            source: "logistics-wallet-service",
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Clear balance cache after debit
      const redis = getRedisClient();
      await redis.del(`external_wallet_balance:${externalWalletId}`);

      logger.info("External wallet debited successfully", {
        externalWalletId,
        amount,
        transactionId: response.transactionId,
      });

      return response;
    } catch (error) {
      logger.error("Failed to debit external wallet", {
        externalWalletId,
        amount,
        reference,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Credit wallet in external system
   * @param {string} externalWalletId - External wallet ID
   * @param {number} amount - Amount to credit
   * @param {string} reference - Reference for the transaction
   * @param {string} description - Transaction description
   * @returns {Promise<Object>} Transaction response
   */
  async creditWallet(externalWalletId, amount, reference, description = null) {
    logger.info("Crediting external wallet", {
      externalWalletId,
      amount,
      reference,
    });

    try {
      const response = await this.makeRequest({
        method: "POST",
        url: `/wallets/${externalWalletId}/credit`,
        data: {
          amount,
          reference,
          description,
          metadata: {
            source: "logistics-wallet-service",
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Clear balance cache after credit
      const redis = getRedisClient();
      await redis.del(`external_wallet_balance:${externalWalletId}`);

      logger.info("External wallet credited successfully", {
        externalWalletId,
        amount,
        transactionId: response.transactionId,
      });

      return response;
    } catch (error) {
      logger.error("Failed to credit external wallet", {
        externalWalletId,
        amount,
        reference,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get transaction history from external system
   * @param {string} externalWalletId - External wallet ID
   * @param {Object} options - Query options (page, limit, type, etc.)
   * @returns {Promise<Object>} Transaction history
   */
  async getTransactionHistory(externalWalletId, options = {}) {
    logger.debug("Getting external wallet transaction history", {
      externalWalletId,
      options,
    });

    const cacheKey = `external_wallet_transactions:${externalWalletId}:${JSON.stringify(options)}`;

    try {
      // Check cache first (1 minute cache for transaction history)
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.makeRequest({
        method: "GET",
        url: `/wallets/${externalWalletId}/transactions`,
        params: options,
      });

      // Cache transaction history for 1 minute
      await redis.setex(cacheKey, 60, JSON.stringify(response));

      return response;
    } catch (error) {
      logger.error("Failed to get external wallet transaction history", {
        externalWalletId,
        error: error.message,
      });
      throw error;
    }
  }
}

// Singleton instance
let externalWalletClient = null;

/**
 * Get singleton instance of external wallet client
 * @returns {ExternalWalletClient}
 */
function getExternalWalletClient() {
  if (!externalWalletClient) {
    externalWalletClient = new ExternalWalletClient();
  }
  return externalWalletClient;
}

module.exports = {
  ExternalWalletClient,
  getExternalWalletClient,
};
