/**
 * Pincode Type Service (Simplified)
 *
 * Purpose: Pincode type CRUD operations
 * Following auth-service patterns with Prisma ORM and Redis caching
 *
 * Features:
 * - Pincode type CRUD operations
 * - Redis caching with 1-hour TTL
 * - Type validation ("yes_no" or "number")
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

class PincodeTypeService {
  constructor() {
    this.cachePrefix = "pincode_types";
    this.cacheTTL = 3600; // 1 hour
  }

  // ==========================================
  // PINCODE TYPE CRUD OPERATIONS
  // ==========================================

  /**
   * Create new pincode type
   * @param {Object} data - Pincode type data
   * @param {string} data.name - Type name (globally unique)
   * @param {string} data.type - Type: "yes_no" or "number"
   * @param {boolean} [data.isActive=true] - Active status
   * @param {string} [data.createdBy] - User UUID who is creating
   * @returns {Promise<Object>} Created pincode type
   */
  async createPincodeType(data) {
    try {
      const { name, type, isActive = true, createdBy } = data;

      logger.info("Creating pincode type", { name, type });

      // Validate type enum
      if (!["yes_no", "number"].includes(type)) {
        const error = new Error("Type must be 'yes_no' or 'number'");
        error.statusCode = 400;
        throw error;
      }

      // Check for existing type with same name
      const existingType = await prisma.pincodeType.findFirst({
        where: { name },
        select: { id: true },
      });

      if (existingType) {
        const error = new Error(`Pincode type '${name}' already exists`);
        error.statusCode = 409;
        throw error;
      }

      // Create pincode type
      const pincodeType = await prisma.pincodeType.create({
        data: {
          name,
          type,
          isActive,
        },
      });

      logger.info("Pincode type created successfully", {
        id: pincodeType.id,
        name: pincodeType.name,
        type: pincodeType.type,
        createdBy,
      });

      // Invalidate cache
      await this.invalidateCache();

      return pincodeType;
    } catch (error) {
      logger.error("Error creating pincode type", {
        error: error.message,
        data,
      });
      throw error;
    }
  }

  /**
   * List pincode types with pagination and filtering
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Paginated pincode types
   */
  async getPincodeTypes(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = filters;

      // Check cache first
      const cacheKey = `${this.cachePrefix}:list:${JSON.stringify({
        page,
        limit,
        search,
        isActive,
        sortBy,
        sortOrder,
      })}`;

      const redis = getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Cache hit for pincode types list", { cacheKey });
          return JSON.parse(cached);
        }
      }

      // Build where clause
      const where = {};
      if (search) {
        where.OR = [{ name: { contains: search, mode: "insensitive" } }];
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Fetch data
      const [pincodeTypes, total] = await Promise.all([
        prisma.pincodeType.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.pincodeType.count({ where }),
      ]);

      const result = {
        pincodeTypes,
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

      logger.info("Pincode types listed successfully", {
        count: pincodeTypes.length,
        total,
      });

      return result;
    } catch (error) {
      logger.error("Error listing pincode types", {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get pincode type by ID
   * @param {string} id - Pincode type UUID
   * @returns {Promise<Object>} Pincode type details
   */
  async getPincodeTypeById(id) {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}:${id}`;
      const redis = getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug("Cache hit for pincode type", { id });
          return JSON.parse(cached);
        }
      }

      const pincodeType = await prisma.pincodeType.findUnique({
        where: { id },
      });

      if (!pincodeType) {
        const error = new Error(`Pincode type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Cache result
      if (redis) {
        await redis.setEx(cacheKey, this.cacheTTL, JSON.stringify(pincodeType));
      }

      logger.info("Pincode type retrieved successfully", {
        id,
        name: pincodeType.name,
      });

      return pincodeType;
    } catch (error) {
      logger.error("Error getting pincode type by ID", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Update pincode type
   * @param {string} id - Pincode type UUID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated pincode type
   */
  async updatePincodeType(id, updateData) {
    try {
      // Validate type if provided
      if (updateData.type && !["yes_no", "number"].includes(updateData.type)) {
        const error = new Error("Type must be 'yes_no' or 'number'");
        error.statusCode = 400;
        throw error;
      }

      // Check if exists
      const existingType = await prisma.pincodeType.findUnique({
        where: { id },
      });

      if (!existingType) {
        const error = new Error(`Pincode type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Check for name conflict if name is being updated
      if (updateData.name && updateData.name !== existingType.name) {
        const nameConflict = await prisma.pincodeType.findFirst({
          where: {
            name: updateData.name,
            id: { not: id },
          },
          select: { id: true },
        });

        if (nameConflict) {
          const error = new Error(
            `Pincode type '${updateData.name}' already exists`,
          );
          error.statusCode = 409;
          throw error;
        }
      }

      // Update pincode type
      const pincodeType = await prisma.pincodeType.update({
        where: { id },
        data: updateData,
      });

      logger.info("Pincode type updated successfully", {
        id,
        name: pincodeType.name,
        updateData,
      });

      // Invalidate cache
      await this.invalidateCache(id);

      return pincodeType;
    } catch (error) {
      logger.error("Error updating pincode type", {
        error: error.message,
        id,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Soft delete pincode type (set isActive = false)
   * @param {string} id - Pincode type UUID
   * @returns {Promise<Object>} Updated pincode type
   */
  async deletePincodeType(id) {
    try {
      // Check if exists
      const existingType = await prisma.pincodeType.findUnique({
        where: { id },
      });

      if (!existingType) {
        const error = new Error(`Pincode type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Soft delete
      const pincodeType = await prisma.pincodeType.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info("Pincode type soft deleted successfully", {
        id,
        name: pincodeType.name,
      });

      // Invalidate cache
      await this.invalidateCache(id);

      return pincodeType;
    } catch (error) {
      logger.error("Error deleting pincode type", {
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
   * Invalidate all pincode type caches
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

      logger.debug("Pincode type cache invalidated", { specificId });
    } catch (error) {
      logger.error("Error invalidating pincode type cache", {
        error: error.message,
      });
    }
  }
}

// Export singleton instance
module.exports = new PincodeTypeService();
