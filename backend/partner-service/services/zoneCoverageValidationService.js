/**
 * Zone Coverage Validation Service
 *
 * Purpose: Validate zone coverage, detect overlaps, check serviceability
 * Provides pincode serviceability checking, overlap detection, and coverage analysis
 *
 * Following auth-service patterns with Prisma ORM and Redis caching
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

class ZoneCoverageValidationService {
  constructor() {
    this.cachePrefix = "zone_coverage";
    this.cacheTTL = 3600; // 1 hour TTL for coverage validation
  }

  /**
   * Check if pincode is serviceable by partner
   * @param {string} partnerId - Partner ID
   * @param {string} pincode - Pincode to check
   * @returns {Promise<Object>} Serviceability result with zones and services
   */
  async validatePincodeServiceability(partnerId, pincode) {
    try {
      logger.info("Validating pincode serviceability", { partnerId, pincode });

      // Check cache first
      const cacheKey = `${this.cachePrefix}:serviceable:${partnerId}:${pincode}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached serviceability data", {
            partnerId,
            pincode,
          });
          return JSON.parse(cached);
        }
      }

      // Find pincode in database
      const pincodeRecord = await prisma.pincode.findUnique({
        where: { code: pincode },
        include: {
          state: { select: { id: true, name: true, code: true } },
          area: {
            select: {
              id: true,
              name: true,
              city: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!pincodeRecord) {
        return {
          success: false,
          serviceable: false,
          message: "Pincode not found in database",
          pincode,
          partnerId,
        };
      }

      // Find zones covering this pincode for the partner
      const zones = await prisma.zone.findMany({
        where: {
          partnerId,
          status: true,
          zonePincodes: {
            some: {
              pincodeId: pincodeRecord.id,
            },
          },
        },
      });

      const serviceable = zones.length > 0;

      const result = {
        success: true,
        serviceable,
        pincode,
        partnerId,
        pincodeDetails: {
          code: pincodeRecord.code,
          areaName: pincodeRecord.areaName,
          district: pincodeRecord.district,
          state: pincodeRecord.state.name,
          odaApplicable: pincodeRecord.odaApplicable,
          hillApplicable: pincodeRecord.hillApplicable,
        },
        coverage: {
          totalZones: zones.length,
          zones: zones.map((z) => ({
            id: z.id,
            name: z.name,
            services: [],
          })),
        },
        availableServices: [],
        metadata: {
          timestamp: new Date().toISOString(),
          source: "database",
        },
      };

      // Cache the result
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: this.cacheTTL,
        });
      }

      logger.info("Pincode serviceability validated", {
        partnerId,
        pincode,
        serviceable,
        zonesFound: zones.length,
      });

      return result;
    } catch (error) {
      logger.error("Error validating pincode serviceability", {
        partnerId,
        pincode,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get all zones covering a specific pincode
   * @param {string} partnerId - Partner ID
   * @param {string} pincode - Pincode to check
   * @returns {Promise<Object>} Zones covering the pincode
   */
  async getZonesByPincode(partnerId, pincode) {
    try {
      logger.info("Getting zones by pincode", { partnerId, pincode });

      // Check cache first
      const cacheKey = `${this.cachePrefix}:zones_by_pincode:${partnerId}:${pincode}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached zones by pincode", {
            partnerId,
            pincode,
          });
          return JSON.parse(cached);
        }
      }

      // Find pincode record
      const pincodeRecord = await prisma.pincode.findUnique({
        where: { code: pincode },
      });

      if (!pincodeRecord) {
        return {
          success: false,
          message: "Pincode not found",
          pincode,
          zones: [],
        };
      }

      // Find all zones for this partner containing this pincode
      const zones = await prisma.zone.findMany({
        where: {
          partnerId,
          status: true,
          zonePincodes: {
            some: {
              pincodeId: pincodeRecord.id,
            },
          },
        },
        include: {
          zonePincodes: {
            select: { pincodeId: true },
          },
        },
      });

      const result = {
        success: true,
        pincode,
        partnerId,
        totalZones: zones.length,
        zones: zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          description: zone.description,
          status: zone.status,
          services: [],
          totalPincodes: zone.zonePincodes.length,
          createdAt: zone.createdAt,
        })),
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      // Cache the result
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: this.cacheTTL,
        });
      }

      logger.info("Zones by pincode retrieved", {
        partnerId,
        pincode,
        totalZones: zones.length,
      });

      return result;
    } catch (error) {
      logger.error("Error getting zones by pincode", {
        partnerId,
        pincode,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Detect overlapping zones (same pincodes in multiple zones)
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Overlapping zones information
   */
  async detectZoneOverlaps(partnerId) {
    try {
      logger.info("Detecting zone overlaps", { partnerId });

      // Check cache first
      const cacheKey = `${this.cachePrefix}:overlaps:${partnerId}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached overlap data", { partnerId });
          return JSON.parse(cached);
        }
      }

      // Get all active zones for partner with their pincodes
      const zones = await prisma.zone.findMany({
        where: {
          partnerId,
          status: true,
        },
        include: {
          zonePincodes: {
            include: {
              pincode: {
                select: {
                  code: true,
                  areaName: true,
                },
              },
            },
          },
        },
      });

      // Build pincode to zones mapping
      const pincodeToZones = {};
      zones.forEach((zone) => {
        zone.zonePincodes.forEach((zp) => {
          const pincodeCode = zp.pincode.code;
          if (!pincodeToZones[pincodeCode]) {
            pincodeToZones[pincodeCode] = {
              pincode: pincodeCode,
              areaName: zp.pincode.areaName,
              zones: [],
            };
          }
          pincodeToZones[pincodeCode].zones.push({
            zoneId: zone.id,
            zoneName: zone.name,
          });
        });
      });

      // Find overlaps (pincodes in multiple zones)
      const overlaps = Object.values(pincodeToZones)
        .filter((p) => p.zones.length > 1)
        .sort((a, b) => b.zones.length - a.zones.length);

      const result = {
        success: true,
        partnerId,
        totalOverlaps: overlaps.length,
        overlaps,
        statistics: {
          totalZones: zones.length,
          totalPincodes: Object.keys(pincodeToZones).length,
          overlapPercentage: (
            (overlaps.length / Object.keys(pincodeToZones).length) *
            100
          ).toFixed(2),
          maxOverlapCount: overlaps.length > 0 ? overlaps[0].zones.length : 0,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      // Cache the result (shorter TTL as this is validation data)
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), { EX: 1800 }); // 30 minutes
      }

      logger.info("Zone overlaps detected", {
        partnerId,
        totalOverlaps: overlaps.length,
      });

      return result;
    } catch (error) {
      logger.error("Error detecting zone overlaps", {
        partnerId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Find coverage gaps (pincodes not covered by any zone)
   * @param {string} partnerId - Partner ID
   * @param {Object} options - Options for gap analysis
   * @returns {Promise<Object>} Coverage gaps information
   */
  async getCoverageGaps(partnerId, options = {}) {
    try {
      const { stateId = null, limit = 100 } = options;

      logger.info("Finding coverage gaps", { partnerId, options });

      // Check cache first
      const cacheKey = `${this.cachePrefix}:gaps:${partnerId}:${stateId || "all"}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached coverage gaps", { partnerId });
          return JSON.parse(cached);
        }
      }

      // Get all pincodes covered by partner's zones
      const coveredPincodes = await prisma.zonePincode.findMany({
        where: {
          zone: {
            partnerId,
            status: true,
          },
        },
        select: {
          pincodeId: true,
        },
      });

      const coveredPincodeIds = new Set(
        coveredPincodes.map((cp) => cp.pincodeId),
      );

      // Build where clause for uncovered pincodes
      const whereClause = {
        status: true,
        id: {
          notIn: Array.from(coveredPincodeIds),
        },
      };

      if (stateId) {
        whereClause.stateId = stateId;
      }

      // Find pincodes not in any zone
      const uncoveredPincodes = await prisma.pincode.findMany({
        where: whereClause,
        include: {
          state: {
            select: {
              name: true,
              code: true,
            },
          },
          area: {
            select: {
              name: true,
              city: {
                select: { name: true },
              },
            },
          },
        },
        take: limit,
        orderBy: {
          code: "asc",
        },
      });

      // Count total uncovered
      const totalUncovered = await prisma.pincode.count({
        where: whereClause,
      });

      // Count total pincodes
      const totalPincodes = await prisma.pincode.count({
        where: {
          status: true,
          ...(stateId && { stateId }),
        },
      });

      const result = {
        success: true,
        partnerId,
        totalUncovered,
        totalPincodes,
        coveragePercentage: (
          (1 - totalUncovered / totalPincodes) *
          100
        ).toFixed(2),
        gaps: uncoveredPincodes.map((p) => ({
          pincode: p.code,
          areaName: p.areaName,
          district: p.district,
          city: p.area?.city?.name,
          state: p.state.name,
          odaApplicable: p.odaApplicable,
          hillApplicable: p.hillApplicable,
        })),
        metadata: {
          limitApplied: limit,
          hasMore: totalUncovered > limit,
          timestamp: new Date().toISOString(),
          stateFilter: stateId,
        },
      };

      // Cache the result
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), { EX: 1800 }); // 30 minutes
      }

      logger.info("Coverage gaps identified", {
        partnerId,
        totalUncovered,
        coveragePercentage: result.coveragePercentage,
      });

      return result;
    } catch (error) {
      logger.error("Error finding coverage gaps", {
        partnerId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Validate complete zone coverage
   * @param {string} zoneId - Zone ID
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Zone coverage validation result
   */
  async validateZoneCoverage(zoneId, partnerId) {
    try {
      logger.info("Validating zone coverage", { zoneId, partnerId });

      // Check cache first
      const cacheKey = `${this.cachePrefix}:validate:${partnerId}:${zoneId}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached zone validation", {
            zoneId,
            partnerId,
          });
          return JSON.parse(cached);
        }
      }

      // Get zone with all geographical associations
      const zone = await prisma.zone.findFirst({
        where: {
          id: zoneId,
          partnerId,
        },
        include: {
          zoneStates: {
            include: {
              state: { select: { name: true } },
            },
          },
          zoneCities: {
            include: {
              city: { select: { name: true } },
            },
          },
          zoneAreas: {
            include: {
              area: { select: { name: true } },
            },
          },
          zonePincodes: {
            include: {
              pincode: { select: { code: true, areaName: true } },
            },
          },
        },
      });

      if (!zone) {
        return {
          success: false,
          message: "Zone not found",
          zoneId,
          partnerId,
        };
      }

      // Validation checks
      const validationIssues = [];

      // Check if zone has any geographical coverage
      if (
        zone.zonePincodes.length === 0 &&
        zone.zoneAreas.length === 0 &&
        zone.zoneCities.length === 0 &&
        zone.zoneStates.length === 0
      ) {
        validationIssues.push({
          type: "NO_COVERAGE",
          severity: "ERROR",
          message: "Zone has no geographical coverage defined",
        });
      }

      // Check for overlaps with other zones
      const overlaps = await this._checkZoneOverlaps(
        zoneId,
        partnerId,
        zone.zonePincodes,
      );
      if (overlaps.length > 0) {
        validationIssues.push({
          type: "OVERLAPPING_PINCODES",
          severity: "WARNING",
          message: `Zone has ${overlaps.length} pincodes overlapping with other zones`,
          details: overlaps.slice(0, 10), // First 10 overlaps
        });
      }

      const isValid =
        validationIssues.filter((i) => i.severity === "ERROR").length === 0;

      const result = {
        success: true,
        zoneId,
        partnerId,
        zoneName: zone.name,
        isValid,
        coverage: {
          states: zone.zoneStates.length,
          cities: zone.zoneCities.length,
          areas: zone.zoneAreas.length,
          pincodes: zone.zonePincodes.length,
        },
        services: [],
        validationIssues,
        summary: {
          totalIssues: validationIssues.length,
          errors: validationIssues.filter((i) => i.severity === "ERROR").length,
          warnings: validationIssues.filter((i) => i.severity === "WARNING")
            .length,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      // Cache the result
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), { EX: 900 }); // 15 minutes
      }

      logger.info("Zone coverage validated", {
        zoneId,
        partnerId,
        isValid,
        totalIssues: validationIssues.length,
      });

      return result;
    } catch (error) {
      logger.error("Error validating zone coverage", {
        zoneId,
        partnerId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Helper: Check for overlapping pincodes with other zones
   * @private
   */
  async _checkZoneOverlaps(zoneId, partnerId, zonePincodes) {
    if (zonePincodes.length === 0) return [];

    const pincodeIds = zonePincodes.map((zp) => zp.pincodeId);

    const overlappingZones = await prisma.zonePincode.findMany({
      where: {
        pincodeId: { in: pincodeIds },
        zoneId: { not: zoneId },
        zone: {
          partnerId,
          status: true,
        },
      },
      include: {
        zone: {
          select: { id: true, name: true },
        },
        pincode: {
          select: { code: true },
        },
      },
    });

    return overlappingZones.map((oz) => ({
      pincode: oz.pincode.code,
      overlappingZoneId: oz.zone.id,
      overlappingZoneName: oz.zone.name,
    }));
  }

  /**
   * Clear coverage validation cache
   * @param {string} partnerId - Partner ID
   */
  async clearValidationCache(partnerId) {
    try {
      const redis = getRedisClient();
      if (redis) {
        const pattern = `${this.cachePrefix}:*:${partnerId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        logger.info("Validation cache cleared", {
          partnerId,
          keysCleared: keys.length,
        });
      }
    } catch (error) {
      logger.error("Error clearing validation cache", {
        partnerId,
        error: error.message,
      });
    }
  }
}

module.exports = new ZoneCoverageValidationService();
