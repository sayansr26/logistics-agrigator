/**
 * External Partner Micro Service API Client
 *
 * Handles integration with the production Partner Micro service at https://calc.websiteduniya.com
 * Uses HMAC SHA-256 authentication as per API documentation
 *
 * Features:
 * - HMAC SHA-256 authentication
 * - Rate calculation API integration
 * - Serviceability checking
 * - Circuit breaker pattern
 * - Response caching with Redis
 * - Comprehensive error handling
 * - Retry logic with exponential backoff
 */

const axios = require("axios");
const crypto = require("crypto");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../shared/lib/redis");

class ExternalPartnerClient {
  constructor() {
    this.baseURL =
      process.env.PARTNER_SERVICE_EXTERNAL_URL ||
      "https://calc.websiteduniya.com";
    this.serviceId = process.env.SERVICE_ID || "TESTING_1";
    this.hmacSecret =
      process.env.HMAC_SECRET || "hmac_super_secret_key_2024_partner_services";
    this.apiSecretSalt =
      process.env.API_SECRET_SALT || "api_secret_salt_2024_partner_services";
    this.timeout = parseInt(process.env.PARTNER_SERVICE_TIMEOUT) || 5000;
    this.retryAttempts =
      parseInt(process.env.PARTNER_SERVICE_RETRY_ATTEMPTS) || 3;
    this.cacheTTL = parseInt(process.env.PARTNER_SERVICE_CACHE_TTL) || 300; // 5 minutes

    // Circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      state: "CLOSED", // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 60000, // 1 minute
    };

