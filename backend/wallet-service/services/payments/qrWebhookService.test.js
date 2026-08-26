/* eslint-env jest */

/**
 * Unit tests for the static-QR webhook ingest.
 *
 * The provider registry, the config service and `qrCollectionService` are all
 * mocked: this suite tests the WEBHOOK DISCIPLINE — verify, record, dedupe,
 * route, always-200 — not the provider's field mappings or the ingestion rules,
 * both of which have their own suites.
 */

jest.mock("../../config/database", () => ({
  prisma: {
    paymentWebhookEvent: { create: jest.fn(), update: jest.fn() },
    qrCollection: { findFirst: jest.fn(), update: jest.fn() },
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
    return { APIError, ValidationError: APIError, NotFoundError: APIError };
  },
  { virtual: true },
);

jest.mock("./index", () => ({
  getProvider: jest.fn(),
  registerLazy: jest.fn(),
}));

jest.mock("./providerConfigService", () => ({
  resolveConfigForMode: jest.fn(),
  resolveActiveConfig: jest.fn(),
}));

jest.mock("./qrCollectionService", () => ({
  ingestCollection: jest.fn(),
}));

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");
const { getProvider } = require("./index");
const {
  resolveConfigForMode,
  resolveActiveConfig,
} = require("./providerConfigService");
const qrCollectionService = require("./qrCollectionService");
const service = require("./qrWebhookService");

const PROVIDER = "ccavenue_upi_qr";
const EVENT_ID = "77777777-7777-4777-8777-777777777777";
const COLLECTION_ID = "44444444-4444-4444-8444-444444444444";

const COLLECTED = {
  providerEventId: "qr:utr:UTR12345678",
  eventType: "qr.success",
  outcome: "COLLECTED",
  utr: "UTR12345678",
  providerTxnId: "TRK999",
  qrIdentifier: "QR-ALPHA",
  payerVpa: "someone@upi",
  payerName: "Ravi",
  amountPaise: 123456,
  currency: "INR",
  txnAt: "2026-02-01T10:30:00.000Z",
  raw: { order_status: "Success", bank_ref_no: "UTR12345678" },
};

const IGNORED = {
  providerEventId: null,
  eventType: null,
  outcome: "IGNORED",
  utr: null,
  providerTxnId: null,
  qrIdentifier: null,
  payerVpa: null,
  payerName: null,
  amountPaise: null,
  currency: null,
  txnAt: null,
  raw: {},
};

let impl;

function callArgs() {
  return {
    provider: PROVIDER,
    rawBody: Buffer.from("encResp=deadbeef", "utf8"),
    parsedBody: { encResp: "deadbeef" },
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: "Bearer nope",
    },
    ip: "1.2.3.4",
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  impl = {
    name: PROVIDER,
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    decryptQrEnvelope: jest.fn().mockReturnValue({ order_status: "Success" }),
    parseQrNotification: jest.fn().mockReturnValue(COLLECTED),
  };
  getProvider.mockReturnValue(impl);

  resolveActiveConfig.mockResolvedValue({ mode: "LIVE" });
  resolveConfigForMode.mockImplementation(async (_p, mode) => ({
    provider: PROVIDER,
    mode,
    webhookSecret: `wk-${mode}`,
  }));

  prisma.paymentWebhookEvent.create.mockResolvedValue({ id: EVENT_ID });
  prisma.paymentWebhookEvent.update.mockResolvedValue({});
  prisma.qrCollection.findFirst.mockResolvedValue(null);
  prisma.qrCollection.update.mockResolvedValue({});
  prisma.auditLog.create.mockResolvedValue({});

  qrCollectionService.ingestCollection.mockResolvedValue({
    collection: { id: COLLECTION_ID, paymentOrderId: null },
    duplicate: false,
    matched: true,
    status: "CREDITED",
    qr: { id: "qr" },
  });
});

/* ------------------------------------------------------------------ */

describe("provider resolution", () => {
  it("404s an unknown provider", async () => {
    getProvider.mockImplementation(() => {
      throw new Error("not supported");
    });

    const result = await service.handleQrWebhook({
      ...callArgs(),
      provider: "nope",
    });

    expect(result).toMatchObject({
      status: 404,
      code: "PROVIDER_NOT_SUPPORTED",
      handled: "unsupported_provider",
    });
    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("404s a provider that is not a QR collection provider", async () => {
    getProvider.mockReturnValue({
      name: "razorpay",
      parseWebhookEvent: jest.fn(),
    });

    const result = await service.handleQrWebhook(callArgs());
    expect(result.status).toBe(404);
  });
});

describe("verification", () => {
  it("tries the active mode first, then the other", async () => {
    resolveActiveConfig.mockResolvedValueOnce({ mode: "TEST" });
    impl.verifyWebhookSignature
      .mockReturnValueOnce(false) // TEST
      .mockReturnValueOnce(true); // LIVE

    await service.handleQrWebhook(callArgs());

    expect(resolveConfigForMode.mock.calls.map((c) => c[1])).toEqual([
      "TEST",
      "LIVE",
    ]);
    expect(resolveConfigForMode.mock.calls[0][2]).toEqual({
      requireEnabled: false,
    });
  });

  it("records the rejection for forensics and returns 401", async () => {
    impl.verifyWebhookSignature.mockReturnValue(false);
    impl.parseQrNotification.mockReturnValue(IGNORED);

    const result = await service.handleQrWebhook(callArgs());

    expect(result).toMatchObject({
      status: 401,
      code: "INVALID_SIGNATURE",
      handled: "rejected",
    });

    const [{ data }] = prisma.paymentWebhookEvent.create.mock.calls[0];
    expect(data.signatureValid).toBe(false);
    expect(data.processingError).toBe("INVALID_SIGNATURE");
    expect(data.headers._sourceIp).toBe("1.2.3.4");
    // Sensitive headers are never persisted.
    expect(data.headers.authorization).toBeUndefined();
    // The body shape we could see is the artefact needed to finish the mapping.
    expect(data.payload._bodyKeys).toEqual(["encResp"]);

    expect(qrCollectionService.ingestCollection).not.toHaveBeenCalled();
  });

  it("treats a throwing verifier as a rejection, not a pass", async () => {
    impl.verifyWebhookSignature.mockImplementation(() => {
      throw new Error("bang");
    });

    const result = await service.handleQrWebhook(callArgs());
    expect(result.status).toBe(401);
  });

  it("re-parses with the opened envelope once authenticated", async () => {
    await service.handleQrWebhook(callArgs());

    const lastParse = impl.parseQrNotification.mock.calls.at(-1)[0];
    expect(lastParse.decrypted).toEqual({ order_status: "Success" });
  });
});

describe("replay guard", () => {
  it("returns 200 duplicate on P2002 WITHOUT touching money", async () => {
    prisma.paymentWebhookEvent.create.mockRejectedValueOnce({ code: "P2002" });

    const result = await service.handleQrWebhook(callArgs());

    expect(result).toMatchObject({
      status: 200,
      handled: "duplicate",
      eventId: "qr:utr:UTR12345678",
    });
    expect(qrCollectionService.ingestCollection).not.toHaveBeenCalled();
  });

  it("throws 503 for a pre-record infrastructure failure so the provider redelivers", async () => {
    prisma.paymentWebhookEvent.create.mockRejectedValueOnce(
      new Error("db down"),
    );

    await expect(service.handleQrWebhook(callArgs())).rejects.toMatchObject({
      statusCode: 503,
      code: "WEBHOOK_INFRA_UNAVAILABLE",
    });
  });

  it("stores the scrubbed decrypted fields as the payload", async () => {
    await service.handleQrWebhook(callArgs());
    const [{ data }] = prisma.paymentWebhookEvent.create.mock.calls[0];
    expect(data.payload).toEqual(COLLECTED.raw);
    expect(data.signatureValid).toBe(true);
    expect(data.providerEventId).toBe("qr:utr:UTR12345678");
  });
});

describe("COLLECTED", () => {
  it("funnels into ingestCollection with the mapped fields", async () => {
    const result = await service.handleQrWebhook(callArgs());

    expect(qrCollectionService.ingestCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: PROVIDER,
        source: "WEBHOOK",
        utr: "UTR12345678",
        providerTxnId: "TRK999",
        qrIdentifier: "QR-ALPHA",
        payerVpa: "someone@upi",
        payerName: "Ravi",
        amountPaise: 123456,
        currency: "INR",
        txnAt: "2026-02-01T10:30:00.000Z",
        rawPayload: COLLECTED.raw,
      }),
    );
    expect(
      qrCollectionService.ingestCollection.mock.calls[0][0].metadata,
    ).toMatchObject({ webhookEventId: EVENT_ID, verifiedMode: "LIVE" });

    expect(result).toMatchObject({
      status: 200,
      handled: "ingested",
      outcome: "COLLECTED",
      collectionId: COLLECTION_ID,
    });

    expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EVENT_ID },
        data: expect.objectContaining({ processed: true }),
      }),
    );
  });

  it("reports an unattributed collection without failing the delivery", async () => {
    qrCollectionService.ingestCollection.mockResolvedValueOnce({
      collection: { id: COLLECTION_ID },
      duplicate: false,
      matched: false,
      status: "UNATTRIBUTED",
      qr: null,
    });

    const result = await service.handleQrWebhook(callArgs());
    expect(result).toMatchObject({ status: 200, handled: "unattributed" });
  });

  it("reports a duplicate collection as its own outcome", async () => {
    qrCollectionService.ingestCollection.mockResolvedValueOnce({
      collection: { id: COLLECTION_ID },
      duplicate: true,
      matched: true,
      status: "CREDITED",
      qr: { id: "qr" },
    });

    const result = await service.handleQrWebhook(callArgs());
    expect(result.handled).toBe("duplicate_collection");
  });
});

