/**
 * ai/rateCard/encoder — plain rate card -> MATRIX/MILESTONE config.
 *
 * The encoder's job is to be boring and refuse to guess. Most of these tests
 * assert that an ambiguity becomes a `problem` rather than a plausible-looking
 * config, because a wrong guess here misprices silently.
 */

const {
  encodeRateCard,
  encodeRateCards,
} = require("../services/ai/rateCard/encoder");
const { replayExamples } = require("../services/ai/rateCard/replay");

const MILESTONES = [
  { id: "ms-a", suffix: "A", minKm: 0, maxKm: 50 },
  { id: "ms-b", suffix: "B", minKm: 51, maxKm: 500 },
  { id: "ms-c", suffix: "C", minKm: 501, maxKm: 1400 },
  { id: "ms-d", suffix: "D", minKm: 1401, maxKm: 3200 },
];

const ZONE = { id: "zone-1", name: "Delhivery B2C", milestones: MILESTONES };

const CHANNELS = [
  {
    id: "ch-05",
    channelName: "Delhivery0.5 Surface",
    accountRef: "LOGIMARTTECHNOLOGIEDLTDB2C",
    minWeight: 0.5,
    maxWeight: 5,
  },
  {
    id: "ch-5kg",
    channelName: "Delhivery 5kg Surface",
    accountRef: "STARTUPFRANCHISE",
    minWeight: 5,
    maxWeight: 10,
  },
];

const DEFINITIONS = [
  {
    code: "B2C_BASIC_FREIGHT",
    name: "B2C Basic Freight",
    category: "BASE",
    computation: { method: "MATRIX" },
  },
  {
    code: "INSURANCE_CHARGE",
    name: "Insurance Charge",
    category: "VAS",
    computation: { method: "PERCENT_WITH_MIN" },
  },
];

const ctx = (over = {}) => ({
  partnerId: "partner-1",
  distanceZones: [ZONE],
  channels: CHANNELS,
  definitions: DEFINITIONS,
  existingBaseConfigs: [],
  ...over,
});

// The admin's real 2026-08-26 card.
const CARD = {
  chargeName: "B2C Basic Freight",
  channel: "Delhivery 5kg Surface",
  billingUnitKg: 1,
  bands: [
    { zone: "A", fromKm: 0, toKm: 50, ratePerUnit: 26, minFreight: 130 },
    { zone: "B", fromKm: 51, toKm: 500, ratePerUnit: 32, minFreight: 160 },
    { zone: "C", fromKm: 501, toKm: 1400, ratePerUnit: 38, minFreight: 180 },
    { zone: "D", fromKm: 1401, toKm: null, ratePerUnit: 46, minFreight: 220 },
  ],
  examples: [{ distanceKm: 30, weightKg: 3, expectedFreight: 130 }],
};

const card = (over = {}) => ({ ...CARD, ...over });

describe("the real Delhivery card", () => {
  test("encodes to the exact config that is live today", () => {
    const r = encodeRateCard(CARD, ctx());

    expect(r.problems).toEqual([]);
    expect(r.chargeDefinitionCode).toBe("B2C_BASIC_FREIGHT");
    expect(r.channelId).toBe("ch-5kg");
    expect(r.config).toEqual({
      mode: "MILESTONE",
      rows: [
        { zoneMilestoneId: "ms-a", perKg: 1, charge: 26, minCharge: 130 },
        { zoneMilestoneId: "ms-b", perKg: 1, charge: 32, minCharge: 160 },
        { zoneMilestoneId: "ms-c", perKg: 1, charge: 38, minCharge: 180 },
        { zoneMilestoneId: "ms-d", perKg: 1, charge: 46, minCharge: 220 },
      ],
    });
  });

  test('"Above 1400 Km" binds the top milestone and says what happens past it', () => {
    const r = encodeRateCard(CARD, ctx());
    const tail = r.bindings[3];
    expect(tail.matchedBy).toBe("OPEN_TAIL");
    expect(r.warnings.join(" ")).toMatch(/beyond 3200 km/);
  });
});

