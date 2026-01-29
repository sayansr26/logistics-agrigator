/**
 * Pincode Type Controller (Simplified)
 *
 * Purpose: Handle HTTP requests for pincode type management
 * Following auth-service patterns with function-based exports
 *
 * Authorization: Admin + Operations roles only (global config)
 *
 * Endpoints:
 * 1. POST   /api/v1/pincode-types           - Create pincode type
 * 2. GET    /api/v1/pincode-types           - List pincode types
 * 3. GET    /api/v1/pincode-types/:id       - Get pincode type by ID
 * 4. PUT    /api/v1/pincode-types/:id       - Update pincode type
 * 5. DELETE /api/v1/pincode-types/:id       - Soft delete pincode type
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const pincodeTypeService = require("../services/pincodeTypeService");
const { prisma } = require("../config/database");

/**
 * 1. Create pincode type
 * @route POST /api/v1/pincode-types
 * @access Admin, Operations
 */
async function createPincodeType(req, res) {
  try {
    const { name, type, isActive } = req.body;

    logger.info("Creating pincode type", {
      name,
      type,
      userId: req.user?.id,
    });

    const result = await pincodeTypeService.createPincodeType({
      name,
      type,
      isActive,
      createdBy: req.user?.id,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE_PINCODE_TYPE",
        resourceType: "PINCODE_TYPE",
        resourceId: result.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: {
          name,
          type,
          isActive,
        },
        responseData: {
          id: result.id,
          success: true,
        },
      },
    });

    logger.info("Pincode type created successfully", {
      id: result.id,
      userId: req.user?.id,
    });

    res
      .status(201)
      .json(APIResponse.success(result, "Pincode type created successfully"));
  } catch (error) {
    logger.error("Failed to create pincode type", {
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
        APIResponse.error("Failed to create pincode type", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 2. List pincode types with pagination and filtering
 * @route GET /api/v1/pincode-types
 * @access Admin, Operations
 */
async function listPincodeTypes(req, res) {
  try {
    const filters = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      search: req.query.search,
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    logger.info("Listing pincode types", {
      filters,
      userId: req.user?.id,
    });

    const result = await pincodeTypeService.getPincodeTypes(filters);

    logger.info("Pincode types listed successfully", {
      count: result.pincodeTypes.length,
      total: result.pagination.total,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to list pincode types", {
      error: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(
        APIResponse.error("Failed to retrieve pincode types", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 3. Get pincode type by ID
 * @route GET /api/v1/pincode-types/:id
 * @access Admin, Operations
 */
async function getPincodeTypeById(req, res) {
  try {
    const { id } = req.params;

    logger.info("Getting pincode type by ID", {
      id,
      userId: req.user?.id,
    });

    const pincodeType = await pincodeTypeService.getPincodeTypeById(id);

    logger.info("Pincode type retrieved successfully", {
      id,
      name: pincodeType.name,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(pincodeType));
  } catch (error) {
    logger.error("Failed to get pincode type", {
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
        APIResponse.error("Failed to retrieve pincode type", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 4. Update pincode type
 * @route PUT /api/v1/pincode-types/:id
 * @access Admin, Operations
 */
async function updatePincodeType(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info("Updating pincode type", {
      id,
      updateData,
      userId: req.user?.id,
    });

    const pincodeType = await pincodeTypeService.updatePincodeType(
      id,
      updateData,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_PINCODE_TYPE",
        resourceType: "PINCODE_TYPE",
        resourceId: pincodeType.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: updateData,
        responseData: { id: pincodeType.id, success: true },
      },
    });

    logger.info("Pincode type updated successfully", {
      id,
      name: pincodeType.name,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(pincodeType, "Pincode type updated successfully"),
    );
  } catch (error) {
    logger.error("Failed to update pincode type", {
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

    if (error.statusCode === 409) {
      return res.status(409).json(APIResponse.error(error.message, "CONFLICT"));
    }

    res
      .status(500)
      .json(
        APIResponse.error("Failed to update pincode type", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 5. Soft delete pincode type
 * @route DELETE /api/v1/pincode-types/:id
 * @access Admin, Operations
 */
async function deletePincodeType(req, res) {
  try {
    const { id } = req.params;

    logger.info("Deleting pincode type", {
      id,
      userId: req.user?.id,
    });

    const pincodeType = await pincodeTypeService.deletePincodeType(id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "DELETE_PINCODE_TYPE",
        resourceType: "PINCODE_TYPE",
        resourceId: pincodeType.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: { soft_delete: true },
        responseData: { id: pincodeType.id, success: true },
      },
    });

    logger.info("Pincode type deleted successfully", {
      id,
      name: pincodeType.name,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(pincodeType, "Pincode type deleted successfully"),
    );
  } catch (error) {
    logger.error("Failed to delete pincode type", {
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
        APIResponse.error("Failed to delete pincode type", "INTERNAL_ERROR"),
      );
  }
}

module.exports = {
  createPincodeType,
  listPincodeTypes,
  getPincodeTypeById,
  updatePincodeType,
  deletePincodeType,
};
