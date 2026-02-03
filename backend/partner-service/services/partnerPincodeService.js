/**
 * Partner Pincode Service
 *
 * Business logic for partner pincode assignment operations.
 * Following existing service patterns from pincodeTypeService.js
 *
 * Endpoints:
 * 1. GET  /api/partners/:partnerId/pincodes          - List assigned pincodes
 * 2. GET  /api/partners/:partnerId/pincodes/:id      - Get specific assignment
 * 3. POST /api/partners/:partnerId/pincodes          - Assign pincode
 * 4. PUT  /api/partners/:partnerId/pincodes/:id      - Update assignment
 * 5. DELETE /api/partners/:partnerId/pincodes/:id    - Remove assignment
 * 6. GET  /api/pincodes/search                       - Search pincodes
 * 7. POST /api/partners/:partnerId/pincodes/import   - Bulk import
 * 8. GET  /api/partners/:partnerId/pincodes/export   - Export to Excel
 * 9. GET  /api/partners/pincodes/template            - Download template
 */

const logger = require("../shared/lib/logger");
const { prisma } = require("../config/database");
const excelHandler = require("../utils/excelHandler");

/**
 * 1. Get all assigned pincodes for a partner with pagination
 * @param {string} partnerId - Partner ID (CUID)
 * @param {Object} filters - Filter and pagination options
 * @returns {Promise<Object>} Paginated list of pincode assignments
 */
