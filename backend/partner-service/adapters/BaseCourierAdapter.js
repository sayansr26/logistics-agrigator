/**
 * Base Courier Adapter - Abstract base class for courier API integrations
 *
 * Implements the Strategy pattern for courier-specific API calls.
 * All courier adapters must extend this class and implement the abstract methods.
 *
 * Features:
 * - Circuit breaker pattern (identical to ExternalPartnerClient)
 * - Retry logic with exponential backoff
 * - Redis response caching
 * - Standardized error formatting
 * - Abstract interface for courier operations
 */

const axios = require("axios");
const crypto = require("crypto");
const logger = require("../shared/lib/logger");
const { getClient } = require("../shared/lib/redis");

class BaseCourierAdapter {
  /**
   * @param {Object} channelConfig - Courier channel configuration
   * @param {string} channelConfig.apiUrl - Base URL for the courier API
   * @param {string} channelConfig.apiKey - API key for authentication
   * @param {Object} channelConfig.aggregatorConfig - Additional aggregator-specific config
   * @param {string} channelConfig.channelName - Display name for the courier channel
   * @param {string} channelConfig.aggregatorType - Aggregator type identifier (e.g. DELHIVERY, BLUEDART)
   */
  constructor(channelConfig) {
    if (new.target === BaseCourierAdapter) {
      throw new Error(
        "BaseCourierAdapter is abstract and cannot be instantiated directly",
      );
    }

    this.config = channelConfig.aggregatorConfig || {};
    this.apiUrl = channelConfig.apiUrl || "";
    this.apiKey = channelConfig.apiKey || "";
    this.channelName = channelConfig.channelName || "";
    this.aggregatorType = channelConfig.aggregatorType || "";

    // Create axios instance
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: parseInt(process.env.COURIER_API_TIMEOUT) || 15000,
    });

    // Circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      state: "CLOSED", // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 60000, // 1 minute
    };

    // Retry configuration
    this.maxRetryAttempts = parseInt(process.env.COURIER_RETRY_ATTEMPTS) || 3;

    logger.info("CourierAdapter initialized", {
      aggregatorType: this.aggregatorType,
      channelName: this.channelName,
      apiUrl: this.apiUrl,
      timeout: this.client.defaults.timeout,
    });
  }

  // ---------------------------------------------------------------------------
  // Circuit Breaker
  // ---------------------------------------------------------------------------

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
        logger.info("Circuit breaker moving to HALF_OPEN state", {
          aggregatorType: this.aggregatorType,
        });
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
      logger.info("Circuit breaker CLOSED - service recovered", {
        aggregatorType: this.aggregatorType,
      });
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
        aggregatorType: this.aggregatorType,
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreaker.threshold,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Request Handling
  // ---------------------------------------------------------------------------

  /**
   * Make request with retry logic and circuit breaker
   * @param {Object} config - Axios request config
   * @param {number} attempt - Current attempt number
   * @returns {Object} Response data
   */
  async makeRequest(config, attempt = 1) {
    if (!this.canMakeRequest()) {
      throw new Error("Service temporarily unavailable (Circuit Breaker OPEN)");
    }

    try {
      const response = await this.client.request(config);
      this.onSuccess();
      return response.data;
    } catch (error) {
      this.onFailure();

      logger.error("Courier API request failed", {
        aggregatorType: this.aggregatorType,
        attempt,
        maxAttempts: this.maxRetryAttempts,
        error: error.message,
        config: {
          method: config.method,
          url: config.url,
        },
      });

      if (attempt < this.maxRetryAttempts && this.shouldRetry(error)) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.info(`Retrying courier request in ${delay}ms`, {
          aggregatorType: this.aggregatorType,
          attempt: attempt + 1,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.makeRequest(config, attempt + 1);
      }

      throw this.formatError(error);
    }
  }

  /**
   * Determine if request should be retried
   * @param {Error} error - The error from the failed request
   * @returns {boolean}
   */
  shouldRetry(error) {
    if (!error.response) return true; // Network error

    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors or rate limiting
  }

  /**
   * Format error for consistent error handling
   * @param {Error} error - The raw error
   * @returns {Error} Formatted error
   */
  formatError(error) {
    if (error.response) {
      return new Error(
        `Courier API Error [${this.aggregatorType}]: ${error.response.status} - ${error.response.data?.message || error.message}`,
      );
    } else if (error.request) {
      return new Error(
        `Network Error [${this.aggregatorType}]: Unable to reach courier service`,
      );
    } else {
      return new Error(
        `Request Error [${this.aggregatorType}]: ${error.message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Caching
  // ---------------------------------------------------------------------------

  /**
   * Get cached response from Redis
   * @param {string} cacheKey - Redis cache key
   * @returns {Object|null} Cached data or null
   */
  async getCachedResponse(cacheKey) {
    try {
      const redis = await getClient();
      const cached = await redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn("Cache get failed", {
        error: error.message,
        cacheKey,
        aggregatorType: this.aggregatorType,
      });
      return null;
    }
  }

  /**
   * Store response in Redis cache
   * @param {string} cacheKey - Redis cache key
   * @param {Object} data - Data to cache
   * @param {number} ttl - Time to live in seconds
   */
  async setCachedResponse(cacheKey, data, ttl) {
    try {
      const redis = await getClient();
      await redis.setEx(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      logger.warn("Cache set failed", {
        error: error.message,
        cacheKey,
        aggregatorType: this.aggregatorType,
      });
    }
  }

  /**
   * Generate a cache key using MD5 hash of parameters
   * @param {string} prefix - Cache key prefix
   * @param {Object} params - Parameters to hash
   * @returns {string} Cache key
   */
  getCacheKey(prefix, params) {
    const paramString = JSON.stringify(params);
    const hash = crypto.createHash("md5").update(paramString).digest("hex");
    return `${prefix}:${hash}`;
  }

  // ---------------------------------------------------------------------------
  // Abstract Methods - MUST be implemented by subclasses
  // ---------------------------------------------------------------------------

  /**
   * Create a shipment order with the courier
   * @param {Object} shipmentData - Shipment details
   * @returns {Object} { success, awbNumber, bookingReference, trackingUrl, estimatedDelivery, rawResponse }
   */
  async createOrder(shipmentData) {
    throw new Error(
      "Not implemented: createOrder must be implemented by subclass",
    );
  }

  /**
   * Cancel a shipment order
   * @param {string} awbNumber - AWB/tracking number
   * @param {string} reason - Cancellation reason
   * @returns {Object} { success, awbNumber, message, rawResponse }
   */
  async cancelOrder(awbNumber, reason) {
    throw new Error(
      "Not implemented: cancelOrder must be implemented by subclass",
    );
  }

  /**
   * Track a shipment by AWB number
   * @param {string} awbNumber - AWB/tracking number
   * @returns {Object} { success, awbNumber, currentStatus, currentLocation, events, estimatedDelivery, rawResponse }
   */
  async trackShipment(awbNumber) {
    throw new Error(
      "Not implemented: trackShipment must be implemented by subclass",
    );
  }

  /**
   * Request pickup from the courier
   * @param {Object} pickupData - Pickup details
   * @returns {Object} { success, pickupId, message, rawResponse }
   */
  async requestPickup(pickupData) {
    throw new Error(
      "Not implemented: requestPickup must be implemented by subclass",
    );
  }

  /**
   * Get shipping label for an AWB
   * @param {string} awbNumber - AWB/tracking number
   * @param {string} format - Label format (pdf, zpl, etc.)
   * @returns {Object} { success, awbNumber, labelData, format, rawResponse }
   */
  async getLabel(awbNumber, format) {
    throw new Error(
      "Not implemented: getLabel must be implemented by subclass",
    );
  }

  /**
   * Generate manifest for multiple AWBs
   * @param {string[]} awbNumbers - Array of AWB numbers
   * @returns {Object} { success, manifestId, awbNumbers, rawResponse }
   */
  async generateManifest(awbNumbers) {
    throw new Error(
      "Not implemented: generateManifest must be implemented by subclass",
    );
  }

  /**
   * Check pincode serviceability
   * @param {string} pincode - 6-digit Indian pincode
   * @returns {Object} { success, pincode, isServiceable, deliveryDays, prepaidAvailable, codAvailable, rawResponse }
   */
  async checkPincodeServiceability(pincode) {
    throw new Error(
      "Not implemented: checkPincodeServiceability must be implemented by subclass",
    );
  }

  /**
   * Verify the configured credentials against the live courier API with a
   * cheap real call (no caching — a stale cache must never fake-pass a bad
   * credential). Used by the "Test Connection" action before saving.
   * @returns {Object} { success, message }
   */
  async testConnection() {
    throw new Error(
      "Not implemented: testConnection must be implemented by subclass",
    );
  }

  /**
   * Normalize courier-specific status to internal status
   * @param {string} courierStatus - Courier-specific status string
   * @returns {string} Internal status (CREATED, BOOKED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RTO, CANCELLED)
   */
  normalizeStatus(courierStatus) {
    throw new Error(
      "Not implemented: normalizeStatus must be implemented by subclass",
    );
  }

  /**
   * Normalize courier-specific tracking events to internal format
   * @param {Array} courierEvents - Courier-specific tracking events
   * @returns {Array} Normalized events [{ status, message, location, timestamp, source, metadata }]
   */
  normalizeTrackingEvents(courierEvents) {
    throw new Error(
      "Not implemented: normalizeTrackingEvents must be implemented by subclass",
    );
  }

  // ---------------------------------------------------------------------------
  // Dynamic Capabilities — override per adapter to declare supported actions
  // ---------------------------------------------------------------------------

  /**
   * Return the static capability descriptor for this adapter.
   * Each key is an action name; value is { supported, requiresAwb, allowedStatuses?, description }.
   * Subclasses MUST override this.
   */
  getCapabilities() {
    return {
      track: {
        supported: false,
        requiresAwb: true,
        description: "Track shipment",
      },
      label: {
        supported: false,
        requiresAwb: true,
        description: "Download courier label / packing slip",
      },
      cancel: {
        supported: false,
        requiresAwb: true,
        description: "Cancel shipment with courier",
      },
      pickup: {
        supported: false,
        requiresAwb: false,
        description: "Request pickup from courier",
      },
      manifest: {
        supported: false,
        requiresAwb: true,
        description: "Generate manifest",
      },
      edit: {
        supported: false,
        requiresAwb: true,
        description: "Edit shipment details with courier",
      },
      ndr: {
        supported: false,
        requiresAwb: true,
        description: "NDR action / status",
      },
      ewaybill: {
        supported: false,
        requiresAwb: true,
        description: "E-waybill update",
      },
      pod: {
        supported: false,
        requiresAwb: true,
        description: "Download proof of delivery",
      },
      invoice: {
        supported: false,
        requiresAwb: true,
        description: "Download courier invoice",
      },
      refresh: {
        supported: false,
        requiresAwb: true,
        description: "Fetch latest status from courier",
      },
      webhook: {
        supported: false,
        requiresAwb: false,
        description: "Inbound webhook support",
      },
    };
  }

  /**
   * Given the current shipment context, return only the actions that are
   * currently executable. Override in subclass for state-aware filtering.
   *
   * @param {Object} shipmentContext - { status, bookingStatus, awbNumber, partnerName, paymentType, ... }
   * @returns {Object[]} Array of { action, description, enabled, reason? }
   */
  getAvailableActions(shipmentContext) {
    const caps = this.getCapabilities();
    const actions = [];

    for (const [action, meta] of Object.entries(caps)) {
      if (!meta.supported) continue;

      let enabled = true;
      let reason = null;

      if (meta.requiresAwb && !shipmentContext.awbNumber) {
        enabled = false;
        reason = "AWB number not yet assigned";
      }

      if (
        meta.allowedStatuses &&
        !meta.allowedStatuses.includes(shipmentContext.status)
      ) {
        enabled = false;
        reason = `Not available in status ${shipmentContext.status}`;
      }

      actions.push({ action, description: meta.description, enabled, reason });
    }

    return actions;
  }
}

module.exports = BaseCourierAdapter;
