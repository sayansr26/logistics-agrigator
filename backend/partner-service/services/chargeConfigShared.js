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

// JSON keys whose values are treated as references to the given model.
// `zoneType` (when set) is the zone flavour the key REQUIRES — a ZONE_PAIR row
// can only point at GEOLOGICAL zones, a milestone only at a DISTANCE zone.
const REF_KEYS = {
  zoneId: { model: "zone" },
  fromZoneId: { model: "zone", zoneType: "GEOLOGICAL" },
  toZoneId: { model: "zone", zoneType: "GEOLOGICAL" },
  zoneMilestoneId: { model: "zoneMilestone", zoneType: "DISTANCE" },
  pincodeTypeId: { model: "pincodeType" },
  channelId: { model: "partnerServiceChannel" },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recursively collect every REF_KEYS occurrence in a JSON value.
 *
 * Returns { refs, malformed }:
 *   refs      - [{ key, model, zoneType, id }] for well-formed UUID values
 *   malformed - [{ key, value }] for anything else (placeholders such as
 *               "zone-a", numbers, nulls). These used to be skipped silently,
 *               which let a config that referenced nothing save as Active and
 *               then price at zero forever.
 */
function collectRefs(value, acc = { refs: [], malformed: [] }) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, acc));
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      const spec = REF_KEYS[key];
      if (spec && v !== null && v !== undefined) {
        if (typeof v === "string" && UUID_RE.test(v)) {
          acc.refs.push({ key, ...spec, id: v });
        } else {
          acc.malformed.push({ key, value: v });
        }
      }
      collectRefs(v, acc);
    }
  }
  return acc;
}

/**
 * Validate that every Zone/ZoneMilestone/PincodeType/channel reference in
 * `configJson` is a real UUID that exists, belongs to this partner, and is of
 * the zone flavour the key requires. Returns human-readable problems; empty = valid.
 */
async function findDanglingRefs(configJson, { partnerId } = {}) {
  const { refs, malformed } = collectRefs(configJson);
  const problems = malformed.map(
    ({ key, value }) =>
      `${key} ${JSON.stringify(value)} is not a valid id — use the actual ` +
      `UUID of a zone/milestone belonging to this partner`,
  );

  const byModel = new Map();
  for (const ref of refs) {
    if (!byModel.has(ref.model)) byModel.set(ref.model, []);
    byModel.get(ref.model).push(ref);
  }

  const checks = {
    zone: async (ids) => {
      const rows = await prisma.zone.findMany({
        where: { id: { in: ids }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true, zoneType: true },
      });
      return new Map(rows.map((r) => [r.id, r.zoneType]));
    },
    zoneMilestone: async (ids) => {
      const rows = await prisma.zoneMilestone.findMany({
        where: {
          id: { in: ids },
          ...(partnerId ? { zone: { partnerId } } : {}),
        },
        select: { id: true, zone: { select: { zoneType: true } } },
      });
      return new Map(rows.map((r) => [r.id, r.zone?.zoneType]));
    },
    pincodeType: async (ids) => {
      const rows = await prisma.pincodeType.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      return new Map(rows.map((r) => [r.id, null]));
    },
    partnerServiceChannel: async (ids) => {
      const rows = await prisma.partnerServiceChannel.findMany({
        where: { id: { in: ids }, ...(partnerId ? { partnerId } : {}) },
        select: { id: true },
      });
      return new Map(rows.map((r) => [r.id, null]));
    },
  };

  for (const [model, modelRefs] of byModel.entries()) {
    const ids = [...new Set(modelRefs.map((r) => r.id))];
    const found = await checks[model](ids);
    for (const ref of modelRefs) {
      if (!found.has(ref.id)) {
        problems.push(
          `${model} ${ref.id} not found${partnerId ? ` for partner ${partnerId}` : ""}`,
        );
        continue;
      }
      const actualType = found.get(ref.id);
      if (ref.zoneType && actualType && actualType !== ref.zoneType) {
        problems.push(
          `${ref.key} ${ref.id} belongs to a ${actualType} zone but ${ref.key} ` +
            `requires a ${ref.zoneType} zone — a ${actualType} zone can never ` +
            `match this row at quote time`,
        );
      }
    }
  }

  return problems;
}

/**
 * Structural validation for MATRIX (BASE freight) configs.
 *
 * The two modes are not interchangeable: MILESTONE rows are matched against
 * the shipment's distance milestone, ZONE_PAIR rows against the pickup and
 * delivery GEOLOGICAL zones. A row carrying the wrong key set can never match,
 * so the charge silently disappears from every quote.
 */
