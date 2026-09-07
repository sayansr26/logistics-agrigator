/**
 * Backward compatibility across prompt versions.
 *
 * There are stored suggestions from v2 and v3 in the database. The v4 action
 * contract must not strand them: a row with no `actions` key has to compile to
 * nothing and flow through exactly as before.
 */

const { compileActions } = require("../services/ai/actions/compile");
const { collectUnsupported } = require("../services/ai/configBrainService");

const ctx = {
  partnerId: "cmt89dm2b0000irvqezjx5q4x",
  channels: [],
  definitions: [
    {
      code: "B2C_BASIC_FREIGHT",
      name: "B2C Basic Freight",
      category: "BASE",
      computation: { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" },
    },
  ],
};

// Shape of the real stored row 02246f0f-… (prompt v2).
const V2_DRAFT = {
  understanding: "base freight for Delhivery",
  definitions: [
    {
      code: "B2C_BASIC_FREIGHT",
      name: "B2C Basic Freight",
      category: "BASE",
      applyStage: "QUOTE",
      phase: 100,
      computation: { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" },
    },
  ],
  configs: [
    {
      chargeDefinitionCode: "B2C_BASIC_FREIGHT",
      partnerId: "cmt89dm2b0000irvqezjx5q4x",
      config: {
        mode: "MILESTONE",
        rows: [
          { zoneMilestoneId: "5d0f2350", perKg: 1, charge: 26, minCharge: 130 },
        ],
      },
      conditions: null,
    },
  ],
  warnings: ["The rate is per kg, so perKg is set to 1"],
};

// prompt v3 — rate cards, still no actions.
const V3_DRAFT = {
  understanding: "base freight for the 5kg channel",
  rateCards: [
    {
      chargeName: "B2C Basic Freight",
      channel: "Delhivery 5kg Surface",
      billingUnitKg: 1,
      bands: [
        { zone: "A", fromKm: 0, toKm: 50, ratePerUnit: 26, minFreight: 130 },
      ],
      notes: ["Volumetric Formula: LBH / 5000"],
    },
  ],
  definitions: [],
  configs: [],
};

describe("v2 drafts", () => {
  test("compile to nothing — their definitions/configs are already canonical", () => {
    const r = compileActions(V2_DRAFT.actions, ctx);
    expect(r).toMatchObject({
      definitions: [],
      configs: [],
      rateCards: [],
      problems: [],
      unsupported: [],
    });
  });

  test("their own definitions and configs are untouched by the action layer", () => {
    // draftFromText merges json.definitions/json.configs ahead of compiled ones,
    // so a v2 row still applies exactly what it always applied.
    const merged = [
      ...(V2_DRAFT.configs || []),
      ...compileActions(undefined, ctx).configs,
    ];
    expect(merged).toHaveLength(1);
    expect(merged[0].chargeDefinitionCode).toBe("B2C_BASIC_FREIGHT");
  });

  test("produce no unsupported noise", () => {
    expect(collectUnsupported(V2_DRAFT)).toEqual([]);
  });
});

describe("v3 drafts", () => {
  test("compile to nothing; rate cards still reach the encoder via json.rateCards", () => {
    expect(compileActions(V3_DRAFT.actions, ctx).rateCards).toEqual([]);
    expect(V3_DRAFT.rateCards).toHaveLength(1);
  });

  test("their notes now surface instead of vanishing", () => {
    const items = collectUnsupported(V3_DRAFT);
    expect(items).toHaveLength(1);
    expect(items[0].request).toBe("Volumetric Formula: LBH / 5000");
  });
});

describe("v4 drafts", () => {
  test("rate cards arrive as an action and are handed to the same encoder", () => {
    const card = V3_DRAFT.rateCards[0];
    const r = compileActions([{ type: "rate_card", rateCard: card }], ctx);
    expect(r.rateCards).toEqual([card]);
  });

  test("a mixed draft yields definitions, configs and refusals together", () => {
    const r = compileActions(
      [
        { type: "rate_card", rateCard: V3_DRAFT.rateCards[0] },
        {
          type: "upsert_config",
          chargeDefinitionCode: "B2C_BASIC_FREIGHT",
          config: {
            mode: "MILESTONE",
            rows: [
              { zoneMilestoneId: "ms-a", perKg: 1, charge: 26, minCharge: 130 },
            ],
          },
        },
        {
          type: "create_channel",
          request: "create a channel named Delhivery 10kg",
        },
      ],
      ctx,
    );
    expect(r.rateCards).toHaveLength(1);
    expect(r.configs).toHaveLength(1);
    expect(r.unsupported).toHaveLength(1);
    expect(r.problems).toEqual([]);
  });
});
