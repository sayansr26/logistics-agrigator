/**
 * Partner Integration Service
 *
 * Integrates with existing Partner Service for:
 * - Real-time rate calculation
 * - Serviceability checking
 * - Courier selection logic
 * - Partner assignment optimization
 *
 * Following auth-service patterns with proper error handling and caching
 */

const axios = require("axios");
const crypto = require("crypto");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const { APIError, ValidationError } = require("../shared/lib/errors");

class PartnerIntegrationService {
  constructor() {
    // Partner Service Configuration
    this.partnerServiceURL =
      process.env.PARTNER_SERVICE_URL || "http://localhost:3005";
    this.timeout = parseInt(process.env.PARTNER_SERVICE_TIMEOUT) || 10000;
    this.retryAttempts =
      parseInt(process.env.PARTNER_SERVICE_RETRY_ATTEMPTS) || 3;

    // Cache Configuration (matching partner service patterns)
    this.cacheTTL = {
      rateCalculation: 300, // 5 minutes
      serviceability: 1800, // 30 minutes
      partnerList: 3600, // 1 hour
    };

    // Circuit Breaker Configuration
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      state: "CLOSED", // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 60000, // 1 minute
    };

    // Internal secret for inter-service communication
    this.internalSecret = process.env.INTERNAL_SECRET;

