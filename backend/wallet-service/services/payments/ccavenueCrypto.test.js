/* eslint-env jest */

/**
 * Known-answer vectors pinning the CCAvenue codec.
 *
 * Every assertion here guards a SILENT failure mode — a mistake that produces
 * locally-healthy output which CCAvenue simply cannot process, with no useful
 * error anywhere. These are regression locks, not coverage filler.
 */

// `shared/` is bind-mounted into the container at runtime and does not exist in
// the repo tree, so the error class is mocked virtually — same convention as
// backend/shipment-service/services/shipmentWalletService.test.js.
jest.mock(
  "../../shared/lib/errors",
  () => {
    class APIError extends Error {
      constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.name = "APIError";
        this.statusCode = statusCode;
        this.code = code;
      }
    }
    return { APIError };
  },
  { virtual: true },
);

const crypto = require("crypto");

const {
  CCAVENUE_IV,
  SENSITIVE_RESPONSE_FIELDS,
  deriveKey,
  encryptToHex,
  decryptFromHex,
  parseParamString,
  buildParamString,
  formatAmount,
  parseAmountToPaise,
  scrubSensitiveFields,
  isHex,
} = require("./ccavenueCrypto");

const WORKING_KEY = "testkey";
const OTHER_KEY = "someotherworkingkey";

describe("CCAVENUE_IV", () => {
  it("is the fixed 16-byte sequence 0x00..0x0f (protocol constant)", () => {
    expect(Buffer.isBuffer(CCAVENUE_IV)).toBe(true);
    expect(CCAVENUE_IV.length).toBe(16);
    expect(CCAVENUE_IV.toString("hex")).toBe(
      "000102030405060708090a0b0c0d0e0f",
    );
  });
});

