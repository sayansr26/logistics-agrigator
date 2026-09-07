/**
 * Partner Charge Config Service (Charges Engine v3)
 *
 * Per-partner (optionally per-channel) config values for charge definitions.
 * Every write:
 *   - validates the partner/definition/channel FKs
 *   - validates all Zone/ZoneMilestone/PincodeType UUIDs referenced inside the
 *     config JSON (partner-scoped)
 *   - records a version snapshot
 *   - bumps the global config revision (implicit quote-cache invalidation)
 */

const { prisma } = require("../config/database");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");
const {
  findDanglingRefs,
  findMatrixProblems,
  findMatrixCoverageGaps,
  recordVersion,
  ensureVersionSnapshot,
  bumpConfigRevision,
  createAuditLog,
} = require("./chargeConfigShared");
const { validateConfigForMethod } = require("./chargeConfigMethods");

const configIncludes = {
  partner: { select: { id: true, name: true, displayName: true } },
  channel: { select: { id: true, channelName: true, accountRef: true } },
  chargeDefinition: {
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      applyStage: true,
      phase: true,
      computation: true,
    },
  },
};

async function assertForeignKeys({ partnerId, chargeDefinitionId, channelId }) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true },
  });
  if (!partner) throw new ValidationError(`Partner not found: ${partnerId}`);

  const definition = await prisma.chargeDefinition.findUnique({
    where: { id: chargeDefinitionId },
    select: { id: true, code: true, category: true, computation: true },
  });
  if (!definition) {
    throw new ValidationError(
      `ChargeDefinition not found: ${chargeDefinitionId}`,
    );
  }

  if (channelId) {
    const channel = await prisma.partnerServiceChannel.findFirst({
      where: { id: channelId, partnerId },
      select: { id: true },
    });
    if (!channel) {
      throw new ValidationError(
        `PartnerServiceChannel ${channelId} not found for partner ${partnerId}`,
      );
    }
  }

  return definition;
}

async function assertConfigRefs(
  configJson,
  conditionsJson,
  partnerId,
  definition,
) {
  const problems = [
    ...findMatrixProblems(definition?.computation, configJson || {}),
    ...(await findDanglingRefs(configJson || {}, { partnerId })),
    ...(await findDanglingRefs(conditionsJson || {}, { partnerId })),
  ];
  if (problems.length > 0) {
    throw new ValidationError(`Invalid charge config: ${problems.join("; ")}`);
  }

  // Non-blocking: a partner is simply not quotable on a lane its BASE matrix
  // does not cover, so log the gaps at write time instead of discovering them
  // as a missing charge in production quotes.
  const gaps = await findMatrixCoverageGaps(
    definition?.computation,
    configJson || {},
    partnerId,
  );
  if (gaps.length > 0) {
    logger.warn("Charge config does not cover every lane", {
      partnerId,
      chargeCode: definition?.code,
      gaps,
    });
  }
}

async function createConfig(data, reqContext = {}) {
  const definition = await assertForeignKeys(data);
  await assertConfigRefs(
    data.config,
    data.conditions,
    data.partnerId,
    definition,
  );

  const existing = await prisma.partnerChargeConfig.findFirst({
    where: {
      partnerId: data.partnerId,
      chargeDefinitionId: data.chargeDefinitionId,
      channelId: data.channelId || null,
    },
    select: { id: true },
  });
  if (existing) {
    throw new ValidationError(
      `A config for definition ${definition.code} already exists for this partner/channel (id: ${existing.id})`,
    );
  }

  const config = await prisma.partnerChargeConfig.create({
    data,
    include: configIncludes,
  });

  await recordVersion("PARTNER_CONFIG", config.id, config.version, config, {
    changeSource: reqContext.changeSource || "MANUAL",
    changedById: reqContext.userId || null,
  });
  await bumpConfigRevision();
  await createAuditLog(
    "CREATE_PARTNER_CHARGE_CONFIG",
    "PARTNER_CHARGE_CONFIG",
    config.id,
    { request: data, response: { id: config.id } },
    reqContext,
  );

  return config;
}

