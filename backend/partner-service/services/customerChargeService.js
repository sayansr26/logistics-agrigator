/**
 * Customer Charge Service
 *
 * Handles customer-specific charge configuration and management through external API integration
 * Integrates with Partner Micro service for customer charge operations
 *
 * Features:
 * - Customer charge configuration (FSC, COD, Insurance, etc.)
 * - Customer-specific charge types and rates
 * - Bulk customer charge operations
 * - Charge validation and calculation logic
 * - Charge override mechanisms
 * - Response caching with Redis
 * - Comprehensive error handling
 */

const logger = require("../shared/lib/logger");
const { getClient } = require("../shared/lib/redis");
const { ExternalPartnerClient } = require("./externalPartnerClient");

class CustomerChargeService {
  constructor() {
    this.externalClient = new ExternalPartnerClient();
    this.cachePrefix = "customer_charge_service";
    this.defaultCacheTTL = 3600; // 1 hour for customer charges

    // Supported charge types
    this.chargeTypes = {
      FSC: "fsc", // Fuel Surcharge
      COD: "cod", // Cash on Delivery
      INSURANCE: "insurance", // Insurance charges
      HANDLING: "handling", // Handling charges
      PICKUP: "pickup", // Pickup charges
      DELIVERY: "delivery", // Delivery charges
      FRAGILE: "fragile", // Fragile item charges
      OVERSIZED: "oversized", // Oversized item charges
      PRIORITY: "priority", // Priority delivery charges
      WEEKEND: "weekend", // Weekend delivery charges
      REMOTE: "remote", // Remote area charges
      OTHER: "other", // Other custom charges
    };

    // Charge calculation types
    this.calculationTypes = {
      PERCENTAGE: "percentage", // Percentage of shipment value
      FLAT: "flat", // Flat rate charge
      PER_KG: "per_kg", // Per kilogram charge
      SLAB: "slab", // Slab-based charges
      TIERED: "tiered", // Tiered pricing
    };
  }

