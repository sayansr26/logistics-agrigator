/**
 * Charges Engine v3 — phase-ordered calculation pipeline
 *
 * Runs a partner's active charge configs against the facts object:
 *   1. definitions are processed in phase order (100 base ... 900 GST)
 *   2. per phase: condition gating → calculator → per-phase aggregation
 *      (HIGHEST groups collapse before later phases read subtotals)
 *   3. RATE_ADJUSTMENT / DISCOUNT methods compute over running subtotals
 *      (FUEL_APPLICABLE | FREIGHT | PRE_TAX | TAXABLE)
 *
 * Output breakdown lines are shipment-service compatible:
 *   { chargeCode, chargeTypeName, category, stage, totalCharge, calculation,
 *     pickup?, delivery? }
 */

const { evaluate } = require("./conditionEvaluator");
const { compute, round2 } = require("./calculators");
const { aggregate } = require("./aggregator");
const { withSide } = require("./contextBuilder");
const logger = require("../../shared/lib/logger");

const SUBTOTAL_METHODS = new Set(["RATE_ADJUSTMENT", "DISCOUNT"]);

function computeSubtotal(subtotalOf, lines) {
  switch (subtotalOf) {
    case "FUEL_APPLICABLE":
      return lines
        .filter((l) => l.flags?.fuelApplicable === true)
        .reduce((sum, l) => sum + l.totalCharge, 0);
    case "FREIGHT":
      return lines
        .filter((l) => l.category === "BASE")
        .reduce((sum, l) => sum + l.totalCharge, 0);
    case "TAXABLE":
      return lines
        .filter((l) => l.flags?.taxable !== false)
        .reduce((sum, l) => sum + l.totalCharge, 0);
    case "PRE_TAX":
    default:
      return lines.reduce((sum, l) => sum + l.totalCharge, 0);
  }
}

/**
 * Merge conditions: partner-config conditions override definition defaults.
 */
function effectiveConditions(definition, config) {
  return config.conditions || definition.conditions || null;
}

/**
 * Compute one definition+config against facts.
 *
 * Returns { line, skipReason }. `skipReason` distinguishes a charge that was
 * deliberately not applied (CONDITIONS_NOT_MET — e.g. a COD charge on a
 * prepaid shipment) from one that SHOULD have applied but could not be priced
 * (NO_MATCH — a MATRIX config with no row for this lane, ZERO_AMOUNT — a
 * config that priced to nothing). Callers use that difference to decide
 * whether a missing charge is normal or a misconfiguration.
 */
function computeLine(definition, config, facts) {
  const conditions = effectiveConditions(definition, config);
  const perSide = definition.aggregation?.perSide === true;

  if (perSide) {
    const sides = {};
    let total = 0;
    let anySideEligible = false;
    for (const sideName of ["pickup", "delivery"]) {
      const sideFacts = withSide(facts, sideName);
      if (!evaluate(conditions, sideFacts)) continue;
      anySideEligible = true;
      const result = compute(definition.computation, config.config, sideFacts);
      if (result && result.amount !== 0) {
        sides[sideName] = {
          totalCharge: result.amount,
          calculation: result.calculation,
        };
        total += result.amount;
      }
    }
    if (total === 0) {
      return {
        line: null,
        skipReason: anySideEligible ? "NO_MATCH" : "CONDITIONS_NOT_MET",
      };
    }

    const line = {
      chargeCode: definition.code,
      chargeTypeName: definition.name,
      category: definition.category,
      stage: definition.applyStage,
      phase: definition.phase,
      totalCharge: round2(total),
      calculation: Object.keys(sides)
        .map((s) => `${s}: ${sides[s].calculation}`)
        .join("; "),
      flags: definition.flags || {},
      aggregation: definition.aggregation || null,
      ...sides,
    };
    return { line, skipReason: null };
  }

  if (!evaluate(conditions, facts)) {
    return { line: null, skipReason: "CONDITIONS_NOT_MET" };
  }
  const result = compute(definition.computation, config.config, facts);
  if (!result) return { line: null, skipReason: "NO_MATCH" };
  if (result.amount === 0) return { line: null, skipReason: "ZERO_AMOUNT" };

  const line = {
    chargeCode: definition.code,
    chargeTypeName: definition.name,
    category: definition.category,
    stage: definition.applyStage,
    phase: definition.phase,
    totalCharge: result.amount,
    calculation: result.calculation,
    flags: definition.flags || {},
    aggregation: definition.aggregation || null,
  };
  return { line, skipReason: null };
}

/**
 * Run the pipeline.
 *
 * @param {Array} configs - active PartnerChargeConfig rows with
 *   `chargeDefinition` included (see partnerChargeConfigService.getActiveConfigsForPartner)
 * @param {Object} facts - from contextBuilder.buildFacts
 * @param {Object} [options]
 * @param {Array<string>} [options.stages] - applyStages to include
 *   (default QUOTE + BOOKING_OPTION)
 * @returns {{ breakdown, totalCharge, pricing, rulesEvaluated, categoriesMatched,
 *   skipped, missingBase }} - `skipped` lists every config that produced no
 *   line with the reason why; `missingBase` is the subset of BASE-category
 *   charges that should have applied but could not be priced.
 */
