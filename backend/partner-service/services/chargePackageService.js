/**
 * Charge Package Service
 *
 * Manages charge packages for partners (WEIGHT, DISTANCE, GENERIC types).
 * Supports multi-partner creation and comprehensive audit logging.
 * Following auth-service patterns.
 */

const { prisma } = require("../config/database");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Build where clause for listing packages
 * Supports customerId filtering for outlet tenant scoping
 */
function buildWhereClause(filters) {
  const { partnerId, type, isActive, search, customerId } = filters;
  const where = {};

  if (partnerId) {
    where.partnerId = partnerId;
  }

  if (type) {
    where.type = type;
  }

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  if (search) {
    where.name = {
      contains: search,
      mode: "insensitive",
    };
  }

  // Filter by customerId for outlet tenant scoping
  // Shows outlet-specific packages + global packages (customerId=null)
  if (customerId) {
    where.OR = [
      { customerId: customerId },
      { customerId: null }, // Include global packages
    ];
  }

  return where;
}

/**
 * Create audit log entry
 */
async function createAuditLog(action, resourceId, data, reqContext = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        resourceType: "CHARGE_PACKAGE",
        resourceId,
        userId: reqContext.userId || null,
        ipAddress: reqContext.ip || null,
        userAgent: reqContext.userAgent || null,
        requestData: data.request || null,
        responseData: data.response || null,
      },
    });
  } catch (error) {
    logger.error("Failed to create audit log:", error);
    // Don't throw - audit log failure shouldn't fail the main operation
  }
}

// ========================================
// CRUD OPERATIONS
// ========================================

/**
 * Create charge packages for one or more partners
 *
 * @param {Object} packageData - Package configuration
 * @param {string[]} packageData.partnerIds - Array of partner IDs
 * @param {string} packageData.name - Package name
 * @param {string} packageData.type - WEIGHT, DISTANCE, or GENERIC
 * @param {number} packageData.baseCharge - Base charge amount
 * @param {number} [packageData.baseUnit] - Base unit (kg/km) included in baseCharge
 * @param {number} [packageData.addonUnit] - Additional unit size for addon charges
 * @param {number} [packageData.addonCharge] - Charge per addon unit
 * @param {string} [packageData.appliesTo] - ANY, COD, or PREPAID (for GENERIC)
 * @param {string} [packageData.calcType] - FLAT, PERCENTAGE_OF_COD, etc. (for GENERIC)
 * @param {Object} [packageData.metadata] - Additional metadata
 * @param {boolean} [packageData.isActive] - Active status
 * @param {Object} reqContext - Request context for audit logging
 * @returns {Promise<Object>} Created packages summary
 */
async function createChargePackages(packageData, reqContext = {}) {
  const {
    partnerIds,
    name,
    type,
    baseCharge,
    baseUnit,
    addonUnit,
    addonCharge,
    appliesTo = "ANY",
    calcType = "FLAT",
    metadata = null,
    isActive = true,
  } = packageData;

  // Verify all partner IDs exist
  const partners = await prisma.partner.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, name: true },
  });

  if (partners.length !== partnerIds.length) {
    const foundIds = partners.map((p) => p.id);
    const missingIds = partnerIds.filter((id) => !foundIds.includes(id));
    throw new ValidationError(`Partners not found: ${missingIds.join(", ")}`);
  }

  // Check for existing packages with same name for these partners
  const existingPackages = await prisma.chargePackage.findMany({
    where: {
      partnerId: { in: partnerIds },
      name,
    },
    select: { partnerId: true },
  });

  if (existingPackages.length > 0) {
    const conflictPartnerIds = existingPackages.map((p) => p.partnerId);
    throw new ConflictError(
      `Package "${name}" already exists for partners: ${conflictPartnerIds.join(", ")}`,
    );
  }

  // Build package data for each partner
  const packagesToCreate = partnerIds.map((partnerId) => ({
    partnerId,
    name,
    type,
    baseCharge,
    ...(type !== "GENERIC" && {
      baseUnit,
      addonUnit,
      addonCharge,
    }),
    ...(type === "GENERIC" && {
      appliesTo,
      calcType,
    }),
    metadata,
    isActive,
  }));

  // Create all packages in a transaction
  const createdPackages = await prisma.$transaction(
    packagesToCreate.map((pkg) =>
      prisma.chargePackage.create({
        data: pkg,
        include: {
          partner: {
            select: { id: true, name: true, displayName: true },
          },
        },
      }),
    ),
  );

  // Create audit log
  await createAuditLog(
    "CHARGE_PACKAGE_BULK_CREATED",
    null,
    {
      request: packageData,
      response: {
        count: createdPackages.length,
        packageIds: createdPackages.map((p) => p.id),
      },
    },
    reqContext,
  );

  return {
    packages: createdPackages,
    summary: {
      total: createdPackages.length,
      partnerIds: partnerIds,
      packageName: name,
      type,
    },
  };
}

/**
 * List charge packages with filtering and pagination
 *
 * @param {Object} filters - Filter and pagination options
 * @returns {Promise<Object>} Packages list with pagination
 */
