/**
 * ai/actions/compile — the v4 action list -> {definitions, configs}.
 *
 * The point of the action layer is that a prompt can ASK for something and get
 * either a real write or a recorded refusal — never a silent no-op. These tests
 * pin both halves.
 */

const { compileActions } = require("../services/ai/actions/compile");

const CATALOG = [
  {
    code: "BASE_FREIGHT",
    name: "Base Freight",
    category: "BASE",
    computation: { method: "MATRIX", basis: "CHARGEABLE_WEIGHT" },
  },
  {
    code: "COD_CHARGE",
    name: "COD Charge",
    category: "COD",
    computation: { method: "PERCENT_WITH_MIN", basis: "COD_AMOUNT" },
  },
];

const CHANNELS = [
  {
    id: "ch-05",
    channelName: "Delhivery0.5 Surface",
    accountRef: "LOGIMART",
    isActive: true,
  },
  {
    id: "ch-5kg",
    channelName: "Delhivery 5kg Surface",
    accountRef: "STARTUP",
    isActive: true,
  },
];

const ctx = (over = {}) => ({
  partnerId: "p1",
  channels: CHANNELS,
  definitions: CATALOG,
  ...over,
});

const NEW_DEF = {
  code: "PICKUP_FEE",
  name: "Pickup Fee",
  category: "PICKUP_DELIVERY",
  applyStage: "QUOTE",
  phase: 300,
  computation: { method: "FLAT", basis: "NONE" },
};

describe("create_definition", () => {
  test("a valid definition compiles", () => {
    const r = compileActions(
      [{ type: "create_definition", definition: NEW_DEF }],
      ctx(),
    );
    expect(r.problems).toEqual([]);
    expect(r.definitions).toHaveLength(1);
    expect(r.definitions[0].code).toBe("PICKUP_FEE");
  });

  test("is rejected by the same Joi the manual endpoint uses", () => {
    const r = compileActions(
      [
        {
          type: "create_definition",
          definition: { ...NEW_DEF, category: "NONSENSE" },
        },
      ],
      ctx(),
    );
    expect(r.definitions).toEqual([]);
    expect(r.problems.join(" ")).toMatch(/category/);
  });

  test("duplicate codes in one draft collapse to one", () => {
    const r = compileActions(
      [
        { type: "create_definition", definition: NEW_DEF },
        { type: "create_definition", definition: NEW_DEF },
      ],
      ctx(),
    );
    expect(r.definitions).toHaveLength(1);
  });
});

describe("upsert_config", () => {
  test("compiles against an existing definition", () => {
    const r = compileActions(
      [
        {
          type: "upsert_config",
          chargeDefinitionCode: "COD_CHARGE",
          channel: "Delhivery 5kg Surface",
          config: { percent: 2, minAmount: 50 },
        },
      ],
      ctx(),
    );
    expect(r.problems).toEqual([]);
    expect(r.configs[0]).toMatchObject({
      chargeDefinitionCode: "COD_CHARGE",
      partnerId: "p1",
      channelId: "ch-5kg",
      conditions: null,
      source: "ACTION",
    });
  });

  // This is the whole point of the action layer: "create it if missing, then
  // price it" now works in one draft.
  test("can reference a definition created earlier in the SAME draft", () => {
    const r = compileActions(
      [
        { type: "create_definition", definition: NEW_DEF },
        {
          type: "upsert_config",
          chargeDefinitionCode: "PICKUP_FEE",
          config: { amount: 60 },
        },
      ],
      ctx(),
    );
    expect(r.problems).toEqual([]);
    expect(r.definitions).toHaveLength(1);
    expect(r.configs).toHaveLength(1);
  });

  test("an unknown definition is a problem, not an invention", () => {
    const r = compileActions(
      [
        {
          type: "upsert_config",
          chargeDefinitionCode: "NOPE",
          config: { amount: 1 },
        },
      ],
      ctx(),
    );
    expect(r.configs).toEqual([]);
    expect(r.problems.join(" ")).toMatch(/no charge definition "NOPE" exists/);
  });

  test("a config that cannot price is rejected per method", () => {
    const r = compileActions(
      [
        {
          type: "upsert_config",
          chargeDefinitionCode: "COD_CHARGE",
          config: { percent: 0 },
        },
      ],
      ctx(),
    );
    expect(r.configs).toEqual([]);
    expect(r.problems.join(" ")).toMatch(/can never produce a charge/);
  });

  test("an ambiguous channel refuses rather than guessing", () => {
    const r = compileActions(
      [
        {
          type: "upsert_config",
          chargeDefinitionCode: "COD_CHARGE",
          channel: "Delhivery",
          config: { percent: 2, minAmount: 50 },
        },
      ],
      ctx(),
    );
    expect(r.configs).toEqual([]);
    expect(r.problems.join(" ")).toMatch(/ambiguous/);
  });

  test("no channel means partner-wide", () => {
    const r = compileActions(
      [
        {
          type: "upsert_config",
          chargeDefinitionCode: "COD_CHARGE",
          config: { percent: 2, minAmount: 50 },
        },
      ],
      ctx(),
    );
    expect(r.configs[0].channelId).toBeNull();
  });
});

describe("rate_card", () => {
  test("is handed back for the encoder, keeping its guardrails and replay", () => {
    const card = { chargeName: "Base Freight", bands: [] };
    const r = compileActions([{ type: "rate_card", rateCard: card }], ctx());
    expect(r.rateCards).toEqual([card]);
    expect(r.configs).toEqual([]);
  });
});

describe("refusals", () => {
  test.each([
    ["create_channel", /Channels page/],
    ["create_zone", /Zone Management/],
    ["update_definition", /shared by every partner/],
    ["delete_config", /Charge Configs page/],
  ])("%s is recorded as unsupported with a next step", (type, re) => {
    const r = compileActions([{ type, request: "do the thing" }], ctx());
    expect(r.unsupported).toHaveLength(1);
    expect(r.unsupported[0].request).toBe("do the thing");
    expect(r.unsupported[0].reason).toMatch(re);
    expect(r.problems).toEqual([]); // a refusal is not a validation failure
  });

  test("an unknown action type is refused, never guessed at", () => {
    const r = compileActions([{ type: "teleport_parcel" }], ctx());
    expect(r.unsupported[0].reason).toMatch(
      /not something charge drafting can do/,
    );
  });
});

describe("shape", () => {
  test.each([[undefined], [null], [[]], ["nope"]])(
    "%p compiles to an empty result",
    (actions) => {
      expect(compileActions(actions, ctx())).toMatchObject({
        definitions: [],
        configs: [],
        rateCards: [],
        unsupported: [],
        problems: [],
      });
    },
  );

  test("a selected channel overrides whatever the action names", () => {
    const r = compileActions(
      [
        {
          type: "upsert_config",
          chargeDefinitionCode: "COD_CHARGE",
          config: { percent: 2, minAmount: 50 },
        },
      ],
      ctx({ selectedChannelId: "ch-05" }),
    );
    expect(r.configs[0].channelId).toBe("ch-05");
  });
});
