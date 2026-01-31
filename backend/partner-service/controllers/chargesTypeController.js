/**
 * Charges Type Controller
 *
 * Purpose: Handle HTTP requests for partner-specific charges type management
 * Following auth-service patterns with function-based exports
 *
 * Authorization: Admin + Operations roles only
 *
 * Endpoints:
 * 1. POST   /api/v1/charges-types           - Create charges type
 * 2. GET    /api/v1/charges-types           - List charges types
 * 3. GET    /api/v1/charges-types/:id       - Get charges type by ID
 * 4. PUT    /api/v1/charges-types/:id       - Update charges type
 * 5. DELETE /api/v1/charges-types/:id       - Soft delete charges type
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const chargesTypeService = require("../services/chargesTypeService");
const { prisma } = require("../config/database");

/**
 * 1. Create charges type
 * @route POST /api/v1/charges-types
 * @access Admin, Operations
 */
async function createChargesType(req, res) {
  try {
    const { partnerId, name, isActive } = req.body;

    logger.info("Creating charges type", {
      partnerId,
      name,
      userId: req.user?.id,
    });

    const result = await chargesTypeService.createChargesType({
      partnerId,
      name,
      isActive,
      createdBy: req.user?.id,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE_CHARGES_TYPE",
        resourceType: "CHARGES_TYPE",
        resourceId: result.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: {
          partnerId,
          name,
          isActive,
        },
        responseData: {
          id: result.id,
          success: true,
        },
      },
    });

    logger.info("Charges type created successfully", {
      id: result.id,
      name: result.name,
      partnerId: result.partnerId,
      userId: req.user?.id,
    });

    res
      .status(201)
      .json(APIResponse.success(result, "Charges type created successfully"));
  } catch (error) {
    logger.error("Failed to create charges type", {
      error: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.user?.id,
    });

    if (error.statusCode === 409) {
      return res.status(409).json(APIResponse.error(error.message, "CONFLICT"));
    }

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
      .json(
        APIResponse.error("Failed to create charges type", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 2. List charges types with pagination and filtering
 * @route GET /api/v1/charges-types
 * @access Admin, Operations
 */
async function listChargesTypes(req, res) {
  try {
    const filters = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      partnerId: req.query.partnerId,
      search: req.query.search,
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    };

    logger.info("Listing charges types", {
      filters,
      userId: req.user?.id,
    });

    const result = await chargesTypeService.getChargesTypes(filters);

    logger.info("Charges types listed successfully", {
      count: result.chargesTypes.length,
      total: result.pagination.total,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to list charges types", {
      error: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(
        APIResponse.error("Failed to retrieve charges types", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 3. Get charges type by ID
 * @route GET /api/v1/charges-types/:id
 * @access Admin, Operations
 */
async function getChargesTypeById(req, res) {
  try {
    const { id } = req.params;

    logger.info("Getting charges type by ID", {
      id,
      userId: req.user?.id,
    });

    const chargesType = await chargesTypeService.getChargesTypeById(id);

    logger.info("Charges type retrieved successfully", {
      id,
      name: chargesType.name,
      partnerId: chargesType.partnerId,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(chargesType));
  } catch (error) {
    logger.error("Failed to get charges type", {
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
        APIResponse.error("Failed to retrieve charges type", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 4. Update charges type
 * @route PUT /api/v1/charges-types/:id
 * @access Admin, Operations
 */
async function updateChargesType(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info("Updating charges type", {
      id,
      updateData,
      userId: req.user?.id,
    });

    const chargesType = await chargesTypeService.updateChargesType(
      id,
      updateData,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CHARGES_TYPE",
        resourceType: "CHARGES_TYPE",
        resourceId: chargesType.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: updateData,
        responseData: { id: chargesType.id, success: true },
      },
    });

    logger.info("Charges type updated successfully", {
      id,
      name: chargesType.name,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(chargesType, "Charges type updated successfully"),
    );
  } catch (error) {
    logger.error("Failed to update charges type", {
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
        APIResponse.error("Failed to update charges type", "INTERNAL_ERROR"),
      );
  }
}

/**
 * 5. Soft delete charges type
 * @route DELETE /api/v1/charges-types/:id
 * @access Admin, Operations
 */
async function deleteChargesType(req, res) {
  try {
    const { id } = req.params;

    logger.info("Deleting charges type", {
      id,
      userId: req.user?.id,
    });

    const chargesType = await chargesTypeService.deleteChargesType(id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "DELETE_CHARGES_TYPE",
        resourceType: "CHARGES_TYPE",
        resourceId: chargesType.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: { soft_delete: true },
        responseData: { id: chargesType.id, success: true },
      },
    });

    logger.info("Charges type deleted successfully", {
      id,
      name: chargesType.name,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(chargesType, "Charges type deleted successfully"),
    );
  } catch (error) {
    logger.error("Failed to delete charges type", {
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
        APIResponse.error("Failed to delete charges type", "INTERNAL_ERROR"),
      );
  }
}

module.exports = {
  createChargesType,
  listChargesTypes,
  getChargesTypeById,
  updateChargesType,
  deleteChargesType,
};
