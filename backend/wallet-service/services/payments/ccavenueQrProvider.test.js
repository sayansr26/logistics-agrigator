/* eslint-env jest */

/**
 * Unit tests for the static-QR provider.
 *
 * `shared/` is bind-mounted into the container and does not exist on the host,
 * so the logger and error requires need `{virtual: true}` (same pattern as
 * qrCollectionService.test.js). `ccavenueCrypto` is used FOR REAL here — the
 * whole point of the verification tests is that a real AES round-trip is what
 * authenticates a delivery.
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
        this.statusCode = statusCode;
        this.code = code;
      }
    }
    class ValidationError extends APIError {
      constructor(message, details = null) {
        super(message, 400, "VALIDATION_ERROR");
        this.details = details;
      }
    }
    return { APIError, ValidationError };
  },
  { virtual: true },
);

const logger = require("../../shared/lib/logger");
const { encryptToHex } = require("./ccavenueCrypto");
const { assertContract } = require("./providerRegistry");
const provider = require("./ccavenueQrProvider");

const WORKING_KEY = "0123456789ABCDEF0123456789ABCDEF";
const OTHER_KEY = "FEDCBA9876543210FEDCBA9876543210";

const configFor = (workingKey, mode = "LIVE") => ({
  provider: "ccavenue_upi_qr",
  mode,
  keyId: "AVTEST",
  keySecret: workingKey,
  webhookSecret: workingKey,
  credentials: {
    merchantId: "123456",
    accessCode: "AVTEST",
    workingKey,
  },
  currency: "INR",
});

const SUCCESS_PARAMS =
  "order_status=Success&bank_ref_no=UTR12345678&tracking_id=TRK999&qr_code_id=QR-ALPHA&payer_vpa=someone@upi&payer_name=Ravi&amount=1234.56&currency=INR&trans_date=01/02/2026 10:30:00";

function encryptedBody(params, key = WORKING_KEY) {
  return { encResp: encryptToHex(params, key) };
}

beforeEach(() => jest.clearAllMocks());

/* ------------------------------------------------------------------ */

describe("contract", () => {
  it("satisfies the PaymentProvider contract", () => {
    expect(() => assertContract(provider)).not.toThrow();
  });

  it("declares itself a collection-only channel", () => {
    expect(provider.name).toBe("ccavenue_upi_qr");
    expect(provider.supports).toEqual({
      orders: false,
      paymentLinks: false,
      refunds: false,
    });
  });
});

