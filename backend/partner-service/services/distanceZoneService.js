/**
 * Distance Zone Service
 *
 * Purpose: Manage DISTANCE-type zones with distance-based milestones
 * Handles multi-partner zone creation, milestone validation, and distance matching
 *
 * Following auth-service patterns with Prisma ORM and Redis caching
 *
 * Features:
 * - Create distance zones for multiple partners in one request
 * - Milestone validation (adjacent, no gaps, no overlaps)
 * - Distance calculation using GeographicalDistanceService
 * - Zone matching based on shipment distance
 * - Redis caching for match results
 * - Comprehensive audit logging
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const geographicalDistanceService = require("./geographicalDistanceService");

// Import zoneService for cache invalidation (avoid circular dependency by requiring at runtime)
let _zoneService = null;
const getZoneService = () => {
  if (!_zoneService) {
    _zoneService = require("./zoneService");
  }
  return _zoneService;
};

class DistanceZoneService {
  constructor() {
    this.cachePrefix = "distance_zones";
    this.cacheTTL = 3600; // 1 hour for distance zone data
    this.matchCacheTTL = 300; // 5 minutes for match results
  }

  // ==========================================
  // DISTANCE ZONE CRUD OPERATIONS
  // ==========================================

  /**
   * Create distance zones for multiple partners
   * Creates identical zones with milestones for each partner
   * @param {Object} zoneData - Zone creation data
   * @param {string[]} zoneData.partnerIds - Array of partner IDs (CUID format)
   * @param {string} zoneData.name - Zone name (unique per partner)
   * @param {string} [zoneData.description] - Zone description
   * @param {boolean} [zoneData.status=true] - Zone status
   * @param {Object[]} zoneData.milestones - Distance milestones
   * @param {number} zoneData.milestones[].minKm - Minimum distance in km (inclusive)
   * @param {number} zoneData.milestones[].maxKm - Maximum distance in km (inclusive)
   * @param {Object} reqContext - Request context for audit logging
   * @param {Object} [reqContext.user] - Authenticated user
   * @param {string} [reqContext.ip] - Request IP address
   * @param {string} [reqContext.userAgent] - Request user agent
   * @returns {Promise<Object>} Created zones with milestones
   * @throws {Error} If validation fails or partners don't exist
   */
  async createDistanceZone(zoneData, reqContext = {}) {
    try {
      const {
        partnerIds,
        name,
        description,
        status = true,
        milestones,
      } = zoneData;

      logger.info("Creating distance zones", {
        partnerCount: partnerIds?.length,
        zoneName: name,
        milestonesCount: milestones?.length,
        userId: reqContext.user?.id,
      });

      // Validate required fields
      if (
        !partnerIds ||
        !Array.isArray(partnerIds) ||
        partnerIds.length === 0
      ) {
        throw new Error("At least one partner ID is required");
      }

      if (!name || typeof name !== "string" || name.trim() === "") {
        throw new Error("Zone name is required and must be a non-empty string");
      }

      if (
        !milestones ||
        !Array.isArray(milestones) ||
        milestones.length === 0
      ) {
        throw new Error(
          "At least one milestone is required for distance zones",
        );
      }

      // Validate milestones
      this._validateMilestones(milestones);

      // Verify all partners exist
      const partners = await prisma.partner.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, name: true },
      });

      if (partners.length !== partnerIds.length) {
        const foundIds = partners.map((p) => p.id);
        const missingIds = partnerIds.filter((id) => !foundIds.includes(id));
        throw new Error(`Partners not found: ${missingIds.join(", ")}`);
      }

      // Use transaction to create zones for all partners
      const result = await prisma.$transaction(
        async (tx) => {
          const createdZones = [];

          for (const partnerId of partnerIds) {
            // Check for duplicate zone name
            const existing = await tx.zone.findFirst({
              where: {
                partnerId,
                name: name.trim(),
              },
            });

            if (existing) {
              throw new Error(
                `Zone '${name}' already exists for partner ID '${partnerId}'`,
              );
            }

            // Create the zone
            const zone = await tx.zone.create({
              data: {
                partnerId,
                name: name.trim(),
                description: description?.trim() || null,
                zoneType: "DISTANCE",
                status: Boolean(status),
              },
            });

            // Create milestones
            const milestonesData = milestones.map((m, index) => ({
              zoneId: zone.id,
              minKm: m.minKm,
              maxKm: m.maxKm,
              suffix: this._generateSuffix(index + 1),
              sortOrder: index + 1,
            }));

            await tx.zoneMilestone.createMany({
              data: milestonesData,
            });

            // Fetch created zone with milestones
            const zoneWithMilestones = await tx.zone.findUnique({
              where: { id: zone.id },
              include: {
                milestones: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            });

            createdZones.push(zoneWithMilestones);
          }

          return createdZones;
        },
        {
          maxWait: 5000,
          timeout: 30000,
        },
      );

      // Audit logging
      await this._createAuditLog(
        "DISTANCE_ZONE_CREATED",
        "ZONE",
        result.map((z) => z.id).join(","),
        reqContext,
        {
          partnerIds,
          zoneName: name,
          milestonesCount: milestones.length,
        },
        {
          zonesCreated: result.length,
          zoneIds: result.map((z) => z.id),
        },
      );

      // Invalidate cache for all affected partners
      for (const partnerId of partnerIds) {
        await this._invalidateCache(partnerId);
      }

      logger.info("Distance zones created successfully", {
        zonesCreated: result.length,
        zoneIds: result.map((z) => z.id),
        userId: reqContext.user?.id,
      });

      return {
        zones: result,
        summary: {
          zonesCreated: result.length,
          partnersAffected: partnerIds.length,
          milestonesPerZone: milestones.length,
        },
      };
    } catch (error) {
      logger.error("Error creating distance zones", {
        error: error.message,
        stack: error.stack,
        partnerIds: zoneData?.partnerIds,
        zoneName: zoneData?.name,
      });
      throw error;
    }
  }

  /**
   * Get milestones for a distance zone
   * @param {string} zoneId - Zone UUID
   * @param {string} [partnerId] - Optional partner ID for access validation
   * @returns {Promise<Object>} Zone milestones
   * @throws {Error} If zone not found or not a DISTANCE zone
   */
  async getMilestones(zoneId, partnerId = null) {
    try {
      logger.debug("Getting zone milestones", { zoneId, partnerId });

      // Build where clause
      const where = { id: zoneId, zoneType: "DISTANCE" };
      if (partnerId) {
        where.partnerId = partnerId;
      }

      // Try cache first
      const cacheKey = `${this.cachePrefix}:milestones:${zoneId}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached milestones", { zoneId });
          return JSON.parse(cached);
        }
      }

      // Query database
      const zone = await prisma.zone.findFirst({
        where,
        include: {
          milestones: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!zone) {
        throw new Error("Distance zone not found or access denied");
      }

      const result = {
        zoneId: zone.id,
        zoneName: zone.name,
        partnerId: zone.partnerId,
        milestones: zone.milestones.map((m) => ({
          id: m.id,
          minKm: m.minKm,
          maxKm: m.maxKm,
          suffix: m.suffix,
          sortOrder: m.sortOrder,
          rangeLabel: `${m.minKm}-${m.maxKm} km (Zone ${m.suffix})`,
        })),
        summary: {
          totalMilestones: zone.milestones.length,
          minDistance: zone.milestones[0]?.minKm ?? 0,
          maxDistance: zone.milestones[zone.milestones.length - 1]?.maxKm ?? 0,
        },
      };

      // Store in cache
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: this.cacheTTL,
        });
      }

      logger.debug("Milestones retrieved", {
        zoneId,
        count: result.milestones.length,
      });
      return result;
    } catch (error) {
      logger.error("Error getting milestones", {
        error: error.message,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  /**
   * Replace all milestones for a distance zone
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID for access validation
   * @param {Object[]} milestones - New milestones array
   * @param {number} milestones[].minKm - Minimum distance in km
   * @param {number} milestones[].maxKm - Maximum distance in km
   * @param {Object} reqContext - Request context for audit logging
   * @returns {Promise<Object>} Updated milestones
   * @throws {Error} If zone not found, not DISTANCE type, or validation fails
   */
  async replaceMilestones(zoneId, partnerId, milestones, reqContext = {}) {
    try {
      logger.info("Replacing zone milestones", {
        zoneId,
        partnerId,
        milestonesCount: milestones?.length,
        userId: reqContext.user?.id,
      });

      // Validate inputs
      if (!zoneId) {
        throw new Error("Zone ID is required");
      }

      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      if (
        !milestones ||
        !Array.isArray(milestones) ||
        milestones.length === 0
      ) {
        throw new Error("At least one milestone is required");
      }

      // Validate milestones
      this._validateMilestones(milestones);

      // Verify zone exists, belongs to partner, and is DISTANCE type
      const zone = await prisma.zone.findFirst({
        where: { id: zoneId, partnerId, zoneType: "DISTANCE" },
        include: { milestones: true },
      });

      if (!zone) {
        throw new Error("Distance zone not found or access denied");
      }

      // Use transaction to replace milestones
      const result = await prisma.$transaction(async (tx) => {
        // Delete existing milestones
        await tx.zoneMilestone.deleteMany({
          where: { zoneId },
        });

        // Create new milestones
        const milestonesData = milestones.map((m, index) => ({
          zoneId,
          minKm: m.minKm,
          maxKm: m.maxKm,
          suffix: this._generateSuffix(index + 1),
          sortOrder: index + 1,
        }));

        await tx.zoneMilestone.createMany({
          data: milestonesData,
        });

        // Fetch updated milestones
        return await tx.zoneMilestone.findMany({
          where: { zoneId },
          orderBy: { sortOrder: "asc" },
        });
      });

      // Audit logging
      await this._createAuditLog(
        "DISTANCE_ZONE_MILESTONES_UPDATED",
        "ZONE_MILESTONE",
        zoneId,
        reqContext,
        {
          oldMilestonesCount: zone.milestones.length,
          newMilestonesCount: milestones.length,
        },
        {
          milestonesReplaced: result.length,
        },
      );

      // Invalidate cache
      await this._invalidateCache(partnerId, zoneId);

      const formattedResult = {
        zoneId,
        zoneName: zone.name,
        partnerId: zone.partnerId,
        milestones: result.map((m) => ({
          id: m.id,
          minKm: m.minKm,
          maxKm: m.maxKm,
          suffix: m.suffix,
          sortOrder: m.sortOrder,
          rangeLabel: `${m.minKm}-${m.maxKm} km (Zone ${m.suffix})`,
        })),
        summary: {
          totalMilestones: result.length,
          minDistance: result[0]?.minKm ?? 0,
          maxDistance: result[result.length - 1]?.maxKm ?? 0,
        },
      };

      logger.info("Milestones replaced successfully", {
        zoneId,
        partnerId,
        count: result.length,
        userId: reqContext.user?.id,
      });

      return formattedResult;
    } catch (error) {
      logger.error("Error replacing milestones", {
        error: error.message,
        stack: error.stack,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  // ==========================================
  // DISTANCE CALCULATION & MATCHING
  // ==========================================

  /**
   * Calculate distance between two pincodes
   * Delegates to GeographicalDistanceService
   * @param {string} fromPincode - Source pincode (6-digit)
   * @param {string} toPincode - Destination pincode (6-digit)
   * @returns {Promise<Object>} Distance calculation result
   */
  async calculateShipmentDistance(fromPincode, toPincode) {
    try {
      logger.debug("Calculating shipment distance", { fromPincode, toPincode });

      // Validate pincode formats
      if (!fromPincode || !/^\d{6}$/.test(fromPincode)) {
        throw new Error("Invalid source pincode format (must be 6 digits)");
      }

      if (!toPincode || !/^\d{6}$/.test(toPincode)) {
        throw new Error(
          "Invalid destination pincode format (must be 6 digits)",
        );
      }

      // Delegate to geographical distance service
      const result = await geographicalDistanceService.calculatePincodeDistance(
        fromPincode,
        toPincode,
      );

      logger.debug("Shipment distance calculated", {
        fromPincode,
        toPincode,
        distanceKm: result.distance,
        cached: result.cached,
      });

      return {
        fromPincode,
        toPincode,
        distanceKm: result.distance,
        distanceMiles: result.distanceMiles,
        fromLocation: result.fromLocation,
        toLocation: result.toLocation,
        calculationMethod: result.calculationMethod,
        cached: result.cached,
      };
    } catch (error) {
      logger.error("Error calculating shipment distance", {
        error: error.message,
        fromPincode,
        toPincode,
      });
      throw error;
    }
  }

  /**
   * Match a distance to a zone milestone for a partner
   * @param {string} partnerId - Partner ID
   * @param {number} distanceKm - Distance in kilometers
   * @returns {Promise<Object>} Matched zone and milestone, or null if no match
   */
  async matchZoneByDistance(partnerId, distanceKm) {
    try {
      logger.debug("Matching zone by distance", { partnerId, distanceKm });

      // Validate inputs
      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      if (typeof distanceKm !== "number" || distanceKm < 0) {
        throw new Error("Distance must be a non-negative number");
      }

      // Try cache first
      const cacheKey = `${this.cachePrefix}:match:${partnerId}:${Math.round(distanceKm * 100)}`;
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached match result", {
            partnerId,
            distanceKm,
          });
          return JSON.parse(cached);
        }
      }

      // Find all DISTANCE zones for partner with milestones
      const zones = await prisma.zone.findMany({
        where: {
          partnerId,
          zoneType: "DISTANCE",
          status: true,
        },
        include: {
          milestones: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (zones.length === 0) {
        logger.debug("No distance zones found for partner", { partnerId });
        return {
          matched: false,
          distanceKm,
          partnerId,
          message: "No distance zones configured for this partner",
        };
      }

      // Find matching milestone (using exact float comparison)
      let matchedZone = null;
      let matchedMilestone = null;

      for (const zone of zones) {
        for (const milestone of zone.milestones) {
          if (distanceKm >= milestone.minKm && distanceKm <= milestone.maxKm) {
            matchedZone = zone;
            matchedMilestone = milestone;
            break;
          }
        }
        if (matchedMilestone) break;
      }

      const result = matchedMilestone
        ? {
            matched: true,
            distanceKm,
            partnerId,
            zone: {
              id: matchedZone.id,
              name: matchedZone.name,
              description: matchedZone.description,
            },
            milestone: {
              id: matchedMilestone.id,
              minKm: matchedMilestone.minKm,
              maxKm: matchedMilestone.maxKm,
              suffix: matchedMilestone.suffix,
              sortOrder: matchedMilestone.sortOrder,
              rangeLabel: `${matchedMilestone.minKm}-${matchedMilestone.maxKm} km`,
            },
            zoneSuffix: matchedMilestone.suffix,
          }
        : {
            matched: false,
            distanceKm,
            partnerId,
            message: `No milestone found for distance ${distanceKm} km`,
            availableRanges: zones.flatMap((z) =>
              z.milestones.map((m) => ({
                zoneName: z.name,
                range: `${m.minKm}-${m.maxKm} km`,
                suffix: m.suffix,
              })),
            ),
          };

      // Cache result
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: this.matchCacheTTL,
        });
      }

      logger.debug("Zone matching completed", {
        partnerId,
        distanceKm,
        matched: result.matched,
        zoneSuffix: result.zoneSuffix,
      });

      return result;
    } catch (error) {
      logger.error("Error matching zone by distance", {
        error: error.message,
        partnerId,
        distanceKm,
      });
      throw error;
    }
  }

  /**
   * Get zone for a shipment (calculates distance and matches)
   * Combined convenience method for distance calculation + zone matching
   * @param {string} partnerId - Partner ID
   * @param {string} fromPincode - Source pincode
   * @param {string} toPincode - Destination pincode
   * @param {Object} reqContext - Request context for audit logging
   * @returns {Promise<Object>} Distance and matched zone/milestone
   */
  async getZoneForShipment(partnerId, fromPincode, toPincode, reqContext = {}) {
    try {
      logger.info("Getting zone for shipment", {
        partnerId,
        fromPincode,
        toPincode,
      });

      // Calculate distance
      const distanceResult = await this.calculateShipmentDistance(
        fromPincode,
        toPincode,
      );

      // Match zone
      const matchResult = await this.matchZoneByDistance(
        partnerId,
        distanceResult.distanceKm,
      );

      const result = {
        ...distanceResult,
        ...matchResult,
      };

      // Audit logging for successful matches
      if (matchResult.matched) {
        await this._createAuditLog(
          "DISTANCE_ZONE_MATCHED",
          "ZONE",
          matchResult.zone?.id,
          reqContext,
          {
            fromPincode,
            toPincode,
            distanceKm: distanceResult.distanceKm,
          },
          {
            matched: true,
            zoneSuffix: matchResult.zoneSuffix,
          },
        );
      }

      logger.info("Zone for shipment determined", {
        partnerId,
        fromPincode,
        toPincode,
        distanceKm: distanceResult.distanceKm,
        matched: matchResult.matched,
        zoneSuffix: matchResult.zoneSuffix,
      });

      return result;
    } catch (error) {
      logger.error("Error getting zone for shipment", {
        error: error.message,
        partnerId,
        fromPincode,
        toPincode,
      });
      throw error;
    }
  }

  /**
   * List distance zones for a partner
   * @param {string} partnerId - Partner ID
   * @param {Object} filters - Filter options
   * @param {boolean} [filters.status] - Filter by status
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=20] - Items per page
   * @returns {Promise<Object>} Paginated distance zones
   */
  async listDistanceZones(partnerId, filters = {}) {
    try {
      logger.debug("Listing distance zones", {
        partnerId: partnerId || "ALL",
        filters,
      });

      const page = Math.max(1, parseInt(filters.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
      const skip = (page - 1) * limit;

      // Build where clause - partnerId is optional for admin users
      const where = {
        zoneType: "DISTANCE",
      };

      // Only filter by partnerId if provided (non-admin users)
      if (partnerId) {
        where.partnerId = partnerId;
      }

      if (filters.status !== undefined) {
        where.status = Boolean(filters.status);
      }

      const [zones, totalCount] = await Promise.all([
        prisma.zone.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            milestones: {
              orderBy: { sortOrder: "asc" },
            },
          },
        }),
        prisma.zone.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        zones: zones.map((z) => ({
          ...z,
          milestonesCount: z.milestones.length,
          distanceRange:
            z.milestones.length > 0
              ? `${z.milestones[0].minKm}-${z.milestones[z.milestones.length - 1].maxKm} km`
              : "Not configured",
        })),
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error listing distance zones", {
        error: error.message,
        partnerId,
      });
      throw error;
    }
  }

  // ==========================================
  // VALIDATION HELPERS
  // ==========================================

  /**
   * Validate milestones array
   * Rules:
   * - minKm >= 0, maxKm >= minKm
   * - Sorted by minKm
   * - Adjacent with no gaps: milestones[i].minKm === milestones[i-1].maxKm + 1
   * @private
   * @param {Object[]} milestones - Milestones to validate
   * @throws {Error} If validation fails
   */
  _validateMilestones(milestones) {
    // Sort by minKm for validation
    const sorted = [...milestones].sort((a, b) => a.minKm - b.minKm);

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];

      // Validate minKm and maxKm
      if (typeof m.minKm !== "number" || m.minKm < 0) {
        throw new Error(
          `Milestone ${i + 1}: minKm must be a non-negative number (got ${m.minKm})`,
        );
      }

      if (typeof m.maxKm !== "number" || m.maxKm < m.minKm) {
        throw new Error(
          `Milestone ${i + 1}: maxKm (${m.maxKm}) must be >= minKm (${m.minKm})`,
        );
      }

      // Validate first milestone starts at 0
      if (i === 0 && m.minKm !== 0) {
        throw new Error(`First milestone must start at 0 km (got ${m.minKm})`);
      }

      // Validate adjacency (no gaps, no overlaps)
      if (i > 0) {
        const prevMax = sorted[i - 1].maxKm;
        const expectedMin = prevMax + 1;

        if (m.minKm !== expectedMin) {
          if (m.minKm <= prevMax) {
            throw new Error(
              `Milestone ${i + 1}: overlapping range detected. ` +
                `minKm (${m.minKm}) overlaps with previous maxKm (${prevMax})`,
            );
          } else {
            throw new Error(
              `Milestone ${i + 1}: gap detected. ` +
                `Expected minKm to be ${expectedMin}, got ${m.minKm}. ` +
                `Milestones must be adjacent (next.minKm = prev.maxKm + 1)`,
            );
          }
        }
      }
    }

    logger.debug("Milestones validation passed", { count: milestones.length });
  }

  /**
   * Generate suffix letter from sortOrder (1=A, 2=B, ..., 26=Z, 27=AA, etc.)
   * @private
   * @param {number} sortOrder - 1-based sort order
   * @returns {string} Suffix letter(s)
   */
  _generateSuffix(sortOrder) {
    let suffix = "";
    let n = sortOrder;

    while (n > 0) {
      n--; // Convert to 0-based
      suffix = String.fromCharCode(65 + (n % 26)) + suffix;
      n = Math.floor(n / 26);
    }

    return suffix;
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  /**
   * Invalidate cache for partner/zone
   * @private
   * @param {string} partnerId - Partner ID
   * @param {string} [zoneId] - Optional zone ID
   */
  async _invalidateCache(partnerId, zoneId = null) {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      const keysToDelete = [];

      if (zoneId) {
        keysToDelete.push(`${this.cachePrefix}:milestones:${zoneId}`);
      }

      // Clear match cache for partner (using pattern)
      const matchKeys = await redis.keys(
        `${this.cachePrefix}:match:${partnerId}:*`,
      );
      keysToDelete.push(...matchKeys);

      if (keysToDelete.length > 0) {
        await Promise.all(keysToDelete.map((key) => redis.del(key)));
      }

      // Also invalidate zoneService cache (zones are also fetched via zoneService)
      try {
        const zoneService = getZoneService();
        await zoneService._invalidateZoneCache(partnerId, zoneId);
      } catch (err) {
        logger.debug("Could not invalidate zoneService cache", {
          error: err.message,
        });
      }

      logger.debug("Distance zone cache invalidated", {
        partnerId,
        zoneId,
        keysDeleted: keysToDelete.length,
      });
    } catch (error) {
      logger.error("Error invalidating cache", {
        error: error.message,
        partnerId,
      });
      // Don't throw - cache invalidation failure shouldn't break operations
    }
  }

  // ==========================================
  // AUDIT LOGGING
  // ==========================================

  /**
   * Create audit log entry
   * @private
   */
  async _createAuditLog(
    action,
    resourceType,
    resourceId,
    reqContext,
    requestData,
    responseData,
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          resourceType,
          resourceId: resourceId || null,
          userId: reqContext.user?.id || null,
          ipAddress: reqContext.ip || null,
          userAgent: reqContext.userAgent || null,
          requestData: requestData || null,
          responseData: responseData || null,
        },
      });
    } catch (error) {
      logger.error("Error creating audit log", {
        error: error.message,
        action,
      });
      // Don't throw - audit log failure shouldn't break operations
    }
  }
}

module.exports = new DistanceZoneService();
