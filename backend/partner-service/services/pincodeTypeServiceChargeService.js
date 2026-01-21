/**
 * Pincode Type Service Charge Service
 *
 * Purpose: Manage service charges for pincode type and partner combinations
 * Following auth-service patterns with Prisma ORM and Redis caching
 *
 * Features:
 * - Create service charges for pincode type x partner combinations
 * - Bulk creation support (multiple types x multiple partners)
 * - CRUD operations with soft delete
 * - Redis caching with 1-hour TTL
 * - Transaction support for bulk operations
 * - Comprehensive audit logging
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

class PincodeTypeServiceChargeService {
  constructor() {
    this.cachePrefix = "pincode_type_service_charges";
    this.cacheTTL = 3600; // 1 hour
  }

  // ==========================================
  // CHARGE CRUD OPERATIONS
  // ==========================================

  /**
   * Create service charges for pincode type and partner combinations
   * Supports bulk creation: multiple pincode types x multiple partners
   * @param {Object} data - Charge data
   * @param {string[]} data.pincodeTypeIds - Array of pincode type UUIDs
   * @param {string[]} data.partnerIds - Array of partner CUIDs
   * @param {number} data.baseCharge - Base charge amount
   * @param {boolean} [data.isActive=true] - Active status
   * @returns {Promise<Object>} Result with created charges
   */
  async createCharge(data) {
    try {
      const { pincodeTypeIds, partnerIds, baseCharge, isActive } = data;

      logger.info("Creating pincode type service charges", {
        pincodeTypeCount: pincodeTypeIds.length,
        partnerCount: partnerIds.length,
        baseCharge,
      });

      // Use transaction for atomic operation
      const result = await prisma.$transaction(async (tx) => {
        // 1. Validate all pincode types exist
        const pincodeTypes = await tx.pincodeType.findMany({
          where: { id: { in: pincodeTypeIds } },
          select: { id: true, name: true },
        });

        const foundTypeIds = pincodeTypes.map((pt) => pt.id);
        const missingTypeIds = pincodeTypeIds.filter(
          (id) => !foundTypeIds.includes(id),
        );

        if (pincodeTypes.length === 0) {
          const error = new Error(
            "None of the provided pincode types exist in the database",
          );
          error.statusCode = 400;
          throw error;
        }

        // 2. Validate all partners exist
        const partners = await tx.partner.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, code: true },
        });

        const foundPartnerIds = partners.map((p) => p.id);
        const missingPartnerIds = partnerIds.filter(
          (id) => !foundPartnerIds.includes(id),
        );

        if (partners.length === 0) {
          const error = new Error(
            "None of the provided partners exist in the database",
          );
          error.statusCode = 400;
          throw error;
        }

        // 3. Create all combinations (Cartesian product)
        const combinations = [];
        for (const pincodeTypeId of foundTypeIds) {
          for (const partnerId of foundPartnerIds) {
            combinations.push({ pincodeTypeId, partnerId });
          }
        }

        // 4. Check for existing charges and filter them out
        const existingCharges = await tx.pincodeTypeServiceCharge.findMany({
          where: {
            OR: combinations.map((c) => ({
              pincodeTypeId: c.pincodeTypeId,
              partnerId: c.partnerId,
            })),
          },
          select: {
            pincodeTypeId: true,
            partnerId: true,
          },
        });

        const existingKeys = new Set(
          existingCharges.map((ec) => `${ec.pincodeTypeId}-${ec.partnerId}`),
        );

        const newCombinations = combinations.filter(
          (c) => !existingKeys.has(`${c.pincodeTypeId}-${c.partnerId}`),
        );

        if (newCombinations.length === 0) {
          const error = new Error(
            "All charge combinations already exist. No new charges created.",
          );
          error.statusCode = 409;
          throw error;
        }

        // 5. Create new charges
        const charges = await tx.pincodeTypeServiceCharge.createMany({
          data: newCombinations.map((c) => ({
            pincodeTypeId: c.pincodeTypeId,
            partnerId: c.partnerId,
            baseCharge: baseCharge,
            isActive: isActive !== undefined ? isActive : true,
          })),
        });

        return {
          createdCount: charges.count,
          totalCombinations: combinations.length,
          skippedExisting: combinations.length - newCombinations.length,
          charges: newCombinations.map((c) => ({
            pincodeTypeId: c.pincodeTypeId,
            partnerId: c.partnerId,
            baseCharge: baseCharge.toString(),
          })),
          summary: {
            validPincodeTypes: foundTypeIds.length,
            validPartners: foundPartnerIds.length,
            missingPincodeTypes: missingTypeIds,
            missingPartners: missingPartnerIds,
          },
        };
      });

      // Invalidate cache
      await this._invalidateCache();

      logger.info("Service charges created successfully", {
        createdCount: result.createdCount,
      });

      return result;
    } catch (error) {
      logger.error("Error creating service charges", {
        error: error.message,
        data,
      });
      throw error;
    }
  }

  /**
   * Get all service charges with filtering and pagination
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Paginated list of charges
   */
  async getCharges(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        pincodeTypeId,
        partnerId,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = filters;

      // Build where clause
      const where = {};

      if (pincodeTypeId) {
        where.pincodeTypeId = pincodeTypeId;
      }

      if (partnerId) {
        where.partnerId = partnerId;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute queries in parallel
      const [charges, total] = await Promise.all([
        prisma.pincodeTypeServiceCharge.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
          include: {
            pincodeType: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            partner: {
              select: {
                id: true,
                name: true,
                code: true,
                displayName: true,
              },
            },
          },
        }),
        prisma.pincodeTypeServiceCharge.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      logger.info("Retrieved service charges", {
        count: charges.length,
        total,
        page,
      });

      return {
        charges: charges.map((charge) => ({
          id: charge.id,
          pincodeType: charge.pincodeType,
          partner: charge.partner,
          baseCharge: parseFloat(charge.baseCharge),
          isActive: charge.isActive,
          createdAt: charge.createdAt,
          updatedAt: charge.updatedAt,
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
      logger.error("Error retrieving service charges", {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get service charge by ID
   * @param {string} id - Charge UUID
   * @returns {Promise<Object>} Service charge
   */
  async getChargeById(id) {
    try {
      const charge = await prisma.pincodeTypeServiceCharge.findUnique({
        where: { id },
        include: {
          pincodeType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
              displayName: true,
            },
          },
        },
      });

      if (!charge) {
        const error = new Error(`Service charge with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      logger.info("Retrieved service charge by ID", {
        id,
        pincodeType: charge.pincodeType?.name,
        partner: charge.partner?.name,
      });

      return {
        id: charge.id,
        pincodeType: charge.pincodeType,
        partner: charge.partner,
        baseCharge: parseFloat(charge.baseCharge),
        isActive: charge.isActive,
        createdAt: charge.createdAt,
        updatedAt: charge.updatedAt,
      };
    } catch (error) {
      logger.error("Error retrieving service charge by ID", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Update an existing service charge
   * @param {string} id - Charge UUID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated service charge
   */
  async updateCharge(id, data) {
    try {
      logger.info("Updating service charge", { id, data });

      // Check if charge exists
      const existing = await prisma.pincodeTypeServiceCharge.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Service charge with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Prepare update data
      const updateData = {};
      if (data.baseCharge !== undefined) {
        updateData.baseCharge = data.baseCharge;
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      // Update the charge
      const charge = await prisma.pincodeTypeServiceCharge.update({
        where: { id },
        data: updateData,
        include: {
          pincodeType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
              displayName: true,
            },
          },
        },
      });

      // Invalidate cache
      await this._invalidateCache();

      logger.info("Service charge updated successfully", {
        id,
        baseCharge: charge.baseCharge,
      });

      return {
        id: charge.id,
        pincodeType: charge.pincodeType,
        partner: charge.partner,
        baseCharge: parseFloat(charge.baseCharge),
        isActive: charge.isActive,
        createdAt: charge.createdAt,
        updatedAt: charge.updatedAt,
      };
    } catch (error) {
      logger.error("Error updating service charge", {
        error: error.message,
        id,
        data,
      });
      throw error;
    }
  }

  /**
   * Soft delete service charge (set isActive = false)
   * @param {string} id - Charge UUID
   * @returns {Promise<Object>} Deleted service charge
   */
  async deleteCharge(id) {
    try {
      logger.info("Soft deleting service charge", { id });

      // Check if charge exists
      const existing = await prisma.pincodeTypeServiceCharge.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Service charge with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Soft delete by setting isActive = false
      const charge = await prisma.pincodeTypeServiceCharge.update({
        where: { id },
        data: { isActive: false },
        include: {
          pincodeType: {
            select: {
              id: true,
              name: true,
            },
          },
          partner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Invalidate cache
      await this._invalidateCache();

      logger.info("Service charge soft deleted successfully", {
        id,
        pincodeType: charge.pincodeType?.name,
        partner: charge.partner?.name,
      });

      return {
        id: charge.id,
        pincodeType: charge.pincodeType,
        partner: charge.partner,
        baseCharge: parseFloat(charge.baseCharge),
        isActive: charge.isActive,
        createdAt: charge.createdAt,
        updatedAt: charge.updatedAt,
      };
    } catch (error) {
      logger.error("Error deleting service charge", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Get charges by pincode type
   * @param {string} pincodeTypeId - Pincode type UUID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} List of charges for the pincode type
   */
  async getChargesByPincodeType(pincodeTypeId, filters = {}) {
    try {
      // Validate pincode type exists
      const pincodeType = await prisma.pincodeType.findUnique({
        where: { id: pincodeTypeId },
      });

      if (!pincodeType) {
        const error = new Error(
          `Pincode type with ID '${pincodeTypeId}' not found`,
        );
        error.statusCode = 404;
        throw error;
      }

      const { isActive } = filters;

      const where = { pincodeTypeId };
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const charges = await prisma.pincodeTypeServiceCharge.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              code: true,
              displayName: true,
            },
          },
        },
      });

      logger.info("Retrieved charges by pincode type", {
        pincodeTypeId,
        count: charges.length,
      });

      return {
        pincodeType: {
          id: pincodeType.id,
          name: pincodeType.name,
          description: pincodeType.description,
        },
        charges: charges.map((charge) => ({
          id: charge.id,
          partner: charge.partner,
          baseCharge: parseFloat(charge.baseCharge),
          isActive: charge.isActive,
          createdAt: charge.createdAt,
          updatedAt: charge.updatedAt,
        })),
      };
    } catch (error) {
      logger.error("Error retrieving charges by pincode type", {
        error: error.message,
        pincodeTypeId,
      });
      throw error;
    }
  }

  /**
   * Get charges by partner
   * @param {string} partnerId - Partner CUID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} List of charges for the partner
   */
  async getChargesByPartner(partnerId, filters = {}) {
    try {
      // Validate partner exists
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
      });

      if (!partner) {
        const error = new Error(`Partner with ID '${partnerId}' not found`);
        error.statusCode = 404;
        throw error;
      }

      const { isActive } = filters;

      const where = { partnerId };
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const charges = await prisma.pincodeTypeServiceCharge.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          pincodeType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      logger.info("Retrieved charges by partner", {
        partnerId,
        count: charges.length,
      });

      return {
        partner: {
          id: partner.id,
          name: partner.name,
          code: partner.code,
          displayName: partner.displayName,
        },
        charges: charges.map((charge) => ({
          id: charge.id,
          pincodeType: charge.pincodeType,
          baseCharge: parseFloat(charge.baseCharge),
          isActive: charge.isActive,
          createdAt: charge.createdAt,
          updatedAt: charge.updatedAt,
        })),
      };
    } catch (error) {
      logger.error("Error retrieving charges by partner", {
        error: error.message,
        partnerId,
      });
      throw error;
    }
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  /**
   * Invalidate cache for service charges
   * @private
   */
  async _invalidateCache() {
    try {
      const redis = getRedisClient();

      // Invalidate all charge-related caches
      const keys = await redis.keys(`${this.cachePrefix}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      logger.debug("Service charge cache invalidated");
    } catch (error) {
      logger.warn("Failed to invalidate service charge cache", {
        error: error.message,
      });
    }
  }
}

module.exports = new PincodeTypeServiceChargeService();
