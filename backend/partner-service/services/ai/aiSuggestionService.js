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
 * Approve a PENDING suggestion: create its definitions, then its configs.
 * Partial failures are recorded per item; the suggestion is marked APPLIED
 * only when every item lands.
 */
async function approveSuggestion(id, reqContext = {}) {
  const suggestion = await prisma.aiChargeSuggestion.findUnique({
    where: { id },
  });
  if (!suggestion) throw new NotFoundError("AiChargeSuggestion", id);
  if (suggestion.status !== "PENDING") {
    throw new ValidationError(
      `Suggestion is ${suggestion.status}; only PENDING suggestions can be approved`,
    );
  }

  const changeSource =
    suggestion.kind === "LEGACY_IMPORT" ? "LEGACY_IMPORT" : "AI_SUGGESTED";
  const draft = suggestion.suggestion || {};
  const results = { definitions: [], configs: [], errors: [] };

  for (const def of draft.definitions || []) {
    try {
      const created = await chargeDefinitionService.createDefinition(def, {
        ...reqContext,
        changeSource,
      });
      results.definitions.push({ code: created.code, id: created.id });
    } catch (error) {
      results.errors.push(`definition ${def?.code || "?"}: ${error.message}`);
    }
  }

  for (const cfg of draft.configs || []) {
    try {
      const definition = await prisma.chargeDefinition.findUnique({
        where: { code: cfg.chargeDefinitionCode },
        select: { id: true },
      });
      if (!definition) {
        throw new ValidationError(
          `definition code not found: ${cfg.chargeDefinitionCode}`,
        );
      }
      if (!cfg.partnerId) {
        throw new ValidationError("config draft has no partnerId");
      }
      const created = await partnerChargeConfigService.createConfig(
        {
          partnerId: cfg.partnerId,
          chargeDefinitionId: definition.id,
          channelId: cfg.channelId || null,
          config: cfg.config,
          conditions: cfg.conditions || null,
        },
        { ...reqContext, changeSource },
      );
      results.configs.push({ id: created.id, code: cfg.chargeDefinitionCode });
    } catch (error) {
      results.errors.push(
        `config ${cfg?.chargeDefinitionCode || "?"}: ${error.message}`,
      );
    }
  }

  const finalStatus = results.errors.length === 0 ? "APPLIED" : "APPROVED";
  const updated = await prisma.aiChargeSuggestion.update({
    where: { id },
    data: {
      status: finalStatus,
      reviewedById: reqContext.userId || null,
      reviewedAt: new Date(),
      validation:
        results.errors.length > 0
          ? { applyErrors: results.errors }
          : suggestion.validation,
    },
  });

  logger.info("AI suggestion approved", {
    suggestionId: id,
    status: finalStatus,
    applied: {
      definitions: results.definitions.length,
      configs: results.configs.length,
    },
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
