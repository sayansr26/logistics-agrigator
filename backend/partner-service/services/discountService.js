/**
 * Discount Service
 *
 * Handles discount management and configuration through external API integration
 * Integrates with Partner Micro service for discount operations
 *
 * Features:
 * - Discount CRUD operations with filtering
 * - Bulk discount management
 * - Time-based discount activation/deactivation
 * - Discount calculation logic integration
 * - Discount conflict resolution
 * - Performance analytics and audit trail
 * - Response caching with Redis
 * - Comprehensive error handling
 */

const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../shared/lib/redis");
const { ExternalPartnerClient } = require("./externalPartnerClient");

class DiscountService {
  constructor() {
    this.externalClient = new ExternalPartnerClient();
    this.cachePrefix = "discount_service";
    this.defaultCacheTTL = 3600; // 1 hour for discount data
    this.calculationCacheTTL = 600; // 10 minutes for discount calculations
  }

  /**
   * Get discounts with filtering options
   * @param {Object} filters - Filtering options
   * @param {string} filters.partnerId - Partner ID for filtering
   * @param {string} filters.discountType - Discount type (PERCENTAGE, FLAT, TIERED)
   * @param {string} filters.applicableOn - What discount applies to (PACKAGE, CUSTOMER_CHARGE, TOTAL)
   * @param {boolean} filters.isActive - Active status filter
   * @param {Date} filters.validFrom - Valid from date filter
   * @param {Date} filters.validTo - Valid to date filter
   * @param {number} filters.page - Page number for pagination
   * @param {number} filters.limit - Items per page
   * @returns {Promise<Object>} Discounts data
   */
  async getDiscounts(filters = {}) {
    try {
      const cacheKey = `${this.cachePrefix}:discounts:${this.createFilterHash(filters)}`;
      const redis = getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Discounts retrieved from cache", { filters });
        return JSON.parse(cached);
      }

      // Call external API
      const response = await this.externalClient.makeRequest(
        "/api/v1/discounts",
        {
          method: "GET",
          params: filters,
        },
      );

      if (response.success && response.data) {
        // Cache the response
        await redis.setex(
          cacheKey,
          this.defaultCacheTTL,
          JSON.stringify(response.data),
        );

        logger.info("Discounts retrieved from external API", {
          filters,
          count: response.data.discounts?.length || 0,
        });

        return response.data;
      }

      throw new Error(response.message || "Failed to retrieve discounts");
    } catch (error) {
      logger.error("Error retrieving discounts", {
        error: error.message,
        filters,
        stack: error.stack,
      });

      // Return fallback empty response
      return {
        discounts: [],
        pagination: {
          page: filters.page || 1,
          limit: filters.limit || 20,
          total: 0,
          totalPages: 0,
        },
        message: "Discounts temporarily unavailable",
      };
    }
  }

  /**
   * Get discount by ID
   * @param {string} discountId - Discount ID
   * @param {string} partnerId - Partner ID (optional)
   * @returns {Promise<Object>} Discount details
   */
  async getDiscountById(discountId, partnerId = null) {
    try {
      const cacheKey = `${this.cachePrefix}:discount:${discountId}:${partnerId || "all"}`;
      const redis = getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Discount details retrieved from cache", {
          discountId,
          partnerId,
        });
        return JSON.parse(cached);
      }

      // Call external API
      const endpoint = `/api/v1/discounts/${discountId}`;
      const params = partnerId ? { partnerId } : {};

      const response = await this.externalClient.makeRequest(endpoint, {
        method: "GET",
        params,
      });

      if (response.success && response.data) {
        // Cache the response
        await redis.setex(
          cacheKey,
          this.defaultCacheTTL,
          JSON.stringify(response.data),
        );

        logger.info("Discount details retrieved from external API", {
          discountId,
          partnerId,
          discountType: response.data.discountType,
        });

        return response.data;
      }

      throw new Error(response.message || "Discount not found");
    } catch (error) {
      logger.error("Error retrieving discount details", {
        error: error.message,
        discountId,
        partnerId,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Create new discount
   * @param {Object} discountData - Discount configuration
   * @param {string} discountData.partnerId - Partner ID
   * @param {string} discountData.discountName - Discount name
   * @param {string} discountData.discountType - Type (PERCENTAGE, FLAT, TIERED)
   * @param {string} discountData.applicableOn - What it applies to
   * @param {number} discountData.discountValue - Discount value
   * @param {Object} discountData.conditions - Discount conditions
   * @param {Date} discountData.validFrom - Valid from date
   * @param {Date} discountData.validTo - Valid to date
   * @param {boolean} discountData.isActive - Active status
   * @returns {Promise<Object>} Created discount
   */
  async createDiscount(discountData) {
    try {
      // Validate discount data
      this.validateDiscountData(discountData);

      // Call external API
      const response = await this.externalClient.makeRequest(
        "/api/v1/discounts",
        {
          method: "POST",
          data: discountData,
        },
      );

      if (response.success && response.data) {
        // Clear related caches
        await this.clearDiscountCaches(discountData.partnerId);

        logger.info("Discount created successfully", {
          discountId: response.data.discountId,
          partnerId: discountData.partnerId,
          discountType: discountData.discountType,
        });

        return response.data;
      }

      throw new Error(response.message || "Failed to create discount");
    } catch (error) {
      logger.error("Error creating discount", {
        error: error.message,
        discountData,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Update existing discount
   * @param {string} discountId - Discount ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated discount
   */
  async updateDiscount(discountId, updateData) {
    try {
      // Validate update data
      if (updateData.discountType || updateData.discountValue) {
        this.validateDiscountData(updateData, false);
      }

      // Call external API
      const response = await this.externalClient.makeRequest(
        `/api/v1/discounts/${discountId}`,
        {
          method: "PUT",
          data: updateData,
        },
      );

      if (response.success && response.data) {
        // Clear related caches
        await this.clearDiscountCaches(
          updateData.partnerId || response.data.partnerId,
        );

        logger.info("Discount updated successfully", {
          discountId,
          partnerId: updateData.partnerId || response.data.partnerId,
        });

        return response.data;
      }

      throw new Error(response.message || "Failed to update discount");
    } catch (error) {
      logger.error("Error updating discount", {
        error: error.message,
        discountId,
        updateData,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Delete discount
   * @param {string} discountId - Discount ID
   * @param {string} partnerId - Partner ID (optional)
   * @returns {Promise<Object>} Deletion result
   */
  async deleteDiscount(discountId, partnerId = null) {
    try {
      // Call external API
      const params = partnerId ? { partnerId } : {};
      const response = await this.externalClient.makeRequest(
        `/api/v1/discounts/${discountId}`,
        {
          method: "DELETE",
          params,
        },
      );

      if (response.success) {
        // Clear related caches
        await this.clearDiscountCaches(partnerId);

        logger.info("Discount deleted successfully", {
          discountId,
          partnerId,
        });

        return response.data || { message: "Discount deleted successfully" };
      }

      throw new Error(response.message || "Failed to delete discount");
    } catch (error) {
      logger.error("Error deleting discount", {
        error: error.message,
        discountId,
        partnerId,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Bulk create discounts
   * @param {Array} discountsData - Array of discount configurations
   * @returns {Promise<Object>} Bulk creation results
   */
  async bulkCreateDiscounts(discountsData) {
    try {
      // Validate all discount data
      discountsData.forEach((discount, index) => {
        try {
          this.validateDiscountData(discount);
        } catch (error) {
          throw new Error(
            `Validation failed for discount at index ${index}: ${error.message}`,
          );
        }
      });

      // Call external API
      const response = await this.externalClient.makeRequest(
        "/api/v1/discounts/bulk",
        {
          method: "POST",
          data: { discounts: discountsData },
        },
      );

      if (response.success && response.data) {
        // Clear related caches for all partners
        const partnerIds = [...new Set(discountsData.map((d) => d.partnerId))];
        await Promise.all(
          partnerIds.map((partnerId) => this.clearDiscountCaches(partnerId)),
        );

        logger.info("Bulk discount creation completed", {
          totalDiscounts: discountsData.length,
          successful: response.data.successful?.length || 0,
          failed: response.data.failed?.length || 0,
        });

        return response.data;
      }

      throw new Error(response.message || "Failed to create discounts in bulk");
    } catch (error) {
      logger.error("Error in bulk discount creation", {
        error: error.message,
        totalDiscounts: discountsData.length,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Calculate discount for given parameters
   * @param {Object} calculationData - Calculation parameters
   * @param {string} calculationData.partnerId - Partner ID
   * @param {number} calculationData.baseAmount - Base amount to calculate discount on
   * @param {string} calculationData.applicableOn - What discount applies to
   * @param {Object} calculationData.conditions - Additional conditions
   * @returns {Promise<Object>} Discount calculation result
   */
  async calculateDiscount(calculationData) {
    try {
      const cacheKey = `${this.cachePrefix}:calculation:${this.createCalculationHash(calculationData)}`;
      const redis = getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Discount calculation retrieved from cache", {
          calculationData,
        });
        return JSON.parse(cached);
      }

      // Call external API
      const response = await this.externalClient.makeRequest(
        "/api/v1/discounts/calculate",
        {
          method: "POST",
          data: calculationData,
        },
      );

      if (response.success && response.data) {
        // Cache the response
        await redis.setex(
          cacheKey,
          this.calculationCacheTTL,
          JSON.stringify(response.data),
        );

        logger.info("Discount calculation completed", {
          partnerId: calculationData.partnerId,
          baseAmount: calculationData.baseAmount,
          totalDiscount: response.data.totalDiscount,
          finalAmount: response.data.finalAmount,
        });

        return response.data;
      }

      throw new Error(response.message || "Failed to calculate discount");
    } catch (error) {
      logger.error("Error calculating discount", {
        error: error.message,
        calculationData,
        stack: error.stack,
      });

      // Return fallback calculation
      return {
        baseAmount: calculationData.baseAmount,
        applicableDiscounts: [],
        totalDiscount: 0,
        finalAmount: calculationData.baseAmount,
        message: "Discount calculation temporarily unavailable",
      };
    }
  }

  /**
   * Get active discounts for partner
   * @param {string} partnerId - Partner ID
   * @param {string} applicableOn - What discount applies to (optional)
   * @returns {Promise<Object>} Active discounts
   */
  async getActiveDiscounts(partnerId, applicableOn = null) {
    try {
      const filters = {
        partnerId,
        isActive: true,
        validFrom: new Date().toISOString(),
        validTo: new Date().toISOString(),
      };

      if (applicableOn) {
        filters.applicableOn = applicableOn;
      }

      const cacheKey = `${this.cachePrefix}:active:${partnerId}:${applicableOn || "all"}`;
      const redis = getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Active discounts retrieved from cache", {
          partnerId,
          applicableOn,
        });
        return JSON.parse(cached);
      }

      // Call external API
      const response = await this.externalClient.makeRequest(
        "/api/v1/discounts/active",
        {
          method: "GET",
          params: filters,
        },
      );

      if (response.success && response.data) {
        // Cache the response with shorter TTL
        await redis.setex(cacheKey, 900, JSON.stringify(response.data)); // 15 minutes

        logger.info("Active discounts retrieved from external API", {
          partnerId,
          applicableOn,
          count: response.data.discounts?.length || 0,
        });

        return response.data;
      }

      throw new Error(
        response.message || "Failed to retrieve active discounts",
      );
    } catch (error) {
      logger.error("Error retrieving active discounts", {
        error: error.message,
        partnerId,
        applicableOn,
        stack: error.stack,
      });

      // Return fallback empty response
      return {
        discounts: [],
        message: "Active discounts temporarily unavailable",
      };
    }
  }

  /**
   * Validate discount data
   * @param {Object} discountData - Discount data to validate
   * @param {boolean} isCreate - Whether this is for creation (requires all fields)
   */
  validateDiscountData(discountData, isCreate = true) {
    const requiredFields = isCreate
      ? [
          "partnerId",
          "discountName",
          "discountType",
          "applicableOn",
          "discountValue",
        ]
      : [];

    // Check required fields
    requiredFields.forEach((field) => {
      if (!discountData[field]) {
        throw new Error(`${field} is required`);
      }
    });

    // Validate discount type
    if (discountData.discountType) {
      const validTypes = [
        "PERCENTAGE",
        "FLAT",
        "TIERED",
        "BUY_X_GET_Y",
        "MINIMUM_ORDER",
      ];
      if (!validTypes.includes(discountData.discountType)) {
        throw new Error(
          `Invalid discount type. Must be one of: ${validTypes.join(", ")}`,
        );
      }
    }

    // Validate applicable on
    if (discountData.applicableOn) {
      const validApplicableOn = [
        "PACKAGE",
        "CUSTOMER_CHARGE",
        "TOTAL",
        "SHIPPING",
        "COD",
      ];
      if (!validApplicableOn.includes(discountData.applicableOn)) {
        throw new Error(
          `Invalid applicableOn. Must be one of: ${validApplicableOn.join(", ")}`,
        );
      }
    }

    // Validate discount value
    if (discountData.discountValue !== undefined) {
      if (
        typeof discountData.discountValue !== "number" ||
        discountData.discountValue < 0
      ) {
        throw new Error("Discount value must be a positive number");
      }

      // Additional validation for percentage discounts
      if (
        discountData.discountType === "PERCENTAGE" &&
        discountData.discountValue > 100
      ) {
        throw new Error("Percentage discount cannot exceed 100%");
      }
    }

    // Validate dates
    if (discountData.validFrom && discountData.validTo) {
      const fromDate = new Date(discountData.validFrom);
      const toDate = new Date(discountData.validTo);

      if (fromDate >= toDate) {
        throw new Error("Valid from date must be before valid to date");
      }
    }
  }

  /**
   * Clear discount-related caches
   * @param {string} partnerId - Partner ID (optional)
   */
  async clearDiscountCaches(partnerId = null) {
    try {
      const redis = getRedisClient();
      const patterns = [
        `${this.cachePrefix}:discounts:*`,
        `${this.cachePrefix}:calculation:*`,
        `${this.cachePrefix}:active:*`,
      ];

      if (partnerId) {
        patterns.push(`${this.cachePrefix}:*:${partnerId}:*`);
      }

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.info("Discount caches cleared", { partnerId, patterns });
    } catch (error) {
      logger.error("Error clearing discount caches", {
        error: error.message,
        partnerId,
      });
    }
  }

  /**
   * Create hash for filter parameters
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
   * @returns {string} Hash string
   */
  createCalculationHash(calculationData) {
    const crypto = require("crypto");
    const calcString = JSON.stringify(
      calculationData,
      Object.keys(calculationData).sort(),
    );
    return crypto.createHash("md5").update(calcString).digest("hex");
  }

  /**
   * Get discount performance analytics
   * @param {string} partnerId - Partner ID (optional)
   * @param {Object} dateRange - Date range for analytics
   * @returns {Promise<Object>} Performance analytics
   */
  async getDiscountAnalytics(partnerId = null, dateRange = {}) {
    try {
      const params = { ...dateRange };
      if (partnerId) {
        params.partnerId = partnerId;
      }

      const response = await this.externalClient.makeRequest(
        "/api/v1/discounts/analytics",
        {
          method: "GET",
          params,
        },
      );

      if (response.success && response.data) {
        logger.info("Discount analytics retrieved", {
          partnerId,
          dateRange,
          totalDiscounts: response.data.totalDiscounts,
        });

        return response.data;
      }

      throw new Error(
        response.message || "Failed to retrieve discount analytics",
      );
    } catch (error) {
      logger.error("Error retrieving discount analytics", {
        error: error.message,
        partnerId,
        dateRange,
        stack: error.stack,
      });

      // Return fallback analytics
      return {
        totalDiscounts: 0,
        activeDiscounts: 0,
        totalSavings: 0,
        averageDiscountPercentage: 0,
        message: "Analytics temporarily unavailable",
      };
    }
  }
}

module.exports = { DiscountService };
