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
const { encodeRateCards } = require("./rateCard/encoder");
const { compileActions } = require("./actions/compile");
const { replayExamples, describeFailures } = require("./rateCard/replay");
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
 * The catalog as "CODE — Name (category, method)" lines.
 *
 * A bare list of codes tells the model a code exists but not what it DOES, so
 * it cannot recognise which entry is the base-freight one and reaches for a new
 * definition instead of reusing it.
 */
async function getExistingDefinitionSummaries() {
  const definitions = await prisma.chargeDefinition.findMany({
    select: { code: true, name: true, category: true, computation: true },
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  return definitions.map((d) => ({
    code: d.code,
    name: d.name,
    category: d.category,
    method: d.computation?.method || null,
  }));
}

/**
 * The partner's service channels (weight-slab shipping products) — the things
 * PartnerChargeConfig.channelId points at. Names only in the prompt; ids are
 * resolved in code so the model can never invent one.
 */
async function getChannelContext(partnerId) {
  if (!partnerId) return null;

  return prisma.partnerServiceChannel.findMany({
    where: { partnerId, isActive: true },
    select: {
      id: true,
      channelName: true,
      accountRef: true,
      serviceType: true,
      businessType: true,
      minWeight: true,
      maxWeight: true,
    },
    orderBy: { priority: "asc" },
  });
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
 * The partner's existing BASE-category configs, so the encoder attaches a rate
 * card to the definition their base freight already lives on instead of
 * reaching for a new one.
 */
async function getExistingBaseConfigs(partnerId) {
  if (!partnerId) return [];

  const configs = await prisma.partnerChargeConfig.findMany({
    where: { partnerId, chargeDefinition: { category: "BASE" } },
    select: {
      channelId: true,
      chargeDefinition: { select: { code: true } },
    },
  });

  return configs.map((c) => ({
    channelId: c.channelId,
    chargeDefinitionCode: c.chargeDefinition.code,
  }));
}

/**
 * Everything the admin asked for that the system did not act on.
 *
 * The prompt tells the model to file anything it cannot express into
 * `rateCard.notes` ("volumetric divisor, TAT, RTO policy"), and to name a
 * channel it cannot bind in `warnings`. Both were then written to JSONB and read
 * by nobody — so an instruction the system silently dropped looked exactly like
 * an instruction it had ignored. Collect them into one first-class list the UI
 * can put in front of the admin.
 *
 * Advisory only: this never blocks approval, it just stops the drop being silent.
 */
function collectUnsupported(json) {
  const items = [];

  (json?.rateCards || []).forEach((card, index) => {
    for (const note of card?.notes || []) {
      if (!note) continue;
      items.push({
        source: `rate card ${index + 1}`,
        request: String(note),
        reason: "no field in the charge contract covers this",
      });
    }
  });

  // Forward-compatible with the v4 action contract, where the model reports its
  // own refusals explicitly rather than us inferring them from notes.
  for (const entry of json?.unsupported || []) {
    if (!entry) continue;
    items.push(
      typeof entry === "string"
        ? { source: "prompt", request: entry, reason: "not supported" }
        : {
            source: entry.source || "prompt",
            request: String(entry.request ?? ""),
            reason: entry.reason || "not supported",
          },
    );
  }

  return items.filter((i) => i.request);
}

/**
 * Turn the model's plain rate cards into real MATRIX configs, then replay the
 * admin's own worked examples through the engine against what we encoded.
 *
 * Returns v2-shaped config entries, so approveSuggestion applies v2 and v3
 * drafts through one identical code path.
 */
function encodeAndReplayRateCards(json, partnerContext, definitionsByCode) {
  const {
    configs,
    definitions: definitionsToCreate,
    encoded,
    problems,
    warnings,
  } = encodeRateCards(json?.rateCards, partnerContext);

  const replay = [];
  for (const item of encoded) {
    // A bootstrapped definition does not exist in the catalog yet, so fall back
    // to the spec the encoder wants created — otherwise the very first base
    // charge would be the one config that never gets its examples replayed.
    const definition =
      definitionsByCode.get(item.chargeDefinitionCode) ||
      item.definitionToCreate;
    if (!definition) continue;

    const outcome = replayExamples({
      definition,
      config: { config: item.config, conditions: null },
      milestones: item.milestones,
      examples: item.examples,
    });

    replay.push({
      rateCardIndex: item.index,
      chargeDefinitionCode: item.chargeDefinitionCode,
      channelId: item.channelId,
      ...outcome,
    });

    // A card that cannot reproduce its own worked examples is a problem, not a
    // warning — but it does not block approval yet, until we know the
    // false-positive rate.
    problems.push(...describeFailures(outcome.results, item.label));
  }

  return {
    configs,
    definitions: definitionsToCreate,
    replay,
    problems,
    warnings,
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
async function draftFromText({ description, partnerId, channelId, userId }) {
  if (!description || description.trim().length < 10) {
    throw new ValidationError("Please describe the charge in more detail");
  }

  // Fail fast, before the model call: a channel that does not belong to this
  // partner should cost a round trip to Postgres, not 90 seconds of streaming.
  if (channelId) {
    if (!partnerId) {
      throw new ValidationError("A channel can only be chosen with a partner");
    }
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

  const [
    existingDefinitions,
    zoneContext,
    channelContext,
    existingBaseConfigs,
  ] = await Promise.all([
    getExistingDefinitionSummaries(),
    getZoneContext(partnerId),
    getChannelContext(partnerId),
    getExistingBaseConfigs(partnerId),
  ]);
  // Config drafting generates long JSON — allow for slow token streaming
  const { json, model } = await aiClient.completeJson(
    prompts.draftFromTextMessages({
      description,
      existingDefinitions,
      partnerId,
      channelId,
      channelContext,
      zoneContext,
    }),
    { maxTokens: 4000, timeoutMs: 90000 },
  );

  const definitionRows = await prisma.chargeDefinition.findMany();
  const partnerContext = {
    partnerId,
    distanceZones: zoneContext?.distanceZones || [],
    channels: channelContext || [],
    definitions: definitionRows,
    existingBaseConfigs,
    selectedChannelId: channelId || null,
  };

  // v4: compile the model's action list down to the same {definitions, configs}
  // the approval path has always applied. Rate cards are handed straight back to
  // the encoder so they keep their guardrails and replay verification. A stored
  // v2/v3 row has no `actions` and compiles to nothing, flowing through as before.
  const compiled = compileActions(json.actions, partnerContext);

  // Encode the plain rate cards in code, then merge the results into `configs`
  // so everything downstream sees one uniform shape.
  const encodedRateCards = encodeAndReplayRateCards(
    { ...json, rateCards: [...(json.rateCards || []), ...compiled.rateCards] },
    partnerContext,
    new Map(definitionRows.map((d) => [d.code, d])),
  );

  // Merge the encoder's definitions in by code. The model is told not to emit
  // base-freight definitions, so in practice this only carries a bootstrap on
  // an empty catalog — but dedupe anyway rather than trust that.
  const draftDefinitions = [
    ...(json.definitions || []),
    ...compiled.definitions,
  ];
  for (const def of encodedRateCards.definitions || []) {
    if (!draftDefinitions.some((d) => d?.code === def.code)) {
      draftDefinitions.push(def);
    }
  }

  const draft = {
    ...json,
    definitions: draftDefinitions,
    configs: [
      ...(json.configs || []),
      ...compiled.configs,
      ...encodedRateCards.configs,
    ],
    replay: encodedRateCards.replay,
    encoderWarnings: [...compiled.warnings, ...encodedRateCards.warnings],
    // The compiler's refusals are first-class: an action the system will not
    // carry out is reported, never silently skipped.
    unsupported: [...collectUnsupported(json), ...compiled.unsupported],
  };

  const validation = [
    ...compiled.problems,
    ...encodedRateCards.problems,
    // validateDraft is a genuine independent second opinion on the encoder: it
    // hits the DB via findDanglingRefs, while the encoder only ever saw a
    // context object.
    ...(await validateDraft(draft)),
  ];

  const record = await storeSuggestion({
    kind: "CONFIG_FROM_NL",
    inputContext: {
      description,
      partnerId: partnerId || null,
      // Read back by aiSuggestionService.approveSuggestion to scope the write.
      channelId: channelId || null,
      promptVersion: prompts.PROMPT_VERSION,
    },
    suggestion: draft,
    validation,
    modelUsed: model,
    createdById: userId,
  });

  logger.info("AI config draft created", {
    suggestionId: record.id,
    definitions: draft.definitions?.length || 0,
    rateCards: json.rateCards?.length || 0,
    actions: json.actions?.length || 0,
    configs: draft.configs.length,
    replayFailures: encodedRateCards.replay.reduce((n, r) => n + r.failed, 0),
    unsupported: draft.unsupported.length,
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

module.exports = {
  draftFromText,
  importLegacy,
  validateDraft,
  getChannelContext,
  getExistingBaseConfigs,
  encodeAndReplayRateCards,
  collectUnsupported,
  getExistingDefinitionSummaries,
};
