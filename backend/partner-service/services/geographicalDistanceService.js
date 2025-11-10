const { prisma } = require("../config/database");
const { getRedisClient } = require("../config/redis");
const logger = require("../shared/lib/logger");

/**
 * Geographical Distance Calculation Service
 * Pure distance calculation utility without charge management
 * Uses Haversine formula for accurate straight-line distance measurements
 */
class GeographicalDistanceService {
  /**
   * Convert degrees to radians
   * @param {number} degrees - Degrees to convert
   * @returns {number} Radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1 - Latitude of first point
   * @param {number} lng1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lng2 - Longitude of second point
   * @returns {number} Distance in kilometers
   */
  calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers

    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert kilometers to miles
   * @param {number} km - Distance in kilometers
   * @returns {number} Distance in miles
   */
  kmToMiles(km) {
    return Math.round(km * 0.621371 * 100) / 100;
  }

  /**
   * Get cached distance if available
   * @param {string} key - Cache key
   * @returns {object|null} Cached distance data
   */
  async getCachedDistance(key) {
    try {
      const redis = getRedisClient();
      if (!redis) return null;

      const cached = await redis.get(key);
      if (cached) {
        logger.debug(`Cache hit for distance: ${key}`);
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error("Error reading from cache:", error);
      return null;
    }
  }

  /**
   * Set distance in cache
   * @param {string} key - Cache key
   * @param {object} data - Distance data to cache
   * @param {number} ttl - TTL in seconds (default 1 hour)
   */
  async setCachedDistance(key, data, ttl = 3600) {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      await redis.set(key, JSON.stringify(data), { EX: ttl });
      logger.debug(`Cached distance: ${key}`);
    } catch (error) {
      logger.error("Error setting cache:", error);
    }
  }

