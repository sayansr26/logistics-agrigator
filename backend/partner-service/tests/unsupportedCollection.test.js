/**
 * configBrainService.collectUnsupported — the "what did the system ignore?" list.
 *
 * The prompt instructs the model to file anything it cannot express into
 * rateCard.notes. That text used to reach JSONB and stop, which is what made the
 * AI look like it ignored instructions. These tests pin that it now surfaces.
 */

const { collectUnsupported } = require("../services/ai/configBrainService");

describe("collectUnsupported", () => {
  test("lifts rate-card notes into named requests", () => {
    const items = collectUnsupported({
      rateCards: [
        { notes: ["Volumetric Formula: LBH / 5000", "TAT: 3 days"] },
        { notes: ["RTO at 50%"] },
      ],
    });

    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      source: "rate card 1",
      request: "Volumetric Formula: LBH / 5000",
      reason: "no field in the charge contract covers this",
    });
    expect(items[2].source).toBe("rate card 2");
  });

  test("accepts the v4 structured refusal shape", () => {
    const items = collectUnsupported({
      unsupported: [
        {
          request: "create a channel named X",
          reason: "channels are read-only here",
        },
      ],
    });
    expect(items[0]).toMatchObject({
      request: "create a channel named X",
      reason: "channels are read-only here",
    });
  });

  test("accepts a bare string refusal", () => {
    const items = collectUnsupported({ unsupported: ["create a zone"] });
    expect(items[0]).toMatchObject({
      request: "create a zone",
      source: "prompt",
    });
  });

  test("merges notes and explicit refusals", () => {
    const items = collectUnsupported({
      rateCards: [{ notes: ["TAT: 3 days"] }],
      unsupported: [{ request: "create a channel" }],
    });
    expect(items.map((i) => i.request)).toEqual([
      "TAT: 3 days",
      "create a channel",
    ]);
  });

  test("drops empty entries rather than rendering blank rows", () => {
    expect(
      collectUnsupported({
        rateCards: [{ notes: ["", null] }],
        unsupported: [{ request: "" }, null],
      }),
    ).toEqual([]);
  });

  test.each([
    ["no rate cards", {}],
    ["cards without notes", { rateCards: [{ bands: [] }] }],
    ["null input", null],
  ])("%s yields an empty list", (_label, input) => {
    expect(collectUnsupported(input)).toEqual([]);
  });
});
