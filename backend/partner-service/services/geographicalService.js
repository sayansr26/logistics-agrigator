/**
 * Geographical Service
 *
 * Purpose: Manage geographical hierarchy (states, cities, areas, pincodes) with Redis caching
 * Provides CRUD operations and hierarchy traversal for geographical data from DATABASE
 *
 * Following auth-service patterns with Prisma ORM and Redis caching
 * Replaces external API calls with direct database operations
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

class GeographicalService {
  constructor() {
    this.cachePrefix = "geo";
    this.cacheTTL = 86400; // 24 hours for geographical data (relatively static)
  }

  /**
   * Get all active states
   * Uses Redis cache with 24h TTL
   * @returns {Promise<Array>} List of states
   */
  async getStates() {
    try {
      logger.info("Getting all states (active and inactive)");

      // Try cache first
      const cacheKey = `${this.cachePrefix}:states`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached states");
          return JSON.parse(cached);
        }
      }

      // Query database - show both active and inactive for management
      const states = await prisma.state.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Store in cache
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(states), {
          EX: this.cacheTTL,
        });
      }

      logger.info("States retrieved from database", { count: states.length });
      return states;
    } catch (error) {
      logger.error("Error getting states", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get cities by state ID (for zone management)
   * Uses Redis cache with 24h TTL
   * @param {string} stateId - State UUID
   * @returns {Promise<Array>} List of cities in the state
   */
  async getCitiesByState(stateId) {
    try {
      logger.info("Getting cities by state", { stateId });

      // Validate input
      if (!stateId) {
        throw new Error("State ID is required");
      }

      // Try cache first
      const cacheKey = `${this.cachePrefix}:cities:state:${stateId}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached cities", { stateId });
          return JSON.parse(cached);
        }
      }

      // Query database
      const cities = await prisma.city.findMany({
        where: {
          stateId: stateId,
          status: true,
        },
        include: {
          state: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Store in cache
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(cities), {
          EX: this.cacheTTL,
        });
      }

      logger.info("Cities retrieved", { stateId, count: cities.length });
      return cities;
    } catch (error) {
      logger.error("Error getting cities", {
        error: error.message,
        stateId,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get areas by city ID (for zone management)
   * Uses Redis cache with 24h TTL
   * @param {string} cityId - City UUID
   * @returns {Promise<Array>} List of areas in the city
   */
  async getAreasByCity(cityId) {
    try {
      logger.info("Getting areas by city", { cityId });

      // Validate input
      if (!cityId) {
        throw new Error("City ID is required");
      }

      // Try cache first
      const cacheKey = `${this.cachePrefix}:areas:city:${cityId}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached areas", { cityId });
          return JSON.parse(cached);
        }
      }

      // Query database
      const areas = await prisma.area.findMany({
        where: {
          cityId: cityId,
          status: true,
        },
        include: {
          city: {
            select: {
              id: true,
              name: true,
              code: true,
              state: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Store in cache
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(areas), { EX: this.cacheTTL });
      }

      logger.info("Areas retrieved", { cityId, count: areas.length });
      return areas;
    } catch (error) {
      logger.error("Error getting areas", {
        error: error.message,
        cityId,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get pincodes by area ID (for zone management)
   * Uses Redis cache with 24h TTL
   * @param {string} areaId - Area UUID
   * @returns {Promise<Array>} List of pincodes in the area
   */
  async getPincodesByArea(params) {
    try {
      const { areaId, cityId, stateId, limit = 100, page = 1 } = params;
      logger.info("Getting pincodes by area/city/state", {
        areaId,
        cityId,
        stateId,
        limit,
        page,
      });

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Build cache key based on available parameters
      let cacheKey = `${this.cachePrefix}:pincodes`;
      if (areaId) cacheKey += `:area:${areaId}`;
      if (cityId) cacheKey += `:city:${cityId}`;
      if (stateId) cacheKey += `:state:${stateId}`;
      if (!areaId && !cityId && !stateId) cacheKey += `:all`;
      cacheKey += `:page:${page}:limit:${limit}`;

      // Try cache first
      const redis = getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached pincodes", {
            areaId,
            cityId,
            stateId,
          });
          const cachedData = JSON.parse(cached);
          return {
            success: true,
            data: cachedData.data,
            total: cachedData.total,
            activeCount: cachedData.activeCount,
            inactiveCount: cachedData.inactiveCount,
            cached: true,
          };
        }
      }

      // Build where clause for filtering - show both active and inactive for management
      const where = {};

      if (areaId) {
        where.areaId = areaId;
      } else if (cityId) {
        // Get pincodes by city through area relationship
        where.area = {
          cityId: cityId,
        };
      } else if (stateId) {
        // Get pincodes by state
        where.stateId = stateId;
      }

      // Get total count
      const total = await prisma.pincode.count({ where });

      // Get active and inactive counts
      const activeCount = await prisma.pincode.count({
        where: { ...where, status: true },
      });
      const inactiveCount = total - activeCount;

      // Query database
      const pincodes = await prisma.pincode.findMany({
        where,
        include: {
          area: {
            select: {
              id: true,
              name: true,
              code: true,
              city: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  state: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
          state: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { code: "asc" },
      });

      // Store in cache (including total and counts for pagination)
      if (redis) {
        await redis.set(
          cacheKey,
          JSON.stringify({ data: pincodes, total, activeCount, inactiveCount }),
          { EX: this.cacheTTL },
        );
      }

      logger.info("Pincodes retrieved", {
        areaId,
        cityId,
        stateId,
        count: pincodes.length,
        total,
        activeCount,
        inactiveCount,
      });

      // Return in controller-expected format
      return {
        success: true,
        data: pincodes,
        total,
        activeCount,
        inactiveCount,
        cached: false,
      };
    } catch (error) {
      logger.error("Error getting pincodes", {
        error: error.message,
        params,
        stack: error.stack,
      });
      return {
        success: false,
        data: [],
        error: error.message,
        cached: false,
      };
    }
  }

  /**
   * Get complete pincode details with full hierarchy
   * Uses Redis cache with 24h TTL
   * @param {string} code - Pincode (6 digits)
   * @returns {Promise<Object>} Complete pincode details with state, city, area
   */
  async getPincodeDetails(code) {
    try {
      logger.info("Getting pincode details", { code });

      // Validate input
      if (!code) {
        throw new Error("Pincode is required");
      }

      // Try cache first
      const cacheKey = `${this.cachePrefix}:pincode:${code}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached pincode details", { code });
          return JSON.parse(cached);
        }
      }

      // Query database with complete hierarchy
      const pincode = await prisma.pincode.findUnique({
        where: { code: code },
        include: {
          area: {
            include: {
              city: {
                include: {
                  state: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
          state: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
            },
          },
        },
      });

      const result = {
        success: pincode !== null,
        data: pincode,
      };

      // Store in cache
      if (redis && pincode) {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: this.cacheTTL,
        });
      }

      logger.info("Pincode details retrieved", { code, found: !!pincode });
      return result;
    } catch (error) {
      logger.error("Error getting pincode details", {
        error: error.message,
        code,
        stack: error.stack,
      });
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }

  /**
   * Get geographical hierarchy for pincode
   * Returns state -> city -> area -> pincode hierarchy
   * @param {string} code - Pincode (6 digits)
   * @returns {Promise<Object>} Hierarchical geographical data
   */
  async getPincodeHierarchy(code) {
    try {
      logger.info("Getting pincode hierarchy", { code });

      const result = await this.getPincodeDetails(code);

      if (!result.success || !result.data) {
        return {
          success: false,
          data: null,
          message: `Pincode ${code} not found`,
        };
      }

      const pincode = result.data;

      // Build hierarchy
      const hierarchy = {
        pincode: {
          code: pincode.code,
          areaName: pincode.areaName,
          district: pincode.district,
          odaApplicable: pincode.odaApplicable,
          hillApplicable: pincode.hillApplicable,
          latitude: pincode.latitude,
          longitude: pincode.longitude,
        },
        area: pincode.area
          ? {
              id: pincode.area.id,
              name: pincode.area.name,
              code: pincode.area.code,
            }
          : null,
        city: pincode.area?.city
          ? {
              id: pincode.area.city.id,
              name: pincode.area.city.name,
              code: pincode.area.city.code,
            }
          : null,
        state: pincode.state
          ? {
              id: pincode.state.id,
              name: pincode.state.name,
              code: pincode.state.code,
            }
          : null,
      };

      return {
        success: true,
        data: hierarchy,
      };
    } catch (error) {
      logger.error("Error getting pincode hierarchy", {
        error: error.message,
        code,
        stack: error.stack,
      });
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }

  /**
   * Search pincodes with comprehensive filtering
   * Maintains compatibility with existing controller
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchPincodes(params) {
    try {
      const {
        pincode,
        city,
        state,
        district,
        page = 1,
        limit = 20,
        sortBy = "code",
      } = params;

      logger.info("Searching pincodes", { params });

      // Build where clause
      const where = { status: true };
      const orConditions = [];

      if (pincode) {
        orConditions.push({ code: { contains: pincode } });
      }
      if (city) {
        orConditions.push({
          area: {
            city: {
              name: { contains: city, mode: "insensitive" },
            },
          },
        });
      }
      if (state) {
        orConditions.push({
          state: {
            name: { contains: state, mode: "insensitive" },
          },
        });
      }
      if (district) {
        orConditions.push({
          district: { contains: district, mode: "insensitive" },
        });
      }

      if (orConditions.length > 0) {
        where.OR = orConditions;
      }

      // Get total count
      const total = await prisma.pincode.count({ where });

      // Get pincodes
      const pincodes = await prisma.pincode.findMany({
        where,
        include: {
          area: {
            include: {
              city: {
                include: {
                  state: true,
                },
              },
            },
          },
          state: true,
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { [sortBy]: "asc" },
      });

      logger.info("Pincode search completed", {
        count: pincodes.length,
        total,
      });

      return {
        success: true,
        data: pincodes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Pincode search failed", {
        error: error.message,
        params,
        stack: error.stack,
      });
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }

  /**
   * Get all states with pincode counts (for controller compatibility)
   * @returns {Promise<Object>} States with counts
   */
  async getStatesWithPincodeCounts() {
    try {
      logger.info("Getting states with pincode counts");

      const cacheKey = `${this.cachePrefix}:states_with_counts`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached states with counts");
          return JSON.parse(cached);
        }
      }

      // Get all states with pincode counts
      const states = await prisma.state.findMany({
        where: { status: true },
        include: {
          _count: {
            select: { pincodes: true },
          },
        },
        orderBy: { name: "asc" },
      });

      const statesWithCounts = states.map((state) => ({
        id: state.id,
        name: state.name,
        code: state.code,
        pincodeCount: state._count.pincodes,
      }));

      const result = {
        success: true,
        data: statesWithCounts,
      };

      // Cache for 24 hours
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: this.cacheTTL,
        });
      }

      logger.info("States with pincode counts retrieved", {
        count: states.length,
      });
      return result;
    } catch (error) {
      logger.error("Error getting states with pincode counts", {
        error: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }

  /**
   * Get cities with comprehensive filtering (for controller compatibility)
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object>} Cities data
   */
  async getCities(params) {
    try {
      const { stateIds, page = 1, limit = 50 } = params;
      logger.info("Getting cities", { params });

      // Build where clause - show both active and inactive for management
      const where = {};
      if (stateIds) {
        const stateIdArray = stateIds.split(",").map((id) => id.trim());
        where.stateId = { in: stateIdArray };
      }

      // Get total count
      const total = await prisma.city.count({ where });

      // Get active and inactive counts
      const activeCount = await prisma.city.count({
        where: { ...where, status: true },
      });
      const inactiveCount = total - activeCount;

      // Get cities
      const cities = await prisma.city.findMany({
        where,
        include: {
          state: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { name: "asc" },
      });

      logger.info("Cities retrieved", {
        count: cities.length,
        total,
        activeCount,
        inactiveCount,
      });

      return {
        success: true,
        data: cities,
        total,
        activeCount,
        inactiveCount,
      };
    } catch (error) {
      logger.error("Error getting cities", {
        error: error.message,
        params,
        stack: error.stack,
      });
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }

  /**
   * Get areas with comprehensive filtering (for controller compatibility)
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object>} Areas data
   */
  async getAreas(params) {
    try {
      const { cityIds, stateIds, page = 1, limit = 50 } = params;
      logger.info("Getting areas", { params });

      // Build where clause - show both active and inactive for management
      const where = {};
      if (cityIds) {
        const cityIdArray = cityIds.split(",").map((id) => id.trim());
        where.cityId = { in: cityIdArray };
      }
      if (stateIds) {
        const stateIdArray = stateIds.split(",").map((id) => id.trim());
        where.city = {
          stateId: { in: stateIdArray },
        };
      }

      // Get total count
      const total = await prisma.area.count({ where });

      // Get active and inactive counts
      const activeCount = await prisma.area.count({
        where: { ...where, status: true },
      });
      const inactiveCount = total - activeCount;

      // Get areas
      const areas = await prisma.area.findMany({
        where,
        include: {
          city: {
            include: {
              state: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { name: "asc" },
      });

      logger.info("Areas retrieved", {
        count: areas.length,
        total,
        activeCount,
        inactiveCount,
      });

      return {
        success: true,
        data: areas,
        total,
        activeCount,
        inactiveCount,
      };
    } catch (error) {
      logger.error("Error getting areas", {
        error: error.message,
        params,
        stack: error.stack,
      });
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }

  /**
   * Batch get cities by multiple state IDs
   * Efficient batch operation for multiple states
   * @param {Array<string>} stateIds - Array of state UUIDs
   * @returns {Promise<Object>} Cities grouped by state ID
   */
  async getCitiesByStates(stateIds) {
    try {
      logger.info("Batch getting cities by states", {
        stateCount: stateIds?.length,
      });

      // Validate input
      if (!stateIds || !Array.isArray(stateIds) || stateIds.length === 0) {
        throw new Error("State IDs array is required");
      }

      // Query database for all cities in these states
      const cities = await prisma.city.findMany({
        where: {
          stateId: { in: stateIds },
          status: true,
        },
        include: {
          state: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [{ stateId: "asc" }, { name: "asc" }],
      });

      // Group cities by state ID
      const citiesByState = {};
      stateIds.forEach((stateId) => {
        citiesByState[stateId] = [];
      });

      cities.forEach((city) => {
        if (citiesByState[city.stateId]) {
          citiesByState[city.stateId].push(city);
        }
      });

      const result = {
        success: true,
        data: citiesByState,
        summary: {
          totalStates: stateIds.length,
          totalCities: cities.length,
          citiesPerState: Object.entries(citiesByState).reduce(
            (acc, [stateId, cities]) => {
              acc[stateId] = cities.length;
              return acc;
            },
            {},
          ),
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      logger.info("Batch cities retrieved", {
        stateCount: stateIds.length,
        totalCities: cities.length,
      });

      return result;
    } catch (error) {
      logger.error("Error batch getting cities", {
        error: error.message,
        stateCount: stateIds?.length,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Batch get areas by multiple city IDs
   * Efficient batch operation for multiple cities
   * @param {Array<string>} cityIds - Array of city UUIDs
   * @returns {Promise<Object>} Areas grouped by city ID
   */
  async getAreasByCities(cityIds) {
    try {
      logger.info("Batch getting areas by cities", {
        cityCount: cityIds?.length,
      });

      // Validate input
      if (!cityIds || !Array.isArray(cityIds) || cityIds.length === 0) {
        throw new Error("City IDs array is required");
      }

      // Query database for all areas in these cities
      const areas = await prisma.area.findMany({
        where: {
          cityId: { in: cityIds },
          status: true,
        },
        include: {
          city: {
            select: {
              id: true,
              name: true,
              code: true,
              state: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: [{ cityId: "asc" }, { name: "asc" }],
      });

      // Group areas by city ID
      const areasByCity = {};
      cityIds.forEach((cityId) => {
        areasByCity[cityId] = [];
      });

      areas.forEach((area) => {
        if (areasByCity[area.cityId]) {
          areasByCity[area.cityId].push(area);
        }
      });

      const result = {
        success: true,
        data: areasByCity,
        summary: {
          totalCities: cityIds.length,
          totalAreas: areas.length,
          areasPerCity: Object.entries(areasByCity).reduce(
            (acc, [cityId, areas]) => {
              acc[cityId] = areas.length;
              return acc;
            },
            {},
          ),
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      logger.info("Batch areas retrieved", {
        cityCount: cityIds.length,
        totalAreas: areas.length,
      });

      return result;
    } catch (error) {
      logger.error("Error batch getting areas", {
        error: error.message,
        cityCount: cityIds?.length,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Batch get pincodes by multiple area IDs
   * Efficient batch operation for multiple areas
   * @param {Array<string>} areaIds - Array of area UUIDs
   * @returns {Promise<Object>} Pincodes grouped by area ID
   */
  async getPincodesByAreas(areaIds) {
    try {
      logger.info("Batch getting pincodes by areas", {
        areaCount: areaIds?.length,
      });

      // Validate input
      if (!areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
        throw new Error("Area IDs array is required");
      }

      // Query database for all pincodes in these areas
      const pincodes = await prisma.pincode.findMany({
        where: {
          areaId: { in: areaIds },
          status: true,
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              code: true,
              city: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  state: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
          state: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [{ areaId: "asc" }, { code: "asc" }],
      });

      // Group pincodes by area ID
      const pincodesByArea = {};
      areaIds.forEach((areaId) => {
        pincodesByArea[areaId] = [];
      });

      pincodes.forEach((pincode) => {
        if (pincode.areaId && pincodesByArea[pincode.areaId]) {
          pincodesByArea[pincode.areaId].push(pincode);
        }
      });

      const result = {
        success: true,
        data: pincodesByArea,
        summary: {
          totalAreas: areaIds.length,
          totalPincodes: pincodes.length,
          pincodesPerArea: Object.entries(pincodesByArea).reduce(
            (acc, [areaId, pincodes]) => {
              acc[areaId] = pincodes.length;
              return acc;
            },
            {},
          ),
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      logger.info("Batch pincodes retrieved", {
        areaCount: areaIds.length,
        totalPincodes: pincodes.length,
      });

      return result;
    } catch (error) {
      logger.error("Error batch getting pincodes", {
        error: error.message,
        areaCount: areaIds?.length,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Clear geographical cache
   * Invalidates all cached geographical data
   * @param {Object} options - { scope: 'all' | 'states' | 'cities' | 'areas' | 'pincodes', id: specific ID }
   * @returns {Promise<Object>} Cache clear result
   */
  async clearCache(options = {}) {
    try {
      const { scope = "all", id = null } = options;
      logger.info("Clearing geographical cache", { scope, id });

      const redis = getRedisClient();
      if (!redis) {
        logger.warn("Redis not available, cache clear skipped");
        return {
          success: false,
          message: "Redis not available",
        };
      }

      let pattern;
      if (scope === "all") {
        pattern = `${this.cachePrefix}:*`;
      } else if (id) {
        // Clear specific item
        if (scope === "states") {
          pattern = `${this.cachePrefix}:cities:state:${id}`;
        } else if (scope === "cities") {
          pattern = `${this.cachePrefix}:areas:city:${id}`;
        } else if (scope === "areas") {
          pattern = `${this.cachePrefix}:pincodes:area:${id}`;
        } else if (scope === "pincodes") {
          pattern = `${this.cachePrefix}:pincode:${id}`;
        } else {
          pattern = `${this.cachePrefix}:*`;
        }
      } else {
        // Clear by scope
        pattern = `${this.cachePrefix}:${scope}:*`;
      }

      const keys = await redis.keys(pattern);
      let deletedCount = 0;

      if (keys.length > 0) {
        deletedCount = await redis.del(...keys);
      }

      logger.info("Geographical cache cleared", {
        scope,
        id,
        pattern,
        deletedCount,
      });

      return {
        success: true,
        deletedCount,
        pattern,
        message: `Cleared ${deletedCount} cache keys`,
      };
    } catch (error) {
      logger.error("Error clearing geographical cache", {
        error: error.message,
        options,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get geographical statistics
   * Provides overview of geographical data in the system
   * @returns {Promise<Object>} Statistical overview
   */
  async getStatistics() {
    try {
      logger.info("Getting geographical statistics");

      // Check cache first
      const cacheKey = `${this.cachePrefix}:statistics`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached statistics");
          return JSON.parse(cached);
        }
      }

      // Get counts from database
      const [
        totalStates,
        activeStates,
        totalCities,
        activeCities,
        totalAreas,
        activeAreas,
        totalPincodes,
        activePincodes,
        odaPincodes,
        hillPincodes,
      ] = await Promise.all([
        prisma.state.count(),
        prisma.state.count({ where: { status: true } }),
        prisma.city.count(),
        prisma.city.count({ where: { status: true } }),
        prisma.area.count(),
        prisma.area.count({ where: { status: true } }),
        prisma.pincode.count(),
        prisma.pincode.count({ where: { status: true } }),
        prisma.pincode.count({ where: { odaApplicable: true, status: true } }),
        prisma.pincode.count({ where: { hillApplicable: true, status: true } }),
      ]);

      const statistics = {
        success: true,
        data: {
          states: {
            total: totalStates,
            active: activeStates,
            inactive: totalStates - activeStates,
          },
          cities: {
            total: totalCities,
            active: activeCities,
            inactive: totalCities - activeCities,
          },
          areas: {
            total: totalAreas,
            active: activeAreas,
            inactive: totalAreas - activeAreas,
          },
          pincodes: {
            total: totalPincodes,
            active: activePincodes,
            inactive: totalPincodes - activePincodes,
            oda: odaPincodes,
            hill: hillPincodes,
            odaPercentage:
              activePincodes > 0
                ? ((odaPincodes / activePincodes) * 100).toFixed(2)
                : "0",
            hillPercentage:
              activePincodes > 0
                ? ((hillPincodes / activePincodes) * 100).toFixed(2)
                : "0",
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: "database",
        },
      };

      // Cache statistics for 1 hour
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(statistics), { EX: 3600 });
      }

      logger.info("Geographical statistics retrieved", {
        totalStates,
        totalCities,
        totalAreas,
        totalPincodes,
      });

      return statistics;
    } catch (error) {
      logger.error("Error getting geographical statistics", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get service statistics (for controller compatibility)
   * @returns {Object} Service stats
   */
  getStats() {
    return {
      service: "GeographicalService",
      version: "2.0",
      source: "database",
      cachePrefix: this.cachePrefix,
      cacheTTL: this.cacheTTL,
      prismaConnected: !!prisma,
    };
  }

  /**
   * Toggle state status (active/inactive)
   * @param {string} id - State UUID
   * @returns {Promise<Object>} Updated state
   */
  async toggleStateStatus(id) {
    try {
      logger.info("Toggling state status", { id });

      // Get current state
      const state = await prisma.state.findUnique({ where: { id } });

      if (!state) {
        return { success: false, error: "State not found" };
      }

      // Toggle status
      const updatedState = await prisma.state.update({
        where: { id },
        data: { status: !state.status },
      });

      // Clear cache - delete all state-related cache keys
      const redis = getRedisClient();
      if (redis) {
        const keys = await redis.keys(`${this.cachePrefix}:states*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.info("State status toggled", {
        id,
        oldStatus: state.status,
        newStatus: updatedState.status,
      });

      return {
        success: true,
        data: updatedState,
      };
    } catch (error) {
      logger.error("Error toggling state status", { id, error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Toggle city status (active/inactive)
   * @param {string} id - City UUID
   * @returns {Promise<Object>} Updated city
   */
  async toggleCityStatus(id) {
    try {
      logger.info("Toggling city status", { id });

      const city = await prisma.city.findUnique({
        where: { id },
        include: { state: true },
      });

      if (!city) {
        return { success: false, error: "City not found" };
      }

      const updatedCity = await prisma.city.update({
        where: { id },
        data: { status: !city.status },
        include: { state: true },
      });

      // Clear cache - delete all city-related cache keys
      const redis = getRedisClient();
      if (redis) {
        const keys = await redis.keys(`${this.cachePrefix}:cities*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.info("City status toggled", {
        id,
        oldStatus: city.status,
        newStatus: updatedCity.status,
      });

      return {
        success: true,
        data: updatedCity,
      };
    } catch (error) {
      logger.error("Error toggling city status", { id, error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Toggle area status (active/inactive)
   * @param {string} id - Area UUID
   * @returns {Promise<Object>} Updated area
   */
  async toggleAreaStatus(id) {
    try {
      logger.info("Toggling area status", { id });

      const area = await prisma.area.findUnique({
        where: { id },
        include: {
          city: {
            include: { state: true },
          },
        },
      });

      if (!area) {
        return { success: false, error: "Area not found" };
      }

      const updatedArea = await prisma.area.update({
        where: { id },
        data: { status: !area.status },
        include: {
          city: {
            include: { state: true },
          },
        },
      });

      // Clear cache - delete all area-related cache keys
      const redis = getRedisClient();
      if (redis) {
        const keys = await redis.keys(`${this.cachePrefix}:areas*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.info("Area status toggled", {
        id,
        oldStatus: area.status,
        newStatus: updatedArea.status,
      });

      return {
        success: true,
        data: updatedArea,
      };
    } catch (error) {
      logger.error("Error toggling area status", { id, error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Toggle pincode status (active/inactive)
   * @param {string} id - Pincode UUID
   * @returns {Promise<Object>} Updated pincode
   */
  async togglePincodeStatus(id) {
    try {
      logger.info("Toggling pincode status", { id });

      const pincode = await prisma.pincode.findUnique({
        where: { id },
        include: {
          area: {
            include: {
              city: {
                include: { state: true },
              },
            },
          },
          state: true,
        },
      });

      if (!pincode) {
        return { success: false, error: "Pincode not found" };
      }

      const updatedPincode = await prisma.pincode.update({
        where: { id },
        data: { status: !pincode.status },
        include: {
          area: {
            include: {
              city: {
                include: { state: true },
              },
            },
          },
          state: true,
        },
      });

      // Clear cache - delete all pincode-related cache keys
      const redis = getRedisClient();
      if (redis) {
        const keys = await redis.keys(`${this.cachePrefix}:pincodes*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      logger.info("Pincode status toggled", {
        id,
        oldStatus: pincode.status,
        newStatus: updatedPincode.status,
      });

      return {
        success: true,
        data: updatedPincode,
      };
    } catch (error) {
      logger.error("Error toggling pincode status", {
        id,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Singleton instance
let geographicalServiceInstance = null;

/**
 * Get geographical service instance (for controller compatibility)
 * @returns {GeographicalService} Singleton instance
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
