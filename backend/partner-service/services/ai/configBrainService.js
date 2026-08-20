/**
 * AI Config Brain (Charges Engine v3)
 *
 * Natural language → draft charge configs, and legacy-rule export → proposed
 * v3 configs. Every AI output:
 *   1. is validated in code (Joi shape + referential checks)
 *   2. is stored as an AiChargeSuggestion with status PENDING
 *   3. NEVER touches live configuration — admins approve via aiSuggestionService
 */

const aiClient = require("../../shared/lib/aiClient");
const { prisma } = require("../../config/database");
const { ValidationError } = require("../../shared/lib/errors");
const logger = require("../../shared/lib/logger");
const {
  findDanglingRefs,
  findMatrixProblems,
} = require("../chargeConfigShared");
const prompts = require("./prompts/chargeConfigPrompts");
const {
  chargeDefinitions: definitionSchemas,
} = require("../../validation/chargeDefinitionSchemas");

async function getExistingDefinitionCodes() {
  const definitions = await prisma.chargeDefinition.findMany({
    select: { code: true },
    orderBy: { code: "asc" },
  });
  return definitions.map((d) => d.code);
}

/**
 * The partner's real zones/milestones, so the model drafts MATRIX configs
 * against ids that exist instead of inventing placeholders.
 */