async function listChargePackages(filters = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
    ...filterParams
  } = filters;

  const where = buildWhereClause(filterParams);
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [packages, total] = await Promise.all([
    prisma.chargePackage.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        partner: {
          select: { id: true, name: true, displayName: true },
        },
      },
    }),
    prisma.chargePackage.count({ where }),
  ]);

  return {
    packages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Get a charge package by ID
 *
 * @param {string} id - Package UUID
 * @returns {Promise<Object>} Package details
 */
async function getChargePackageById(id) {
  const pkg = await prisma.chargePackage.findUnique({
    where: { id },
    include: {
      partner: {
        select: { id: true, name: true, displayName: true },
      },
    },
  });

  if (!pkg) {
    throw new NotFoundError("ChargePackage", id);
  }

  return pkg;
}

/**
 * Update a charge package
 *
 * @param {string} id - Package UUID
 * @param {Object} updateData - Fields to update
 * @param {Object} reqContext - Request context for audit logging
 * @returns {Promise<Object>} Updated package
 */
async function updateChargePackage(id, updateData, reqContext = {}) {
  // Get existing package to validate update
  const existingPackage = await prisma.chargePackage.findUnique({
    where: { id },
    select: { id: true, partnerId: true, name: true, type: true },
  });

  if (!existingPackage) {
    throw new NotFoundError("ChargePackage", id);
  }

  // If name is being changed, check for conflicts
  if (updateData.name && updateData.name !== existingPackage.name) {
    const conflictPackage = await prisma.chargePackage.findFirst({
      where: {
        partnerId: existingPackage.partnerId,
        name: updateData.name,
        id: { not: id },
      },
    });

    if (conflictPackage) {
      throw new ConflictError(
        `Package "${updateData.name}" already exists for this partner`,
      );
    }
  }

  // Validate field updates based on package type
  const packageType = existingPackage.type;
  const invalidFields = [];

  if (packageType === "GENERIC") {
    // GENERIC packages cannot have unit-based fields
    if (updateData.baseUnit !== undefined) invalidFields.push("baseUnit");
    if (updateData.addonUnit !== undefined) invalidFields.push("addonUnit");
    if (updateData.addonCharge !== undefined) invalidFields.push("addonCharge");
  } else {
    // WEIGHT/DISTANCE packages cannot have GENERIC-specific fields
    if (updateData.appliesTo !== undefined) invalidFields.push("appliesTo");
    if (updateData.calcType !== undefined) invalidFields.push("calcType");
  }

  if (invalidFields.length > 0) {
    throw new ValidationError(
      `Fields not allowed for ${packageType} packages: ${invalidFields.join(", ")}`,
    );
  }

  // Perform update
  const updatedPackage = await prisma.chargePackage.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
    include: {
      partner: {
        select: { id: true, name: true, displayName: true },
      },
    },
  });

  // Create audit log
  await createAuditLog(
    "CHARGE_PACKAGE_UPDATED",
    id,
    {
      request: updateData,
      response: { packageId: id, success: true },
    },
    reqContext,
  );

  return updatedPackage;
}

/**
 * Soft-delete a charge package (set isActive = false)
 *
 * @param {string} id - Package UUID
 * @param {Object} reqContext - Request context for audit logging
 * @returns {Promise<Object>} Deleted package
 */
async function deleteChargePackage(id, reqContext = {}) {
  const existingPackage = await prisma.chargePackage.findUnique({
    where: { id },
  });

  if (!existingPackage) {
    throw new NotFoundError("ChargePackage", id);
  }

  const deletedPackage = await prisma.chargePackage.update({
    where: { id },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
    include: {
      partner: {
        select: { id: true, name: true, displayName: true },
      },
    },
  });

  // Create audit log
  await createAuditLog(
    "CHARGE_PACKAGE_DELETED",
    id,
    {
      request: { id },
      response: { packageId: id, success: true },
    },
    reqContext,
  );

  return deletedPackage;
}

/**
 * Get all active packages for a partner
 *
 * @param {string} partnerId - Partner ID (CUID)
 * @param {Object} options - Filter options
 * @returns {Promise<Object[]>} Partner's packages
 */
async function getPackagesByPartner(partnerId, options = {}) {
  const { type, isActive = true } = options;

  const where = {
    partnerId,
    ...(typeof isActive === "boolean" && { isActive }),
    ...(type && { type }),
  };

  const packages = await prisma.chargePackage.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return packages;
}

/**
 * Get packages grouped by type for a partner
 *
 * @param {string} partnerId - Partner ID (CUID)
 * @param {boolean} activeOnly - Only return active packages
 * @returns {Promise<Object>} Packages grouped by type
 */
async function getPackagesByPartnerGrouped(partnerId, activeOnly = true) {
  const packages = await getPackagesByPartner(partnerId, {
    isActive: activeOnly ? true : undefined,
  });

  return {
    WEIGHT: packages.filter((p) => p.type === "WEIGHT"),
    DISTANCE: packages.filter((p) => p.type === "DISTANCE"),
    GENERIC: packages.filter((p) => p.type === "GENERIC"),
  };
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createChargePackages,
  listChargePackages,
  getChargePackageById,
  updateChargePackage,
  deleteChargePackage,
  getPackagesByPartner,
  getPackagesByPartnerGrouped,
};
