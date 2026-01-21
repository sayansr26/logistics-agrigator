/**
 * Pincode Type Service Charge Controller
 *
 * Purpose: Handle HTTP requests for pincode type service charge management
 * Following auth-service patterns with function-based exports
 *
 * Authorization: Admin + Operations roles only (global config)
 *
 * Endpoints:
 * 1. POST   /api/v1/pincode-type-service-charges                      - Create charge(s)
 * 2. GET    /api/v1/pincode-type-service-charges                      - List all charges
 * 3. GET    /api/v1/pincode-type-service-charges/:id                  - Get charge by ID
 * 4. PUT    /api/v1/pincode-type-service-charges/:id                  - Update charge
 * 5. DELETE /api/v1/pincode-type-service-charges/:id                  - Soft delete charge
 * 6. GET    /api/v1/pincode-type-service-charges/type/:pincodeTypeId  - Charges by pincode type
 * 7. GET    /api/v1/pincode-type-service-charges/partner/:partnerId    - Charges by partner
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const pincodeTypeServiceChargeService = require("../services/pincodeTypeServiceChargeService");
const { prisma } = require("../config/database");

/**
 * 1. Create service charges for pincode type x partner combinations
 * Supports bulk creation: multiple types x multiple partners
 * @route POST /api/v1/pincode-type-service-charges
 * @access Admin, Operations
 */