async function getPartnerPincodes(partnerId, filters = {}) {
  const {
    page = 1,
    limit = 20,
    search,
    isActive,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;

  // Build where clause
  const where = { partnerId };

  if (search) {
    where.pincode = {
      code: { startsWith: search, mode: "insensitive" },
    };
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  // Build orderBy clause
  const orderByMap = {
    pincodeCode: { pincode: { code: sortOrder } },
    city: { pincode: { area: { name: sortOrder } } },
    state: { pincode: { state: { name: sortOrder } } },
    createdAt: { createdAt: sortOrder },
    updatedAt: { updatedAt: sortOrder },
  };
  const orderBy = orderByMap[sortBy] || { createdAt: "desc" };

  // Execute queries in parallel
  const [assignments, total] = await Promise.all([
    prisma.partnerPincodeAssign.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        pincode: {
          include: {
            state: { select: { name: true } },
            area: { select: { name: true } },
          },
        },
        pincodeTypeValues: {
          include: {
            pincodeType: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
    }),
    prisma.partnerPincodeAssign.count({ where }),
  ]);

  // Get all active pincode types for response structure
  const activePincodeTypes = await prisma.pincodeType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  // Transform results
  const pincodes = assignments.map((assignment) => {
    const typeValuesMap = {};
    assignment.pincodeTypeValues.forEach((ptv) => {
      typeValuesMap[ptv.pincodeType.name] = ptv.value;
    });

    return {
      id: assignment.id,
      partnerId: assignment.partnerId,
      pincodeId: assignment.pincodeId,
      pincodeCode: assignment.pincode.code,
      city:
        assignment.pincode.area?.name || assignment.pincode.areaName || null,
      state: assignment.pincode.state?.name || null,
      typeValues: typeValuesMap,
      isActive: assignment.isActive,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  });

  return {
    pincodes,
    pincodeTypes: activePincodeTypes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 2. Get specific pincode assignment by ID
 * @param {string} partnerId - Partner ID
 * @param {string} assignmentId - Assignment ID (UUID)
 * @returns {Promise<Object>} Pincode assignment details
 */
async function getPartnerPincodeById(partnerId, assignmentId) {
  const assignment = await prisma.partnerPincodeAssign.findFirst({
    where: {
      id: assignmentId,
      partnerId,
    },
    include: {
      pincode: {
        include: {
          state: { select: { name: true } },
          area: { select: { name: true } },
        },
      },
      pincodeTypeValues: {
        include: {
          pincodeType: {
            select: { id: true, name: true, type: true },
          },
        },
      },
    },
  });

  if (!assignment) {
    const error = new Error("Pincode assignment not found");
    error.statusCode = 404;
    throw error;
  }

  // Transform type values to map
  const typeValuesMap = {};
  assignment.pincodeTypeValues.forEach((ptv) => {
    typeValuesMap[ptv.pincodeType.name] = {
      id: ptv.pincodeType.id,
      value: ptv.value,
      type: ptv.pincodeType.type,
    };
  });

  return {
    id: assignment.id,
    partnerId: assignment.partnerId,
    pincodeId: assignment.pincodeId,
    pincode: {
      code: assignment.pincode.code,
      city:
        assignment.pincode.area?.name || assignment.pincode.areaName || null,
      state: assignment.pincode.state?.name || null,
      district: assignment.pincode.district || null,
    },
    typeValues: typeValuesMap,
    isActive: assignment.isActive,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

/**
 * 3. Assign pincode to partner with type values
 * @param {string} partnerId - Partner ID
 * @param {Object} data - Assignment data
 * @param {string} userId - User ID for audit log
 * @returns {Promise<Object>} Created assignment
 */
async function assignPartnerPincode(partnerId, data, userId) {
  const { pincodeId, pincodeTypeValues = [] } = data;

  // Verify partner exists
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });

  if (!partner) {
    const error = new Error("Partner not found");
    error.statusCode = 404;
    throw error;
  }

  // Verify pincode exists
  const pincode = await prisma.pincode.findUnique({
    where: { id: pincodeId },
    select: { id: true, code: true },
  });

  if (!pincode) {
    const error = new Error("Pincode not found");
    error.statusCode = 404;
    throw error;
  }

  // Check if assignment already exists
  const existing = await prisma.partnerPincodeAssign.findUnique({
    where: {
      partnerId_pincodeId: {
        partnerId,
        pincodeId,
      },
    },
  });

  if (existing) {
    const error = new Error("Pincode already assigned to this partner");
    error.statusCode = 409;
    throw error;
  }

  // Validate pincode type values
  const activePincodeTypes = await prisma.pincodeType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true },
  });

  for (const ptv of pincodeTypeValues) {
    const pincodeType = activePincodeTypes.find(
      (pt) => pt.id === ptv.pincodeTypeId,
    );
    if (!pincodeType) {
      const error = new Error(`Invalid pincode type: ${ptv.pincodeTypeId}`);
      error.statusCode = 400;
      throw error;
    }

    const validation = await excelHandler.validatePincodeTypeValue(
      ptv.pincodeTypeId,
      ptv.value,
    );

    if (!validation.isValid) {
      const error = new Error(validation.error);
      error.statusCode = 400;
      throw error;
    }
  }

  // Create assignment and type values in transaction
  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.partnerPincodeAssign.create({
      data: {
        partnerId,
        pincodeId,
      },
    });

    // Create pincode type values
    if (pincodeTypeValues.length > 0) {
      await tx.partnerPincodeTypeValue.createMany({
        data: pincodeTypeValues.map((ptv) => ({
          partnerPincodeId: assignment.id,
          pincodeTypeId: ptv.pincodeTypeId,
          value: ptv.value,
        })),
      });
    }

    return assignment;
  });

  logger.info("Pincode assigned to partner", {
    partnerId,
    pincodeId,
    assignmentId: result.id,
    userId,
  });

  // Return created assignment with details
  return getPartnerPincodeById(partnerId, result.id);
}

/**
 * 4. Update pincode assignment
 * @param {string} partnerId - Partner ID
 * @param {string} assignmentId - Assignment ID
 * @param {Object} data - Update data
 * @param {string} userId - User ID for audit log
 * @returns {Promise<Object>} Updated assignment
 */
