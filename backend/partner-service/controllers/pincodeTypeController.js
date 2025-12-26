/**
 * Pincode Type Controller
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
 * 6. POST   /api/v1/pincode-types/:id/assign   - Bulk assign pincodes
 * 7. DELETE /api/v1/pincode-types/:id/unassign - Bulk unassign pincodes
 * 8. GET    /api/v1/pincode-types/:id/pincodes - Get assigned pincodes
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const pincodeTypeService = require("../services/pincodeTypeService");
const { prisma } = require("../config/database");

/**
 * 1. Create a new pincode type
 * @route POST /api/v1/pincode-types
 * @access Admin, Operations
 */
async function createPincodeType(req, res) {
  try {
    const { name, charge, description, isActive } = req.body;

    logger.info("Creating pincode type", {
      name,
      charge,
      userId: req.user?.id,
    });

    const pincodeType = await pincodeTypeService.createPincodeType({
      name,
      charge,
      description,
      isActive,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "PINCODE_TYPE_CREATED",
        resourceType: "PINCODE_TYPE",
        resourceId: pincodeType.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: { name, charge, description, isActive },
        responseData: { id: pincodeType.id, success: true },
      },
    });

    logger.info("Pincode type created successfully", {
      id: pincodeType.id,
      name: pincodeType.name,
      userId: req.user?.id,
    });

    res
      .status(201)
      .json(
        APIResponse.success(pincodeType, "Pincode type created successfully"),
      );
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
        action: "PINCODE_TYPE_UPDATED",
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
        action: "PINCODE_TYPE_DELETED",
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

/**
 * 6. Bulk assign pincodes to type
 * @route POST /api/v1/pincode-types/:id/assign
 * @access Admin, Operations
 */
async function assignPincodes(req, res) {
  try {
    const { id } = req.params;
    const { pincodeCodes } = req.body;

    logger.info("Assigning pincodes to type", {
      typeId: id,
      pincodeCount: pincodeCodes.length,
      userId: req.user?.id,
    });

    const result = await pincodeTypeService.assignPincodesToType(
      id,
      pincodeCodes,
      req.user?.id,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "PINCODE_TYPE_ASSIGNED",
        resourceType: "PINCODE_TYPE",
        resourceId: id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: {
          pincodeCount: pincodeCodes.length,
          sampleCodes: pincodeCodes.slice(0, 10),
        },
        responseData: result,
      },
    });

    logger.info("Pincodes assigned to type successfully", {
      typeId: id,
      result,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result, "Pincodes assigned successfully"));
  } catch (error) {
    logger.error("Failed to assign pincodes to type", {
      error: error.message,
      stack: error.stack,
      typeId: req.params.id,
      pincodeCount: req.body.pincodeCodes?.length,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    if (error.statusCode === 400) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to assign pincodes", "INTERNAL_ERROR"));
  }
}

/**
 * 7. Bulk unassign pincodes from type
 * @route DELETE /api/v1/pincode-types/:id/unassign
 * @access Admin, Operations
 */
async function unassignPincodes(req, res) {
  try {
    const { id } = req.params;
    const { pincodeCodes } = req.body;

    logger.info("Unassigning pincodes from type", {
      typeId: id,
      pincodeCount: pincodeCodes.length,
      userId: req.user?.id,
    });

    const result = await pincodeTypeService.unassignPincodesFromType(
      id,
      pincodeCodes,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "PINCODE_TYPE_UNASSIGNED",
        resourceType: "PINCODE_TYPE",
        resourceId: id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: {
          pincodeCount: pincodeCodes.length,
          sampleCodes: pincodeCodes.slice(0, 10),
        },
        responseData: result,
      },
    });

    logger.info("Pincodes unassigned from type successfully", {
      typeId: id,
      result,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result, "Pincodes unassigned successfully"));
  } catch (error) {
    logger.error("Failed to unassign pincodes from type", {
      error: error.message,
      stack: error.stack,
      typeId: req.params.id,
      pincodeCount: req.body.pincodeCodes?.length,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to unassign pincodes", "INTERNAL_ERROR"));
  }
}

/**
 * 8. Get pincodes assigned to a type
 * @route GET /api/v1/pincode-types/:id/pincodes
 * @access Admin, Operations
 */
async function getAssignedPincodes(req, res) {
  try {
    const { id } = req.params;
    const filters = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      search: req.query.search,
    };

    logger.info("Getting pincodes assigned to type", {
      typeId: id,
      filters,
      userId: req.user?.id,
    });

    const result = await pincodeTypeService.getPincodesByType(id, filters);

    logger.info("Pincodes by type retrieved successfully", {
      typeId: id,
      count: result.pincodes.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to get pincodes by type", {
      error: error.message,
      stack: error.stack,
      typeId: req.params.id,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to retrieve pincodes", "INTERNAL_ERROR"));
  }
}

/**
 * 9. Get types assigned to a pincode
 * @route GET /api/v1/pincodes/:code/types
 * @access Admin, Operations
 */
async function getTypesByPincode(req, res) {
  try {
    const { code } = req.params;

    logger.info("Getting types for pincode", {
      code,
      userId: req.user?.id,
    });

    const result = await pincodeTypeService.getTypesByPincode(code);

    logger.info("Types by pincode retrieved successfully", {
      code,
      typeCount: result.types.length,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to get types by pincode", {
      error: error.message,
      stack: error.stack,
      code: req.params.code,
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
        APIResponse.error("Failed to retrieve pincode types", "INTERNAL_ERROR"),
      );
  }
}

module.exports = {
  createPincodeType,
  listPincodeTypes,
  getPincodeTypeById,
  updatePincodeType,
  deletePincodeType,
  assignPincodes,
  unassignPincodes,
  getAssignedPincodes,
  getTypesByPincode,
};
