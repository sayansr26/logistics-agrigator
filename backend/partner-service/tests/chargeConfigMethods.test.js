/**
 * chargeConfigMethods — per-method config validation.
 *
 * The contract: a config that passes here must not price to `null` for a
 * CONFIGURATION reason. Each block therefore pairs a validation assertion with
 * the calculator, so the two cannot drift.
 */

const { validateConfigForMethod } = require("../services/chargeConfigMethods");
const { compute } = require("../services/chargeEngine/calculators");

const facts = {
  chargeableWeight: 5,
  codAmount: 1000,
  invoiceValue: 2000,
  numberOfBoxes: 2,
  eventUnits: 4,
  outletBadge: "GOLD",
  __subtotal: 500,
  answers: { packingMaterial: "CARTON", loading: { floor: 2 } },
};

/** A valid config must both pass validation AND actually price. */
const pricesCleanly = (computation, config) => {
  expect(validateConfigForMethod(computation, config)).toEqual([]);
  expect(compute(computation, config, facts)).not.toBeNull();
};

describe("FLAT", () => {
  test("valid config validates and prices", () => {
    pricesCleanly({ method: "FLAT", basis: "NONE" }, { amount: 150 });
  });
  test.each([
    [{}, /needs "amount"/],
    [{ amount: "150" }, /needs "amount"/],
    [{ amount: 0 }, /greater than zero/],
  ])("%p is rejected", (config, re) => {
    expect(
      validateConfigForMethod({ method: "FLAT" }, config).join(" "),
    ).toMatch(re);
  });
});

describe("PERCENT_WITH_MIN", () => {
  test("valid config validates and prices", () => {
    pricesCleanly(
      { method: "PERCENT_WITH_MIN", basis: "COD_AMOUNT" },
      { percent: 2, minAmount: 50 },
    );
  });
  test("neither percent nor minimum can never charge", () => {
    expect(
      validateConfigForMethod(
        { method: "PERCENT_WITH_MIN" },
        { percent: 0 },
      ).join(" "),
    ).toMatch(/can never produce a charge/);
  });
  test("optionsBy validates each branch", () => {
    const computation = {
      method: "PERCENT_WITH_MIN",
      basis: "INVOICE_VALUE",
      optionsBy: "riskType",
    };
    expect(
      validateConfigForMethod(computation, {
        OWNER: { percent: 0.1, minAmount: 25 },
        CARRIER: { percent: 2, minAmount: 100 },
      }),
    ).toEqual([]);
    expect(
      validateConfigForMethod(computation, { OWNER: { percent: "x" } }).join(
        " ",
      ),
    ).toMatch(/needs "percent"/);
    expect(validateConfigForMethod(computation, {}).join(" ")).toMatch(
      /one entry per option value/,
    );
  });
});

describe("PER_UNIT", () => {
  test("valid config validates and prices", () => {
    pricesCleanly(
      { method: "PER_UNIT", basis: "CHARGEABLE_WEIGHT" },
      { perUnit: 8, unitSize: 1, minAmount: 500 },
    );
  });
  test.each([
    [{ unitSize: 1 }, /needs "perUnit"/],
    [{ perUnit: 8, unitSize: 0 }, /"unitSize" must be a positive/],
    [{ perUnit: 8, minAmount: -1 }, /"minAmount" must be zero or more/],
  ])("%p is rejected", (config, re) => {
    expect(
      validateConfigForMethod({ method: "PER_UNIT" }, config).join(" "),
    ).toMatch(re);
  });
});

describe("SLAB", () => {
  const computation = {
    method: "SLAB",
    basis: "ANSWER_VALUE",
    answerPath: "loading.floor",
  };
  test("valid config validates and prices", () => {
    pricesCleanly(computation, {
      slabs: [
        { upTo: 1, amount: 0 },
        { upTo: 3, amount: 300 },
      ],
    });
  });
  test.each([
    [{}, /non-empty "slabs"/],
    [{ slabs: [] }, /non-empty "slabs"/],
    [{ slabs: [{ upTo: 0, amount: 10 }] }, /"upTo" must be a positive/],
    [{ slabs: [{ upTo: 3 }] }, /"amount" must be zero or more/],
    [
      {
        slabs: [
          { upTo: 3, amount: 10 },
          { upTo: 3, amount: 20 },
        ],
      },
      /duplicate "upTo"/,
    ],
  ])("%p is rejected", (config, re) => {
    expect(validateConfigForMethod(computation, config).join(" ")).toMatch(re);
  });
  test("ANSWER_VALUE basis requires an answerPath", () => {
    expect(
      validateConfigForMethod(
        { method: "SLAB", basis: "ANSWER_VALUE" },
        { slabs: [{ upTo: 3, amount: 10 }] },
      ).join(" "),
    ).toMatch(/needs computation.answerPath/);
  });
});

