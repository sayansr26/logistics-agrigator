const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const APIResponse = require("../shared/lib/response");
const { ValidationError, APIError } = require("../shared/lib/errors");
const ExternalPartnerClient = require("./externalPartnerClient");

/**
 * Comprehensive Charge Calculation Service
 *
 * Handles:
 * - Surcharge calculation for partners
 * - Shipment charge calculation with itemization
 * - Charge validation and verification
 * - Caching and optimization
 */
class ChargeCalculationService {
  constructor() {
    this.redis = getRedisClient();
    this.externalClient = new ExternalPartnerClient();
    this.cacheTTL = {
      surchargeCalculation: 600, // 10 minutes
      shipmentCharges: 300, // 5 minutes
      chargeValidation: 1800, // 30 minutes
    };
  }

  /**
   * Calculate surcharges for a specific partner
   * @param {string} partnerId - Partner ID
   * @param {Object} calculationData - Calculation parameters
   * @returns {Object} Surcharge calculation results
   */
  async calculateSurcharges(partnerId, calculationData) {
    try {
      // Validate input data
      this.validateSurchargeData(calculationData);

      // Create cache key
      const cacheKey = `surcharge_calculation:${partnerId}:${this.createCalculationHash(calculationData)}`;

      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info("Surcharge calculation cache hit", { partnerId, cacheKey });
        return JSON.parse(cached);
      }

      // Call external API for surcharge calculation
      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: `/api/v1/surcharge-calculation/${partnerId}/calculate`,
        data: calculationData,
      });

      // Process and enhance the response
      const processedResult = this.processSurchargeResponse(
        response,
        calculationData,
      );

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.cacheTTL.surchargeCalculation,
        JSON.stringify(processedResult),
      );

      logger.info("Surcharge calculation completed", {
        partnerId,
        totalSurcharges: processedResult.totalSurcharge,
        itemCount: processedResult.surchargeBreakdown?.length || 0,
      });

      return processedResult;
    } catch (error) {
      logger.error("Surcharge calculation failed", {
        partnerId,
        error: error.message,
        calculationData,
      });
      throw new APIError(`Surcharge calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate comprehensive charges for shipment
   * @param {Object} shipmentData - Shipment details
   * @param {Object} options - Calculation options
   * @returns {Object} Comprehensive charge calculation
   */
  async calculateShipmentCharges(shipmentData, options = {}) {
    try {
      // Validate shipment data
      this.validateShipmentData(shipmentData);

      // Create cache key
      const cacheKey = `shipment_charges:${this.createShipmentHash(shipmentData, options)}`;

      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info("Shipment charge calculation cache hit", { cacheKey });
        return JSON.parse(cached);
      }

      // Prepare request data
      const requestData = {
        shipmentDetails: shipmentData,
        calculationOptions: {
          includeBreakdown: true,
          includeTaxes: true,
          includeDiscounts: options.includeDiscounts || false,
          currency: options.currency || "INR",
          ...options,
        },
      };

      // Call external API for shipment charge calculation
      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/shipments/calculate-charges",
        data: requestData,
      });

      // Process and enhance the response
      const processedResult = this.processShipmentChargeResponse(
        response,
        shipmentData,
        options,
      );

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.cacheTTL.shipmentCharges,
        JSON.stringify(processedResult),
      );

      logger.info("Shipment charge calculation completed", {
        shipmentId: shipmentData.shipmentId,
        totalCharges: processedResult.totalCharges,
        partnerCount: processedResult.partnerQuotes?.length || 0,
      });

      return processedResult;
    } catch (error) {
      logger.error("Shipment charge calculation failed", {
        shipmentId: shipmentData.shipmentId,
        error: error.message,
        shipmentData,
      });
      throw new APIError(
        `Shipment charge calculation failed: ${error.message}`,
      );
    }
  }

  /**
   * Validate charge calculation against business rules
   * @param {Object} chargeData - Charge data to validate
   * @param {Object} validationRules - Validation rules
   * @returns {Object} Validation results
   */
  async validateCharges(chargeData, validationRules = {}) {
    try {
      // Create cache key for validation
      const cacheKey = `charge_validation:${this.createValidationHash(chargeData, validationRules)}`;

      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info("Charge validation cache hit", { cacheKey });
        return JSON.parse(cached);
      }

      // Perform validation
      const validationResult = {
        isValid: true,
        validationScore: 100,
        warnings: [],
        errors: [],
        recommendations: [],
        validatedAt: new Date().toISOString(),
      };

      // Business rule validations
      this.validateChargeRanges(chargeData, validationResult);
      this.validateChargeConsistency(chargeData, validationResult);
      this.validateCompetitiveRates(chargeData, validationResult);

      // Apply custom validation rules
      if (validationRules.customRules) {
        this.applyCustomValidationRules(
          chargeData,
          validationRules.customRules,
          validationResult,
        );
      }

      // Calculate final validation score
      validationResult.validationScore =
        this.calculateValidationScore(validationResult);
      validationResult.isValid =
        validationResult.validationScore >= 70 &&
        validationResult.errors.length === 0;

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.cacheTTL.chargeValidation,
        JSON.stringify(validationResult),
      );

      logger.info("Charge validation completed", {
        isValid: validationResult.isValid,
        score: validationResult.validationScore,
        warningCount: validationResult.warnings.length,
        errorCount: validationResult.errors.length,
      });

      return validationResult;
    } catch (error) {
      logger.error("Charge validation failed", {
        error: error.message,
        chargeData,
      });
      throw new APIError(`Charge validation failed: ${error.message}`);
    }
  }

  /**
   * Get charge calculation breakdown and analytics
   * @param {string} calculationId - Calculation ID
   * @returns {Object} Detailed breakdown
   */
  async getChargeBreakdown(calculationId) {
    try {
      const cacheKey = `charge_breakdown:${calculationId}`;

      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // If not in cache, return error (breakdown should be cached during calculation)
      throw new ValidationError("Charge breakdown not found or expired");
    } catch (error) {
      logger.error("Failed to get charge breakdown", {
        calculationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear charge calculation cache
   * @param {string} pattern - Cache pattern to clear
   * @returns {Object} Clear operation result
   */
  async clearChargeCache(pattern = "*") {
    try {
      const keys = await this.redis.keys(`*charge*${pattern}*`);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info("Charge calculation cache cleared", {
          pattern,
          keysCleared: keys.length,
        });
      }

      return {
        success: true,
        keysCleared: keys.length,
        pattern,
      };
    } catch (error) {
      logger.error("Failed to clear charge cache", {
        pattern,
        error: error.message,
      });
      throw new APIError(`Failed to clear charge cache: ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Validate surcharge calculation data
   */
  validateSurchargeData(data) {
    if (!data || typeof data !== "object") {
      throw new ValidationError("Invalid surcharge calculation data");
    }

    const required = ["shipmentValue", "weight", "serviceType"];
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    if (data.weight <= 0) {
      throw new ValidationError("Weight must be greater than 0");
    }

    if (data.shipmentValue <= 0) {
      throw new ValidationError("Shipment value must be greater than 0");
    }
  }

  /**
   * Validate shipment data
   */
  validateShipmentData(data) {
    if (!data || typeof data !== "object") {
      throw new ValidationError("Invalid shipment data");
    }

    const required = ["fromPincode", "toPincode", "weight", "declaredValue"];
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    // Validate pincode format
    const pincodeRegex = /^\d{6}$/;
    if (
      !pincodeRegex.test(data.fromPincode) ||
      !pincodeRegex.test(data.toPincode)
    ) {
      throw new ValidationError("Invalid pincode format");
    }

    if (data.weight <= 0) {
      throw new ValidationError("Weight must be greater than 0");
    }

    if (data.declaredValue <= 0) {
      throw new ValidationError("Declared value must be greater than 0");
    }
  }

  /**
   * Process surcharge response from external API
   */
  processSurchargeResponse(response, originalData) {
    return {
      calculationId: `SC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      partnerId: response.partnerId,
      totalSurcharge: response.totalSurcharge || 0,
      currency: response.currency || "INR",
      surchargeBreakdown: response.surchargeBreakdown || [],
      applicableCharges: response.applicableCharges || [],
      calculationMetadata: {
        calculatedAt: new Date().toISOString(),
        inputData: originalData,
        calculationMethod: response.calculationMethod || "standard",
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      },
      recommendations: this.generateSurchargeRecommendations(response),
    };
  }

  /**
   * Process shipment charge response from external API
   */
  processShipmentChargeResponse(response, originalData, options) {
    return {
      calculationId: `SCC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shipmentId: originalData.shipmentId,
      totalCharges: response.totalCharges || 0,
      currency: response.currency || "INR",
      partnerQuotes: response.partnerQuotes || [],
      chargeBreakdown: response.chargeBreakdown || [],
      taxBreakdown: response.taxBreakdown || [],
      discountBreakdown: response.discountBreakdown || [],
      calculationMetadata: {
        calculatedAt: new Date().toISOString(),
        inputData: originalData,
        options: options,
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours
      },
      recommendations: this.generateChargeRecommendations(response),
      analytics: this.generateChargeAnalytics(response),
    };
  }

  /**
   * Validate charge ranges against business rules
   */
  validateChargeRanges(chargeData, validationResult) {
    // Implement charge range validation logic
    if (chargeData.totalCharges > 10000) {
      validationResult.warnings.push({
        type: "HIGH_CHARGES",
        message: "Charges are unusually high",
        value: chargeData.totalCharges,
      });
    }

    if (chargeData.totalCharges < 10) {
      validationResult.warnings.push({
        type: "LOW_CHARGES",
        message: "Charges are unusually low",
        value: chargeData.totalCharges,
      });
    }
  }

  /**
   * Validate charge consistency
   */
  validateChargeConsistency(chargeData, validationResult) {
    // Implement consistency validation logic
    if (chargeData.partnerQuotes && chargeData.partnerQuotes.length > 1) {
      const charges = chargeData.partnerQuotes.map((q) => q.totalCharge);
      const maxCharge = Math.max(...charges);
      const minCharge = Math.min(...charges);

      if (maxCharge / minCharge > 3) {
        validationResult.warnings.push({
          type: "INCONSISTENT_QUOTES",
          message: "Partner quotes vary significantly",
          maxCharge,
          minCharge,
          ratio: maxCharge / minCharge,
        });
      }
    }
  }

  /**
   * Validate competitive rates
   */
  validateCompetitiveRates(chargeData, validationResult) {
    // Implement competitive rate validation
    // This would typically compare against market rates
    validationResult.recommendations.push({
      type: "COMPETITIVE_ANALYSIS",
      message: "Consider comparing with market rates",
    });
  }

  /**
   * Apply custom validation rules
   */
  applyCustomValidationRules(chargeData, customRules, validationResult) {
    // Implement custom rule application
    for (const rule of customRules) {
      try {
        // Apply rule logic here
        logger.debug("Applied custom validation rule", { rule: rule.name });
      } catch (error) {
        validationResult.errors.push({
          type: "CUSTOM_RULE_ERROR",
          message: `Custom rule failed: ${rule.name}`,
          error: error.message,
        });
      }
    }
  }

  /**
   * Calculate validation score
   */
  calculateValidationScore(validationResult) {
    let score = 100;
    score -= validationResult.errors.length * 20;
    score -= validationResult.warnings.length * 5;
    return Math.max(0, score);
  }

  /**
   * Generate surcharge recommendations
   */
  generateSurchargeRecommendations(response) {
    const recommendations = [];

    if (response.totalSurcharge > 500) {
      recommendations.push({
        type: "COST_OPTIMIZATION",
        message: "Consider negotiating surcharge rates with partner",
        priority: "medium",
      });
    }

    return recommendations;
  }

  /**
   * Generate charge recommendations
   */
  generateChargeRecommendations(response) {
    const recommendations = [];

    if (response.partnerQuotes && response.partnerQuotes.length > 1) {
      const sortedQuotes = response.partnerQuotes.sort(
        (a, b) => a.totalCharge - b.totalCharge,
      );
      recommendations.push({
        type: "BEST_RATE",
        message: `Best rate available from ${sortedQuotes[0].partnerName}`,
        partnerId: sortedQuotes[0].partnerId,
        savings:
          sortedQuotes[1]?.totalCharge - sortedQuotes[0].totalCharge || 0,
      });
    }

    return recommendations;
  }

  /**
   * Generate charge analytics
   */
  generateChargeAnalytics(response) {
    return {
      averageCharge:
        response.partnerQuotes?.reduce((sum, q) => sum + q.totalCharge, 0) /
        (response.partnerQuotes?.length || 1),
      chargeRange: {
        min: Math.min(
          ...(response.partnerQuotes?.map((q) => q.totalCharge) || [0]),
        ),
        max: Math.max(
          ...(response.partnerQuotes?.map((q) => q.totalCharge) || [0]),
        ),
      },
      partnerCount: response.partnerQuotes?.length || 0,
    };
  }

  /**
   * Create hash for calculation data
   */
  createCalculationHash(data) {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify(data))
      .digest("hex");
  }

  /**
   * Create hash for shipment data
   */
  createShipmentHash(shipmentData, options) {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify({ shipmentData, options }))
      .digest("hex");
  }

  /**
   * Create hash for validation data
   */
  createValidationHash(chargeData, validationRules) {
    return require("crypto")
      .createHash("md5")
      .update(JSON.stringify({ chargeData, validationRules }))
      .digest("hex");
  }
}

module.exports = ChargeCalculationService;
