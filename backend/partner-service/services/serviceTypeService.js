/**
 * Service Type Management Service
 * Handles business logic for logistics service type operations
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");

class ServiceTypeService {
  /**
   * Create a new service type
   * @param {Object} serviceTypeData - Service type data
   * @returns {Promise<Object>} Created service type
   */
  async createServiceType(serviceTypeData) {
    try {
      logger.info("Creating new service type", { name: serviceTypeData.name });

      // Check if service type already exists
      const existing = await prisma.serviceType.findUnique({
        where: { name: serviceTypeData.name.toUpperCase() },
      });

      if (existing) {
        const error = new Error(
          `Service type '${serviceTypeData.name}' already exists`,
        );
        error.statusCode = 409;
        throw error;
      }

      // Create the service type
      const serviceType = await prisma.serviceType.create({
        data: {
          name: serviceTypeData.name.toUpperCase(),
          displayName: serviceTypeData.displayName,
          description: serviceTypeData.description || null,
          category: serviceTypeData.category,
          isAvailable:
            serviceTypeData.isAvailable !== undefined
              ? serviceTypeData.isAvailable
              : true,
          baseCharge: serviceTypeData.baseCharge || "0",
          sortOrder: serviceTypeData.sortOrder || 100,
          additionalInfo: serviceTypeData.additionalInfo || {},
        },
      });

      logger.info("Service type created successfully", {
        id: serviceType.id,
        name: serviceType.name,
      });

      return serviceType;
    } catch (error) {
      logger.error("Error creating service type", {
        error: error.message,
        data: serviceTypeData,
      });
      throw error;
    }
  }

  /**
   * Get all service types with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Paginated service types result
   */
  async getServiceTypes(filters = {}) {
    try {
      const {
        search,
        category,
        status = "ACTIVE",
        page = 1,
        limit = 20,
        sortBy = "sortOrder",
        sortOrder = "asc",
      } = filters;

      // Parse pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      // Build where clause
      const whereClause = {};

      // Status filter - map ACTIVE/INACTIVE to isAvailable boolean
      if (status && status !== "ALL") {
        whereClause.isAvailable = status === "ACTIVE";
      }

      // Category filter
      if (category) {
        whereClause.category = category;
      }

      // Search filter
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { displayName: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Calculate pagination
      const skip = (pageNum - 1) * limitNum;

      // Execute queries in parallel
      const [serviceTypes, totalCount] = await Promise.all([
        prisma.serviceType.findMany({
          where: whereClause,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limitNum,
        }),
        prisma.serviceType.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info("Retrieved service types", {
        count: serviceTypes.length,
        totalCount,
        page: pageNum,
        filters,
      });

      return {
        success: true,
        data: serviceTypes,
        meta: {
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
          filters: {
            search,
            category,
            status,
            sortBy,
            sortOrder,
          },
        },
      };
    } catch (error) {
      logger.error("Error retrieving service types", {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get a single service type by ID
   * @param {string} id - Service type ID
   * @returns {Promise<Object>} Service type details
   */
  async getServiceTypeById(id) {
    try {
      const serviceType = await prisma.serviceType.findUnique({
        where: { id },
      });

      if (!serviceType) {
        const error = new Error(`Service type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      logger.info("Retrieved service type by ID", {
        id,
        name: serviceType.name,
      });

      return serviceType;
    } catch (error) {
      logger.error("Error retrieving service type by ID", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Get a single service type by name
   * @param {string} name - Service type name
   * @returns {Promise<Object>} Service type details
   */
  async getServiceTypeByName(name) {
    try {
      const serviceType = await prisma.serviceType.findUnique({
        where: { name: name.toUpperCase() },
      });

      if (!serviceType) {
        const error = new Error(`Service type '${name}' not found`);
        error.statusCode = 404;
        throw error;
      }

      logger.info("Retrieved service type by name", {
        name,
        id: serviceType.id,
      });

      return serviceType;
    } catch (error) {
      logger.error("Error retrieving service type by name", {
        error: error.message,
        name,
      });
      throw error;
    }
  }

  /**
   * Update an existing service type
   * @param {string} id - Service type ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated service type
   */
  async updateServiceType(id, updateData) {
    try {
      logger.info("Updating service type", { id, updateData });

      // Check if service type exists
      const existing = await prisma.serviceType.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Service type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Prepare update data - only include fields that are provided
      const updatePayload = {};

      if (updateData.displayName !== undefined) {
        updatePayload.displayName = updateData.displayName;
      }
      if (updateData.description !== undefined) {
        updatePayload.description = updateData.description;
      }
      if (updateData.category !== undefined) {
        updatePayload.category = updateData.category;
      }
      if (updateData.isAvailable !== undefined) {
        updatePayload.isAvailable = updateData.isAvailable;
      }
      if (updateData.baseCharge !== undefined) {
        updatePayload.baseCharge = updateData.baseCharge;
      }
      if (updateData.sortOrder !== undefined) {
        updatePayload.sortOrder = updateData.sortOrder;
      }
      if (updateData.additionalInfo !== undefined) {
        updatePayload.additionalInfo = updateData.additionalInfo;
      }

      // Update the service type
      const serviceType = await prisma.serviceType.update({
        where: { id },
        data: updatePayload,
      });

      logger.info("Service type updated successfully", {
        id,
        name: serviceType.name,
      });

      return serviceType;
    } catch (error) {
      logger.error("Error updating service type", {
        error: error.message,
        id,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Delete a service type (soft delete by marking as unavailable)
   * @param {string} id - Service type ID
   * @returns {Promise<Object>} Updated service type
   */
  async deleteServiceType(id) {
    try {
      logger.info("Soft deleting service type", { id });

      // Check if service type exists
      const existing = await prisma.serviceType.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Service type with ID '${id}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // Soft delete by marking as unavailable
      const serviceType = await prisma.serviceType.update({
        where: { id },
        data: { isAvailable: false },
      });

      logger.info("Service type soft deleted successfully", {
        id,
        name: serviceType.name,
      });

      return serviceType;
    } catch (error) {
      logger.error("Error deleting service type", {
        error: error.message,
        id,
      });
      throw error;
    }
  }

  /**
   * Get service type usage statistics
   * @returns {Promise<Object>} Usage statistics
   */
  async getServiceTypeStats() {
    try {
      const [totalCount, activeCount, categoryStats] = await Promise.all([
        prisma.serviceType.count(),
        prisma.serviceType.count({ where: { isAvailable: true } }),
        prisma.serviceType.groupBy({
          by: ["category"],
          _count: { category: true },
        }),
      ]);

      const stats = {
        total: totalCount,
        active: activeCount,
        inactive: totalCount - activeCount,
        byCategory: categoryStats.reduce((acc, stat) => {
          acc[stat.category] = stat._count.category;
          return acc;
        }, {}),
      };

      logger.info("Retrieved service type statistics", { stats });

      return stats;
    } catch (error) {
      logger.error("Error retrieving service type statistics", {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = ServiceTypeService;
