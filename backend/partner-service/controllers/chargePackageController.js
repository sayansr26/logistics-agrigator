/**
 * Charge Package Controller
 *
 * Handles HTTP request/response for charge package operations.
 * All business logic is delegated to chargePackageService.
 * Following auth-service patterns (function-based, no inline route logic).
 */

const chargePackageService = require("../services/chargePackageService");
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
 * Create charge packages for one or more partners
 * POST /api/v1/charge-packages
 */
async function createChargePackage(req, res, next) {
  try {
    const packageData = req.body;
    const reqContext = getReqContext(req);

    logger.info("Creating charge packages", {
      partnerCount: packageData.partnerIds?.length,
      packageName: packageData.name,
      type: packageData.type,
      userId: reqContext.userId,
    });

    const result = await chargePackageService.createChargePackages(
      packageData,
      reqContext,
    );

    res
      .status(201)
      .json(
        APIResponse.success(result, "Charge packages created successfully"),
      );
  } catch (error) {
    logger.error("Error creating charge packages:", error);
    next(error);
  }
}

/**
 * List charge packages with filters and pagination
 * GET /api/v1/charge-packages
 */
async function listChargePackages(req, res, next) {
  try {
    const {
      page,
      limit,
      partnerId,
      type,
      isActive,
      search,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      partnerId,
      type,
      search,
      sortBy: sortBy || "createdAt",
      sortOrder: sortOrder || "desc",
    };

    // Parse boolean
    if (typeof isActive === "string") {
      filters.isActive = isActive === "true";
    }

    logger.info("Listing charge packages", {
      filters,
      userId: req.user?.id,
    });

    const result = await chargePackageService.listChargePackages(filters);

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Error listing charge packages:", error);
    next(error);
  }
}

/**
 * Get charge package by ID
 * GET /api/v1/charge-packages/:id
 */
async function getChargePackageById(req, res, next) {
  try {
    const { id } = req.params;

    const pkg = await chargePackageService.getChargePackageById(id);

    res.json(APIResponse.success({ package: pkg }));
  } catch (error) {
    logger.error("Error getting charge package:", error);
    next(error);
  }
}

/**
 * Update charge package
 * PUT /api/v1/charge-packages/:id
 */
async function updateChargePackage(req, res, next) {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const reqContext = getReqContext(req);

    logger.info("Updating charge package", {
      packageId: id,
      updateFields: Object.keys(updateData),
      userId: reqContext.userId,
    });

    const updatedPackage = await chargePackageService.updateChargePackage(
      id,
      updateData,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { package: updatedPackage },
        "Charge package updated successfully",
      ),
    );
  } catch (error) {
    logger.error("Error updating charge package:", error);
    next(error);
  }
}

/**
 * Delete (soft-delete) charge package
 * DELETE /api/v1/charge-packages/:id
 */
async function deleteChargePackage(req, res, next) {
  try {
    const { id } = req.params;
    const reqContext = getReqContext(req);

    logger.info("Deleting charge package", {
      packageId: id,
      userId: reqContext.userId,
    });

    const deletedPackage = await chargePackageService.deleteChargePackage(
      id,
      reqContext,
    );

    res.json(
      APIResponse.success(
        { package: deletedPackage },
        "Charge package disabled successfully",
      ),
    );
  } catch (error) {
    logger.error("Error deleting charge package:", error);
    next(error);
  }
}

/**
 * Get packages by partner ID
 * GET /api/v1/charge-packages/partner/:partnerId
 */
async function getPackagesByPartner(req, res, next) {
  try {
    const { partnerId } = req.params;
    const { type, isActive } = req.query;

    const options = {
      type,
    };

    if (typeof isActive === "string") {
      options.isActive = isActive === "true";
    }

    const packages = await chargePackageService.getPackagesByPartner(
      partnerId,
      options,
    );

    res.json(
      APIResponse.success({
        packages,
        total: packages.length,
      }),
    );
  } catch (error) {
    logger.error("Error getting packages by partner:", error);
    next(error);
  }
}

/**
 * Get packages by partner ID grouped by type
 * GET /api/v1/charge-packages/partner/:partnerId/grouped
 */
async function getPackagesByPartnerGrouped(req, res, next) {
  try {
    const { partnerId } = req.params;
    const { activeOnly } = req.query;

    const activeOnlyBool = activeOnly !== "false";

    const grouped = await chargePackageService.getPackagesByPartnerGrouped(
      partnerId,
      activeOnlyBool,
    );

    res.json(
      APIResponse.success({
        packages: grouped,
        counts: {
          WEIGHT: grouped.WEIGHT.length,
          DISTANCE: grouped.DISTANCE.length,
          GENERIC: grouped.GENERIC.length,
          total:
            grouped.WEIGHT.length +
            grouped.DISTANCE.length +
            grouped.GENERIC.length,
        },
      }),
    );
  } catch (error) {
    logger.error("Error getting grouped packages by partner:", error);
    next(error);
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createChargePackage,
  listChargePackages,
  getChargePackageById,
  updateChargePackage,
  deleteChargePackage,
  getPackagesByPartner,
  getPackagesByPartnerGrouped,
};
