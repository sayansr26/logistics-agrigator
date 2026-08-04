/**
 * Charges Engine v3 — shared helpers for definition/config services
 *
 * - Version snapshots (ChargeConfigVersion) for every write
 * - Global config revision counter (Redis) that quote-cache keys embed, so any
 *   catalog/config change implicitly invalidates cached quotes
 * - Referential validation of Zone/ZoneMilestone/PincodeType UUIDs referenced
 *   inside JSON configs
 */

const { prisma } = require("../config/database");
const { getRedisClient } = require("../config/redis");
const logger = require("../shared/lib/logger");

const CONFIG_REV_KEY = "charges:config:rev";

// JSON keys whose values are treated as references to the given model
const REF_KEYS = {
  zoneId: "zone",
  fromZoneId: "zone",
  toZoneId: "zone",
  zoneMilestoneId: "zoneMilestone",
  pincodeTypeId: "pincodeType",
  channelId: "partnerServiceChannel",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recursively collect { key -> Set<uuid> } for all REF_KEYS found in a JSON value.
 */
function collectRefs(value, found = {}) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, found));
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (REF_KEYS[key] && typeof v === "string" && UUID_RE.test(v)) {
        const model = REF_KEYS[key];
        found[model] = found[model] || new Set();
        found[model].add(v);
      }
      collectRefs(v, found);
    }
  }
  return found;
}

/**
 * Validate that every Zone/ZoneMilestone/PincodeType/channel UUID referenced in
 * `configJson` exists (zones/milestones/channels additionally scoped to the
 * partner). Returns an array of human-readable problems; empty = valid.
 */
async function findDanglingRefs(configJson, { partnerId } = {}) {
  const refs = collectRefs(configJson);
  const problems = [];

  const checks = {
    zone: async (ids) => {
      const rows = await prisma.zone.findMany({
        where: { id: { in: ids }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
    zoneMilestone: async (ids) => {
      const rows = await prisma.zoneMilestone.findMany({
        where: {
          id: { in: ids },
          ...(partnerId ? { zone: { partnerId } } : {}),
        },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
    pincodeType: async (ids) => {
      const rows = await prisma.pincodeType.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
    partnerServiceChannel: async (ids) => {
      const rows = await prisma.partnerServiceChannel.findMany({
        where: { id: { in: ids }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
  };

  for (const [model, idSet] of Object.entries(refs)) {
    const ids = [...idSet];
    const foundIds = new Set(await checks[model](ids));
    for (const id of ids) {
      if (!foundIds.has(id)) {
        problems.push(
          `${model} ${id} not found${partnerId ? ` for partner ${partnerId}` : ""}`,
        );
      }
    }
  }

  return problems;
}

/**
 * Record an immutable version snapshot of a definition/config row.
 */
async function recordVersion(
  entityType,
  entityId,
  version,
  snapshot,
  { changeSource = "MANUAL", changedById = null } = {},
) {
  try {
    await prisma.chargeConfigVersion.create({
      data: {
        entityType,
        entityId,
        version,
        snapshot,
        changeSource,
        changedById,
      },
    });
  } catch (error) {
    // Versioning must never block the write itself
    logger.error("Failed to record charge config version:", error);
  }
}

/**
 * Bump the global config revision. Quote-cache keys embed this value, so every
 * catalog/config change invalidates cached quotes without explicit deletes.
 */
async function bumpConfigRevision() {
  try {
    const redis = getRedisClient();
    return await redis.incr(CONFIG_REV_KEY);
  } catch (error) {
    logger.warn("Failed to bump charges config revision:", error.message);
    return null;
  }
}

/**
 * Current config revision (0 when unset/unavailable).
 */
async function getConfigRevision() {
  try {
    const redis = getRedisClient();
    const value = await redis.get(CONFIG_REV_KEY);
    return parseInt(value, 10) || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Audit log helper (partner-service AuditLog shape).
 */
async function createAuditLog(
  action,
  resourceType,
  resourceId,
  data,
  reqContext = {},
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        resourceType,
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

module.exports = {
  collectRefs,
  findDanglingRefs,
  recordVersion,
  bumpConfigRevision,
  getConfigRevision,
  createAuditLog,
  CONFIG_REV_KEY,
};
