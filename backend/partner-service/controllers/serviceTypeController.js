/**
 * Service Type Controller
 * Handles HTTP requests for service type management
 */

const ServiceTypeService = require("../services/serviceTypeService");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const { prisma } = require("../config/database");

const serviceTypeService = new ServiceTypeService();

class ServiceTypeController {
  /**
   * Get all service types with filtering and pagination
   * GET /api/v1/service-types
   */
  static async getAllServiceTypes(req, res) {
    try {
      const result = await serviceTypeService.getServiceTypes(req.query);

      // Return the result which already has success, data, and meta structure
      return res.status(200).json(result);
    } catch (error) {
      logger.error("Error getting service types", {
        error: error.message,
        stack: error.stack,
      });

      const errorResponse = APIResponse.error(
        error.message || "Failed to retrieve service types",
        error.statusCode >= 400 && error.statusCode < 500
          ? "CLIENT_ERROR"
          : "INTERNAL_ERROR",
      );
      return res.status(error.statusCode || 500).json(errorResponse);
    }
  }

  /**
   * Get service type by ID
   * GET /api/v1/service-types/:id
   */
  static async getServiceTypeById(req, res) {
    try {
      const { id } = req.params;
      const serviceType = await serviceTypeService.getServiceTypeById(id);

      const successResponse = APIResponse.success(
        serviceType,
        "Service type retrieved successfully",
      );
      return res.status(200).json(successResponse);
    } catch (error) {
      logger.error("Error getting service type by ID", {
        error: error.message,
        id: req.params.id,
      });

      const errorResponse = APIResponse.error(
        error.message || "Failed to retrieve service type",
        error.statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
      );
      return res.status(error.statusCode || 500).json(errorResponse);
    }
  }

  /**
   * Create a new service type
   * POST /api/v1/service-types
   */
  static async createServiceType(req, res) {
    try {
      const serviceType = await serviceTypeService.createServiceType(req.body);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          action: "SERVICE_TYPE_CREATED",
          resourceType: "SERVICE_TYPE",
          resourceId: serviceType.id.toString(),
          requestData: {
            name: serviceType.name,
            displayName: serviceType.displayName,
            category: serviceType.category,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const successResponse = APIResponse.success(
        serviceType,
        "Service type created successfully",
      );
      return res.status(201).json(successResponse);
    } catch (error) {
      logger.error("Error creating service type", {
        error: error.message,
        data: req.body,
      });

      const errorResponse = APIResponse.error(
        error.message || "Failed to create service type",
        error.statusCode === 409 ? "CONFLICT" : "INTERNAL_ERROR",
      );
      return res.status(error.statusCode || 500).json(errorResponse);
    }
  }

  /**
   * Update service type
   * PUT /api/v1/service-types/:id
   */
  static async updateServiceType(req, res) {
    try {
      const { id } = req.params;
      const serviceType = await serviceTypeService.updateServiceType(
        id,
        req.body,
      );

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          action: "SERVICE_TYPE_UPDATED",
          resourceType: "SERVICE_TYPE",
          resourceId: serviceType.id.toString(),
          requestData: req.body,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const successResponse = APIResponse.success(
        serviceType,
        "Service type updated successfully",
      );
      return res.status(200).json(successResponse);
    } catch (error) {
      logger.error("Error updating service type", {
        error: error.message,
        id: req.params.id,
        data: req.body,
      });

      const errorResponse = APIResponse.error(
        error.message || "Failed to update service type",
        error.statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
      );
      return res.status(error.statusCode || 500).json(errorResponse);
    }
  }

  /**
   * Delete service type (soft delete)
   * DELETE /api/v1/service-types/:id
   */
  static async deleteServiceType(req, res) {
    try {
      const { id } = req.params;
      const serviceType = await serviceTypeService.deleteServiceType(id);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          action: "SERVICE_TYPE_DELETED",
          resourceType: "SERVICE_TYPE",
          resourceId: serviceType.id.toString(),
          requestData: { soft_deleted: true },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const successResponse = APIResponse.success(
        serviceType,
        "Service type deleted successfully",
      );
      return res.status(200).json(successResponse);
    } catch (error) {
      logger.error("Error deleting service type", {
        error: error.message,
        id: req.params.id,
      });

      const errorResponse = APIResponse.error(
        error.message || "Failed to delete service type",
        error.statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
      );
      return res.status(error.statusCode || 500).json(errorResponse);
    }
  }

  /**
   * Get service type statistics
   * GET /api/v1/service-types/stats
   */
  static async getServiceTypeStats(req, res) {
    try {
      const stats = await serviceTypeService.getServiceTypeStats();

      const successResponse = APIResponse.success(
        stats,
        "Service type statistics retrieved successfully",
      );
      return res.status(200).json(successResponse);
    } catch (error) {
      logger.error("Error getting service type stats", {
        error: error.message,
      });

      const errorResponse = APIResponse.error(
        error.message || "Failed to retrieve service type statistics",
        "INTERNAL_ERROR",
      );
      return res.status(500).json(errorResponse);
    }
  }
}

module.exports = ServiceTypeController;