async function updatePartnerPincode(partnerId, assignmentId, data, userId) {
  const { pincodeTypeValues, isActive } = data;

  // Verify assignment exists
  const existing = await prisma.partnerPincodeAssign.findFirst({
    where: {
      id: assignmentId,
      partnerId,
    },
  });

  if (!existing) {
    const error = new Error("Pincode assignment not found");
    error.statusCode = 404;
    throw error;
  }

  // Validate pincode type values if provided
  if (pincodeTypeValues && pincodeTypeValues.length > 0) {
    for (const ptv of pincodeTypeValues) {
      const validation = await excelHandler.validatePincodeTypeValue(
        ptv.pincodeTypeId,
        ptv.value,
      );

      if (!validation.isValid) {
        const error = new Error(validation.error);
        error.statusCode = 400;
        throw error;
      }
    }
  }

  // Update in transaction
  await prisma.$transaction(async (tx) => {
    // Update assignment
    await tx.partnerPincodeAssign.update({
      where: { id: assignmentId },
      data: {
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Update type values if provided
    if (pincodeTypeValues && pincodeTypeValues.length > 0) {
      // Delete existing type values
      await tx.partnerPincodeTypeValue.deleteMany({
        where: { partnerPincodeId: assignmentId },
      });

      // Create new type values
      await tx.partnerPincodeTypeValue.createMany({
        data: pincodeTypeValues.map((ptv) => ({
          partnerPincodeId: assignmentId,
          pincodeTypeId: ptv.pincodeTypeId,
          value: ptv.value,
        })),
      });
    }
  });

  logger.info("Pincode assignment updated", {
    partnerId,
    assignmentId,
    userId,
  });

  return getPartnerPincodeById(partnerId, assignmentId);
}

/**
 * 5. Delete (hard delete) pincode assignment
 * @param {string} partnerId - Partner ID
 * @param {string} assignmentId - Assignment ID
 * @param {string} userId - User ID for audit log
 * @returns {Promise<Object>} Success result
 */
async function deletePartnerPincode(partnerId, assignmentId, userId) {
  const existing = await prisma.partnerPincodeAssign.findFirst({
    where: {
      id: assignmentId,
      partnerId,
    },
  });

  if (!existing) {
    const error = new Error("Pincode assignment not found");
    error.statusCode = 404;
    throw error;
  }

  // Hard delete: First delete related type values, then the assignment
  await prisma.$transaction(async (tx) => {
    await tx.partnerPincodeTypeValue.deleteMany({
      where: { partnerPincodeId: assignmentId },
    });
    await tx.partnerPincodeAssign.delete({
      where: { id: assignmentId },
    });
  });

  logger.info("Pincode assignment deleted", {
    partnerId,
    assignmentId,
    userId,
  });

  return { success: true };
}

/**
 * 6. Search pincodes for autocomplete
 * @param {string} query - Search query (pincode code)
 * @param {number} limit - Max results
 * @returns {Promise<Array>} List of matching pincodes
 */
async function searchPincodes(query, limit = 10) {
  const pincodes = await prisma.pincode.findMany({
    where: {
      status: true,
      code: { startsWith: query },
    },
    select: {
      id: true,
      code: true,
    },
    orderBy: { code: "asc" },
    take: limit,
  });

  return pincodes.map((p) => ({
    id: p.id,
    code: p.code,
  }));
}

/**
 * 7. Bulk import pincodes from Excel
 * @param {string} partnerId - Partner ID
 * @param {Buffer} fileBuffer - Excel file buffer
 * @param {string} userId - User ID for audit log
 * @returns {Promise<Object>} Import results
 */
async function importPartnerPincodes(partnerId, fileBuffer, userId) {
  // Verify partner exists
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });

  if (!partner) {
    const error = new Error("Partner not found");
    error.statusCode = 404;
    throw error;
  }

  // Parse Excel file
  const parseResult = await excelHandler.parseExcel(fileBuffer);

  // Get active pincode types for validation
  const activePincodeTypes = await prisma.pincodeType.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const pincodeTypeByName = new Map(
    activePincodeTypes.map((pt) => [pt.name, pt.id]),
  );

  // Import valid rows
  const imported = [];
  const errors = [];

  for (const row of parseResult.valid) {
    try {
      // Find pincode by code
      const pincode = await excelHandler.validatePincodeExists(row.pincodeCode);

      if (!pincode) {
        errors.push({
          row: row.rowNumber,
          pincodeCode: row.pincodeCode,
          error: "Pincode not found in database",
        });
        continue;
      }

      // Check if already assigned
      const existing = await prisma.partnerPincodeAssign.findUnique({
        where: {
          partnerId_pincodeId: {
            partnerId,
            pincodeId: pincode.id,
          },
        },
      });

      if (existing) {
        errors.push({
          row: row.rowNumber,
          pincodeCode: row.pincodeCode,
          error: "Pincode already assigned to this partner",
        });
        continue;
      }

      // Build pincode type values array
      const pincodeTypeValues = [];
      for (const [typeName, value] of Object.entries(row.values)) {
        const typeId = pincodeTypeByName.get(typeName);
        if (typeId && value !== null && value !== undefined && value !== "") {
          pincodeTypeValues.push({
            pincodeTypeId: typeId,
            value: String(value),
          });
        }
      }

      // Create assignment
      const assignment = await prisma.$transaction(async (tx) => {
        const assign = await tx.partnerPincodeAssign.create({
          data: {
            partnerId,
            pincodeId: pincode.id,
          },
        });

        if (pincodeTypeValues.length > 0) {
          await tx.partnerPincodeTypeValue.createMany({
            data: pincodeTypeValues.map((ptv) => ({
              partnerPincodeId: assign.id,
              pincodeTypeId: ptv.pincodeTypeId,
              value: ptv.value,
            })),
          });
        }

        return assign;
      });

      imported.push({
        row: row.rowNumber,
        pincodeCode: row.pincodeCode,
        assignmentId: assignment.id,
      });
    } catch (err) {
      errors.push({
        row: row.rowNumber,
        pincodeCode: row.pincodeCode,
        error: err.message,
      });
    }
  }

  logger.info("Partner pincodes imported", {
    partnerId,
    imported: imported.length,
    errors: errors.length,
    userId,
  });

  return {
    partnerId,
    partnerName: partner.name,
    imported,
    errors: [
      ...parseResult.invalid.map((r) => ({
        row: r.rowNumber,
        pincodeCode: r.pincodeCode,
        error: r.errors.join(", "),
      })),
      ...parseResult.duplicates.map((r) => ({
        row: r.rowNumber,
        pincodeCode: r.pincodeCode,
        error: r.errors.join(", "),
      })),
      ...errors,
    ],
    summary: {
      total: parseResult.totalRows,
      imported: imported.length,
      failed:
        errors.length +
        parseResult.invalid.length +
        parseResult.duplicates.length,
    },
  };
}

/**
 * 8. Export assigned pincodes to Excel
 * @param {string} partnerId - Partner ID
 * @param {boolean} isActive - Filter by active status
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function exportPartnerPincodes(partnerId, isActive = true) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });

  if (!partner) {
    const error = new Error("Partner not found");
    error.statusCode = 404;
    throw error;
  }

  const where = { partnerId };
  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const assignments = await prisma.partnerPincodeAssign.findMany({
    where,
    include: {
      pincode: {
        include: {
          state: { select: { name: true } },
          area: { select: { name: true } },
        },
      },
      pincodeTypeValues: {
        include: {
          pincodeType: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { pincode: { code: "asc" } },
  });

  return excelHandler.exportData(assignments, partner.name);
}

/**
 * 9. Download Excel template
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function downloadTemplate() {
  return excelHandler.generateTemplate();
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
