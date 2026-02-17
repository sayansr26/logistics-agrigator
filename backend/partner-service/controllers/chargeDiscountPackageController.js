/**
 * Charge Discount Package Controller
 *
 * Handles HTTP request/response for charge discount package operations.
 * All business logic is delegated to chargeDiscountPackageService.
 * Following auth-service patterns (function-based, no inline route logic).
 */

const chargeDiscountPackageService = require("../services/chargeDiscountPackageService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Extract request context for audit logging
 */
function getReqContext(req) {
  return {
    userId: req.user?.userId || null,
    ip: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.get?.("User-Agent") || null,
  };
}

// ========================================
// CONTROLLER FUNCTIONS
// ========================================

/**
 * Create a charge discount package
 * POST /api/v1/charge-discount-packages
 */
async function createPackage(req, res, next) {
  try {
    const packageData = req.body;
    const reqContext = getReqContext(req);

    logger.info("Creating charge discount package", {
      partnerId: packageData.partnerId,
      badge: packageData.badge,
      name: packageData.name,
      userId: reqContext.userId,
    });

    const pkg = await chargeDiscountPackageService.createPackage(
      packageData,
      reqContext,
    );

    res
      .status(201)
      .json(
        APIResponse.success(
          { package: pkg },
          { message: "Charge discount package created successfully" },
        ),
      );
  } catch (error) {
    logger.error("Error creating charge discount package:", error);
    next(error);
  }
}

/**
 * List charge discount packages with filters and pagination
 * GET /api/v1/charge-discount-packages
 */
async function listPackages(req, res, next) {
  try {
    const {
      page,
      limit,
      partnerId,
      badge,
      isActive,
      search,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      partnerId,
      badge,
      search,
      sortBy: sortBy || "createdAt",
      sortOrder: sortOrder || "desc",
    };

    if (typeof isActive === "string") {
      filters.isActive = isActive === "true";
    }

    logger.info("Listing charge discount packages", {
      filters,
      userId: req.user?.userId,
    });

    const result = await chargeDiscountPackageService.listPackages(filters);

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error listing charge discount packages:", error);
    next(error);
  }
}

/**
 * Get charge discount package by ID
 * GET /api/v1/charge-discount-packages/:id
 */
async function getPackageById(req, res, next) {
  try {
    const { id } = req.params;

    const pkg = await chargeDiscountPackageService.getPackageById(id);

    res.json(APIResponse.success({ package: pkg }));
  } catch (error) {
    logger.error("Error getting charge discount package:", error);
    next(error);
  }
}

/**
 * Update charge discount package
 * PUT /api/v1/charge-discount-packages/:id
 */
async function updatePackage(req, res, next) {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const reqContext = getReqContext(req);

    logger.info("Updating charge discount package", {
      packageId: id,
      updateFields: Object.keys(updateData),
      userId: reqContext.userId,
    });

    const updatedPkg = await chargeDiscountPackageService.updatePackage(
      id,
      updateData,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { package: updatedPkg },
        { message: "Charge discount package updated successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error updating charge discount package:", error);
    next(error);
  }
}

/**
 * Delete charge discount package
 * DELETE /api/v1/charge-discount-packages/:id
 */
async function deletePackage(req, res, next) {
  try {
    const { id } = req.params;
    const reqContext = getReqContext(req);

    logger.info("Deleting charge discount package", {
      packageId: id,
      userId: reqContext.userId,
    });

    const deletedPkg = await chargeDiscountPackageService.deletePackage(
      id,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { package: deletedPkg },
        { message: "Charge discount package deleted successfully" },
      ),
    );
  } catch (error) {
    logger.error("Error deleting charge discount package:", error);
    next(error);
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createPackage,
  listPackages,
  getPackageById,
  updatePackage,
  deletePackage,
};
