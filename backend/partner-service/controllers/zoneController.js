/**
 * Zone Controller - Zone Management and Service Type Configuration
 *
 * Handles HTTP requests for zone management operations
 * Integrates with external Partner Micro service through ZoneService
 *
 * Features:
 * - Zone CRUD operations
 * - Service type management
 * - Partner-specific zone operations
 * - Zone coverage validation
 * - Comprehensive partner data retrieval
 * - Input validation and error handling
 */

const ZoneService = require("../services/zoneService");
const ServiceTypeService = require("../services/serviceTypeService");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { prisma } = require("../config/database");

class ZoneController {
  /**
   * Get all zones with filtering and pagination
   * GET /api/zones
   */
  static async getAllZones(req, res) {
    const zoneService = new ZoneService();
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = req.query;

      // Validate pagination parameters
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        const errorResp = APIResponse.error(
          "Invalid pagination parameters",
          "INVALID_PAGINATION",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      // Validate sort parameters
      const validSortFields = ["name", "createdAt", "updatedAt", "status"];
      const validSortOrders = ["asc", "desc"];

      if (
        !validSortFields.includes(sortBy) ||
        !validSortOrders.includes(sortOrder)
      ) {
        const errorResp = APIResponse.error(
          "Invalid sort parameters",
          "INVALID_SORT",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const options = {
        page: pageNum,
        limit: limitNum,
        status,
        search,
        sortBy,
        sortOrder,
      };

      const result = await zoneService.getAllZones(options);

      if (!result.success) {
        const errorResp = APIResponse.error(
          result.error?.message || "Failed to retrieve zones",
          result.error?.code || "ZONE_RETRIEVAL_ERROR",
          null,
          500,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      logger.info("Zones retrieved successfully", {
        userId: req.user?.userId,
        total: result.data?.length || 0,
        page: pageNum,
        limit: limitNum,
      });

      return res.status(200).json({
        ...APIResponse.success(result.data, {
          pagination: result.meta?.pagination,
          summary: result.meta?.summary,
        }),
      });
    } catch (error) {
      logger.error("Failed to get zones", {
        error: error.message,
        userId: req.user?.userId,
        query: req.query,
      });

      const errorResp = APIResponse.error(
        "Internal server error",
        "INTERNAL_ERROR",
        null,
        500,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Create a new zone
   * POST /api/zones
   */
  static async createZone(req, res) {
    const zoneService = new ZoneService();
    try {
      // Validate required fields
      const requiredFields = ["name", "description", "partnerId"];
      const missingFields = requiredFields.filter((field) => !req.body[field]);

      if (missingFields.length > 0) {
        const errorResp = APIResponse.error(
          `Missing required fields: ${missingFields.join(", ")}`,
          "VALIDATION_ERROR",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const {
        name,
        description,
        partnerId,
        status = true,
        geographical = {},
        services = [],
      } = req.body;

      // Additional validation
      if (name.length < 3 || name.length > 100) {
        const errorResp = APIResponse.error(
          "Zone name must be between 3 and 100 characters",
          "INVALID_NAME",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      if (description.length < 10 || description.length > 500) {
        const errorResp = APIResponse.error(
          "Zone description must be between 10 and 500 characters",
          "INVALID_DESCRIPTION",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      // Validate geographical data structure
      if (geographical.pincodes && !Array.isArray(geographical.pincodes)) {
        const errorResp = APIResponse.error(
          "Geographical pincodes must be an array",
          "INVALID_GEOGRAPHICAL",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      // Validate services structure
      if (services && !Array.isArray(services)) {
        const errorResp = APIResponse.error(
          "Services must be an array",
          "INVALID_SERVICES",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const zoneData = {
        name: name.trim(),
        description: description.trim(),
        partnerId,
        status,
        geographical,
        services,
      };

      const result = await zoneService.createZone(zoneData);

      if (!result.success) {
        const errorResp = APIResponse.error(
          result.error?.message || "Failed to create zone",
          result.error?.code || "ZONE_CREATION_ERROR",
          null,
          500,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      logger.info("Zone created successfully", {
        userId: req.user?.userId,
        zoneId: result.data?.id,
        zoneName: name,
        partnerId,
      });

      return res.status(200).json({
        message: result.data,
        ...APIResponse.success("Zone created successfully", null, 201),
      });
    } catch (error) {
      logger.error("Failed to create zone", {
        error: error.message,
        userId: req.user?.userId,
        body: { ...req.body, services: "[REDACTED]" },
      });

      const errorResp = APIResponse.error(
        "Internal server error",
        "INTERNAL_ERROR",
        null,
        500,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Get all service types with filtering and pagination
   * GET /api/service-types
   */
  static async getServiceTypes(req, res) {
    const serviceTypeService = new ServiceTypeService();
    try {
      const {
        page = 1,
        limit = 20,
        status = "ACTIVE",
        category,
        sortBy = "sortOrder",
        sortOrder = "asc",
        search,
      } = req.query;

      // Validate pagination parameters
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        const errorResp = APIResponse.error(
          "Invalid pagination parameters",
          "INVALID_PAGINATION",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      // Validate status
      const validStatuses = ["ACTIVE", "INACTIVE", "ALL"];
      if (status && !validStatuses.includes(status)) {
        const errorResp = APIResponse.error(
          "Invalid status parameter",
          "INVALID_STATUS",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const options = {
        page: pageNum,
        limit: limitNum,
        status,
        category,
        search,
        sortBy,
        sortOrder,
      };

      const result = await serviceTypeService.getServiceTypes(options);

      logger.info("Service types retrieved successfully", {
        userId: req.user?.userId,
        total: result.data?.length || 0,
        page: pageNum,
        limit: limitNum,
        status,
      });

      return res.status(200).json({
        message: "Service types retrieved successfully",
        ...APIResponse.success(result.data, {
          pagination: result.meta?.pagination,
          filters: result.meta?.filters,
        }),
      });
    } catch (error) {
      logger.error("Failed to get service types", {
        error: error.message,
        userId: req.user?.userId,
        query: req.query,
      });

      const errorResp = APIResponse.error(
        "Internal server error",
        "INTERNAL_ERROR",
        null,
        500,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Get partner-specific zones
   * GET /api/partner-zones/:partnerId
   */
  static async getPartnerZones(req, res) {
    const zoneService = new ZoneService();
    try {
      const { partnerId } = req.params;
      const {
        page = 1,
        limit = 50,
        status,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = req.query;

      // Validate partnerId
      if (!partnerId || partnerId.trim().length === 0) {
        const errorResp = APIResponse.error(
          "Partner ID is required",
          "INVALID_PARTNER_ID",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      // Validate pagination parameters
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        const errorResp = APIResponse.error(
          "Invalid pagination parameters",
          "INVALID_PAGINATION",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const options = {
        page: pageNum,
        limit: limitNum,
        status,
        search,
        sortBy,
        sortOrder,
      };

      const result = await zoneService.getPartnerZones(partnerId, options);

      if (!result.success) {
        const errorResp = APIResponse.error(
          result.error?.message || "Failed to retrieve partner zones",
          result.error?.code || "PARTNER_ZONE_RETRIEVAL_ERROR",
          null,
          500,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      logger.info("Partner zones retrieved successfully", {
        userId: req.user?.userId,
        partnerId,
        total: result.data?.zones?.length || 0,
        page: pageNum,
        limit: limitNum,
      });

      return res.status(200).json({
        message: "Partner zones retrieved successfully",
        ...APIResponse.success(result.data),
      });
    } catch (error) {
      logger.error("Failed to get partner zones", {
        error: error.message,
        userId: req.user?.userId,
        partnerId: req.params.partnerId,
        query: req.query,
      });

      const errorResp = APIResponse.error(
        "Internal server error",
        "INTERNAL_ERROR",
        null,
        500,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Get comprehensive partner data
   * GET /api/partners/comprehensive-data/:partnerId
   */
  static async getComprehensivePartnerData(req, res) {
    const zoneService = new ZoneService();
    try {
      const { partnerId } = req.params;
      const { includeInactive = false, modules } = req.query;

      // Validate partnerId
      if (!partnerId || partnerId.trim().length === 0) {
        const errorResp = APIResponse.error(
          "Partner ID is required",
          "INVALID_PARTNER_ID",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const options = {
        includeInactive: includeInactive === "true",
        modules,
      };

      const result = await zoneService.getComprehensivePartnerData(
        partnerId,
        options,
      );

      if (!result.success) {
        const errorResp = APIResponse.error(
          result.error?.message ||
            "Failed to retrieve comprehensive partner data",
          result.error?.code || "COMPREHENSIVE_DATA_ERROR",
          null,
          500,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      logger.info("Comprehensive partner data retrieved successfully", {
        userId: req.user?.userId,
        partnerId,
        modules: result.summary?.dataModules || [],
        totalRecords: result.summary?.totalRecords || 0,
        executionTime: result.execution_time_ms,
      });

      return res.status(200).json({
        message: result.data,
        ...APIResponse.success(
          "Comprehensive partner data retrieved successfully",
          {
            summary: result.summary,
            metadata: result.metadata,
            executionTime: result.execution_time_ms,
          },
        ),
      });
    } catch (error) {
      logger.error("Failed to get comprehensive partner data", {
        error: error.message,
        userId: req.user?.userId,
        partnerId: req.params.partnerId,
        query: req.query,
      });

      const errorResp = APIResponse.error(
        "Internal server error",
        "INTERNAL_ERROR",
        null,
        500,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Validate zone coverage for pincodes
   * POST /api/zones/coverage/validate
   */
  static async validateZoneCoverage(req, res) {
    const zoneService = new ZoneService();
    try {
      const { pincodes, partnerId } = req.body;

      // Validate required fields
      if (!pincodes || !Array.isArray(pincodes) || pincodes.length === 0) {
        const errorResp = APIResponse.error(
          "Pincodes array is required and must not be empty",
          "INVALID_PINCODES",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      // Validate pincode format
      const invalidPincodes = pincodes.filter(
        (pincode) => !/^\d{6}$/.test(pincode.toString()),
      );
      if (invalidPincodes.length > 0) {
        const errorResp = APIResponse.error(
          `Invalid pincode format: ${invalidPincodes.join(", ")}`,
          "INVALID_PINCODE_FORMAT",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      // Limit number of pincodes to prevent abuse
      if (pincodes.length > 1000) {
        const errorResp = APIResponse.error(
          "Maximum 1000 pincodes allowed per request",
          "TOO_MANY_PINCODES",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const result = await zoneService.validateZoneCoverage(
        pincodes,
        partnerId,
      );

      if (!result.success) {
        const errorResp = APIResponse.error(
          result.error?.message || "Failed to validate zone coverage",
          result.error?.code || "ZONE_COVERAGE_VALIDATION_ERROR",
          null,
          500,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      logger.info("Zone coverage validation completed", {
        userId: req.user?.userId,
        partnerId,
        totalPincodes: pincodes.length,
        coveragePercentage: result.data?.coveragePercentage || 0,
      });

      return res.status(200).json({
        message: "Zone coverage validation completed successfully",
        ...APIResponse.success(result.data),
      });
    } catch (error) {
      logger.error("Failed to validate zone coverage", {
        error: error.message,
        userId: req.user?.userId,
        body: {
          ...req.body,
          pincodes: `[${req.body?.pincodes?.length || 0} pincodes]`,
        },
      });

      const errorResp = APIResponse.error(
        "Internal server error",
        "INTERNAL_ERROR",
        null,
        500,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Get service type by ID
   * GET /api/service-types/:id
   */
  static async getServiceTypeById(req, res) {
    const serviceTypeService = new ServiceTypeService();
    try {
      const { id } = req.params;

      const serviceType = await serviceTypeService.getServiceTypeById(id);

      // Log audit
      await prisma.auditLog.create({
        data: {
          action: "VIEW_SERVICE_TYPE",
          resourceType: "SERVICE_TYPE",
          resourceId: id,
          userId: req.user?.userId || null,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      return res.status(200).json({
        message: "Service type retrieved successfully",
        ...APIResponse.success(serviceType),
      });
    } catch (error) {
      logger.error("Failed to get service type by ID", {
        error: error.message,
        id: req.params.id,
        userId: req.user?.userId,
      });

      const statusCode = error.statusCode || 500;
      const errorResp = APIResponse.error(
        error.message || "Internal server error",
        error.statusCode ? "SERVICE_TYPE_NOT_FOUND" : "INTERNAL_ERROR",
        null,
        statusCode,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Create a new service type
   * POST /api/service-types
   */
  static async createServiceType(req, res) {
    const serviceTypeService = new ServiceTypeService();
    try {
      // Validate required fields
      const requiredFields = ["name", "displayName", "category"];
      const missingFields = requiredFields.filter((field) => !req.body[field]);

      if (missingFields.length > 0) {
        const errorResp = APIResponse.error(
          `Missing required fields: ${missingFields.join(", ")}`,
          "VALIDATION_ERROR",
          null,
          400,
        );
        return res.status(errorResp.statusCode).json(errorResp);
      }

      const serviceType = await serviceTypeService.createServiceType(req.body);

      // Log audit
      await prisma.auditLog.create({
        data: {
          action: "CREATE_SERVICE_TYPE",
          resourceType: "SERVICE_TYPE",
          resourceId: serviceType.id,
          userId: req.user?.userId || null,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          requestData: req.body,
          responseData: serviceType,
        },
      });

      logger.info("Service type created successfully", {
        id: serviceType.id,
        name: serviceType.name,
        userId: req.user?.userId,
      });

      return res.status(201).json({
        message: "Service type created successfully",
        ...APIResponse.success(serviceType),
      });
    } catch (error) {
      logger.error("Failed to create service type", {
        error: error.message,
        body: req.body,
        userId: req.user?.userId,
      });

      const statusCode = error.statusCode || 500;
      const errorResp = APIResponse.error(
        error.message || "Internal server error",
        error.statusCode === 409 ? "SERVICE_TYPE_EXISTS" : "INTERNAL_ERROR",
        null,
        statusCode,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Update a service type
   * PUT /api/service-types/:id
   */
  static async updateServiceType(req, res) {
    const serviceTypeService = new ServiceTypeService();
    try {
      const { id } = req.params;

      const serviceType = await serviceTypeService.updateServiceType(
        id,
        req.body,
      );

      // Log audit
      await prisma.auditLog.create({
        data: {
          action: "UPDATE_SERVICE_TYPE",
          resourceType: "SERVICE_TYPE",
          resourceId: id,
          userId: req.user?.userId || null,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          requestData: req.body,
          responseData: serviceType,
        },
      });

      logger.info("Service type updated successfully", {
        id,
        userId: req.user?.userId,
      });

      return res.status(200).json({
        message: "Service type updated successfully",
        ...APIResponse.success(serviceType),
      });
    } catch (error) {
      logger.error("Failed to update service type", {
        error: error.message,
        id: req.params.id,
        body: req.body,
        userId: req.user?.userId,
      });

      const statusCode = error.statusCode || 500;
      const errorResp = APIResponse.error(
        error.message || "Internal server error",
        error.statusCode ? "SERVICE_TYPE_NOT_FOUND" : "INTERNAL_ERROR",
        null,
        statusCode,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }

  /**
   * Delete a service type (soft delete)
   * DELETE /api/service-types/:id
   */
  static async deleteServiceType(req, res) {
    const serviceTypeService = new ServiceTypeService();
    try {
      const { id } = req.params;

      const serviceType = await serviceTypeService.deleteServiceType(id);

      // Log audit
      await prisma.auditLog.create({
        data: {
          action: "DELETE_SERVICE_TYPE",
          resourceType: "SERVICE_TYPE",
          resourceId: id,
          userId: req.user?.userId || null,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          responseData: serviceType,
        },
      });

      logger.info("Service type deleted successfully", {
        id,
        userId: req.user?.userId,
      });

      return res.status(200).json({
        message: "Service type deleted successfully",
        ...APIResponse.success(serviceType),
      });
    } catch (error) {
      logger.error("Failed to delete service type", {
        error: error.message,
        id: req.params.id,
        userId: req.user?.userId,
      });

      const statusCode = error.statusCode || 500;
      const errorResp = APIResponse.error(
        error.message || "Internal server error",
        error.statusCode ? "SERVICE_TYPE_NOT_FOUND" : "INTERNAL_ERROR",
        null,
        statusCode,
      );
      return res.status(errorResp.statusCode).json(errorResp);
    }
  }
}

module.exports = ZoneController;
