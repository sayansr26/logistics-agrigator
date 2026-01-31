/**
 * Charges Type Service
 *
 * Purpose: Partner-specific charge types CRUD operations
 * Following auth-service patterns with Prisma ORM and Redis caching
 *
 * Features:
 * - Charges type CRUD operations (partner-specific)
 * - Redis caching with 1-hour TTL
 * - Partner validation (ensure partner exists)
 * - Unique constraint per partner (partnerId + name)
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

class ChargesTypeService {
  constructor() {
    this.cachePrefix = "charges_types";
    this.cacheTTL = 3600; // 1 hour
  }

  // ==========================================
  // CHARGES TYPE CRUD OPERATIONS
  // ==========================================

  /**
   * Create new charges type for a partner
   * @param {Object} data - Charges type data
   * @param {string} data.partnerId - Partner CUID
   * @param {string} data.name - Charge type name
   * @param {boolean} [data.isActive=true] - Active status
   * @param {string} [data.createdBy] - User UUID who is creating
   * @returns {Promise<Object>} Created charges type
   */
  async createChargesType(data) {
    try {
      const { partnerId, name, isActive = true, createdBy } = data;

      logger.info("Creating charges type", { partnerId, name });

      // Validate partner exists
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true },
      });

      if (!partner) {
        const error = new Error(`Partner with ID '${partnerId}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Check for existing charges type with same name for this partner
      const existingType = await prisma.chargesType.findFirst({
        where: {
          partnerId,
          name,
        },
        select: { id: true },
      });

      if (existingType) {
        const error = new Error(
          `Charges type '${name}' already exists for this partner`,
        );
        error.statusCode = 409;
        throw error;
      }

      // Create charges type
      const chargesType = await prisma.chargesType.create({
        data: {
          partnerId,
          name,
          isActive,
        },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      logger.info("Charges type created successfully", {
        id: chargesType.id,
        name: chargesType.name,
        partnerId: chargesType.partnerId,
        partnerName: chargesType.partner.name,
        createdBy,
      });

      // Invalidate cache
      await this.invalidateCache();

      return chargesType;
    } catch (error) {
      logger.error("Error creating charges type", {
        error: error.message,
        data,
      });
      throw error;
    }
  }

  /**
   * List charges types with pagination and filtering
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Paginated charges types
   */
  async getChargesTypes(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        partnerId,
        search,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = filters;

      // Check cache first
      const cacheKey = `${this.cachePrefix}:list:${JSON.stringify({
        page,
        limit,
        partnerId,
        search,
        isActive,
        sortBy,
        sortOrder,
      })}`;

      const redis = getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Cache hit for charges types list", { cacheKey });
          return JSON.parse(cached);
        }
      }

      // Build where clause
      const where = {};
      if (partnerId) {
        where.partnerId = partnerId;
      }
      if (search) {
        where.OR = [{ name: { contains: search, mode: "insensitive" } }];
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Fetch data
      const [chargesTypes, total] = await Promise.all([
        prisma.chargesType.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            partner: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        }),
        prisma.chargesType.count({ where }),
      ]);

      const result = {
        chargesTypes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };

      // Cache result
      if (redis) {
        await redis.setEx(cacheKey, this.cacheTTL, JSON.stringify(result));
      }

      logger.info("Charges types listed successfully", {
        count: chargesTypes.length,
        total,
      });

      return result;
    } catch (error) {
      logger.error("Error listing charges types", {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get charges type by ID
   * @param {string} id - Charges type UUID
   * @returns {Promise<Object>} Charges type details
   */
  async getChargesTypeById(id) {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}:${id}`;
      const redis = getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Cache hit for charges type", { id });
          return JSON.parse(cached);
        }
      }

      const chargesType = await prisma.chargesType.findUnique({
        where: { id },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!chargesType) {
        const error = new Error(`Charges type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Cache result
      if (redis) {
        await redis.setEx(cacheKey, this.cacheTTL, JSON.stringify(chargesType));
      }

      logger.info("Charges type retrieved successfully", {
        id,
        name: chargesType.name,
        partnerId: chargesType.partnerId,
      });

      return chargesType;
    } catch (error) {
      logger.error("Error getting charges type by ID", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Update charges type
   * @param {string} id - Charges type UUID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated charges type
   */
  async updateChargesType(id, updateData) {
    try {
      // Check if exists
      const existingType = await prisma.chargesType.findUnique({
        where: { id },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!existingType) {
        const error = new Error(`Charges type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Check for name conflict if name is being updated
      if (updateData.name && updateData.name !== existingType.name) {
        const nameConflict = await prisma.chargesType.findFirst({
          where: {
            partnerId: existingType.partnerId,
            name: updateData.name,
            id: { not: id },
          },
          select: { id: true },
        });

        if (nameConflict) {
          const error = new Error(
            `Charges type '${updateData.name}' already exists for this partner`,
          );
          error.statusCode = 409;
          throw error;
        }
      }

      // Update charges type
      const chargesType = await prisma.chargesType.update({
        where: { id },
        data: updateData,
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      logger.info("Charges type updated successfully", {
        id,
        name: chargesType.name,
        updateData,
      });

      // Invalidate cache
      await this.invalidateCache(id);

      return chargesType;
    } catch (error) {
      logger.error("Error updating charges type", {
        error: error.message,
        id,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Soft delete charges type (set isActive = false)
   * @param {string} id - Charges type UUID
   * @returns {Promise<Object>} Updated charges type
   */
  async deleteChargesType(id) {
    try {
      // Check if exists
      const existingType = await prisma.chargesType.findUnique({
        where: { id },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!existingType) {
        const error = new Error(`Charges type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Soft delete
      const chargesType = await prisma.chargesType.update({
        where: { id },
        data: { isActive: false },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      logger.info("Charges type soft deleted successfully", {
        id,
        name: chargesType.name,
        partnerId: chargesType.partnerId,
      });

      // Invalidate cache
      await this.invalidateCache(id);

      return chargesType;
    } catch (error) {
      logger.error("Error deleting charges type", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  /**
   * Invalidate all charges type caches
   */
  async invalidateCache(specificId = null) {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      if (specificId) {
        // Invalidate specific type cache
        await redis.del(`${this.cachePrefix}:${specificId}`);
      }

      // Invalidate list cache (pattern-based deletion)
      const keys = await redis.keys(`${this.cachePrefix}:list:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      logger.debug("Charges type cache invalidated", { specificId });
    } catch (error) {
      logger.error("Error invalidating charges type cache", {
        error: error.message,
      });
    }
  }
}

// Export singleton instance
module.exports = new ChargesTypeService();
