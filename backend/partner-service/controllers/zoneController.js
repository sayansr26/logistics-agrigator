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
const logger = require("../shared/lib/logger");
const { successResponse, errorResponse } = require("../shared/lib/response");
const { validateRequest } = require("../shared/lib/validation");

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
        return errorResponse(
          res,
          "INVALID_PAGINATION",
          "Invalid pagination parameters",
          400,
        );
      }

      // Validate sort parameters
      const validSortFields = ["name", "createdAt", "updatedAt", "status"];
      const validSortOrders = ["asc", "desc"];

      if (
        !validSortFields.includes(sortBy) ||
        !validSortOrders.includes(sortOrder)
      ) {
        return errorResponse(
          res,
          "INVALID_SORT",
          "Invalid sort parameters",
          400,
        );
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
        return errorResponse(
          res,
          result.error?.code || "ZONE_RETRIEVAL_ERROR",
          result.error?.message || "Failed to retrieve zones",
          500,
        );
      }

      logger.info("Zones retrieved successfully", {
        userId: req.user?.userId,
        total: result.data?.length || 0,
        page: pageNum,
        limit: limitNum,
      });

      return successResponse(res, result.data, "Zones retrieved successfully", {
        pagination: result.meta?.pagination,
        summary: result.meta?.summary,
      });
    } catch (error) {
      logger.error("Failed to get zones", {
        error: error.message,
        userId: req.user?.userId,
        query: req.query,
      });

      return errorResponse(res, "INTERNAL_ERROR", "Internal server error", 500);
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
      const validation = validateRequest(req.body, requiredFields);

      if (!validation.isValid) {
        return errorResponse(
          res,
          "VALIDATION_ERROR",
          validation.errors.join(", "),
          400,
        );
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
        return errorResponse(
          res,
          "INVALID_NAME",
          "Zone name must be between 3 and 100 characters",
          400,
        );
      }

      if (description.length < 10 || description.length > 500) {
        return errorResponse(
          res,
          "INVALID_DESCRIPTION",
          "Zone description must be between 10 and 500 characters",
          400,
        );
      }

      // Validate geographical data structure
      if (geographical.pincodes && !Array.isArray(geographical.pincodes)) {
        return errorResponse(
          res,
          "INVALID_GEOGRAPHICAL",
          "Geographical pincodes must be an array",
          400,
        );
      }

      // Validate services structure
      if (services && !Array.isArray(services)) {
        return errorResponse(
          res,
          "INVALID_SERVICES",
          "Services must be an array",
          400,
        );
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
        return errorResponse(
          res,
          result.error?.code || "ZONE_CREATION_ERROR",
          result.error?.message || "Failed to create zone",
          500,
        );
      }

      logger.info("Zone created successfully", {
        userId: req.user?.userId,
        zoneId: result.data?.id,
        zoneName: name,
        partnerId,
      });

      return successResponse(
        res,
        result.data,
        "Zone created successfully",
        null,
        201,
      );
    } catch (error) {
      logger.error("Failed to create zone", {
        error: error.message,
        userId: req.user?.userId,
        body: { ...req.body, services: "[REDACTED]" },
      });

      return errorResponse(res, "INTERNAL_ERROR", "Internal server error", 500);
    }
  }

  /**
   * Get all service types with filtering and pagination
   * GET /api/service-types
   */
  static async getServiceTypes(req, res) {
    const zoneService = new ZoneService();
    try {
      const {
        page = 1,
        limit = 20,
        status = "ACTIVE",
        category,
        sortBy = "sortOrder",
        sortOrder = "asc",
      } = req.query;

      // Validate pagination parameters
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return errorResponse(
          res,
          "INVALID_PAGINATION",
          "Invalid pagination parameters",
          400,
        );
      }

      // Validate status
      const validStatuses = ["ACTIVE", "INACTIVE", "ALL"];
      if (status && !validStatuses.includes(status)) {
        return errorResponse(
          res,
          "INVALID_STATUS",
          "Invalid status parameter",
          400,
        );
      }

      const options = {
        page: pageNum,
        limit: limitNum,
        status: status === "ALL" ? null : status,
        category,
        sortBy,
        sortOrder,
      };

      const result = await zoneService.getServiceTypes(options);

      if (!result.success) {
        return errorResponse(
          res,
          result.error?.code || "SERVICE_TYPE_RETRIEVAL_ERROR",
          result.error?.message || "Failed to retrieve service types",
          500,
        );
      }

      logger.info("Service types retrieved successfully", {
        userId: req.user?.userId,
        total: result.data?.length || 0,
        page: pageNum,
        limit: limitNum,
        status,
      });

      return successResponse(
        res,
        result.data,
        "Service types retrieved successfully",
        {
          pagination: result.meta?.pagination,
          filters: result.meta?.filters,
        },
      );
    } catch (error) {
      logger.error("Failed to get service types", {
        error: error.message,
        userId: req.user?.userId,
        query: req.query,
      });

      return errorResponse(res, "INTERNAL_ERROR", "Internal server error", 500);
    }
  }

  /**
   * Create a new service type
   * POST /api/service-types
   */
  static async createServiceType(req, res) {
    const zoneService = new ZoneService();
    try {
      // Validate required fields
      const requiredFields = ["name", "displayName", "category"];
      const validation = validateRequest(req.body, requiredFields);

      if (!validation.isValid) {
        return errorResponse(
          res,
          "VALIDATION_ERROR",
          validation.errors.join(", "),
          400,
        );
      }

      const {
        name,
        displayName,
        category,
        description = "",
        isAvailable = true,
        baseCharge = "0",
        sortOrder = 100,
        additionalInfo = null,
      } = req.body;

      // Additional validation
      if (name.length < 2 || name.length > 50) {
        return errorResponse(
          res,
          "INVALID_NAME",
          "Service type name must be between 2 and 50 characters",
          400,
        );
      }

      if (displayName.length < 3 || displayName.length > 100) {
        return errorResponse(
          res,
          "INVALID_DISPLAY_NAME",
          "Display name must be between 3 and 100 characters",
          400,
        );
      }

      const validCategories = ["LOGISTICS", "PAYMENT", "LOCATION", "SPECIAL"];
      if (!validCategories.includes(category)) {
        return errorResponse(
          res,
          "INVALID_CATEGORY",
          "Invalid service type category",
          400,
        );
      }

      const serviceTypeData = {
        name: name.trim().toUpperCase(),
        displayName: displayName.trim(),
        category,
        description: description.trim(),
        isAvailable,
        baseCharge: baseCharge.toString(),
        sortOrder: parseInt(sortOrder),
        additionalInfo,
      };

      const result = await zoneService.createServiceType(serviceTypeData);

      if (!result.success) {
        return errorResponse(
          res,
          result.error?.code || "SERVICE_TYPE_CREATION_ERROR",
          result.error?.message || "Failed to create service type",
          500,
        );
      }

      logger.info("Service type created successfully", {
        userId: req.user?.userId,
        serviceTypeId: result.data?.id,
        name,
        category,
      });

      return successResponse(
        res,
        result.data,
        "Service type created successfully",
        null,
        201,
      );
    } catch (error) {
      logger.error("Failed to create service type", {
        error: error.message,
        userId: req.user?.userId,
        body: req.body,
      });

      return errorResponse(res, "INTERNAL_ERROR", "Internal server error", 500);
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
        return errorResponse(
          res,
          "INVALID_PARTNER_ID",
          "Partner ID is required",
          400,
        );
      }

      // Validate pagination parameters
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return errorResponse(
          res,
          "INVALID_PAGINATION",
          "Invalid pagination parameters",
          400,
        );
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
        return errorResponse(
          res,
          result.error?.code || "PARTNER_ZONE_RETRIEVAL_ERROR",
          result.error?.message || "Failed to retrieve partner zones",
          500,
        );
      }

      logger.info("Partner zones retrieved successfully", {
        userId: req.user?.userId,
        partnerId,
        total: result.data?.zones?.length || 0,
        page: pageNum,
        limit: limitNum,
      });

      return successResponse(
        res,
        result.data,
        "Partner zones retrieved successfully",
      );
    } catch (error) {
      logger.error("Failed to get partner zones", {
        error: error.message,
        userId: req.user?.userId,
        partnerId: req.params.partnerId,
        query: req.query,
      });

      return errorResponse(res, "INTERNAL_ERROR", "Internal server error", 500);
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
        return errorResponse(
          res,
          "INVALID_PARTNER_ID",
          "Partner ID is required",
          400,
        );
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
        return errorResponse(
          res,
          result.error?.code || "COMPREHENSIVE_DATA_ERROR",
          result.error?.message ||
            "Failed to retrieve comprehensive partner data",
          500,
        );
      }

      logger.info("Comprehensive partner data retrieved successfully", {
        userId: req.user?.userId,
        partnerId,
        modules: result.summary?.dataModules || [],
        totalRecords: result.summary?.totalRecords || 0,
        executionTime: result.execution_time_ms,
      });

      return successResponse(
        res,
        result.data,
        "Comprehensive partner data retrieved successfully",
        {
          summary: result.summary,
          metadata: result.metadata,
          executionTime: result.execution_time_ms,
        },
      );
    } catch (error) {
      logger.error("Failed to get comprehensive partner data", {
        error: error.message,
        userId: req.user?.userId,
        partnerId: req.params.partnerId,
        query: req.query,
      });

      return errorResponse(res, "INTERNAL_ERROR", "Internal server error", 500);
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
        return errorResponse(
          res,
          "INVALID_PINCODES",
          "Pincodes array is required and must not be empty",
          400,
        );
      }

      // Validate pincode format
      const invalidPincodes = pincodes.filter(
        (pincode) => !/^\d{6}$/.test(pincode.toString()),
      );
      if (invalidPincodes.length > 0) {
        return errorResponse(
          res,
          "INVALID_PINCODE_FORMAT",
          `Invalid pincode format: ${invalidPincodes.join(", ")}`,
          400,
        );
      }

      // Limit number of pincodes to prevent abuse
      if (pincodes.length > 1000) {
        return errorResponse(
          res,
          "TOO_MANY_PINCODES",
          "Maximum 1000 pincodes allowed per request",
          400,
        );
      }

      const result = await zoneService.validateZoneCoverage(
        pincodes,
        partnerId,
      );

      if (!result.success) {
        return errorResponse(
          res,
          result.error?.code || "ZONE_COVERAGE_VALIDATION_ERROR",
          result.error?.message || "Failed to validate zone coverage",
          500,
        );
      }

      logger.info("Zone coverage validation completed", {
        userId: req.user?.userId,
        partnerId,
        totalPincodes: pincodes.length,
        coveragePercentage: result.data?.coveragePercentage || 0,
      });

      return successResponse(
        res,
        result.data,
        "Zone coverage validation completed successfully",
      );
    } catch (error) {
      logger.error("Failed to validate zone coverage", {
        error: error.message,
        userId: req.user?.userId,
        body: {
          ...req.body,
          pincodes: `[${req.body?.pincodes?.length || 0} pincodes]`,
        },
      });

      return errorResponse(res, "INTERNAL_ERROR", "Internal server error", 500);
    }
  }
}

module.exports = ZoneController;
