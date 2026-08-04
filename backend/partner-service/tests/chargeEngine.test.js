/**
 * Charges Engine v3 — unit tests for the pure calculation layer
 * (calculators, conditionEvaluator, aggregator, pipeline).
 * No I/O — these run without DB/Redis.
 */

const { compute, round2 } = require("../services/chargeEngine/calculators");
const {
  evaluate,
  getFact,
} = require("../services/chargeEngine/conditionEvaluator");
const { aggregate } = require("../services/chargeEngine/aggregator");
const pipeline = require("../services/chargeEngine/pipeline");
const contextBuilder = require("../services/chargeEngine/contextBuilder");

// ==========================================================================
// conditionEvaluator
// ==========================================================================
describe("conditionEvaluator", () => {
  const facts = {
    paymentType: "COD",
    codAmount: 3000,
    isFragile: false,
    delivery: { state: "Maharashtra", pincodeType: { ODA: "yes" } },
    answers: {
      loading: { enabled: true, floor: 2 },
      packingMaterial: "CARTON",
    },
  };

  test("null conditions are unconditional", () => {
    expect(evaluate(null, facts)).toBe(true);
  });

  test("all: every condition must match", () => {
    expect(
      evaluate(
        {
          all: [
            { fact: "paymentType", op: "eq", value: "COD" },
            { fact: "codAmount", op: "gt", value: 0 },
          ],
        },
        facts,
      ),
    ).toBe(true);
    expect(
      evaluate(
        {
          all: [
            { fact: "paymentType", op: "eq", value: "COD" },
            { fact: "isFragile", op: "eq", value: true },
          ],
        },
        facts,
      ),
    ).toBe(false);
  });

  test("any: one match suffices", () => {
    expect(
      evaluate(
        {
          any: [
            { fact: "isFragile", op: "eq", value: true },
            { fact: "paymentType", op: "eq", value: "COD" },
          ],
        },
        facts,
      ),
    ).toBe(true);
  });

  test("dot-path facts and nested answers", () => {
    expect(getFact(facts, "answers.loading.floor")).toBe(2);
    expect(
      evaluate(
        { all: [{ fact: "answers.loading.enabled", op: "eq", value: true }] },
        facts,
      ),
    ).toBe(true);
    expect(
      evaluate(
        { all: [{ fact: "delivery.pincodeType.ODA", op: "eq", value: "yes" }] },
        facts,
      ),
    ).toBe(true);
  });

  test("unknown fact is false, never throws", () => {
    expect(
      evaluate({ all: [{ fact: "no.such.fact", op: "eq", value: 1 }] }, facts),
    ).toBe(false);
  });

  test("in / exists operators", () => {
    expect(
      evaluate(
        {
          all: [
            { fact: "delivery.state", op: "in", value: ["Goa", "Maharashtra"] },
          ],
        },
        facts,
      ),
    ).toBe(true);
    expect(
      evaluate(
        { all: [{ fact: "answers.packingMaterial", op: "exists" }] },
        facts,
      ),
    ).toBe(true);
  });
});

