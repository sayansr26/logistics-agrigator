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

    // Initialize HTTP client
    this.client = axios.create({
      baseURL: this.partnerServiceURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
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
   * Setup axios interceptors for logging and error handling
   */
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug("Partner Service API Request", {
          service: "shipment-service",
          url: config.url,
          method: config.method,
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
   * Create cache key for rate calculation
   */
  createRateCalculationCacheKey(rateParams) {
    const keyData = {
      fromPincode: rateParams.fromPincode,
      toPincode: rateParams.toPincode,
      weight: rateParams.weight,
      serviceType: rateParams.serviceType,
      dimensions: rateParams.dimensions,
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
   * @returns {Object} Rate calculation results
   */
  async calculateRates(rateParams) {
    try {
      // Validate input parameters
      this.validateRateCalculationParams(rateParams);

      // Check circuit breaker
      this.checkCircuitBreaker();

      // Create cache key
      const cacheKey = this.createRateCalculationCacheKey(rateParams);

      // Try cache first
      const redis = getRedisClient();
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

      // Prepare Partner Service request
      const partnerRequest = {
        fromPincode: rateParams.fromPincode,
        toPincode: rateParams.toPincode,
        weight: rateParams.weight,
        serviceType: rateParams.serviceType || "STANDARD",
        dimensions: rateParams.dimensions,
        codAmount: rateParams.codAmount || null,
      };

      logger.info("Calling Partner Service for rate calculation", {
        service: "shipment-service",
        request: partnerRequest,
      });

      // Call Partner Service with retry logic
      let lastError;
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          const response = await this.client.post(
            "/api/partners/calculate",
            partnerRequest,
          );

          if (response.data && response.data.status === "success") {
            const rateData = response.data.data;

            // Cache the successful response
            await redis.setex(
              cacheKey,
              this.cacheTTL.rateCalculation,
              JSON.stringify(rateData),
            );

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
   * @returns {Object} Serviceability results
   */
  async checkServiceability(serviceabilityParams) {
    try {
      // Validate input parameters
      this.validateServiceabilityParams(serviceabilityParams);

      // Check circuit breaker
      this.checkCircuitBreaker();

      // Create cache key
      const cacheKey = this.createServiceabilityCacheKey(serviceabilityParams);

      // Try cache first
      const redis = getRedisClient();
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

      // Call Partner Service
      const response = await this.client.post(
        "/api/partners/serviceability",
        partnerRequest,
      );

      if (response.data && response.data.status === "success") {
        const serviceabilityData = response.data.data.serviceability;

        // Cache the successful response
        await redis.setex(
          cacheKey,
          this.cacheTTL.serviceability,
          JSON.stringify(serviceabilityData),
        );

        logger.info("Serviceability check successful", {
          service: "shipment-service",
          serviceable: serviceabilityData.filter((s) => s.serviceable).length,
          totalPartners: serviceabilityData.length,
        });

        return serviceabilityData;
      } else {
        throw new APIError("Invalid response format from Partner Service");
      }
    } catch (error) {
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
   * @returns {Object} Selected courier information
   */
  async selectOptimalCourier(selectionParams) {
    try {
      // Get rates and serviceability
      const [rates, serviceability] = await Promise.all([
        this.calculateRates(selectionParams),
        this.checkServiceability(selectionParams),
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
    if (params.weight <= 0 || params.weight > 50) {
      throw new ValidationError("Weight must be between 0 and 50 kg");
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
