/* eslint-env jest */

/**
 * Unit tests for the static-QR ingestion layer.
 *
 * Prisma, the logger and the shared error classes are all mocked: `shared/` is
 * bind-mounted into the container and does not exist on the host, so those two
 * requires need `{virtual: true}` (same pattern as
 * backend/shipment-service/services/shipmentWalletService.test.js).
 */

jest.mock("../../config/database", () => ({
  prisma: {
    qrCollection: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    outletPaymentQr: {
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
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
        this.name = "ValidationError";
        this.details = details;
      }
    }
    return { APIError, ValidationError };
  },
  { virtual: true },
);

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");
const service = require("./qrCollectionService");

const ACTOR = "11111111-1111-4111-8111-111111111111";
const QR_ROW = {
  id: "22222222-2222-4222-8222-222222222222",
  provider: "ccavenue_upi_qr",
  walletUserId: "+919999999999",
  clientCode: "DEFAULT",
  subjectUserId: "33333333-3333-4333-8333-333333333333",
  qrIdentifier: "QR-ALPHA",
  vpa: "outlet@upi",
  mode: "TEST",
  isActive: true,
};

/** Make `prisma.qrCollection.create` echo the data it was given. */
function echoCreate() {
  prisma.qrCollection.create.mockImplementation(async ({ data }) => ({
    id: "44444444-4444-4444-8444-444444444444",
    receivedAt: new Date("2026-02-01T00:00:00.000Z"),
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    ...data,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  service.setCreditHandler(null);
  prisma.qrCollection.findUnique.mockResolvedValue(null);
  prisma.qrCollection.findFirst.mockResolvedValue(null);
  prisma.outletPaymentQr.findFirst.mockResolvedValue(null);
  prisma.auditLog.create.mockResolvedValue({});
  // handleDuplicate always writes (the delivery counter), so give update a
  // default that echoes the targeted row back rather than undefined.
  prisma.qrCollection.update.mockImplementation(({ where, data }) =>
    Promise.resolve({ id: where.id, ...data }),
  );
  echoCreate();
});

/* ------------------------------------------------------------------ */

describe("buildDedupeKey", () => {
  const base = {
    provider: "ccavenue_upi_qr",
    qrIdentifier: "QR-ALPHA",
    amountPaise: 50000,
    txnAt: "2026-02-01T10:00:00.000Z",
    providerTxnId: "TXN1",
  };

  it("is a <=80 char hex string", () => {
    const key = service.buildDedupeKey({ ...base, utr: "UTR123" });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key.length).toBeLessThanOrEqual(80);
  });

  it("is deterministic across calls", () => {
    expect(service.buildDedupeKey({ ...base, utr: "UTR123" })).toBe(
      service.buildDedupeKey({ ...base, utr: "UTR123" }),
    );
    expect(service.buildDedupeKey(base)).toBe(service.buildDedupeKey(base));
  });

  it("ignores every non-UTR field once a UTR is present", () => {
    // A webhook and a CSV row for the same money differ in everything except
    // the bank's UTR — they MUST still collide.
    const fromWebhook = service.buildDedupeKey({
      provider: "ccavenue_upi_qr",
      utr: "utr123 ",
      qrIdentifier: "QR-ALPHA",
      amountPaise: 50000,
      txnAt: "2026-02-01T10:00:00.123Z",
      providerTxnId: "TXN1",
    });
    const fromCsv = service.buildDedupeKey({
      provider: "ccavenue_upi_qr",
      utr: "UTR123",
    });
    expect(fromWebhook).toBe(fromCsv);
  });

  it("truncates txnAt to the second in the UTR-less content hash", () => {
    expect(
      service.buildDedupeKey({ ...base, txnAt: "2026-02-01T10:00:00.999Z" }),
    ).toBe(service.buildDedupeKey({ ...base, txnAt: "2026-02-01T10:00:00Z" }));
  });

  it("separates genuinely different UTR-less payments", () => {
    expect(service.buildDedupeKey({ ...base, amountPaise: 50001 })).not.toBe(
      service.buildDedupeKey(base),
    );
    expect(
      service.buildDedupeKey({ ...base, qrIdentifier: "QR-BETA" }),
    ).not.toBe(service.buildDedupeKey(base));
  });
});

/* ------------------------------------------------------------------ */

describe("resolveQr", () => {
  it("matches an active row by qrIdentifier", async () => {
    prisma.outletPaymentQr.findFirst.mockResolvedValueOnce(QR_ROW);
    const qr = await service.resolveQr({ qrIdentifier: "QR-ALPHA" });
    expect(qr).toBe(QR_ROW);
    expect(prisma.outletPaymentQr.findFirst).toHaveBeenCalledWith({
      where: {
        provider: "ccavenue_upi_qr",
        qrIdentifier: "QR-ALPHA",
        isActive: true,
      },
    });
  });

  it("falls back to vpa when the qrIdentifier misses", async () => {
    prisma.outletPaymentQr.findFirst
      .mockResolvedValueOnce(null) // qrIdentifier + active
      .mockResolvedValueOnce(null) // qrIdentifier any
      .mockResolvedValueOnce(QR_ROW); // vpa + active
    const qr = await service.resolveQr({
      qrIdentifier: "QR-MISSING",
      payerVpa: "outlet@upi",
    });
    expect(qr).toBe(QR_ROW);
  });

  it("returns null for an inactive (retired) QR — never guesses", async () => {
    prisma.outletPaymentQr.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...QR_ROW, isActive: false });
    await expect(
      service.resolveQr({ qrIdentifier: "QR-ALPHA" }),
    ).resolves.toBeNull();
  });

  it("returns null when nothing matches", async () => {
    await expect(
      service.resolveQr({ qrIdentifier: "NOPE", payerVpa: "who@upi" }),
    ).resolves.toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("ingestCollection", () => {
  const input = () => ({
    source: "WEBHOOK",
    utr: " utr-abc ",
    qrIdentifier: "QR-ALPHA",
    amountPaise: 123456,
    txnAt: "2026-02-01T10:00:00.000Z",
    rawPayload: { a: 1 },
    actorUserId: ACTOR,
  });

  it("rejects a non-positive / non-integer amount with 400 INVALID_AMOUNT", async () => {
    await expect(
      service.ingestCollection({ ...input(), amountPaise: 0 }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_AMOUNT" });
    await expect(
      service.ingestCollection({ ...input(), amountPaise: 10.5 }),
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect(prisma.qrCollection.create).not.toHaveBeenCalled();
  });

  it("rejects a non-INR currency", async () => {
    await expect(
      service.ingestCollection({ ...input(), currency: "USD" }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CURRENCY" });
  });

  it("matched + UTR -> ATTRIBUTED, wallet identity snapshotted from the QR row", async () => {
    prisma.outletPaymentQr.findFirst.mockResolvedValueOnce(QR_ROW);

    const res = await service.ingestCollection(input());

    expect(res.duplicate).toBe(false);
    expect(res.matched).toBe(true);
    expect(res.status).toBe("ATTRIBUTED");

    const { data } = prisma.qrCollection.create.mock.calls[0][0];
    expect(data.status).toBe("ATTRIBUTED");
    expect(data.outletPaymentQrId).toBe(QR_ROW.id);
    expect(data.walletUserId).toBe(QR_ROW.walletUserId);
    expect(data.clientCode).toBe(QR_ROW.clientCode);
    expect(data.subjectUserId).toBe(QR_ROW.subjectUserId);
    expect(data.mode).toBe(QR_ROW.mode);
    expect(data.needsManualAction).toBe(false);
    expect(data.utr).toBe("UTR-ABC"); // trimmed + upper-cased
    // Decimal comes from string arithmetic, never `paise / 100`.
    expect(data.amount).toBe("1234.56");
    expect(data.amountPaise).toBe(123456);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "QR_COLLECTION_INGESTED",
          resource: "QrCollection",
          userId: ACTOR,
        }),
      }),
    );
  });

  it("derives sub-rupee amounts without a float round-trip", async () => {
    prisma.outletPaymentQr.findFirst.mockResolvedValueOnce(QR_ROW);
    await service.ingestCollection({ ...input(), amountPaise: 7 });
    expect(prisma.qrCollection.create.mock.calls[0][0].data.amount).toBe(
      "0.07",
    );
  });

  it("unmatched -> UNATTRIBUTED, needsManualAction, LOUD error log", async () => {
    const res = await service.ingestCollection(input());

    expect(res.matched).toBe(false);
    expect(res.status).toBe("UNATTRIBUTED");
    const { data } = prisma.qrCollection.create.mock.calls[0][0];
    expect(data.outletPaymentQrId).toBeNull();
    expect(data.walletUserId).toBeNull();
    expect(data.needsManualAction).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      "QR payment could not be attributed — MANUAL ACTION REQUIRED",
      expect.objectContaining({ amountPaise: 123456 }),
    );
  });

  it("surfaces a retired QR as metadata.matchedInactiveQrId without acting on it", async () => {
    prisma.outletPaymentQr.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...QR_ROW, isActive: false });

    const res = await service.ingestCollection(input());

    expect(res.matched).toBe(false);
    const { data } = prisma.qrCollection.create.mock.calls[0][0];
    expect(data.outletPaymentQrId).toBeNull();
    expect(data.metadata.matchedInactiveQrId).toBe(QR_ROW.id);
  });

  it("UTR-less is forced to UNATTRIBUTED + manual EVEN WHEN the QR matched", async () => {
    prisma.outletPaymentQr.findFirst.mockResolvedValueOnce(QR_ROW);

    const res = await service.ingestCollection({ ...input(), utr: null });

    expect(res.matched).toBe(true);
    expect(res.status).toBe("UNATTRIBUTED");
    const { data } = prisma.qrCollection.create.mock.calls[0][0];
    expect(data.outletPaymentQrId).toBe(QR_ROW.id); // evidence of the match kept
    expect(data.needsManualAction).toBe(true);
    expect(data.metadata.forcedManualReason).toBe("NO_UTR");
  });

  it("never credits: no handler is called for an UNATTRIBUTED row", async () => {
    const handler = jest.fn();
    service.setCreditHandler(handler);
    await service.ingestCollection(input());
    expect(handler).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */

describe("ingestCollection duplicates", () => {
  const existing = {
    id: "55555555-5555-4555-8555-555555555555",
    source: "WEBHOOK",
    status: "ATTRIBUTED",
    utr: "UTR-ABC",
    amountPaise: 123456,
    rawPayload: { a: 1 },
    providerTxnId: "TXN1",
    payerVpa: "outlet@upi",
    outletPaymentQrId: QR_ROW.id,
  };

  const input = (over = {}) => ({
    source: "WEBHOOK",
    utr: "UTR-ABC",
    qrIdentifier: "QR-ALPHA",
    amountPaise: 123456,
    actorUserId: ACTOR,
    ...over,
  });

  it("re-delivery credits nothing and only bumps the delivery counter", async () => {
    prisma.qrCollection.findUnique.mockResolvedValue(existing);
    prisma.qrCollection.update.mockResolvedValue(existing);

    const res = await service.ingestCollection(input());

    expect(res.duplicate).toBe(true);
    expect(res.collection.id).toBe(existing.id);
    expect(prisma.qrCollection.create).not.toHaveBeenCalled();
    // The ONLY write a plain re-delivery may make: no amount, no status, no
    // identity change. A redelivery loop is then visible on the row.
    expect(prisma.qrCollection.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { deliveryCount: { increment: 1 } },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "QR_COLLECTION_DUPLICATE_IGNORED",
        }),
      }),
    );
  });

  it("a concurrent P2002 is resolved by re-reading, not thrown", async () => {
    prisma.qrCollection.findUnique
      .mockResolvedValueOnce(null) // pre-check misses
      .mockResolvedValueOnce(existing); // re-read after the collision
    const p2002 = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    prisma.qrCollection.create.mockRejectedValueOnce(p2002);

    const res = await service.ingestCollection(input());
    expect(res.duplicate).toBe(true);
    expect(res.collection.id).toBe(existing.id);
  });

  it("same UTR + DIFFERENT amount: warn + needsManualAction, amount untouched", async () => {
    prisma.qrCollection.findUnique.mockResolvedValue(existing);
    prisma.qrCollection.update.mockImplementation(async ({ data }) => ({
      ...existing,
      ...data,
    }));

    const res = await service.ingestCollection(input({ amountPaise: 999 }));

    expect(res.duplicate).toBe(true);
    const updateArg = prisma.qrCollection.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: existing.id });
    expect(updateArg.data.needsManualAction).toBe(true);
    expect(updateArg.data.lastError).toContain("DUPLICATE_AMOUNT_MISMATCH");
    expect(updateArg.data.amountPaise).toBeUndefined();
    expect(updateArg.data.status).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("import-then-webhook enriches rawPayload/providerTxnId/payerVpa in place", async () => {
    const imported = {
      ...existing,
      source: "IMPORT",
      rawPayload: null,
      providerTxnId: null,
      payerVpa: null,
      status: "UNATTRIBUTED",
    };
    prisma.qrCollection.findUnique.mockResolvedValue(imported);
    prisma.qrCollection.update.mockImplementation(async ({ data }) => ({
      ...imported,
      ...data,
    }));

    await service.ingestCollection(
      input({ rawPayload: { b: 2 }, providerTxnId: "TXN9", payerVpa: "p@upi" }),
    );

    const { data } = prisma.qrCollection.update.mock.calls[0][0];
    expect(data).toEqual({
      rawPayload: { b: 2 },
      providerTxnId: "TXN9",
      payerVpa: "p@upi",
      deliveryCount: { increment: 1 },
    });
    expect(data.amount).toBeUndefined();
    expect(data.amountPaise).toBeUndefined();
    expect(data.status).toBeUndefined();
  });

  it("does NOT enrich a row that already carries a rawPayload", async () => {
    prisma.qrCollection.findUnique.mockResolvedValue({
      ...existing,
      source: "IMPORT",
    });
    await service.ingestCollection(input({ rawPayload: { b: 2 } }));
    // The counter still ticks, but NOTHING is enriched: a row that already has
    // evidence must not have it overwritten by a later delivery.
    expect(prisma.qrCollection.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { deliveryCount: { increment: 1 } },
    });
  });
});