  /**
   * Get customer charge configurations with filtering
   * @param {Object} filters - Filtering options
   * @param {string} filters.partnerId - Partner ID for filtering
   * @param {string} filters.customerId - Customer ID filter
   * @param {string} filters.type - Charge type filter (fsc, cod, insurance, etc.)
   * @param {string} filters.chargeType - Calculation type filter (percentage, flat, per_kg)
   * @param {boolean} filters.status - Active status filter
   * @param {number} filters.page - Page number for pagination
   * @param {number} filters.limit - Items per page
   * @returns {Promise<Object>} Customer charges data
   */
  async getCustomerCharges(filters = {}) {
    try {
      const cacheKey = `${this.cachePrefix}:charges:${this.createFilterHash(filters)}`;
      const redis = getClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Customer charges retrieved from cache", { filters });
        return JSON.parse(cached);
      }

      // Call external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/customer-charges",
        params: filters,
      });

      // Cache the response
      await redis.setex(
        cacheKey,
        this.defaultCacheTTL,
        JSON.stringify(response),
      );

      logger.info("Customer charges retrieved from external API", {
        filters,
        count: response.data?.charges?.length || 0,
      });

      return response;
    } catch (error) {
      logger.error("Error retrieving customer charges", {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Create new customer charge configuration
   * @param {Object} chargeData - Customer charge configuration
   * @param {string} chargeData.customerId - Customer ID (optional for global charges)
   * @param {string} chargeData.type - Charge type (fsc, cod, insurance, etc.)
   * @param {string} chargeData.chargeType - Calculation type (percentage, flat, per_kg)
   * @param {number} chargeData.value - Charge value
   * @param {number} chargeData.minKg - Minimum weight threshold
   * @param {number} chargeData.maxKg - Maximum weight threshold
   * @param {number} chargeData.minValue - Minimum shipment value threshold
   * @param {number} chargeData.maxValue - Maximum shipment value threshold
   * @param {string} chargeData.otherChargeType - Other charge type description
   * @param {boolean} chargeData.status - Active status
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Created customer charge data
   */
  async createCustomerCharge(chargeData, partnerId) {
    try {
      // Validate required fields
      this.validateCustomerChargeData(chargeData);

      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/customer-charges",
        data: chargeData,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearCustomerChargeCache(partnerId, chargeData.customerId);

      logger.info("Customer charge created successfully", {
        partnerId,
        customerId: chargeData.customerId,
        type: chargeData.type,
        chargeId: response.data?.charge?.id,
      });

      return response;
    } catch (error) {
      logger.error("Error creating customer charge", {
        error: error.message,
        partnerId,
        chargeData,
      });
      throw error;
    }
  }

  /**
   * Update existing customer charge configuration
   * @param {string} chargeId - Customer charge ID to update
   * @param {Object} updateData - Updated customer charge data
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Updated customer charge data
   */
  async updateCustomerCharge(chargeId, updateData, partnerId) {
    try {
      const response = await this.externalClient.makeRequest({
        method: "PUT",
        url: `/api/v1/customer-charges/${chargeId}`,
        data: updateData,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearCustomerChargeCache(partnerId);

      logger.info("Customer charge updated successfully", {
        partnerId,
        chargeId,
        updatedFields: Object.keys(updateData),
      });

      return response;
    } catch (error) {
      logger.error("Error updating customer charge", {
        error: error.message,
        partnerId,
        chargeId,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Delete customer charge configuration
   * @param {string} chargeId - Customer charge ID to delete
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteCustomerCharge(chargeId, partnerId) {
    try {
      const response = await this.externalClient.makeRequest({
        method: "DELETE",
        url: `/api/v1/customer-charges/${chargeId}`,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearCustomerChargeCache(partnerId);

      logger.info("Customer charge deleted successfully", {
        partnerId,
        chargeId,
      });

      return response;
    } catch (error) {
      logger.error("Error deleting customer charge", {
        error: error.message,
        partnerId,
        chargeId,
      });
      throw error;
    }
  }

  /**
   * Create multiple customer charges in bulk
   * @param {Object} bulkData - Bulk customer charges data
   * @param {Array} bulkData.charges - Array of customer charge configurations
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Bulk creation results
   */
  async createBulkCustomerCharges(bulkData, partnerId) {
    try {
      // Validate bulk data
      if (!bulkData.charges || !Array.isArray(bulkData.charges)) {
        throw new Error("Invalid bulk data: charges array is required");
      }

      // Validate each charge in the bulk data
      bulkData.charges.forEach((charge, index) => {
        try {
          this.validateCustomerChargeData(charge);
        } catch (error) {
          throw new Error(
            `Invalid charge data at index ${index}: ${error.message}`,
          );
        }
      });

      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/customer-charges/bulk",
        data: bulkData,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearCustomerChargeCache(partnerId);

      logger.info("Bulk customer charges created successfully", {
        partnerId,
        chargeCount: bulkData.charges.length,
        successCount: response.data?.successCount || 0,
        failureCount: response.data?.failureCount || 0,
      });

      return response;
    } catch (error) {
      logger.error("Error creating bulk customer charges", {
        error: error.message,
        partnerId,
        chargeCount: bulkData.charges?.length || 0,
      });
      throw error;
    }
  }

  /**
   * Calculate customer charges for given parameters
   * @param {Object} calculationData - Charge calculation parameters
   * @param {string} calculationData.customerId - Customer ID
   * @param {number} calculationData.shipmentValue - Shipment value
   * @param {number} calculationData.weight - Package weight
   * @param {Array} calculationData.chargeTypes - Types of charges to calculate
   * @param {Object} calculationData.additionalParams - Additional calculation parameters
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Calculated charges breakdown
   */
  async calculateCustomerCharges(calculationData, partnerId) {
    try {
      const cacheKey = `${this.cachePrefix}:calculation:${this.createCalculationHash(calculationData, partnerId)}`;
      const redis = getClient();

      // Try cache first (shorter TTL for calculations)
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Customer charge calculation retrieved from cache", {
          calculationData,
          partnerId,
        });
        return JSON.parse(cached);
      }

      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/customer-charges/calculate",
        data: calculationData,
        params: { partnerId },
      });

      // Cache calculation for 10 minutes
      await redis.setex(cacheKey, 600, JSON.stringify(response));

      logger.info("Customer charges calculated successfully", {
        partnerId,
        customerId: calculationData.customerId,
        shipmentValue: calculationData.shipmentValue,
        weight: calculationData.weight,
        totalCharges: response.data?.totalCharges,
      });

      return response;
    } catch (error) {
      logger.error("Error calculating customer charges", {
        error: error.message,
        partnerId,
        calculationData,
      });
      throw error;
    }
  }

  /**
   * Get customer charges by customer ID
   * @param {string} customerId - Customer ID
   * @param {string} partnerId - Partner ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Customer-specific charges
   */
  async getCustomerSpecificCharges(customerId, partnerId, options = {}) {
    try {
      const cacheKey = `${this.cachePrefix}:customer:${customerId}:${partnerId}:${this.createFilterHash(options)}`;
      const redis = getClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Customer-specific charges retrieved from cache", {
          customerId,
          partnerId,
        });
        return JSON.parse(cached);
      }

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/customers/${customerId}/charges`,
        params: { partnerId, ...options },
      });

      // Cache for 1 hour
      await redis.setex(
        cacheKey,
        this.defaultCacheTTL,
        JSON.stringify(response),
      );

      logger.info("Customer-specific charges retrieved successfully", {
        customerId,
        partnerId,
        chargeCount: response.data?.charges?.length || 0,
      });

      return response;
    } catch (error) {
      logger.error("Error retrieving customer-specific charges", {
        error: error.message,
        customerId,
        partnerId,
        options,
      });
      throw error;
    }
  }

  /**
   * Get charge types and their configurations
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Available charge types and configurations
   */
  async getChargeTypes(partnerId) {
    try {
      const cacheKey = `${this.cachePrefix}:types:${partnerId}`;
      const redis = getClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Charge types retrieved from cache", { partnerId });
        return JSON.parse(cached);
      }

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/customer-charges/types",
        params: { partnerId },
      });

      // Cache for 24 hours (charge types don't change frequently)
      await redis.setex(cacheKey, 86400, JSON.stringify(response));

      logger.info("Charge types retrieved successfully", {
        partnerId,
        typeCount: response.data?.types?.length || 0,
      });

      return response;
    } catch (error) {
      logger.error("Error retrieving charge types", {
        error: error.message,
        partnerId,
      });
      throw error;
    }
  }

  /**
   * Validate customer charge data structure
   * @param {Object} chargeData - Customer charge data to validate
   * @throws {Error} If validation fails
   */
  validateCustomerChargeData(chargeData) {
    const required = ["type", "chargeType", "value"];
    const missing = required.filter((field) => !chargeData[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    // Validate charge type
    if (!Object.values(this.chargeTypes).includes(chargeData.type)) {
      throw new Error(
        `Invalid charge type: ${chargeData.type}. Must be one of: ${Object.values(this.chargeTypes).join(", ")}`,
      );
    }

    // Validate calculation type
    if (!Object.values(this.calculationTypes).includes(chargeData.chargeType)) {
      throw new Error(
        `Invalid charge calculation type: ${chargeData.chargeType}. Must be one of: ${Object.values(this.calculationTypes).join(", ")}`,
      );
    }

    // Validate charge value
    if (typeof chargeData.value !== "number" || chargeData.value < 0) {
      throw new Error("value must be a non-negative number");
    }

    // Validate weight thresholds if provided
    if (
      chargeData.minKg !== undefined &&
      (typeof chargeData.minKg !== "number" || chargeData.minKg < 0)
    ) {
      throw new Error("minKg must be a non-negative number");
    }

    if (
      chargeData.maxKg !== undefined &&
      (typeof chargeData.maxKg !== "number" || chargeData.maxKg < 0)
    ) {
      throw new Error("maxKg must be a non-negative number");
    }

    if (
      chargeData.minKg !== undefined &&
      chargeData.maxKg !== undefined &&
      chargeData.minKg > chargeData.maxKg
    ) {
      throw new Error("minKg cannot be greater than maxKg");
    }

    // Validate value thresholds if provided
    if (
      chargeData.minValue !== undefined &&
      (typeof chargeData.minValue !== "number" || chargeData.minValue < 0)
    ) {
      throw new Error("minValue must be a non-negative number");
    }

    if (
      chargeData.maxValue !== undefined &&
      (typeof chargeData.maxValue !== "number" || chargeData.maxValue < 0)
    ) {
      throw new Error("maxValue must be a non-negative number");
    }

    if (
      chargeData.minValue !== undefined &&
      chargeData.maxValue !== undefined &&
      chargeData.minValue > chargeData.maxValue
    ) {
      throw new Error("minValue cannot be greater than maxValue");
    }
  }

  /**
   * Create hash for filtering parameters
   * @param {Object} filters - Filter parameters
   * @returns {string} Hash string
   */
  createFilterHash(filters) {
    const crypto = require("crypto");
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return crypto.createHash("md5").update(filterString).digest("hex");
  }

  /**
   * Create hash for calculation parameters
   * @param {Object} calculationData - Calculation parameters
   * @param {string} partnerId - Partner ID
   * @returns {string} Hash string
   */
  createCalculationHash(calculationData, partnerId) {
    const crypto = require("crypto");
    const dataString = JSON.stringify(
      { ...calculationData, partnerId },
      Object.keys({ ...calculationData, partnerId }).sort(),
    );
    return crypto.createHash("md5").update(dataString).digest("hex");
  }

  /**
   * Clear customer charge-related cache entries
   * @param {string} partnerId - Partner ID
   * @param {string} customerId - Customer ID (optional)
   */
  async clearCustomerChargeCache(partnerId, customerId = null) {
    try {
      const redis = getClient();
      let pattern = `${this.cachePrefix}:*${partnerId}*`;

      if (customerId) {
        pattern = `${this.cachePrefix}:*${customerId}*${partnerId}*`;
      }

      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info("Customer charge cache cleared", {
          partnerId,
          customerId,
          keysCleared: keys.length,
        });
      }
    } catch (error) {
      logger.warn("Error clearing customer charge cache", {
        error: error.message,
        partnerId,
        customerId,
      });
    }
  }
}

module.exports = CustomerChargeService;