    // Initialize HTTP client with internal auth header
    this.client = axios.create({
      baseURL: this.partnerServiceURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Request": this.internalSecret,
      },
    });

    // Setup request/response interceptors
    this.setupInterceptors();

    logger.info("Partner Integration Service initialized", {
      service: "shipment-service",
      partnerServiceURL: this.partnerServiceURL,
      timeout: this.timeout,
    });
  }

  /**
   * Normalize an auth token into a proper Bearer Authorization header.
   * Callers may pass either raw JWT or already-prefixed "Bearer <jwt>".
   */
  normalizeAuthHeader(authToken) {
    if (!authToken) return null;
    const trimmed = String(authToken).trim();
    if (!trimmed) return null;

    const tokenValue = trimmed.replace(/^Bearer\s+/i, "").trim();
    if (!tokenValue) return null;

    return `Bearer ${tokenValue}`;
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  setupInterceptors() {
    // Request interceptor - ensures internal header is always sent
    this.client.interceptors.request.use(
      (config) => {
        // Ensure internal secret is always set
        if (this.internalSecret && !config.headers["X-Internal-Request"]) {
          config.headers["X-Internal-Request"] = this.internalSecret;
        }

        logger.debug("Partner Service API Request", {
          service: "shipment-service",
          url: config.url,
          method: config.method,
          hasInternalHeader: !!config.headers["X-Internal-Request"],
          hasAuthHeader: !!config.headers["Authorization"],
          data: config.data ? JSON.stringify(config.data) : null,
        });
        return config;
      },
      (error) => {
        logger.error("Partner Service Request Error", {
          service: "shipment-service",
          error: error.message,
        });
        return Promise.reject(error);
      },
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug("Partner Service API Response", {
          service: "shipment-service",
          url: response.config.url,
          status: response.status,
          responseTime: response.headers["x-response-time"] || "unknown",
        });

        // Reset circuit breaker on successful response
        this.resetCircuitBreaker();

        return response;
      },
      (error) => {
        logger.error("Partner Service Response Error", {
          service: "shipment-service",
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });

        // Track failures for circuit breaker
        this.recordFailure();

        return Promise.reject(error);
      },
    );
  }

  /**
   * Check circuit breaker state before making requests
   */
  checkCircuitBreaker() {
    if (this.circuitBreaker.state === "OPEN") {
      const timeSinceLastFailure =
        Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = "HALF_OPEN";
        logger.info("Circuit breaker moved to HALF_OPEN", {
          service: "shipment-service",
          failures: this.circuitBreaker.failures,
        });
      } else {
        throw new APIError(
          "Partner service is temporarily unavailable (circuit breaker OPEN)",
        );
      }
    }
  }

  /**
   * Record failure for circuit breaker
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = "OPEN";
      logger.warn("Circuit breaker opened due to failures", {
        service: "shipment-service",
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreaker.threshold,
      });
    }
  }

  /**
   * Reset circuit breaker on successful response
   */
  resetCircuitBreaker() {
    if (this.circuitBreaker.failures > 0) {
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.state = "CLOSED";
      this.circuitBreaker.lastFailureTime = null;

      logger.info("Circuit breaker reset after successful response", {
        service: "shipment-service",
      });
    }
  }

  /**
   * Create cache key for rate calculation with all pricing inputs
   */
  createRateCalculationCacheKey(rateParams) {
    const keyData = {
      fromPincode: rateParams.fromPincode,
      toPincode: rateParams.toPincode,
      weight: rateParams.weight,
      serviceType: rateParams.serviceType,
      dimensions: rateParams.dimensions,
      declaredValue: rateParams.declaredValue || 0,
      codAmount: rateParams.codAmount || 0,
      paymentMode: rateParams.paymentMode || "PREPAID",
      isFragile: rateParams.isFragile || false,
      outletId: rateParams.outletId || null,
      sortBy: rateParams.sortBy || "cheapest",
    };

    const hash = crypto
      .createHash("md5")
      .update(JSON.stringify(keyData))
      .digest("hex");

    return `shipment_rate_calc:${hash}`;
  }

  /**
   * Create cache key for serviceability check
   */
  createServiceabilityCacheKey(serviceabilityParams) {
    const keyData = {
      fromPincode: serviceabilityParams.fromPincode,
      toPincode: serviceabilityParams.toPincode,
      serviceType: serviceabilityParams.serviceType,
    };

    const hash = crypto
      .createHash("md5")
      .update(JSON.stringify(keyData))
      .digest("hex");

    return `shipment_serviceability:${hash}`;
  }

  /**
   * Calculate shipping rates from Partner Service
   * @param {Object} rateParams - Rate calculation parameters
   * @param {string} [authToken] - Optional Authorization token to forward
   * @returns {Object} Rate calculation results
   */
  async calculateRates(rateParams, authToken = null) {
    try {
      // Validate input parameters
      this.validateRateCalculationParams(rateParams);

      // Check circuit breaker
      this.checkCircuitBreaker();

      // Create cache key
      const cacheKey = this.createRateCalculationCacheKey(rateParams);

      // Try cache first
      let redis = null;
      try {
        redis = getRedisClient();
      } catch (redisError) {
        logger.warn("Redis not available for rate cache", {
          service: "shipment-service",
          error: redisError.message,
        });
      }

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.info("Rate calculation cache hit", {
            service: "shipment-service",
            cacheKey,
            fromPincode: rateParams.fromPincode,
            toPincode: rateParams.toPincode,
          });
          return JSON.parse(cached);
        }
      }

      // Prepare Partner Service request with all pricing inputs
      const partnerRequest = {
        fromPincode: rateParams.fromPincode,
        toPincode: rateParams.toPincode,
        weight: rateParams.weight,
        serviceType: rateParams.serviceType || "STANDARD",
        dimensions: rateParams.dimensions || undefined,
        codAmount: rateParams.codAmount || undefined,
        declaredValue: rateParams.declaredValue || undefined,
        paymentMode: rateParams.paymentMode || "PREPAID",
        isFragile: rateParams.isFragile || false,
        outletId: rateParams.outletId || undefined,
        sortBy: rateParams.sortBy || "cheapest",
      };

      logger.info("Calling Partner Service for rate calculation", {
        service: "shipment-service",
        request: partnerRequest,
      });

      // Call Partner Service with retry logic
      let lastError;
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          const requestConfig = {};
          if (authToken) {
            const normalizedAuth = this.normalizeAuthHeader(authToken);
            const tokenValue = normalizedAuth
              ? normalizedAuth.replace(/^Bearer\s+/i, "").trim()
              : "";
            const tokenHash = tokenValue
              ? crypto
                  .createHash("sha256")
                  .update(tokenValue)
                  .digest("hex")
                  .slice(0, 12)
              : null;

            logger.debug("Forwarding auth token to Partner Service", {
              service: "shipment-service",
              endpoint: "/api/partners/calculate",
              hasAuth: !!tokenValue,
              authLength: tokenValue ? tokenValue.length : 0,
              authHash: tokenHash,
            });

            requestConfig.headers = {
              Authorization: normalizedAuth,
            };
          }
          const response = await this.client.post(
            "/api/partners/calculate",
            partnerRequest,
            requestConfig,
          );

          if (response.data && response.data.status === "success") {
            const rateData = response.data.data;

            // Cache the successful response
            if (redis) {
              await redis.setEx(
                cacheKey,
                this.cacheTTL.rateCalculation,
                JSON.stringify(rateData),
              );
            }

            logger.info("Rate calculation successful", {
              service: "shipment-service",
              rates: rateData.rates?.length || 0,
              cheapestRate: rateData.cheapestRate?.totalAmount,
              fastestRate: rateData.fastestRate?.deliveryDays,
            });

            return rateData;
          } else {
            throw new APIError("Invalid response format from Partner Service");
          }
        } catch (error) {
          if (error instanceof APIError) throw error;

          const status = error.response?.status;
          const partnerError = error.response?.data?.error;
          const partnerCode = partnerError?.code;
          const partnerMessage = partnerError?.message;
          const partnerDetails = partnerError?.details || null;

          // Non-retriable client errors: bubble up to controller as proper HTTP status
          if (status && status < 500 && status !== 429) {
            if (status === 400) {
              throw new ValidationError(
                partnerMessage || "Partner service validation failed",
                partnerDetails,
              );
            }
            throw new APIError(
              partnerMessage || error.message,
              status,
              partnerCode || "PARTNER_SERVICE_ERROR",
            );
          }

          lastError = error;
          if (attempt < this.retryAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            logger.warn(
              `Rate calculation attempt ${attempt} failed, retrying in ${delay}ms`,
              {
                service: "shipment-service",
                error: error.message,
                attempt,
                maxAttempts: this.retryAttempts,
              },
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // All retry attempts failed
      throw new APIError(
        `Partner Service rate calculation failed after ${this.retryAttempts} attempts: ${lastError.message}`,
      );
    } catch (error) {
      logger.error("Rate calculation error", {
        service: "shipment-service",
        error: error.message,
        params: rateParams,
      });
      throw error;
    }
  }

  /**
   * Check serviceability from Partner Service
   * @param {Object} serviceabilityParams - Serviceability check parameters
   * @param {string} [authToken] - Optional Authorization token to forward
   * @returns {Object} Serviceability results
   */
  async checkServiceability(serviceabilityParams, authToken = null) {
    try {
      // Validate input parameters
      this.validateServiceabilityParams(serviceabilityParams);

      // Check circuit breaker
      this.checkCircuitBreaker();

      // Create cache key
      const cacheKey = this.createServiceabilityCacheKey(serviceabilityParams);

      // Try cache first
      let redis = null;
      try {
        redis = getRedisClient();
      } catch (redisError) {
        logger.warn("Redis not available for serviceability cache", {
          service: "shipment-service",
          error: redisError.message,
        });
      }

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.info("Serviceability check cache hit", {
            service: "shipment-service",
            cacheKey,
            fromPincode: serviceabilityParams.fromPincode,
            toPincode: serviceabilityParams.toPincode,
          });
          return JSON.parse(cached);
        }
      }

      // Prepare Partner Service request
      const partnerRequest = {
        fromPincode: serviceabilityParams.fromPincode,
        toPincode: serviceabilityParams.toPincode,
        serviceType: serviceabilityParams.serviceType || "STANDARD",
      };

      logger.info("Calling Partner Service for serviceability check", {
        service: "shipment-service",
        request: partnerRequest,
      });

      // Call Partner Service with optional auth header
      const requestConfig = {};
      if (authToken) {
        const normalizedAuth = this.normalizeAuthHeader(authToken);
        const tokenValue = normalizedAuth
          ? normalizedAuth.replace(/^Bearer\s+/i, "").trim()
          : "";
        const tokenHash = tokenValue
          ? crypto
              .createHash("sha256")
              .update(tokenValue)
              .digest("hex")
              .slice(0, 12)
          : null;

        logger.debug("Forwarding auth token to Partner Service", {
          service: "shipment-service",
          endpoint: "/api/partners/serviceability",
          hasAuth: !!tokenValue,
          authLength: tokenValue ? tokenValue.length : 0,
          authHash: tokenHash,
        });

        requestConfig.headers = {
          Authorization: normalizedAuth,
        };
      }
      const response = await this.client.post(
        "/api/partners/serviceability",
        partnerRequest,
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        const rawData = response.data.data.serviceability || response.data.data;
        const serviceabilityList = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData.serviceability)
            ? rawData.serviceability
            : [];

        // Cache the successful response
        if (redis) {
          await redis.setEx(
            cacheKey,
            this.cacheTTL.serviceability,
            JSON.stringify(serviceabilityList),
          );
        }

        logger.info("Serviceability check successful", {
          service: "shipment-service",
          serviceable: serviceabilityList.filter((s) => s.serviceable).length,
          totalPartners: serviceabilityList.length,
        });

        return serviceabilityList;
      } else {
        throw new APIError("Invalid response format from Partner Service");
      }
    } catch (error) {
      if (error instanceof APIError) throw error;

      const status = error.response?.status;
      const partnerError = error.response?.data?.error;
      const partnerCode = partnerError?.code;
      const partnerMessage = partnerError?.message;
      const partnerDetails = partnerError?.details || null;

      if (status && status < 500 && status !== 429) {
        if (status === 400) {
          throw new ValidationError(
            partnerMessage || "Partner service validation failed",
            partnerDetails,
          );
        }
        throw new APIError(
          partnerMessage || error.message,
          status,
          partnerCode || "PARTNER_SERVICE_ERROR",
        );
      }

      logger.error("Serviceability check error", {
        service: "shipment-service",
        error: error.message,
        params: serviceabilityParams,
      });
      throw error;
    }
  }

  /**
   * Select optimal courier based on Partner Service recommendations
   * @param {Object} selectionParams - Courier selection parameters
   * @param {string} [authToken] - Optional Authorization token to forward
   * @returns {Object} Selected courier information
   */
  async selectOptimalCourier(selectionParams, authToken = null) {
    try {
      // Get rates and serviceability
      const [rates, serviceability] = await Promise.all([
        this.calculateRates(selectionParams, authToken),
        this.checkServiceability(selectionParams, authToken),
      ]);

      // Filter serviceable partners
      const serviceablePartners = rates.rates.filter((rate) => {
        const partnerServiceability = serviceability.find(
          (s) => s.partnerId === rate.partnerId,
        );
        return partnerServiceability?.serviceable === true;
      });

      if (serviceablePartners.length === 0) {
        throw new ValidationError(
          "No serviceable partners found for the given route",
        );
      }

      // Selection logic based on priority
      const selectionStrategy = selectionParams.strategy || "cheapest";
      let selectedCourier;

      switch (selectionStrategy) {
        case "fastest":
          selectedCourier = serviceablePartners.reduce((prev, current) =>
            prev.deliveryDays < current.deliveryDays ? prev : current,
          );
          break;

        case "balanced":
          // Score based on price (50%) and speed (50%)
          selectedCourier = serviceablePartners.reduce((prev, current) => {
            const prevScore =
              (1000 - prev.totalAmount) * 0.5 + (10 - prev.deliveryDays) * 50;
            const currentScore =
              (1000 - current.totalAmount) * 0.5 +
              (10 - current.deliveryDays) * 50;
            return prevScore > currentScore ? prev : current;
          });
          break;

        case "cheapest":
        default:
          selectedCourier = serviceablePartners.reduce((prev, current) =>
            prev.totalAmount < current.totalAmount ? prev : current,
          );
          break;
      }

      logger.info("Courier selected successfully", {
        service: "shipment-service",
        strategy: selectionStrategy,
        selectedPartnerId: selectedCourier.partnerId,
        selectedPartnerName: selectedCourier.partnerName,
        totalAmount: selectedCourier.totalAmount,
        deliveryDays: selectedCourier.deliveryDays,
        alternativeOptions: serviceablePartners.length - 1,
      });

      return {
        selectedCourier,
        alternativeOptions: serviceablePartners.filter(
          (p) => p.partnerId !== selectedCourier.partnerId,
        ),
        selectionReason: `Selected based on ${selectionStrategy} strategy`,
      };
    } catch (error) {
      logger.error("Courier selection error", {
        service: "shipment-service",
        error: error.message,
        params: selectionParams,
      });
      throw error;
    }
  }

  /**
   * Validate rate calculation parameters
   */
  validateRateCalculationParams(params) {
    const required = ["fromPincode", "toPincode", "weight"];
    for (const field of required) {
      if (!params[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    // Validate pincode format
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(params.fromPincode)) {
      throw new ValidationError("Invalid fromPincode format");
    }
    if (!pincodeRegex.test(params.toPincode)) {
      throw new ValidationError("Invalid toPincode format");
    }

    // Validate weight
    if (params.weight <= 0) {
      throw new ValidationError("Weight must be greater than 0");
    }
  }

  /**
   * Validate serviceability parameters
   */
  validateServiceabilityParams(params) {
    const required = ["fromPincode", "toPincode"];
    for (const field of required) {
      if (!params[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    // Validate pincode format
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(params.fromPincode)) {
      throw new ValidationError("Invalid fromPincode format");
    }
    if (!pincodeRegex.test(params.toPincode)) {
      throw new ValidationError("Invalid toPincode format");
    }
  }

  // ==========================================
  // COURIER OPERATION METHODS
  // Inter-service calls to partner-service courier operations
  // ==========================================

  /**
   * Book a shipment with a courier via partner-service
   * @param {string} partnerId - Partner ID
   * @param {Object} shipmentData - Shipment booking data
   * @param {string} [authToken] - Authorization token to forward
   * @returns {Object} Booking result with AWB number
   */
  async bookWithCourier(partnerId, shipmentData, authToken = null) {
    try {
      this.checkCircuitBreaker();

      const requestConfig = {};
      if (authToken) {
        requestConfig.headers = {
          Authorization: this.normalizeAuthHeader(authToken),
        };
      }

      logger.info("Calling partner-service to book courier shipment", {
        service: "shipment-service",
        partnerId,
        orderId: shipmentData.orderId,
      });

      const response = await this.client.post(
        "/api/v1/courier-operations/book",
        { partnerId, ...shipmentData },
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        return response.data.data;
      }

      throw new APIError("Invalid response from courier booking");
    } catch (error) {
      const partnerError = error.response?.data?.error;
      const partnerCode = partnerError?.code || "COURIER_BOOKING_FAILED";
      const partnerMessage =
        partnerError?.message || error.message || "Courier booking failed";
      const partnerDetails = partnerError?.details || null;
      const httpStatus = error.response?.status || 500;

      logger.error("Courier booking error via partner-service", {
        service: "shipment-service",
        partnerId,
        orderId: shipmentData.orderId,
        error: partnerMessage,
        code: partnerCode,
        httpStatus,
        details: partnerDetails,
      });

      if (error instanceof APIError) throw error;

      const bookingError = new APIError(
        partnerMessage,
        httpStatus,
        partnerCode,
      );
      bookingError.details = partnerDetails;
      throw bookingError;
    }
  }

  /**
   * Cancel a courier shipment via partner-service
   * @param {string} partnerId - Partner ID
   * @param {string} awbNumber - AWB number
   * @param {string} reason - Cancellation reason
   * @param {string} [authToken] - Authorization token to forward
   * @returns {Object} Cancellation result
   */
  async cancelWithCourier(partnerId, awbNumber, reason, authToken = null) {
    try {
      this.checkCircuitBreaker();

      const requestConfig = {};
      if (authToken) {
        requestConfig.headers = {
          Authorization: this.normalizeAuthHeader(authToken),
        };
      }

      logger.info("Calling partner-service to cancel courier shipment", {
        service: "shipment-service",
        partnerId,
        awbNumber,
      });

      const response = await this.client.post(
        "/api/v1/courier-operations/cancel",
        { partnerId, awbNumber, reason },
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        return response.data.data;
      }

      throw new APIError("Invalid response from courier cancellation");
    } catch (error) {
      logger.error("Courier cancellation error via partner-service", {
        service: "shipment-service",
        partnerId,
        awbNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Track a courier shipment via partner-service
   * @param {string} partnerId - Partner ID
   * @param {string} awbNumber - AWB number
   * @param {string} [authToken] - Authorization token to forward
   * @returns {Object} Tracking data with normalized events
   */
  async trackWithCourier(partnerId, awbNumber, authToken = null) {
    try {
      this.checkCircuitBreaker();

      const requestConfig = {};
      if (authToken) {
        requestConfig.headers = {
          Authorization: this.normalizeAuthHeader(authToken),
        };
      }

      logger.info("Calling partner-service to track courier shipment", {
        service: "shipment-service",
        partnerId,
        awbNumber,
      });

      const response = await this.client.get(
        `/api/v1/courier-operations/track/${partnerId}/${awbNumber}`,
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        return response.data.data;
      }

      throw new APIError("Invalid response from courier tracking");
    } catch (error) {
      logger.error("Courier tracking error via partner-service", {
        service: "shipment-service",
        partnerId,
        awbNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Request pickup from courier via partner-service
   * @param {string} partnerId - Partner ID
   * @param {Object} pickupData - Pickup request data
   * @param {string} [authToken] - Authorization token to forward
   * @returns {Object} Pickup request result
   */
  async requestCourierPickup(partnerId, pickupData, authToken = null) {
    try {
      this.checkCircuitBreaker();

      const requestConfig = {};
      if (authToken) {
        requestConfig.headers = {
          Authorization: this.normalizeAuthHeader(authToken),
        };
      }

      logger.info("Calling partner-service to request courier pickup", {
        service: "shipment-service",
        partnerId,
      });

      const response = await this.client.post(
        "/api/v1/courier-operations/pickup",
        { partnerId, ...pickupData },
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        return response.data.data;
      }

      throw new APIError("Invalid response from courier pickup request");
    } catch (error) {
      logger.error("Courier pickup request error via partner-service", {
        service: "shipment-service",
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get courier shipping label via partner-service
   * @param {string} partnerId - Partner ID
   * @param {string} awbNumber - AWB number
   * @param {string} [format='pdf'] - Label format
   * @param {string} [authToken] - Authorization token to forward
   * @returns {Object} Label data
   */
  async getCourierLabel(
    partnerId,
    awbNumber,
    format = "pdf",
    authToken = null,
  ) {
    try {
      this.checkCircuitBreaker();

      const requestConfig = { params: { format } };
      if (authToken) {
        requestConfig.headers = {
          Authorization: this.normalizeAuthHeader(authToken),
        };
      }

      logger.info("Calling partner-service for courier label", {
        service: "shipment-service",
        partnerId,
        awbNumber,
        format,
      });

      const response = await this.client.get(
        `/api/v1/courier-operations/label/${partnerId}/${awbNumber}`,
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        return response.data.data;
      }

      throw new APIError("Invalid response from courier label request");
    } catch (error) {
      logger.error("Courier label error via partner-service", {
        service: "shipment-service",
        partnerId,
        awbNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate courier manifest via partner-service
   * @param {string} partnerId - Partner ID
   * @param {string[]} awbNumbers - AWB numbers
   * @param {string} [authToken] - Authorization token to forward
   * @returns {Object} Manifest result
   */
  async generateCourierManifest(partnerId, awbNumbers, authToken = null) {
    try {
      this.checkCircuitBreaker();

      const requestConfig = {};
      if (authToken) {
        requestConfig.headers = {
          Authorization: this.normalizeAuthHeader(authToken),
        };
      }

      logger.info("Calling partner-service to generate courier manifest", {
        service: "shipment-service",
        partnerId,
        awbCount: awbNumbers.length,
      });

      const response = await this.client.post(
        "/api/v1/courier-operations/manifest",
        { partnerId, awbNumbers },
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        return response.data.data;
      }

      throw new APIError("Invalid response from courier manifest request");
    } catch (error) {
      logger.error("Courier manifest error via partner-service", {
        service: "shipment-service",
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get provider capabilities for a shipment
   * @param {string} partnerId - Partner ID
   * @param {Object} shipmentContext - { status, bookingStatus, awbNumber, paymentType }
   * @param {string} [authToken] - Authorization token
   * @returns {Object} Capabilities and available actions
   */
  async getProviderCapabilities(partnerId, shipmentContext, authToken = null) {
    try {
      this.checkCircuitBreaker();

      const requestConfig = {};
      if (authToken) {
        requestConfig.headers = {
          Authorization: this.normalizeAuthHeader(authToken),
        };
      }

      logger.info("Fetching provider capabilities from partner-service", {
        service: "shipment-service",
        partnerId,
        status: shipmentContext?.status,
      });

      const response = await this.client.post(
        "/api/v1/courier-operations/capabilities",
        { partnerId, shipmentContext },
        requestConfig,
      );

      if (response.data && response.data.status === "success") {
        return response.data.data;
      }

      throw new APIError("Invalid response from capabilities request");
    } catch (error) {
      logger.error("Provider capabilities error via partner-service", {
        service: "shipment-service",
        partnerId,
        error: error.message,
      });

      if (error instanceof APIError) throw error;

      return {
        success: false,
        capabilities: {},
        availableActions: [],
        providerName: "Unknown",
        aggregatorType: "UNKNOWN",
      };
    }
  }

  /**
   * Cancel a shipment with the courier FIRST, then return result for internal state update.
   * Implements the "cancel from partner first" flow.
   * @param {string} partnerId
   * @param {string} awbNumber
   * @param {string} reason
   * @param {string} [authToken]
   * @returns {Object} Cancellation result from partner
   */
  async cancelWithCourierFirst(partnerId, awbNumber, reason, authToken = null) {
    return this.cancelWithCourier(partnerId, awbNumber, reason, authToken);
  }

  /**
   * Fetch latest tracking/status from provider and return normalized data.
   * Does NOT update local DB — caller does that.
   * @param {string} partnerId
   * @param {string} awbNumber
   * @param {string} [authToken]
   * @returns {Object} Tracking result from partner
   */
  async refreshFromProvider(partnerId, awbNumber, authToken = null) {
    return this.trackWithCourier(partnerId, awbNumber, authToken);
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      const response = await this.client.get("/health", { timeout: 5000 });
      return {
        status: "healthy",
        partnerService: {
          available: true,
          responseTime: response.headers["x-response-time"] || "unknown",
          version: response.data.version || "unknown",
        },
        circuitBreaker: {
          state: this.circuitBreaker.state,
          failures: this.circuitBreaker.failures,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        partnerService: {
          available: false,
          error: error.message,
        },
        circuitBreaker: {
          state: this.circuitBreaker.state,
          failures: this.circuitBreaker.failures,
        },
      };
    }
  }
}

// Create singleton instance
const partnerIntegrationService = new PartnerIntegrationService();

module.exports = partnerIntegrationService;