async function getZoneContext(partnerId) {
  if (!partnerId) return null;

  const zones = await prisma.zone.findMany({
    where: { partnerId, status: true },
    select: {
      id: true,
      name: true,
      zoneType: true,
      milestones: {
        select: { id: true, suffix: true, minKm: true, maxKm: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return {
    distanceZones: zones.filter((z) => z.zoneType === "DISTANCE"),
    geoZones: zones
      .filter((z) => z.zoneType === "GEOLOGICAL")
      .map(({ id, name }) => ({ id, name })),
  };
}

/**
 * Validate an AI draft ({definitions, configs}) and collect problems instead
 * of throwing — problems are surfaced to the reviewing admin.
 */
async function validateDraft(draft) {
  const problems = [];
  const definitions = Array.isArray(draft.definitions) ? draft.definitions : [];
  const configs = Array.isArray(draft.configs) ? draft.configs : [];

  const existingDefinitions = await prisma.chargeDefinition.findMany({
    select: { code: true, computation: true },
  });
  // Computation shapes for both catalogued and freshly drafted definitions —
  // a MATRIX config is validated against whichever one it references.
  const computationByCode = new Map(
    existingDefinitions.map((d) => [d.code, d.computation]),
  );
  for (const def of definitions) {
    if (def?.code && def?.computation) {
      computationByCode.set(def.code, def.computation);
    }
  }

  const knownCodes = new Set(computationByCode.keys());
  for (const def of definitions) {
    const { error } = definitionSchemas.createDefinition.body.validate(def, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      problems.push(
        `definition ${def?.code || "?"}: ${error.details.map((d) => d.message).join("; ")}`,
      );
    }
    if (knownCodes.has(def?.code)) {
      problems.push(
        `definition ${def.code}: code already exists (should reuse, not redefine)`,
      );
    }
    knownCodes.add(def?.code);
  }

  for (const cfg of configs) {
    if (!cfg?.chargeDefinitionCode) {
      problems.push("config missing chargeDefinitionCode");
      continue;
    }
    if (!knownCodes.has(cfg.chargeDefinitionCode)) {
      problems.push(
        `config references unknown definition code: ${cfg.chargeDefinitionCode}`,
      );
    }
    if (!cfg.config || typeof cfg.config !== "object") {
      problems.push(
        `config for ${cfg.chargeDefinitionCode}: missing config values`,
      );
      continue;
    }
    problems.push(
      ...findMatrixProblems(
        computationByCode.get(cfg.chargeDefinitionCode),
        cfg.config,
      ).map((p) => `config for ${cfg.chargeDefinitionCode}: ${p}`),
    );
    if (cfg.partnerId) {
      const partner = await prisma.partner.findUnique({
        where: { id: cfg.partnerId },
        select: { id: true },
      });
      if (!partner) {
        problems.push(
          `config for ${cfg.chargeDefinitionCode}: partner not found (${cfg.partnerId})`,
        );
      } else {
        const refProblems = await findDanglingRefs(cfg.config, {
          partnerId: cfg.partnerId,
        });
        problems.push(
          ...refProblems.map(
            (p) => `config for ${cfg.chargeDefinitionCode}: ${p}`,
          ),
        );
      }
    }
  }

  return problems;
}

async function storeSuggestion({
  kind,
  inputContext,
  suggestion,
  validation,
  modelUsed,
  createdById,
}) {
  return prisma.aiChargeSuggestion.create({
    data: {
      kind,
      status: "PENDING",
      inputContext,
      suggestion,
      validation: validation.length > 0 ? { problems: validation } : null,
      modelUsed,
      createdById: createdById || null,
    },
  });
}

/**
 * Natural language → draft definitions/configs (stored PENDING).
 */
async function draftFromText({ description, partnerId, userId }) {
  if (!description || description.trim().length < 10) {
    throw new ValidationError("Please describe the charge in more detail");
  }

  const [existingDefinitions, zoneContext] = await Promise.all([
    getExistingDefinitionCodes(),
    getZoneContext(partnerId),
  ]);
  // Config drafting generates long JSON — allow for slow token streaming
  const { json, model } = await aiClient.completeJson(
    prompts.draftFromTextMessages({
      description,
      existingDefinitions,
      partnerId,
      zoneContext,
    }),
    { maxTokens: 4000, timeoutMs: 90000 },
  );

  const validation = await validateDraft(json);
  const record = await storeSuggestion({
    kind: "CONFIG_FROM_NL",
    inputContext: {
      description,
      partnerId: partnerId || null,
      promptVersion: prompts.PROMPT_VERSION,
    },
    suggestion: json,
    validation,
    modelUsed: model,
    createdById: userId,
  });

  logger.info("AI config draft created", {
    suggestionId: record.id,
    definitions: json.definitions?.length || 0,
    configs: json.configs?.length || 0,
    validationProblems: validation.length,
  });

  return { suggestion: record, validationProblems: validation };
}

/**
 * Legacy export JSON → proposed v3 configs (stored PENDING).
 * Accepts the output of scripts/export-legacy-charges.js (or a subset).
 */
async function importLegacy({ legacyExport, userId }) {
  const rules = legacyExport?.chargeRules || legacyExport?.rules;
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new ValidationError(
      "legacyExport.chargeRules must be a non-empty array (output of export-legacy-charges.js)",
    );
  }
  if (rules.length > 200) {
    throw new ValidationError(
      "Too many legacy rules in one request — import in batches of up to 200",
    );
  }

  const existingDefinitions = await getExistingDefinitionCodes();
  // Largest generation in the system (batch rule conversion) — 2min budget
  const { json, model } = await aiClient.completeJson(
    prompts.importLegacyMessages({ legacyRules: rules, existingDefinitions }),
    { maxTokens: 6000, timeoutMs: 120000 },
  );

  const validation = await validateDraft(json);
  const record = await storeSuggestion({
    kind: "LEGACY_IMPORT",
    inputContext: {
      ruleCount: rules.length,
      exportedAt: legacyExport?.exportedAt || null,
      promptVersion: prompts.PROMPT_VERSION,
    },
    suggestion: json,
    validation,
    modelUsed: model,
    createdById: userId,
  });

  logger.info("AI legacy import draft created", {
    suggestionId: record.id,
    rules: rules.length,
    configs: json.configs?.length || 0,
    validationProblems: validation.length,
  });

  return { suggestion: record, validationProblems: validation };
}

module.exports = { draftFromText, importLegacy, validateDraft };
