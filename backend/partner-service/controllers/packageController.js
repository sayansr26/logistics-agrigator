/**
 * Package Controller
 *
 * Handles package charge management operations
 * Integrates with PackageService for external API communication
 * Follows auth-service controller patterns with static methods
 */

const APIResponse = require("../shared/lib/response");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const PackageService = require("../services/packageService");

class PackageController {
  static packageService = new PackageService();

  /**
   * Get package charges with filtering
   * GET /api/v1/packages/charges
   */
  static async getPackageCharges(req, res) {
    try {
      const {
        partnerId,
        packageName,
        fromZoneId,
        toZoneId,
        status,
        page = 1,
        limit = 20,
      } = req.query;

      // Build filters object
      const filters = {};
      if (partnerId) filters.partnerId = partnerId;
      if (packageName) filters.packageName = packageName;
      if (fromZoneId) filters.fromZoneId = parseInt(fromZoneId);
      if (toZoneId) filters.toZoneId = parseInt(toZoneId);
      if (status !== undefined) filters.status = status === "true";
      if (page) filters.page = parseInt(page);
      if (limit) filters.limit = parseInt(limit);

      const result =
        await PackageController.packageService.getPackageCharges(filters);

      // Log successful retrieval
      logger.info("Package charges retrieved successfully", {
        userId: req.user?.id,
        filters,
        count: result.data?.packages?.length || 0,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Package charges retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Error retrieving package charges", {
        error: error.message,
        userId: req.user?.id,
        query: req.query,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Create new package charge configuration
   * POST /api/v1/packages/charges
   */
  static async createPackageCharge(req, res) {
    try {
      const { partnerId } = req.query;
      const packageData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      const result = await PackageController.packageService.createPackageCharge(
        packageData,
        partnerId,
      );

      // Log successful creation
      logger.info("Package charge created successfully", {
        userId: req.user?.id,
        partnerId,
        packageName: packageData.packageName,
        packageId: result.data?.package?.id,
        ip: req.ip,
      });

      res
        .status(201)
        .json(
          APIResponse.success(
            result.data,
            "Package charge created successfully",
          ),
        );
    } catch (error) {
      logger.error("Error creating package charge", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        packageData: req.body,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Update existing package charge configuration
   * PUT /api/v1/packages/charges/:packageId
   */
  static async updatePackageCharge(req, res) {
    try {
      const { packageId } = req.params;
      const { partnerId } = req.query;
      const updateData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!packageId) {
        throw new ValidationError("Package ID is required");
      }

      const result = await PackageController.packageService.updatePackageCharge(
        packageId,
        updateData,
        partnerId,
      );

      // Log successful update
      logger.info("Package charge updated successfully", {
        userId: req.user?.id,
        partnerId,
        packageId,
        updatedFields: Object.keys(updateData),
        ip: req.ip,
      });

      res.json(
        APIResponse.success(result.data, "Package charge updated successfully"),
      );
    } catch (error) {
      logger.error("Error updating package charge", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        packageId: req.params.packageId,
        updateData: req.body,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Delete package charge configuration
   * DELETE /api/v1/packages/charges/:packageId
   */
  static async deletePackageCharge(req, res) {
    try {
      const { packageId } = req.params;
      const { partnerId } = req.query;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!packageId) {
        throw new ValidationError("Package ID is required");
      }

      const result = await PackageController.packageService.deletePackageCharge(
        packageId,
        partnerId,
      );

      // Log successful deletion
      logger.info("Package charge deleted successfully", {
        userId: req.user?.id,
        partnerId,
        packageId,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(result.data, "Package charge deleted successfully"),
      );
    } catch (error) {
      logger.error("Error deleting package charge", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        packageId: req.params.packageId,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Create multiple package charges in bulk
   * POST /api/v1/packages/charges/bulk
   */
  static async createBulkPackageCharges(req, res) {
    try {
      const { partnerId } = req.query;
      const bulkData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!bulkData.packages || !Array.isArray(bulkData.packages)) {
        throw new ValidationError(
          "Invalid bulk data: packages array is required",
        );
      }

      const result =
        await PackageController.packageService.createBulkPackageCharges(
          bulkData,
          partnerId,
        );

      // Log successful bulk creation
      logger.info("Bulk package charges created successfully", {
        userId: req.user?.id,
        partnerId,
        packageCount: bulkData.packages.length,
        successCount: result.data?.successCount || 0,
        failureCount: result.data?.failureCount || 0,
        ip: req.ip,
      });

      res
        .status(201)
        .json(
          APIResponse.success(
            result.data,
            "Bulk package charges created successfully",
          ),
        );
    } catch (error) {
      logger.error("Error creating bulk package charges", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        packageCount: req.body.packages?.length || 0,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Calculate package charges for given parameters
   * POST /api/v1/packages/charges/calculate
   */
  static async calculatePackageCharges(req, res) {
    try {
      const { partnerId } = req.query;
      const calculationData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      // Validate required calculation fields
      const requiredFields = ["weight", "fromZoneId", "toZoneId"];
      const missingFields = requiredFields.filter(
        (field) => !calculationData[field],
      );

      if (missingFields.length > 0) {
        throw new ValidationError(
          `Missing required fields: ${missingFields.join(", ")}`,
        );
      }

      const result =
        await PackageController.packageService.calculatePackageCharges(
          calculationData,
          partnerId,
        );

      // Log successful calculation
      logger.info("Package charges calculated successfully", {
        userId: req.user?.id,
        partnerId,
        weight: calculationData.weight,
        fromZone: calculationData.fromZoneId,
        toZone: calculationData.toZoneId,
        totalCharge: result.data?.totalCharge,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Package charges calculated successfully",
        ),
      );
    } catch (error) {
      logger.error("Error calculating package charges", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        calculationData: req.body,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Get package charges by partner ID
   * GET /api/v1/partners/:partnerId/packages/charges
   */
  static async getPartnerPackageCharges(req, res) {
    try {
      const { partnerId } = req.params;
      const options = req.query;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      const result =
        await PackageController.packageService.getPartnerPackageCharges(
          partnerId,
          options,
        );

      // Log successful retrieval
      logger.info("Partner package charges retrieved successfully", {
        userId: req.user?.id,
        partnerId,
        packageCount: result.data?.packages?.length || 0,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Partner package charges retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Error retrieving partner package charges", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.params.partnerId,
        options: req.query,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Get package charge by ID
   * GET /api/v1/packages/charges/:packageId
   */
  static async getPackageChargeById(req, res) {
    try {
      const { packageId } = req.params;
      const { partnerId } = req.query;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!packageId) {
        throw new ValidationError("Package ID is required");
      }

      // Get specific package charge (using filter with ID)
      const result = await PackageController.packageService.getPackageCharges({
        partnerId,
        packageId,
      });

      if (!result.data?.packages || result.data.packages.length === 0) {
        throw new NotFoundError("Package charge not found");
      }

      const packageCharge = result.data.packages[0];

      // Log successful retrieval
      logger.info("Package charge retrieved by ID", {
        userId: req.user?.id,
        partnerId,
        packageId,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          { package: packageCharge },
          "Package charge retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Error retrieving package charge by ID", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        packageId: req.params.packageId,
        ip: req.ip,
      });
      throw error;
    }
  }
}

module.exports = PackageController;