function findMatrixProblems(computation, configJson) {
  if (computation?.method !== "MATRIX") return [];

  const problems = [];
  const mode = configJson?.mode;
  if (mode !== "MILESTONE" && mode !== "ZONE_PAIR") {
    problems.push(
      `MATRIX config needs "mode": "MILESTONE" (distance zones) or "ZONE_PAIR" (geological zones)`,
    );
  }

  const rows = configJson?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    problems.push("MATRIX config needs a non-empty rows array");
    return problems;
  }

  const seen = new Set();
  rows.forEach((row, index) => {
    const at = `row ${index + 1}`;
    if (!row || typeof row !== "object") {
      problems.push(`${at}: must be an object`);
      return;
    }

    if (mode === "MILESTONE") {
      if (!row.zoneMilestoneId) {
        problems.push(
          `${at}: MILESTONE mode requires zoneMilestoneId (the milestone UUID of the partner's DISTANCE zone)`,
        );
      }
      if (row.fromZoneId || row.toZoneId) {
        problems.push(
          `${at}: MILESTONE rows must not carry fromZoneId/toZoneId — those are only read in ZONE_PAIR mode`,
        );
      }
    } else if (mode === "ZONE_PAIR") {
      if (!row.fromZoneId || !row.toZoneId) {
        problems.push(
          `${at}: ZONE_PAIR mode requires both fromZoneId and toZoneId (GEOLOGICAL zone UUIDs)`,
        );
      }
      if (row.zoneMilestoneId) {
        problems.push(
          `${at}: ZONE_PAIR rows must not carry zoneMilestoneId — that is only read in MILESTONE mode`,
        );
      }
    }

    const key =
      mode === "MILESTONE"
        ? `m:${row.zoneMilestoneId}`
        : `z:${row.fromZoneId}>${row.toZoneId}`;
    if (seen.has(key))
      problems.push(`${at}: duplicate of an earlier row (${key})`);
    seen.add(key);

    const perKg = Number(row.perKg);
    const charge = Number(row.charge);
    if (!Number.isFinite(perKg) || perKg <= 0) {
      problems.push(
        `${at}: perKg must be a positive number (the slab size in kg)`,
      );
    }
    if (!Number.isFinite(charge) || charge <= 0) {
      problems.push(
        `${at}: charge must be a positive number (the amount per slab)`,
      );
    }
    if (row.minCharge !== undefined && row.minCharge !== null) {
      const minCharge = Number(row.minCharge);
      if (!Number.isFinite(minCharge) || minCharge < 0) {
        problems.push(`${at}: minCharge must be a non-negative number`);
      }
    }
  });

  return problems;
}

/**
 * Coverage report for a MATRIX config: which of the partner's milestones or
 * geological zone pairs have no row, i.e. which lanes this partner will drop
 * out of at quote time. Non-blocking — surfaced as warnings.
 */
async function findMatrixCoverageGaps(computation, configJson, partnerId) {
  if (computation?.method !== "MATRIX" || !partnerId) return [];
  const rows = Array.isArray(configJson?.rows) ? configJson.rows : [];
  if (rows.length === 0) return [];

  if (configJson.mode === "MILESTONE") {
    const milestones = await prisma.zoneMilestone.findMany({
      where: { zone: { partnerId, zoneType: "DISTANCE", status: true } },
      select: { id: true, suffix: true, minKm: true, maxKm: true },
    });
    const covered = new Set(rows.map((r) => r.zoneMilestoneId));
    return milestones
      .filter((m) => !covered.has(m.id))
      .map(
        (m) =>
          `no row for milestone ${m.suffix} (${m.minKm}-${m.maxKm} km) — shipments in that distance band get no base charge`,
      );
  }

  if (configJson.mode === "ZONE_PAIR") {
    const zones = await prisma.zone.findMany({
      where: { partnerId, zoneType: "GEOLOGICAL", status: true },
      select: { id: true, name: true },
    });
    const nameById = new Map(zones.map((z) => [z.id, z.name]));
    const covered = new Set(rows.map((r) => `${r.fromZoneId}>${r.toZoneId}`));
    const gaps = [];
    for (const from of zones) {
      for (const to of zones) {
        if (!covered.has(`${from.id}>${to.id}`)) {
          gaps.push(
            `no row for ${nameById.get(from.id)} → ${nameById.get(to.id)} — that lane gets no base charge`,
          );
        }
      }
    }
    return gaps;
  }

  return [];
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
 * Make sure a snapshot exists for a row's CURRENT version BEFORE it is mutated.
 *
 * recordVersion() snapshots a row AFTER the change, tagged with the NEW version
 * number — self-consistent, but it means "what did we just overwrite?" is only
 * answerable if a snapshot already exists for version N-1. That is not true for
 * any row written outside these services (seed, raw SQL, a restored dump), so
 * call this immediately before an update to backfill the pre-change state.
 *
 * Like recordVersion, this must never block the write it protects.
 */
async function ensureVersionSnapshot(
  entityType,
  entity,
  { changeSource = "BACKFILL", changedById = null } = {},
) {
  if (!entity?.id || typeof entity.version !== "number") return;

  try {
    const existing = await prisma.chargeConfigVersion.findFirst({
      where: { entityType, entityId: entity.id, version: entity.version },
      select: { id: true },
    });
    if (existing) return;

    await recordVersion(entityType, entity.id, entity.version, entity, {
      changeSource,
      changedById,
    });
  } catch (error) {
    // Versioning must never block the write itself
    logger.error("Failed to ensure charge config version snapshot:", error);
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
  findMatrixProblems,
  findMatrixCoverageGaps,
  recordVersion,
  ensureVersionSnapshot,
  bumpConfigRevision,
  getConfigRevision,
  createAuditLog,
  CONFIG_REV_KEY,
};
