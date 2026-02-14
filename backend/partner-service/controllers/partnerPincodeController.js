/**
 * Partner Pincode Controller
 *
 * Purpose: Handle HTTP requests for partner pincode assignment management
 * Following existing pincodeTypeController patterns
 *
 * Authorization: Admin roles only (superadmin, admin)
 *
 * Endpoints:
 * 1. GET    /api/partners/:partnerId/pincodes           - List assigned pincodes
 * 2. GET    /api/partners/:partnerId/pincodes/:id       - Get specific assignment
 * 3. POST   /api/partners/:partnerId/pincodes           - Assign pincode
 * 4. PUT    /api/partners/:partnerId/pincodes/:id       - Update assignment
 * 5. DELETE /api/partners/:partnerId/pincodes/:id       - Remove assignment
 * 6. GET    /api/pincodes/search                        - Search pincodes
 * 7. POST   /api/partners/:partnerId/pincodes/import    - Bulk import
 * 8. GET    /api/partners/:partnerId/pincodes/export    - Export to Excel
 * 9. GET    /api/partners/pincodes/template             - Download template
 */

const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");
const partnerPincodeService = require("../services/partnerPincodeService");
const { getGeographicalService } = require("../services/geographicalService");
const { prisma } = require("../config/database");

/**
 * 1. Get all assigned pincodes for a partner
 * @route GET /api/partners/:partnerId/pincodes
 * @access Admin
 */
