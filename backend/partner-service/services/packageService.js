/**
 * Package Service
 *
 * Handles package charge management and configuration through external API integration
 * Integrates with Partner Micro service for package charge operations
 *
 * Features:
 * - Package charge retrieval with filtering
 * - Package charge creation and updates
 * - Bulk package charge operations
 * - Weight-based charge calculation
 * - Zone-to-zone package charge mapping
 * - Response caching with Redis
 * - Comprehensive error handling
 */

const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../shared/lib/redis");
const { ExternalPartnerClient } = require("./externalPartnerClient");

class PackageService {
  constructor() {
    this.externalClient = new ExternalPartnerClient();
    this.cachePrefix = "package_service";
    this.defaultCacheTTL = 1800; // 30 minutes for package charges
  }

  /**
   * Get package charges with filtering options
   * @param {Object} filters - Filtering options
   * @param {string} filters.partnerId - Partner ID for filtering
   * @param {string} filters.packageName - Package name filter
   * @param {number} filters.fromZoneId - Source zone ID
   * @param {number} filters.toZoneId - Destination zone ID
   * @param {boolean} filters.status - Active status filter
   * @param {number} filters.page - Page number for pagination
   * @param {number} filters.limit - Items per page
   * @returns {Promise<Object>} Package charges data
   */
  async getPackageCharges(filters = {}) {
    try {
      const cacheKey = `${this.cachePrefix}:charges:${this.createFilterHash(filters)}`;
      const redis = getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Package charges retrieved from cache", { filters });
        return JSON.parse(cached);
      }

      // Call external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/packages/charges",
        params: filters,
      });

      // Cache the response
      await redis.setex(
        cacheKey,
        this.defaultCacheTTL,
        JSON.stringify(response),
      );

      logger.info("Package charges retrieved from external API", {
        filters,
        count: response.data?.packages?.length || 0,
      });

      return response;
    } catch (error) {
      logger.error("Error retrieving package charges", {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Create new package charge configuration
   * @param {Object} packageData - Package charge configuration
   * @param {string} packageData.packageName - Name of the package
   * @param {number} packageData.baseWeight - Base weight for the package
   * @param {number} packageData.baseCharge - Base charge for the package
   * @param {number} packageData.addonWeight - Additional weight increment
   * @param {number} packageData.addonCharge - Additional charge per increment
   * @param {number} packageData.fromZoneId - Source zone ID
   * @param {number} packageData.toZoneId - Destination zone ID
   * @param {boolean} packageData.status - Active status
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Created package charge data
   */
  async createPackageCharge(packageData, partnerId) {
    try {
      // Validate required fields
      this.validatePackageData(packageData);

      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/packages/charges",
        data: packageData,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearPackageCache(partnerId);

      logger.info("Package charge created successfully", {
        partnerId,
        packageName: packageData.packageName,
        packageId: response.data?.package?.id,
      });

      return response;
    } catch (error) {
      logger.error("Error creating package charge", {
        error: error.message,
        partnerId,
        packageData,
      });
      throw error;
    }
  }

  /**
   * Update existing package charge configuration
   * @param {string} packageId - Package charge ID to update
   * @param {Object} updateData - Updated package charge data
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Updated package charge data
   */
  async updatePackageCharge(packageId, updateData, partnerId) {
    try {
      const response = await this.externalClient.makeRequest({
        method: "PUT",
        url: `/api/v1/packages/charges/${packageId}`,
        data: updateData,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearPackageCache(partnerId);

      logger.info("Package charge updated successfully", {
        partnerId,
        packageId,
        updatedFields: Object.keys(updateData),
      });

      return response;
    } catch (error) {
      logger.error("Error updating package charge", {
        error: error.message,
        partnerId,
        packageId,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Delete package charge configuration
   * @param {string} packageId - Package charge ID to delete
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deletePackageCharge(packageId, partnerId) {
    try {
      const response = await this.externalClient.makeRequest({
        method: "DELETE",
        url: `/api/v1/packages/charges/${packageId}`,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearPackageCache(partnerId);

      logger.info("Package charge deleted successfully", {
        partnerId,
        packageId,
      });

      return response;
    } catch (error) {
      logger.error("Error deleting package charge", {
        error: error.message,
        partnerId,
        packageId,
      });
      throw error;
    }
  }

  /**
   * Create multiple package charges in bulk
   * @param {Object} bulkData - Bulk package charges data
   * @param {Array} bulkData.packages - Array of package charge configurations
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Bulk creation results
   */
  async createBulkPackageCharges(bulkData, partnerId) {
    try {
      // Validate bulk data
      if (!bulkData.packages || !Array.isArray(bulkData.packages)) {
        throw new Error("Invalid bulk data: packages array is required");
      }

      // Validate each package in the bulk data
      bulkData.packages.forEach((pkg, index) => {
        try {
          this.validatePackageData(pkg);
        } catch (error) {
          throw new Error(
            `Invalid package data at index ${index}: ${error.message}`,
          );
        }
      });

      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/packages/charges/bulk",
        data: bulkData,
        params: { partnerId },
      });

      // Clear related cache entries
      await this.clearPackageCache(partnerId);

      logger.info("Bulk package charges created successfully", {
        partnerId,
        packageCount: bulkData.packages.length,
        successCount: response.data?.successCount || 0,
        failureCount: response.data?.failureCount || 0,
      });

      return response;
    } catch (error) {
      logger.error("Error creating bulk package charges", {
        error: error.message,
        partnerId,
        packageCount: bulkData.packages?.length || 0,
      });
      throw error;
    }
  }

  /**
   * Calculate package charges for given weight and zones
   * @param {Object} calculationData - Charge calculation parameters
   * @param {number} calculationData.weight - Package weight
   * @param {number} calculationData.fromZoneId - Source zone ID
   * @param {number} calculationData.toZoneId - Destination zone ID
   * @param {string} calculationData.packageType - Package type/name
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Calculated charges
   */
  async calculatePackageCharges(calculationData, partnerId) {
    try {
      const cacheKey = `${this.cachePrefix}:calculation:${this.createCalculationHash(calculationData, partnerId)}`;
      const redis = getRedisClient();

      // Try cache first (shorter TTL for calculations)
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Package charge calculation retrieved from cache", {
          calculationData,
          partnerId,
        });
        return JSON.parse(cached);
      }

      const response = await this.externalClient.makeRequest({
        method: "POST",
        url: "/api/v1/packages/charges/calculate",
        data: calculationData,
        params: { partnerId },
      });

      // Cache calculation for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(response));

      logger.info("Package charges calculated successfully", {
        partnerId,
        weight: calculationData.weight,
        fromZone: calculationData.fromZoneId,
        toZone: calculationData.toZoneId,
        totalCharge: response.data?.totalCharge,
      });

      return response;
    } catch (error) {
      logger.error("Error calculating package charges", {
        error: error.message,
        partnerId,
        calculationData,
      });
      throw error;
    }
  }

  /**
   * Get package charges by partner ID
   * @param {string} partnerId - Partner ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Partner-specific package charges
   */
  async getPartnerPackageCharges(partnerId, options = {}) {
    try {
      const cacheKey = `${this.cachePrefix}:partner:${partnerId}:${this.createFilterHash(options)}`;
      const redis = getRedisClient();

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Partner package charges retrieved from cache", {
          partnerId,
        });
        return JSON.parse(cached);
      }

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/partners/${partnerId}/packages/charges`,
        params: options,
      });

      // Cache for 30 minutes
      await redis.setex(
        cacheKey,
        this.defaultCacheTTL,
        JSON.stringify(response),
      );

      logger.info("Partner package charges retrieved successfully", {
        partnerId,
        packageCount: response.data?.packages?.length || 0,
      });

      return response;
    } catch (error) {
      logger.error("Error retrieving partner package charges", {
        error: error.message,
        partnerId,
        options,
      });
      throw error;
    }
  }

  /**
   * Validate package data structure
   * @param {Object} packageData - Package data to validate
   * @throws {Error} If validation fails
   */
  validatePackageData(packageData) {
    const required = ["packageName", "baseWeight", "baseCharge"];
    const missing = required.filter((field) => !packageData[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    if (
      typeof packageData.baseWeight !== "number" ||
      packageData.baseWeight <= 0
    ) {
      throw new Error("baseWeight must be a positive number");
    }

    if (
      typeof packageData.baseCharge !== "number" ||
      packageData.baseCharge <= 0
    ) {
      throw new Error("baseCharge must be a positive number");
    }

    if (
      packageData.addonWeight &&
      (typeof packageData.addonWeight !== "number" ||
        packageData.addonWeight <= 0)
    ) {
      throw new Error("addonWeight must be a positive number");
    }

    if (
      packageData.addonCharge &&
      (typeof packageData.addonCharge !== "number" ||
        packageData.addonCharge <= 0)
    ) {
      throw new Error("addonCharge must be a positive number");
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
   * Clear package-related cache entries
   * @param {string} partnerId - Partner ID
   */
  async clearPackageCache(partnerId) {
    try {
      const redis = getRedisClient();
      const pattern = `${this.cachePrefix}:*${partnerId}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info("Package cache cleared", {
          partnerId,
          keysCleared: keys.length,
        });
      }
    } catch (error) {
      logger.warn("Error clearing package cache", {
        error: error.message,
        partnerId,
      });
    }
  }
}

module.exports = PackageService;
