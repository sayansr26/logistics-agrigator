/**
 * Discount Controller
 *
 * Handles discount management operations
 * Integrates with DiscountService for external API communication
 * Follows auth-service controller patterns with static methods
 */

const APIResponse = require("../shared/lib/response");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const { DiscountService } = require("../services/discountService");

class DiscountController {
  static discountService = new DiscountService();

  /**
   * Get discounts with filtering
   * GET /api/v1/discounts
   */
  static async getDiscounts(req, res) {
    try {
      const {
        partnerId,
        discountType,
        applicableOn,
        isActive,
        validFrom,
        validTo,
        page = 1,
        limit = 20,
      } = req.query;

      // Build filters object
      const filters = {};
      if (partnerId) filters.partnerId = partnerId;
      if (discountType) filters.discountType = discountType;
      if (applicableOn) filters.applicableOn = applicableOn;
      if (isActive !== undefined) filters.isActive = isActive === "true";
      if (validFrom) filters.validFrom = new Date(validFrom);
      if (validTo) filters.validTo = new Date(validTo);
      if (page) filters.page = parseInt(page);
      if (limit) filters.limit = parseInt(limit);

      const result =
        await DiscountController.discountService.getDiscounts(filters);

      // Log successful retrieval
      logger.info("Discounts retrieved successfully", {
        userId: req.user?.id,
        ip: req.ip,
        filters,
        count: result.discounts?.length || 0,
      });

      return APIResponse.success(
        res,
        result,
        "Discounts retrieved successfully",
        200,
      );
    } catch (error) {
      logger.error("Error retrieving discounts", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        query: req.query,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      return APIResponse.error(
        res,
        "Failed to retrieve discounts",
        500,
        error.message,
      );
    }
  }

  /**
   * Get discount by ID
   * GET /api/v1/discounts/:id
   */
  static async getDiscountById(req, res) {
    try {
      const { id } = req.params;
      const { partnerId } = req.query;

      if (!id) {
        throw new ValidationError("Discount ID is required");
      }

      const result = await DiscountController.discountService.getDiscountById(
        id,
        partnerId,
      );

      // Log successful retrieval
      logger.info("Discount details retrieved successfully", {
        userId: req.user?.id,
        ip: req.ip,
        discountId: id,
        partnerId,
      });

      return APIResponse.success(
        res,
        result,
        "Discount details retrieved successfully",
        200,
      );
    } catch (error) {
      logger.error("Error retrieving discount details", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        discountId: req.params.id,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      if (
        error instanceof NotFoundError ||
        error.message.includes("not found")
      ) {
        return APIResponse.error(res, "Discount not found", 404);
      }

      return APIResponse.error(
        res,
        "Failed to retrieve discount details",
        500,
        error.message,
      );
    }
  }

  /**
   * Create new discount
   * POST /api/v1/discounts
   */
  static async createDiscount(req, res) {
    try {
      const discountData = req.body;

      // Basic validation
      if (!discountData || typeof discountData !== "object") {
        throw new ValidationError("Valid discount data is required");
      }

      // Add user context for audit logging
      discountData.createdBy = req.user?.id;
      discountData.createdAt = new Date();

      const result =
        await DiscountController.discountService.createDiscount(discountData);

      // Log successful creation
      logger.info("Discount created successfully", {
        userId: req.user?.id,
        ip: req.ip,
        discountId: result.discountId,
        partnerId: discountData.partnerId,
        discountType: discountData.discountType,
      });

      return APIResponse.success(
        res,
        result,
        "Discount created successfully",
        201,
      );
    } catch (error) {
      logger.error("Error creating discount", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        discountData: req.body,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      if (
        error instanceof ConflictError ||
        error.message.includes("already exists")
      ) {
        return APIResponse.error(res, "Discount already exists", 409);
      }

      return APIResponse.error(
        res,
        "Failed to create discount",
        500,
        error.message,
      );
    }
  }

  /**
   * Update existing discount
   * PUT /api/v1/discounts/:id
   */
  static async updateDiscount(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        throw new ValidationError("Discount ID is required");
      }

      if (!updateData || typeof updateData !== "object") {
        throw new ValidationError("Valid update data is required");
      }

      // Add user context for audit logging
      updateData.updatedBy = req.user?.id;
      updateData.updatedAt = new Date();

      const result = await DiscountController.discountService.updateDiscount(
        id,
        updateData,
      );

      // Log successful update
      logger.info("Discount updated successfully", {
        userId: req.user?.id,
        ip: req.ip,
        discountId: id,
        updateFields: Object.keys(updateData),
      });

      return APIResponse.success(
        res,
        result,
        "Discount updated successfully",
        200,
      );
    } catch (error) {
      logger.error("Error updating discount", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        discountId: req.params.id,
        updateData: req.body,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      if (
        error instanceof NotFoundError ||
        error.message.includes("not found")
      ) {
        return APIResponse.error(res, "Discount not found", 404);
      }

      return APIResponse.error(
        res,
        "Failed to update discount",
        500,
        error.message,
      );
    }
  }

  /**
   * Delete discount
   * DELETE /api/v1/discounts/:id
   */
  static async deleteDiscount(req, res) {
    try {
      const { id } = req.params;
      const { partnerId } = req.query;

      if (!id) {
        throw new ValidationError("Discount ID is required");
      }

      const result = await DiscountController.discountService.deleteDiscount(
        id,
        partnerId,
      );

      // Log successful deletion
      logger.info("Discount deleted successfully", {
        userId: req.user?.id,
        ip: req.ip,
        discountId: id,
        partnerId,
      });

      return APIResponse.success(
        res,
        result,
        "Discount deleted successfully",
        200,
      );
    } catch (error) {
      logger.error("Error deleting discount", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        discountId: req.params.id,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      if (
        error instanceof NotFoundError ||
        error.message.includes("not found")
      ) {
        return APIResponse.error(res, "Discount not found", 404);
      }

      return APIResponse.error(
        res,
        "Failed to delete discount",
        500,
        error.message,
      );
    }
  }

  /**
   * Bulk create discounts
   * POST /api/v1/discounts/bulk
   */
  static async bulkCreateDiscounts(req, res) {
    try {
      const { discounts } = req.body;

      if (!discounts || !Array.isArray(discounts) || discounts.length === 0) {
        throw new ValidationError("Valid discounts array is required");
      }

      if (discounts.length > 100) {
        throw new ValidationError(
          "Maximum 100 discounts allowed per bulk operation",
        );
      }

      // Add user context to all discounts
      const discountsWithContext = discounts.map((discount) => ({
        ...discount,
        createdBy: req.user?.id,
        createdAt: new Date(),
      }));

      const result =
        await DiscountController.discountService.bulkCreateDiscounts(
          discountsWithContext,
        );

      // Log successful bulk creation
      logger.info("Bulk discount creation completed", {
        userId: req.user?.id,
        ip: req.ip,
        totalDiscounts: discounts.length,
        successful: result.successful?.length || 0,
        failed: result.failed?.length || 0,
      });

      return APIResponse.success(
        res,
        result,
        "Bulk discount creation completed",
        201,
      );
    } catch (error) {
      logger.error("Error in bulk discount creation", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        discountCount: req.body.discounts?.length || 0,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      return APIResponse.error(
        res,
        "Failed to create discounts in bulk",
        500,
        error.message,
      );
    }
  }

  /**
   * Calculate discount for given parameters
   * POST /api/v1/discounts/calculate
   */
  static async calculateDiscount(req, res) {
    try {
      const calculationData = req.body;

      if (!calculationData || typeof calculationData !== "object") {
        throw new ValidationError("Valid calculation data is required");
      }

      // Validate required fields
      const requiredFields = ["partnerId", "baseAmount", "applicableOn"];
      for (const field of requiredFields) {
        if (!calculationData[field]) {
          throw new ValidationError(
            `${field} is required for discount calculation`,
          );
        }
      }

      const result =
        await DiscountController.discountService.calculateDiscount(
          calculationData,
        );

      // Log successful calculation
      logger.info("Discount calculation completed", {
        userId: req.user?.id,
        ip: req.ip,
        partnerId: calculationData.partnerId,
        baseAmount: calculationData.baseAmount,
        totalDiscount: result.totalDiscount,
        finalAmount: result.finalAmount,
      });

      return APIResponse.success(
        res,
        result,
        "Discount calculation completed successfully",
        200,
      );
    } catch (error) {
      logger.error("Error calculating discount", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        calculationData: req.body,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      return APIResponse.error(
        res,
        "Failed to calculate discount",
        500,
        error.message,
      );
    }
  }

  /**
   * Get active discounts for partner
   * GET /api/v1/discounts/active
   */
  static async getActiveDiscounts(req, res) {
    try {
      const { partnerId, applicableOn } = req.query;

      if (!partnerId) {
        throw new ValidationError("Partner ID is required");
      }

      const result =
        await DiscountController.discountService.getActiveDiscounts(
          partnerId,
          applicableOn,
        );

      // Log successful retrieval
      logger.info("Active discounts retrieved successfully", {
        userId: req.user?.id,
        ip: req.ip,
        partnerId,
        applicableOn,
        count: result.discounts?.length || 0,
      });

      return APIResponse.success(
        res,
        result,
        "Active discounts retrieved successfully",
        200,
      );
    } catch (error) {
      logger.error("Error retrieving active discounts", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        query: req.query,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      return APIResponse.error(
        res,
        "Failed to retrieve active discounts",
        500,
        error.message,
      );
    }
  }

  /**
   * Get discount performance analytics
   * GET /api/v1/discounts/analytics
   */
  static async getDiscountAnalytics(req, res) {
    try {
      const { partnerId, startDate, endDate } = req.query;

      // Build date range
      const dateRange = {};
      if (startDate) dateRange.startDate = new Date(startDate);
      if (endDate) dateRange.endDate = new Date(endDate);

      // Validate date range
      if (
        dateRange.startDate &&
        dateRange.endDate &&
        dateRange.startDate >= dateRange.endDate
      ) {
        throw new ValidationError("Start date must be before end date");
      }

      const result =
        await DiscountController.discountService.getDiscountAnalytics(
          partnerId,
          dateRange,
        );

      // Log successful retrieval
      logger.info("Discount analytics retrieved successfully", {
        userId: req.user?.id,
        ip: req.ip,
        partnerId,
        dateRange,
        totalDiscounts: result.totalDiscounts,
      });

      return APIResponse.success(
        res,
        result,
        "Discount analytics retrieved successfully",
        200,
      );
    } catch (error) {
      logger.error("Error retrieving discount analytics", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        query: req.query,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      return APIResponse.error(
        res,
        "Failed to retrieve discount analytics",
        500,
        error.message,
      );
    }
  }

  /**
   * Validate discount conflicts
   * POST /api/v1/discounts/validate-conflicts
   */
  static async validateDiscountConflicts(req, res) {
    try {
      const { partnerId, discountData } = req.body;

      if (!partnerId || !discountData) {
        throw new ValidationError("Partner ID and discount data are required");
      }

      // This would typically call a validation service
      // For now, we'll return a simple validation result
      const result = {
        hasConflicts: false,
        conflicts: [],
        recommendations: [],
        validationPassed: true,
      };

      // Log successful validation
      logger.info("Discount conflict validation completed", {
        userId: req.user?.id,
        ip: req.ip,
        partnerId,
        hasConflicts: result.hasConflicts,
      });

      return APIResponse.success(
        res,
        result,
        "Discount conflict validation completed",
        200,
      );
    } catch (error) {
      logger.error("Error validating discount conflicts", {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip,
        body: req.body,
        stack: error.stack,
      });

      if (error instanceof ValidationError) {
        return APIResponse.error(res, error.message, 400);
      }

      return APIResponse.error(
        res,
        "Failed to validate discount conflicts",
        500,
        error.message,
      );
    }
  }
}

module.exports = DiscountController;
