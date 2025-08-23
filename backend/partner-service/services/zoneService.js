/**
 * Zone Service - External API Integration
 *
 * Handles zone management and service type configuration through external Partner Micro service
 * Integrates with https://calc.websiteduniya.com for zone operations
 *
 * Features:
 * - Zone listing and filtering
 * - Service type management
 * - Partner-specific zone retrieval
 * - Comprehensive partner data aggregation
 * - Response caching with Redis
 * - Error handling and fallbacks
 */

const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../shared/lib/redis");
const { ExternalPartnerClient } = require("./externalPartnerClient");

class ZoneService {
  constructor() {
    this.externalClient = new ExternalPartnerClient();
    this.cacheTTL = {
      zones: 24 * 60 * 60, // 24 hours for zones (less frequently changing)
      serviceTypes: 24 * 60 * 60, // 24 hours for service types
      partnerZones: 60 * 60, // 1 hour for partner-specific data
      comprehensiveData: 30 * 60, // 30 minutes for comprehensive data
    };
  }

  /**
   * Get all zones with optional filtering
   */
  async getAllZones(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      search = null,
      sortBy = "name",
      sortOrder = "asc",
    } = options;

    const cacheKey = `zones:all:${JSON.stringify(options)}`;

    try {
      // Check cache first
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Zones retrieved from cache", { cacheKey });
        return JSON.parse(cached);
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", limit.toString());
      if (status) queryParams.append("status", status);
      if (search) queryParams.append("search", search);
      queryParams.append("sortBy", sortBy);
      queryParams.append("sortOrder", sortOrder);

      // Call external API
      const endpoint = `/api/v1/zones?${queryParams.toString()}`;
      const response = await this.externalClient.makeRequest("GET", endpoint);

      if (!response || !response.success) {
        throw new Error("Failed to retrieve zones from external service");
      }

      // Cache the response
      await redis.setex(
        cacheKey,
        this.cacheTTL.zones,
        JSON.stringify(response),
      );

      logger.info("Zones retrieved successfully", {
        total: response.data?.length || 0,
        page,
        limit,
        cached: false,
      });

      return response;
    } catch (error) {
      logger.error("Failed to get zones", {
        error: error.message,
        options,
      });

      // Return fallback response
      return {
        success: false,
        error: {
          code: "ZONE_RETRIEVAL_ERROR",
          message: "Failed to retrieve zones",
          details: error.message,
        },
        data: [],
        meta: {
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalRecords: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
          summary: {
            totalZones: 0,
            totalPartners: 0,
            activeZones: 0,
            inactiveZones: 0,
          },
        },
      };
    }
  }

  /**
   * Create a new zone
   */
  async createZone(zoneData) {
    try {
      // Validate required fields
      const requiredFields = ["name", "description", "partnerId"];
      for (const field of requiredFields) {
        if (!zoneData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Call external API to create zone
      const response = await this.externalClient.makeRequest(
        "POST",
        "/api/v1/zones",
        zoneData,
      );

      if (!response || !response.success) {
        throw new Error("Failed to create zone in external service");
      }

      // Clear related caches
      await this.clearZoneCaches();

      logger.info("Zone created successfully", {
        zoneId: response.data?.id,
        zoneName: zoneData.name,
        partnerId: zoneData.partnerId,
      });

      return response;
    } catch (error) {
      logger.error("Failed to create zone", {
        error: error.message,
        zoneData: { ...zoneData, services: "[REDACTED]" },
      });

      return {
        success: false,
        error: {
          code: "ZONE_CREATION_ERROR",
          message: "Failed to create zone",
          details: error.message,
        },
      };
    }
  }

  /**
   * Get all service types
   */
  async getServiceTypes(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = "ACTIVE",
      category = null,
      sortBy = "sortOrder",
      sortOrder = "asc",
    } = options;

    const cacheKey = `service-types:${JSON.stringify(options)}`;

    try {
      // Check cache first
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Service types retrieved from cache", { cacheKey });
        return JSON.parse(cached);
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", limit.toString());
      if (status) queryParams.append("status", status);
      if (category) queryParams.append("category", category);
      queryParams.append("sortBy", sortBy);
      queryParams.append("sortOrder", sortOrder);

      // Call external API
      const endpoint = `/api/v1/service-types?${queryParams.toString()}`;
      const response = await this.externalClient.makeRequest("GET", endpoint);

      if (!response || !response.success) {
        throw new Error(
          "Failed to retrieve service types from external service",
        );
      }

      // Cache the response
      await redis.setex(
        cacheKey,
        this.cacheTTL.serviceTypes,
        JSON.stringify(response),
      );

      logger.info("Service types retrieved successfully", {
        total: response.data?.length || 0,
        page,
        limit,
        cached: false,
      });

      return response;
    } catch (error) {
      logger.error("Failed to get service types", {
        error: error.message,
        options,
      });

      // Return fallback response
      return {
        success: false,
        error: {
          code: "SERVICE_TYPE_RETRIEVAL_ERROR",
          message: "Failed to retrieve service types",
          details: error.message,
        },
        data: [],
        meta: {
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalCount: 0,
            limit: parseInt(limit),
            hasNext: false,
            hasPrev: false,
          },
          filters: {
            status,
            sortBy,
            sortOrder,
          },
        },
      };
    }
  }

  /**
   * Create a new service type
   */
  async createServiceType(serviceTypeData) {
    try {
      // Validate required fields
      const requiredFields = ["name", "displayName", "category"];
      for (const field of requiredFields) {
        if (!serviceTypeData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Call external API to create service type
      const response = await this.externalClient.makeRequest(
        "POST",
        "/api/v1/service-types",
        serviceTypeData,
      );

      if (!response || !response.success) {
        throw new Error("Failed to create service type in external service");
      }

      // Clear related caches
      await this.clearServiceTypeCaches();

      logger.info("Service type created successfully", {
        serviceTypeId: response.data?.id,
        name: serviceTypeData.name,
        category: serviceTypeData.category,
      });

      return response;
    } catch (error) {
      logger.error("Failed to create service type", {
        error: error.message,
        serviceTypeData,
      });

      return {
        success: false,
        error: {
          code: "SERVICE_TYPE_CREATION_ERROR",
          message: "Failed to create service type",
          details: error.message,
        },
      };
    }
  }

  /**
   * Get partner-specific zones
   */
  async getPartnerZones(partnerId, options = {}) {
    const {
      page = 1,
      limit = 50,
      status = null,
      search = null,
      sortBy = "name",
      sortOrder = "asc",
    } = options;

    const cacheKey = `partner-zones:${partnerId}:${JSON.stringify(options)}`;

    try {
      // Check cache first
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Partner zones retrieved from cache", {
          partnerId,
          cacheKey,
        });
        return JSON.parse(cached);
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", limit.toString());
      if (status) queryParams.append("status", status);
      if (search) queryParams.append("search", search);
      queryParams.append("sortBy", sortBy);
      queryParams.append("sortOrder", sortOrder);

      // Call external API
      const endpoint = `/api/v1/partner-zones/${partnerId}?${queryParams.toString()}`;
      const response = await this.externalClient.makeRequest("GET", endpoint);

      if (!response || !response.success) {
        throw new Error(
          "Failed to retrieve partner zones from external service",
        );
      }

      // Cache the response
      await redis.setex(
        cacheKey,
        this.cacheTTL.partnerZones,
        JSON.stringify(response),
      );

      logger.info("Partner zones retrieved successfully", {
        partnerId,
        total: response.data?.zones?.length || 0,
        page,
        limit,
        cached: false,
      });

      return response;
    } catch (error) {
      logger.error("Failed to get partner zones", {
        error: error.message,
        partnerId,
        options,
      });

      // Return fallback response
      return {
        success: false,
        error: {
          code: "PARTNER_ZONE_RETRIEVAL_ERROR",
          message: "Failed to retrieve partner zones",
          details: error.message,
        },
        data: {
          zones: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          filters: {
            partnerId,
            status,
            search,
            sortBy,
            sortOrder,
          },
          metadata: {
            totalZones: 0,
            activeZones: 0,
            inactiveZones: 0,
            averagePincodesPerZone: 0,
          },
        },
      };
    }
  }

  /**
   * Get comprehensive partner data (zones, packages, services, charges, discounts)
   */
  async getComprehensivePartnerData(partnerId, options = {}) {
    const { includeInactive = false, modules = null } = options;

    const cacheKey = `comprehensive-data:${partnerId}:${JSON.stringify(options)}`;

    try {
      // Check cache first
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Comprehensive partner data retrieved from cache", {
          partnerId,
          cacheKey,
        });
        return JSON.parse(cached);
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (includeInactive) queryParams.append("includeInactive", "true");
      if (modules) queryParams.append("modules", modules);

      // Call external API
      const endpoint = `/api/v1/partners/comprehensive-data/${partnerId}?${queryParams.toString()}`;
      const response = await this.externalClient.makeRequest("GET", endpoint);

      if (!response || !response.success) {
        throw new Error(
          "Failed to retrieve comprehensive partner data from external service",
        );
      }

      // Cache the response
      await redis.setex(
        cacheKey,
        this.cacheTTL.comprehensiveData,
        JSON.stringify(response),
      );

      logger.info("Comprehensive partner data retrieved successfully", {
        partnerId,
        modules: response.summary?.dataModules || [],
        totalRecords: response.summary?.totalRecords || 0,
        executionTime: response.execution_time_ms,
        cached: false,
      });

      return response;
    } catch (error) {
      logger.error("Failed to get comprehensive partner data", {
        error: error.message,
        partnerId,
        options,
      });

      // Return fallback response
      return {
        success: false,
        error: {
          code: "COMPREHENSIVE_DATA_ERROR",
          message: "Failed to retrieve comprehensive partner data",
          details: error.message,
        },
        data: {
          zones: { success: false, total: 0, zones: [] },
          packages: { success: false, packageCharges: { total: 0, items: [] } },
          services: { success: false, serviceTypes: { total: 0, items: [] } },
          charges: { success: false, customerCharges: { total: 0, items: [] } },
          discounts: { success: false, discounts: { total: 0, items: [] } },
        },
        summary: {
          dataModules: [],
          totalRecords: 0,
          hasErrors: true,
          errors: [error.message],
        },
      };
    }
  }

  /**
   * Validate zone coverage for given pincodes
   */
  async validateZoneCoverage(pincodes, partnerId = null) {
    try {
      // Since the zone-coverage-validation endpoint doesn't exist,
      // we'll use the comprehensive data to check coverage
      const data = partnerId
        ? await this.getComprehensivePartnerData(partnerId)
        : await this.getAllZones();

      if (!data.success) {
        throw new Error("Failed to retrieve zone data for coverage validation");
      }

      // Extract zones and check coverage
      const zones = partnerId ? data.data?.zones?.zones || [] : data.data || [];
      const coverage = {
        totalPincodes: pincodes.length,
        coveredPincodes: [],
        uncoveredPincodes: [],
        coverageByZone: {},
      };

      // Check each pincode against zones
      for (const pincode of pincodes) {
        let covered = false;
        for (const zone of zones) {
          if (zone.geographical?.pincodes?.includes(parseInt(pincode))) {
            coverage.coveredPincodes.push(pincode);
            if (!coverage.coverageByZone[zone.id]) {
              coverage.coverageByZone[zone.id] = {
                zoneName: zone.name,
                pincodes: [],
              };
            }
            coverage.coverageByZone[zone.id].pincodes.push(pincode);
            covered = true;
            break;
          }
        }
        if (!covered) {
          coverage.uncoveredPincodes.push(pincode);
        }
      }

      coverage.coveragePercentage =
        (coverage.coveredPincodes.length / coverage.totalPincodes) * 100;

      logger.info("Zone coverage validation completed", {
        partnerId,
        totalPincodes: coverage.totalPincodes,
        coveragePercentage: coverage.coveragePercentage,
      });

      return {
        success: true,
        data: coverage,
        message: "Zone coverage validation completed successfully",
      };
    } catch (error) {
      logger.error("Failed to validate zone coverage", {
        error: error.message,
        pincodes,
        partnerId,
      });

      return {
        success: false,
        error: {
          code: "ZONE_COVERAGE_VALIDATION_ERROR",
          message: "Failed to validate zone coverage",
          details: error.message,
        },
      };
    }
  }

  /**
   * Clear zone-related caches
   */
  async clearZoneCaches() {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys("zones:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.debug("Zone caches cleared", { keysCleared: keys.length });
    } catch (error) {
      logger.error("Failed to clear zone caches", { error: error.message });
    }
  }

  /**
   * Clear service type caches
   */
  async clearServiceTypeCaches() {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys("service-types:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.debug("Service type caches cleared", { keysCleared: keys.length });
    } catch (error) {
      logger.error("Failed to clear service type caches", {
        error: error.message,
      });
    }
  }

  /**
   * Clear partner-specific caches
   */
  async clearPartnerCaches(partnerId) {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`*${partnerId}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.debug("Partner caches cleared", {
        partnerId,
        keysCleared: keys.length,
      });
    } catch (error) {
      logger.error("Failed to clear partner caches", {
        error: error.message,
        partnerId,
      });
    }
  }
}

module.exports = ZoneService;
