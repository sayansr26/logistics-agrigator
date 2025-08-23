/**
 * Customer Charge Controller
 *
 * Handles customer charge management operations
 * Integrates with CustomerChargeService for external API communication
 * Follows auth-service controller patterns with static methods
 */

const APIResponse = require("../shared/lib/response");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const CustomerChargeService = require("../services/customerChargeService");

class CustomerChargeController {
  static customerChargeService = new CustomerChargeService();

  /**
   * Get customer charge configurations with filtering
   * GET /api/v1/customer-charges
   */
  static async getCustomerCharges(req, res) {
    try {
      const {
        partnerId,
        customerId,
        type,
        chargeType,
        status,
        page = 1,
        limit = 20,
      } = req.query;

      // Build filters object
      const filters = {};
      if (partnerId) filters.partnerId = partnerId;
      if (customerId) filters.customerId = customerId;
      if (type) filters.type = type;
      if (chargeType) filters.chargeType = chargeType;
      if (status !== undefined) filters.status = status === "true";
      if (page) filters.page = parseInt(page);
      if (limit) filters.limit = parseInt(limit);

      const result =
        await CustomerChargeController.customerChargeService.getCustomerCharges(
          filters,
        );

      // Log successful retrieval
      logger.info("Customer charges retrieved successfully", {
        userId: req.user?.id,
        filters,
        count: result.data?.charges?.length || 0,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Customer charges retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Error retrieving customer charges", {
        error: error.message,
        userId: req.user?.id,
        query: req.query,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Create new customer charge configuration
   * POST /api/v1/customer-charges
   */
  static async createCustomerCharge(req, res) {
    try {
      const { partnerId } = req.query;
      const chargeData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      const result =
        await CustomerChargeController.customerChargeService.createCustomerCharge(
          chargeData,
          partnerId,
        );

      // Log successful creation
      logger.info("Customer charge created successfully", {
        userId: req.user?.id,
        partnerId,
        customerId: chargeData.customerId,
        type: chargeData.type,
        chargeId: result.data?.charge?.id,
        ip: req.ip,
      });

      res
        .status(201)
        .json(
          APIResponse.success(
            result.data,
            "Customer charge created successfully",
          ),
        );
    } catch (error) {
      logger.error("Error creating customer charge", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        chargeData: req.body,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Update existing customer charge configuration
   * PUT /api/v1/customer-charges/:chargeId
   */
  static async updateCustomerCharge(req, res) {
    try {
      const { chargeId } = req.params;
      const { partnerId } = req.query;
      const updateData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!chargeId) {
        throw new ValidationError("Charge ID is required");
      }

      const result =
        await CustomerChargeController.customerChargeService.updateCustomerCharge(
          chargeId,
          updateData,
          partnerId,
        );

      // Log successful update
      logger.info("Customer charge updated successfully", {
        userId: req.user?.id,
        partnerId,
        chargeId,
        updatedFields: Object.keys(updateData),
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Customer charge updated successfully",
        ),
      );
    } catch (error) {
      logger.error("Error updating customer charge", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        chargeId: req.params.chargeId,
        updateData: req.body,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Delete customer charge configuration
   * DELETE /api/v1/customer-charges/:chargeId
   */
  static async deleteCustomerCharge(req, res) {
    try {
      const { chargeId } = req.params;
      const { partnerId } = req.query;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!chargeId) {
        throw new ValidationError("Charge ID is required");
      }

      const result =
        await CustomerChargeController.customerChargeService.deleteCustomerCharge(
          chargeId,
          partnerId,
        );

      // Log successful deletion
      logger.info("Customer charge deleted successfully", {
        userId: req.user?.id,
        partnerId,
        chargeId,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Customer charge deleted successfully",
        ),
      );
    } catch (error) {
      logger.error("Error deleting customer charge", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        chargeId: req.params.chargeId,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Create multiple customer charges in bulk
   * POST /api/v1/customer-charges/bulk
   */
  static async createBulkCustomerCharges(req, res) {
    try {
      const { partnerId } = req.query;
      const bulkData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!bulkData.charges || !Array.isArray(bulkData.charges)) {
        throw new ValidationError(
          "Invalid bulk data: charges array is required",
        );
      }

      const result =
        await CustomerChargeController.customerChargeService.createBulkCustomerCharges(
          bulkData,
          partnerId,
        );

      // Log successful bulk creation
      logger.info("Bulk customer charges created successfully", {
        userId: req.user?.id,
        partnerId,
        chargeCount: bulkData.charges.length,
        successCount: result.data?.successCount || 0,
        failureCount: result.data?.failureCount || 0,
        ip: req.ip,
      });

      res
        .status(201)
        .json(
          APIResponse.success(
            result.data,
            "Bulk customer charges created successfully",
          ),
        );
    } catch (error) {
      logger.error("Error creating bulk customer charges", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        chargeCount: req.body.charges?.length || 0,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Calculate customer charges for given parameters
   * POST /api/v1/customer-charges/calculate
   */
  static async calculateCustomerCharges(req, res) {
    try {
      const { partnerId } = req.query;
      const calculationData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      // Validate required calculation fields
      const requiredFields = ["customerId", "shipmentValue", "weight"];
      const missingFields = requiredFields.filter(
        (field) => !calculationData[field],
      );

      if (missingFields.length > 0) {
        throw new ValidationError(
          `Missing required fields: ${missingFields.join(", ")}`,
        );
      }

      const result =
        await CustomerChargeController.customerChargeService.calculateCustomerCharges(
          calculationData,
          partnerId,
        );

      // Log successful calculation
      logger.info("Customer charges calculated successfully", {
        userId: req.user?.id,
        partnerId,
        customerId: calculationData.customerId,
        shipmentValue: calculationData.shipmentValue,
        weight: calculationData.weight,
        totalCharges: result.data?.totalCharges,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Customer charges calculated successfully",
        ),
      );
    } catch (error) {
      logger.error("Error calculating customer charges", {
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
   * Get customer charges by customer ID
   * GET /api/v1/customers/:customerId/charges
   */
  static async getCustomerSpecificCharges(req, res) {
    try {
      const { customerId } = req.params;
      const { partnerId } = req.query;
      const options = { ...req.query };
      delete options.partnerId; // Remove partnerId from options as it's passed separately

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!customerId) {
        throw new ValidationError("Customer ID is required");
      }

      const result =
        await CustomerChargeController.customerChargeService.getCustomerSpecificCharges(
          customerId,
          partnerId,
          options,
        );

      // Log successful retrieval
      logger.info("Customer-specific charges retrieved successfully", {
        userId: req.user?.id,
        customerId,
        partnerId,
        chargeCount: result.data?.charges?.length || 0,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Customer-specific charges retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Error retrieving customer-specific charges", {
        error: error.message,
        userId: req.user?.id,
        customerId: req.params.customerId,
        partnerId: req.query.partnerId,
        options: req.query,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Get available charge types and configurations
   * GET /api/v1/customer-charges/types
   */
  static async getChargeTypes(req, res) {
    try {
      const { partnerId } = req.query;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      const result =
        await CustomerChargeController.customerChargeService.getChargeTypes(
          partnerId,
        );

      // Log successful retrieval
      logger.info("Charge types retrieved successfully", {
        userId: req.user?.id,
        partnerId,
        typeCount: result.data?.types?.length || 0,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(result.data, "Charge types retrieved successfully"),
      );
    } catch (error) {
      logger.error("Error retrieving charge types", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Get customer charge by ID
   * GET /api/v1/customer-charges/:chargeId
   */
  static async getCustomerChargeById(req, res) {
    try {
      const { chargeId } = req.params;
      const { partnerId } = req.query;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      if (!chargeId) {
        throw new ValidationError("Charge ID is required");
      }

      // Get specific customer charge (using filter with ID)
      const result =
        await CustomerChargeController.customerChargeService.getCustomerCharges(
          {
            partnerId,
            chargeId,
          },
        );

      if (!result.data?.charges || result.data.charges.length === 0) {
        throw new NotFoundError("Customer charge not found");
      }

      const customerCharge = result.data.charges[0];

      // Log successful retrieval
      logger.info("Customer charge retrieved by ID", {
        userId: req.user?.id,
        partnerId,
        chargeId,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          { charge: customerCharge },
          "Customer charge retrieved successfully",
        ),
      );
    } catch (error) {
      logger.error("Error retrieving customer charge by ID", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        chargeId: req.params.chargeId,
        ip: req.ip,
      });
      throw error;
    }
  }

  /**
   * Preview customer charge calculation without saving
   * POST /api/v1/customer-charges/preview
   */
  static async previewCustomerCharges(req, res) {
    try {
      const { partnerId } = req.query;
      const previewData = req.body;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      // Validate required preview fields
      const requiredFields = [
        "type",
        "chargeType",
        "value",
        "shipmentValue",
        "weight",
      ];
      const missingFields = requiredFields.filter(
        (field) => !previewData[field],
      );

      if (missingFields.length > 0) {
        throw new ValidationError(
          `Missing required fields: ${missingFields.join(", ")}`,
        );
      }

      // Calculate preview charges (this would be a mock calculation or use the service's calculation logic)
      const result =
        await CustomerChargeController.customerChargeService.calculateCustomerCharges(
          {
            customerId: previewData.customerId || "preview",
            shipmentValue: previewData.shipmentValue,
            weight: previewData.weight,
            chargeTypes: [previewData.type],
            additionalParams: {
              chargeType: previewData.chargeType,
              value: previewData.value,
              minKg: previewData.minKg,
              maxKg: previewData.maxKg,
              preview: true,
            },
          },
          partnerId,
        );

      // Log successful preview
      logger.info("Customer charge preview calculated successfully", {
        userId: req.user?.id,
        partnerId,
        type: previewData.type,
        chargeType: previewData.chargeType,
        value: previewData.value,
        previewCharge: result.data?.totalCharges,
        ip: req.ip,
      });

      res.json(
        APIResponse.success(
          result.data,
          "Customer charge preview calculated successfully",
        ),
      );
    } catch (error) {
      logger.error("Error calculating customer charge preview", {
        error: error.message,
        userId: req.user?.id,
        partnerId: req.query.partnerId,
        previewData: req.body,
        ip: req.ip,
      });
      throw error;
    }
  }
}

module.exports = CustomerChargeController;
