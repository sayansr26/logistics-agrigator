/* eslint-env jest */

/**
 * Unit tests for the CCAvenue provider.
 *
 * Every assertion here guards a MONEY bug: a non-deterministic dedupe key
 * double-credits, a thrown parse crashes into a retry storm, ciphertext in
 * `raw` leaks the envelope into the database, and a `verifyClientSignature`
 * that accepts a replayed envelope credits someone else's payment.
 *
 * `shared/` is bind-mounted into the container and does not exist in the repo
 * tree, so the logger and error class are mocked virtually (same convention as
 * ccavenueCrypto.test.js). axios is mocked outright — no real HTTP.
 */

jest.mock(
  "../../shared/lib/logger",
  () => ({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
  { virtual: true },
);

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

jest.mock("axios", () => ({ post: jest.fn() }));

const axios = require("axios");
const logger = require("../../shared/lib/logger");
const {
  encryptToHex,
  decryptFromHex,
  parseParamString,
  buildParamString,
} = require("./ccavenueCrypto");
const provider = require("./ccavenueProvider");

const WORKING_KEY = "test-working-key";
const OTHER_KEY = "a-completely-different-working-key";

const CONFIG = Object.freeze({
  provider: "ccavenue",
  mode: "TEST",
  keyId: "ACCESS123",
  keySecret: WORKING_KEY,
  webhookSecret: WORKING_KEY,
  credentials: {
    merchantId: "M12345",
    accessCode: "ACCESS123",
    workingKey: WORKING_KEY,
  },
  currency: "INR",
  isTest: true,
});

const NOTES = Object.freeze({
  walletUserId: "+919999999999",
  clientCode: "DEFAULT",
  subjectUserId: "33333333-3333-4333-8333-333333333333",
  kind: "TOPUP",
});

/** Encrypt a flat field map the way CCAvenue would. */
function envelope(fields, key = WORKING_KEY) {
  return encryptToHex(buildParamString(fields), key);
}

const SUCCESS_FIELDS = Object.freeze({
  order_id: "TOPUP-ABC-123",
  tracking_id: "3040071234",
  bank_ref_no: "REF999",
  order_status: "Success",
  amount: "1499.00",
  currency: "INR",
  trans_date: "10/03/2023 18:20:45",
  merchant_param1: NOTES.walletUserId,
  merchant_param2: NOTES.clientCode,
  merchant_param3: NOTES.subjectUserId,
  merchant_param4: NOTES.kind,
});

beforeEach(() => {
  jest.clearAllMocks();
});

/* ------------------------------------------------------------------ */

describe("contract surface", () => {
  it("exports name ccavenue and orders-only capabilities", () => {
    expect(provider.name).toBe("ccavenue");
    expect(provider.supports).toEqual({
      orders: true,
      paymentLinks: false,
      refunds: false,
    });
  });

  it("exposes every function the registry contract requires", () => {
    const required = [
      "createOrder",
      "createPaymentLink",
      "cancelPaymentLink",
      "verifyClientSignature",
      "verifyWebhookSignature",
      "parseWebhookEvent",
      "fetchPayment",
      "fetchOrder",
      "fetchPaymentLink",
      "testConnection",
    ];
    for (const fn of required) {
      expect(typeof provider[fn]).toBe("function");
    }
    expect(typeof provider.decryptEnvelope).toBe("function");
    expect(typeof provider.extractNotes).toBe("function");
    expect(typeof provider.resetInstanceCache).toBe("function");
    expect(provider.resetInstanceCache()).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */

describe("createOrder", () => {
  it("produces an encRequest that decrypts back to the expected parameters", async () => {
    const order = await provider.createOrder({
      config: CONFIG,
      amountPaise: 149900,
      currency: "INR",
      receipt: "topup-abc-123",
      notes: NOTES,
      returnUrl: "https://portal.example.com/wallet/return",
      cancelUrl: "https://portal.example.com/wallet/cancel",
    });

    const plain = decryptFromHex(order.redirect.fields.encRequest, WORKING_KEY);
    const fields = parseParamString(plain);

    expect(fields).toMatchObject({
      merchant_id: "M12345",
      order_id: "TOPUP-ABC-123",
      currency: "INR",
      amount: "1499.00",
      redirect_url: "https://portal.example.com/wallet/return",
      cancel_url: "https://portal.example.com/wallet/cancel",
      language: "EN",
    });
  });

  it("honours providerOrderId so a replayed order rebuilds the SAME order_id", async () => {
    // topupService.deriveRedirect rebuilds the redirect form for an order that
    // already exists. Both the return handler and the webhook find the order by
    // providerOrderId, so a re-mint under a fresh id would strand the payment.
    const first = await provider.createOrder({
      config: CONFIG,
      amountPaise: 149900,
      receipt: "topup-abc-123",
      notes: NOTES,
      returnUrl: "https://portal.example.com/return",
    });

    const replay = await provider.createOrder({
      config: CONFIG,
      amountPaise: 149900,
      receipt: "something-completely-different",
      providerOrderId: first.providerOrderId,
      notes: NOTES,
      returnUrl: "https://portal.example.com/return",
    });

    expect(replay.providerOrderId).toBe(first.providerOrderId);
    const fields = parseParamString(
      decryptFromHex(replay.redirect.fields.encRequest, WORKING_KEY),
    );
    expect(fields.order_id).toBe(first.providerOrderId);
  });

  it("maps the four load-bearing notes onto merchant_param1..4, one per param", async () => {
    const order = await provider.createOrder({
      config: CONFIG,
      amountPaise: 149900,
      receipt: "topup-abc-123",
      notes: NOTES,
      returnUrl: "https://portal.example.com/return",
    });

    const fields = parseParamString(
      decryptFromHex(order.redirect.fields.encRequest, WORKING_KEY),
    );

    expect(fields.merchant_param1).toBe(NOTES.walletUserId);
    expect(fields.merchant_param2).toBe(NOTES.clientCode);
    expect(fields.merchant_param3).toBe(NOTES.subjectUserId);
    expect(fields.merchant_param4).toBe(NOTES.kind);
    // Never a JSON blob crammed into one slot.
    expect(fields.merchant_param1).not.toMatch(/[{}"]/);
  });

  it("returns the redirect envelope and public checkout params only", async () => {
    const order = await provider.createOrder({
      config: CONFIG,
      amountPaise: 149900,
      receipt: "topup-abc-123",
      notes: NOTES,
      returnUrl: "https://portal.example.com/return",
    });

    expect(order.providerOrderId).toBe("TOPUP-ABC-123");
    expect(order.amountPaise).toBe(149900);
    expect(order.currency).toBe("INR");
    expect(order.status).toBe("CREATED");
    expect(order.checkoutParams).toEqual({
      key: "ACCESS123",
      order_id: "TOPUP-ABC-123",
      amount: 149900,
      currency: "INR",
    });
    expect(order.redirect.method).toBe("POST");
    expect(order.redirect.url).toBe(
      "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction",
    );
    expect(order.redirect.fields.access_code).toBe("ACCESS123");
  });

  it("uses the LIVE transaction host when isTest is false (never NODE_ENV)", async () => {
    const order = await provider.createOrder({
      config: { ...CONFIG, isTest: false },
      amountPaise: 100,
      receipt: "live-1",
      returnUrl: "https://portal.example.com/return",
    });

    expect(order.redirect.url).toBe(
      "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction",
    );
  });

  it("never puts ciphertext or the working key into `raw` (raw is persisted)", async () => {
    const order = await provider.createOrder({
      config: CONFIG,
      amountPaise: 149900,
      receipt: "topup-abc-123",
      notes: NOTES,
      returnUrl: "https://portal.example.com/return",
    });

    const serialised = JSON.stringify(order.raw);
    expect(serialised).not.toContain(order.redirect.fields.encRequest);
    expect(serialised).not.toContain(WORKING_KEY);
    expect(Object.keys(order.raw).sort()).toEqual([
      "amount",
      "currency",
      "merchant_param1",
      "merchant_param2",
      "merchant_param3",
      "merchant_param4",
      "order_id",
    ]);
  });

  it("sanitises the receipt into an uppercase [A-Z0-9-] order_id capped at 30 chars", async () => {
    const order = await provider.createOrder({
      config: CONFIG,
      amountPaise: 100,
      receipt: "topup_abc/123 xyz-0123456789012345678901234567890",
      returnUrl: "https://portal.example.com/return",
    });

    expect(order.providerOrderId).toMatch(/^[A-Z0-9-]+$/);
    expect(order.providerOrderId.length).toBeLessThanOrEqual(30);
  });

  it("rejects a non-integer / zero amount rather than sending a mangled rupee string", async () => {
    await expect(
      provider.createOrder({
        config: CONFIG,
        amountPaise: 1499.5,
        receipt: "topup-1",
        returnUrl: "https://portal.example.com/return",
      }),
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });

  it("refuses to build an order when credentials are incomplete", async () => {
    await expect(
      provider.createOrder({
        config: {
          ...CONFIG,
          credentials: { merchantId: "M1" },
          keyId: null,
          keySecret: null,
          webhookSecret: null,
        },
        amountPaise: 100,
        receipt: "topup-1",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_CONFIG_INVALID" });
  });
});

/* ------------------------------------------------------------------ */

describe("extractNotes", () => {
  it("round-trips exactly what createOrder sent", async () => {
    const order = await provider.createOrder({
      config: CONFIG,
      amountPaise: 149900,
      receipt: "topup-abc-123",
      notes: NOTES,
      returnUrl: "https://portal.example.com/return",
    });

    const fromRaw = provider.extractNotes(order.raw);
    expect(fromRaw).toEqual(NOTES);

    // ...and via the wire: decrypt the envelope and read it back.
    const wireFields = parseParamString(
      decryptFromHex(order.redirect.fields.encRequest, WORKING_KEY),
    );
    expect(provider.extractNotes(wireFields)).toEqual(NOTES);
  });

  it("returns nulls (never throws) for a payload with no merchant params", () => {
    expect(provider.extractNotes(null)).toEqual({
      walletUserId: null,
      clientCode: null,
      subjectUserId: null,
      kind: null,
    });
    expect(
      provider.extractNotes({ merchant_param1: "   " }).walletUserId,
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("payment links are refused", () => {
  const cases = ["createPaymentLink", "cancelPaymentLink", "fetchPaymentLink"];

  it.each(cases)("%s throws PROVIDER_NOT_SUPPORTED", async (fn) => {
    await expect(provider[fn]({ config: CONFIG })).rejects.toMatchObject({
      statusCode: 400,
      code: "PROVIDER_NOT_SUPPORTED",
    });
  });
});

/* ------------------------------------------------------------------ */

describe("verifyClientSignature", () => {
  it("accepts an envelope that decrypts and carries a matching order_id", () => {
    const encResp = envelope(SUCCESS_FIELDS);
    expect(
      provider.verifyClientSignature({
        config: CONFIG,
        payload: { encResp, orderId: "TOPUP-ABC-123" },
      }),
    ).toBe(true);
  });

  it("accepts without an expected order id, provided order_id is present", () => {
    expect(
      provider.verifyClientSignature({
        config: CONFIG,
        payload: { encResp: envelope(SUCCESS_FIELDS) },
      }),
    ).toBe(true);
  });

  it("is FALSE when the envelope was encrypted with a different working key", () => {
    const encResp = envelope(SUCCESS_FIELDS, OTHER_KEY);
    expect(
      provider.verifyClientSignature({
        config: CONFIG,
        payload: { encResp, orderId: "TOPUP-ABC-123" },
      }),
    ).toBe(false);
  });

  it("is FALSE when the decrypted order_id is a DIFFERENT order (replay)", () => {
    const encResp = envelope(SUCCESS_FIELDS);
    expect(
      provider.verifyClientSignature({
        config: CONFIG,
        payload: { encResp, orderId: "TOPUP-SOMEONE-ELSE" },
      }),
    ).toBe(false);
  });

  it("is FALSE when the decrypted payload has no order_id at all", () => {
    const encResp = envelope({ order_status: "Success", amount: "10.00" });
    expect(
      provider.verifyClientSignature({ config: CONFIG, payload: { encResp } }),
    ).toBe(false);
  });

  it("never throws on garbage input", () => {
    const garbage = [
      undefined,
      {},
      { config: CONFIG },
      { config: CONFIG, payload: null },
      { config: CONFIG, payload: { encResp: "not-hex" } },
      { config: CONFIG, payload: { encResp: "abcd" } },
      { config: null, payload: { encResp: envelope(SUCCESS_FIELDS) } },
    ];
    for (const input of garbage) {
      expect(() => provider.verifyClientSignature(input)).not.toThrow();
      expect(provider.verifyClientSignature(input)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("verifyWebhookSignature", () => {
  it("accepts a JSON body whose enc_response decrypts with the working key", () => {
    const rawBody = Buffer.from(
      JSON.stringify({ enc_response: envelope(SUCCESS_FIELDS) }),
      "utf8",
    );
    expect(
      provider.verifyWebhookSignature({ config: CONFIG, rawBody, headers: {} }),
    ).toBe(true);
  });

  it("accepts a form-encoded body carrying encResp", () => {
    const rawBody = `encResp=${envelope(SUCCESS_FIELDS)}`;
    expect(
      provider.verifyWebhookSignature({ config: CONFIG, rawBody, headers: {} }),
    ).toBe(true);
  });

  it("FAILS CLOSED when the envelope was encrypted with another key", () => {
    const rawBody = `enc_response=${envelope(SUCCESS_FIELDS, OTHER_KEY)}`;
    expect(
      provider.verifyWebhookSignature({ config: CONFIG, rawBody, headers: {} }),
    ).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "CCAvenue webhook could not be authenticated — payload shape unrecognised",
      expect.objectContaining({ keys: expect.any(Array) }),
    );
  });

  it("FAILS CLOSED on an unrecognised payload shape and logs the keys", () => {
    const rawBody = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
    expect(
      provider.verifyWebhookSignature({ config: CONFIG, rawBody, headers: {} }),
    ).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("could not be authenticated"),
      { keys: ["hello"] },
    );
  });

  it("never falls back to a parsedBody it was not given raw bytes for", () => {
    expect(
      provider.verifyWebhookSignature({
        config: CONFIG,
        rawBody: null,
        headers: {},
      }),
    ).toBe(false);
  });

  it("accepts a matching x-ccavenue-signature HMAC (dormant strategy)", () => {
    const crypto = require("crypto");
    const rawBody = JSON.stringify({ order_status: "Success" });
    const signature = crypto
      .createHmac("sha256", WORKING_KEY)
      .update(rawBody)
      .digest("hex");

    expect(
      provider.verifyWebhookSignature({
        config: CONFIG,
        rawBody,
        headers: { "x-ccavenue-signature": signature },
      }),
    ).toBe(true);
  });

  it("rejects a present-but-wrong x-ccavenue-signature", () => {
    expect(
      provider.verifyWebhookSignature({
        config: CONFIG,
        rawBody: JSON.stringify({ order_status: "Success" }),
        headers: { "x-ccavenue-signature": "00".repeat(32) },
      }),
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe("decryptEnvelope", () => {
  it("decrypts a JSON webhook body into flat fields", () => {
    const rawBody = JSON.stringify({ enc_response: envelope(SUCCESS_FIELDS) });
    const result = provider.decryptEnvelope({ config: CONFIG, rawBody });

    expect(result.ok).toBe(true);
    expect(result.source).toBe("webhook");
    expect(result.fields.order_id).toBe("TOPUP-ABC-123");
  });

  it("returns {ok:false, fields:null} for a wrong key, and never throws", () => {
    const rawBody = `enc_response=${envelope(SUCCESS_FIELDS, OTHER_KEY)}`;
    expect(provider.decryptEnvelope({ config: CONFIG, rawBody })).toEqual({
      ok: false,
      fields: null,
      source: "webhook",
    });
  });

  it("returns {ok:false} for garbage input", () => {
    const inputs = [
      undefined,
      {},
      { config: CONFIG },
      { config: CONFIG, rawBody: "" },
      { config: CONFIG, rawBody: "<html>oops</html>" },
      { config: null, rawBody: "enc_response=aabb" },
    ];
    for (const input of inputs) {
      expect(() => provider.decryptEnvelope(input)).not.toThrow();
      expect(provider.decryptEnvelope(input).ok).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("parseWebhookEvent — order_status outcome table", () => {
  const table = [
    ["Success", "PAID"],
    ["Failure", "FAILED"],
    ["Aborted", "FAILED"],
    ["Invalid", "FAILED"],
    ["Timeout", "FAILED"],
    ["Initiated", "IGNORED"],
    ["Awaited", "IGNORED"],
    ["Teleported", "IGNORED"], // unknown -> fail-safe
  ];

  it.each(table)("maps order_status %s -> %s", (status, expected) => {
    const decrypted = {
      ok: true,
      fields: { ...SUCCESS_FIELDS, order_status: status },
      source: "webhook",
    };
    const event = provider.parseWebhookEvent({ decrypted });

    expect(event.outcome).toBe(expected);
    // Even an unknown status keeps an eventType so it can be triaged.
    expect(event.eventType).toBe(
      `ccavenue.order_status.${status.toLowerCase()}`,
    );
  });

  it("is case-insensitive on the status value", () => {
    const event = provider.parseWebhookEvent({
      decrypted: {
        ok: true,
        fields: { ...SUCCESS_FIELDS, order_status: "SUCCESS" },
      },
    });
    expect(event.outcome).toBe("PAID");
  });

  it("exports the outcome tables for the webhook service", () => {
    expect(provider.OUTCOME.PAID).toBe("PAID");
    expect(provider.ORDER_STATUS_OUTCOMES.success).toBe("PAID");
    expect(provider.ORDER_STATUS_OUTCOMES.aborted).toBe("FAILED");
  });
});

describe("parseWebhookEvent — normalised event", () => {
  it("emits exactly the contract shape", () => {
    const event = provider.parseWebhookEvent({
      decrypted: { ok: true, fields: SUCCESS_FIELDS, source: "webhook" },
    });

    expect(Object.keys(event).sort()).toEqual(
      [
        "amountPaise",
        "capturedAt",
        "currency",
        "errorCode",
        "errorDescription",
        "eventType",
        "outcome",
        "providerEventId",
        "providerLinkId",
        "providerOrderId",
        "providerPaymentId",
        "raw",
      ].sort(),
    );

    expect(event.providerOrderId).toBe("TOPUP-ABC-123");
    expect(event.providerPaymentId).toBe("3040071234");
    expect(event.providerLinkId).toBeNull();
    expect(event.amountPaise).toBe(149900);
    expect(event.currency).toBe("INR");
    expect(event.capturedAt).toBe("2023-03-10T18:20:45.000Z");
  });

  it("prefers tracking_id, falling back to reference_no, for providerPaymentId", () => {
    const fields = { ...SUCCESS_FIELDS };
    delete fields.tracking_id;
    fields.reference_no = "REF-777";

    const event = provider.parseWebhookEvent({
      decrypted: { ok: true, fields },
    });
    expect(event.providerPaymentId).toBe("REF-777");
  });

  it("yields amountPaise null for a non-finite / malformed amount", () => {
    for (const amount of ["NaN", "abc", "", "-10.00", "1499.999", undefined]) {
      const event = provider.parseWebhookEvent({
        decrypted: { ok: true, fields: { ...SUCCESS_FIELDS, amount } },
      });
      expect(event.amountPaise).toBeNull();
    }
  });

  it("puts the DECRYPTED, scrubbed fields in raw — never the hex", () => {
    const hex = envelope(SUCCESS_FIELDS);
    const event = provider.parseWebhookEvent({
      decrypted: {
        ok: true,
        fields: { ...SUCCESS_FIELDS, card_number: "4111111111111111" },
      },
      rawBody: `enc_response=${hex}`,
    });

    const serialised = JSON.stringify(event.raw);
    expect(serialised).not.toContain(hex);
    expect(serialised).not.toContain(WORKING_KEY);
    expect(event.raw.card_number).toBeUndefined(); // scrubbed
    expect(event.raw.order_id).toBe("TOPUP-ABC-123");
  });
});

describe("parseWebhookEvent — providerEventId determinism", () => {
  it("returns the SAME id for the same payload twice (replay dedupe)", () => {
    const decrypted = { ok: true, fields: SUCCESS_FIELDS };
    const first = provider.parseWebhookEvent({ decrypted }).providerEventId;
    const second = provider.parseWebhookEvent({ decrypted }).providerEventId;

    expect(first).toBe("ccav_wh:3040071234:success");
    expect(second).toBe(first);
  });

  it("is not time- or random-based", () => {
    const decrypted = { ok: true, fields: SUCCESS_FIELDS };
    const a = provider.parseWebhookEvent({ decrypted }).providerEventId;
    const later = new Date(Date.now() + 86400000);
    const spy = jest.spyOn(Date, "now").mockReturnValue(later.getTime());
    const b = provider.parseWebhookEvent({ decrypted }).providerEventId;
    spy.mockRestore();

    expect(b).toBe(a);
  });

  it("differs when the status differs (a real lifecycle transition)", () => {
    const paid = provider.parseWebhookEvent({
      decrypted: { ok: true, fields: SUCCESS_FIELDS },
    }).providerEventId;
    const failed = provider.parseWebhookEvent({
      decrypted: {
        ok: true,
        fields: { ...SUCCESS_FIELDS, order_status: "Failure" },
      },
    }).providerEventId;

    expect(failed).not.toBe(paid);
    expect(failed).toBe("ccav_wh:3040071234:failure");
  });

  it("falls back to order_id when there is no tracking/reference id", () => {
    const fields = { ...SUCCESS_FIELDS };
    delete fields.tracking_id;

    expect(
      provider.parseWebhookEvent({ decrypted: { ok: true, fields } })
        .providerEventId,
    ).toBe("ccav_wh:TOPUP-ABC-123:success");
  });

  it("is null when nothing identifies the payment", () => {
    expect(
      provider.parseWebhookEvent({
        decrypted: { ok: true, fields: { order_status: "Success" } },
      }).providerEventId,
    ).toBeNull();
  });
});

describe("parseWebhookEvent — never throws", () => {
  const garbage = [
    undefined,
    {},
    { decrypted: null },
    { decrypted: { ok: false, fields: null } },
    { decrypted: { ok: true, fields: null } },
    { decrypted: { ok: true, fields: "nope" } },
    { rawBody: Buffer.from("<html>502 Bad Gateway</html>") },
    { rawBody: null, parsedBody: { enc_response: "zzzz" } },
    { decrypted: { ok: true, fields: {} } },
  ];

  it.each(garbage.map((g, i) => [i, g]))(
    "case %i does not throw and yields a valid event shape",
    (_i, input) => {
      let event;
      expect(() => {
        event = provider.parseWebhookEvent(input);
      }).not.toThrow();
      expect(event.outcome).toBe("IGNORED");
      expect(event).toHaveProperty("providerEventId");
      expect(event).toHaveProperty("raw");
    },
  );

  it("returns the fully-nulled IGNORED shape when `decrypted` is absent — it never guesses at ciphertext", () => {
    const event = provider.parseWebhookEvent({
      rawBody: `enc_response=${envelope(SUCCESS_FIELDS)}`,
    });

    expect(event).toEqual({
      providerEventId: null,
      eventType: null,
      outcome: "IGNORED",
      providerOrderId: null,
      providerLinkId: null,
      providerPaymentId: null,
      amountPaise: null,
      currency: null,
      capturedAt: null,
      errorCode: null,
      errorDescription: null,
      raw: null,
    });
  });
});

/* ------------------------------------------------------------------ */

/** Build a fake DoWebTrans response carrying an encrypted JSON payload. */
function webTransResponse(payload, key = WORKING_KEY, status = 200) {
  const enc = encryptToHex(JSON.stringify(payload), key);
  return { status, data: `status=0&enc_response=${enc}` };
}

describe("fetchOrder", () => {
  it("posts the orderStatusTracker command to the TEST api host", async () => {
    axios.post.mockResolvedValue(
      webTransResponse({
        order_status: "Success",
        order_no: "TOPUP-ABC-123",
        order_id: "TOPUP-ABC-123",
        order_bill_amount: "1499.00",
        currency: "INR",
        order_date_time: "10/03/2023 18:20:45",
      }),
    );

    const order = await provider.fetchOrder({
      config: CONFIG,
      providerOrderId: "TOPUP-ABC-123",
    });

    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toBe("https://apitest.ccavenue.com/apis/servlet/DoWebTrans");
    expect(body).toContain("command=orderStatusTracker");
    expect(body).toContain("access_code=ACCESS123");
    expect(body).toContain("enc_request=");
    expect(options.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );

    // The enc_request round-trips to the order lookup payload.
    const encRequest = new URLSearchParams(body).get("enc_request");
    expect(JSON.parse(decryptFromHex(encRequest, WORKING_KEY))).toEqual({
      order_no: "TOPUP-ABC-123",
    });

    expect(order).toMatchObject({
      providerOrderId: "TOPUP-ABC-123",
      status: "Success",
      amountPaise: 149900,
      amountPaidPaise: 149900,
      amountDuePaise: null,
      currency: "INR",
      createdAt: "2023-03-10T18:20:45.000Z",
    });
  });

  it("maps a gateway auth rejection to 502 (our misconfiguration, not the caller's)", async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: "enc_error_code=Invalid Access Code&error_desc=authentication failed",
    });

    await expect(
      provider.fetchOrder({ config: CONFIG, providerOrderId: "X-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "PROVIDER_REQUEST_FAILED",
    });
  });

  it("wraps an HTTP 401 from the gateway as a 502", async () => {
    axios.post.mockResolvedValue({ status: 401, data: "" });

    await expect(
      provider.fetchOrder({ config: CONFIG, providerOrderId: "X-1" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("wraps a transport failure", async () => {
    axios.post.mockRejectedValue(
      Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }),
    );

    await expect(
      provider.fetchOrder({ config: CONFIG, providerOrderId: "X-1" }),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "PROVIDER_REQUEST_FAILED",
    });
  });

  it("requires a providerOrderId", async () => {
    await expect(provider.fetchOrder({ config: CONFIG })).rejects.toMatchObject(
      {
        code: "INVALID_PROVIDER_REFERENCE",
      },
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */

describe("fetchPayment", () => {
  it("normalises a Success order into Razorpay's captured payment shape", async () => {
    axios.post.mockResolvedValue(
      webTransResponse({
        order_status: "Success",
        order_no: "TOPUP-ABC-123",
        order_id: "TOPUP-ABC-123",
        reference_no: "3040071234",
        order_bill_amount: "1499.00",
        currency: "INR",
        trans_date: "10/03/2023 18:20:45",
      }),
    );

    const payment = await provider.fetchPayment({
      config: CONFIG,
      providerPaymentId: null,
      providerOrderId: "TOPUP-ABC-123",
    });

    // This exact pair is what topupService.pollProvider tests for.
    expect(payment.captured).toBe(true);
    expect(payment.status).toBe("captured");
    expect(payment.providerPaymentId).toBe("3040071234");
    expect(payment.providerOrderId).toBe("TOPUP-ABC-123");
    expect(payment.amountPaise).toBe(149900);
    expect(payment.currency).toBe("INR");
    expect(payment.capturedAt).toBe("2023-03-10T18:20:45.000Z");
  });

  it("does NOT report captured for a non-success order", async () => {
    axios.post.mockResolvedValue(
      webTransResponse({
        order_status: "Aborted",
        order_no: "TOPUP-ABC-123",
        order_bill_amount: "1499.00",
        currency: "INR",
      }),
    );

    const payment = await provider.fetchPayment({
      config: CONFIG,
      providerOrderId: "TOPUP-ABC-123",
    });

    expect(payment.captured).toBe(false);
    expect(payment.status).toBe("aborted");
  });

  it("requires providerOrderId — CCAvenue has no payment-id lookup", async () => {
    await expect(
      provider.fetchPayment({
        config: CONFIG,
        providerPaymentId: "3040071234",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_REFERENCE" });
  });
});

/* ------------------------------------------------------------------ */

describe("testConnection", () => {
  it("treats a decryptable order-not-found as PROOF all three credentials are correct", async () => {
    axios.post.mockResolvedValue(
      webTransResponse({ status: 1, error_desc: "No transactions found" }),
    );

    const result = await provider.testConnection({ config: CONFIG });

    expect(result.ok).toBe(true);
    expect(result.accountHint).toBe("M12345");
    expect(typeof result.latencyMs).toBe("number");
    expect(
      new URLSearchParams(axios.post.mock.calls[0][1]).get("command"),
    ).toBe("orderStatusTracker");

    const encRequest = new URLSearchParams(axios.post.mock.calls[0][1]).get(
      "enc_request",
    );
    expect(JSON.parse(decryptFromHex(encRequest, WORKING_KEY)).order_no).toBe(
      "CONNTEST-M12345-0",
    );
  });

  it("reports a working-key failure specifically when the response will not decrypt", async () => {
    axios.post.mockResolvedValue(
      webTransResponse({ status: 1, error_desc: "nope" }, OTHER_KEY),
    );

    const result = await provider.testConnection({ config: CONFIG });

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "Working key rejected — the response could not be decrypted",
    );
    expect(result.accountHint).toBe("M12345");
  });

  it("reports an access-code rejection without throwing", async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: "enc_error_code=Invalid Access Code&error_desc=Invalid Access Code",
    });

    const result = await provider.testConnection({ config: CONFIG });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/access code/i);
  });

  it("never throws on a transport failure or on missing credentials", async () => {
    axios.post.mockRejectedValue(new Error("boom"));
    await expect(
      provider.testConnection({ config: CONFIG }),
    ).resolves.toMatchObject({ ok: false });

    await expect(provider.testConnection({})).resolves.toMatchObject({
      ok: false,
      accountHint: null,
    });
  });
});