  /**
   * Calculate distance between two pincodes
   * @param {string} pincode1 - First pincode
   * @param {string} pincode2 - Second pincode
   * @returns {object} Distance calculation result
   */
  async calculatePincodeDistance(pincode1, pincode2) {
    try {
      // Check cache first
      const cacheKey = `distance:pincode:${pincode1}:${pincode2}`;
      const cached = await this.getCachedDistance(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      // Fetch pincode data with location information
      const [fromPincode, toPincode] = await Promise.all([
        prisma.pincode.findFirst({
          where: { code: pincode1 },
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
          },
        }),
        prisma.pincode.findFirst({
          where: { code: pincode2 },
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
          },
        }),
      ]);

      if (!fromPincode) {
        throw new Error(`Pincode ${pincode1} not found in database`);
      }
      if (!toPincode) {
        throw new Error(`Pincode ${pincode2} not found in database`);
      }

      if (!fromPincode.latitude || !fromPincode.longitude) {
        throw new Error(`Coordinates not available for pincode ${pincode1}`);
      }
      if (!toPincode.latitude || !toPincode.longitude) {
        throw new Error(`Coordinates not available for pincode ${pincode2}`);
      }

      const distance = this.calculateHaversineDistance(
        parseFloat(fromPincode.latitude),
        parseFloat(fromPincode.longitude),
        parseFloat(toPincode.latitude),
        parseFloat(toPincode.longitude),
      );

      const result = {
        fromPincode: pincode1,
        toPincode: pincode2,
        fromLocation: {
          latitude: parseFloat(fromPincode.latitude),
          longitude: parseFloat(fromPincode.longitude),
          area: fromPincode.area?.name,
          city: fromPincode.area?.city?.name,
          state: fromPincode.area?.city?.state?.name,
        },
        toLocation: {
          latitude: parseFloat(toPincode.latitude),
          longitude: parseFloat(toPincode.longitude),
          area: toPincode.area?.name,
          city: toPincode.area?.city?.name,
          state: toPincode.area?.city?.state?.name,
        },
        distance,
        distanceMiles: this.kmToMiles(distance),
        calculationMethod: "haversine",
        cached: false,
      };

      // Cache the result
      await this.setCachedDistance(cacheKey, result);

      return result;
    } catch (error) {
      logger.error("Error calculating pincode distance:", error);
      throw error;
    }
  }

  /**
   * Calculate distance between two cities
   * @param {string} cityId1 - First city ID
   * @param {string} cityId2 - Second city ID
   * @returns {object} Distance calculation result
   */
  async calculateCityDistance(cityId1, cityId2) {
    try {
      // Check cache first
      const cacheKey = `distance:city:${cityId1}:${cityId2}`;
      const cached = await this.getCachedDistance(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      // Get cities with representative pincode (first pincode with coordinates)
      const [fromCity, toCity] = await Promise.all([
        prisma.city.findUnique({
          where: { id: cityId1 },
          include: {
            state: true,
            areas: {
              take: 1,
              include: {
                pincodes: {
                  where: {
                    AND: [
                      { latitude: { not: null } },
                      { longitude: { not: null } },
                    ],
                  },
                  take: 1,
                },
              },
            },
          },
        }),
        prisma.city.findUnique({
          where: { id: cityId2 },
          include: {
            state: true,
            areas: {
              take: 1,
              include: {
                pincodes: {
                  where: {
                    AND: [
                      { latitude: { not: null } },
                      { longitude: { not: null } },
                    ],
                  },
                  take: 1,
                },
              },
            },
          },
        }),
      ]);

      if (!fromCity) {
        throw new Error(`City with ID ${cityId1} not found`);
      }
      if (!toCity) {
        throw new Error(`City with ID ${cityId2} not found`);
      }

      // Get representative coordinates
      const fromPincode = fromCity.areas[0]?.pincodes[0];
      const toPincode = toCity.areas[0]?.pincodes[0];

      if (!fromPincode || !fromPincode.latitude || !fromPincode.longitude) {
        throw new Error(`No coordinates available for city ${fromCity.name}`);
      }
      if (!toPincode || !toPincode.latitude || !toPincode.longitude) {
        throw new Error(`No coordinates available for city ${toCity.name}`);
      }

      const distance = this.calculateHaversineDistance(
        parseFloat(fromPincode.latitude),
        parseFloat(fromPincode.longitude),
        parseFloat(toPincode.latitude),
        parseFloat(toPincode.longitude),
      );

      const result = {
        fromCityId: cityId1,
        toCityId: cityId2,
        fromCity: {
          name: fromCity.name,
          state: fromCity.state?.name,
          latitude: parseFloat(fromPincode.latitude),
          longitude: parseFloat(fromPincode.longitude),
        },
        toCity: {
          name: toCity.name,
          state: toCity.state?.name,
          latitude: parseFloat(toPincode.latitude),
          longitude: parseFloat(toPincode.longitude),
        },
        distance,
        distanceMiles: this.kmToMiles(distance),
        calculationMethod: "haversine",
        cached: false,
      };

      // Cache the result
      await this.setCachedDistance(cacheKey, result);

      return result;
    } catch (error) {
      logger.error("Error calculating city distance:", error);
      throw error;
    }
  }

  /**
   * Calculate distance between two states (using capital cities or major city)
   * @param {string} stateId1 - First state ID
   * @param {string} stateId2 - Second state ID
   * @returns {object} Distance calculation result
   */
  async calculateStateDistance(stateId1, stateId2) {
    try {
      // Check cache first
      const cacheKey = `distance:state:${stateId1}:${stateId2}`;
      const cached = await this.getCachedDistance(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      // Get states with their largest city (by pincode count)
      const [fromState, toState] = await Promise.all([
        prisma.state.findUnique({
          where: { id: stateId1 },
          include: {
            cities: {
              take: 1,
              orderBy: {
                areas: {
                  _count: "desc",
                },
              },
              include: {
                areas: {
                  take: 1,
                  include: {
                    pincodes: {
                      where: {
                        AND: [
                          { latitude: { not: null } },
                          { longitude: { not: null } },
                        ],
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.state.findUnique({
          where: { id: stateId2 },
          include: {
            cities: {
              take: 1,
              orderBy: {
                areas: {
                  _count: "desc",
                },
              },
              include: {
                areas: {
                  take: 1,
                  include: {
                    pincodes: {
                      where: {
                        AND: [
                          { latitude: { not: null } },
                          { longitude: { not: null } },
                        ],
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

      if (!fromState) {
        throw new Error(`State with ID ${stateId1} not found`);
      }
      if (!toState) {
        throw new Error(`State with ID ${stateId2} not found`);
      }

      // Get representative coordinates
      const fromPincode = fromState.cities[0]?.areas[0]?.pincodes[0];
      const toPincode = toState.cities[0]?.areas[0]?.pincodes[0];

      if (!fromPincode || !fromPincode.latitude || !fromPincode.longitude) {
        throw new Error(`No coordinates available for state ${fromState.name}`);
      }
      if (!toPincode || !toPincode.latitude || !toPincode.longitude) {
        throw new Error(`No coordinates available for state ${toState.name}`);
      }

      const distance = this.calculateHaversineDistance(
        parseFloat(fromPincode.latitude),
        parseFloat(fromPincode.longitude),
        parseFloat(toPincode.latitude),
        parseFloat(toPincode.longitude),
      );

      const result = {
        fromStateId: stateId1,
        toStateId: stateId2,
        fromState: {
          name: fromState.name,
          code: fromState.code,
          representativeCity: fromState.cities[0]?.name,
          latitude: parseFloat(fromPincode.latitude),
          longitude: parseFloat(fromPincode.longitude),
        },
        toState: {
          name: toState.name,
          code: toState.code,
          representativeCity: toState.cities[0]?.name,
          latitude: parseFloat(toPincode.latitude),
          longitude: parseFloat(toPincode.longitude),
        },
        distance,
        distanceMiles: this.kmToMiles(distance),
        calculationMethod: "haversine",
        cached: false,
      };

      // Cache the result
      await this.setCachedDistance(cacheKey, result);

      return result;
    } catch (error) {
      logger.error("Error calculating state distance:", error);
      throw error;
    }
  }

  /**
   * Calculate distance between two areas
   * @param {string} areaId1 - First area ID
   * @param {string} areaId2 - Second area ID
   * @returns {object} Distance calculation result
   */
  async calculateAreaDistance(areaId1, areaId2) {
    try {
      // Check cache first
      const cacheKey = `distance:area:${areaId1}:${areaId2}`;
      const cached = await this.getCachedDistance(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      // Get areas with representative pincode
      const [fromArea, toArea] = await Promise.all([
        prisma.area.findUnique({
          where: { id: areaId1 },
          include: {
            city: {
              include: {
                state: true,
              },
            },
            pincodes: {
              where: {
                AND: [
                  { latitude: { not: null } },
                  { longitude: { not: null } },
                ],
              },
              take: 1,
            },
          },
        }),
        prisma.area.findUnique({
          where: { id: areaId2 },
          include: {
            city: {
              include: {
                state: true,
              },
            },
            pincodes: {
              where: {
                AND: [
                  { latitude: { not: null } },
                  { longitude: { not: null } },
                ],
              },
              take: 1,
            },
          },
        }),
      ]);

      if (!fromArea) {
        throw new Error(`Area with ID ${areaId1} not found`);
      }
      if (!toArea) {
        throw new Error(`Area with ID ${areaId2} not found`);
      }

      const fromPincode = fromArea.pincodes[0];
      const toPincode = toArea.pincodes[0];

      if (!fromPincode || !fromPincode.latitude || !fromPincode.longitude) {
        throw new Error(`No coordinates available for area ${fromArea.name}`);
      }
      if (!toPincode || !toPincode.latitude || !toPincode.longitude) {
        throw new Error(`No coordinates available for area ${toArea.name}`);
      }

      const distance = this.calculateHaversineDistance(
        parseFloat(fromPincode.latitude),
        parseFloat(fromPincode.longitude),
        parseFloat(toPincode.latitude),
        parseFloat(toPincode.longitude),
      );

      const result = {
        fromAreaId: areaId1,
        toAreaId: areaId2,
        fromArea: {
          name: fromArea.name,
          city: fromArea.city?.name,
          state: fromArea.city?.state?.name,
          latitude: parseFloat(fromPincode.latitude),
          longitude: parseFloat(fromPincode.longitude),
        },
        toArea: {
          name: toArea.name,
          city: toArea.city?.name,
          state: toArea.city?.state?.name,
          latitude: parseFloat(toPincode.latitude),
          longitude: parseFloat(toPincode.longitude),
        },
        distance,
        distanceMiles: this.kmToMiles(distance),
        calculationMethod: "haversine",
        cached: false,
      };

      // Cache the result
      await this.setCachedDistance(cacheKey, result);

      return result;
    } catch (error) {
      logger.error("Error calculating area distance:", error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates
   * @param {object} coords1 - First coordinate {latitude, longitude}
   * @param {object} coords2 - Second coordinate {latitude, longitude}
   * @returns {object} Distance calculation result
   */
  async calculateCoordinateDistance(coords1, coords2) {
    try {
      // Validate coordinates
      if (!coords1 || !coords1.latitude || !coords1.longitude) {
        throw new Error("Invalid first coordinate");
      }
      if (!coords2 || !coords2.latitude || !coords2.longitude) {
        throw new Error("Invalid second coordinate");
      }

      // Check cache first
      const cacheKey = `distance:coords:${coords1.latitude},${coords1.longitude}:${coords2.latitude},${coords2.longitude}`;
      const cached = await this.getCachedDistance(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }

      const distance = this.calculateHaversineDistance(
        parseFloat(coords1.latitude),
        parseFloat(coords1.longitude),
        parseFloat(coords2.latitude),
        parseFloat(coords2.longitude),
      );

      const result = {
        from: {
          latitude: parseFloat(coords1.latitude),
          longitude: parseFloat(coords1.longitude),
        },
        to: {
          latitude: parseFloat(coords2.latitude),
          longitude: parseFloat(coords2.longitude),
        },
        distance,
        distanceMiles: this.kmToMiles(distance),
        calculationMethod: "haversine",
        cached: false,
      };

      // Cache the result
      await this.setCachedDistance(cacheKey, result);

      return result;
    } catch (error) {
      logger.error("Error calculating coordinate distance:", error);
      throw error;
    }
  }

  /**
   * Calculate multiple distances in batch
   * @param {array} calculations - Array of calculation requests
   * @returns {array} Array of distance calculation results
   */
  async batchCalculateDistances(calculations) {
    try {
      const results = await Promise.all(
        calculations.map(async (calc) => {
          try {
            let result;

            switch (calc.type) {
              case "pincode":
                result = await this.calculatePincodeDistance(
                  calc.from,
                  calc.to,
                );
                break;
              case "city":
                result = await this.calculateCityDistance(calc.from, calc.to);
                break;
              case "state":
                result = await this.calculateStateDistance(calc.from, calc.to);
                break;
              case "area":
                result = await this.calculateAreaDistance(calc.from, calc.to);
                break;
              case "coordinates":
                result = await this.calculateCoordinateDistance(
                  calc.from,
                  calc.to,
                );
                break;
              default:
                throw new Error(`Invalid calculation type: ${calc.type}`);
            }

            return {
              success: true,
              type: calc.type,
              result,
            };
          } catch (error) {
            return {
              success: false,
              type: calc.type,
              error: error.message,
            };
          }
        }),
      );

      return results;
    } catch (error) {
      logger.error("Error in batch distance calculation:", error);
      throw error;
    }
  }

  /**
   * Clear distance cache (admin utility)
   * @param {string} pattern - Optional pattern to clear specific cache keys
   */
  async clearDistanceCache(pattern = "distance:*") {
    try {
      const redis = getRedisClient();
      if (!redis) {
        return { clearedKeys: 0, message: "Redis not available" };
      }

      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`Cleared ${keys.length} distance cache entries`);
      }
      return { clearedKeys: keys.length };
    } catch (error) {
      logger.error("Error clearing distance cache:", error);
      throw error;
    }
  }
}

module.exports = new GeographicalDistanceService();
