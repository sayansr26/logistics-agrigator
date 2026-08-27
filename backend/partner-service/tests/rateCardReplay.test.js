/**
 * ai/rateCard/replay — run an admin's own worked examples through the engine.
 *
 * The regression pin for the original incident: the corrected Delhivery card
 * must reproduce 130 / 256 / 180 / 460, and the superseded 0.5/26/26 card must
 * visibly fail against those same expectations.
 */

const {
  replayExamples,
  describeFailures,
} = require("../services/ai/rateCard/replay");

const MILESTONES = [
  { id: "ms-a", suffix: "A", minKm: 0, maxKm: 50 },
  { id: "ms-b", suffix: "B", minKm: 51, maxKm: 500 },
  { id: "ms-c", suffix: "C", minKm: 501, maxKm: 1400 },
  { id: "ms-d", suffix: "D", minKm: 1401, maxKm: 3200 },
];

const DEFINITION = {
  code: "B2C_BASIC_FREIGHT",
  name: "B2C Basic Freight",
  category: "BASE",
  applyStage: "QUOTE",
  phase: 100,
  computation: { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" },
  conditions: null,
  aggregation: null,
  flags: { taxable: true, fuelApplicable: true },
};

const row = (zoneMilestoneId, perKg, charge, minCharge) => ({
  zoneMilestoneId,
  perKg,
  charge,
  minCharge,
});

// What is live today, after the manual correction.
const CORRECTED = {
  config: {
    mode: "MILESTONE",
    rows: [
      row("ms-a", 1, 26, 130),
      row("ms-b", 1, 32, 160),
      row("ms-c", 1, 38, 180),
      row("ms-d", 1, 46, 220),
    ],
  },
  conditions: null,
};

// The superseded card: a faithful encoding of the 2026-08-25 prompt, which
// stated a 0.5 kg billing unit and no minimum freight at all.
const SUPERSEDED = {
  config: {
    mode: "MILESTONE",
    rows: [
      row("ms-a", 0.5, 26, 26),
      row("ms-b", 0.5, 32, 32),
      row("ms-c", 0.5, 38, 38),
      row("ms-d", 0.5, 46, 46),
    ],
  },
  conditions: null,
};

// The four examples the admin wrote in the 2026-08-26 rate card.
const EXAMPLES = [
  { distanceKm: 30, weightKg: 3, expectedFreight: 130 },
  { distanceKm: 350, weightKg: 8, expectedFreight: 256 },
  { distanceKm: 900, weightKg: 4, expectedFreight: 180 },
  { distanceKm: 1800, weightKg: 10, expectedFreight: 460 },
];

describe("replayExamples", () => {
  test("the corrected card reproduces all four of its own examples", () => {
    const r = replayExamples({
      definition: DEFINITION,
      config: CORRECTED,
      milestones: MILESTONES,
      examples: EXAMPLES,
    });

    expect(r.allPassed).toBe(true);
    expect(r.passed).toBe(4);
    expect(r.results.map((x) => x.actualFreight)).toEqual([130, 256, 180, 460]);
    expect(r.results[0].calculation).toContain("max(130, ceil(3/1) x 26)");
    expect(r.results.map((x) => x.milestone.suffix)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  test("the superseded card fails those same expectations, loudly", () => {
    const r = replayExamples({
      definition: DEFINITION,
      config: SUPERSEDED,
      milestones: MILESTONES,
      examples: EXAMPLES,
    });

    expect(r.allPassed).toBe(false);
    expect(r.failed).toBe(4);
    // ceil(w/0.5) x rate — double the per-kg card, with no floor to catch it.
    // NB: docs/CHARGES_BASE_ENGINE_AI_CHANGES.md prints 416 for the second
    // example; that is an arithmetic slip in the doc. ceil(8/0.5) x 32 = 512.
    expect(r.results.map((x) => x.actualFreight)).toEqual([156, 512, 304, 920]);
    expect(r.results.every((x) => x.reason === "MISMATCH")).toBe(true);
  });

  test("a card with no examples is unverified, not failed", () => {
    const r = replayExamples({
      definition: DEFINITION,
      config: CORRECTED,
      milestones: MILESTONES,
      examples: [],
    });
    expect(r).toMatchObject({ passed: 0, failed: 0, allPassed: true });
  });

  test("tolerance is a paisa, not a percentage", () => {
    const near = replayExamples({
      definition: DEFINITION,
      config: CORRECTED,
      milestones: MILESTONES,
      examples: [{ distanceKm: 30, weightKg: 3, expectedFreight: 130.005 }],
    });
    expect(near.allPassed).toBe(true);

    const off = replayExamples({
      definition: DEFINITION,
      config: CORRECTED,
      milestones: MILESTONES,
      examples: [{ distanceKm: 30, weightKg: 3, expectedFreight: 131 }],
    });
    expect(off.allPassed).toBe(false);
    expect(off.results[0].delta).toBe(-1);
  });

  test("a stray condition shows as CONDITIONS_NOT_MET, not a silent zero", () => {
    // This is the failure mode calculators.compute alone would have hidden,
    // and the reason replay goes through pipeline.computeLine.
    const gated = {
      config: CORRECTED.config,
      conditions: { all: [{ fact: "paymentType", op: "eq", value: "COD" }] },
    };
    const r = replayExamples({
      definition: DEFINITION,
      config: gated,
      milestones: MILESTONES,
      examples: [EXAMPLES[0]],
    });
    expect(r.results[0].reason).toBe("CONDITIONS_NOT_MET");
    expect(r.results[0].actualFreight).toBeNull();
  });

  test("rows keyed for the wrong mode report NO_MATCH", () => {
    const mismatched = {
      config: {
        mode: "MILESTONE",
        rows: [{ fromZoneId: "z1", toZoneId: "z2", perKg: 1, charge: 26 }],
      },
      conditions: null,
    };
    const r = replayExamples({
      definition: DEFINITION,
      config: mismatched,
      milestones: MILESTONES,
      examples: [EXAMPLES[0]],
    });
    expect(r.results[0].reason).toBe("NO_MATCH");
  });

  test("a distance with no milestone at all is reported as such", () => {
    const r = replayExamples({
      definition: DEFINITION,
      config: CORRECTED,
      milestones: [],
      examples: [EXAMPLES[0]],
    });
    expect(r.results[0].reason).toBe("NO_MILESTONE");
  });

  test("beyond the top band, the engine's own fallback is visible", () => {
    const r = replayExamples({
      definition: DEFINITION,
      config: CORRECTED,
      milestones: MILESTONES,
      examples: [{ distanceKm: 3700, weightKg: 2, expectedFreight: 220 }],
    });
    expect(r.results[0].matchedBy).toBe("HIGHEST_FALLBACK");
    expect(r.results[0].pass).toBe(true);
  });
});

describe("describeFailures", () => {
  test("renders a mismatch in the admin's own terms", () => {
    const r = replayExamples({
      definition: DEFINITION,
      config: SUPERSEDED,
      milestones: MILESTONES,
      examples: [EXAMPLES[0]],
    });
    expect(describeFailures(r.results, "rate card 1")).toEqual([
      "rate card 1 example 30km/3kg: expected ₹130, engine computes ₹156",
    ]);
  });

  test("says nothing when everything passes", () => {
    const r = replayExamples({
      definition: DEFINITION,
      config: CORRECTED,
      milestones: MILESTONES,
      examples: EXAMPLES,
    });
    expect(describeFailures(r.results)).toEqual([]);
  });
});