describe("deriveKey", () => {
  it("returns the RAW 16-byte MD5 digest of the working key", () => {
    const derived = deriveKey(WORKING_KEY);
    const expected = crypto.createHash("md5").update(WORKING_KEY).digest();

    expect(Buffer.isBuffer(derived)).toBe(true);
    expect(derived.length).toBe(16);
    expect(derived.equals(expected)).toBe(true);
  });

  it("is NOT the utf8 bytes of the 32-char md5 hex string", () => {
    // THE classic CCAvenue failure: a hex-string key is 32 bytes, which Node
    // happily accepts as an AES-256 key. Everything round-trips locally and
    // CCAvenue can decrypt none of it.
    const derived = deriveKey(WORKING_KEY);
    const hexStringKey = Buffer.from(
      crypto.createHash("md5").update(WORKING_KEY).digest("hex"),
      "utf8",
    );

    expect(hexStringKey.length).toBe(32);
    expect(derived.length).toBe(16);
    expect(derived.equals(hexStringKey)).toBe(false);
  });

  it("rejects a missing or non-string working key without echoing it", () => {
    expect(() => deriveKey("")).toThrow(
      expect.objectContaining({ code: "PROVIDER_CONFIG_INVALID" }),
    );
    expect(() => deriveKey(undefined)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

describe("encryptToHex / decryptFromHex", () => {
  it("produces lowercase hex", () => {
    const hex = encryptToHex("merchant_id=12345&amount=1499.00", WORKING_KEY);

    expect(isHex(hex)).toBe(true);
    expect(hex).toBe(hex.toLowerCase());
  });

  it("round-trips an ASCII parameter string", () => {
    const plain = "merchant_id=12345&order_id=ORD-1&amount=1499.00";

    expect(decryptFromHex(encryptToHex(plain, WORKING_KEY), WORKING_KEY)).toBe(
      plain,
    );
  });

  it("round-trips a string with '&' and '=' inside a value", () => {
    // The codec itself is byte-transparent; it is buildParamString that refuses
    // to EMIT such a value, because the raw (unencoded) wire format cannot
    // survive it.
    const plain = "billing_name=Smith & Sons&note=a=b";

    expect(decryptFromHex(encryptToHex(plain, WORKING_KEY), WORKING_KEY)).toBe(
      plain,
    );
  });

  it("round-trips unicode", () => {
    const plain = "billing_name=सायन&city=बेंगलुरु&emoji=🚚";

    expect(decryptFromHex(encryptToHex(plain, WORKING_KEY), WORKING_KEY)).toBe(
      plain,
    );
  });

  it("is deterministic across calls", () => {
    // A PROTOCOL property, not a security property: CCAvenue mandates a fixed
    // IV, so identical plaintext always yields identical ciphertext. Asserted
    // here so nobody "hardens" it with a random IV and silently breaks the
    // gateway.
    const plain = "merchant_id=12345&amount=1499.00";

    expect(encryptToHex(plain, WORKING_KEY)).toBe(
      encryptToHex(plain, WORKING_KEY),
    );
  });

  it("throws when decrypting with the wrong key", () => {
    const hex = encryptToHex("merchant_id=12345&amount=1499.00", WORKING_KEY);

    // A throw is the authenticity signal: only CCAvenue and we hold the key.
    expect(() => decryptFromHex(hex, OTHER_KEY)).toThrow(
      expect.objectContaining({ code: "PROVIDER_RESPONSE_UNDECRYPTABLE" }),
    );
  });

  it("throws on non-hex input", () => {
    expect(() => decryptFromHex("not-hex!!", WORKING_KEY)).toThrow(
      expect.objectContaining({ code: "PROVIDER_RESPONSE_INVALID" }),
    );
  });

  it("never leaks key material or ciphertext in the error message", () => {
    const hex = encryptToHex("amount=1499.00", WORKING_KEY);

    try {
      decryptFromHex(hex, OTHER_KEY);
      throw new Error("expected decryptFromHex to throw");
    } catch (error) {
      expect(error.message).not.toContain(WORKING_KEY);
      expect(error.message).not.toContain(OTHER_KEY);
      expect(error.message).not.toContain(hex);
    }
  });
});

describe("parseParamString", () => {
  it("parses a simple parameter string", () => {
    expect(parseParamString("a=1&b=2")).toEqual({ a: "1", b: "2" });
  });

  it("keeps the last value on duplicate keys", () => {
    expect(parseParamString("a=1&a=2")).toEqual({ a: "2" });
  });

  it("tolerates empty segments and splits on the first '=' only", () => {
    expect(parseParamString("&a=1&&b=x=y&")).toEqual({ a: "1", b: "x=y" });
  });

  it("never throws on garbage and returns {} for unusable input", () => {
    expect(parseParamString("")).toEqual({});
    expect(parseParamString(null)).toEqual({});
    expect(parseParamString(undefined)).toEqual({});
    expect(parseParamString(12345)).toEqual({});
    expect(parseParamString({})).toEqual({});
    expect(parseParamString("garbage-with-no-separators")).toEqual({});
    expect(parseParamString("=novalue&&&===")).toEqual({});
  });
});

describe("buildParamString", () => {
  it("builds a raw, unencoded parameter string", () => {
    expect(buildParamString({ a: "1", b: "2" })).toBe("a=1&b=2");
  });

  it("does not url-encode values (raw wire format)", () => {
    expect(
      buildParamString({ billing_name: "Smith Sons", city: "New Delhi" }),
    ).toBe("billing_name=Smith Sons&city=New Delhi");
  });

  it("skips null and undefined values", () => {
    expect(buildParamString({ a: "1", b: null, c: undefined, d: "4" })).toBe(
      "a=1&d=4",
    );
  });

  it("rejects a value containing '&'", () => {
    expect(() => buildParamString({ billing_name: "Smith & Sons" })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: "PROVIDER_REQUEST_INVALID",
      }),
    );
  });

  it("rejects a value containing '='", () => {
    expect(() => buildParamString({ note: "a=b" })).toThrow(
      expect.objectContaining({ code: "PROVIDER_REQUEST_INVALID" }),
    );
  });

  it("names the key but never the value in the rejection message", () => {
    try {
      buildParamString({ billing_name: "Smith & Sons" });
      throw new Error("expected buildParamString to throw");
    } catch (error) {
      expect(error.message).toContain("billing_name");
      expect(error.message).not.toContain("Smith & Sons");
    }
  });

  it("rejects non-object input", () => {
    expect(() => buildParamString(null)).toThrow(
      expect.objectContaining({ code: "PROVIDER_REQUEST_INVALID" }),
    );
    expect(() => buildParamString(["a=1"])).toThrow(
      expect.objectContaining({ code: "PROVIDER_REQUEST_INVALID" }),
    );
  });

  it("round-trips through parseParamString", () => {
    const fields = { merchant_id: "12345", amount: "1499.00", currency: "INR" };

    expect(parseParamString(buildParamString(fields))).toEqual(fields);
  });
});

describe("formatAmount", () => {
  it("formats integer paise as a two-decimal rupee string", () => {
    expect(formatAmount(149900)).toBe("1499.00");
    expect(formatAmount(100)).toBe("1.00");
    expect(formatAmount(1)).toBe("0.01");
    expect(formatAmount(149999)).toBe("1499.99");
  });

  it("throws on a non-integer amount", () => {
    expect(() => formatAmount(1499.5)).toThrow(
      expect.objectContaining({ statusCode: 400, code: "INVALID_AMOUNT" }),
    );
  });

  it("throws on zero and negative amounts", () => {
    expect(() => formatAmount(0)).toThrow(
      expect.objectContaining({ code: "INVALID_AMOUNT" }),
    );
    expect(() => formatAmount(-100)).toThrow(
      expect.objectContaining({ code: "INVALID_AMOUNT" }),
    );
  });

  it("throws on non-numeric input", () => {
    expect(() => formatAmount("1499")).toThrow(
      expect.objectContaining({ code: "INVALID_AMOUNT" }),
    );
    expect(() => formatAmount(NaN)).toThrow(
      expect.objectContaining({ code: "INVALID_AMOUNT" }),
    );
  });
});

describe("parseAmountToPaise", () => {
  it("parses two-decimal and bare rupee strings", () => {
    expect(parseAmountToPaise("1499.00")).toBe(149900);
    expect(parseAmountToPaise("1499")).toBe(149900);
    expect(parseAmountToPaise("1499.5")).toBe(149950);
    expect(parseAmountToPaise("0.01")).toBe(1);
    expect(parseAmountToPaise(" 1499.00 ")).toBe(149900);
  });

  it("stays paise-exact where parseFloat would not", () => {
    // parseFloat("1499.99") * 100 === 149998.99999999999
    expect(parseAmountToPaise("1499.99")).toBe(149999);
  });

  it("returns null rather than throwing for unusable input", () => {
    // The webhook path must be able to PARK a bad order, not crash.
    expect(parseAmountToPaise("abc")).toBeNull();
    expect(parseAmountToPaise("-5")).toBeNull();
    expect(parseAmountToPaise("")).toBeNull();
    expect(parseAmountToPaise(null)).toBeNull();
    expect(parseAmountToPaise(undefined)).toBeNull();
    expect(parseAmountToPaise({})).toBeNull();
    expect(parseAmountToPaise(NaN)).toBeNull();
    expect(parseAmountToPaise(Infinity)).toBeNull();
    expect(parseAmountToPaise("1,499.00")).toBeNull();
    expect(parseAmountToPaise("1499.999")).toBeNull(); // cannot invent paise
  });

  it("round-trips with formatAmount", () => {
    for (const paise of [1, 100, 149900, 149999, 1]) {
      expect(parseAmountToPaise(formatAmount(paise))).toBe(paise);
    }
  });
});

describe("scrubSensitiveFields", () => {
  it("drops card_number entirely and keeps order_status", () => {
    const scrubbed = scrubSensitiveFields({
      order_status: "Success",
      card_number: "4111XXXXXXXX1111",
    });

    expect(scrubbed.order_status).toBe("Success");
    expect("card_number" in scrubbed).toBe(false); // dropped, not masked
  });

  it("drops every listed sensitive field, case-insensitively", () => {
    const payload = { order_status: "Success" };
    for (const field of SENSITIVE_RESPONSE_FIELDS) {
      payload[field.toUpperCase()] = "secret";
    }

    expect(scrubSensitiveFields(payload)).toEqual({ order_status: "Success" });
  });

  it("passes unknown keys through (we cannot enumerate an unseen payload)", () => {
    const scrubbed = scrubSensitiveFields({
      some_future_field: "value",
      tracking_id: "TID-1",
    });

    expect(scrubbed).toEqual({
      some_future_field: "value",
      tracking_id: "TID-1",
    });
  });

  it("does not mutate the input", () => {
    const input = { order_status: "Success", card_number: "4111" };
    scrubSensitiveFields(input);

    expect(input.card_number).toBe("4111");
  });

  it("returns {} for non-object input", () => {
    expect(scrubSensitiveFields(null)).toEqual({});
    expect(scrubSensitiveFields("string")).toEqual({});
    expect(scrubSensitiveFields([1, 2])).toEqual({});
  });
});

describe("isHex", () => {
  it("accepts even-length hex in either case", () => {
    expect(isHex("00ff")).toBe(true);
    expect(isHex("00FF")).toBe(true);
  });

  it("rejects odd length, empty, non-hex and non-strings", () => {
    expect(isHex("abc")).toBe(false);
    expect(isHex("")).toBe(false);
    expect(isHex("zz")).toBe(false);
    expect(isHex(null)).toBe(false);
    expect(isHex(1234)).toBe(false);
  });
});
