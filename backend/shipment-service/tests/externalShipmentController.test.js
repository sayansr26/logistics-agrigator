/**
 * Unit tests for the External API's pure helpers.
 *
 * `deriveQuoteParams` is the highest-risk function in the one-step booking
 * path: the parameters it produces are what the quote token's claims get
 * signed over, and `assertClaimsMatchPayload` later re-derives the same values
 * from the request body. Any divergence makes every one-step booking fail its
 * own signature check, so the mapping is pinned here.
 */

const {
  deriveQuoteParams,
  selectQuote,
} = require("../controllers/external/shipmentExternalController");

const baseBody = {
  pickupAddress: { pincode: "400001" },
  deliveryAddress: { pincode: "410210" },
  packageDetails: {
    weight: 5,
    dimensions: { length: 30, width: 20, height: 15 },
    value: 2500,
    fragile: false,
  },
  numberOfBoxes: 1,
  serviceType: "STANDARD",
  paymentType: "PREPAID",
  shipmentType: "B2C",
  vasSelections: [],
  selection: "cheapest",
};

describe("deriveQuoteParams", () => {
  it("maps the body fields the quote token is signed over", () => {
    const params = deriveQuoteParams(baseBody, null);

    expect(params.fromPincode).toBe("400001");
    expect(params.toPincode).toBe("410210");
    expect(params.weight).toBe(5);
    expect(params.shipmentType).toBe("B2C");
    expect(params.paymentType).toBe("PREPAID");
    expect(params.vasSelections).toEqual([]);
  });

  it("omits codAmount for PREPAID and carries it for COD", () => {
    // The signed claims store codAmount only when the payment type is COD;
    // sending it on a PREPAID booking would produce a claims mismatch.
    expect(
      deriveQuoteParams({ ...baseBody, codAmount: 999 }, null).codAmount,
    ).toBeNull();

    const cod = deriveQuoteParams(
      { ...baseBody, paymentType: "COD", codAmount: 3000 },
      null,
    );
    expect(cod.codAmount).toBe(3000);
  });

  it("maps the selection strategy onto the partner-service sort order", () => {
    expect(deriveQuoteParams(baseBody, null).sortBy).toBe("cheapest");
    expect(
      deriveQuoteParams({ ...baseBody, selection: "fastest" }, null).sortBy,
    ).toBe("fastest");
  });

  it("passes the outlet through for platform-level credentials", () => {
    expect(deriveQuoteParams(baseBody, "outlet-123").outletId).toBe(
      "outlet-123",
    );
    expect(deriveQuoteParams(baseBody, null).outletId).toBeNull();
  });

  it("defaults declaredValue and isFragile from packageDetails", () => {
    const params = deriveQuoteParams(baseBody, null);
    expect(params.declaredValue).toBe(2500);
    expect(params.isFragile).toBe(false);

    const bare = deriveQuoteParams(
      { ...baseBody, packageDetails: { weight: 1, dimensions: {} } },
      null,
    );
    expect(bare.declaredValue).toBe(0);
    expect(bare.isFragile).toBe(false);
  });
});

describe("selectQuote", () => {
  // buildQuotes returns quotes already sorted by totalAmount ascending.
  const quotes = [
    { partnerId: "p1", totalAmount: 100, deliveryDays: 5 },
    { partnerId: "p2", totalAmount: 150, deliveryDays: 2 },
    { partnerId: "p3", totalAmount: 200, deliveryDays: 2 },
  ];

  it("picks the cheapest by default", () => {
    expect(selectQuote(quotes, { selection: "cheapest" }).partnerId).toBe("p1");
  });

  it("picks the fastest, breaking ties on price", () => {
    // p2 and p3 both deliver in 2 days; the cheaper one wins.
    expect(selectQuote(quotes, { selection: "fastest" }).partnerId).toBe("p2");
  });

  it("honours an explicit partnerId over the strategy", () => {
    expect(
      selectQuote(quotes, { partnerId: "p3", selection: "cheapest" }).partnerId,
    ).toBe("p3");
  });

  it("returns null when the requested partner is not in the list", () => {
    expect(selectQuote(quotes, { partnerId: "nope" })).toBeNull();
  });

  it("falls back to the cheapest when no quote reports delivery days", () => {
    const noDays = [
      { partnerId: "a", totalAmount: 100, deliveryDays: null },
      { partnerId: "b", totalAmount: 120, deliveryDays: null },
    ];
    expect(selectQuote(noDays, { selection: "fastest" }).partnerId).toBe("a");
  });

  it("returns null for an empty quote list", () => {
    expect(selectQuote([], { selection: "cheapest" })).toBeNull();
  });
});
