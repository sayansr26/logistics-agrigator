/**
 * Rate-card replay (Charges Engine v3).
 *
 * Takes the worked examples an admin wrote in their own rate card
 * ("35 km, 2 kg -> Rs 130") and runs them through the REAL pricing engine,
 * so a card that does not reproduce its own numbers is caught at draft time
 * instead of at invoice time.
 *
 * Pure and synchronous: milestones and the definition arrive as data, so this
 * needs no DB, no Redis and no mocks in tests. Callers own their own I/O.
 */

const pipeline = require("../../chargeEngine/pipeline");
const contextBuilder = require("../../chargeEngine/contextBuilder");
const {
  matchMilestoneByDistance,
} = require("../../chargeEngine/milestoneMatch");

/**
 * Exact to the paisa. Both sides have already been through round2, and the
 * errors this exists to catch are 20-100% errors — a percentage tolerance
 * would hide precisely those.
 */
const TOLERANCE = 0.01;

/**
 * Replay one example.
 *
 * distanceKm is never read by any calculator — MATRIX matches on
 * facts.distanceMilestoneId by string equality — so the km must be resolved to
 * a milestone first, using the same matcher production pricing uses.
 */
function replayExample(
  { definition, config, milestones },
  example,
  factsOverrides = {},
) {
  const distanceKm = Number(example?.distanceKm);
  const weightKg = Number(example?.weightKg);
  const expectedFreight = Number(example?.expectedFreight);

  const base = {
    distanceKm,
    weightKg,
    expectedFreight,
    actualFreight: null,
    milestone: null,
    matchedBy: null,
    pass: false,
    delta: null,
    calculation: null,
    reason: null,
  };

  if (!Number.isFinite(distanceKm) || !Number.isFinite(weightKg)) {
    return { ...base, reason: "BAD_EXAMPLE" };
  }

  const { milestone, matchedBy } = matchMilestoneByDistance(
    distanceKm,
    milestones,
  );
  if (!milestone) {
    return { ...base, reason: "NO_MILESTONE" };
  }

  const milestoneInfo = {
    id: milestone.id,
    suffix: milestone.suffix,
    minKm: milestone.minKm,
    maxKm: milestone.maxKm,
  };

  // buildFacts is pure assembly with no I/O, so use it rather than a
  // hand-rolled facts literal — that keeps replay honest as the facts
  // registry grows.
  const facts = contextBuilder.buildFacts({
    params: {
      weight: weightKg,
      numberOfBoxes: 1,
      paymentType: "PREPAID",
      ...factsOverrides,
    },
    chargeableWeight: weightKg,
    zoneResult: { distanceKm, milestone },
    pickupGeoZoneIds: [],
    deliveryGeoZoneIds: [],
    pickupSide: {},
    deliverySide: {},
    answers: {},
  });

  const { line, skipReason } = pipeline.computeLine(definition, config, facts);

  if (!line) {
    return {
      ...base,
      milestone: milestoneInfo,
      matchedBy,
      reason: skipReason || "NO_LINE",
    };
  }

  const actualFreight = line.totalCharge;
  const delta = Number((actualFreight - expectedFreight).toFixed(2));
  const pass = Number.isFinite(expectedFreight) && Math.abs(delta) <= TOLERANCE;

  return {
    ...base,
    actualFreight,
    milestone: milestoneInfo,
    matchedBy,
    pass,
    delta,
    calculation: line.calculation,
    reason: pass ? null : "MISMATCH",
  };
}

/**
 * Replay every example in a card.
 *
 * @param {object}  args
 * @param {object}  args.definition  ChargeDefinition-shaped row
 * @param {object}  args.config      PartnerChargeConfig-shaped ({ config, conditions })
 * @param {Array}   args.milestones  [{ id, suffix, minKm, maxKm }] of the bound zone
 * @param {Array}   args.examples    [{ distanceKm, weightKg, expectedFreight }]
 * @param {object} [args.factsOverrides]
 * @returns {{ results, passed, failed, allPassed }}
 *   A card with NO examples is unverified, not failed: allPassed is true.
 */
function replayExamples({
  definition,
  config,
  milestones = [],
  examples = [],
  factsOverrides = {},
}) {
  const results = (examples || []).map((example) =>
    replayExample({ definition, config, milestones }, example, factsOverrides),
  );

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;

  return { results, passed, failed, allPassed: failed === 0 };
}

/**
 * Render failures as admin-readable problem strings.
 *
 * These are folded into the suggestion's existing `validation.problems` array,
 * which the draft UI already renders — so surfacing replay costs no frontend
 * work at all.
 */
function describeFailures(results, label = "rate card") {
  return (results || [])
    .filter((r) => !r.pass)
    .map((r) => {
      const where = `${label} example ${r.distanceKm}km/${r.weightKg}kg`;
      if (r.reason === "NO_MILESTONE") {
        return `${where}: no milestone covers that distance`;
      }
      if (r.reason === "CONDITIONS_NOT_MET") {
        return `${where}: the charge's conditions exclude this shipment, so it would not be billed at all`;
      }
      if (r.reason === "NO_MATCH") {
        return `${where}: no config row matches milestone ${r.milestone?.suffix ?? "?"}`;
      }
      if (r.reason === "ZERO_AMOUNT") {
        return `${where}: the config prices this at zero`;
      }
      if (r.reason === "BAD_EXAMPLE") {
        return `${where}: the example is not a usable distance/weight pair`;
      }
      return `${where}: expected ₹${r.expectedFreight}, engine computes ₹${r.actualFreight}`;
    });
}

module.exports = { replayExamples, replayExample, describeFailures, TOLERANCE };