    // Initialize axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        "X-API-Version": "v1",
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => this.addAuthHeaders(config),
      (error) => Promise.reject(error),
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        this.onSuccess();
        return response;
      },
      (error) => {
        this.onFailure();
        return Promise.reject(error);
      },
    );

    logger.info("ExternalPartnerClient initialized", {
      baseURL: this.baseURL,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
    });
  }

  /**
   * Generate service-specific secret (matching Postman implementation)
   */
  generateServiceSecret(serviceId) {
    const data = `${serviceId}:${this.apiSecretSalt}`;
    const secret = crypto
      .createHmac("sha256", this.hmacSecret)
      .update(data)
      .digest("hex");

    logger.debug("Service secret generated", { serviceId, data, secret });
    return secret;
  }

  /**
   * Generate HMAC SHA-256 signature for authentication (matching Postman implementation)
   */
  generateSignature(serviceSecret, method, url, timestamp, requestBody = "") {
    const message = `${method.toUpperCase()}${url}${timestamp}${requestBody}`;
    const signature = crypto
      .createHmac("sha256", serviceSecret)
      .update(message)
      .digest("hex");

    logger.debug("HMAC signature generated", {
      method,
      url,
      timestamp,
      requestBody: requestBody || "(empty)",
      message,
      signature,
    });

    return signature;
  }

  /**
   * Add authentication headers to request (matching Postman implementation)
   */
  addAuthHeaders(config) {
    // Generate timestamp (Unix timestamp in seconds, matching Postman)
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Extract URL path from the full URL
    let url = "/";
    try {
      const fullUrl = config.baseURL + config.url;
      const parsedUrl = new URL(fullUrl);
      url = parsedUrl.pathname;

      // Add query parameters if they exist
      if (parsedUrl.search) {
        url += parsedUrl.search;
      }
    } catch (err) {
      // Fallback: use the config.url directly if it's already a path
      url = config.url.startsWith("/") ? config.url : "/" + config.url;
    }

    // Prepare request body (ensure consistent JSON formatting)
    let requestBody = "";
    if (config.data) {
      if (typeof config.data === "string") {
        try {
          // Ensure consistent JSON formatting
          const parsed = JSON.parse(config.data);
          requestBody = JSON.stringify(parsed);
        } catch (error) {
          requestBody = config.data;
        }
      } else {
        requestBody = JSON.stringify(config.data);
      }
    }

    // Generate service-specific secret and signature
    const serviceSecret = this.generateServiceSecret(this.serviceId);
    const signature = this.generateSignature(
      serviceSecret,
      config.method,
      url,
      timestamp,
      requestBody,
    );

    // Set authentication headers (matching Postman format)
    config.headers["x-service-id"] = this.serviceId;
    config.headers["x-timestamp"] = timestamp;
    config.headers["x-signature"] = signature;

    logger.debug("Authentication headers added", {
      serviceId: this.serviceId,
      timestamp,
      url,
      method: config.method,
      requestBody: requestBody || "(empty)",
      signature,
    });

    return config;
  }

  /**
   * Circuit breaker - check if requests should be allowed
   */
  canMakeRequest() {
    const now = Date.now();

    if (this.circuitBreaker.state === "OPEN") {
      if (
        now - this.circuitBreaker.lastFailureTime >
        this.circuitBreaker.timeout
      ) {
        this.circuitBreaker.state = "HALF_OPEN";
        logger.info("Circuit breaker moving to HALF_OPEN state");
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    if (this.circuitBreaker.state === "HALF_OPEN") {
      this.circuitBreaker.state = "CLOSED";
      this.circuitBreaker.failures = 0;
      logger.info("Circuit breaker CLOSED - service recovered");
    }
  }

  /**
   * Handle failed request
   */
  onFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = "OPEN";
      logger.error("Circuit breaker OPEN - service unavailable", {
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreaker.threshold,
      });
    }
  }

  /**
   * Make request with retry logic
   */
  async makeRequest(config, attempt = 1) {
    if (!this.canMakeRequest()) {
      throw new Error("Service temporarily unavailable (Circuit Breaker OPEN)");
    }

    try {
      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      logger.error("API request failed", {
        attempt,
        maxAttempts: this.retryAttempts,
        error: error.message,
        config: {
          method: config.method,
          url: config.url,
          data: config.data,
        },
      });

      if (attempt < this.retryAttempts && this.shouldRetry(error)) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.info(`Retrying request in ${delay}ms`, { attempt: attempt + 1 });

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.makeRequest(config, attempt + 1);
      }

      throw this.formatError(error);
    }
  }

  /**
   * Determine if request should be retried
   */
  shouldRetry(error) {
    if (!error.response) return true; // Network error

    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors or rate limiting
  }

  /**
   * Format error for consistent error handling
   */
  formatError(error) {
    if (error.response) {
      return new Error(
        `API Error: ${error.response.status} - ${error.response.data?.message || error.message}`,
      );
    } else if (error.request) {
      return new Error("Network Error: Unable to reach Partner Micro service");
    } else {
      return new Error(`Request Error: ${error.message}`);
    }
  }

  /**
   * Get cache key for request
   */
  getCacheKey(endpoint, params) {
    const paramString = JSON.stringify(params);
    return `partner_api:${endpoint}:${crypto.createHash("md5").update(paramString).digest("hex")}`;
  }

  /**
   * Get cached response
   */
  async getCachedResponse(cacheKey) {
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn("Cache get failed", { error: error.message, cacheKey });
      return null;
    }
  }

  /**
   * Cache response
   */
  async setCachedResponse(cacheKey, data) {
    try {
      const redis = await getRedisClient();
      await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(data));
    } catch (error) {
      logger.warn("Cache set failed", { error: error.message, cacheKey });
    }
  }

  /**
   * Calculate shipping rates for multiple partners
   */
  async calculateRates(params) {
    const {
      origin,
      destination,
      weight,
      dimensions,
      serviceType = "standard",
      partnerId = "partner_001",
    } = params;

    // Validate required parameters
    if (!origin || !destination || !weight) {
      throw new Error(
        "Missing required parameters: origin, destination, weight",
      );
    }

    const cacheKey = this.getCacheKey("calculate", params);

    // Try to get cached response
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached rate calculation", { cacheKey });
      return cached;
    }

    // Use the shipment charge calculation endpoint (service level)
    const requestData = {
      partnerId,
      pickupPincode: origin,
      deliveryPincode: destination,
      weight: weight * 1000, // Convert kg to grams
      shipmentType: "B2C",
      paymentType: serviceType === "cod" ? "COD" : "PREPAID",
      declaredValue: 1000, // Default declared value
      serviceRequirements: ["PICKUP", "DELIVERY"],
      customerType: "RETAIL",
    };

    // Add COD to service requirements if needed
    if (serviceType === "cod") {
      requestData.serviceRequirements.push("COD");
    }

    logger.info("Calculating rates via external API", requestData);

    const response = await this.makeRequest({
      method: "POST",
      url: "/api/v1/shipments/calculate-charges",
      data: requestData,
    });

    // Cache successful response
    if (response.success) {
      await this.setCachedResponse(cacheKey, response);
    }

    return response;
  }

  /**
   * Check serviceability for a pincode
   */
  async checkServiceability(params) {
    const { pincode, serviceType = "standard" } = params;

    if (!pincode) {
      throw new Error("Missing required parameter: pincode");
    }

    const cacheKey = this.getCacheKey("serviceability", params);

    // Try to get cached response (longer TTL for serviceability)
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached serviceability check", { cacheKey });
      return cached;
    }

    logger.info("Checking serviceability via external API", {
      pincode,
      serviceType,
    });

    const response = await this.makeRequest({
      method: "GET",
      url: `/api/v1/pincodes/search?pincode=${pincode}`,
    });

    // Cache successful response with longer TTL for serviceability
    if (response.success) {
      const redis = await getRedisClient();
      await redis.setex(cacheKey, 86400, JSON.stringify(response)); // 24 hours
    }

    return response;
  }

  /**
   * Get list of available partners
   */
  async getPartners() {
    const cacheKey = "partner_api:partners:list";

    // Try to get cached response
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached partners list");
      return cached;
    }

    logger.info("Fetching partners list via external API");

    const response = await this.makeRequest({
      method: "GET",
      url: "/api/v1/partners/availability",
    });

    // Cache partners list for 1 hour
    if (response.success) {
      const redis = await getRedisClient();
      await redis.setex(cacheKey, 3600, JSON.stringify(response));
    }

    return response;
  }

  /**
   * Health check for external service
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest({
        method: "GET",
        url: "/health",
      });

      if (response.success && response.status === "healthy") {
        return {
          status: "healthy",
          responseTime:
            response.components?.database?.responseTime || "unknown",
          circuitBreaker: this.circuitBreaker.state,
          service: "partner-micro-service",
          version: response.version,
          uptime: response.uptime,
        };
      } else {
        return {
          status: "unhealthy",
          error: "External service reported unhealthy status",
          circuitBreaker: this.circuitBreaker.state,
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        circuitBreaker: this.circuitBreaker.state,
      };
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      baseURL: this.baseURL,
      circuitBreaker: this.circuitBreaker,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      cacheTTL: this.cacheTTL,
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ExternalPartnerClient
 */
function getExternalPartnerClient() {
  if (!instance) {
    instance = new ExternalPartnerClient();
  }
  return instance;
}

module.exports = {
  ExternalPartnerClient,
  getExternalPartnerClient,
};