describe("band -> milestone", () => {
  test("an off-by-one partition still binds, with a warning", () => {
    const r = encodeRateCard(
      card({
        bands: [
          { fromKm: 0, toKm: 50, ratePerUnit: 26, minFreight: 130 },
          { fromKm: 50, toKm: 500, ratePerUnit: 32, minFreight: 160 },
          { fromKm: 500, toKm: 1400, ratePerUnit: 38, minFreight: 180 },
          { fromKm: 1400, toKm: 3200, ratePerUnit: 46, minFreight: 220 },
        ],
      }),
      ctx(),
    );
    expect(r.problems).toEqual([]);
    expect(r.config.rows).toHaveLength(4);
    expect(r.bindings.map((b) => b.matchedBy)).toContain("TOLERANT");
  });

  test("a band inside exactly one milestone binds by midpoint, with a warning", () => {
    const r = encodeRateCard(
      card({
        bands: [{ fromKm: 600, toKm: 700, ratePerUnit: 38, minFreight: 180 }],
      }),
      ctx(),
    );
    expect(r.problems).toEqual([]);
    expect(r.bindings[0].milestone.suffix).toBe("C");
    expect(r.bindings[0].matchedBy).toBe("MIDPOINT");
  });

  test("a band matching nothing is a problem naming the real milestones", () => {
    const r = encodeRateCard(
      card({ bands: [{ fromKm: 5000, toKm: 6000, ratePerUnit: 10 }] }),
      ctx(),
    );
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/A 0-50 km, B 51-500 km/);
  });

  test("a zone letter contradicting the distances is a problem, not a tiebreak", () => {
    const r = encodeRateCard(
      card({
        bands: [
          {
            zone: "A",
            fromKm: 51,
            toKm: 500,
            ratePerUnit: 32,
            minFreight: 160,
          },
        ],
      }),
      ctx(),
    );
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/do not line up/);
  });

  test("a zone letter that agrees is silent", () => {
    const r = encodeRateCard(
      card({
        bands: [
          {
            zone: "B",
            fromKm: 51,
            toKm: 500,
            ratePerUnit: 32,
            minFreight: 160,
          },
        ],
      }),
      ctx(),
    );
    expect(r.problems).toEqual([]);
  });

  test("two bands claiming one milestone is a problem", () => {
    const r = encodeRateCard(
      card({
        bands: [
          { fromKm: 0, toKm: 50, ratePerUnit: 26, minFreight: 130 },
          { fromKm: 0, toKm: 50, ratePerUnit: 30, minFreight: 150 },
        ],
      }),
      ctx(),
    );
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/already covered/);
  });

  test("an uncovered milestone warns in terms of what it costs", () => {
    const r = encodeRateCard(
      card({
        bands: [
          { zone: "A", fromKm: 0, toKm: 50, ratePerUnit: 26, minFreight: 130 },
        ],
      }),
      ctx(),
    );
    expect(r.problems).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/dropped from quotes/);
  });
});

describe("zone selection", () => {
  test("no DISTANCE zone at all is a problem", () => {
    const r = encodeRateCard(CARD, ctx({ distanceZones: [] }));
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/no DISTANCE zone/);
  });

  test("two zones and no zoneName is a problem, never an arbitrary pick", () => {
    const other = {
      id: "zone-2",
      name: "Delhivery B2B",
      milestones: MILESTONES,
    };
    const r = encodeRateCard(CARD, ctx({ distanceZones: [ZONE, other] }));
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/name which one/);
  });

  test("two zones with a zoneName resolves", () => {
    const other = {
      id: "zone-2",
      name: "Delhivery B2B",
      milestones: MILESTONES,
    };
    const r = encodeRateCard(
      card({ zoneName: "delhivery b2c" }),
      ctx({ distanceZones: [ZONE, other] }),
    );
    expect(r.problems).toEqual([]);
    expect(r.config.rows[0].zoneMilestoneId).toBe("ms-a");
  });
});

describe("channel binding", () => {
  test.each([
    ["Delhivery 5Kg Surface", "ch-5kg"],
    ["delhivery0.5surface", "ch-05"],
    ["STARTUPFRANCHISE", "ch-5kg"],
  ])("%s binds to %s", (channel, expected) => {
    const r = encodeRateCard(card({ channel }), ctx());
    expect(r.channelId).toBe(expected);
  });

  // The load-bearing anti-guess test: "Delhivery" is contained in both names.
  test('an ambiguous "Delhivery" is a problem listing both, not a guess', () => {
    const r = encodeRateCard(card({ channel: "Delhivery" }), ctx());
    expect(r.channelId).toBeNull();
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(
      /Delhivery0\.5 Surface.*Delhivery 5kg Surface/,
    );
  });

  test("an unknown channel is a problem naming the real ones", () => {
    const r = encodeRateCard(card({ channel: "Bluedart Express" }), ctx());
    expect(r.channelId).toBeNull();
    expect(r.problems.join(" ")).toMatch(/matches none/);
  });

  test("no channel means partner-wide, with a warning about the fallback", () => {
    const r = encodeRateCard(card({ channel: null }), ctx());
    expect(r.channelId).toBeNull();
    expect(r.problems).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/partner-wide fallback/);
  });

  test("an explicit selection wins over the card's text", () => {
    const r = encodeRateCard(
      card({ channel: null }),
      ctx({ selectedChannelId: "ch-05" }),
    );
    expect(r.channelId).toBe("ch-05");
  });

  test("a selection disagreeing with the card's text is a problem", () => {
    const r = encodeRateCard(
      card({ channel: "Delhivery0.5 Surface" }),
      ctx({ selectedChannelId: "ch-5kg" }),
    );
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/resolve the disagreement/);
  });
});

