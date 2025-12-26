/**
 * Pincode Type Service
 *
 * Purpose: Complete pincode type management with CRUD and bulk assignment operations
 * Global/Admin-managed pincode type configuration for logistics operations
 *
 * Following auth-service patterns with Prisma ORM and Redis caching
 *
 * Features:
 * - Pincode Type CRUD operations
 * - Bulk pincode assignment/unassignment
 * - Many-to-many relationship (pincode can have multiple types)
 * - Redis caching with 1-hour TTL
 * - Transaction support for bulk operations
 * - Comprehensive audit logging
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
   * Create a new pincode type
   * @param {Object} data - Pincode type data
   * @param {string} data.name - Unique type name
   * @param {number} data.charge - Associated charge amount
   * @param {string} [data.description] - Optional description
   * @param {boolean} [data.isActive=true] - Active status
   * @returns {Promise<Object>} Created pincode type
   */
  async createPincodeType(data) {
    try {
      logger.info("Creating pincode type", { name: data.name });

      // Check for existing type with same name
      const existing = await prisma.pincodeType.findUnique({
        where: { name: data.name },
      });

      if (existing) {
        const error = new Error(`Pincode type '${data.name}' already exists`);
        error.statusCode = 409;
        throw error;
      }

      // Create the pincode type
      const pincodeType = await prisma.pincodeType.create({
        data: {
          name: data.name,
          charge: data.charge,
          description: data.description || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });

      // Invalidate cache
      await this._invalidateCache();

      logger.info("Pincode type created successfully", {
        id: pincodeType.id,
        name: pincodeType.name,
      });

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
   * Get all pincode types with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=20] - Items per page
   * @param {string} [filters.search] - Search by name
   * @param {boolean} [filters.isActive] - Filter by active status
   * @param {string} [filters.sortBy='createdAt'] - Sort field
   * @param {string} [filters.sortOrder='desc'] - Sort order
   * @returns {Promise<Object>} Paginated list of pincode types
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

      // Build where clause
      const where = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute queries in parallel
      const [pincodeTypes, total] = await Promise.all([
        prisma.pincodeType.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
          include: {
            _count: {
              select: { assignments: true },
            },
          },
        }),
        prisma.pincodeType.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info("Retrieved pincode types", {
        count: pincodeTypes.length,
        total,
        page,
      });

      return {
        pincodeTypes: pincodeTypes.map((pt) => ({
          ...pt,
          assignedPincodeCount: pt._count.assignments,
          _count: undefined,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error retrieving pincode types", {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get pincode type by ID with statistics
   * @param {string} id - Pincode type UUID
   * @returns {Promise<Object>} Pincode type with stats
   */
  async getPincodeTypeById(id) {
    try {
      // Try cache first
      const cacheKey = `${this.cachePrefix}:${id}`;
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.debug("Pincode type retrieved from cache", { id });
        return JSON.parse(cached);
      }

      // Fetch from database
      const pincodeType = await prisma.pincodeType.findUnique({
        where: { id },
        include: {
          _count: {
            select: { assignments: true },
          },
        },
      });

      if (!pincodeType) {
        const error = new Error(`Pincode type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      const result = {
        ...pincodeType,
        assignedPincodeCount: pincodeType._count.assignments,
        _count: undefined,
      };

      // Cache the result
      await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(result));

      logger.info("Retrieved pincode type by ID", {
        id,
        name: pincodeType.name,
      });

      return result;
    } catch (error) {
      logger.error("Error retrieving pincode type by ID", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Update an existing pincode type
   * @param {string} id - Pincode type UUID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated pincode type
   */
  async updatePincodeType(id, data) {
    try {
      logger.info("Updating pincode type", { id, data });

      // Check if type exists
      const existing = await prisma.pincodeType.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Pincode type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Check for name conflict if updating name
      if (data.name && data.name !== existing.name) {
        const nameConflict = await prisma.pincodeType.findUnique({
          where: { name: data.name },
        });

        if (nameConflict) {
          const error = new Error(`Pincode type '${data.name}' already exists`);
          error.statusCode = 409;
          throw error;
        }
      }

      // Prepare update data
      const updateData = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.charge !== undefined) updateData.charge = data.charge;
      if (data.description !== undefined)
        updateData.description = data.description || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      // Update the pincode type
      const pincodeType = await prisma.pincodeType.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: { assignments: true },
          },
        },
      });

      // Invalidate cache
      await this._invalidateCache(id);

      logger.info("Pincode type updated successfully", {
        id,
        name: pincodeType.name,
      });

      return {
        ...pincodeType,
        assignedPincodeCount: pincodeType._count.assignments,
        _count: undefined,
      };
    } catch (error) {
      logger.error("Error updating pincode type", {
        error: error.message,
        id,
        data,
      });
      throw error;
    }
  }

  /**
   * Soft delete pincode type (set isActive = false)
   * @param {string} id - Pincode type UUID
   * @returns {Promise<Object>} Deleted pincode type
   */
  async deletePincodeType(id) {
    try {
      logger.info("Soft deleting pincode type", { id });

      // Check if type exists
      const existing = await prisma.pincodeType.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Pincode type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Soft delete by setting isActive = false
      const pincodeType = await prisma.pincodeType.update({
        where: { id },
        data: { isActive: false },
      });

      // Invalidate cache
      await this._invalidateCache(id);

      logger.info("Pincode type soft deleted successfully", {
        id,
        name: pincodeType.name,
      });

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
  // PINCODE ASSIGNMENT OPERATIONS
  // ==========================================

  /**
   * Bulk assign pincodes to a type
   * @param {string} typeId - Pincode type UUID
   * @param {string[]} pincodeCodes - Array of 6-digit pincode codes
   * @param {string} [assignedBy] - User UUID who is assigning
   * @returns {Promise<Object>} Assignment result with stats
   */
  async assignPincodesToType(typeId, pincodeCodes, assignedBy = null) {
    try {
      logger.info("Assigning pincodes to type", {
        typeId,
        pincodeCount: pincodeCodes.length,
      });

      // Validate type exists and is active
      const pincodeType = await prisma.pincodeType.findUnique({
        where: { id: typeId },
      });

      if (!pincodeType) {
        const error = new Error(`Pincode type with ID '${typeId}' not found`);
        error.statusCode = 404;
        throw error;
      }

      if (!pincodeType.isActive) {
        const error = new Error(
          "Cannot assign pincodes to inactive pincode type",
        );
        error.statusCode = 400;
        throw error;
      }

      // Find all valid pincodes
      const pincodes = await prisma.pincode.findMany({
        where: { code: { in: pincodeCodes } },
        select: { id: true, code: true },
      });

      const foundCodes = pincodes.map((p) => p.code);
      const missingCodes = pincodeCodes.filter((c) => !foundCodes.includes(c));

      if (
        missingCodes.length > 0 &&
        missingCodes.length === pincodeCodes.length
      ) {
        const error = new Error(
          `None of the provided pincodes exist in the database`,
        );
        error.statusCode = 400;
        throw error;
      }

      // Use transaction for atomic operation
      const result = await prisma.$transaction(async (tx) => {
        // Create assignments (skip duplicates)
        const assignments = pincodes.map((pincode) => ({
          pincodeId: pincode.id,
          typeId,
          assignedBy,
        }));

        const created = await tx.pincodeTypeAssignment.createMany({
          data: assignments,
          skipDuplicates: true,
        });

        return {
          assignedCount: created.count,
          totalRequested: pincodeCodes.length,
          validPincodes: foundCodes.length,
          skippedDuplicates: foundCodes.length - created.count,
          missingPincodes: missingCodes,
        };
      });

      // Invalidate cache
      await this._invalidateCache(typeId);
      // Also invalidate cache for affected pincodes
      for (const code of foundCodes) {
        await this._invalidatePincodeCache(code);
      }

      logger.info("Pincodes assigned to type successfully", {
        typeId,
        result,
      });

      return result;
    } catch (error) {
      logger.error("Error assigning pincodes to type", {
        error: error.message,
        typeId,
        pincodeCount: pincodeCodes.length,
      });
      throw error;
    }
  }

  /**
   * Bulk unassign pincodes from a type
   * @param {string} typeId - Pincode type UUID
   * @param {string[]} pincodeCodes - Array of 6-digit pincode codes
   * @returns {Promise<Object>} Unassignment result with stats
   */
  async unassignPincodesFromType(typeId, pincodeCodes) {
    try {
      logger.info("Unassigning pincodes from type", {
        typeId,
        pincodeCount: pincodeCodes.length,
      });

      // Validate type exists
      const pincodeType = await prisma.pincodeType.findUnique({
        where: { id: typeId },
      });

      if (!pincodeType) {
        const error = new Error(`Pincode type with ID '${typeId}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Find all valid pincodes
      const pincodes = await prisma.pincode.findMany({
        where: { code: { in: pincodeCodes } },
        select: { id: true, code: true },
      });

      const pincodeIds = pincodes.map((p) => p.id);
      const foundCodes = pincodes.map((p) => p.code);

      if (pincodeIds.length === 0) {
        return {
          unassignedCount: 0,
          totalRequested: pincodeCodes.length,
          message: "No valid pincodes found to unassign",
        };
      }

      // Delete assignments
      const deleted = await prisma.pincodeTypeAssignment.deleteMany({
        where: {
          typeId,
          pincodeId: { in: pincodeIds },
        },
      });

      // Invalidate cache
      await this._invalidateCache(typeId);
      for (const code of foundCodes) {
        await this._invalidatePincodeCache(code);
      }

      logger.info("Pincodes unassigned from type successfully", {
        typeId,
        unassignedCount: deleted.count,
      });

      return {
        unassignedCount: deleted.count,
        totalRequested: pincodeCodes.length,
        validPincodes: foundCodes.length,
      };
    } catch (error) {
      logger.error("Error unassigning pincodes from type", {
        error: error.message,
        typeId,
        pincodeCount: pincodeCodes.length,
      });
      throw error;
    }
  }

  /**
   * Get pincodes assigned to a type with pagination
   * @param {string} typeId - Pincode type UUID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Paginated list of assigned pincodes
   */
  async getPincodesByType(typeId, filters = {}) {
    try {
      const { page = 1, limit = 100, search } = filters;

      // Validate type exists
      const pincodeType = await prisma.pincodeType.findUnique({
        where: { id: typeId },
      });

      if (!pincodeType) {
        const error = new Error(`Pincode type with ID '${typeId}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Build where clause
      const where = { typeId };

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Build pincode filter for search
      const pincodeWhere = search ? { code: { contains: search } } : undefined;

      // Execute queries in parallel
      const [assignments, total] = await Promise.all([
        prisma.pincodeTypeAssignment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { assignedAt: "desc" },
          include: {
            pincode: {
              select: {
                id: true,
                code: true,
                areaName: true,
                district: true,
                status: true,
                state: {
                  select: { id: true, name: true, code: true },
                },
              },
              where: pincodeWhere,
            },
          },
        }),
        prisma.pincodeTypeAssignment.count({ where }),
      ]);

      // Filter out null pincodes (from search that didn't match)
      const filteredAssignments = assignments.filter((a) => a.pincode);

      const totalPages = Math.ceil(total / limit);

      logger.info("Retrieved pincodes by type", {
        typeId,
        count: filteredAssignments.length,
        total,
      });

      return {
        pincodeType: {
          id: pincodeType.id,
          name: pincodeType.name,
          charge: pincodeType.charge,
        },
        pincodes: filteredAssignments.map((a) => ({
          ...a.pincode,
          assignedAt: a.assignedAt,
          assignedBy: a.assignedBy,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error retrieving pincodes by type", {
        error: error.message,
        typeId,
      });
      throw error;
    }
  }

  /**
   * Get all types assigned to a specific pincode
   * @param {string} pincodeCode - 6-digit pincode code
   * @returns {Promise<Object>} Pincode with its assigned types
   */
  async getTypesByPincode(pincodeCode) {
    try {
      // Try cache first
      const cacheKey = `${this.cachePrefix}:pincode:${pincodeCode}`;
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.debug("Types by pincode retrieved from cache", {
          code: pincodeCode,
        });
        return JSON.parse(cached);
      }

      // Find the pincode
      const pincode = await prisma.pincode.findUnique({
        where: { code: pincodeCode },
        select: {
          id: true,
          code: true,
          areaName: true,
          district: true,
          status: true,
          state: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      if (!pincode) {
        const error = new Error(`Pincode '${pincodeCode}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Get all type assignments for this pincode
      const assignments = await prisma.pincodeTypeAssignment.findMany({
        where: { pincodeId: pincode.id },
        include: {
          pincodeType: {
            select: {
              id: true,
              name: true,
              charge: true,
              description: true,
              isActive: true,
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      });

      const result = {
        pincode,
        types: assignments.map((a) => ({
          ...a.pincodeType,
          assignedAt: a.assignedAt,
        })),
        activeTypes: assignments
          .filter((a) => a.pincodeType.isActive)
          .map((a) => a.pincodeType),
        totalCharge: assignments
          .filter((a) => a.pincodeType.isActive)
          .reduce((sum, a) => sum + parseFloat(a.pincodeType.charge), 0),
      };

      // Cache the result
      await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(result));

      logger.info("Retrieved types by pincode", {
        code: pincodeCode,
        typeCount: result.types.length,
      });

      return result;
    } catch (error) {
      logger.error("Error retrieving types by pincode", {
        error: error.message,
        pincodeCode,
      });
      throw error;
    }
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  /**
   * Invalidate cache for pincode types
   * @private
   * @param {string} [typeId] - Specific type ID to invalidate
   */
  async _invalidateCache(typeId = null) {
    try {
      const redis = getRedisClient();

      if (typeId) {
        // Invalidate specific type cache
        await redis.del(`${this.cachePrefix}:${typeId}`);
      }

      // Invalidate list cache
      const keys = await redis.keys(`${this.cachePrefix}:list:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      logger.debug("Pincode type cache invalidated", { typeId });
    } catch (error) {
      logger.warn("Failed to invalidate pincode type cache", {
        error: error.message,
        typeId,
      });
    }
  }

  /**
   * Invalidate cache for a specific pincode's types
   * @private
   * @param {string} pincodeCode - Pincode code
   */
  async _invalidatePincodeCache(pincodeCode) {
    try {
      const redis = getRedisClient();
      await redis.del(`${this.cachePrefix}:pincode:${pincodeCode}`);
      logger.debug("Pincode types cache invalidated", { pincodeCode });
    } catch (error) {
      logger.warn("Failed to invalidate pincode cache", {
        error: error.message,
        pincodeCode,
      });
    }
  }
}

module.exports = new PincodeTypeService();
