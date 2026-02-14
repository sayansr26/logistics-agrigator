/**
 * Charges Rule Service
 *
 * Manages charge rules for partners (PARTNER_CHARGES_TYPE, GEOLOGICAL, ADDON).
 * Supports INVOICE_VALUE, WEIGHT, ZONE_TO_ZONE_WEIGHT, DISTANCE_BASE_WEIGHT bases.
 * Replaces legacy ChargePackage service.
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
  const { partnerId, kind, chargesTypeId, base, isActive, search } = filters;
  const where = {};

  if (partnerId) {
    where.partnerId = partnerId;
  }

  if (kind) {
    where.kind = kind;
  }

  if (chargesTypeId) {
    where.chargesTypeId = chargesTypeId;
  }

  if (base) {
    where.base = base;
  }

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  // Search by partner name or charges type name
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
};

// ========================================
// CRUD OPERATIONS
// ========================================

/**
 * Create a charge rule
 */
async function createChargeRule(ruleData, reqContext = {}) {
  const { partnerId, kind, base } = ruleData;

  // Verify partner exists
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });

  if (!partner) {
    throw new ValidationError(`Partner not found: ${partnerId}`);
  }

  // Verify chargesTypeId exists and belongs to the partner
  if (kind === "PARTNER_CHARGES_TYPE" && ruleData.chargesTypeId) {
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

  // Verify pincodeTypeId exists when kind = GEOLOGICAL
  if (kind === "GEOLOGICAL" && ruleData.pincodeTypeId) {
    const pincodeType = await prisma.pincodeType.findUnique({
      where: { id: ruleData.pincodeTypeId },
    });
    if (!pincodeType) {
      throw new ValidationError(
        `PincodeType ${ruleData.pincodeTypeId} not found`,
      );
    }
  }

  // Build create data - only include fields relevant to the base type
  const createData = {
    partnerId,
    kind,
    base,
    isActive: ruleData.isActive !== undefined ? ruleData.isActive : true,
  };

  // Conditional fields based on kind
  if (kind === "PARTNER_CHARGES_TYPE") {
    createData.chargesTypeId = ruleData.chargesTypeId;
  }
  if (kind === "GEOLOGICAL") {
    createData.pincodeTypeId = ruleData.pincodeTypeId;
  }

  // Conditional fields based on base
  if (base === "INVOICE_VALUE") {
    createData.fromAmount = ruleData.fromAmount;
    createData.toAmount = ruleData.toAmount;
    createData.charge = ruleData.charge;
    createData.calcType = ruleData.calcType;
  }

  if (base === "WEIGHT") {
    createData.minKg = ruleData.minKg;
    createData.maxKg = ruleData.maxKg;
    createData.charge = ruleData.charge;
    createData.calcType = ruleData.calcType;
  }

  if (base === "ZONE_TO_ZONE_WEIGHT") {
    createData.fromZoneId = ruleData.fromZoneId;
    createData.toZoneId = ruleData.toZoneId;
    createData.minWeightKg = ruleData.minWeightKg;
    createData.addonWeightKg = ruleData.addonWeightKg;
    createData.weightCharge = ruleData.weightCharge;
    createData.addonCharge = ruleData.addonCharge;
  }

  if (base === "DISTANCE_BASE_WEIGHT") {
    createData.division = ruleData.division;
    createData.fromKm = ruleData.fromKm;
    createData.toKm = ruleData.toKm;
    createData.minWeightKg = ruleData.minWeightKg;
    createData.addonWeightKg = ruleData.addonWeightKg;
    createData.weightCharge = ruleData.weightCharge;
    createData.addonCharge = ruleData.addonCharge;
  }

  const chargeRule = await prisma.chargeRule.create({
    data: createData,
    include: chargeRuleIncludes,
  });

  // Audit log
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
    select: { id: true, partnerId: true, kind: true, base: true },
  });

  if (!existing) {
    throw new NotFoundError("ChargeRule", id);
  }

  // Verify foreign keys if being updated
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

  const updatedChargeRule = await prisma.chargeRule.update({
    where: { id },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
    include: chargeRuleIncludes,
  });

  // Audit log
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

  const deletedChargeRule = await prisma.chargeRule.update({
    where: { id },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
    include: chargeRuleIncludes,
  });

  // Audit log
  await createAuditLog(
    "DELETE_CHARGE_RULE",
    id,
    { request: { id }, response: { chargeRuleId: id, success: true } },
    reqContext,
  );

  return deletedChargeRule;
}

/**
 * Get all active charge rules for a partner
 * Used by the calculation engine
 */
async function getActiveRulesByPartner(partnerId, options = {}) {
  const { kind, base } = options;

  const where = {
    partnerId,
    isActive: true,
    ...(kind && { kind }),
    ...(base && { base }),
  };

  const rules = await prisma.chargeRule.findMany({
    where,
    orderBy: [{ kind: "asc" }, { base: "asc" }, { createdAt: "asc" }],
    include: {
      chargesType: {
        select: { id: true, name: true },
      },
      pincodeType: {
        select: { id: true, name: true, type: true },
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