/* ------------------------------------------------------------------ */

describe("the Wave-3 credit seam", () => {
  const input = {
    source: "WEBHOOK",
    utr: "UTR-SEAM",
    qrIdentifier: "QR-ALPHA",
    amountPaise: 1000,
    actorUserId: ACTOR,
  };

  it("calls the registered handler for an ATTRIBUTED row", async () => {
    prisma.outletPaymentQr.findFirst.mockResolvedValueOnce(QR_ROW);
    const handler = jest.fn().mockResolvedValue(undefined);
    service.setCreditHandler(handler);

    await service.ingestCollection(input);

    expect(handler).toHaveBeenCalledTimes(1);
    const arg = handler.mock.calls[0][0];
    expect(arg.qr).toBe(QR_ROW);
    expect(arg.collection.status).toBe("ATTRIBUTED");
  });

  it("a per-call onAttributed overrides the module handler", async () => {
    prisma.outletPaymentQr.findFirst.mockResolvedValueOnce(QR_ROW);
    const moduleHandler = jest.fn();
    const perCall = jest.fn();
    service.setCreditHandler(moduleHandler);

    await service.ingestCollection({ ...input, onAttributed: perCall });

    expect(perCall).toHaveBeenCalledTimes(1);
    expect(moduleHandler).not.toHaveBeenCalled();
  });

  it("fails safe: a throwing handler leaves the row intact with lastError set", async () => {
    prisma.outletPaymentQr.findFirst.mockResolvedValueOnce(QR_ROW);
    prisma.qrCollection.update.mockImplementation(async ({ data }) => ({
      id: "44444444-4444-4444-8444-444444444444",
      status: "ATTRIBUTED",
      ...data,
    }));
    service.setCreditHandler(() => {
      throw new Error("wave-3 exploded");
    });

    const res = await service.ingestCollection(input);

    expect(res.collection.lastError).toContain("CREDIT_HANDLER_FAILED");
    expect(res.collection.needsManualAction).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      "QR credit handler failed — collection row left intact",
      expect.any(Object),
    );
  });

  it("rejects a non-function handler", () => {
    expect(() => service.setCreditHandler("nope")).toThrow(TypeError);
  });
});