function run(configs, facts, options = {}) {
  const stages = options.stages || ["QUOTE", "BOOKING_OPTION"];

  const applicable = configs
    .filter((cfg) => stages.includes(cfg.chargeDefinition.applyStage))
    .filter((cfg) => cfg.chargeDefinition.isActive !== false)
    .sort(
      (a, b) =>
        a.chargeDefinition.phase - b.chargeDefinition.phase ||
        a.priority - b.priority,
    );

  // Group configs by phase so HIGHEST aggregation collapses before later
  // phases read subtotals
  const phases = new Map();
  for (const cfg of applicable) {
    const phase = cfg.chargeDefinition.phase;
    if (!phases.has(phase)) phases.set(phase, []);
    phases.get(phase).push(cfg);
  }

  const accepted = [];
  const skipped = [];
  let rulesEvaluated = 0;
  let gstRate = 0;
  let gstAmount = 0;
  let fuelSurcharge = 0;
  let discountTotal = 0;

  for (const [, phaseCfgs] of [...phases.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const phaseLines = [];

    for (const cfg of phaseCfgs) {
      const definition = cfg.chargeDefinition;
      rulesEvaluated += 1;

      try {
        let outcome;
        if (SUBTOTAL_METHODS.has(definition.computation?.method)) {
          const subtotal = computeSubtotal(
            definition.computation.subtotalOf,
            accepted,
          );
          outcome = computeLine(definition, cfg, {
            ...facts,
            __subtotal: round2(subtotal),
          });
        } else {
          outcome = computeLine(definition, cfg, facts);
        }

        const { line, skipReason } = outcome;

        if (!line) {
          skipped.push({
            chargeCode: definition.code,
            category: definition.category,
            reason: skipReason,
          });
        }

        if (line) {
          phaseLines.push(line);
          if (definition.code === "GST") {
            gstRate = Number(cfg.config?.percent) || 0;
            gstAmount += line.totalCharge;
          }
          if (definition.code === "FUEL_SURCHARGE") {
            fuelSurcharge += line.totalCharge;
          }
          if (definition.computation?.method === "DISCOUNT") {
            discountTotal += -line.totalCharge;
          }
        }
      } catch (error) {
        // A broken config must never break the whole quote
        logger.warn("Charge line computation failed; skipping", {
          chargeCode: definition.code,
          error: error.message,
        });
        skipped.push({
          chargeCode: definition.code,
          category: definition.category,
          reason: "ERROR",
        });
      }
    }

    accepted.push(...aggregate(phaseLines));
  }

  const totalCharge = round2(
    accepted.reduce((sum, l) => sum + l.totalCharge, 0),
  );
  const preTaxTotal = round2(totalCharge - gstAmount);
  const freightSubtotal = round2(computeSubtotal("FREIGHT", accepted));
  const vasSubtotal = round2(
    accepted
      .filter(
        (l) =>
          l.stage === "BOOKING_OPTION" ||
          (l.category === "VAS" && l.totalCharge > 0),
      )
      .reduce((sum, l) => sum + l.totalCharge, 0),
  );

  // A BASE-category charge is what the partner collects on EVERY parcel. If one
  // is configured but could not be priced for this lane (no MATRIX row, zero
  // amount, broken config), the quote would silently understate the rate — so
  // report it and let the caller drop the partner instead.
  const missingBase = skipped.filter(
    (s) => s.category === "BASE" && s.reason !== "CONDITIONS_NOT_MET",
  );
  if (missingBase.length > 0) {
    logger.warn("BASE charge configured but not applicable to this shipment", {
      missing: missingBase,
      distanceMilestoneId: facts.distanceMilestoneId,
      pickupGeoZoneIds: facts.pickupGeoZoneIds,
      deliveryGeoZoneIds: facts.deliveryGeoZoneIds,
      chargeableWeight: facts.chargeableWeight,
    });
  }

  // Strip engine-internal fields from the outgoing breakdown
  const breakdown = accepted.map(
    ({ flags, aggregation, phase, ...publicLine }) => publicLine,
  );

  return {
    breakdown,
    totalCharge,
    skipped,
    missingBase,
    rulesEvaluated,
    categoriesMatched: new Set(accepted.map((l) => l.category)).size,
    pricing: {
      freightSubtotal,
      vasSubtotal,
      fuelSurcharge: round2(fuelSurcharge),
      discount: round2(discountTotal),
      preTaxTotal,
      markup: null, // filled by shipment-service at booking (outlet markup)
      gstRate,
      gstAmount: round2(gstAmount),
      grandTotal: totalCharge,
      codCollectable: facts.codAmount || 0,
    },
  };
}

module.exports = { run, computeSubtotal };