async function createCharge(req, res) {
  try {
    const { pincodeTypeIds, partnerIds, baseCharge, isActive } = req.body;

    logger.info("Creating pincode type service charges", {
      pincodeTypeCount: pincodeTypeIds?.length,
      partnerCount: partnerIds?.length,
      baseCharge,
      userId: req.user?.id,
    });

    const result = await pincodeTypeServiceChargeService.createCharge({
      pincodeTypeIds,
      partnerIds,
      baseCharge,
      isActive,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "PINCODE_TYPE_SERVICE_CHARGE_CREATED",
        resourceType: "PINCODE_TYPE_SERVICE_CHARGE",
        resourceId: result.charges?.[0]?.id || null,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: {
          pincodeTypeIds,
          partnerIds,
          baseCharge,
          isActive,
          createdCount: result.createdCount,
        },
        responseData: {
          createdCount: result.createdCount,
          totalCombinations: result.totalCombinations,
          success: true,
        },
      },
    });

    logger.info("Service charges created successfully", {
      createdCount: result.createdCount,
      userId: req.user?.id,
    });

    res
      .status(201)
      .json(
        APIResponse.success(result, "Service charges created successfully"),
      );
  } catch (error) {
    logger.error("Failed to create service charges", {
      error: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.user?.id,
    });

    if (error.statusCode === 409) {
      return res.status(409).json(APIResponse.error(error.message, "CONFLICT"));
    }

    if (error.statusCode === 400) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to create service charges", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 2. List all service charges with pagination and filtering
 * @route GET /api/v1/pincode-type-service-charges
 * @access Admin, Operations
 */
async function listCharges(req, res) {
  try {
    const filters = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      pincodeTypeId: req.query.pincodeTypeId,
      partnerId: req.query.partnerId,
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    logger.info("Listing service charges", {
      filters,
      userId: req.user?.id,
    });

    const result = await pincodeTypeServiceChargeService.getCharges(filters);

    logger.info("Service charges listed successfully", {
      count: result.charges.length,
      total: result.pagination.total,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to list service charges", {
      error: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve service charges",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 3. Get service charge by ID
 * @route GET /api/v1/pincode-type-service-charges/:id
 * @access Admin, Operations
 */
async function getChargeById(req, res) {
  try {
    const { id } = req.params;

    logger.info("Getting service charge by ID", {
      id,
      userId: req.user?.id,
    });

    const charge = await pincodeTypeServiceChargeService.getChargeById(id);

    logger.info("Service charge retrieved successfully", {
      id,
      pincodeType: charge.pincodeType?.name,
      partner: charge.partner?.name,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(charge));
  } catch (error) {
    logger.error("Failed to get service charge", {
      error: error.message,
      stack: error.stack,
      id: req.params.id,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve service charge",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 4. Update service charge
 * @route PUT /api/v1/pincode-type-service-charges/:id
 * @access Admin, Operations
 */
async function updateCharge(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info("Updating service charge", {
      id,
      updateData,
      userId: req.user?.id,
    });

    const charge = await pincodeTypeServiceChargeService.updateCharge(
      id,
      updateData,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "PINCODE_TYPE_SERVICE_CHARGE_UPDATED",
        resourceType: "PINCODE_TYPE_SERVICE_CHARGE",
        resourceId: charge.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: updateData,
        responseData: {
          id: charge.id,
          baseCharge: charge.baseCharge,
          success: true,
        },
      },
    });

    logger.info("Service charge updated successfully", {
      id,
      baseCharge: charge.baseCharge,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(charge, "Service charge updated successfully"),
    );
  } catch (error) {
    logger.error("Failed to update service charge", {
      error: error.message,
      stack: error.stack,
      id: req.params.id,
      body: req.body,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to update service charge", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 5. Soft delete service charge
 * @route DELETE /api/v1/pincode-type-service-charges/:id
 * @access Admin, Operations
 */
async function deleteCharge(req, res) {
  try {
    const { id } = req.params;

    logger.info("Deleting service charge", {
      id,
      userId: req.user?.id,
    });

    const charge = await pincodeTypeServiceChargeService.deleteCharge(id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "PINCODE_TYPE_SERVICE_CHARGE_DELETED",
        resourceType: "PINCODE_TYPE_SERVICE_CHARGE",
        resourceId: charge.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: { soft_delete: true },
        responseData: {
          id: charge.id,
          baseCharge: charge.baseCharge,
          success: true,
        },
      },
    });

    logger.info("Service charge deleted successfully", {
      id,
      pincodeType: charge.pincodeType?.name,
      partner: charge.partner?.name,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(charge, "Service charge deleted successfully"),
    );
  } catch (error) {
    logger.error("Failed to delete service charge", {
      error: error.message,
      stack: error.stack,
      id: req.params.id,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to delete service charge", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 6. Get charges by pincode type
 * @route GET /api/v1/pincode-type-service-charges/type/:pincodeTypeId
 * @access Admin, Operations
 */
async function getChargesByPincodeType(req, res) {
  try {
    const { pincodeTypeId } = req.params;
    const filters = {
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
    };

    logger.info("Getting charges by pincode type", {
      pincodeTypeId,
      filters,
      userId: req.user?.id,
    });

    const result =
      await pincodeTypeServiceChargeService.getChargesByPincodeType(
        pincodeTypeId,
        filters,
      );

    logger.info("Charges by pincode type retrieved successfully", {
      pincodeTypeId,
      count: result.charges.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to get charges by pincode type", {
      error: error.message,
      stack: error.stack,
      pincodeTypeId: req.params.pincodeTypeId,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve charges by pincode type",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 7. Get charges by partner
 * @route GET /api/v1/pincode-type-service-charges/partner/:partnerId
 * @access Admin, Operations
 */
async function getChargesByPartner(req, res) {
  try {
    const { partnerId } = req.params;
    const filters = {
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
    };

    logger.info("Getting charges by partner", {
      partnerId,
      filters,
      userId: req.user?.id,
    });

    const result = await pincodeTypeServiceChargeService.getChargesByPartner(
      partnerId,
      filters,
    );

    logger.info("Charges by partner retrieved successfully", {
      partnerId,
      count: result.charges.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to get charges by partner", {
      error: error.message,
      stack: error.stack,
      partnerId: req.params.partnerId,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to retrieve charges by partner",
          "INTERNAL_ERROR",
        ),
      );
  }
}

module.exports = {
  createCharge,
  listCharges,
  getChargeById,
  updateCharge,
  deleteCharge,
  getChargesByPincodeType,
  getChargesByPartner,
};
