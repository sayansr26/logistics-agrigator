/**
 * AI Suggestion Review Workflow (Charges Engine v3)
 *
 * Admins list, approve, or reject AI-drafted config suggestions. Approval
 * materializes drafts through the NORMAL chargeDefinitionService /
 * partnerChargeConfigService create paths, so validation, versioning, audit
 * logging, and cache invalidation happen exactly once (changeSource
 * AI_SUGGESTED / LEGACY_IMPORT).
 */

const { prisma } = require("../../config/database");
const { ValidationError, NotFoundError } = require("../../shared/lib/errors");
const logger = require("../../shared/lib/logger");
const chargeDefinitionService = require("../chargeDefinitionService");
const partnerChargeConfigService = require("../partnerChargeConfigService");

async function listSuggestions(filters = {}) {
  const { page = 1, limit = 20, kind, status } = filters;
  const where = {
    ...(kind && { kind }),
    ...(status && { status }),
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [suggestions, total] = await Promise.all([
    prisma.aiChargeSuggestion.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiChargeSuggestion.count({ where }),
  ]);

  return {
    suggestions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Statuses an approve may act on.
 *
 * APPROVED is included deliberately. A suggestion whose apply partly failed is
 * marked APPROVED (not APPLIED) and used to be terminal — which is how a single
 * fixable error (a definition code that already existed) turned into fifteen
 * abandoned drafts. Config writes are now upsert-shaped and definition writes
 * are reuse-shaped, so re-approving is idempotent and safe to retry.
 */
const APPROVABLE_STATUSES = new Set(["PENDING", "APPROVED"]);

/**
 * Resolve the channel a drafted config belongs to.
 *
 * Precedence: the config's own value (the model may echo it) > an explicit
 * approve-time override > the channel the admin picked when drafting. Returns
 * null for a partner-wide config.
 */
function resolveChannelId(suggestion, cfg, options = {}) {
  const channelId =
    cfg?.channelId ??
    options?.channelId ??
    suggestion?.inputContext?.channelId ??
    null;
  return channelId === undefined ? null : channelId;
}

/**
 * Resolve every id a draft references WITHOUT writing anything.
 *
 * This replaces a DB transaction on purpose. chargeDefinitionService,
 * partnerChargeConfigService and chargeConfigShared all close over the
 * module-level prisma client, so threading a tx through create/update/assert/
 * version/audit would be a ~10-function signature change across the charges
 * module for one caller — and two of the side effects cannot be rolled back
 * anyway (bumpConfigRevision is a Redis INCR; recordVersion and createAuditLog
 * deliberately swallow their own errors), so an "atomic" wrapper would be a
 * half-truth.
 *
 * Validating everything up front gives true all-or-nothing for every realistic
 * failure — unknown definition code, missing partnerId, a channel belonging to
 * another partner. Only "the DB died mid-loop" can still land partially, and
 * that is now recoverable because a re-approve is idempotent.
 */
async function preflight(draft, { suggestion, options }) {
  const problems = [];
  const plan = { configs: [] };

  for (const cfg of draft.configs || []) {
    const label = cfg?.chargeDefinitionCode || "?";

    const definition = cfg?.chargeDefinitionCode
      ? await prisma.chargeDefinition.findUnique({
          where: { code: cfg.chargeDefinitionCode },
          select: { id: true, code: true },
        })
      : null;

    if (!cfg?.chargeDefinitionCode) {
      problems.push(`config ${label}: draft has no chargeDefinitionCode`);
      continue;
    }

    // A definition created earlier in THIS draft does not exist yet, so a miss
    // here is only a problem when the draft does not also define it.
    const definedInDraft = (draft.definitions || []).some(
      (d) => d?.code === cfg.chargeDefinitionCode,
    );
    if (!definition && !definedInDraft) {
      problems.push(
        `config ${label}: definition code not found: ${cfg.chargeDefinitionCode}`,
      );
      continue;
    }

    const partnerId = cfg.partnerId || suggestion.inputContext?.partnerId;
    if (!partnerId) {
      problems.push(
        `config ${label}: no partnerId on the draft or its input context`,
      );
      continue;
    }

    const channelId = resolveChannelId(suggestion, cfg, options);
    if (channelId !== null && typeof channelId !== "string") {
      problems.push(`config ${label}: channelId must be a uuid or null`);
      continue;
    }

    if (channelId) {
      const channel = await prisma.partnerServiceChannel.findFirst({
        where: { id: channelId, partnerId },
        select: { id: true },
      });
      if (!channel) {
        problems.push(
          `config ${label}: PartnerServiceChannel ${channelId} not found for partner ${partnerId}`,
        );
        continue;
      }
    }

    plan.configs.push({ cfg, partnerId, channelId });
  }

  return { problems, plan };
}

/**
 * Create a definition, or reuse the catalog entry that already owns the code.
 *
 * Re-emitting an existing code is exactly what the draft prompt asks the model
 * to do ("reuse instead of duplicating"), so treating it as a fatal apply error
 * contradicted our own instruction. An AI draft never UPDATES a catalog
 * definition — reuse is silent except for the one genuinely dangerous case,
 * where the draft proposes a different computation method.
 */
async function applyDefinition(def, { changeSource, reqContext }) {
  const existing = await prisma.chargeDefinition.findUnique({
    where: { code: def.code },
    select: { id: true, code: true, computation: true },
  });

  if (existing) {
    const warnings = [];
    const proposed = def?.computation?.method;
    if (proposed && proposed !== existing.computation?.method) {
      warnings.push(
        `definition ${existing.code}: reused the existing catalog entry (method ${existing.computation?.method}); the draft proposed ${proposed} and was ignored`,
      );
    }
    return { code: existing.code, id: existing.id, action: "REUSED", warnings };
  }

  const created = await chargeDefinitionService.createDefinition(def, {
    ...reqContext,
    changeSource,
  });
  return {
    code: created.code,
    id: created.id,
    action: "CREATED",
    warnings: [],
  };
}

/**
 * Write one drafted config, upserting on the natural key
 * (partnerId, chargeDefinitionId, channelId) — the same key as the unique
 * constraint and as createConfig's duplicate guard.
 */
async function applyConfig(
  { cfg, partnerId, channelId },
  { changeSource, reqContext },
) {
  const definition = await prisma.chargeDefinition.findUnique({
    where: { code: cfg.chargeDefinitionCode },
    select: { id: true, code: true },
  });
  if (!definition) {
    throw new ValidationError(
      `definition code not found: ${cfg.chargeDefinitionCode}`,
    );
  }

  // channelId is passed as a literal, null included: Prisma renders that as
  // IS NULL, which is what makes this lookup agree with createConfig's guard.
  // An undefined leaking in here would match ANY channel and silently overwrite
  // the wrong row, so preflight has already asserted the type.
  const existing = await prisma.partnerChargeConfig.findFirst({
    where: { partnerId, chargeDefinitionId: definition.id, channelId },
    select: { id: true, version: true },
  });

  // conditions is passed explicitly, defaulting to null rather than being
  // omitted: an omitted key would leave a stale condition in place, and on BASE
  // freight a stale condition makes the charge vanish from quotes entirely.
  const payload = {
    config: cfg.config,
    conditions: cfg.conditions ?? null,
  };

  if (!existing) {
    const created = await partnerChargeConfigService.createConfig(
      { partnerId, chargeDefinitionId: definition.id, channelId, ...payload },
      { ...reqContext, changeSource },
    );
    return {
      id: created.id,
      code: definition.code,
      channelId,
      action: "CREATED",
      version: created.version,
      previousVersion: null,
    };
  }

  // channelId is deliberately NOT in the patch. The lookup key IS the channel,
  // so an update can never move a row across channels — which sidesteps the
  // missing duplicate guard in updateConfig. Drafting for a different channel
  // creates a new row, which is the correct model.
  const updated = await partnerChargeConfigService.updateConfig(
    existing.id,
    payload,
    { ...reqContext, changeSource },
  );
  return {
    id: updated.id,
    code: definition.code,
    channelId,
    action: "UPDATED",
    version: updated.version,
    previousVersion: existing.version,
  };
}

/**
 * Approve a suggestion: reuse-or-create its definitions, then upsert its
 * configs. Everything resolvable is checked before the first write; the
 * suggestion is marked APPLIED only when every item lands.
 */
async function approveSuggestion(id, reqContext = {}, options = {}) {
  const suggestion = await prisma.aiChargeSuggestion.findUnique({
    where: { id },
  });
  if (!suggestion) throw new NotFoundError("AiChargeSuggestion", id);
  if (!APPROVABLE_STATUSES.has(suggestion.status)) {
    throw new ValidationError(
      `Suggestion is ${suggestion.status}; only PENDING or APPROVED suggestions can be approved`,
    );
  }

  const changeSource =
    suggestion.kind === "LEGACY_IMPORT" ? "LEGACY_IMPORT" : "AI_SUGGESTED";
  const draft = suggestion.suggestion || {};
  const results = { definitions: [], configs: [], warnings: [], errors: [] };

  const { problems, plan } = await preflight(draft, { suggestion, options });

  if (problems.length === 0) {
    for (const def of draft.definitions || []) {
      try {
        const applied = await applyDefinition(def, {
          changeSource,
          reqContext,
        });
        results.definitions.push({
          code: applied.code,
          id: applied.id,
          action: applied.action,
        });
        results.warnings.push(...applied.warnings);
      } catch (error) {
        results.errors.push(`definition ${def?.code || "?"}: ${error.message}`);
      }
    }

    for (const entry of plan.configs) {
      try {
        results.configs.push(
          await applyConfig(entry, { changeSource, reqContext }),
        );
      } catch (error) {
        results.errors.push(
          `config ${entry.cfg?.chargeDefinitionCode || "?"}: ${error.message}`,
        );
      }
    }
  } else {
    results.errors.push(...problems);
  }

  const finalStatus = results.errors.length === 0 ? "APPLIED" : "APPROVED";
  const updated = await prisma.aiChargeSuggestion.update({
    where: { id },
    data: {
      status: finalStatus,
      reviewedById: reqContext.userId || null,
      reviewedAt: new Date(),
      // Merge, never replace: the draft-time `problems` are a permanent record
      // of what validation saw and must survive an apply. applyErrors is set
      // even when empty so a successful retry clears a previous failure.
      validation: {
        ...(suggestion.validation && typeof suggestion.validation === "object"
          ? suggestion.validation
          : {}),
        applyErrors: results.errors,
        applyWarnings: results.warnings,
        appliedAt: new Date().toISOString(),
      },
    },
  });

  logger.info("AI suggestion approved", {
    suggestionId: id,
    status: finalStatus,
    definitions: {
      created: results.definitions.filter((d) => d.action === "CREATED").length,
      reused: results.definitions.filter((d) => d.action === "REUSED").length,
    },
    configs: {
      created: results.configs.filter((c) => c.action === "CREATED").length,
      updated: results.configs.filter((c) => c.action === "UPDATED").length,
      channelIds: [...new Set(results.configs.map((c) => c.channelId))],
    },
    warnings: results.warnings.length,
    errors: results.errors.length,
  });

  return { suggestion: updated, results };
}

async function rejectSuggestion(id, reqContext = {}) {
  const suggestion = await prisma.aiChargeSuggestion.findUnique({
    where: { id },
  });
  if (!suggestion) throw new NotFoundError("AiChargeSuggestion", id);
  if (suggestion.status !== "PENDING") {
    throw new ValidationError(
      `Suggestion is ${suggestion.status}; only PENDING suggestions can be rejected`,
    );
  }

  return prisma.aiChargeSuggestion.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: reqContext.userId || null,
      reviewedAt: new Date(),
    },
  });
}

module.exports = { listSuggestions, approveSuggestion, rejectSuggestion };