describe("unsupported operations", () => {
  const operations = [
    "createOrder",
    "createPaymentLink",
    "cancelPaymentLink",
    "fetchPayment",
    "fetchOrder",
    "fetchPaymentLink",
  ];

  it.each(operations)(
    "%s throws PROVIDER_OPERATION_UNSUPPORTED",
    async (op) => {
      await expect(
        provider[op]({ config: configFor(WORKING_KEY) }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "PROVIDER_OPERATION_UNSUPPORTED",
      });
    },
  );

  it("verifyClientSignature fails closed rather than throwing", () => {
    expect(
      provider.verifyClientSignature({ config: configFor(WORKING_KEY) }),
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a body that decrypts under this mode's working key", () => {
    expect(
      provider.verifyWebhookSignature({
        config: configFor(WORKING_KEY),
        parsedBody: encryptedBody(SUCCESS_PARAMS),
      }),
    ).toBe(true);
  });

  it("accepts the envelope arriving as a form-urlencoded raw body", () => {
    const raw = Buffer.from(
      `encResp=${encryptToHex(SUCCESS_PARAMS, WORKING_KEY)}`,
      "utf8",
    );
    expect(
      provider.verifyWebhookSignature({
        config: configFor(WORKING_KEY),
        rawBody: raw,
      }),
    ).toBe(true);
  });

  it("rejects a body encrypted under the OTHER mode's key", () => {
    expect(
      provider.verifyWebhookSignature({
        config: configFor(OTHER_KEY),
        parsedBody: encryptedBody(SUCCESS_PARAMS, WORKING_KEY),
      }),
    ).toBe(false);
  });

  it("fails closed with no envelope and no signature header, naming the keys it saw", () => {
    expect(
      provider.verifyWebhookSignature({
        config: configFor(WORKING_KEY),
        parsedBody: { some_unknown_key: "1", another: "2" },
      }),
    ).toBe(false);

    const call = logger.error.mock.calls.find(([msg]) =>
      msg.includes("could not be authenticated"),
    );
    expect(call).toBeDefined();
    expect(call[1].bodyKeys).toEqual(["some_unknown_key", "another"]);
  });

  it("fails closed when the mode has no working key configured", () => {
    expect(
      provider.verifyWebhookSignature({
        config: { provider: "ccavenue_upi_qr", mode: "TEST" },
        parsedBody: encryptedBody(SUCCESS_PARAMS),
      }),
    ).toBe(false);
  });

  it("never throws, whatever it is handed", () => {
    expect(() =>
      provider.verifyWebhookSignature({ config: null, rawBody: 42 }),
    ).not.toThrow();
    expect(provider.verifyWebhookSignature()).toBe(false);
  });
});

describe("decryptQrEnvelope", () => {
  it("returns the decoded fields for the right key and null for the wrong one", () => {
    const body = encryptedBody(SUCCESS_PARAMS);
    expect(
      provider.decryptQrEnvelope({
        config: configFor(WORKING_KEY),
        parsedBody: body,
      }),
    ).toMatchObject({ order_status: "Success", bank_ref_no: "UTR12345678" });
    expect(
      provider.decryptQrEnvelope({
        config: configFor(OTHER_KEY),
        parsedBody: body,
      }),
    ).toBeNull();
  });

  it("is NOT named decryptEnvelope — handleWebhook must not branch on it", () => {
    expect(provider.decryptEnvelope).toBeUndefined();
  });
});

describe("parseQrNotification", () => {
  const decrypted = {
    order_status: "Success",
    bank_ref_no: "UTR12345678",
    tracking_id: "TRK999",
    qr_code_id: "QR-ALPHA",
    payer_vpa: "someone@upi",
    payer_name: "Ravi",
    amount: "1234.56",
    currency: "INR",
    trans_date: "01/02/2026 10:30:00",
  };

  it("maps a successful collection", () => {
    const parsed = provider.parseQrNotification({ decrypted });

    expect(parsed).toMatchObject({
      outcome: "COLLECTED",
      utr: "UTR12345678",
      providerTxnId: "TRK999",
      qrIdentifier: "QR-ALPHA",
      payerVpa: "someone@upi",
      payerName: "Ravi",
      amountPaise: 123456,
      currency: "INR",
    });
    expect(parsed.txnAt).toBe("2026-02-01T10:30:00.000Z");
  });

  it("reads DD/MM/YYYY as day-first, not US month-first", () => {
    const parsed = provider.parseQrNotification({
      decrypted: { ...decrypted, trans_date: "05/11/2026 08:00:00" },
    });
    expect(parsed.txnAt.startsWith("2026-11-05")).toBe(true);
  });

  it("derives providerEventId from the UTR, deterministically", () => {
    const a = provider.parseQrNotification({ decrypted });
    const b = provider.parseQrNotification({ decrypted: { ...decrypted } });
    expect(a.providerEventId).toBe("qr:utr:UTR12345678");
    expect(b.providerEventId).toBe(a.providerEventId);
  });

  it("hashes the payload when there is no UTR, stable across key order", () => {
    const noUtr = { ...decrypted };
    delete noUtr.bank_ref_no;

    const reordered = Object.fromEntries(Object.entries(noUtr).reverse());

    const a = provider.parseQrNotification({ decrypted: noUtr });
    const b = provider.parseQrNotification({ decrypted: reordered });

    expect(a.providerEventId).toMatch(/^qr:h:[0-9a-f]{64}$/);
    expect(b.providerEventId).toBe(a.providerEventId);
    // and never time-based
    expect(a.providerEventId).not.toMatch(/\d{13}/);
  });

  it("IGNOREs an unknown status rather than guessing", () => {
    const parsed = provider.parseQrNotification({
      decrypted: { ...decrypted, order_status: "SomethingNew" },
    });
    expect(parsed.outcome).toBe("IGNORED");
    expect(parsed.amountPaise).toBeNull();
  });

  it("IGNOREs a success with no readable amount", () => {
    const noAmount = { ...decrypted };
    delete noAmount.amount;
    expect(provider.parseQrNotification({ decrypted: noAmount }).outcome).toBe(
      "IGNORED",
    );
  });

  it("maps a reversal to REVERSED", () => {
    expect(
      provider.parseQrNotification({
        decrypted: { ...decrypted, order_status: "Reversed" },
      }).outcome,
    ).toBe("REVERSED");
  });

  it("refuses to read an unopened envelope", () => {
    const parsed = provider.parseQrNotification({
      parsedBody: encryptedBody(SUCCESS_PARAMS),
    });
    expect(parsed.outcome).toBe("IGNORED");
    expect(parsed.raw).toEqual({});
  });

  it("parses a plaintext form-urlencoded raw body", () => {
    const parsed = provider.parseQrNotification({
      rawBody: Buffer.from(SUCCESS_PARAMS, "utf8"),
    });
    expect(parsed.outcome).toBe("COLLECTED");
    expect(parsed.utr).toBe("UTR12345678");
  });

  it("never throws on garbage", () => {
    for (const input of [
      {},
      { rawBody: null },
      { decrypted: [] },
      { parsedBody: 7 },
    ]) {
      expect(() => provider.parseQrNotification(input)).not.toThrow();
      expect(provider.parseQrNotification(input).outcome).toBe("IGNORED");
    }
  });
});

describe("parseWebhookEvent", () => {
  it("always maps to IGNORED so the order-first router can never pick it up", () => {
    const event = provider.parseWebhookEvent({
      decrypted: {
        order_status: "Success",
        bank_ref_no: "UTR12345678",
        amount: "100.00",
      },
    });

    expect(event.outcome).toBe("IGNORED");
    expect(event.qrOutcome).toBe("COLLECTED");
    expect(event.providerPaymentId).toBeNull();
    expect(event.amountPaise).toBeNull();
    // The identity still survives, for the replay guard and forensics.
    expect(event.providerEventId).toBe("qr:utr:UTR12345678");
  });
});

describe("testConnection", () => {
  it("reports missing credentials", async () => {
    const result = await provider.testConnection({
      config: { credentials: { merchantId: "1" } },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("accessCode");
  });

  it("is honest that a pass is only a local check", async () => {
    const result = await provider.testConnection({
      config: configFor(WORKING_KEY),
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("local check only");
  });
});
