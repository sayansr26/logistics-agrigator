/**
 * Charges Rule Service (redesigned)
 *
 * Manages charge rules for partners.
 * New field set: base + minValue + percentageValue / perKg + perKgCharge
 *   + optional chargesTypeId/pincodeTypeId (Invoice/Weight)
 *   + optional fromZoneId/toZoneId (Zone-to-Zone)
 *   + optional zoneMilestoneId (Distance)
 * Following auth-service patterns.
 */

const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Build where clause for listing charge rules
 */
function buildWhereClause(filters) {
  const { partnerId, chargesTypeId, pincodeTypeId, base, isActive, search } =
    filters;
  const where = {};

  if (partnerId) {
    where.partnerId = partnerId;
  }

  if (chargesTypeId) {
    where.chargesTypeId = chargesTypeId;
  }

  if (pincodeTypeId) {
    where.pincodeTypeId = pincodeTypeId;
  }

  if (base) {
    where.base = base;
  }

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  if (search) {
    where.OR = [
      {
        partner: {
          name: { contains: search, mode: "insensitive" },
        },
      },
      {
        partner: {
          displayName: { contains: search, mode: "insensitive" },
        },
      },
      {
        chargesType: {
          name: { contains: search, mode: "insensitive" },
        },
      },
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
        resourceType: "CHARGE_RULE",
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
 * Standard include for charge rule queries
 */
const chargeRuleIncludes = {
  partner: {
    select: { id: true, name: true, displayName: true },
  },
  chargesType: {
    select: { id: true, name: true },
  },
  pincodeType: {
    select: { id: true, name: true, type: true },
  },
  zoneMilestone: {
    select: { id: true, minKm: true, maxKm: true, suffix: true, zoneId: true },
  },
};

// ========================================
// CRUD OPERATIONS
// ========================================

/**
 * Create a charge rule
 */
async function createChargeRule(ruleData, reqContext = {}) {
  const { partnerId, base } = ruleData;

  // Verify partner exists
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });

  if (!partner) {
    throw new ValidationError(`Partner not found: ${partnerId}`);
  }

  // Verify chargesTypeId belongs to the partner
  if (ruleData.chargesTypeId) {
    const chargesType = await prisma.chargesType.findFirst({
      where: {
        id: ruleData.chargesTypeId,
        partnerId,
      },
    });
    if (!chargesType) {
      throw new ValidationError(
        `ChargesType ${ruleData.chargesTypeId} not found for partner ${partnerId}`,
      );
    }
  }

  // Verify pincodeTypeId exists
  if (ruleData.pincodeTypeId) {
    const pincodeType = await prisma.pincodeType.findUnique({
      where: { id: ruleData.pincodeTypeId },
    });
    if (!pincodeType) {
      throw new ValidationError(
        `PincodeType ${ruleData.pincodeTypeId} not found`,
      );
    }
  }

  // Verify zoneMilestoneId belongs to a DISTANCE zone of this partner
  if (base === "DISTANCE_BASE_WEIGHT" && ruleData.zoneMilestoneId) {
    const milestone = await prisma.zoneMilestone.findFirst({
      where: {
        id: ruleData.zoneMilestoneId,
        zone: { partnerId, zoneType: "DISTANCE" },
      },
    });
    if (!milestone) {
      throw new ValidationError(
        `ZoneMilestone ${ruleData.zoneMilestoneId} not found for partner ${partnerId} DISTANCE zone`,
      );
    }
  }

  // Verify fromZoneId / toZoneId belong to GEOLOGICAL zones of this partner
  if (base === "ZONE_TO_ZONE_WEIGHT") {
    for (const [field, zoneId] of [
      ["fromZoneId", ruleData.fromZoneId],
      ["toZoneId", ruleData.toZoneId],
    ]) {
      if (zoneId) {
        const zone = await prisma.zone.findFirst({
          where: { id: zoneId, partnerId, zoneType: "GEOLOGICAL" },
          select: { id: true },
        });
        if (!zone) {
          throw new ValidationError(
            `Zone ${zoneId} (${field}) not found for partner ${partnerId} GEOLOGICAL zone`,
          );
        }
      }
    }
  }

  // Build create data
  const createData = {
    partnerId,
    base,
    minValue: ruleData.minValue,
    isActive: ruleData.isActive !== undefined ? ruleData.isActive : true,
  };

  // FK fields (all optional at DB level, validated above)
  if (ruleData.chargesTypeId) createData.chargesTypeId = ruleData.chargesTypeId;
  if (ruleData.pincodeTypeId) createData.pincodeTypeId = ruleData.pincodeTypeId;

  // Base-specific fields
  // INVOICE_VALUE and COD_VALUE share the same percentage-of-an-amount shape; they
  // differ only in which amount the engine multiplies at quote time.
  if (base === "INVOICE_VALUE" || base === "COD_VALUE") {
    createData.percentageValue = ruleData.percentageValue;
  }

  if (
    base === "WEIGHT" ||
    base === "ZONE_TO_ZONE_WEIGHT" ||
    base === "DISTANCE_BASE_WEIGHT"
  ) {
    createData.perKg = ruleData.perKg;
    createData.perKgCharge = ruleData.perKgCharge;
  }

  if (base === "ZONE_TO_ZONE_WEIGHT") {
    createData.fromZoneId = ruleData.fromZoneId;
    createData.toZoneId = ruleData.toZoneId;
  }

  if (base === "DISTANCE_BASE_WEIGHT") {
    createData.zoneMilestoneId = ruleData.zoneMilestoneId;
  }

  const chargeRule = await prisma.chargeRule.create({
    data: createData,
    include: chargeRuleIncludes,
  });

  await createAuditLog(
    "CREATE_CHARGE_RULE",
    chargeRule.id,
    { request: ruleData, response: { chargeRuleId: chargeRule.id } },
    reqContext,
  );

  return chargeRule;
}

/**
 * List charge rules with filtering and pagination
 */
async function listChargeRules(filters = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
    ...filterParams
  } = filters;

  const where = buildWhereClause(filterParams);
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [chargeRules, total] = await Promise.all([
    prisma.chargeRule.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: chargeRuleIncludes,
    }),
    prisma.chargeRule.count({ where }),
  ]);

  return {
    chargeRules,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Get a charge rule by ID
 */
async function getChargeRuleById(id) {
  const chargeRule = await prisma.chargeRule.findUnique({
    where: { id },
    include: chargeRuleIncludes,
  });

  if (!chargeRule) {
    throw new NotFoundError("ChargeRule", id);
  }

  return chargeRule;
}

/**
 * Update a charge rule
 */
async function updateChargeRule(id, updateData, reqContext = {}) {
  const existing = await prisma.chargeRule.findUnique({
    where: { id },
    select: { id: true, partnerId: true, base: true },
  });

  if (!existing) {
    throw new NotFoundError("ChargeRule", id);
  }

  // Verify FK fields if being updated
  if (updateData.chargesTypeId) {
    const chargesType = await prisma.chargesType.findFirst({
      where: {
        id: updateData.chargesTypeId,
        partnerId: existing.partnerId,
      },
    });
    if (!chargesType) {
      throw new ValidationError(
        `ChargesType ${updateData.chargesTypeId} not found for this partner`,
      );
    }
  }

  if (updateData.pincodeTypeId) {
    const pincodeType = await prisma.pincodeType.findUnique({
      where: { id: updateData.pincodeTypeId },
    });
    if (!pincodeType) {
      throw new ValidationError(
        `PincodeType ${updateData.pincodeTypeId} not found`,
      );
    }
  }

  if (updateData.zoneMilestoneId) {
    const milestone = await prisma.zoneMilestone.findFirst({
      where: {
        id: updateData.zoneMilestoneId,
        zone: { partnerId: existing.partnerId, zoneType: "DISTANCE" },
      },
    });
    if (!milestone) {
      throw new ValidationError(
        `ZoneMilestone ${updateData.zoneMilestoneId} not found for this partner's DISTANCE zone`,
      );
    }
  }

  const updatedChargeRule = await prisma.chargeRule.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
    include: chargeRuleIncludes,
  });

  await createAuditLog(
    "UPDATE_CHARGE_RULE",
    id,
    { request: updateData, response: { chargeRuleId: id, success: true } },
    reqContext,
  );

  return updatedChargeRule;
}

