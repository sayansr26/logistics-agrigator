/**
 * Rate-card encoder (Charges Engine v3).
 *
 * Turns a plain rate card — the admin's own words, no UUIDs, no internal field
 * names — into a real MATRIX/MILESTONE PartnerChargeConfig.
 *
 * The split matters: understanding a rate card is genuinely AI work, but
 * mapping it onto milestone UUIDs, a MATRIX mode and trap-named fields is
 * mechanical, and mechanical work belongs in code. The model never sees an id,
 * so it can never invent one, pick the wrong mode, or mint a duplicate
 * definition to express a channel.
 *
 * Pure: every piece of DB data arrives in `partnerContext`, so this needs no
 * prisma and no mocks in tests.
 *
 * Scope is MILESTONE base freight only. ZONE_PAIR is an N x N lane grid — a
 * genuinely different input shape — and FLAT / PERCENT_WITH_MIN / SLAB /
 * OPTION_RATE and the rest keep the expressive advanced contract.
 */

const { normalizeName } = require("../../chargeEngine/milestoneMatch");

/** How far a band edge may sit from a milestone edge and still be "the same". */
const EDGE_TOLERANCE_KM = 1;

/** Shortest normalized channel name we will accept a containment match on. */
const MIN_CONTAINMENT_LENGTH = 6;

const isPositive = (n) => Number.isFinite(n) && n > 0;

