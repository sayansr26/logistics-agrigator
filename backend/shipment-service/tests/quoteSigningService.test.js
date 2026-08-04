/**
 * Quote Signing Service — unit tests (HMAC token integrity)
 */

process.env.QUOTE_SIGNING_SECRET = "test-secret-for-unit-tests-only";

const {
  signQuote,
  verifyQuoteToken,
  assertClaimsMatchPayload,
  hashVasSelections,
} = require("../services/quoteSigningService");

const quote = {
  partnerId: "partner-1",
  totalAmount: 558.14,
  chargeableWeight: 5,
  volumetricDivisor: 27000,
};

const params = {
  fromPincode: "400001",
  toPincode: "410210",
  weight: 5,
  paymentType: "COD",
  codAmount: 3000,
  shipmentType: "B2C",
  serviceType: "STANDARD",
};

const vas = [{ chargeCode: "PACKING", answer: "CARTON" }];

describe("quoteSigningService", () => {
  test("sign → verify roundtrip preserves claims", () => {
    const token = signQuote(quote, params, vas);
    const { claims, expired } = verifyQuoteToken(token);
    expect(expired).toBe(false);
    expect(claims.partnerId).toBe("partner-1");
    expect(claims.totalAmount).toBe(558.14);
    expect(claims.codAmount).toBe(3000);
    expect(claims.vasHash).toBe(hashVasSelections(vas));
  });

  test("tampered signature is rejected", () => {
    const token = signQuote(quote, params, vas);
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(() => verifyQuoteToken(tampered)).toThrow(/signature/i);
  });

  test("tampered payload is rejected", () => {
    const token = signQuote(quote, params, vas);
    const [payload, signature] = token.split(".");
    const decoded = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString(),
    );
    decoded.totalAmount = 1;
    const forgedPayload = Buffer.from(JSON.stringify(decoded))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(() => verifyQuoteToken(`${forgedPayload}.${signature}`)).toThrow(
      /signature/i,
    );
  });

  test("garbage tokens are rejected", () => {
    expect(() => verifyQuoteToken("not-a-token")).toThrow(/format/i);
    expect(() => verifyQuoteToken(null)).toThrow(/format/i);
  });

  test("claims mismatch lists every differing field", () => {
    const token = signQuote(quote, params, vas);
    const { claims } = verifyQuoteToken(token);

    expect(() =>
      assertClaimsMatchPayload(claims, {
        partnerId: "partner-1",
        fromPincode: "400001",
        toPincode: "410210",
        weight: 5,
        paymentType: "COD",
        codAmount: 9000, // tampered
        shipmentType: "B2C",
        vasSelections: vas,
      }),
    ).toThrow(/codAmount/);

    expect(() =>
      assertClaimsMatchPayload(claims, {
        partnerId: "partner-1",
        fromPincode: "400001",
        toPincode: "410210",
        weight: 5,
        paymentType: "COD",
        codAmount: 3000,
        shipmentType: "B2C",
        vasSelections: [{ chargeCode: "PACKING", answer: "WOODEN_BOX" }], // changed VAS
      }),
    ).toThrow(/vasSelections/);
  });

  test("matching payload passes", () => {
    const token = signQuote(quote, params, vas);
    const { claims } = verifyQuoteToken(token);
    expect(() =>
      assertClaimsMatchPayload(claims, {
        partnerId: "partner-1",
        fromPincode: "400001",
        toPincode: "410210",
        weight: 5,
        paymentType: "COD",
        codAmount: 3000,
        shipmentType: "B2C",
        vasSelections: vas,
      }),
    ).not.toThrow();
  });

  test("vasHash is order-insensitive", () => {
    const a = hashVasSelections([
      { chargeCode: "A", answer: 1 },
      { chargeCode: "B", answer: 2 },
    ]);
    const b = hashVasSelections([
      { chargeCode: "B", answer: 2 },
      { chargeCode: "A", answer: 1 },
    ]);
    expect(a).toBe(b);
    expect(hashVasSelections([])).toBe("none");
  });
});
