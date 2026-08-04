const { getRedisClient } = require("../config/redis");
const { APIError, ValidationError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const { getExternalPartnerClient } = require("./externalPartnerClient");

class PartnerDataService {
  constructor() {
    this.redis = null;
    this.externalClient = getExternalPartnerClient();
    this.cacheTTL = {
      partnerData: 1800, // 30 minutes for partner data
      packages: 1800, // 30 minutes for packages
      charges: 3600, // 1 hour for charges
      discounts: 900, // 15 minutes for discounts (more dynamic)
      services: 7200, // 2 hours for services (more stable)
      comprehensive: 1800, // 30 minutes for comprehensive data
    };
  }

  /**
   * Get Redis client (lazy initialization)
   * @returns {Object} Redis client
   */
  getRedisClient() {
    if (!this.redis) {
      this.redis = getRedisClient();
    }
    return this.redis;
  }

  /**
   * Get partner packages with caching
   * @param {string} partnerId - Partner ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Partner packages data
   */
  async getPartnerPackages(partnerId, filters = {}) {
    try {
      const cacheKey = `partner_data:packages:${partnerId}:${this.createFilterHash(filters)}`;

      // Try cache first
      const redis = this.getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Partner packages retrieved from cache", {
          partnerId,
          filters,
        });
        return JSON.parse(cached);
      }

      // Get from database and external API
      const [localPackages, externalPackages] = await Promise.allSettled([
        this.getLocalPackages(partnerId, filters),
        this.getExternalPackages(partnerId, filters),
      ]);

      const packages = {
        partnerId,
        source: "aggregated",
        timestamp: new Date().toISOString(),
        local:
          localPackages.status === "fulfilled" ? localPackages.value : null,
        external:
          externalPackages.status === "fulfilled"
            ? externalPackages.value
            : null,
        metadata: {
          localCount:
            localPackages.status === "fulfilled"
              ? localPackages.value?.packages?.length || 0
              : 0,
          externalCount:
            externalPackages.status === "fulfilled"
              ? externalPackages.value?.packages?.length || 0
              : 0,
          filters: filters,
        },
      };

      // Cache the result
      await redis.setex(
        cacheKey,
        this.cacheTTL.packages,
        JSON.stringify(packages),
      );

      logger.info("Partner packages aggregated and cached", {
        partnerId,
        localCount: packages.metadata.localCount,
        externalCount: packages.metadata.externalCount,
      });

      return packages;
    } catch (error) {
      logger.error("Error retrieving partner packages", {
        partnerId,
        error: error.message,
      });
      throw new APIError("Failed to retrieve partner packages", 500);
    }
  }

  /**
   * Get partner charges with comprehensive aggregation
   * @param {string} partnerId - Partner ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Partner charges data
   */
  async getPartnerCharges(partnerId, filters = {}) {
    try {
      const cacheKey = `partner_data:charges:${partnerId}:${this.createFilterHash(filters)}`;

      // Try cache first
      const redis = this.getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Partner charges retrieved from cache", {
          partnerId,
          filters,
        });
        return JSON.parse(cached);
      }

      // Get all charge types
      const [packageCharges, customerCharges, externalCharges] =
        await Promise.allSettled([
          this.getLocalPackageCharges(partnerId, filters),
          this.getLocalCustomerCharges(partnerId, filters),
          this.getExternalCharges(partnerId, filters),
        ]);

      const charges = {
        partnerId,
        source: "aggregated",
        timestamp: new Date().toISOString(),
        packageCharges:
          packageCharges.status === "fulfilled" ? packageCharges.value : null,
        customerCharges:
          customerCharges.status === "fulfilled" ? customerCharges.value : null,
        externalCharges:
          externalCharges.status === "fulfilled" ? externalCharges.value : null,
        metadata: {
          packageChargeCount:
            packageCharges.status === "fulfilled"
              ? packageCharges.value?.charges?.length || 0
              : 0,
          customerChargeCount:
            customerCharges.status === "fulfilled"
              ? customerCharges.value?.charges?.length || 0
              : 0,
          externalChargeCount:
            externalCharges.status === "fulfilled"
              ? externalCharges.value?.charges?.length || 0
              : 0,
          filters: filters,
        },
      };

      // Cache the result
      await redis.setex(
        cacheKey,
        this.cacheTTL.charges,
        JSON.stringify(charges),
      );

      logger.info("Partner charges aggregated and cached", {
        partnerId,
        packageCount: charges.metadata.packageChargeCount,
        customerCount: charges.metadata.customerChargeCount,
        externalCount: charges.metadata.externalChargeCount,
      });

      return charges;
    } catch (error) {
      logger.error("Error retrieving partner charges", {
        partnerId,
        error: error.message,
      });
      throw new APIError("Failed to retrieve partner charges", 500);
    }
  }

  /**
   * Get partner discounts with time-based filtering
   * @param {string} partnerId - Partner ID
   * @param {Object} filters - Optional filters (includeExpired, activeOnly, etc.)
   * @returns {Promise<Object>} Partner discounts data
   */
  async getPartnerDiscounts(partnerId, filters = {}) {
    try {
      const cacheKey = `partner_data:discounts:${partnerId}:${this.createFilterHash(filters)}`;

      // Try cache first (shorter TTL for discounts due to time sensitivity)
      const redis = this.getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Partner discounts retrieved from cache", {
          partnerId,
          filters,
        });
        return JSON.parse(cached);
      }

      // Get discounts from external API
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/partners/${partnerId}/discounts`,
        params: filters,
      });

      const discounts = response.discounts || [];

      // Calculate discount statistics
      const now = new Date();
      const activeDiscounts = discounts.filter(
        (d) =>
          d.isActive &&
          new Date(d.startDate) <= now &&
          (!d.endDate || new Date(d.endDate) >= now),
      );

      const result = {
        partnerId,
        source: "database",
        timestamp: new Date().toISOString(),
        discounts,
        activeDiscounts,
        metadata: {
          totalCount: discounts.length,
          activeCount: activeDiscounts.length,
          expiredCount: discounts.length - activeDiscounts.length,
          discountTypes: [...new Set(discounts.map((d) => d.discountType))],
          filters: filters,
        },
      };

      // Cache the result (shorter TTL for discounts)
      await redis.setex(
        cacheKey,
        this.cacheTTL.discounts,
        JSON.stringify(result),
      );

      logger.info("Partner discounts retrieved and cached", {
        partnerId,
        totalCount: result.metadata.totalCount,
        activeCount: result.metadata.activeCount,
      });

      return result;
    } catch (error) {
      logger.error("Error retrieving partner discounts", {
        partnerId,
        error: error.message,
      });
      throw new APIError("Failed to retrieve partner discounts", 500);
    }
  }

  /**
   * Get partner services and capabilities
   * @param {string} partnerId - Partner ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Partner services data
   */
  async getPartnerServices(partnerId, filters = {}) {
    try {
      const cacheKey = `partner_data:services:${partnerId}:${this.createFilterHash(filters)}`;

      // Try cache first
      const redis = this.getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Partner services retrieved from cache", {
          partnerId,
          filters,
        });
        return JSON.parse(cached);
      }

      // Get partner data from external API
      const partner = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/partners/${partnerId}/services`,
      });

      if (!partner) {
        throw new ValidationError("Partner not found", { partnerId });
      }

      // Process external API response
      const serviceTypes = new Set(partner.serviceTypes || []);
      const zones = partner.zones || [];
      const capabilities = partner.capabilities || {
        cod: false,
        prepaid: false,
        express: false,
        standard: false,
        fragile: false,
        oversized: false,
      };

      const result = {
        partnerId,
        partnerName: partner.name,
        partnerCode: partner.code,
        source: "database",
        timestamp: new Date().toISOString(),
        serviceTypes: Array.from(serviceTypes),
        zones,
        capabilities,
        metadata: {
          totalZones: zones.length,
          activeZones: zones.filter((z) => z.isActive).length,
          totalServiceTypes: serviceTypes.size,
          isActive: partner.isActive,
          filters: filters,
        },
      };

      // Cache the result
      await redis.setex(
        cacheKey,
        this.cacheTTL.services,
        JSON.stringify(result),
      );

      logger.info("Partner services retrieved and cached", {
        partnerId,
        totalZones: result.metadata.totalZones,
        serviceTypes: result.metadata.totalServiceTypes,
      });

      return result;
    } catch (error) {
      logger.error("Error retrieving partner services", {
        partnerId,
        error: error.message,
      });
      throw new APIError("Failed to retrieve partner services", 500);
    }
  }

  /**
   * Get comprehensive partner data (all data types aggregated)
   * @param {string} partnerId - Partner ID
   * @param {Object} options - Options for data inclusion
   * @returns {Promise<Object>} Comprehensive partner data
   */
  async getComprehensivePartnerData(partnerId, options = {}) {
    try {
      const cacheKey = `partner_data:comprehensive:${partnerId}:${this.createFilterHash(options)}`;

      // Try cache first
      const redis = this.getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info("Comprehensive partner data retrieved from cache", {
          partnerId,
          options,
        });
        return JSON.parse(cached);
      }

      const {
        includePackages = true,
        includeCharges = true,
        includeDiscounts = true,
        includeServices = true,
        includeMetrics = true,
      } = options;

      // Get all data in parallel
      const dataPromises = [];

      if (includePackages) {
        dataPromises.push(
          this.getPartnerPackages(partnerId, options.packageFilters || {}),
        );
      }

      if (includeCharges) {
        dataPromises.push(
          this.getPartnerCharges(partnerId, options.chargeFilters || {}),
        );
      }

      if (includeDiscounts) {
        dataPromises.push(
          this.getPartnerDiscounts(partnerId, options.discountFilters || {}),
        );
      }

      if (includeServices) {
        dataPromises.push(
          this.getPartnerServices(partnerId, options.serviceFilters || {}),
        );
      }

      if (includeMetrics) {
        dataPromises.push(this.getPartnerMetrics(partnerId));
      }

      const results = await Promise.allSettled(dataPromises);

      const comprehensiveData = {
        partnerId,
        source: "comprehensive_aggregation",
        timestamp: new Date().toISOString(),
        data: {},
        metadata: {
          requestedInclusions: options,
          dataAvailability: {},
          aggregationTime: Date.now(),
        },
      };

      let resultIndex = 0;

      if (includePackages) {
        const packagesResult = results[resultIndex++];
        comprehensiveData.data.packages =
          packagesResult.status === "fulfilled" ? packagesResult.value : null;
        comprehensiveData.metadata.dataAvailability.packages =
          packagesResult.status === "fulfilled";
      }

      if (includeCharges) {
        const chargesResult = results[resultIndex++];
        comprehensiveData.data.charges =
          chargesResult.status === "fulfilled" ? chargesResult.value : null;
        comprehensiveData.metadata.dataAvailability.charges =
          chargesResult.status === "fulfilled";
      }

      if (includeDiscounts) {
        const discountsResult = results[resultIndex++];
        comprehensiveData.data.discounts =
          discountsResult.status === "fulfilled" ? discountsResult.value : null;
        comprehensiveData.metadata.dataAvailability.discounts =
          discountsResult.status === "fulfilled";
      }

      if (includeServices) {
        const servicesResult = results[resultIndex++];
        comprehensiveData.data.services =
          servicesResult.status === "fulfilled" ? servicesResult.value : null;
        comprehensiveData.metadata.dataAvailability.services =
          servicesResult.status === "fulfilled";
      }

      if (includeMetrics) {
        const metricsResult = results[resultIndex++];
        comprehensiveData.data.metrics =
          metricsResult.status === "fulfilled" ? metricsResult.value : null;
        comprehensiveData.metadata.dataAvailability.metrics =
          metricsResult.status === "fulfilled";
      }

      comprehensiveData.metadata.aggregationTime =
        Date.now() - comprehensiveData.metadata.aggregationTime;

      // Cache the comprehensive result
      await redis.setex(
        cacheKey,
        this.cacheTTL.comprehensive,
        JSON.stringify(comprehensiveData),
      );

      logger.info("Comprehensive partner data aggregated and cached", {
        partnerId,
        dataTypes: Object.keys(comprehensiveData.data),
        aggregationTime: comprehensiveData.metadata.aggregationTime,
      });

      return comprehensiveData;
    } catch (error) {
      logger.error("Error retrieving comprehensive partner data", {
        partnerId,
        error: error.message,
      });
      throw new APIError("Failed to retrieve comprehensive partner data", 500);
    }
  }

  /**
   * Get partner performance metrics
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Partner metrics
   */
  async getPartnerMetrics(partnerId) {
    try {
      // Get metrics from external API
      const partner = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/partners/${partnerId}/metrics`,
      });

      if (!partner) {
        throw new ValidationError("Partner not found", { partnerId });
      }

      // Use metrics from external API or calculate from available data
      const totalZones = partner.totalZones || 0;
      const activeZones = partner.activeZones || 0;
      const serviceTypeCount = partner.serviceTypeCount || 0;

      // Get discount statistics from external API
      const discountStats = partner.discountStats || {
        totalDiscounts: 0,
        averageDiscountValue: 0,
      };

      const metrics = {
        partnerId,
        partnerName: partner.name,
        timestamp: new Date().toISOString(),
        coverage: {
          totalZones,
          activeZones,
          coveragePercentage:
            totalZones > 0 ? (activeZones / totalZones) * 100 : 0,
        },
        services: {
          serviceTypeCount,
          isActive: partner.isActive || true,
        },
        discounts: {
          totalDiscounts: discountStats.totalDiscounts || 0,
          averageDiscountValue: discountStats.averageDiscountValue || 0,
        },
        performance: {
          // These would be calculated from actual shipment data
          // For now, return placeholder values
          onTimeDeliveryRate: 95.5,
          customerSatisfactionScore: 4.2,
          averageDeliveryTime: 2.5,
          costEfficiencyScore: 87.3,
        },
        lastUpdated: new Date().toISOString(),
      };

      return metrics;
    } catch (error) {
      logger.error("Error calculating partner metrics", {
        partnerId,
        error: error.message,
      });
      throw new APIError("Failed to calculate partner metrics", 500);
    }
  }

  // Helper methods for data retrieval

  async getLocalPackages(partnerId, filters) {
    // This would integrate with package service
    // For now, return structure for external API integration
    return {
      source: "local_database",
      packages: [],
      metadata: { source: "local", filters },
    };
  }

  async getExternalPackages(partnerId, filters) {
    try {
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/partners/${partnerId}/packages`,
        params: filters,
      });

      return {
        source: "external_api",
        packages: response.packages || [],
        metadata: {
          source: "external",
          filters,
          responseTime: response.responseTime,
        },
      };
    } catch (error) {
      logger.warn("External package retrieval failed, using fallback", {
        partnerId,
        error: error.message,
      });
      return {
        source: "external_api_fallback",
        packages: [],
        metadata: { source: "external", error: error.message, filters },
      };
    }
  }

  async getLocalPackageCharges(partnerId, filters) {
    // Charge packages were removed by the charges engine v3 redesign; pricing
    // now lives in charge_definitions / partner_charge_configs.
    return {
      source: "removed",
      packages: [],
      metadata: {
        note: "Charge packages replaced by charges engine v3 (charge-configs)",
        filters,
      },
    };
  }

  async getLocalCustomerCharges(partnerId, filters) {
    // This integrates with existing customer charge service
    const customerChargeService = require("./customerChargeService");
    return await customerChargeService.getCustomerCharges({
      partnerId,
      ...filters,
    });
  }

  async getExternalCharges(partnerId, filters) {
    try {
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/partners/${partnerId}/charges`,
        params: filters,
      });

      return {
        source: "external_api",
        charges: response.charges || [],
        metadata: {
          source: "external",
          filters,
          responseTime: response.responseTime,
        },
      };
    } catch (error) {
      logger.warn("External charge retrieval failed, using fallback", {
        partnerId,
        error: error.message,
      });
      return {
        source: "external_api_fallback",
        charges: [],
        metadata: { source: "external", error: error.message, filters },
      };
    }
  }

  /**
   * Clear partner data cache
   * @param {string} partnerId - Partner ID
   * @param {string} dataType - Specific data type to clear (optional)
   */
  async clearPartnerCache(partnerId, dataType = null) {
    try {
      const redis = this.getRedisClient();
      const patterns = dataType
        ? [`partner_data:${dataType}:${partnerId}:*`]
        : [
            `partner_data:packages:${partnerId}:*`,
            `partner_data:charges:${partnerId}:*`,
            `partner_data:discounts:${partnerId}:*`,
            `partner_data:services:${partnerId}:*`,
            `partner_data:comprehensive:${partnerId}:*`,
          ];

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.info("Partner cache cleared", { partnerId, dataType, patterns });
    } catch (error) {
      logger.error("Error clearing partner cache", {
        partnerId,
        dataType,
        error: error.message,
      });
    }
  }

  /**
   * Create hash for filter objects to use in cache keys
   * @param {Object} filters - Filter object
   * @returns {string} Hash string
   */
  createFilterHash(filters) {
    const crypto = require("crypto");
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return crypto
      .createHash("md5")
      .update(filterString)
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * Validate partner exists
   * @param {string} partnerId - Partner ID
   * @returns {Promise<boolean>} Whether partner exists
   */
  async validatePartnerExists(partnerId) {
    try {
      // Use external API to validate partner existence
      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/partners/${partnerId}`,
      });
      return !!response && response.id === partnerId;
    } catch (error) {
      logger.error("Error validating partner existence", {
        partnerId,
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = new PartnerDataService();