async function getPartnerPincodes(req, res) {
  try {
    const { partnerId } = req.params;
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

    logger.info("Listing partner pincodes", {
      partnerId,
      filters,
      userId: req.user?.id,
    });

    const result = await partnerPincodeService.getPartnerPincodes(
      partnerId,
      filters,
    );

    logger.info("Partner pincodes listed successfully", {
      partnerId,
      count: result.pincodes.length,
      total: result.pagination.total,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(result));
  } catch (error) {
    logger.error("Failed to list partner pincodes", {
      error: error.message,
      stack: error.stack,
      params: req.params,
      query: req.query,
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
          "Failed to retrieve partner pincodes",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 2. Get specific pincode assignment by ID
 * @route GET /api/partners/:partnerId/pincodes/:id
 * @access Admin
 */
async function getPartnerPincodeById(req, res) {
  try {
    const { partnerId, id: assignmentId } = req.params;

    logger.info("Getting partner pincode by ID", {
      partnerId,
      assignmentId,
      userId: req.user?.id,
    });

    const assignment = await partnerPincodeService.getPartnerPincodeById(
      partnerId,
      assignmentId,
    );

    logger.info("Partner pincode retrieved successfully", {
      partnerId,
      assignmentId,
      userId: req.user?.id,
    });

    res.json(APIResponse.success(assignment));
  } catch (error) {
    logger.error("Failed to get partner pincode", {
      error: error.message,
      stack: error.stack,
      params: req.params,
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
          "Failed to retrieve partner pincode",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 3. Assign pincode to partner
 * @route POST /api/partners/:partnerId/pincodes
 * @access Admin
 */
async function assignPartnerPincode(req, res) {
  try {
    const { partnerId } = req.params;
    const { pincodeId, pincodeTypeValues } = req.body;

    logger.info("Assigning pincode to partner", {
      partnerId,
      pincodeId,
      pincodeTypeValues,
      userId: req.user?.id,
    });

    const result = await partnerPincodeService.assignPartnerPincode(
      partnerId,
      req.body,
      req.user?.id,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "ASSIGN_PARTNER_PINCODE",
        resourceType: "PARTNER_PINCODE",
        resourceId: result.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: {
          partnerId,
          pincodeId,
          pincodeTypeValues,
        },
        responseData: {
          id: result.id,
          success: true,
        },
      },
    });

    logger.info("Pincode assigned to partner successfully", {
      partnerId,
      assignmentId: result.id,
      userId: req.user?.id,
    });

    res
      .status(201)
      .json(
        APIResponse.success(result, "Pincode assigned to partner successfully"),
      );
  } catch (error) {
    logger.error("Failed to assign pincode to partner", {
      error: error.message,
      stack: error.stack,
      params: req.params,
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

    if (error.statusCode === 400) {
      return res
        .status(400)
        .json(APIResponse.error(error.message, "VALIDATION_ERROR"));
    }

    res
      .status(500)
      .json(
        APIResponse.error(
          "Failed to assign pincode to partner",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 4. Update pincode assignment
 * @route PUT /api/partners/:partnerId/pincodes/:id
 * @access Admin
 */
async function updatePartnerPincode(req, res) {
  try {
    const { partnerId, id: assignmentId } = req.params;
    const updateData = req.body;

    logger.info("Updating partner pincode assignment", {
      partnerId,
      assignmentId,
      updateData,
      userId: req.user?.id,
    });

    const assignment = await partnerPincodeService.updatePartnerPincode(
      partnerId,
      assignmentId,
      updateData,
      req.user?.id,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_PARTNER_PINCODE",
        resourceType: "PARTNER_PINCODE",
        resourceId: assignment.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: updateData,
        responseData: { id: assignment.id, success: true },
      },
    });

    logger.info("Partner pincode assignment updated successfully", {
      partnerId,
      assignmentId,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(
        assignment,
        "Pincode assignment updated successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to update partner pincode assignment", {
      error: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
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
      .json(
        APIResponse.error(
          "Failed to update pincode assignment",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 5. Delete (soft delete) pincode assignment
 * @route DELETE /api/partners/:partnerId/pincodes/:id
 * @access Admin
 */
async function deletePartnerPincode(req, res) {
  try {
    const { partnerId, id: assignmentId } = req.params;

    logger.info("Deleting partner pincode assignment", {
      partnerId,
      assignmentId,
      userId: req.user?.id,
    });

    await partnerPincodeService.deletePartnerPincode(
      partnerId,
      assignmentId,
      req.user?.id,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "DELETE_PARTNER_PINCODE",
        resourceType: "PARTNER_PINCODE",
        resourceId: assignmentId,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: { hard_delete: true },
        responseData: { id: assignmentId, success: true },
      },
    });

    logger.info("Partner pincode assignment deleted successfully", {
      partnerId,
      assignmentId,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(
        { id: assignmentId, deleted: true },
        "Pincode assignment deleted successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to delete partner pincode assignment", {
      error: error.message,
      stack: error.stack,
      params: req.params,
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
          "Failed to delete pincode assignment",
          "INTERNAL_ERROR",
        ),
      );
  }
}

/**
 * 6. Search pincodes for autocomplete (DEPRECATED - use /api/v1/geography/pincodes/search)
 * @route GET /api/pincodes/search
 * @access Admin
 */
async function searchPincodes(req, res) {
  try {
    const query = req.query.q || req.query.code;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;

    if (!query) {
      return res
        .status(400)
        .json(
          APIResponse.error(
            "Search query 'q' or 'code' is required",
            "VALIDATION_ERROR",
          ),
        );
    }

    logger.warn("Deprecated pincode search endpoint used", {
      endpoint: "/api/v1/pincodes/search",
      successor: "/api/v1/geography/pincodes/search",
      query,
      limit,
      userId: req.user?.id,
    });

    const geographicalService = getGeographicalService();
    const result = await geographicalService.searchPincodes({
      pincode: query,
      page: 1,
      limit,
      sortBy: "code",
    });

    if (!result.success) {
      return res
        .status(500)
        .json(
          APIResponse.error(
            result.error || "Pincode search failed",
            "SERVICE_ERROR",
          ),
        );
    }

    logger.info("Deprecated endpoint served pincode search successfully", {
      query,
      count: result.data?.length || 0,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success({
        pincodes: result.data || [],
        pagination: result.pagination,
      }),
    );
  } catch (error) {
    logger.error("Failed to search pincodes", {
      error: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(APIResponse.error("Failed to search pincodes", "INTERNAL_ERROR"));
  }
}

/**
 * 7. Bulk import pincodes from Excel
 * @route POST /api/partners/:partnerId/pincodes/import
 * @access Admin
 */
async function importPartnerPincodes(req, res) {
  try {
    const { partnerId } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json(APIResponse.error("No file uploaded", "VALIDATION_ERROR"));
    }

    logger.info("Importing pincodes for partner", {
      partnerId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      userId: req.user?.id,
    });

    const result = await partnerPincodeService.importPartnerPincodes(
      partnerId,
      req.file.buffer,
      req.user?.id,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "IMPORT_PARTNER_PINCODES",
        resourceType: "PARTNER_PINCODE",
        resourceId: partnerId,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        requestData: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
        },
        responseData: {
          imported: result.imported.length,
          failed: result.errors.length,
          success: true,
        },
      },
    });

    logger.info("Partner pincodes imported successfully", {
      partnerId,
      imported: result.imported.length,
      failed: result.errors.length,
      userId: req.user?.id,
    });

    res.json(
      APIResponse.success(result, "Pincode import completed successfully"),
    );
  } catch (error) {
    logger.error("Failed to import partner pincodes", {
      error: error.message,
      stack: error.stack,
      params: req.params,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to import pincodes", "INTERNAL_ERROR"));
  }
}

/**
 * 8. Export assigned pincodes to Excel
 * @route GET /api/partners/:partnerId/pincodes/export
 * @access Admin
 */
async function exportPartnerPincodes(req, res) {
  try {
    const { partnerId } = req.params;
    const isActive =
      req.query.isActive !== undefined ? req.query.isActive === "true" : true;

    logger.info("Exporting pincodes for partner", {
      partnerId,
      isActive,
      userId: req.user?.id,
    });

    const buffer = await partnerPincodeService.exportPartnerPincodes(
      partnerId,
      isActive,
    );

    logger.info("Partner pincodes exported successfully", {
      partnerId,
      userId: req.user?.id,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=partner-${partnerId}-pincodes.xlsx`,
    );
    res.send(buffer);
  } catch (error) {
    logger.error("Failed to export partner pincodes", {
      error: error.message,
      stack: error.stack,
      params: req.params,
      userId: req.user?.id,
    });

    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(APIResponse.error(error.message, "NOT_FOUND"));
    }

    res
      .status(500)
      .json(APIResponse.error("Failed to export pincodes", "INTERNAL_ERROR"));
  }
}

/**
 * 9. Download Excel template
 * @route GET /api/partners/pincodes/template
 * @access Admin
 */
async function downloadTemplate(req, res) {
  try {
    logger.info("Downloading pincode template", {
      userId: req.user?.id,
    });

    const buffer = await partnerPincodeService.downloadTemplate();

    logger.info("Pincode template downloaded successfully", {
      userId: req.user?.id,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="pincode-import-template.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    logger.error("Failed to download template", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res
      .status(500)
      .json(APIResponse.error("Failed to download template", "INTERNAL_ERROR"));
  }
}

module.exports = {
  getPartnerPincodes,
  getPartnerPincodeById,
  assignPartnerPincode,
  updatePartnerPincode,
  deletePartnerPincode,
  searchPincodes,
  importPartnerPincodes,
  exportPartnerPincodes,
  downloadTemplate,
};