/* ------------------------------------------------------------------ */

describe("importCollections", () => {
  const rows = [
    { utr: "U1", qrIdentifier: "QR-ALPHA", amountPaise: 100 }, // matched
    { utr: "U2", qrIdentifier: "QR-NONE", amountPaise: 200 }, // unmatched
    { utr: "U3", qrIdentifier: "QR-ALPHA", amountPaise: 300 }, // duplicate
    { utr: "U4", qrIdentifier: "QR-ALPHA", amountPaise: -1 }, // invalid
  ];

  it("classifies matched / unmatched / duplicate / failed without aborting", async () => {
    prisma.outletPaymentQr.findFirst.mockImplementation(async ({ where }) =>
      where.qrIdentifier === "QR-ALPHA" ? QR_ROW : null,
    );
    prisma.qrCollection.findUnique.mockImplementation(async () => null);
    // Third row is already present.
    let seen = 0;
    prisma.qrCollection.findUnique.mockImplementation(async () => {
      seen += 1;
      return seen === 3
        ? {
            id: "66666666-6666-4666-8666-666666666666",
            utr: "U3",
            amountPaise: 300,
            source: "IMPORT",
            rawPayload: {},
            status: "ATTRIBUTED",
            outletPaymentQrId: QR_ROW.id,
          }
        : null;
    });

    const summary = await service.importCollections(rows, {
      actorUserId: ACTOR,
    });

    expect(summary.total).toBe(4);
    expect(summary.successCount).toBe(2);
    expect(summary.duplicateCount).toBe(1);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.failureCount).toBe(1);
    expect(summary.duplicates[0]).toEqual({
      utr: "U3",
      existingId: "66666666-6666-4666-8666-666666666666",
    });
    expect(summary.failed[0]).toMatchObject({ index: 3, utr: "U4" });
    expect(summary.successful.map((s) => s.status)).toEqual([
      "ATTRIBUTED",
      "UNATTRIBUTED",
    ]);
  });

  it("defaults the source to IMPORT", async () => {
    await service.importCollections([rows[1]], { actorUserId: ACTOR });
    expect(prisma.qrCollection.create.mock.calls[0][0].data.source).toBe(
      "IMPORT",
    );
  });

  it("dryRun returns the same envelope and WRITES NOTHING", async () => {
    prisma.outletPaymentQr.findFirst.mockImplementation(async ({ where }) =>
      where.qrIdentifier === "QR-ALPHA" ? QR_ROW : null,
    );

    const summary = await service.importCollections(rows, { dryRun: true });

    expect(summary).toEqual(
      expect.objectContaining({
        total: 4,
        // No stored row matches in this scenario, so nothing is a duplicate;
        // the invalid row still fails, exactly as it would on a real import.
        successCount: 3,
        duplicateCount: 0,
        unmatchedCount: 1,
        failureCount: 1,
        dryRun: true,
      }),
    );
    expect(prisma.qrCollection.create).not.toHaveBeenCalled();
    expect(prisma.qrCollection.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("tolerates a non-array input", async () => {
    const summary = await service.importCollections(null, {});
    expect(summary.total).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("listing", () => {
  const row = {
    id: "77777777-7777-4777-8777-777777777777",
    provider: "ccavenue_upi_qr",
    source: "IMPORT",
    status: "UNATTRIBUTED",
    utr: "U9",
    dedupeKey: "k",
    amount: "12.34",
    amountPaise: 1234,
    currency: "INR",
    receivedAt: new Date("2026-02-01T00:00:00.000Z"),
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    rawPayload: { secret: "do-not-leak" },
    outletPaymentQrId: null,
  };

  beforeEach(() => {
    prisma.qrCollection.count.mockResolvedValue(45);
    prisma.qrCollection.findMany.mockResolvedValue([row]);
  });

  it("returns the hard-contract envelope with a 0-based current_page", async () => {
    const env = await service.listCollections({ page: 1, size: 20 });

    expect(env.success).toBe(true);
    expect(env.pagination).toEqual({
      total_elements: 45,
      has_previous: true,
      has_next: true,
      total_pages: 3,
      current_page: 1,
      page_size: 20,
    });
    expect(Array.isArray(env.data)).toBe(true);
    expect(env.filters).toEqual(expect.objectContaining({ status: null }));
  });

  it("defaults to page 0 / size 20 and caps size at 100", async () => {
    await service.listCollections({});
    expect(prisma.qrCollection.findMany.mock.calls[0][0]).toMatchObject({
      skip: 0,
      take: 20,
    });

    await service.listCollections({ size: 5000 });
    expect(prisma.qrCollection.findMany.mock.calls[1][0].take).toBe(100);
  });

  it("builds the documented filters", async () => {
    await service.listCollections({
      status: "ATTRIBUTED",
      qrIdentifier: "QR-ALPHA",
      walletUserId: "+919999999999",
      utr: " u9 ",
      source: "WEBHOOK",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    });

    const { where } = prisma.qrCollection.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      status: "ATTRIBUTED",
      qrIdentifier: "QR-ALPHA",
      walletUserId: "+919999999999",
      utr: "U9",
      source: "WEBHOOK",
    });
    expect(where.receivedAt.gte).toBeInstanceOf(Date);
    expect(where.receivedAt.lte).toBeInstanceOf(Date);
  });

  it("listUnattributed forces status UNATTRIBUTED", async () => {
    await service.listUnattributed({ status: "ATTRIBUTED" });
    expect(prisma.qrCollection.findMany.mock.calls[0][0].where.status).toBe(
      "UNATTRIBUTED",
    );
  });
});

describe("serializeCollection", () => {
  it("withholds rawPayload and coerces the Decimal amount", () => {
    const out = service.serializeCollection({
      id: "x",
      amount: { toNumber: () => 12.34 },
      amountPaise: 1234,
      currency: "INR",
      rawPayload: { secret: "do-not-leak" },
      outletPaymentQrId: null,
      needsManualAction: true,
    });

    expect(out).not.toHaveProperty("rawPayload");
    expect(out.amount).toBe(12.34);
    expect(out.matched).toBe(false);
    expect(out.needsManualAction).toBe(true);
  });

  it("returns null for a null row", () => {
    expect(service.serializeCollection(null)).toBeNull();
  });
});