/**
 * Delete (soft-delete) a charge rule by setting isActive = false
 */
async function deleteChargeRule(id, reqContext = {}) {
  const existing = await prisma.chargeRule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("ChargeRule", id);
  }

  const deletedChargeRule = await prisma.chargeRule.delete({
    where: { id },
    include: chargeRuleIncludes,
  });

  await createAuditLog(
    "DELETE_CHARGE_RULE",
    id,
    { request: { id }, response: { chargeRuleId: id, success: true } },
    reqContext,
  );

  return deletedChargeRule;
}

/**
 * Get all active charge rules for a partner (used by calculation engine)
 */
async function getActiveRulesByPartner(partnerId, options = {}) {
  const { base } = options;

  const where = {
    partnerId,
    isActive: true,
    ...(base && { base }),
  };

  const rules = await prisma.chargeRule.findMany({
    where,
    orderBy: [{ base: "asc" }, { createdAt: "asc" }],
    include: {
      chargesType: { select: { id: true, name: true } },
      pincodeType: { select: { id: true, name: true, type: true } },
      zoneMilestone: {
        select: { id: true, minKm: true, maxKm: true, suffix: true },
      },
    },
  });

  return rules;
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  createChargeRule,
  listChargeRules,
  getChargeRuleById,
  updateChargeRule,
  deleteChargeRule,
  getActiveRulesByPartner,
};