describe("definition resolution", () => {
  test("reuses whatever definition this partner's base freight already lives on", () => {
    const r = encodeRateCard(
      card({ chargeName: "Base Freight" }),
      ctx({
        existingBaseConfigs: [{ chargeDefinitionCode: "B2C_BASIC_FREIGHT" }],
      }),
    );
    expect(r.chargeDefinitionCode).toBe("B2C_BASIC_FREIGHT");
  });

  test("prefers BASE_FREIGHT once the catalog is seeded", () => {
    const seeded = [
      ...DEFINITIONS,
      {
        code: "BASE_FREIGHT",
        name: "Base Freight",
        category: "BASE",
        computation: { method: "MATRIX" },
      },
    ];
    const r = encodeRateCard(
      card({ chargeName: "Freight" }),
      ctx({ definitions: seeded }),
    );
    expect(r.chargeDefinitionCode).toBe("BASE_FREIGHT");
  });

  // Bootstrap: an empty catalog has nothing to duplicate, so the encoder is
  // allowed to ask for BASE_FREIGHT to be created alongside the config.
  test("an empty catalog bootstraps BASE_FREIGHT instead of failing", () => {
    const r = encodeRateCard(CARD, ctx({ definitions: [DEFINITIONS[1]] }));

    expect(r.problems).toEqual([]);
    expect(r.config).not.toBeNull();
    expect(r.chargeDefinitionCode).toBe("BASE_FREIGHT");
    expect(r.definitionToCreate).toMatchObject({
      code: "BASE_FREIGHT",
      category: "BASE",
      applyStage: "QUOTE",
      phase: 100,
      computation: { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" },
    });
    expect(r.warnings.join(" ")).toMatch(/will be created alongside/);
  });

  test("the bootstrapped definition carries no isSystem flag", () => {
    // The seed sets isSystem: true, so leaving it off means a later seed run
    // upserts onto this row rather than leaving a near-duplicate beside it.
    const r = encodeRateCard(CARD, ctx({ definitions: [DEFINITIONS[1]] }));
    expect(r.definitionToCreate).not.toHaveProperty("isSystem");
  });

  test("reuse-only returns the moment ONE base definition exists", () => {
    const r = encodeRateCard(card({ chargeName: "Totally Unrelated" }), ctx());
    // A single BASE definition is still picked by the sole-candidate rule.
    expect(r.chargeDefinitionCode).toBe("B2C_BASIC_FREIGHT");
    expect(r.definitionToCreate).toBeNull();
  });

  test("two base definitions and no name match is a problem, not a bootstrap", () => {
    const twoBase = [
      ...DEFINITIONS,
      {
        code: "B2B_FREIGHT",
        name: "B2B Freight",
        category: "BASE",
        computation: { method: "MATRIX" },
      },
    ];
    const r = encodeRateCard(
      card({ chargeName: "Totally Unrelated" }),
      ctx({ definitions: twoBase }),
    );
    expect(r.config).toBeNull();
    expect(r.definitionToCreate).toBeNull();
    expect(r.problems.join(" ")).toMatch(
      /does not match any of the base charge definitions/,
    );
  });

  test("encodeRateCards surfaces the bootstrap once for several cards", () => {
    const r = encodeRateCards(
      [CARD, card({ channel: null })],
      ctx({
        definitions: [DEFINITIONS[1]],
      }),
    );
    expect(r.definitions).toHaveLength(1);
    expect(r.definitions[0].code).toBe("BASE_FREIGHT");
  });

  test("a non-MATRIX definition cannot hold a rate card", () => {
    const flat = [
      {
        code: "BASE_FREIGHT",
        name: "Base Freight",
        category: "BASE",
        computation: { method: "FLAT" },
      },
    ];
    const r = encodeRateCard(CARD, ctx({ definitions: flat }));
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/not MATRIX/);
  });
});

