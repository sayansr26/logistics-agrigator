/**
 * Action compiler (Charges Engine v3, prompt v4).
 *
 * The model emits a typed list of ACTIONS. This turns them into the same
 * `{ definitions, configs }` shape the approval path has always applied, so
 * `approveSuggestion` needs no rewrite and every stored v2/v3 suggestion keeps
 * working unchanged — those rows simply already carry `definitions`/`configs`
 * and never reach this module.
 *
 * Why an action list at all: previously a prompt could only affect the world
 * through four fixed slots, so any instruction that did not fit one of them
 * ("create the base charge if it is missing") was inert. An action is something
 * the model can explicitly ASK for and code can explicitly accept or refuse —
 * and a refusal is recorded rather than silently dropped.
 *
 * Deliberately narrow: definitions and configs only. Zones, milestones, service
 * channels and pincode types stay read-only, and a request to change one is
 * returned as `unsupported` rather than ignored.
 */

const { validateConfigForMethod } = require("../../chargeConfigMethods");
const { resolveChannel } = require("../rateCard/encoder");
const {
  chargeDefinitions: definitionSchemas,
} = require("../../../validation/chargeDefinitionSchemas");

/** Action types this system can actually carry out. */
const SUPPORTED_ACTIONS = ["create_definition", "upsert_config", "rate_card"];

/**
 * Things an admin plausibly asks for that this path deliberately cannot do.
 * Naming them gives the model an honest reason to hand back instead of a
 * silent no-op, and gives the admin a next step.
 */
const KNOWN_REFUSALS = {
  create_zone: "zones and milestones are managed in Zone Management, not here",
  create_milestone:
    "zones and milestones are managed in Zone Management, not here",
  create_channel:
    "service channels are managed on the partner's Channels page, not here",
  update_channel:
    "service channels are managed on the partner's Channels page, not here",
  create_pincode_type: "pincode types are managed in Pincode Types, not here",
  update_definition:
    "an existing charge definition is shared by every partner, so it is not editable from a draft",
  delete_definition:
    "an existing charge definition is shared by every partner, so it is not deletable from a draft",
  delete_config:
    "deleting a charge config is done from the Charge Configs page",
};

function compileCreateDefinition(action, ctx, out) {
  const definition = action?.definition;
  if (!definition || typeof definition !== "object") {
    out.problems.push(
      `${ctx.at}: create_definition needs a "definition" object`,
    );
    return;
  }

  // Reuse the same Joi the manual create endpoint uses, so a drafted definition
  // cannot be shaped in a way the real write path would reject at approval.
  const { error } = definitionSchemas.createDefinition.body.validate(
    definition,
    {
      abortEarly: false,
      stripUnknown: true,
    },
  );
  if (error) {
    for (const detail of error.details) {
      out.problems.push(
        `${ctx.at}: definition ${definition.code || "?"}: ${detail.message}`,
      );
    }
    return;
  }

  if (out.definitions.some((d) => d.code === definition.code)) return; // dedupe
  out.definitions.push(definition);
}

function compileUpsertConfig(action, ctx, out) {
  const code = action?.chargeDefinitionCode;
  if (!code) {
    out.problems.push(`${ctx.at}: upsert_config needs "chargeDefinitionCode"`);
    return;
  }

  // A definition created earlier in this same draft counts as available.
  const known =
    ctx.definitionsByCode.get(code) ||
    out.definitions.find((d) => d.code === code) ||
    null;
  if (!known) {
    out.problems.push(
      `${ctx.at}: no charge definition "${code}" exists, and this draft does not create one`,
    );
    return;
  }

  if (!action.config || typeof action.config !== "object") {
    out.problems.push(
      `${ctx.at}: upsert_config for ${code} needs a "config" object`,
    );
    return;
  }

  const methodProblems = validateConfigForMethod(
    known.computation,
    action.config,
  );
  if (methodProblems.length > 0) {
    out.problems.push(...methodProblems.map((p) => `${ctx.at}: ${code}: ${p}`));
    return;
  }

  // Same channel matching as the rate-card path, including its refusal to guess
  // between near-identical names.
  const channelId = resolveChannel(
    action.channel,
    ctx.channels,
    ctx.selectedChannelId,
    out.problems,
    out.warnings,
  );
  if (action.channel && !channelId && !ctx.selectedChannelId) return;

  out.configs.push({
    chargeDefinitionCode: code,
    partnerId: ctx.partnerId,
    channelId,
    config: action.config,
    conditions: action.conditions ?? null,
    source: "ACTION",
  });
}

/**
 * @param {Array} actions             the model's `actions` list (v4)
 * @param {object} partnerContext     { partnerId, channels, definitions, selectedChannelId }
 * @returns {{ definitions, configs, rateCards, unsupported, problems, warnings }}
 *   `rateCards` are handed back for the existing encoder to process, so the
 *   rate-card path keeps its guardrails and replay verification.
 */
function compileActions(actions, partnerContext = {}) {
  const out = {
    definitions: [],
    configs: [],
    rateCards: [],
    unsupported: [],
    problems: [],
    warnings: [],
  };

  if (!Array.isArray(actions) || actions.length === 0) return out;

  const ctx = {
    partnerId: partnerContext.partnerId,
    channels: partnerContext.channels || [],
    selectedChannelId: partnerContext.selectedChannelId || null,
    definitionsByCode: new Map(
      (partnerContext.definitions || []).map((d) => [d.code, d]),
    ),
    at: "",
  };

  actions.forEach((action, index) => {
    ctx.at = `action ${index + 1}`;
    const type = action?.type;

    if (type === "create_definition")
      return compileCreateDefinition(action, ctx, out);
    if (type === "upsert_config") return compileUpsertConfig(action, ctx, out);
    if (type === "rate_card") {
      if (action.rateCard) out.rateCards.push(action.rateCard);
      return;
    }

    // Anything else is reported, never guessed at.
    out.unsupported.push({
      source: ctx.at,
      request:
        action?.request ||
        action?.description ||
        `action "${type || "unknown"}"`,
      reason:
        KNOWN_REFUSALS[type] ||
        `"${type || "unknown"}" is not something charge drafting can do`,
    });
  });

  return out;
}

module.exports = { compileActions, SUPPORTED_ACTIONS, KNOWN_REFUSALS };
