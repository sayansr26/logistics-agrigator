const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const APIResponse = require("../shared/lib/response");
const quoteService = require("../services/quoteService");
const logger = require("../shared/lib/logger");

/**
 * Get all partners with optional filtering, search, pagination, and sorting
 * @param {Object} filters - Filter criteria
 * @param {Object} user - Authenticated user (from req.user)
 * @returns {Promise<Object>} List of partners with pagination info
 */
async function getAllPartners(filters = {}, user = null) {
  const {
    isActive,
    supportsCOD,
    supportsReverse,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  // Build base where clause
  const where = {
    ...(typeof isActive === "boolean" && { isActive }),
    ...(typeof supportsCOD === "boolean" && { supportsCOD }),
    ...(typeof supportsReverse === "boolean" && { supportsReverse }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [partners, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            shipments: true,
            chargeConfigs: true,
          },
        },
      },
    }),
    prisma.partner.count({ where }),
  ]);

  return {
    partners,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Get a partner by ID
 * @param {string} id - Partner ID
 * @returns {Promise<Object>} Partner details
 */
async function getPartnerById(id) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          shipments: true,
          chargeConfigs: true,
          pincodeAssigns: true,
          channelConfigs: true,
        },
      },
    },
  });

  if (!partner) {
    throw new NotFoundError("Partner", id);
  }

  return partner;
}

/**
 * Create a new partner
 * @param {Object} data - Partner data
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} Created partner
 */
async function createPartner(data, req = {}) {
  // Validate required fields
  const requiredFields = ["name", "code", "displayName"];
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(", ")}`,
    );
  }

  // Check for unique constraints
  const existing = await prisma.partner.findFirst({
    where: {
      OR: [{ name: data.name }, { code: data.code }],
    },
  });

  if (existing) {
    throw new ValidationError("Partner with this name or code already exists");
  }

  const partner = await prisma.partner.create({
    data,
    include: {
      _count: {
        select: {
          shipments: true,
          chargeConfigs: true,
        },
      },
    },
  });

  // Log partner creation
  await prisma.auditLog.create({
    data: {
      action: "CREATE_PARTNER",
      resourceType: "PARTNER",
      resourceId: partner.id,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get?.("User-Agent"),
      requestData: {
        name: data.name,
        code: data.code,
        displayName: data.displayName,
        isActive: data.isActive,
      },
      responseData: {
        partnerId: partner.id,
        success: true,
      },
    },
  });

  return partner;
}

/**
 * Update a partner
 * @param {string} id - Partner ID
 * @param {Object} data - Updated partner data
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} Updated partner
 */
async function updatePartner(id, data, req = {}) {
  const partner = await prisma.partner.findUnique({ where: { id } });

  if (!partner) {
    throw new NotFoundError("Partner", id);
  }

  // Check unique constraints if name/code is being updated
  if (data.name || data.code) {
    const existing = await prisma.partner.findFirst({
      where: {
        OR: [
          data.name ? { name: data.name } : null,
          data.code ? { code: data.code } : null,
        ].filter(Boolean),
        NOT: { id },
      },
    });

    if (existing) {
      throw new ValidationError(
        "Partner with this name or code already exists",
      );
    }
  }

  const updatedPartner = await prisma.partner.update({
    where: { id },
    data,
    include: {
      _count: {
        select: {
          shipments: true,
          chargeConfigs: true,
        },
      },
    },
  });

  // Log partner update
  await prisma.auditLog.create({
    data: {
      action: "UPDATE_PARTNER",
      resourceType: "PARTNER",
      resourceId: id,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get?.("User-Agent"),
      requestData: data,
      responseData: {
        partnerId: id,
        success: true,
        changes: Object.keys(data),
      },
    },
  });

  return updatedPartner;
}

/**
 * Delete a partner
 * @param {string} id - Partner ID
 * @param {Object} req - Request object for audit logging
 * @returns {Promise<Object>} Deleted partner
 */
async function deletePartner(id, req = {}) {
  const partner = await prisma.partner.findUnique({ where: { id } });

  if (!partner) {
    throw new NotFoundError("Partner", id);
  }

  // Check if partner has any active shipments
  const activeShipments = await prisma.partnerShipment.count({
    where: {
      partnerId: id,
      status: {
        notIn: ["DELIVERED", "CANCELLED", "RETURNED"],
      },
    },
  });

  if (activeShipments > 0) {
    throw new ValidationError("Cannot delete partner with active shipments");
  }

  const deletedPartner = await prisma.partner.delete({ where: { id } });

  // Log partner deletion
  await prisma.auditLog.create({
    data: {
      action: "DELETE_PARTNER",
      resourceType: "PARTNER",
      resourceId: id,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get?.("User-Agent"),
      requestData: { partnerId: id },
      responseData: {
        partnerId: id,
        partnerName: partner.name,
        success: true,
      },
    },
  });

  return deletedPartner;
}

/**
 * Check serviceability for given parameters (Charges Engine v3).
 *
 * @param {Object} params - Serviceability check parameters
 * @returns {Promise<Object>} Serviceability results
 */
async function checkServiceability(params) {
  const { fromPincode, toPincode, partnerId } = params;

  if (!fromPincode || !toPincode) {
    throw new ValidationError("fromPincode and toPincode are required");
  }

  const serviceabilityResult = await quoteService.checkServiceability({
    fromPincode,
    toPincode,
    partnerId,
  });

  const results = serviceabilityResult.serviceability.map((item) => ({
    partnerId: item.partnerId,
    partnerName: item.partnerName,
    isServiceable: item.serviceable,
    serviceable: item.serviceable,
    distanceKm: item.distanceKm,
    zoneSuffix: item.zoneSuffix,
    zoneId: item.zoneId,
    zoneName: item.zoneName,
    estimatedDays: item.estimatedDays,
    deliveryDays: item.estimatedDays,
    serviceTypes: ["standard"],
    cod: true,
    prepaid: true,
    error: item.error,
  }));

  logger.info("Serviceability check successful", {
    fromPincode,
    toPincode,
    serviceableCount: serviceabilityResult.serviceableCount,
    totalPartners: serviceabilityResult.totalPartners,
  });

  return {
    serviceability: results,
    summary: {
      fromPincode,
      toPincode,
      serviceableCount: serviceabilityResult.serviceableCount,
      totalPartners: serviceabilityResult.totalPartners,
    },
  };
}

module.exports = {
  getAllPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  deletePartner,
  checkServiceability,
};