describe("numbers", () => {
  test("a missing billing unit assumes 1 kg and says so", () => {
    const r = encodeRateCard(card({ billingUnitKg: null }), ctx());
    expect(r.config.rows.every((x) => x.perKg === 1)).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/assuming 1 kg/);
  });

  test("a zero rate is a problem", () => {
    const r = encodeRateCard(
      card({ bands: [{ fromKm: 0, toKm: 50, ratePerUnit: 0 }] }),
      ctx(),
    );
    expect(r.config).toBeNull();
    expect(r.problems.join(" ")).toMatch(/positive number/);
  });

  test("a minimum that can never bind is warned about", () => {
    const r = encodeRateCard(
      card({
        bands: [
          { zone: "A", fromKm: 0, toKm: 50, ratePerUnit: 26, minFreight: 20 },
        ],
      }),
      ctx(),
    );
    expect(r.warnings.join(" ")).toMatch(/can never bind/);
  });

  test("the 2026-08-25 artefact is flagged but still encodes", () => {
    // minFreight === rate on every band, sub-kg billing unit: the fingerprint
    // of a rate copied into the minimum column. A warning, not a problem —
    // the admin may genuinely have meant it, as they did that day.
    const r = encodeRateCard(
      card({
        billingUnitKg: 0.5,
        bands: [
          { zone: "A", fromKm: 0, toKm: 50, ratePerUnit: 26, minFreight: 26 },
          { zone: "B", fromKm: 51, toKm: 500, ratePerUnit: 32, minFreight: 32 },
          {
            zone: "C",
            fromKm: 501,
            toKm: 1400,
            ratePerUnit: 38,
            minFreight: 38,
          },
          {
            zone: "D",
            fromKm: 1401,
            toKm: null,
            ratePerUnit: 46,
            minFreight: 46,
          },
        ],
      }),
      ctx(),
    );
    expect(r.problems).toEqual([]);
    expect(r.config.rows[0]).toEqual({
      zoneMilestoneId: "ms-a",
      perKg: 0.5,
      charge: 26,
      minCharge: 26,
    });
    expect(r.warnings.join(" ")).toMatch(
      /copied into the minimum-freight column/,
    );
  });
});

describe("invariants", () => {
  test("never emits a milestone id the partner does not own", () => {
    const known = new Set(MILESTONES.map((m) => m.id));
    const cards = [
      CARD,
      card({ bands: [{ fromKm: 600, toKm: 700, ratePerUnit: 38 }] }),
      card({ billingUnitKg: 0.5 }),
      card({ channel: null }),
    ];
    for (const c of cards) {
      const r = encodeRateCard(c, ctx());
      for (const row of r.config?.rows || []) {
        expect(known.has(row.zoneMilestoneId)).toBe(true);
      }
    }
  });

  test("encodeRateCards shapes results like v2 config entries", () => {
    const r = encodeRateCards([CARD], ctx());
    expect(r.problems).toEqual([]);
    expect(r.configs).toHaveLength(1);
    expect(r.configs[0]).toMatchObject({
      chargeDefinitionCode: "B2C_BASIC_FREIGHT",
      partnerId: "partner-1",
      channelId: "ch-5kg",
      conditions: null,
      source: "RATE_CARD",
    });
  });

  test("a bad card contributes problems and no config", () => {
    const r = encodeRateCards([card({ channel: "Delhivery" })], ctx());
    expect(r.configs).toEqual([]);
    expect(r.problems[0]).toMatch(/^rate card 1: /);
  });
});

describe("encoder + replay end to end", () => {
  // The whole design in one test: a card the admin typed, encoded by code into
  // engine JSON, then priced by the real engine and checked against the numbers
  // the admin themselves wrote down.
  const DEFINITION = {
    code: "B2C_BASIC_FREIGHT",
    name: "B2C Basic Freight",
    category: "BASE",
    applyStage: "QUOTE",
    phase: 100,
    computation: { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" },
    conditions: null,
    aggregation: null,
    flags: {},
  };

  test("the admin's four worked examples reproduce through the encoded config", () => {
    const encoded = encodeRateCard(
      card({
        examples: [
          { distanceKm: 30, weightKg: 3, expectedFreight: 130 },
          { distanceKm: 350, weightKg: 8, expectedFreight: 256 },
          { distanceKm: 900, weightKg: 4, expectedFreight: 180 },
          { distanceKm: 1800, weightKg: 10, expectedFreight: 460 },
        ],
      }),
      ctx(),
    );
    expect(encoded.problems).toEqual([]);

    const replayed = replayExamples({
      definition: DEFINITION,
      config: { config: encoded.config, conditions: null },
      milestones: encoded.milestones,
      examples: encoded.examples,
    });

    expect(replayed.allPassed).toBe(true);
    expect(replayed.results.map((r) => r.actualFreight)).toEqual([
      130, 256, 180, 460,
    ]);
  });

  test("a card whose examples contradict its own rates is caught", () => {
    const encoded = encodeRateCard(
      card({
        examples: [{ distanceKm: 30, weightKg: 3, expectedFreight: 999 }],
      }),
      ctx(),
    );
    const replayed = replayExamples({
      definition: DEFINITION,
      config: { config: encoded.config, conditions: null },
      milestones: encoded.milestones,
      examples: encoded.examples,
    });
    expect(replayed.allPassed).toBe(false);
    expect(replayed.results[0].actualFreight).toBe(130);
  });
});
