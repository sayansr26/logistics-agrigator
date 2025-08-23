/**
 * Geographical Service
 *
 * Handles geographical data operations by integrating with external Partner Micro service
 * Provides pincode search, city/state data, and geographical hierarchy services
 */

const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../shared/lib/redis");
const { getExternalPartnerClient } = require("./externalPartnerClient");

class GeographicalService {
  constructor() {
    this.externalClient = getExternalPartnerClient();
    this.cachePrefix = "geo_data";
    this.defaultCacheTTL = 86400; // 24 hours for geographical data
  }

  /**
   * Generate cache key for geographical data
   */
  getCacheKey(type, params) {
    const paramString = JSON.stringify(params);
    const crypto = require("crypto");
    return `${this.cachePrefix}:${type}:${crypto.createHash("md5").update(paramString).digest("hex")}`;
  }

  /**
   * Get cached geographical data
   */
  async getCachedData(cacheKey) {
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn("Cache get failed for geographical data", {
        error: error.message,
        cacheKey,
      });
      return null;
    }
  }

  /**
   * Set cached geographical data
   */
  async setCachedData(cacheKey, data, ttl = this.defaultCacheTTL) {
    try {
      const redis = await getRedisClient();
      await redis.setex(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      logger.warn("Cache set failed for geographical data", {
        error: error.message,
        cacheKey,
      });
    }
  }

  /**
   * Search pincodes with comprehensive filtering
   */
  async searchPincodes(params) {
    const {
      pincode,
      city,
      state,
      district,
      type,
      latitude,
      longitude,
      radius,
      page = 1,
      limit = 20,
      sortBy = "pincode",
      searchMode = "partial",
      includeHierarchy = false,
      includeCoordinates = false,
      includeMetadata = false,
    } = params;

    const cacheKey = this.getCacheKey("pincode_search", params);

    // Try to get cached response
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      logger.info("Returning cached pincode search", { cacheKey });
      return cached;
    }

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (pincode) queryParams.append("pincode", pincode);
      if (city) queryParams.append("city", city);
      if (state) queryParams.append("state", state);
      if (district) queryParams.append("district", district);
      if (type) queryParams.append("type", type);
      if (latitude) queryParams.append("latitude", latitude);
      if (longitude) queryParams.append("longitude", longitude);
      if (radius) queryParams.append("radius", radius);
      queryParams.append("page", page);
      queryParams.append("limit", limit);
      queryParams.append("sortBy", sortBy);
      queryParams.append("searchMode", searchMode);
      queryParams.append("includeHierarchy", includeHierarchy);
      queryParams.append("includeCoordinates", includeCoordinates);
      queryParams.append("includeMetadata", includeMetadata);

      logger.info("Searching pincodes via external API", { params });

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/pincodes/search?${queryParams.toString()}`,
      });

      // Cache successful response
      if (response.success) {
        await this.setCachedData(cacheKey, response);
      }

      return response;
    } catch (error) {
      logger.error("Pincode search failed", { error: error.message, params });
      throw error;
    }
  }

  /**
   * Get specific pincode details
   */
  async getPincodeDetails(pincode) {
    const cacheKey = this.getCacheKey("pincode_details", { pincode });

    // Try to get cached response
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      logger.info("Returning cached pincode details", { pincode });
      return cached;
    }

    try {
      logger.info("Getting pincode details via external API", { pincode });

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/pincodes/${pincode}`,
      });

      // Cache successful response
      if (response.success) {
        await this.setCachedData(cacheKey, response);
      }

      return response;
    } catch (error) {
      logger.error("Get pincode details failed", {
        error: error.message,
        pincode,
      });
      throw error;
    }
  }

  /**
   * Get geographical hierarchy for pincode
   */
  async getPincodeHierarchy(pincode) {
    const cacheKey = this.getCacheKey("pincode_hierarchy", { pincode });

    // Try to get cached response
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      logger.info("Returning cached pincode hierarchy", { pincode });
      return cached;
    }

    try {
      logger.info("Getting pincode hierarchy via external API", { pincode });

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/pincodes/${pincode}/hierarchy`,
      });

      // Cache successful response
      if (response.success) {
        await this.setCachedData(cacheKey, response);
      }

      return response;
    } catch (error) {
      logger.error("Get pincode hierarchy failed", {
        error: error.message,
        pincode,
      });
      throw error;
    }
  }

  /**
   * Get all states with pincode counts
   */
  async getStatesWithPincodeCounts() {
    const cacheKey = this.getCacheKey("states_with_counts", {});

    // Try to get cached response
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      logger.info("Returning cached states with pincode counts");
      return cached;
    }

    try {
      logger.info("Getting states with pincode counts via external API");

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: "/api/v1/pincodes/states",
      });

      // Cache successful response for longer period (states don't change often)
      if (response.success) {
        await this.setCachedData(cacheKey, response, 604800); // 7 days
      }

      return response;
    } catch (error) {
      logger.error("Get states with pincode counts failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get cities with comprehensive filtering
   */
  async getCities(params) {
    const {
      stateIds,
      states,
      search,
      name,
      searchMode = "partial",
      isMetro,
      minPopulation,
      maxPopulation,
      latitude,
      longitude,
      radius,
      page = 1,
      limit = 20,
      sortBy = "name",
      sortOrder = "asc",
      includeAreaCount = false,
      includeState = false,
      includeCoordinates = false,
      includeMetadata = false,
      fields,
      forceRefresh = false,
    } = params;

    const cacheKey = this.getCacheKey("cities", params);

    // Try to get cached response (unless force refresh)
    if (!forceRefresh) {
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        logger.info("Returning cached cities data", { cacheKey });
        return cached;
      }
    }

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (stateIds) queryParams.append("stateIds", stateIds);
      if (states) queryParams.append("states", states);
      if (search) queryParams.append("search", search);
      if (name) queryParams.append("name", name);
      queryParams.append("searchMode", searchMode);
      if (isMetro !== undefined) queryParams.append("isMetro", isMetro);
      if (minPopulation) queryParams.append("minPopulation", minPopulation);
      if (maxPopulation) queryParams.append("maxPopulation", maxPopulation);
      if (latitude) queryParams.append("latitude", latitude);
      if (longitude) queryParams.append("longitude", longitude);
      if (radius) queryParams.append("radius", radius);
      queryParams.append("page", page);
      queryParams.append("limit", limit);
      queryParams.append("sortBy", sortBy);
      queryParams.append("sortOrder", sortOrder);
      queryParams.append("includeAreaCount", includeAreaCount);
      queryParams.append("includeState", includeState);
      queryParams.append("includeCoordinates", includeCoordinates);
      queryParams.append("includeMetadata", includeMetadata);
      if (fields) queryParams.append("fields", fields);
      queryParams.append("forceRefresh", forceRefresh);

      logger.info("Getting cities via external API", { params });

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/cities?${queryParams.toString()}`,
      });

      // Cache successful response
      if (response.success) {
        await this.setCachedData(cacheKey, response);
      }

      return response;
    } catch (error) {
      logger.error("Get cities failed", { error: error.message, params });
      throw error;
    }
  }

  /**
   * Get areas with comprehensive filtering
   */
  async getAreas(params) {
    const {
      cityIds,
      stateIds,
      states,
      search,
      name,
      searchMode = "partial",
      type,
      zone,
      minPincodeCount,
      maxPincodeCount,
      latitude,
      longitude,
      radius,
      page = 1,
      limit = 20,
      sortBy = "name",
      sortOrder = "asc",
      includePincodeCount = false,
      includeCity = false,
      includeState = false,
      includeCoordinates = false,
      includeMetadata = false,
      includePincodes = false,
      fields,
      forceRefresh = false,
    } = params;

    const cacheKey = this.getCacheKey("areas", params);

    // Try to get cached response (unless force refresh)
    if (!forceRefresh) {
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        logger.info("Returning cached areas data", { cacheKey });
        return cached;
      }
    }

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (cityIds) queryParams.append("cityIds", cityIds);
      if (stateIds) queryParams.append("stateIds", stateIds);
      if (states) queryParams.append("states", states);
      if (search) queryParams.append("search", search);
      if (name) queryParams.append("name", name);
      queryParams.append("searchMode", searchMode);
      if (type) queryParams.append("type", type);
      if (zone) queryParams.append("zone", zone);
      if (minPincodeCount)
        queryParams.append("minPincodeCount", minPincodeCount);
      if (maxPincodeCount)
        queryParams.append("maxPincodeCount", maxPincodeCount);
      if (latitude) queryParams.append("latitude", latitude);
      if (longitude) queryParams.append("longitude", longitude);
      if (radius) queryParams.append("radius", radius);
      queryParams.append("page", page);
      queryParams.append("limit", limit);
      queryParams.append("sortBy", sortBy);
      queryParams.append("sortOrder", sortOrder);
      queryParams.append("includePincodeCount", includePincodeCount);
      queryParams.append("includeCity", includeCity);
      queryParams.append("includeState", includeState);
      queryParams.append("includeCoordinates", includeCoordinates);
      queryParams.append("includeMetadata", includeMetadata);
      queryParams.append("includePincodes", includePincodes);
      if (fields) queryParams.append("fields", fields);
      queryParams.append("forceRefresh", forceRefresh);

      logger.info("Getting areas via external API", { params });

      const response = await this.externalClient.makeRequest({
        method: "GET",
        url: `/api/v1/areas?${queryParams.toString()}`,
      });

      // Cache successful response
      if (response.success) {
        await this.setCachedData(cacheKey, response);
      }

      return response;
    } catch (error) {
      logger.error("Get areas failed", { error: error.message, params });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      cachePrefix: this.cachePrefix,
      defaultCacheTTL: this.defaultCacheTTL,
      externalClientStatus: this.externalClient ? "connected" : "disconnected",
    };
  }
}

// Singleton instance
let geographicalServiceInstance = null;

/**
 * Get geographical service instance
 */
function getGeographicalService() {
  if (!geographicalServiceInstance) {
    geographicalServiceInstance = new GeographicalService();
  }
  return geographicalServiceInstance;
}

module.exports = {
  GeographicalService,
  getGeographicalService,
};