describe("MATRIX", () => {
  test("delegates to findMatrixProblems rather than reimplementing", () => {
    const computation = { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" };
    expect(
      validateConfigForMethod(computation, {
        mode: "MILESTONE",
        rows: [
          { zoneMilestoneId: "ms-a", perKg: 1, charge: 26, minCharge: 130 },
        ],
      }),
    ).toEqual([]);
    expect(
      validateConfigForMethod(computation, {
        mode: "MILESTONE",
        rows: [],
      }).join(" "),
    ).toMatch(/non-empty rows/);
  });
});

describe("PER_UNIT_TIME", () => {
  test("EVENT_UNITS basis needs perUnit", () => {
    pricesCleanly(
      { method: "PER_UNIT_TIME", basis: "EVENT_UNITS" },
      { perUnit: 100, freeUnits: 2 },
    );
    expect(
      validateConfigForMethod(
        { method: "PER_UNIT_TIME", basis: "EVENT_UNITS" },
        { perKgPerDay: 0.5 },
      ).join(" "),
    ).toMatch(/needs "perUnit"/);
  });
  test("CHARGEABLE_WEIGHT basis needs perKgPerDay instead", () => {
    pricesCleanly(
      { method: "PER_UNIT_TIME", basis: "CHARGEABLE_WEIGHT" },
      { perKgPerDay: 0.5, freeUnits: 1, minAmount: 100 },
    );
    expect(
      validateConfigForMethod(
        { method: "PER_UNIT_TIME", basis: "CHARGEABLE_WEIGHT" },
        { perUnit: 100 },
      ).join(" "),
    ).toMatch(/needs "perKgPerDay"/);
  });
});

describe("RATE_ADJUSTMENT", () => {
  test("valid config validates and prices", () => {
    pricesCleanly(
      { method: "RATE_ADJUSTMENT", basis: "SUBTOTAL", subtotalOf: "PRE_TAX" },
      { percent: 18 },
    );
  });
  test.each([
    [{ method: "RATE_ADJUSTMENT" }, {}, /needs "percent"/],
    [
      { method: "RATE_ADJUSTMENT" },
      { percent: 0 },
      /can never produce a charge/,
    ],
    [
      { method: "RATE_ADJUSTMENT", subtotalOf: "NONSENSE" },
      { percent: 5 },
      /must be one of/,
    ],
  ])("rejects %p / %p", (computation, config, re) => {
    expect(validateConfigForMethod(computation, config).join(" ")).toMatch(re);
  });
});

describe("OPTION_RATE", () => {
  const computation = {
    method: "OPTION_RATE",
    basis: "ANSWER_VALUE",
    answerPath: "packingMaterial",
  };
  test("valid config validates and prices", () => {
    pricesCleanly(computation, {
      rates: { CARTON: 120, BUBBLE: 50 },
      perBox: true,
    });
  });
  test("a zero rate is unpriced, not free — so it is rejected", () => {
    expect(
      validateConfigForMethod(computation, { rates: { CARTON: 0 } }).join(" "),
    ).toMatch(/rate for "CARTON" must be a positive/);
  });
  test.each([
    [{}, /non-empty "rates"/],
    [{ rates: {} }, /non-empty "rates"/],
    [{ rates: { A: 1 }, perBox: "yes" }, /"perBox" must be true or false/],
  ])("%p is rejected", (config, re) => {
    expect(validateConfigForMethod(computation, config).join(" ")).toMatch(re);
  });
  test("missing answerPath is a problem", () => {
    expect(
      validateConfigForMethod(
        { method: "OPTION_RATE" },
        { rates: { A: 1 } },
      ).join(" "),
    ).toMatch(/needs computation.answerPath/);
  });
});

describe("DISCOUNT", () => {
  const computation = {
    method: "DISCOUNT",
    basis: "SUBTOTAL",
    subtotalOf: "PRE_TAX",
  };
  test("valid config validates and prices", () => {
    pricesCleanly(computation, {
      tiers: { GOLD: { type: "PERCENTAGE", value: 10 } },
    });
  });
  test.each([
    [{}, /non-empty "tiers"/],
    [{ tiers: { GOLD: { type: "OTHER", value: 5 } } }, /PERCENTAGE or FLAT/],
    [
      { tiers: { GOLD: { type: "FLAT", value: 0 } } },
      /value must be a positive/,
    ],
  ])("%p is rejected", (config, re) => {
    expect(validateConfigForMethod(computation, config).join(" ")).toMatch(re);
  });
});

describe("edges", () => {
  test("a definition with no method is the definition's problem", () => {
    expect(validateConfigForMethod({}, {}).join(" ")).toMatch(
      /no computation.method/,
    );
  });
  test("an unknown method is not judged here", () => {
    expect(validateConfigForMethod({ method: "FUTURE" }, {})).toEqual([]);
  });
  test.each([null, undefined, "x", 5])(
    "a non-object config (%p) is rejected",
    (config) => {
      expect(
        validateConfigForMethod({ method: "FLAT" }, config).join(" "),
      ).toMatch(/must be an object/);
    },
  );
});