async function listConfigs(filters = {}) {
  const {
    page = 1,
    limit = 50,
    partnerId,
    chargeDefinitionId,
    channelId,
    isActive,
  } = filters;

  const where = {};
  if (partnerId) where.partnerId = partnerId;
  if (chargeDefinitionId) where.chargeDefinitionId = chargeDefinitionId;
  if (channelId) where.channelId = channelId;
  if (typeof isActive === "boolean") where.isActive = isActive;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [configs, total] = await Promise.all([
    prisma.partnerChargeConfig.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: [{ partnerId: "asc" }, { createdAt: "desc" }],
      include: configIncludes,
    }),
    prisma.partnerChargeConfig.count({ where }),
  ]);

  return {
    configs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

async function getConfigById(id) {
  const config = await prisma.partnerChargeConfig.findUnique({
    where: { id },
    include: configIncludes,
  });
  if (!config) throw new NotFoundError("PartnerChargeConfig", id);
  return config;
}

async function updateConfig(id, updateData, reqContext = {}) {
  const existing = await prisma.partnerChargeConfig.findUnique({
    where: { id },
    include: {
      chargeDefinition: {
        select: { id: true, code: true, category: true, computation: true },
      },
    },
  });
  if (!existing) throw new NotFoundError("PartnerChargeConfig", id);

  // Backfill a snapshot of the CURRENT version before we mutate it, so the
  // overwritten rows are always recoverable. recordVersion() below tags the
  // POST-change state with version+1; without this, a row created outside this
  // service (seed, raw SQL, restored dump) would have no "before" snapshot.
  await ensureVersionSnapshot("PARTNER_CONFIG", existing, {
    changedById: reqContext.userId || null,
  });

  // partnerId / chargeDefinitionId are immutable; channelId may change
  if (updateData.channelId) {
    const channel = await prisma.partnerServiceChannel.findFirst({
      where: { id: updateData.channelId, partnerId: existing.partnerId },
      select: { id: true },
    });
    if (!channel) {
      throw new ValidationError(
        `PartnerServiceChannel ${updateData.channelId} not found for this partner`,
      );
    }
  }

  await assertConfigRefs(
    updateData.config ?? existing.config,
    updateData.conditions ?? existing.conditions,
    existing.partnerId,
    existing.chargeDefinition,
  );

  const config = await prisma.partnerChargeConfig.update({
    where: { id },
    data: { ...updateData, version: { increment: 1 } },
    include: configIncludes,
  });

  await recordVersion("PARTNER_CONFIG", id, config.version, config, {
    changeSource: reqContext.changeSource || "MANUAL",
    changedById: reqContext.userId || null,
  });
  await bumpConfigRevision();
  await createAuditLog(
    "UPDATE_PARTNER_CHARGE_CONFIG",
    "PARTNER_CHARGE_CONFIG",
    id,
    { request: updateData, response: { id, version: config.version } },
    reqContext,
  );

  return config;
}

async function deleteConfig(id, reqContext = {}) {
  const existing = await prisma.partnerChargeConfig.findUnique({
    where: { id },
  });
  if (!existing) throw new NotFoundError("PartnerChargeConfig", id);

  const config = await prisma.partnerChargeConfig.delete({
    where: { id },
    include: configIncludes,
  });

  await bumpConfigRevision();
  await createAuditLog(
    "DELETE_PARTNER_CHARGE_CONFIG",
    "PARTNER_CHARGE_CONFIG",
    id,
    { request: { id }, response: { id } },
    reqContext,
  );

  return config;
}

/**
 * Sweep every active config for dangling Zone/Milestone/PincodeType refs
 * (e.g. after a zone deletion). Returns findings per config.
 */
async function validateAllConfigs() {
  const configs = await prisma.partnerChargeConfig.findMany({
    where: { isActive: true },
    select: {
      id: true,
      partnerId: true,
      config: true,
      conditions: true,
      chargeDefinition: {
        select: { code: true, category: true, computation: true },
      },
    },
  });

  const findings = [];
  for (const cfg of configs) {
    const problems = [
      // Report-only for now. validateConfigForMethod is NOT yet wired into
      // assertConfigRefs (the throwing path): it is a real tightening, so run
      // this sweep first and see what it flags before enforcing on writes.
      // It supersedes findMatrixProblems for MATRIX (it delegates to it), so
      // MATRIX is not double-reported.
      ...validateConfigForMethod(
        cfg.chargeDefinition.computation,
        cfg.config || {},
      ),
      ...(await findDanglingRefs(cfg.config || {}, {
        partnerId: cfg.partnerId,
      })),
      ...(await findDanglingRefs(cfg.conditions || {}, {
        partnerId: cfg.partnerId,
      })),
    ];
    if (problems.length > 0) {
      findings.push({
        configId: cfg.id,
        partnerId: cfg.partnerId,
        chargeCode: cfg.chargeDefinition.code,
        problems,
      });
    }
  }

  return { checked: configs.length, invalid: findings.length, findings };
}

/**
 * All active configs for a partner, definition included — the engine's read path.
 * Channel-specific configs override channel-less ones for the same definition.
 */
async function getActiveConfigsForPartner(partnerId, { channelId } = {}) {
  const now = new Date();
  const configs = await prisma.partnerChargeConfig.findMany({
    where: {
      partnerId,
      isActive: true,
      OR: [{ channelId: null }, ...(channelId ? [{ channelId }] : [])],
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
      ],
    },
    include: { chargeDefinition: true },
    orderBy: { priority: "asc" },
  });

  // Channel-specific config wins over the partner-wide one per definition
  const byDefinition = new Map();
  for (const cfg of configs) {
    const key = cfg.chargeDefinitionId;
    const current = byDefinition.get(key);
    if (!current || (cfg.channelId && !current.channelId)) {
      byDefinition.set(key, cfg);
    }
  }

  return [...byDefinition.values()];
}

module.exports = {
  createConfig,
  listConfigs,
  getConfigById,
  updateConfig,
  deleteConfig,
  validateAllConfigs,
  getActiveConfigsForPartner,
};
