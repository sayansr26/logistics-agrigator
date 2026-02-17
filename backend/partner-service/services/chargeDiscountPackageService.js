/**
 * Charge Discount Package Service
 *
 * Manages charge discount packages for partner + outlet badge tiers.
 * Each package maps selected charge rules to FLAT/PERCENTAGE discounts.
 * Following auth-service patterns.
 */

const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Create audit log entry
 */
async function createAuditLog(action, resourceId, data, reqContext = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        resourceType: "CHARGE_DISCOUNT_PACKAGE",
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
  }
}

/**
 * Standard include for package queries
 */
const packageIncludes = {
  partner: { select: { id: true, name: true, displayName: true } },
  items: {
    include: {
      chargeRule: {
        include: {
          partner: { select: { id: true, name: true, displayName: true } },
          chargesType: { select: { id: true, name: true } },
          pincodeType: { select: { id: true, name: true, type: true } },
          zoneMilestone: {
            select: {
              id: true,
              minKm: true,
              maxKm: true,
              suffix: true,
              zoneId: true,
            },
          },
        },
      },
    },
  },
};

/**
 * Build where clause for listing packages
 */
function buildWhereClause(filters) {
  const { partnerId, badge, isActive, search } = filters;
  const where = {};

  if (partnerId) where.partnerId = partnerId;
  if (badge) where.badge = badge;
  if (typeof isActive === "boolean") where.isActive = isActive;

  if (search) {
    where.OR = [{ name: { contains: search, mode: "insensitive" } }];
  }

  return where;
}

// ========================================
// CRUD OPERATIONS
// ========================================

/**
 * Create a charge discount package with items
 */
async function createPackage(packageData, reqContext = {}) {
  const { partnerId, name, badge, isActive = true, items } = packageData;

  // Verify partner exists
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });

  if (!partner) {
    throw new ValidationError(`Partner not found: ${partnerId}`);
  }

  // Check for existing package with same partner + badge
  const existing = await prisma.chargeDiscountPackage.findUnique({
    where: { partnerId_badge: { partnerId, badge } },
  });

  if (existing) {
    throw new ValidationError(
      `A discount package for partner "${partner.name}" with badge "${badge}" already exists`,
    );
  }

  // Verify all charge rules exist and belong to this partner
  const chargeRuleIds = items.map((item) => item.chargeRuleId);
  const chargeRules = await prisma.chargeRule.findMany({
    where: {
      id: { in: chargeRuleIds },
      partnerId,
    },
    select: { id: true },
  });

  const foundIds = new Set(chargeRules.map((r) => r.id));
  const missingIds = chargeRuleIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw new ValidationError(
      `Charge rules not found for this partner: ${missingIds.join(", ")}`,
    );
  }

  // Create package + items in transaction
  const result = await prisma.$transaction(async (tx) => {
    const pkg = await tx.chargeDiscountPackage.create({
      data: {
        partnerId,
        name,
        badge,
        isActive,
        items: {
          create: items.map((item) => ({
            chargeRuleId: item.chargeRuleId,
            discountType: item.discountType,
            discountValue: item.discountValue,
          })),
        },
      },
      include: packageIncludes,
    });

    return pkg;
  });

  await createAuditLog(
    "CREATE_CHARGE_DISCOUNT_PACKAGE",
    result.id,
    { request: packageData, response: { packageId: result.id } },
    reqContext,
  );

  return result;
}

/**
 * List charge discount packages with filtering and pagination
 */
async function listPackages(filters = {}) {
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
    prisma.chargeDiscountPackage.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: packageIncludes,
    }),
    prisma.chargeDiscountPackage.count({ where }),
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
 * Get a package by ID
 */
async function getPackageById(id) {
  const pkg = await prisma.chargeDiscountPackage.findUnique({
    where: { id },
    include: packageIncludes,
  });

  if (!pkg) {
    throw new NotFoundError("ChargeDiscountPackage", id);
  }

  return pkg;
}

/**
 * Update a charge discount package (replace items if provided)
 */
async function updatePackage(id, updateData, reqContext = {}) {
  const existing = await prisma.chargeDiscountPackage.findUnique({
    where: { id },
    select: { id: true, partnerId: true, badge: true },
  });

  if (!existing) {
    throw new NotFoundError("ChargeDiscountPackage", id);
  }

  // If badge is changing, check uniqueness
  if (updateData.badge && updateData.badge !== existing.badge) {
    const conflict = await prisma.chargeDiscountPackage.findUnique({
      where: {
        partnerId_badge: {
          partnerId: existing.partnerId,
          badge: updateData.badge,
        },
      },
    });
    if (conflict) {
      throw new ValidationError(
        `A discount package for this partner with badge "${updateData.badge}" already exists`,
      );
    }
  }

  const { items, ...scalarData } = updateData;

  const result = await prisma.$transaction(async (tx) => {
    // Update scalar fields
    const updatedPkg = await tx.chargeDiscountPackage.update({
      where: { id },
      data: scalarData,
    });

    // If items provided, replace them entirely
    if (items && items.length > 0) {
      // Verify all charge rules belong to this partner
      const chargeRuleIds = items.map((item) => item.chargeRuleId);
      const chargeRules = await tx.chargeRule.findMany({
        where: {
          id: { in: chargeRuleIds },
          partnerId: existing.partnerId,
        },
        select: { id: true },
      });

      const foundIds = new Set(chargeRules.map((r) => r.id));
      const missingIds = chargeRuleIds.filter((id) => !foundIds.has(id));

      if (missingIds.length > 0) {
        throw new ValidationError(
          `Charge rules not found for this partner: ${missingIds.join(", ")}`,
        );
      }

      // Delete old items and create new ones
      await tx.chargeDiscountPackageItem.deleteMany({
        where: { packageId: id },
      });

      await tx.chargeDiscountPackageItem.createMany({
        data: items.map((item) => ({
          packageId: id,
          chargeRuleId: item.chargeRuleId,
          discountType: item.discountType,
          discountValue: item.discountValue,
        })),
      });
    }

    // Refetch with includes
    return tx.chargeDiscountPackage.findUnique({
      where: { id },
      include: packageIncludes,
    });
  });

  await createAuditLog(
    "UPDATE_CHARGE_DISCOUNT_PACKAGE",
    id,
    { request: updateData, response: { packageId: id, success: true } },
    reqContext,
  );

  return result;
}

/**
 * Delete a charge discount package (hard delete with cascade)
 */
async function deletePackage(id, reqContext = {}) {
  const existing = await prisma.chargeDiscountPackage.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("ChargeDiscountPackage", id);
  }

  const deletedPkg = await prisma.chargeDiscountPackage.delete({
    where: { id },
    include: packageIncludes,
  });

  await createAuditLog(
    "DELETE_CHARGE_DISCOUNT_PACKAGE",
    id,
    { request: { id }, response: { packageId: id, success: true } },
    reqContext,
  );

  return deletedPkg;
}

/**
 * Get active package for a partner + badge combination (used by quote engine)
 */
async function getActivePackageForBadge(partnerId, badge) {
  const pkg = await prisma.chargeDiscountPackage.findUnique({
    where: {
      partnerId_badge: { partnerId, badge },
    },
    include: {
      items: {
        select: {
          chargeRuleId: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
  });

  if (!pkg || !pkg.isActive) return null;

  return pkg;
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
  getActivePackageForBadge,
};
