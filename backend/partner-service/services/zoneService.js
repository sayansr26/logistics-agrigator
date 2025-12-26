/**
 * Zone Service
 *
 * Purpose: Complete zone management with CRUD, geographical associations, service configuration, and transaction support
 * Manages partner zones with states, cities, areas, pincodes, and service type configuration
 *
 * Following auth-service patterns with Prisma ORM and Redis caching
 * Replaces external API calls with direct database operations
 *
 * Features:
 * - Zone CRUD operations with partner scoping (multi-tenant)
 * - Geographical association management (states, cities, areas, pincodes)
 * - Service type configuration (PICKUP, DELIVERY, COD, PREPAID, ODA, HILL)
 * - Transaction support for atomic operations
 * - Redis caching with 2-hour TTL
 * - Zone overlap validation
 * - Comprehensive error handling
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

class ZoneService {
  constructor() {
    this.cachePrefix = "zones";
    this.cacheTTL = 7200; // 2 hours for zone data
    // NOTE: serviceTypes removed in Zone System v2 - use Pincode Types instead
  }

  // ==========================================
  // ZONE CRUD OPERATIONS (6 methods)
  // ==========================================

  /**
   * Create zone with geographical associations and service configuration
   * Uses Prisma transaction for atomicity
   * @param {string} partnerId - Partner ID (CUID format for compatibility)
   * @param {Object} zoneData - Zone creation data
   * @param {string} zoneData.name - Zone name (unique per partner)
   * @param {string} [zoneData.description] - Zone description
   * @param {boolean} [zoneData.status=true] - Zone status
   * @param {Object} [zoneData.geographical] - Geographical associations
   * @param {string[]} [zoneData.geographical.states] - State IDs (UUID)
   * @param {string[]} [zoneData.geographical.cities] - City IDs (UUID)
   * @param {string[]} [zoneData.geographical.areas] - Area IDs (UUID)
   * @param {string[]} [zoneData.geographical.pincodes] - Pincode codes (6-digit strings)
   * @param {Object} [zoneData.services] - Service type configuration
   * @param {boolean} [zoneData.services.PICKUP] - Pickup availability
   * @param {number} [zoneData.services.PICKUP_charges] - Additional pickup charges
   * @param {boolean} [zoneData.services.DELIVERY] - Delivery availability
   * @param {number} [zoneData.services.DELIVERY_charges] - Additional delivery charges
   * @param {boolean} [zoneData.services.COD] - COD availability
   * @param {number} [zoneData.services.COD_charges] - Additional COD charges
   * @param {boolean} [zoneData.services.PREPAID] - Prepaid availability
   * @param {number} [zoneData.services.PREPAID_charges] - Additional prepaid charges
   * @param {boolean} [zoneData.services.ODA] - ODA availability
   * @param {number} [zoneData.services.ODA_charges] - Additional ODA charges
   * @param {boolean} [zoneData.services.HILL] - Hill station availability
   * @param {number} [zoneData.services.HILL_charges] - Additional hill charges
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.validateOverlap=false] - Check for zone overlaps (performance impact)
   * @returns {Promise<Object>} Created zone with full details
   * @throws {Error} If zone name already exists for partner
   * @throws {Error} If zone overlap detected (when validateOverlap=true)
   * @throws {Error} If geographical entities don't exist
   */
  async createZone(partnerId, zoneData, options = {}) {
    try {
      logger.info("Creating zone", { partnerId, zoneName: zoneData.name });

      // Validate required fields
      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      if (
        !zoneData.name ||
        typeof zoneData.name !== "string" ||
        zoneData.name.trim() === ""
      ) {
        throw new Error("Zone name is required and must be a non-empty string");
      }

      // Verify partner exists
      const partnerExists = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { id: true },
      });

      if (!partnerExists) {
        throw new Error(`Partner with ID '${partnerId}' does not exist`);
      }

      // Extract data
      const { geographical = {}, services = {}, ...zoneDetails } = zoneData;
      const { validateOverlap = false } = options;

      // Use Prisma transaction for atomicity
      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Check for duplicate zone name
          const existing = await tx.zone.findFirst({
            where: {
              partnerId,
              name: zoneDetails.name.trim(),
            },
          });

          if (existing) {
            throw new Error(
              `Zone '${zoneDetails.name}' already exists for this partner`,
            );
          }

          // 2. Create the zone
          const zone = await tx.zone.create({
            data: {
              partnerId,
              name: zoneDetails.name.trim(),
              description: zoneDetails.description?.trim() || null,
              status:
                zoneDetails.status !== undefined
                  ? Boolean(zoneDetails.status)
                  : true,
            },
          });

          logger.debug("Zone created", {
            zoneId: zone.id,
            partnerId,
            zoneName: zone.name,
          });

          // 3. Associate geographical entities (states, cities, areas, pincodes)
          const geoStats = await this._associateGeography(
            zone.id,
            geographical,
            tx,
          );
          logger.debug("Geographical associations created", {
            zoneId: zone.id,
            stats: geoStats,
          });

          // NOTE: Zone services configuration has been removed in Zone System v2
          // Use Pincode Types for service-based configuration instead
          if (services && Object.keys(services).length > 0) {
            logger.warn(
              "Zone services configuration ignored - feature deprecated",
              {
                zoneId: zone.id,
                partnerId,
              },
            );
          }

          // 4. Validate no zone overlaps (optional - can be disabled for performance)
          if (validateOverlap) {
            await this._validateZoneOverlap(zone.id, partnerId, tx);
            logger.debug("Zone overlap validation passed", {
              zoneId: zone.id,
              partnerId,
            });
          }

          return zone;
        },
        {
          maxWait: 5000, // 5 seconds max wait
          timeout: 30000, // 30 seconds timeout
        },
      );

      // 6. Invalidate cache after successful creation
      await this._invalidateZoneCache(partnerId);

      logger.info("Zone created successfully", {
        partnerId,
        zoneId: result.id,
        zoneName: result.name,
      });

      // 7. Return complete zone with associations
      return await this.getZoneComplete(result.id, partnerId);
    } catch (error) {
      logger.error("Error creating zone", {
        error: error.message,
        stack: error.stack,
        partnerId,
        zoneName: zoneData?.name,
      });
      throw error;
    }
  }

  /**
   * Update zone details (name, description, status)
   * Does NOT update geographical associations or service configuration
   * Use updateZoneGeography() and updateZoneServices() for those
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @param {Object} zoneData - Updated zone data
   * @param {string} [zoneData.name] - New zone name
   * @param {string} [zoneData.description] - New description
   * @param {boolean} [zoneData.status] - New status
   * @returns {Promise<Object>} Updated zone details
   * @throws {Error} If zone not found or access denied
   * @throws {Error} If new name already exists for partner
   */
  async updateZone(zoneId, partnerId, zoneData) {
    try {
      logger.info("Updating zone", { partnerId, zoneId });

      // Validate inputs
      if (!zoneId) {
        throw new Error("Zone ID is required");
      }

      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      if (!zoneData || Object.keys(zoneData).length === 0) {
        throw new Error("Update data is required");
      }

      // Verify zone exists and belongs to partner
      const existingZone = await prisma.zone.findFirst({
        where: { id: zoneId, partnerId },
      });

      if (!existingZone) {
        throw new Error("Zone not found or access denied");
      }

      // If updating name, check for duplicates
      if (zoneData.name && zoneData.name.trim() !== existingZone.name) {
        const duplicate = await prisma.zone.findFirst({
          where: {
            partnerId,
            name: zoneData.name.trim(),
            id: { not: zoneId },
          },
        });

        if (duplicate) {
          throw new Error(
            `Zone name '${zoneData.name}' already exists for this partner`,
          );
        }
      }

      // Prepare update data
      const updateData = {};
      if (zoneData.name !== undefined) {
        updateData.name = zoneData.name.trim();
      }
      if (zoneData.description !== undefined) {
        updateData.description = zoneData.description
          ? zoneData.description.trim()
          : null;
      }
      if (zoneData.status !== undefined) {
        updateData.status = Boolean(zoneData.status);
      }

      // Update zone
      const updatedZone = await prisma.zone.update({
        where: { id: zoneId },
        data: updateData,
      });

      // Invalidate cache
      await this._invalidateZoneCache(partnerId, zoneId);

      logger.info("Zone updated successfully", {
        partnerId,
        zoneId,
        changes: Object.keys(updateData),
      });

      return updatedZone;
    } catch (error) {
      logger.error("Error updating zone", {
        error: error.message,
        stack: error.stack,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  /**
   * Soft delete zone (set status to false)
   * Does NOT remove geographical associations or service configuration
   * Zone can be reactivated by setting status back to true
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Updated zone with status=false
   * @throws {Error} If zone not found or access denied
   */
  async deleteZone(zoneId, partnerId) {
    try {
      logger.info("Soft deleting zone", { partnerId, zoneId });

      // Validate inputs
      if (!zoneId) {
        throw new Error("Zone ID is required");
      }

      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      // Verify zone exists and belongs to partner
      const existingZone = await prisma.zone.findFirst({
        where: { id: zoneId, partnerId },
      });

      if (!existingZone) {
        throw new Error("Zone not found or access denied");
      }

      // Soft delete by setting status to false
      const deletedZone = await prisma.zone.update({
        where: { id: zoneId },
        data: {
          status: false,
          updatedAt: new Date(),
        },
      });

      // Invalidate cache
      await this._invalidateZoneCache(partnerId, zoneId);

      logger.info("Zone soft deleted successfully", {
        partnerId,
        zoneId,
        zoneName: deletedZone.name,
      });

      return deletedZone;
    } catch (error) {
      logger.error("Error deleting zone", {
        error: error.message,
        stack: error.stack,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  /**
   * Get zone details (basic info only, no associations)
   * Uses Redis cache with 2-hour TTL
   * For complete details with associations, use getZoneComplete()
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Zone basic details
   * @throws {Error} If zone not found or access denied
   */
  async getZone(zoneId, partnerId) {
    try {
      logger.debug("Getting zone basic details", { partnerId, zoneId });

      // Validate inputs
      if (!zoneId) {
        throw new Error("Zone ID is required");
      }

      // Try cache first (only if partnerId provided)
      let cacheKey;
      if (partnerId) {
        cacheKey = `${this.cachePrefix}:${partnerId}:${zoneId}`;
      } else {
        cacheKey = `${this.cachePrefix}:all:${zoneId}`;
      }
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached zone", { partnerId, zoneId });
          return JSON.parse(cached);
        }
      }

      // Query database - conditionally filter by partnerId
      const where = { id: zoneId };
      if (partnerId) {
        where.partnerId = partnerId;
      }

      const zone = await prisma.zone.findFirst({
        where,
        include: {
          milestones: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!zone) {
        throw new Error("Zone not found or access denied");
      }

      // Store in cache
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(zone), { EX: this.cacheTTL });
      }

      logger.debug("Zone retrieved from database", { partnerId, zoneId });
      return zone;
    } catch (error) {
      logger.error("Error getting zone", {
        error: error.message,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  /**
   * List zones with filtering and pagination
   * Supports filtering by status, search by name, and pagination
   * @param {string} partnerId - Partner ID
   * @param {Object} [filters={}] - Filter options
   * @param {boolean} [filters.status] - Filter by status (true/false)
   * @param {string} [filters.search] - Search in zone name (case-insensitive)
   * @param {number} [filters.page=1] - Page number (1-based)
   * @param {number} [filters.limit=20] - Items per page (max 100)
   * @param {string} [filters.sortBy='createdAt'] - Sort field (name, createdAt, updatedAt)
   * @param {string} [filters.sortOrder='desc'] - Sort order (asc, desc)
   * @returns {Promise<Object>} Paginated zones list with metadata
   * @returns {Object[]} return.zones - Array of zones
   * @returns {Object} return.pagination - Pagination metadata
   */
  async listZones(partnerId, filters = {}) {
    try {
      logger.info("Listing zones", { partnerId: partnerId || "ALL", filters });

      // Parse and validate pagination parameters
      const page = Math.max(1, parseInt(filters.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
      const skip = (page - 1) * limit;

      // Build where clause - partnerId is optional for admin users
      const where = {};

      // Only filter by partnerId if provided (non-admin users)
      if (partnerId) {
        where.partnerId = partnerId;
      }

      // Filter by status if provided
      if (filters.status !== undefined) {
        where.status = Boolean(filters.status);
      }

      // Search by name if provided
      if (
        filters.search &&
        typeof filters.search === "string" &&
        filters.search.trim()
      ) {
        where.name = {
          contains: filters.search.trim(),
          mode: "insensitive",
        };
      }

      // Validate sort fields
      const validSortFields = ["name", "createdAt", "updatedAt"];
      const sortBy = validSortFields.includes(filters.sortBy)
        ? filters.sortBy
        : "createdAt";
      const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";

      // Try cache for first page with no filters
      const isDefaultQuery =
        page === 1 &&
        limit === 20 &&
        !filters.status &&
        !filters.search &&
        sortBy === "createdAt" &&
        sortOrder === "desc";
      const cacheKey = `${this.cachePrefix}:${partnerId}:list`;
      const redis = getRedisClient();

      if (isDefaultQuery && redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached zones list", { partnerId });
          return JSON.parse(cached);
        }
      }

      // Execute queries in parallel
      const [zones, totalCount] = await Promise.all([
        prisma.zone.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
          select: {
            id: true,
            partnerId: true,
            name: true,
            description: true,
            zoneType: true, // Added zoneType field
            status: true,
            createdAt: true,
            updatedAt: true,
            milestones: {
              // Include milestones data for DISTANCE zones
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                minKm: true,
                maxKm: true,
                suffix: true,
                sortOrder: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                zoneStates: true,
                zoneCities: true,
                zoneAreas: true,
                zonePincodes: true,
                milestones: true,
              },
            },
          },
        }),
        prisma.zone.count({ where }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const result = {
        zones,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };

      // Cache default query results
      if (isDefaultQuery && redis) {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: this.cacheTTL,
        });
      }

      logger.info("Zones listed successfully", {
        partnerId,
        count: zones.length,
        total: totalCount,
        page,
      });

      return result;
    } catch (error) {
      logger.error("Error listing zones", {
        error: error.message,
        stack: error.stack,
        partnerId,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get zone with ALL associations (complete details)
   * Includes all geographical associations and service configuration
   * Uses Redis cache with 2-hour TTL
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Complete zone with all associations
   * @returns {Object[]} return.zoneStates - Associated states
   * @returns {Object[]} return.zoneCities - Associated cities
   * @returns {Object[]} return.zoneAreas - Associated areas
   * @returns {Object[]} return.zonePincodes - Associated pincodes
   * @returns {Object[]} return.milestones - Distance milestones (for DISTANCE zones)
   * @throws {Error} If zone not found or access denied
   */
  async getZoneComplete(zoneId, partnerId) {
    try {
      logger.debug("Getting complete zone details", { partnerId, zoneId });

      // Validate inputs
      if (!zoneId) {
        throw new Error("Zone ID is required");
      }

      // Try cache first (cache key depends on whether partnerId is provided)
      let cacheKey;
      if (partnerId) {
        cacheKey = `${this.cachePrefix}:${partnerId}:${zoneId}:complete`;
      } else {
        cacheKey = `${this.cachePrefix}:all:${zoneId}:complete`;
      }
      const redis = getRedisClient();

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Returning cached complete zone", { partnerId, zoneId });
          return JSON.parse(cached);
        }
      }

      // Query database with all associations - conditionally filter by partnerId
      const where = { id: zoneId };
      if (partnerId) {
        where.partnerId = partnerId;
      }

      const zone = await prisma.zone.findFirst({
        where,
        include: {
          zoneStates: {
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
            orderBy: { state: { name: "asc" } },
          },
          zoneCities: {
            include: {
              city: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  status: true,
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
            orderBy: { city: { name: "asc" } },
          },
          zoneAreas: {
            include: {
              area: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  status: true,
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
            },
            orderBy: { area: { name: "asc" } },
          },
          zonePincodes: {
            include: {
              pincode: {
                select: {
                  id: true,
                  code: true,
                  areaName: true,
                  district: true,
                  odaApplicable: true,
                  hillApplicable: true,
                  status: true,
                  state: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                  area: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
            orderBy: { pincode: { code: "asc" } },
          },
          milestones: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!zone) {
        throw new Error("Zone not found or access denied");
      }

      // Add summary counts
      const zoneWithSummary = {
        ...zone,
        summary: {
          totalStates: zone.zoneStates.length,
          totalCities: zone.zoneCities.length,
          totalAreas: zone.zoneAreas.length,
          totalPincodes: zone.zonePincodes.length,
          totalMilestones: zone.milestones?.length || 0,
        },
      };

      // Store in cache
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(zoneWithSummary), {
          EX: this.cacheTTL,
        });
      }

      logger.debug("Complete zone retrieved from database", {
        partnerId,
        zoneId,
        summary: zoneWithSummary.summary,
      });

      return zoneWithSummary;
    } catch (error) {
      logger.error("Error getting complete zone", {
        error: error.message,
        stack: error.stack,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  // ==========================================
  // GEOGRAPHICAL MANAGEMENT (3 methods)
  // ==========================================

  /**
   * Update zone geographical associations
   * Replaces existing associations with new ones
   * Uses transaction for atomicity
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @param {Object} geographical - Geographical associations
   * @param {string[]} [geographical.states] - State IDs (UUID)
   * @param {string[]} [geographical.cities] - City IDs (UUID)
   * @param {string[]} [geographical.areas] - Area IDs (UUID)
   * @param {string[]} [geographical.pincodes] - Pincode codes (6-digit strings)
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.validateOverlap=false] - Check for zone overlaps
   * @returns {Promise<Object>} Updated geographical associations
   * @throws {Error} If zone not found or access denied
   * @throws {Error} If geographical entities don't exist
   * @throws {Error} If zone overlap detected (when validateOverlap=true)
   */
  async updateZoneGeography(zoneId, partnerId, geographical, options = {}) {
    try {
      logger.info("Updating zone geography", { partnerId, zoneId });

      // Validate inputs
      if (!zoneId) {
        throw new Error("Zone ID is required");
      }

      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      if (!geographical || typeof geographical !== "object") {
        throw new Error("Geographical data is required");
      }

      // Verify zone exists and belongs to partner
      const zone = await prisma.zone.findFirst({
        where: { id: zoneId, partnerId },
      });

      if (!zone) {
        throw new Error("Zone not found or access denied");
      }

      const { validateOverlap = false } = options;

      // Use transaction to update geography
      const result = await prisma.$transaction(
        async (tx) => {
          // Delete existing associations
          await Promise.all([
            tx.zoneState.deleteMany({ where: { zoneId } }),
            tx.zoneCity.deleteMany({ where: { zoneId } }),
            tx.zoneArea.deleteMany({ where: { zoneId } }),
            tx.zonePincode.deleteMany({ where: { zoneId } }),
          ]);

          logger.debug("Existing geographical associations deleted", {
            zoneId,
          });

          // Create new associations
          const geoStats = await this._associateGeography(
            zoneId,
            geographical,
            tx,
          );
          logger.debug("New geographical associations created", {
            zoneId,
            stats: geoStats,
          });

          // Validate no zone overlaps if requested
          if (validateOverlap) {
            await this._validateZoneOverlap(zoneId, partnerId, tx);
            logger.debug("Zone overlap validation passed", {
              zoneId,
              partnerId,
            });
          }

          // Get updated associations
          const [states, cities, areas, pincodes] = await Promise.all([
            tx.zoneState.findMany({
              where: { zoneId },
              include: { state: true },
            }),
            tx.zoneCity.findMany({
              where: { zoneId },
              include: { city: { include: { state: true } } },
            }),
            tx.zoneArea.findMany({
              where: { zoneId },
              include: {
                area: { include: { city: { include: { state: true } } } },
              },
            }),
            tx.zonePincode.findMany({
              where: { zoneId },
              include: { pincode: { include: { state: true, area: true } } },
            }),
          ]);

          return {
            zoneStates: states,
            zoneCities: cities,
            zoneAreas: areas,
            zonePincodes: pincodes,
            summary: {
              totalStates: states.length,
              totalCities: cities.length,
              totalAreas: areas.length,
              totalPincodes: pincodes.length,
            },
          };
        },
        {
          maxWait: 5000,
          timeout: 30000,
        },
      );

      // Invalidate cache
      await this._invalidateZoneCache(partnerId, zoneId);

      logger.info("Zone geography updated successfully", {
        partnerId,
        zoneId,
        summary: result.summary,
      });

      return result;
    } catch (error) {
      logger.error("Error updating zone geography", {
        error: error.message,
        stack: error.stack,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  /**
   * Get zone geographical associations
   * Returns all geographical entities associated with the zone
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Geographical associations
   * @returns {Object[]} return.states - Associated states
   * @returns {Object[]} return.cities - Associated cities
   * @returns {Object[]} return.areas - Associated areas
   * @returns {Object[]} return.pincodes - Associated pincodes
   * @returns {Object} return.summary - Summary counts
   * @throws {Error} If zone not found or access denied
   */
  async getZoneGeography(zoneId, partnerId) {
    try {
      logger.debug("Getting zone geography", { partnerId, zoneId });

      // Validate inputs
      if (!zoneId) {
        throw new Error("Zone ID is required");
      }

      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      // Verify zone exists and belongs to partner
      const zone = await prisma.zone.findFirst({
        where: { id: zoneId, partnerId },
        select: { id: true },
      });

      if (!zone) {
        throw new Error("Zone not found or access denied");
      }

      // Get all geographical associations in parallel
      const [states, cities, areas, pincodes] = await Promise.all([
        prisma.zoneState.findMany({
          where: { zoneId },
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
          orderBy: { state: { name: "asc" } },
        }),
        prisma.zoneCity.findMany({
          where: { zoneId },
          include: {
            city: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
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
          orderBy: { city: { name: "asc" } },
        }),
        prisma.zoneArea.findMany({
          where: { zoneId },
          include: {
            area: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
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
          },
          orderBy: { area: { name: "asc" } },
        }),
        prisma.zonePincode.findMany({
          where: { zoneId },
          include: {
            pincode: {
              select: {
                id: true,
                code: true,
                areaName: true,
                district: true,
                odaApplicable: true,
                hillApplicable: true,
                status: true,
                state: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
                area: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
          orderBy: { pincode: { code: "asc" } },
        }),
      ]);

      const result = {
        states,
        cities,
        areas,
        pincodes,
        summary: {
          totalStates: states.length,
          totalCities: cities.length,
          totalAreas: areas.length,
          totalPincodes: pincodes.length,
        },
      };

      logger.debug("Zone geography retrieved", {
        partnerId,
        zoneId,
        summary: result.summary,
      });

      return result;
    } catch (error) {
      logger.error("Error getting zone geography", {
        error: error.message,
        stack: error.stack,
        zoneId,
        partnerId,
      });
      throw error;
    }
  }

  /**
   * Helper: Associate geographical entities in transaction
   * @private
   * @param {string} zoneId - Zone UUID
   * @param {Object} geographical - Geographical associations
   * @param {Object} tx - Prisma transaction client
   * @returns {Promise<Object>} Statistics of associations created
   * @throws {Error} If geographical entities don't exist
   */
  async _associateGeography(zoneId, geographical, tx) {
    const stats = {
      statesAdded: 0,
      citiesAdded: 0,
      areasAdded: 0,
      pincodesAdded: 0,
    };

    // Associate states
    if (
      geographical.states &&
      Array.isArray(geographical.states) &&
      geographical.states.length > 0
    ) {
      // Validate states exist
      const validStates = await tx.state.findMany({
        where: {
          id: { in: geographical.states },
          status: true,
        },
        select: { id: true },
      });

      if (validStates.length !== geographical.states.length) {
        const validIds = validStates.map((s) => s.id);
        const invalidIds = geographical.states.filter(
          (id) => !validIds.includes(id),
        );
        throw new Error(
          `Invalid or inactive state IDs: ${invalidIds.join(", ")}`,
        );
      }

      const stateAssociations = await tx.zoneState.createMany({
        data: geographical.states.map((stateId) => ({
          zoneId,
          stateId,
        })),
        skipDuplicates: true,
      });

      stats.statesAdded = stateAssociations.count;
    }

    // Associate cities
    if (
      geographical.cities &&
      Array.isArray(geographical.cities) &&
      geographical.cities.length > 0
    ) {
      // Validate cities exist
      const validCities = await tx.city.findMany({
        where: {
          id: { in: geographical.cities },
          status: true,
        },
        select: { id: true },
      });

      if (validCities.length !== geographical.cities.length) {
        const validIds = validCities.map((c) => c.id);
        const invalidIds = geographical.cities.filter(
          (id) => !validIds.includes(id),
        );
        throw new Error(
          `Invalid or inactive city IDs: ${invalidIds.join(", ")}`,
        );
      }

      const cityAssociations = await tx.zoneCity.createMany({
        data: geographical.cities.map((cityId) => ({
          zoneId,
          cityId,
        })),
        skipDuplicates: true,
      });

      stats.citiesAdded = cityAssociations.count;
    }

    // Associate areas
    if (
      geographical.areas &&
      Array.isArray(geographical.areas) &&
      geographical.areas.length > 0
    ) {
      // Validate areas exist
      const validAreas = await tx.area.findMany({
        where: {
          id: { in: geographical.areas },
          status: true,
        },
        select: { id: true },
      });

      if (validAreas.length !== geographical.areas.length) {
        const validIds = validAreas.map((a) => a.id);
        const invalidIds = geographical.areas.filter(
          (id) => !validIds.includes(id),
        );
        throw new Error(
          `Invalid or inactive area IDs: ${invalidIds.join(", ")}`,
        );
      }

      const areaAssociations = await tx.zoneArea.createMany({
        data: geographical.areas.map((areaId) => ({
          zoneId,
          areaId,
        })),
        skipDuplicates: true,
      });

      stats.areasAdded = areaAssociations.count;
    }

    // Associate pincodes (by code, not ID)
    if (
      geographical.pincodes &&
      Array.isArray(geographical.pincodes) &&
      geographical.pincodes.length > 0
    ) {
      // Normalize pincode codes (ensure 6-digit strings)
      const pincodeCodes = geographical.pincodes.map((code) => {
        const normalized = String(code).trim().padStart(6, "0");
        if (!/^\d{6}$/.test(normalized)) {
          throw new Error(`Invalid pincode format: ${code}`);
        }
        return normalized;
      });

      // Find pincode IDs from codes
      const pincodes = await tx.pincode.findMany({
        where: {
          code: { in: pincodeCodes },
          status: true,
        },
        select: { id: true, code: true },
      });

      if (pincodes.length !== pincodeCodes.length) {
        const foundCodes = pincodes.map((p) => p.code);
        const notFoundCodes = pincodeCodes.filter(
          (code) => !foundCodes.includes(code),
        );
        throw new Error(
          `Pincodes not found or inactive: ${notFoundCodes.join(", ")}`,
        );
      }

      const pincodeAssociations = await tx.zonePincode.createMany({
        data: pincodes.map((pincode) => ({
          zoneId,
          pincodeId: pincode.id,
        })),
        skipDuplicates: true,
      });

      stats.pincodesAdded = pincodeAssociations.count;
    }

    return stats;
  }

  // ==========================================
  // SERVICE CONFIGURATION (3 methods)
  // ==========================================

  /**
   * Update zone service configuration
   * Replaces existing service configuration with new one
   * Uses transaction for atomicity
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @param {Object} services - Service type configuration
   * @param {boolean} [services.PICKUP] - Pickup availability
   * @param {number} [services.PICKUP_charges] - Additional pickup charges
   * @param {string} [services.PICKUP_remarks] - Pickup remarks
   * @param {boolean} [services.DELIVERY] - Delivery availability
   * @param {number} [services.DELIVERY_charges] - Additional delivery charges
   * @param {string} [services.DELIVERY_remarks] - Delivery remarks
   * @param {boolean} [services.COD] - COD availability
   * @param {number} [services.COD_charges] - Additional COD charges
   * @param {string} [services.COD_remarks] - COD remarks
   * @param {boolean} [services.PREPAID] - Prepaid availability
   * @param {number} [services.PREPAID_charges] - Additional prepaid charges
   * @param {string} [services.PREPAID_remarks] - Prepaid remarks
   * @param {boolean} [services.ODA] - ODA availability
   * @param {number} [services.ODA_charges] - Additional ODA charges
   * @param {string} [services.ODA_remarks] - ODA remarks
   * @param {boolean} [services.HILL] - Hill station availability
   * @param {number} [services.HILL_charges] - Additional hill charges
   * @param {string} [services.HILL_remarks] - Hill station remarks
   * @returns {Promise<Object[]>} Updated service configuration
   * @throws {Error} If zone not found or access denied
   */
  async updateZoneServices(zoneId, partnerId, services) {
    // DEPRECATED: Zone services system has been removed in Zone System v2
    // Use Pincode Types for service-based configuration instead
    logger.warn("updateZoneServices called - feature deprecated", {
      partnerId,
      zoneId,
    });
    const error = new Error(
      "Zone services feature has been deprecated. Use Pincode Types for service-based configuration.",
    );
    error.statusCode = 410; // Gone
    throw error;
  }

  /**
   * Get zone service configuration
   * @deprecated Zone services system has been removed in Zone System v2
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @throws {Error} Feature deprecated
   */
  async getZoneServices(zoneId, partnerId) {
    // DEPRECATED: Zone services system has been removed in Zone System v2
    // Use Pincode Types for service-based configuration instead
    logger.warn("getZoneServices called - feature deprecated", {
      partnerId,
      zoneId,
    });
    const error = new Error(
      "Zone services feature has been deprecated. Use Pincode Types for service-based configuration.",
    );
    error.statusCode = 410; // Gone
    throw error;
  }

  /**
   * Helper: Configure service types in transaction
   * @deprecated Zone services system has been removed in Zone System v2
   * @private
   */
  async _configureServices(zoneId, services, tx) {
    // DEPRECATED: Zone services system has been removed in Zone System v2
    // This method is kept for backward compatibility but does nothing
    logger.warn("_configureServices called - feature deprecated", { zoneId });
    return {
      servicesAdded: 0,
      availableServices: [],
      unavailableServices: [],
      deprecated: true,
    };
  }

  // ==========================================
  // VALIDATION & CACHE (2 methods)
  // ==========================================

  /**
   * Validate no zone overlaps
   * Checks if any pincodes are already assigned to another zone for this partner
   * @private
   * @param {string} zoneId - Zone UUID
   * @param {string} partnerId - Partner ID
   * @param {Object} tx - Prisma transaction client
   * @throws {Error} If zone overlap detected
   */
  async _validateZoneOverlap(zoneId, partnerId, tx) {
    // Get all pincodes for this zone
    const zonePincodes = await tx.zonePincode.findMany({
      where: { zoneId },
      select: { pincodeId: true },
    });

    if (zonePincodes.length === 0) {
      // No pincodes to validate
      return;
    }

    const pincodeIds = zonePincodes.map((zp) => zp.pincodeId);

    // Check if any of these pincodes are in other zones for this partner
    const overlaps = await tx.zonePincode.findMany({
      where: {
        pincodeId: { in: pincodeIds },
        zone: {
          partnerId,
          status: true, // Only check active zones
        },
        zoneId: { not: zoneId },
      },
      include: {
        zone: {
          select: {
            id: true,
            name: true,
          },
        },
        pincode: {
          select: {
            code: true,
          },
        },
      },
      take: 10, // Limit to first 10 overlaps for error message
    });

    if (overlaps.length > 0) {
      // Group overlaps by zone
      const overlapsByZone = overlaps.reduce((acc, overlap) => {
        const zoneName = overlap.zone.name;
        if (!acc[zoneName]) {
          acc[zoneName] = [];
        }
        acc[zoneName].push(overlap.pincode.code);
        return acc;
      }, {});

      // Build detailed error message
      const overlapDetails = Object.entries(overlapsByZone)
        .map(([zoneName, pincodes]) => {
          const displayPincodes = pincodes.slice(0, 5);
          const moreCount = pincodes.length - displayPincodes.length;
          return `Zone '${zoneName}': ${displayPincodes.join(", ")}${moreCount > 0 ? ` (and ${moreCount} more)` : ""}`;
        })
        .join(" | ");

      throw new Error(
        `Zone overlap detected - Pincodes already assigned to other zones: ${overlapDetails}`,
      );
    }
  }

  /**
   * Invalidate zone cache
   * Clears Redis cache for zone data
   * @private
   * @param {string} partnerId - Partner ID
   * @param {string} [zoneId] - Optional zone UUID to invalidate specific zone
   */
  async _invalidateZoneCache(partnerId, zoneId = null) {
    try {
      const redis = getRedisClient();
      if (!redis) {
        logger.debug("Redis not available, skipping cache invalidation");
        return;
      }

      const keysToDelete = [];

      if (zoneId) {
        // Invalidate specific zone caches (both partner-scoped and admin/all-scoped)
        keysToDelete.push(
          `${this.cachePrefix}:${partnerId}:${zoneId}`,
          `${this.cachePrefix}:${partnerId}:${zoneId}:complete`,
          // Also invalidate admin cache keys (zones:all:*)
          `${this.cachePrefix}:all:${zoneId}`,
          `${this.cachePrefix}:all:${zoneId}:complete`,
        );
      }

      // Always invalidate partner's zone list cache
      keysToDelete.push(`${this.cachePrefix}:${partnerId}:list`);

      // Also invalidate any admin list caches (pattern-based)
      const adminListKeys = await redis.keys(`${this.cachePrefix}:all:list*`);
      keysToDelete.push(...adminListKeys);

      // Delete all keys
      if (keysToDelete.length > 0) {
        await Promise.all(keysToDelete.map((key) => redis.del(key)));
      }

      logger.debug("Zone cache invalidated", {
        partnerId,
        zoneId,
        keysDeleted: keysToDelete.length,
      });
    } catch (error) {
      logger.error("Error invalidating cache", {
        error: error.message,
        partnerId,
        zoneId,
      });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }

  // ==========================================
  // BULK OPERATIONS (BONUS METHODS)
  // ==========================================

  /**
   * Delete multiple zones in bulk
   * Soft deletes zones by setting status to false
   * @param {string} partnerId - Partner ID
   * @param {string[]} zoneIds - Array of zone UUIDs
   * @returns {Promise<Object>} Bulk delete result
   * @throws {Error} If any zone not found or access denied
   */
  async bulkDeleteZones(partnerId, zoneIds) {
    try {
      logger.info("Bulk deleting zones", { partnerId, count: zoneIds.length });

      // Validate inputs
      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      if (!Array.isArray(zoneIds) || zoneIds.length === 0) {
        throw new Error("Zone IDs array is required and must not be empty");
      }

      // Verify all zones exist and belong to partner
      const zones = await prisma.zone.findMany({
        where: {
          id: { in: zoneIds },
          partnerId,
        },
        select: { id: true, name: true },
      });

      if (zones.length !== zoneIds.length) {
        const foundIds = zones.map((z) => z.id);
        const notFoundIds = zoneIds.filter((id) => !foundIds.includes(id));
        throw new Error(
          `Zones not found or access denied: ${notFoundIds.join(", ")}`,
        );
      }

      // Soft delete all zones
      const result = await prisma.zone.updateMany({
        where: {
          id: { in: zoneIds },
          partnerId,
        },
        data: {
          status: false,
          updatedAt: new Date(),
        },
      });

      // Invalidate cache
      await this._invalidateZoneCache(partnerId);

      logger.info("Zones bulk deleted successfully", {
        partnerId,
        count: result.count,
      });

      return {
        deleted: result.count,
        zoneNames: zones.map((z) => z.name),
      };
    } catch (error) {
      logger.error("Error bulk deleting zones", {
        error: error.message,
        stack: error.stack,
        partnerId,
        zoneIds,
      });
      throw error;
    }
  }

  /**
   * Get zone statistics for partner
   * Returns summary of zones, geographical coverage, and service availability
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Zone statistics
   */
  async getZoneStatistics(partnerId) {
    try {
      logger.info("Getting zone statistics", { partnerId });

      // Validate input
      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      // Get all statistics in parallel
      const [
        totalZones,
        activeZones,
        totalStates,
        totalCities,
        totalAreas,
        totalPincodes,
      ] = await Promise.all([
        prisma.zone.count({ where: { partnerId } }),
        prisma.zone.count({ where: { partnerId, status: true } }),
        prisma.zoneState.count({
          where: { zone: { partnerId } },
        }),
        prisma.zoneCity.count({
          where: { zone: { partnerId } },
        }),
        prisma.zoneArea.count({
          where: { zone: { partnerId } },
        }),
        prisma.zonePincode.count({
          where: { zone: { partnerId } },
        }),
      ]);

      // NOTE: Zone services statistics removed in Zone System v2
      // Use Pincode Types for service-based configuration instead

      const statistics = {
        zones: {
          total: totalZones,
          active: activeZones,
          inactive: totalZones - activeZones,
        },
        coverage: {
          states: totalStates,
          cities: totalCities,
          areas: totalAreas,
          pincodes: totalPincodes,
        },
        services: {
          deprecated: true,
          message: "Zone services have been replaced by Pincode Types system",
        },
        averageCoverage: {
          statesPerZone:
            activeZones > 0 ? (totalStates / activeZones).toFixed(2) : 0,
          citiesPerZone:
            activeZones > 0 ? (totalCities / activeZones).toFixed(2) : 0,
          areasPerZone:
            activeZones > 0 ? (totalAreas / activeZones).toFixed(2) : 0,
          pincodesPerZone:
            activeZones > 0 ? (totalPincodes / activeZones).toFixed(2) : 0,
        },
      };

      logger.info("Zone statistics retrieved", { partnerId, statistics });
      return statistics;
    } catch (error) {
      logger.error("Error getting zone statistics", {
        error: error.message,
        stack: error.stack,
        partnerId,
      });
      throw error;
    }
  }
}

module.exports = new ZoneService();
