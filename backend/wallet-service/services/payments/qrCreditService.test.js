/* eslint-env jest */

/**
 * Unit tests for the static-QR credit path.
 *
 * `webhookService` is MOCKED: this suite's job is to prove that the credit path
 * funnels into `creditOrder` with the right order, the right synthetic event
 * and the right mode — NOT to re-test crediting itself, which has its own
 * guards and its own tests. A test that reached the real `creditOrder` would
 * also drag in Redis and the external wallet client.
 */

jest.mock("../../config/database", () => ({
  prisma: {
    qrCollection: {
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
    },
    outletPaymentQr: { findUnique: jest.fn() },
    paymentOrder: { create: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

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
    class NotFoundError extends APIError {
      constructor(message) {
        super(message, 404, "NOT_FOUND");
      }
    }
    return { APIError, ValidationError, NotFoundError };
  },
  { virtual: true },
);

jest.mock("./webhookService", () => ({ creditOrder: jest.fn() }));
jest.mock("./providerConfigService", () => ({
  resolveConfigForMode: jest.fn(),
  resolveActiveConfig: jest.fn(),
}));

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");
const { creditOrder } = require("./webhookService");
const { resolveConfigForMode } = require("./providerConfigService");
const qrCollectionService = require("./qrCollectionService");
const service = require("./qrCreditService");

const COLLECTION_ID = "44444444-4444-4444-8444-444444444444";
const QR_ID = "22222222-2222-4222-8222-222222222222";
const SUBJECT = "33333333-3333-4333-8333-333333333333";
const ACTOR = "11111111-1111-4111-8111-111111111111";

const QR_ROW = {
  id: QR_ID,
  provider: "ccavenue_upi_qr",
  walletUserId: "+919999999999",
  clientCode: "DEFAULT",
  subjectUserId: SUBJECT,
  qrIdentifier: "QR-ALPHA",
  label: "Andheri counter",
  mode: "LIVE",
  isActive: true,
  maxPerCreditAmount: null,
  maxPerDayAmount: null,
  maxPerDayCount: null,
};

const COLLECTION = {
  id: COLLECTION_ID,
  provider: "ccavenue_upi_qr",
  status: "ATTRIBUTED",
  utr: "UTR12345678",
  providerTxnId: "TRK999",
  qrIdentifier: "QR-ALPHA",
  payerName: "Ravi",
  amount: "1234.56",
  amountPaise: 123456,
  currency: "INR",
  txnAt: new Date("2026-02-01T10:30:00.000Z"),
  receivedAt: new Date("2026-02-01T10:31:00.000Z"),
  outletPaymentQrId: QR_ID,
  walletUserId: "+919999999999",
  clientCode: "DEFAULT",
  subjectUserId: SUBJECT,
  mode: "LIVE",
  rawPayload: { order_status: "Success" },
  metadata: null,
  paymentOrderId: null,
};

function auditActions() {
  return prisma.auditLog.create.mock.calls.map(([{ data }]) => data.action);
}

function auditFor(action) {
  const call = prisma.auditLog.create.mock.calls.find(
    ([{ data }]) => data.action === action,
  );
  return call ? call[0].data : null;
}

beforeEach(() => {
  jest.clearAllMocks();
  qrCollectionService.setCreditHandler(null);

  prisma.qrCollection.updateMany.mockResolvedValue({ count: 1 });
  prisma.qrCollection.update.mockImplementation(async ({ where, data }) => ({
    ...COLLECTION,
    id: where.id,
    ...data,
  }));
  prisma.qrCollection.findUnique.mockResolvedValue({
    ...COLLECTION,
    status: "CREDITED",
  });
  prisma.qrCollection.aggregate.mockResolvedValue({
    _sum: { amountPaise: 0 },
    _count: { _all: 0 },
  });
  prisma.outletPaymentQr.findUnique.mockResolvedValue(QR_ROW);
  prisma.paymentOrder.create.mockImplementation(async ({ data }) => ({
    id: "55555555-5555-4555-8555-555555555555",
    ...data,
  }));
  prisma.auditLog.create.mockResolvedValue({});

  resolveConfigForMode.mockResolvedValue({
    provider: "ccavenue_upi_qr",
    mode: "LIVE",
    webhookSecret: "wk",
    currency: "INR",
  });
  creditOrder.mockResolvedValue({
    handled: "credited",
    credited: true,
    isTest: false,
    externalTransactionId: "EXT-1",
  });
});

/* ------------------------------------------------------------------ */

describe("the guarded claim", () => {
  it("uses updateMany with an explicit allowed-from set, never a bare update", async () => {
    await service.attributeAndCredit(COLLECTION);

    const [{ where, data }] = prisma.qrCollection.updateMany.mock.calls[0];
    expect(where).toEqual({
      id: COLLECTION_ID,
      status: { in: ["ATTRIBUTED", "CREDIT_PENDING"] },
    });
    expect(data.status).toBe("CREDIT_PENDING");
    expect(data.attributedAt).toBeInstanceOf(Date);
  });

  it("stops at already_processed when the claim is lost", async () => {
    prisma.qrCollection.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.attributeAndCredit(COLLECTION);

    expect(result).toMatchObject({
      credited: false,
      handled: "already_processed",
    });
    expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
    expect(creditOrder).not.toHaveBeenCalled();
  });

  it("stamps the external reference at claim time so every retry reuses it", async () => {
    await service.attributeAndCredit(COLLECTION);
    const [{ data }] = prisma.qrCollection.updateMany.mock.calls[0];
    expect(data.externalReferenceId).toBe("UPIQR_UTR12345678");
  });
});

describe("buildQrExternalReferenceId", () => {
  it("keys on the UTR when there is one", () => {
    expect(service.buildQrExternalReferenceId(COLLECTION)).toBe(
      "UPIQR_UTR12345678",
    );
  });

  it("falls back to the collection id, never to anything time-based", () => {
    const ref = service.buildQrExternalReferenceId({
      ...COLLECTION,
      utr: null,
    });
    expect(ref).toBe(`UPIQRC_${COLLECTION_ID}`);
    expect(
      service.buildQrExternalReferenceId({ ...COLLECTION, utr: null }),
    ).toBe(ref);
  });

  it("matches the prefix webhookService derives for this provider (UPIQR)", () => {
    // webhookService's EXTERNAL_REF_PREFIX maps ccavenue_upi_qr -> UPIQR. Two
    // paths disagreeing about the reference is how a payment gets credited twice.
    expect(
      service.buildQrExternalReferenceId(COLLECTION).startsWith("UPIQR_"),
    ).toBe(true);
  });
});

describe("order minting", () => {
  it("mints a QR_STATIC order from the payment and the QR row", async () => {
    await service.attributeAndCredit(COLLECTION, { actorUserId: ACTOR });

    const [{ data }] = prisma.paymentOrder.create.mock.calls[0];

    expect(data).toMatchObject({
      kind: "QR_STATIC",
      provider: "ccavenue_upi_qr",
      mode: "LIVE",
      isTest: false,
      walletUserId: "+919999999999",
      clientCode: "DEFAULT",
      subjectUserId: SUBJECT,
      payerName: "Ravi",
      amount: "1234.56",
      amountPaise: 123456,
      currency: "INR",
      status: "CREATED",
      providerPaymentId: "UTR12345678",
      externalReferenceId: "UPIQR_UTR12345678",
      createdBy: ACTOR,
    });
    expect(data.gatewayData).toEqual({ order_status: "Success" });
    expect(data.notes).toContain("UTR12345678");
    expect(data.notes).toContain("Andheri counter");
  });

  it("derives the amount string without a float round-trip", async () => {
    await service.attributeAndCredit({ ...COLLECTION, amountPaise: 1 });
    expect(prisma.paymentOrder.create.mock.calls[0][0].data.amount).toBe(
      "0.01",
    );
  });

  it("uses C:<id> as the payment id when there is no UTR", async () => {
    await service.attributeAndCredit({ ...COLLECTION, utr: null });
    expect(
      prisma.paymentOrder.create.mock.calls[0][0].data.providerPaymentId,
    ).toBe(`C:${COLLECTION_ID}`);
  });

  it("reuses the winner's row on a P2002 mint race", async () => {
    const winner = { id: "66666666-6666-4666-8666-666666666666", mode: "LIVE" };
    prisma.paymentOrder.create.mockRejectedValueOnce({ code: "P2002" });
    prisma.paymentOrder.findFirst.mockResolvedValueOnce(winner);

    const result = await service.attributeAndCredit(COLLECTION);

    expect(prisma.paymentOrder.findFirst).toHaveBeenCalledWith({
      where: { provider: "ccavenue_upi_qr", providerPaymentId: "UTR12345678" },
    });
    expect(creditOrder.mock.calls[0][0]).toBe(winner);
    expect(result.paymentOrderId).toBe(winner.id);
  });
});

describe("the mode", () => {
  it("comes from the QR row's snapshot, not from live config", async () => {
    prisma.outletPaymentQr.findUnique.mockResolvedValueOnce({
      ...QR_ROW,
      mode: "TEST",
    });
    // The collection's own snapshot and the "live" config both say LIVE...
    resolveConfigForMode.mockResolvedValueOnce({
      mode: "LIVE",
      webhookSecret: "wk",
    });

    await service.attributeAndCredit(COLLECTION);

    expect(resolveConfigForMode).toHaveBeenCalledWith(
      "ccavenue_upi_qr",
      "TEST",
      {
        requireEnabled: false,
      },
    );
    expect(prisma.paymentOrder.create.mock.calls[0][0].data).toMatchObject({
      mode: "TEST",
      isTest: true,
    });
    expect(creditOrder.mock.calls[0][2].verifiedMode).toBe("TEST");
  });

  it("defers rather than guessing when no mode can be resolved", async () => {
    prisma.outletPaymentQr.findUnique.mockResolvedValueOnce({
      ...QR_ROW,
      mode: null,
    });

    const result = await service.attributeAndCredit({
      ...COLLECTION,
      mode: null,
    });

    expect(result.credited).toBe(false);
    expect(result.reason).toBe("MODE_UNRESOLVED");
    expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
  });
});

describe("the synthetic parsed event", () => {
  it("carries the same integer paise the order carries", async () => {
    await service.attributeAndCredit(COLLECTION);

    const [order, parsed, options] = creditOrder.mock.calls[0];

    // creditOrder's first guard is `parsed.amountPaise !== order.amountPaise`.
    // Both sides are the same integer, copied once from the ingestion payload,
    // so it passes by construction — and stays armed for a corrupted retry.
    expect(parsed.amountPaise).toBe(order.amountPaise);
    expect(parsed).toEqual({
      providerPaymentId: "UTR12345678",
      providerOrderId: "TRK999",
      providerLinkId: null,
      amountPaise: 123456,
      currency: "INR",
      capturedAt: "2026-02-01T10:30:00.000Z",
      outcome: "PAID",
      raw: { order_status: "Success" },
    });
    expect(options.source).toBe("QR_INGEST");
  });

  it("prefixes the source per call site", async () => {
    await service.attributeAndCredit(COLLECTION, { source: "ADMIN" });
    expect(creditOrder.mock.calls[0][2].source).toBe("QR_ADMIN");
  });
});

describe("verdict reflection", () => {
  it("marks the collection CREDITED and audits it", async () => {
    const result = await service.attributeAndCredit(COLLECTION);

    expect(result).toMatchObject({ credited: true, handled: "credited" });

    const credited = prisma.qrCollection.updateMany.mock.calls.find(
      ([{ data }]) => data.status === "CREDITED",
    );
    expect(credited[0].where).toEqual({
      id: COLLECTION_ID,
      status: "CREDIT_PENDING",
    });
    expect(credited[0].data).toMatchObject({
      paymentOrderId: result.paymentOrderId,
      needsManualAction: false,
      lastError: null,
    });

    expect(auditActions()).toContain("QR_COLLECTION_CREDITED");
    expect(
      auditFor("QR_COLLECTION_CREDITED").details.externalTransactionId,
    ).toBe("EXT-1");
  });

  it("leaves a failed credit at CREDIT_PENDING with needsManualAction + lastError", async () => {
    creditOrder.mockResolvedValueOnce({
      handled: "reconcile_pending",
      credited: false,
    });

    const result = await service.attributeAndCredit(COLLECTION);

    expect(result).toMatchObject({
      credited: false,
      handled: "credit_deferred",
      reason: "CREDIT_RECONCILE_PENDING",
    });

    const [{ data }] = prisma.qrCollection.update.mock.calls.at(-1);
    expect(data.needsManualAction).toBe(true);
    expect(data.lastError).toContain("CREDIT_RECONCILE_PENDING");
    expect(data.paymentOrderId).toBe(result.paymentOrderId);
    // NOT rolled back to ATTRIBUTED — the money is real and a retry is legal.
    expect(data.status).toBeUndefined();

    expect(auditActions()).toContain("QR_COLLECTION_CREDIT_DEFERRED");
  });

  it("never throws — an unexpected failure becomes a deferral", async () => {
    creditOrder.mockRejectedValueOnce(new Error("boom"));

    const result = await service.attributeAndCredit(COLLECTION);

    expect(result).toMatchObject({
      credited: false,
      handled: "credit_deferred",
      reason: "CREDIT_PATH_ERROR",
    });
  });

  it("defers when the QR row cannot be read", async () => {
    prisma.outletPaymentQr.findUnique.mockResolvedValueOnce(null);
    const result = await service.attributeAndCredit(COLLECTION);
    expect(result.reason).toBe("QR_ROW_MISSING");
    expect(creditOrder).not.toHaveBeenCalled();
  });

  it("defers when the provider config for that mode is unavailable", async () => {
    resolveConfigForMode.mockRejectedValueOnce(
      Object.assign(new Error("nope"), { code: "PROVIDER_NOT_CONFIGURED" }),
    );
    const result = await service.attributeAndCredit(COLLECTION);
    expect(result.reason).toBe("PROVIDER_CONFIG_UNAVAILABLE");
    expect(creditOrder).not.toHaveBeenCalled();
  });
});

describe("velocity signals are ALERTING ONLY — never a gate", () => {
  it("still credits a payment over maxPerCreditAmount", async () => {
    prisma.outletPaymentQr.findUnique.mockResolvedValueOnce({
      ...QR_ROW,
      maxPerCreditAmount: "500.00",
    });

    const result = await service.attributeAndCredit(COLLECTION);

    expect(result.credited).toBe(true);
    expect(creditOrder).toHaveBeenCalledTimes(1);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("CREDITING ANYWAY"),
      expect.objectContaining({
        breaches: [
          {
            signal: "maxPerCreditAmount",
            limitPaise: 50000,
            observedPaise: 123456,
          },
        ],
      }),
    );
    expect(auditActions()).toContain("QR_VELOCITY_SIGNAL_BREACHED");
  });

  it("still credits past the daily amount and count limits, and flags metadata", async () => {
    prisma.outletPaymentQr.findUnique.mockResolvedValueOnce({
      ...QR_ROW,
      maxPerDayAmount: "1000.00",
      maxPerDayCount: 2,
    });
    prisma.qrCollection.aggregate.mockResolvedValueOnce({
      _sum: { amountPaise: 900000 },
      _count: { _all: 9 },
    });

    const result = await service.attributeAndCredit(COLLECTION);

    expect(result.credited).toBe(true);

    const flagged = prisma.qrCollection.update.mock.calls.find(
      ([{ data }]) => data.metadata && data.metadata.velocityAlert,
    );
    expect(flagged[0].data.metadata.velocityAlert.credited).toBe(true);
    expect(
      flagged[0].data.metadata.velocityAlert.breaches.map((b) => b.signal),
    ).toEqual(["maxPerDayAmount", "maxPerDayCount"]);
  });

  it("does not let a failure to compute a signal block the credit", async () => {
    prisma.outletPaymentQr.findUnique.mockResolvedValueOnce({
      ...QR_ROW,
      maxPerDayCount: 1,
    });
    prisma.qrCollection.aggregate.mockRejectedValueOnce(new Error("db down"));

    const result = await service.attributeAndCredit(COLLECTION);
    expect(result.credited).toBe(true);
  });
});

describe("registerCreditHandler", () => {
  it("is NOT armed by requiring the module", () => {
    expect(qrCollectionService.getCreditHandler()).toBeNull();
  });

  it("wires the seam and returns the updated collection row", async () => {
    service.registerCreditHandler();

    const handler = qrCollectionService.getCreditHandler();
    expect(typeof handler).toBe("function");

    const returned = await handler({ collection: COLLECTION, qr: QR_ROW });

    expect(creditOrder).toHaveBeenCalledTimes(1);
    expect(creditOrder.mock.calls[0][2].source).toBe("QR_INGEST");
    // `.id` present -> ingestCollection adopts it, so callers see CREDITED.
    expect(returned.id).toBe(COLLECTION_ID);
    expect(returned.status).toBe("CREDITED");
  });
});