describe("REVERSED", () => {
  const reversed = {
    ...COLLECTED,
    outcome: "REVERSED",
    eventType: "qr.reversed",
  };

  it("flags the collection and NEVER auto-debits", async () => {
    impl.parseQrNotification.mockReturnValue(reversed);
    prisma.qrCollection.findFirst.mockResolvedValueOnce({
      id: COLLECTION_ID,
      status: "CREDITED",
      subjectUserId: null,
      paymentOrderId: "order-1",
      metadata: { a: 1 },
    });

    const result = await service.handleQrWebhook(callArgs());

    expect(result).toMatchObject({ status: 200, handled: "reversal_flagged" });

    const [{ data }] = prisma.qrCollection.update.mock.calls[0];
    expect(data.needsManualAction).toBe(true);
    expect(data.lastError).toContain("REVERSAL_REPORTED");
    expect(data.metadata).toMatchObject({
      a: 1,
      reversal: { autoDebited: false },
    });

    // No ingestion, no credit, no debit — recording only.
    expect(qrCollectionService.ingestCollection).not.toHaveBeenCalled();

    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.action).toBe("QR_COLLECTION_REVERSAL_FLAGGED");
  });

  it("logs loudly when the reversal names a collection we never saw", async () => {
    impl.parseQrNotification.mockReturnValue(reversed);
    prisma.qrCollection.findFirst.mockResolvedValueOnce(null);

    const result = await service.handleQrWebhook(callArgs());

    expect(result.handled).toBe("reversal_no_collection");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("MANUAL ACTION REQUIRED"),
      expect.any(Object),
    );
  });
});

