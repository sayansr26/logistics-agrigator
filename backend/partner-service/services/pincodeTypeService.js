/**
 * Pincode Type Service
 *
 * Purpose: Complete pincode type management with CRUD and bulk assignment operations
 * Partner-specific pincode type configuration for logistics operations
 *
 * Following auth-service patterns with Prisma ORM and Redis caching
 *
 * Features:
 * - Partner-specific Pincode Type CRUD operations
 * - Bulk pincode assignment/unassignment
 * - Many-to-many relationship (pincode can have multiple types per partner)
 * - Redis caching with 1-hour TTL (partner-aware keys)
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
   * Create pincode types for one or more partners with mandatory pincode assignment
   * @param {Object} data - Pincode type data
   * @param {string} data.name - Type name (unique per partner)
   * @param {number} data.charge - Associated charge amount
   * @param {string[]} data.partnerIds - Array of partner IDs (CUID format, min 1)
   * @param {string[]} data.pincodeCodes - Array of pincode codes (6-digit, min 1)
   * @param {string} [data.description] - Optional description
   * @param {boolean} [data.isActive=true] - Active status
   * @param {string} [data.assignedBy] - User UUID who is creating
   * @returns {Promise<Object>} Result with created types and assignment stats
   */
  async createPincodeType(data) {
    try {
      const {
        partnerIds,
        pincodeCodes,
        name,
        charge,
        description,
        isActive,
        assignedBy,
      } = data;

      logger.info("Creating pincode types for partners", {
        name,
        partnerCount: partnerIds.length,
        pincodeCount: pincodeCodes.length,
      });

      // Use transaction for atomic operation
      const result = await prisma.$transaction(async (tx) => {
        // 1. Validate all partners exist
        const partners = await tx.partner.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, displayName: true },
        });

        const foundPartnerIds = partners.map((p) => p.id);
        const missingPartnerIds = partnerIds.filter(
          (id) => !foundPartnerIds.includes(id),
        );

        if (missingPartnerIds.length > 0) {
          const error = new Error(
            `Partners not found: ${missingPartnerIds.join(", ")}`,
          );
          error.statusCode = 400;
          throw error;
        }

        // 2. Validate all pincodes exist
        const pincodes = await tx.pincode.findMany({
          where: { code: { in: pincodeCodes } },
          select: { id: true, code: true },
        });

        const foundCodes = pincodes.map((p) => p.code);
        const missingCodes = pincodeCodes.filter(
          (c) => !foundCodes.includes(c),
        );

        if (pincodes.length === 0) {
          const error = new Error(
            "None of the provided pincodes exist in the database",
          );
          error.statusCode = 400;
          throw error;
        }

        // 3. Check for existing types with same name for each partner
        const existingTypes = await tx.pincodeType.findMany({
          where: {
            partnerId: { in: partnerIds },
            name: name,
          },
          select: { partnerId: true },
        });

        if (existingTypes.length > 0) {
          const conflictingPartnerIds = existingTypes.map((t) => t.partnerId);
          const conflictingPartners = partners.filter((p) =>
            conflictingPartnerIds.includes(p.id),
          );
          const error = new Error(
            `Pincode type '${name}' already exists for partners: ${conflictingPartners.map((p) => p.displayName).join(", ")}`,
          );
          error.statusCode = 409;
          throw error;
        }

        // 4. Create pincode type for each partner
        const createdTypes = [];
        for (const partner of partners) {
          const pincodeType = await tx.pincodeType.create({
            data: {
              partnerId: partner.id,
              name: name,
              charge: charge,
              description: description || null,
              isActive: isActive !== undefined ? isActive : true,
            },
          });

          // 5. Create assignments for this type
          const assignments = pincodes.map((pincode) => ({
            pincodeId: pincode.id,
            typeId: pincodeType.id,
            assignedBy: assignedBy || null,
          }));

          const assignmentResult = await tx.pincodeTypeAssignment.createMany({
            data: assignments,
            skipDuplicates: true,
          });

          createdTypes.push({
            id: pincodeType.id,
            partnerId: partner.id,
            partnerName: partner.displayName,
            name: pincodeType.name,
            charge: pincodeType.charge,
            assignedCount: assignmentResult.count,
          });
        }

        return {
          createdTypes,
          summary: {
            totalTypesCreated: createdTypes.length,
            totalPincodesRequested: pincodeCodes.length,
            validPincodes: foundCodes.length,
            missingPincodes: missingCodes,
          },
        };
      });

      // Invalidate cache for all affected partners
      for (const partnerId of partnerIds) {
        await this._invalidateCache(null, partnerId);
      }
      // Invalidate cache for affected pincodes
      for (const code of result.summary.missingPincodes.length <
      pincodeCodes.length
        ? pincodeCodes.filter(
            (c) => !result.summary.missingPincodes.includes(c),
          )
        : []) {
        await this._invalidatePincodeCache(code);
      }

      logger.info("Pincode types created successfully", {
        typesCreated: result.createdTypes.length,
        summary: result.summary,
      });

      return result;
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
   * @param {string} [filters.partnerId] - Filter by partner ID
   * @param {string} [filters.sortBy='createdAt'] - Sort field
   * @param {string} [filters.sortOrder='desc'] - Sort order
   * @returns {Promise<Object>} Paginated list of pincode types with partner info
   */
  async getPincodeTypes(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        isActive,
        partnerId,
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

      // Filter by partner if provided
      if (partnerId) {
        where.partnerId = partnerId;
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
            partner: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
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
        partnerId,
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
   * Get pincode type by ID with statistics and partner info
   * @param {string} id - Pincode type UUID
   * @returns {Promise<Object>} Pincode type with stats and partner info
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
          partner: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
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
        partnerId: pincodeType.partnerId,
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
   * @returns {Promise<Object>} Updated pincode type with partner info
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

      // Check for name conflict if updating name (within the same partner)
      if (data.name && data.name !== existing.name) {
        const nameConflict = await prisma.pincodeType.findFirst({
          where: {
            partnerId: existing.partnerId,
            name: data.name,
            id: { not: id },
          },
        });

        if (nameConflict) {
          const error = new Error(
            `Pincode type '${data.name}' already exists for this partner`,
          );
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
          partner: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          _count: {
            select: { assignments: true },
          },
        },
      });

      // Invalidate cache
      await this._invalidateCache(id, pincodeType.partnerId);

      logger.info("Pincode type updated successfully", {
        id,
        name: pincodeType.name,
        partnerId: pincodeType.partnerId,
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
   * @returns {Promise<Object>} Deleted pincode type with partner info
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
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      });

      // Invalidate cache
      await this._invalidateCache(id, pincodeType.partnerId);

      logger.info("Pincode type soft deleted successfully", {
        id,
        name: pincodeType.name,
        partnerId: pincodeType.partnerId,
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
   * Get all types assigned to a specific pincode, optionally filtered by partner
   * @param {string} pincodeCode - 6-digit pincode code
   * @param {string} [partnerId] - Optional partner ID to filter by
   * @returns {Promise<Object>} Pincode with its assigned types
   */
  async getTypesByPincode(pincodeCode, partnerId = null) {
    try {
      // Try cache first (partner-aware key)
      const cacheKey = partnerId
        ? `${this.cachePrefix}:partner:${partnerId}:pincode:${pincodeCode}`
        : `${this.cachePrefix}:pincode:${pincodeCode}`;
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.debug("Types by pincode retrieved from cache", {
          code: pincodeCode,
          partnerId,
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

      // Build the where clause for assignments
      const assignmentWhere = { pincodeId: pincode.id };

      // Build the pincodeType filter for partner
      const pincodeTypeFilter = partnerId ? { partnerId } : undefined;

      // Get all type assignments for this pincode
      const assignments = await prisma.pincodeTypeAssignment.findMany({
        where: assignmentWhere,
        include: {
          pincodeType: {
            select: {
              id: true,
              partnerId: true,
              name: true,
              charge: true,
              description: true,
              isActive: true,
              partner: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                },
              },
            },
            where: pincodeTypeFilter,
          },
        },
        orderBy: { assignedAt: "desc" },
      });

      // Filter out null pincodeTypes (when partner filter didn't match)
      const filteredAssignments = assignments.filter((a) => a.pincodeType);

      const result = {
        pincode,
        partnerId: partnerId || null,
        types: filteredAssignments.map((a) => ({
          ...a.pincodeType,
          assignedAt: a.assignedAt,
        })),
        activeTypes: filteredAssignments
          .filter((a) => a.pincodeType.isActive)
          .map((a) => a.pincodeType),
        totalCharge: filteredAssignments
          .filter((a) => a.pincodeType.isActive)
          .reduce((sum, a) => sum + parseFloat(a.pincodeType.charge), 0),
      };

      // Cache the result
      await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(result));

      logger.info("Retrieved types by pincode", {
        code: pincodeCode,
        partnerId,
        typeCount: result.types.length,
      });

      return result;
    } catch (error) {
      logger.error("Error retrieving types by pincode", {
        error: error.message,
        pincodeCode,
        partnerId,
      });
      throw error;
    }
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  /**
   * Invalidate cache for pincode types (partner-aware)
   * @private
   * @param {string} [typeId] - Specific type ID to invalidate
   * @param {string} [partnerId] - Partner ID for partner-specific cache invalidation
   */
  async _invalidateCache(typeId = null, partnerId = null) {
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

      // Invalidate partner-specific caches
      if (partnerId) {
        const partnerKeys = await redis.keys(
          `${this.cachePrefix}:partner:${partnerId}:*`,
        );
        if (partnerKeys.length > 0) {
          await redis.del(...partnerKeys);
        }
      }

      logger.debug("Pincode type cache invalidated", { typeId, partnerId });
    } catch (error) {
      logger.warn("Failed to invalidate pincode type cache", {
        error: error.message,
        typeId,
        partnerId,
      });
    }
  }

  /**
   * Invalidate cache for a specific pincode's types (all partners and global)
   * @private
   * @param {string} pincodeCode - Pincode code
   */
  async _invalidatePincodeCache(pincodeCode) {
    try {
      const redis = getRedisClient();

      // Invalidate global pincode cache
      await redis.del(`${this.cachePrefix}:pincode:${pincodeCode}`);

      // Invalidate all partner-specific pincode caches
      const partnerKeys = await redis.keys(
        `${this.cachePrefix}:partner:*:pincode:${pincodeCode}`,
      );
      if (partnerKeys.length > 0) {
        await redis.del(...partnerKeys);
      }

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