// ==========================================================================
// calculators
// ==========================================================================
describe("calculators", () => {
  test("FLAT", () => {
    expect(
      compute({ method: "FLAT", basis: "NONE" }, { amount: 50 }, {}),
    ).toEqual({
      amount: 50,
      calculation: "flat 50",
    });
    expect(compute({ method: "FLAT" }, {}, {})).toBeNull();
  });

  test("PERCENT_WITH_MIN takes the max of min and percent", () => {
    const computation = { method: "PERCENT_WITH_MIN", basis: "COD_AMOUNT" };
    expect(
      compute(computation, { percent: 2, minAmount: 50 }, { codAmount: 3000 })
        .amount,
    ).toBe(60);
    expect(
      compute(computation, { percent: 2, minAmount: 50 }, { codAmount: 1000 })
        .amount,
    ).toBe(50);
  });

  test("PERCENT_WITH_MIN optionsBy picks per-option config", () => {
    const computation = {
      method: "PERCENT_WITH_MIN",
      basis: "INVOICE_VALUE",
      optionsBy: "riskType",
    };
    const config = {
      OWNER: { percent: 0.1, minAmount: 30 },
      CARRIER: { percent: 1.5, minAmount: 100 },
    };
    expect(
      compute(computation, config, {
        invoiceValue: 5000,
        answers: { riskType: "CARRIER" },
      }).amount,
    ).toBe(100);
    expect(
      compute(computation, config, {
        invoiceValue: 50000,
        answers: { riskType: "CARRIER" },
      }).amount,
    ).toBe(750);
    expect(
      compute(computation, config, { invoiceValue: 5000, answers: {} }),
    ).toBeNull();
  });

  test("PER_UNIT ceil-slabs with minimum", () => {
    const computation = { method: "PER_UNIT", basis: "CHARGEABLE_WEIGHT" };
    expect(
      compute(
        computation,
        { perUnit: 6, unitSize: 1, minAmount: 250 },
        { chargeableWeight: 5 },
      ).amount,
    ).toBe(250);
    expect(
      compute(
        computation,
        { perUnit: 6, unitSize: 1, minAmount: 250 },
        { chargeableWeight: 100 },
      ).amount,
    ).toBe(600);
  });

  test("SLAB picks first slab >= value", () => {
    const computation = {
      method: "SLAB",
      basis: "ANSWER_VALUE",
      answerPath: "loading.floor",
    };
    const config = {
      slabs: [
        { upTo: 0, amount: 150 },
        { upTo: 1, amount: 250 },
        { upTo: 2, amount: 350 },
        { upTo: 99, amount: 500 },
      ],
    };
    expect(
      compute(computation, config, { answers: { loading: { floor: 0 } } })
        .amount,
    ).toBe(150);
    expect(
      compute(computation, config, { answers: { loading: { floor: 2 } } })
        .amount,
    ).toBe(350);
    expect(
      compute(computation, config, { answers: { loading: { floor: 7 } } })
        .amount,
    ).toBe(500);
    expect(compute(computation, config, { answers: {} })).toBeNull();
  });

  test("MATRIX milestone mode with min charge and highest-wins", () => {
    const computation = { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" };
    const config = {
      mode: "MILESTONE",
      rows: [
        { zoneMilestoneId: "m1", perKg: 1, charge: 10, minCharge: 80 },
        { zoneMilestoneId: "m2", perKg: 1, charge: 14, minCharge: 120 },
      ],
    };
    expect(
      compute(computation, config, {
        chargeableWeight: 5,
        distanceMilestoneId: "m1",
      }).amount,
    ).toBe(80);
    expect(
      compute(computation, config, {
        chargeableWeight: 20,
        distanceMilestoneId: "m1",
      }).amount,
    ).toBe(200);
    expect(
      compute(computation, config, {
        chargeableWeight: 5,
        distanceMilestoneId: "mX",
      }),
    ).toBeNull();
  });

  test("MATRIX zone-pair mode", () => {
    const computation = { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" };
    const config = {
      mode: "ZONE_PAIR",
      rows: [{ fromZoneId: "zw", toZoneId: "zn", perKg: 1, charge: 9 }],
    };
    expect(
      compute(computation, config, {
        chargeableWeight: 10,
        pickupGeoZoneIds: ["zw"],
        deliveryGeoZoneIds: ["zn"],
      }).amount,
    ).toBe(90);
    expect(
      compute(computation, config, {
        chargeableWeight: 10,
        pickupGeoZoneIds: ["zn"],
        deliveryGeoZoneIds: ["zw"],
      }),
    ).toBeNull();
  });

  test("PER_UNIT_TIME weight basis (demurrage) and unit basis (reattempt)", () => {
    const demurrage = compute(
      { method: "PER_UNIT_TIME", basis: "CHARGEABLE_WEIGHT" },
      { perKgPerDay: 2, freeUnits: 5, minAmount: 100 },
      { chargeableWeight: 5, eventUnits: 9 },
    );
    expect(demurrage.amount).toBe(100); // 5*2*4=40 < min 100

    const reattempt = compute(
      { method: "PER_UNIT_TIME", basis: "EVENT_UNITS" },
      { perUnit: 60, freeUnits: 2 },
      { eventUnits: 4 },
    );
    expect(reattempt.amount).toBe(120);
  });

  test("RATE_ADJUSTMENT over injected subtotal", () => {
    expect(
      compute(
        { method: "RATE_ADJUSTMENT", basis: "SUBTOTAL" },
        { percent: 10 },
        { __subtotal: 330 },
      ).amount,
    ).toBe(33);
    expect(
      compute(
        { method: "RATE_ADJUSTMENT", basis: "SUBTOTAL" },
        { percent: 100, flatExtra: 50 },
        { __subtotal: 200 },
      ).amount,
    ).toBe(250);
  });

  test("OPTION_RATE with perBox multiplier", () => {
    const computation = {
      method: "OPTION_RATE",
      basis: "ANSWER_VALUE",
      answerPath: "packingMaterial",
    };
    const config = { rates: { WOODEN_BOX: 400, CARTON: 100 }, perBox: true };
    expect(
      compute(computation, config, {
        answers: { packingMaterial: "CARTON" },
        numberOfBoxes: 2,
      }).amount,
    ).toBe(200);
    expect(
      compute(computation, config, {
        answers: { packingMaterial: "SELF" },
        numberOfBoxes: 2,
      }),
    ).toBeNull();
  });

  test("DISCOUNT emits negative amount, never below subtotal", () => {
    const computation = { method: "DISCOUNT", basis: "SUBTOTAL" };
    const config = { tiers: { GOLD: { type: "PERCENTAGE", value: 5 } } };
    expect(
      compute(computation, config, { outletBadge: "GOLD", __subtotal: 400 })
        .amount,
    ).toBe(-20);
    expect(
      compute(computation, config, { outletBadge: "BASIC", __subtotal: 400 }),
    ).toBeNull();
    const flat = { tiers: { GOLD: { type: "FLAT", value: 900 } } };
    expect(
      compute(computation, flat, { outletBadge: "GOLD", __subtotal: 400 })
        .amount,
    ).toBe(-400); // clamped to subtotal
  });
});

// ==========================================================================
// aggregator
// ==========================================================================
describe("aggregator", () => {
  const line = (code, amount, agg, phase = 100) => ({
    chargeCode: code,
    chargeTypeName: code,
    category: "COD",
    stage: "QUOTE",
    phase,
    totalCharge: amount,
    calculation: "",
    flags: {},
    aggregation: agg,
  });

  test("HIGHEST keeps only the max line per group", () => {
    const out = aggregate([
      line("A", 60, { group: "COD", strategy: "HIGHEST" }),
      line("B", 90, { group: "COD", strategy: "HIGHEST" }),
      line("C", 10, null),
    ]);
    expect(out.map((l) => l.chargeCode).sort()).toEqual(["B", "C"]);
  });

  test("SUM keeps all lines", () => {
    const out = aggregate([
      line("A", 60, { group: "X", strategy: "SUM" }),
      line("B", 90, { group: "X", strategy: "SUM" }),
    ]);
    expect(out).toHaveLength(2);
  });
});

// ==========================================================================
// contextBuilder answers normalization
// ==========================================================================
describe("contextBuilder.buildAnswers", () => {
  const definitions = new Map([
    [
      "LOADING_FLOOR",
      {
        bookingQuestion: {
          key: "loading",
          type: "boolean",
          followUp: [{ key: "floor" }],
        },
      },
    ],
    [
      "PACKING",
      { bookingQuestion: { key: "packingMaterial", type: "select" } },
    ],
    [
      "HOLIDAY_PICKUP",
      { bookingQuestion: { key: "holidayPickup", type: "boolean" } },
    ],
  ]);

  test("object answers pass through; scalars wrap for followUp questions", () => {
    const answers = contextBuilder.buildAnswers(
      [
        { chargeCode: "LOADING_FLOOR", answer: { enabled: true, floor: 2 } },
        { chargeCode: "PACKING", answer: "CARTON" },
        { chargeCode: "HOLIDAY_PICKUP", answer: true },
        { chargeCode: "UNKNOWN_CODE", answer: true },
      ],
      definitions,
    );
    expect(answers.loading).toEqual({ enabled: true, floor: 2 });
    expect(answers.packingMaterial).toBe("CARTON");
    expect(answers.holidayPickup).toBe(true);
    expect(Object.keys(answers)).toHaveLength(3);
  });

  test("scalar for a followUp question wraps into {enabled}", () => {
    const answers = contextBuilder.buildAnswers(
      [{ chargeCode: "LOADING_FLOOR", answer: true }],
      definitions,
    );
    expect(answers.loading).toEqual({ enabled: true });
  });
});

// ==========================================================================
// pipeline end-to-end (replicates the verified dev fixture quote)
// ==========================================================================
describe("pipeline.run", () => {
  const cfg = (code, phase, computation, config, extra = {}) => ({
    priority: 100,
    config,
    conditions: null,
    chargeDefinition: {
      code,
      name: code,
      category: extra.category || "BASE",
      applyStage: extra.applyStage || "QUOTE",
      phase,
      computation,
      conditions: extra.conditions || null,
      aggregation: extra.aggregation || null,
      flags: extra.flags || { taxable: true },
      isActive: true,
      bookingQuestion: extra.bookingQuestion || null,
    },
  });

  const configs = [
    cfg(
      "BASE_FREIGHT",
      100,
      { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" },
      {
        mode: "MILESTONE",
        rows: [{ zoneMilestoneId: "m1", perKg: 1, charge: 10, minCharge: 80 }],
      },
      {
        flags: { taxable: true, fuelApplicable: true },
        aggregation: { group: "BASE", strategy: "HIGHEST" },
      },
    ),
    cfg("DOCKET_AWB", 200, { method: "FLAT", basis: "NONE" }, { amount: 50 }),
    cfg(
      "ODA",
      300,
      { method: "PER_UNIT", basis: "CHARGEABLE_WEIGHT" },
      { perUnit: 6, unitSize: 1, minAmount: 250 },
      {
        category: "PICKUP_DELIVERY",
        conditions: {
          all: [{ fact: "side.pincodeType.ODA", op: "eq", value: "yes" }],
        },
        aggregation: { group: "ODA", strategy: "SUM", perSide: true },
        flags: { taxable: true, fuelApplicable: true },
      },
    ),
    cfg(
      "COD_CHARGE",
      500,
      { method: "PERCENT_WITH_MIN", basis: "COD_AMOUNT" },
      { percent: 2, minAmount: 50 },
      {
        category: "COD",
        conditions: {
          all: [
            { fact: "paymentType", op: "eq", value: "COD" },
            { fact: "codAmount", op: "gt", value: 0 },
          ],
        },
        aggregation: { group: "COD", strategy: "HIGHEST" },
      },
    ),
    cfg(
      "FUEL_SURCHARGE",
      600,
      {
        method: "RATE_ADJUSTMENT",
        basis: "SUBTOTAL",
        subtotalOf: "FUEL_APPLICABLE",
      },
      { percent: 10 },
      { category: "SURCHARGE" },
    ),
    cfg(
      "GST",
      900,
      { method: "RATE_ADJUSTMENT", basis: "SUBTOTAL", subtotalOf: "TAXABLE" },
      { percent: 18 },
      { category: "TAX", flags: { taxable: false } },
    ),
  ];

  const baseFacts = {
    paymentType: "COD",
    codAmount: 3000,
    invoiceValue: 5000,
    chargeableWeight: 5,
    numberOfBoxes: 2,
    distanceMilestoneId: "m1",
    pickupGeoZoneIds: [],
    deliveryGeoZoneIds: [],
    pickup: { pincodeType: {} },
    delivery: { pincodeType: { ODA: "yes" } },
    answers: {},
  };

  test("replicates the verified COD quote: 558.14", () => {
    const result = pipeline.run(configs, baseFacts);
    const byCode = Object.fromEntries(
      result.breakdown.map((l) => [l.chargeCode, l.totalCharge]),
    );

    expect(byCode.BASE_FREIGHT).toBe(80);
    expect(byCode.DOCKET_AWB).toBe(50);
    expect(byCode.ODA).toBe(250); // delivery side only
    expect(byCode.COD_CHARGE).toBe(60);
    expect(byCode.FUEL_SURCHARGE).toBe(33); // 10% of 80+250
    expect(byCode.GST).toBe(85.14); // 18% of 473
    expect(result.totalCharge).toBe(558.14);
    expect(result.pricing.grandTotal).toBe(558.14);
    expect(result.pricing.preTaxTotal).toBe(473);
    expect(result.pricing.gstRate).toBe(18);
    expect(result.pricing.codCollectable).toBe(3000);
  });

  test("PREPAID drops COD line and zeroes codCollectable", () => {
    const result = pipeline.run(configs, {
      ...baseFacts,
      paymentType: "PREPAID",
      codAmount: 0,
    });
    const codes = result.breakdown.map((l) => l.chargeCode);
    expect(codes).not.toContain("COD_CHARGE");
    expect(result.pricing.codCollectable).toBe(0);
    expect(result.totalCharge).toBe(round2(487.34));
  });

  test("EVENT-stage definitions are excluded from quote runs", () => {
    const withEvent = [
      ...configs,
      cfg(
        "DEMURRAGE",
        950,
        { method: "PER_UNIT_TIME", basis: "CHARGEABLE_WEIGHT" },
        { perKgPerDay: 2, freeUnits: 5 },
        { applyStage: "EVENT", category: "EVENT" },
      ),
    ];
    const result = pipeline.run(withEvent, { ...baseFacts, eventUnits: 9 });
    expect(result.breakdown.map((l) => l.chargeCode)).not.toContain(
      "DEMURRAGE",
    );
  });

  test("broken config never breaks the quote", () => {
    const withBroken = [
      ...configs,
      cfg("BROKEN", 400, { method: "NO_SUCH_METHOD" }, null),
    ];
    const result = pipeline.run(withBroken, baseFacts);
    expect(result.totalCharge).toBe(558.14);
  });
});