describe("IGNORED", () => {
  it("records the event and does nothing else", async () => {
    impl.parseQrNotification.mockReturnValue({
      ...IGNORED,
      providerEventId: "qr:h:abc",
    });

    const result = await service.handleQrWebhook(callArgs());

    expect(result).toMatchObject({
      status: 200,
      handled: "ignored",
      outcome: "IGNORED",
    });
    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalled();
    expect(qrCollectionService.ingestCollection).not.toHaveBeenCalled();
  });
});

describe("always 200 once the event row exists (I6)", () => {
  it("answers 200 even when ingestion throws, annotating the event row", async () => {
    qrCollectionService.ingestCollection.mockRejectedValueOnce(
      new Error("credit blew up"),
    );

    const result = await service.handleQrWebhook(callArgs());

    expect(result).toMatchObject({ status: 200, handled: "deferred" });

    const annotated = prisma.paymentWebhookEvent.update.mock.calls.at(-1)[0];
    expect(annotated.data.processed).toBe(false);
    expect(annotated.data.processingError).toContain("credit blew up");
  });
});

describe("replayStoredEvent", () => {
  const storedEvent = {
    id: EVENT_ID,
    provider: PROVIDER,
    payload: { order_status: "Success", bank_ref_no: "UTR12345678" },
    headers: {},
    signatureValid: true,
    processed: false,
  };

  it("re-parses the stored payload as already-decrypted and re-drives ingestion", async () => {
    const result = await service.replayStoredEvent(storedEvent);

    const parseArgs = impl.parseQrNotification.mock.calls[0][0];
    expect(parseArgs.decrypted).toBe(storedEvent.payload);
    expect(parseArgs.rawBody).toBeNull();

    // Signature is NOT re-verified: the sweep only selects already-verified rows.
    expect(impl.verifyWebhookSignature).not.toHaveBeenCalled();

    expect(qrCollectionService.ingestCollection).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      handled: "ingested",
      collectionId: COLLECTION_ID,
      credited: true,
    });
  });

  it("marks the event processed on success", async () => {
    await service.replayStoredEvent(storedEvent);
    expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: true }),
      }),
    );
  });

  it("records the failure and does not throw when the replay fails", async () => {
    qrCollectionService.ingestCollection.mockRejectedValueOnce(
      new Error("still down"),
    );

    const result = await service.replayStoredEvent(storedEvent);

    expect(result).toMatchObject({ ok: false, handled: "deferred" });
    expect(
      prisma.paymentWebhookEvent.update.mock.calls.at(-1)[0].data
        .processingError,
    ).toContain("still down");
  });

  it("rejects an unusable event row", async () => {
    expect(await service.replayStoredEvent(null)).toMatchObject({
      ok: false,
      handled: "invalid_event",
    });
  });
});