function labelMilestones(milestones) {
  return milestones
    .map((m) => `${m.suffix} ${m.minKm}-${m.maxKm} km`)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Zone selection
// ---------------------------------------------------------------------------

function resolveZone(rateCard, distanceZones, problems) {
  if (distanceZones.length === 0) {
    problems.push(
      "this partner has no DISTANCE zone, so a km-band rate card cannot be encoded — create the zone and its milestones first",
    );
    return null;
  }

  if (distanceZones.length === 1) return distanceZones[0];

  const wanted = normalizeName(rateCard.zoneName);
  if (!wanted) {
    problems.push(
      `this partner has ${distanceZones.length} DISTANCE zones (${distanceZones
        .map((z) => `"${z.name}"`)
        .join(", ")}) — name which one the rate card is for`,
    );
    return null;
  }

  const matches = distanceZones.filter((z) => normalizeName(z.name) === wanted);
  if (matches.length !== 1) {
    problems.push(
      `zone "${rateCard.zoneName}" matches ${matches.length === 0 ? "none" : "more than one"} of this partner's DISTANCE zones (${distanceZones
        .map((z) => `"${z.name}"`)
        .join(", ")})`,
    );
    return null;
  }
  return matches[0];
}

// ---------------------------------------------------------------------------
// Band -> milestone
// ---------------------------------------------------------------------------

/**
 * Bind one band to one milestone. First hit wins; every tie is a problem
 * rather than a guess, because guessing here misprices silently.
 */
function bindBand(band, milestones, problems, warnings, at) {
  const fromKm = Number(band?.fromKm);
  const toKm =
    band?.toKm === null || band?.toKm === undefined ? null : Number(band.toKm);

  if (!Number.isFinite(fromKm)) {
    problems.push(`${at}: fromKm is missing or not a number`);
    return null;
  }

  // 1. Exact.
  const hit = milestones.find((m) => m.minKm === fromKm && m.maxKm === toKm);
  if (hit) return { milestone: hit, matchedBy: "EXACT" };

  // 2. Tolerant — absorbs the universal 0-50/51-500 vs 0-50/50-500 off-by-one.
  const tolerant = milestones.filter(
    (m) =>
      Math.abs(m.minKm - fromKm) <= EDGE_TOLERANCE_KM &&
      toKm !== null &&
      Math.abs(m.maxKm - toKm) <= EDGE_TOLERANCE_KM,
  );
  if (tolerant.length === 1) {
    warnings.push(
      `${at}: band ${fromKm}-${toKm} km bound to milestone ${tolerant[0].suffix} (${tolerant[0].minKm}-${tolerant[0].maxKm} km) — the edges differ by up to ${EDGE_TOLERANCE_KM} km`,
    );
    return { milestone: tolerant[0], matchedBy: "TOLERANT" };
  }

  // 3. Open tail — the admin's real "Above 1400 Km".
  const highest = milestones.reduce(
    (best, m) => (!best || m.maxKm > best.maxKm ? m : best),
    null,
  );
  const openEnded = toKm === null || (highest && toKm >= highest.maxKm);
  if (
    openEnded &&
    highest &&
    Math.abs(highest.minKm - fromKm) <= EDGE_TOLERANCE_KM
  ) {
    warnings.push(
      `${at}: open-ended band "above ${fromKm} km" bound to milestone ${highest.suffix} (${highest.minKm}-${highest.maxKm} km). Distances beyond ${highest.maxKm} km price at ${highest.suffix} via the engine's highest-milestone fallback.`,
    );
    return { milestone: highest, matchedBy: "OPEN_TAIL" };
  }

  // 4. Midpoint containment.
  if (toKm !== null && Number.isFinite(toKm)) {
    const mid = (fromKm + toKm) / 2;
    const containing = milestones.filter(
      (m) => mid >= m.minKm && mid <= m.maxKm,
    );
    if (containing.length === 1) {
      warnings.push(
        `${at}: band ${fromKm}-${toKm} km does not line up with any milestone; bound to ${containing[0].suffix} (${containing[0].minKm}-${containing[0].maxKm} km) because its midpoint falls there — check this one`,
      );
      return { milestone: containing[0], matchedBy: "MIDPOINT" };
    }
    if (containing.length > 1) {
      problems.push(
        `${at}: band ${fromKm}-${toKm} km is ambiguous — its midpoint falls in ${containing
          .map((m) => m.suffix)
          .join(" and ")}`,
      );
      return null;
    }
  }

  problems.push(
    `${at}: band ${fromKm}-${toKm ?? "onwards"} km matches no milestone of this partner (${labelMilestones(milestones)})`,
  );
  return null;
}

/**
 * A band's zone letter contradicting the milestone its km resolved to is a
 * hard problem, never a tiebreak override: one of the two is wrong and only
 * the admin knows which.
 */
function checkSuffix(band, milestone, milestones, problems, at) {
  const label = normalizeName(band?.zone);
  if (!label) return;
  if (!milestones.some((m) => normalizeName(m.suffix) === label)) return;
  if (normalizeName(milestone.suffix) === label) return;

  problems.push(
    `${at}: labelled zone "${band.zone}" but its distances match milestone ${milestone.suffix} (${milestone.minKm}-${milestone.maxKm} km) — the rate card's zone letters do not line up with this partner's zones`,
  );
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

/**
 * Bind the card to a service channel.
 *
 * Deliberately no fuzzy/edit-distance tier. The two live Delhivery channels are
 * 4 edits apart ("delhivery05surface" vs "delhivery5kgsurface"), so any
 * threshold loose enough to catch a real typo is loose enough to swap them and
 * misprice silently. An unmatched channel is an error the admin resolves.
 */
function resolveChannel(
  named,
  channels,
  selectedChannelId,
  problems,
  warnings,
) {
  if (selectedChannelId) {
    const selected = channels.find((c) => c.id === selectedChannelId) || null;
    if (!selected) {
      problems.push(
        `the selected channel ${selectedChannelId} is not one of this partner's active service channels`,
      );
      return null;
    }
    if (named && normalizeName(named) !== normalizeName(selected.channelName)) {
      problems.push(
        `the rate card names channel "${named}" but the request was scoped to "${selected.channelName}" — resolve the disagreement rather than guessing`,
      );
      return null;
    }
    return selected.id;
  }

  if (!named) {
    warnings.push(
      "no channel named — this card becomes the partner-wide fallback, applying to every channel without one of its own",
    );
    return null;
  }

  const wanted = normalizeName(named);
  const candidates = (haystack) =>
    channels.filter((c) => normalizeName(haystack(c)) === wanted);

  for (const field of [(c) => c.channelName, (c) => c.accountRef]) {
    const exact = candidates(field);
    if (exact.length === 1) return exact[0].id;
    if (exact.length > 1) {
      problems.push(
        `channel "${named}" matches more than one of this partner's channels (${exact
          .map((c) => `"${c.channelName}"`)
          .join(", ")}) — pick one explicitly`,
      );
      return null;
    }
  }

  if (wanted.length >= MIN_CONTAINMENT_LENGTH) {
    const loose = channels.filter((c) => {
      const name = normalizeName(c.channelName);
      const ref = normalizeName(c.accountRef);
      return (
        name.includes(wanted) ||
        wanted.includes(name) ||
        ref.includes(wanted) ||
        wanted.includes(ref)
      );
    });
    if (loose.length === 1) {
      warnings.push(
        `channel "${named}" matched "${loose[0].channelName}" by partial name — confirm it is the right one`,
      );
      return loose[0].id;
    }
    if (loose.length > 1) {
      problems.push(
        `channel "${named}" is ambiguous — it could be ${loose
          .map((c) => `"${c.channelName}"`)
          .join(" or ")}. Pick one explicitly.`,
      );
      return null;
    }
  }

  problems.push(
    `channel "${named}" matches none of this partner's service channels (${channels
      .map((c) => `"${c.channelName}"`)
      .join(", ")})`,
  );
  return null;
}

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

/**
 * The base-freight definition to create when the catalog has NONE.
 *
 * Deliberately identical in code/shape to prisma/seeds/chargeDefinitions.seed.js
 * so that running the seed later upserts onto this same row rather than leaving
 * a near-duplicate beside it. `isSystem` is left off on purpose: the seed sets
 * it true, so seeding reconciles a bootstrapped row into the system catalog.
 */
const BOOTSTRAP_BASE_DEFINITION = {
  code: "BASE_FREIGHT",
  name: "Base Freight",
  category: "BASE",
  applyStage: "QUOTE",
  phase: 100,
  description:
    "Core freight charge. MATRIX config: mode MILESTONE (distance slabs via zoneMilestoneId rows) or ZONE_PAIR (fromZoneId/toZoneId rows). Each row: perKg (slab size, kg), charge (per slab), minCharge.",
  computation: {
    method: "MATRIX",
    basis: "CHARGEABLE_WEIGHT",
  },
  aggregation: { group: "BASE", strategy: "HIGHEST" },
  flags: { taxable: true, fuelApplicable: true, aiAssisted: true },
};

/**
 * Resolve which catalog definition this card attaches to.
 *
 * The encoder NEVER mints one. That is what makes inventing a per-channel
 * duplicate like B2C_BASIC_FREIGHT structurally impossible instead of merely
 * discouraged by prompt text.
 */
function resolveDefinition(rateCard, partnerContext, problems) {
  const definitions = partnerContext.definitions || [];
  const baseDefinitions = definitions.filter((d) => d.category === "BASE");

  const pick = (code) => definitions.find((d) => d.code === code) || null;

  // 1. Whatever this partner's base freight already lives on.
  const existing = (partnerContext.existingBaseConfigs || [])[0];
  let chosen = existing ? pick(existing.chargeDefinitionCode) : null;

  // 2. The card's own name.
  if (!chosen && rateCard?.chargeName) {
    const wanted = normalizeName(rateCard.chargeName);
    const named = baseDefinitions.filter(
      (d) =>
        normalizeName(d.name) === wanted || normalizeName(d.code) === wanted,
    );
    if (named.length > 1) {
      problems.push(
        `"${rateCard.chargeName}" matches more than one base charge definition (${named
          .map((d) => d.code)
          .join(", ")})`,
      );
      return null;
    }
    chosen = named[0] || null;
  }

  // 3/4. The conventional code, else the only base definition there is.
  if (!chosen) chosen = pick("BASE_FREIGHT");
  if (!chosen && baseDefinitions.length === 1) chosen = baseDefinitions[0];

  if (!chosen) {
    // Bootstrap, but ONLY on a catalog with no base charge at all. With zero
    // BASE definitions there is nothing to duplicate, so the anti-duplicate
    // guarantee still holds — the moment one exists we are reuse-only again
    // and an unmatched card is a problem, exactly as before.
    if (baseDefinitions.length === 0) {
      return { definition: BOOTSTRAP_BASE_DEFINITION, create: true };
    }

    problems.push(
      `"${rateCard?.chargeName || "this rate card"}" does not match any of the base charge definitions in the catalog (${baseDefinitions
        .map((d) => d.code)
        .join(", ")}) — name the charge exactly as it appears there`,
    );
    return null;
  }

  if (chosen.computation?.method !== "MATRIX") {
    problems.push(
      `charge definition ${chosen.code} computes by ${chosen.computation?.method || "an unknown method"}, not MATRIX, so it cannot hold a distance-band rate card`,
    );
    return null;
  }

  return { definition: chosen, create: false };
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

function encodeRow(band, milestone, billingUnitKg, problems, warnings, at) {
  const charge = Number(band?.ratePerUnit);
  const hasMin = band?.minFreight !== null && band?.minFreight !== undefined;
  const minCharge = hasMin ? Number(band.minFreight) : 0;

  if (!isPositive(charge)) {
    problems.push(`${at}: rate must be a positive number`);
    return null;
  }
  if (hasMin && (!Number.isFinite(minCharge) || minCharge < 0)) {
    problems.push(`${at}: minimum freight must be zero or more`);
    return null;
  }
  if (hasMin && minCharge > 0 && minCharge <= charge) {
    warnings.push(
      `${at}: minimum freight ${minCharge} is not above the ${charge} slab rate, so it can never bind`,
    );
  }

  return {
    zoneMilestoneId: milestone.id,
    perKg: billingUnitKg,
    charge,
    minCharge,
  };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * @param {object} rateCard  { chargeName, channel, zoneName, billingUnitKg, bands[], examples[], notes[] }
 * @param {object} partnerContext
 *   { partnerId, distanceZones[], channels[], definitions[], existingBaseConfigs[], selectedChannelId }
 * @returns {{ config, chargeDefinitionCode, channelId, milestones, bindings, examples, problems, warnings }}
 */
function encodeRateCard(rateCard, partnerContext = {}) {
  const problems = [];
  const warnings = [];
  const empty = {
    config: null,
    chargeDefinitionCode: null,
    // Set only when the catalog had no base charge and one must be created
    // alongside this config. Null means "reuse what is already there".
    definitionToCreate: null,
    channelId: null,
    milestones: [],
    bindings: [],
    examples: rateCard?.examples || [],
    problems,
    warnings,
  };

  if (!rateCard || typeof rateCard !== "object") {
    problems.push("rate card is missing or not an object");
    return empty;
  }

  const resolved = resolveDefinition(rateCard, partnerContext, problems);
  const definition = resolved?.definition || null;
  const definitionToCreate = resolved?.create ? resolved.definition : null;

  if (definitionToCreate) {
    warnings.push(
      `no base charge existed in the catalog, so "${definitionToCreate.code}" will be created alongside this rate card`,
    );
  }
  const channelId = resolveChannel(
    rateCard?.channel,
    partnerContext.channels || [],
    partnerContext.selectedChannelId,
    problems,
    warnings,
  );
  const zone = resolveZone(
    rateCard,
    partnerContext.distanceZones || [],
    problems,
  );

  let billingUnitKg = Number(rateCard.billingUnitKg);
  if (rateCard.billingUnitKg === null || rateCard.billingUnitKg === undefined) {
    billingUnitKg = 1;
    warnings.push(
      "no billing unit stated — assuming 1 kg. If the card charges per 0.5 kg, say so explicitly.",
    );
  } else if (!isPositive(billingUnitKg) || billingUnitKg > 1000) {
    problems.push(
      `billing unit ${rateCard.billingUnitKg} is not a usable slab size in kg`,
    );
  }

  const bands = Array.isArray(rateCard.bands) ? rateCard.bands : [];
  if (bands.length === 0) problems.push("rate card has no distance bands");

  if (!zone || problems.length > 0) {
    return {
      ...empty,
      chargeDefinitionCode: definition?.code || null,
      definitionToCreate,
      channelId,
    };
  }

  const milestones = zone.milestones || [];
  const rows = [];
  const bindings = [];
  const usedMilestones = new Map();

  bands.forEach((band, index) => {
    const at = `band ${index + 1}`;
    const bound = bindBand(band, milestones, problems, warnings, at);
    if (!bound) return;

    checkSuffix(band, bound.milestone, milestones, problems, at);

    const seen = usedMilestones.get(bound.milestone.id);
    if (seen) {
      problems.push(
        `${at}: milestone ${bound.milestone.suffix} is already covered by ${seen} — two bands cannot price the same distance band`,
      );
      return;
    }
    usedMilestones.set(bound.milestone.id, at);

    const row = encodeRow(
      band,
      bound.milestone,
      billingUnitKg,
      problems,
      warnings,
      at,
    );
    if (!row) return;

    rows.push(row);
    bindings.push({
      band,
      milestone: bound.milestone,
      matchedBy: bound.matchedBy,
    });
  });

  // A milestone with no band is a warning, not a problem: a partner may
  // deliberately not serve that lane. But say what it costs them.
  const uncovered = milestones.filter((m) => !usedMilestones.has(m.id));
  if (rows.length > 0 && uncovered.length > 0) {
    warnings.push(
      `no rate for milestone${uncovered.length === 1 ? "" : "s"} ${uncovered
        .map((m) => `${m.suffix} (${m.minKm}-${m.maxKm} km)`)
        .join(", ")} — this partner will be dropped from quotes on those lanes`,
    );
  }

  // Every band with minFreight === rate AND a sub-kg billing unit is the
  // fingerprint of a rate accidentally copied into the minimum column.
  if (
    rows.length > 1 &&
    billingUnitKg < 1 &&
    rows.every((r) => r.minCharge === r.charge)
  ) {
    warnings.push(
      "every band's minimum freight equals its rate and the billing unit is under 1 kg — check the rate was not copied into the minimum-freight column",
    );
  }

  if (problems.length > 0 || rows.length === 0) {
    return {
      ...empty,
      chargeDefinitionCode: definition?.code || null,
      definitionToCreate,
      channelId,
      milestones,
    };
  }

  return {
    config: { mode: "MILESTONE", rows },
    chargeDefinitionCode: definition.code,
    definitionToCreate,
    channelId,
    milestones,
    bindings,
    examples: rateCard.examples || [],
    problems,
    warnings,
  };
}

/**
 * Encode every card in a draft, shaping each result like a v2 config entry so
 * approveSuggestion swallows it through the identical code path.
 */
function encodeRateCards(rateCards, partnerContext = {}) {
  const configs = [];
  const problems = [];
  const warnings = [];
  const encoded = [];
  // Keyed by code so several rate cards on an empty catalog ask for the base
  // definition once, not once each.
  const definitionsToCreate = new Map();

  (rateCards || []).forEach((rateCard, index) => {
    const label = `rate card ${index + 1}`;
    const result = encodeRateCard(rateCard, partnerContext);

    problems.push(...result.problems.map((p) => `${label}: ${p}`));
    warnings.push(...result.warnings.map((w) => `${label}: ${w}`));

    if (!result.config) return;

    if (result.definitionToCreate) {
      definitionsToCreate.set(
        result.definitionToCreate.code,
        result.definitionToCreate,
      );
    }

    configs.push({
      chargeDefinitionCode: result.chargeDefinitionCode,
      partnerId: partnerContext.partnerId,
      channelId: result.channelId,
      config: result.config,
      conditions: null,
      // Provenance only — createConfig ignores unknown keys.
      source: "RATE_CARD",
      rateCardIndex: index,
    });
    encoded.push({ label, index, ...result });
  });

  return {
    configs,
    definitions: [...definitionsToCreate.values()],
    encoded,
    problems,
    warnings,
  };
}

module.exports = {
  // Shared with the action compiler so channel matching (and its deliberate
  // refusal to guess between near-identical names) has one implementation.
  resolveChannel,
  encodeRateCard,
  encodeRateCards,
  EDGE_TOLERANCE_KM,
  BOOTSTRAP_BASE_DEFINITION,
};
