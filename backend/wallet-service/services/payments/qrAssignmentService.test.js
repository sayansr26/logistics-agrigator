/* eslint-env jest */

/**
 * Unit tests for the unattributed-QR assignment flow.
 *
 * `manualTopupService` is MOCKED. This suite's job is to prove that the
 * assignment path (a) claims the collection under a guard, (b) hands the money
 * decision to the manual top-up module and NEVER moves money itself, and
 * (c) mirrors the settled outcome back onto the collection. Re-testing the caps
 * / maker-checker / idempotency is manualTopupService's own job.
 */

jest.mock("../../config/database", () => ({
  prisma: {
    qrCollection: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    manualTopupRequest: { findUnique: jest.fn() },
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
    class ConflictError extends APIError {
      constructor(message) {
        super(message, 409, "CONFLICT");
      }
    }
    class AuthorizationError extends APIError {
      constructor(message) {
        super(message, 403, "FORBIDDEN");
      }
    }
    return {
      APIError,
      ValidationError,
      NotFoundError,
      ConflictError,
      AuthorizationError,
    };
  },
  { virtual: true },
);

jest.mock("./manualTopupService", () => ({
  requestManualTopup: jest.fn(),
  setSettlementHandler: jest.fn(),
  REVIEWABLE_STATUSES: ["PENDING_APPROVAL", "FAILED"],
}));

jest.mock("./qrCollectionService", () => ({
  serializeCollection: (row) => row,
}));

const { prisma } = require("../../config/database");
const manualTopupService = require("./manualTopupService");
const service = require("./qrAssignmentService");

const COLLECTION_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const QR_ID = "22222222-2222-4222-8222-222222222222";
const SUBJECT = "33333333-3333-4333-8333-333333333333";
const ACTOR = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };
const SUPER = {
  id: "99999999-9999-4999-8999-999999999999",
  role: "superadmin",
};

const REASON = "Payer confirmed on call, matches outlet ledger entry";
const REMARKS = "Not our money — payer paid a different merchant by mistake";

/** In-memory QrCollection row driven by the fake Prisma delegate. */
let row;

function baseRow(overrides = {}) {
  return {
    id: COLLECTION_ID,
    provider: "ccavenue_upi_qr",
    status: "UNATTRIBUTED",
    utr: "UTR12345678",
    qrIdentifier: "QR-UNKNOWN",
    payerVpa: "payer@upi",
    amount: 5000,
    amountPaise: 500000,
    currency: "INR",
    unattributedReason: "NO_QR_MATCH",
    outletPaymentQrId: null,
    walletUserId: null,
    clientCode: null,
    subjectUserId: null,
    manualTopupRequestId: null,
    externalReferenceId: null,
    needsManualAction: false,
    lastError: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  row = baseRow();

  prisma.qrCollection.findUnique.mockImplementation(async () => ({ ...row }));
  prisma.qrCollection.updateMany.mockImplementation(async ({ where, data }) => {
    const allowed = where.status?.in ?? [];
    if (where.id === row.id && allowed.includes(row.status)) {
      Object.assign(row, data);
      return { count: 1 };
    }
    return { count: 0 };
  });
  prisma.qrCollection.update.mockImplementation(async ({ data }) => {
    Object.assign(row, data);
    return { ...row };
  });
  prisma.auditLog.create.mockResolvedValue({});
});

function auditActions() {
  return prisma.auditLog.create.mock.calls.map((c) => c[0].data.action);
}

describe("assignUnattributed", () => {
  it("claims UNATTRIBUTED -> ASSIGN_PENDING under a guard and delegates to manualTopupService", async () => {
    manualTopupService.requestManualTopup.mockResolvedValue({
      requestId: REQUEST_ID,
      status: "PENDING_APPROVAL",
      requiresApproval: true,
      threshold: 1000,
      request: { id: REQUEST_ID, externalReferenceId: `MANUAL_${REQUEST_ID}` },
    });

    const result = await service.assignUnattributed({
      collectionId: COLLECTION_ID,
      walletUserId: "9876543210",
      clientCode: "DEFAULT",
      subjectUserId: SUBJECT,
      outletPaymentQrId: QR_ID,
      reason: REASON,
      actor: ACTOR,
      ip: "1.2.3.4",
      userAgent: "jest",
    });

    // Guarded claim, never a bare update.
    const claim = prisma.qrCollection.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({
      id: COLLECTION_ID,
      status: { in: ["UNATTRIBUTED"] },
    });
    expect(claim.data.status).toBe("ASSIGN_PENDING");
    // The unattributed reason survives the claim so a release can restore context.
    expect(claim.data).not.toHaveProperty("unattributedReason");

    const body = manualTopupService.requestManualTopup.mock.calls[0][0].body;
    expect(body).toMatchObject({
      walletUserId: "9876543210",
      amount: 5000,
      reason: REASON,
      externalReference: "UTR12345678",
    });
    expect(body.metadata).toMatchObject({
      source: "UPI_QR",
      qrCollectionId: COLLECTION_ID,
      qrIdentifier: "QR-UNKNOWN",
      payerVpa: "payer@upi",
    });

    expect(row.manualTopupRequestId).toBe(REQUEST_ID);
    expect(row.outletPaymentQrId).toBe(QR_ID);
    expect(result.status).toBe("ASSIGN_PENDING");
    expect(result.requiresApproval).toBe(true);
    expect(result.credited).toBe(false);
    expect(auditActions()).toContain("QR_COLLECTION_ASSIGN_REQUESTED");
  });

  it("mirrors a below-threshold auto-credit onto the collection", async () => {
    manualTopupService.requestManualTopup.mockResolvedValue({
      requestId: REQUEST_ID,
      status: "CREDITED",
      requiresApproval: false,
      threshold: 100000,
      request: { id: REQUEST_ID, externalReferenceId: `MANUAL_${REQUEST_ID}` },
    });

    const result = await service.assignUnattributed({
      collectionId: COLLECTION_ID,
      walletUserId: "9876543210",
      reason: REASON,
      actor: ACTOR,
    });

    expect(result.credited).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(row.status).toBe("CREDITED");
    expect(row.unattributedReason).toBeNull();
    expect(auditActions()).toEqual(
      expect.arrayContaining([
        "QR_COLLECTION_ASSIGN_REQUESTED",
        "QR_COLLECTION_ASSIGN_CREDITED",
      ]),
    );
  });

  it("does not use the outletPaymentQrId to create or repoint an OutletPaymentQr row", async () => {
    manualTopupService.requestManualTopup.mockResolvedValue({
      requestId: REQUEST_ID,
      status: "CREDITED",
      requiresApproval: false,
      request: { id: REQUEST_ID },
    });

    await service.assignUnattributed({
      collectionId: COLLECTION_ID,
      walletUserId: "9876543210",
      outletPaymentQrId: QR_ID,
      reason: REASON,
      actor: ACTOR,
    });

    expect(prisma.outletPaymentQr).toBeUndefined();
  });

  it("409s QR_COLLECTION_NOT_ASSIGNABLE when the row is no longer UNATTRIBUTED", async () => {
    row.status = "ASSIGN_PENDING";

    await expect(
      service.assignUnattributed({
        collectionId: COLLECTION_ID,
        walletUserId: "9876543210",
        reason: REASON,
        actor: ACTOR,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "QR_COLLECTION_NOT_ASSIGNABLE",
    });

    expect(manualTopupService.requestManualTopup).not.toHaveBeenCalled();
  });

  it("409s QR_COLLECTION_ALREADY_ASSIGNED when a request is already linked", async () => {
    row.manualTopupRequestId = REQUEST_ID;

    await expect(
      service.assignUnattributed({
        collectionId: COLLECTION_ID,
        walletUserId: "9876543210",
        reason: REASON,
        actor: ACTOR,
      }),
    ).rejects.toMatchObject({ code: "QR_COLLECTION_ALREADY_ASSIGNED" });
  });

  it("422s without a reason and never touches the collection", async () => {
    await expect(
      service.assignUnattributed({
        collectionId: COLLECTION_ID,
        walletUserId: "9876543210",
        reason: "too short",
        actor: ACTOR,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "ASSIGN_REASON_REQUIRED",
    });

    expect(prisma.qrCollection.updateMany).not.toHaveBeenCalled();
    expect(manualTopupService.requestManualTopup).not.toHaveBeenCalled();
  });

  it("releases the claim back to UNATTRIBUTED when the cap refuses the request", async () => {
    const capError = Object.assign(new Error("cap exceeded"), {
      statusCode: 422,
      code: "MANUAL_TOPUP_CAP_EXCEEDED",
    });
    manualTopupService.requestManualTopup.mockRejectedValue(capError);

    await expect(
      service.assignUnattributed({
        collectionId: COLLECTION_ID,
        walletUserId: "9876543210",
        reason: REASON,
        actor: ACTOR,
      }),
    ).rejects.toMatchObject({ code: "MANUAL_TOPUP_CAP_EXCEEDED" });

    expect(row.status).toBe("UNATTRIBUTED");
    expect(row.manualTopupRequestId).toBeNull();
    expect(auditActions()).toContain("QR_COLLECTION_ASSIGN_RELEASED");
  });

  it("HOLDS the claim at ASSIGN_PENDING when the external credit failed (may have timed out)", async () => {
    const creditError = Object.assign(new Error("wallet API timeout"), {
      statusCode: 502,
      code: "MANUAL_TOPUP_CREDIT_FAILED",
      details: { requestId: REQUEST_ID, retryable: true },
    });
    manualTopupService.requestManualTopup.mockRejectedValue(creditError);

    await expect(
      service.assignUnattributed({
        collectionId: COLLECTION_ID,
        walletUserId: "9876543210",
        reason: REASON,
        actor: ACTOR,
      }),
    ).rejects.toMatchObject({ code: "MANUAL_TOPUP_CREDIT_FAILED" });

    expect(row.status).toBe("ASSIGN_PENDING");
    expect(row.manualTopupRequestId).toBe(REQUEST_ID);
    expect(row.needsManualAction).toBe(true);
    expect(auditActions()).toContain("QR_COLLECTION_ASSIGN_FAILED");
  });
});

describe("rejectCollection", () => {
  it("refuses a non-superadmin", async () => {
    await expect(
      service.rejectCollection({
        collectionId: COLLECTION_ID,
        remarks: REMARKS,
        actor: ACTOR,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "SUPERADMIN_REQUIRED" });
  });

  it("requires remarks of at least 10 characters", async () => {
    await expect(
      service.rejectCollection({
        collectionId: COLLECTION_ID,
        remarks: "nope",
        actor: SUPER,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "REJECT_REMARKS_REQUIRED",
    });
  });

  it("moves UNATTRIBUTED -> REJECTED and never credits", async () => {
    const result = await service.rejectCollection({
      collectionId: COLLECTION_ID,
      remarks: REMARKS,
      actor: SUPER,
    });

    expect(row.status).toBe("REJECTED");
    expect(row.rejectedBy).toBe(SUPER.id);
    expect(result.status).toBe("REJECTED");
    expect(manualTopupService.requestManualTopup).not.toHaveBeenCalled();
    expect(auditActions()).toContain("QR_COLLECTION_REJECTED");
  });

  it("refuses while a reviewable manual top-up request is still linked", async () => {
    row.status = "ASSIGN_PENDING";
    row.manualTopupRequestId = REQUEST_ID;
    prisma.manualTopupRequest.findUnique.mockResolvedValue({
      id: REQUEST_ID,
      status: "PENDING_APPROVAL",
    });

    await expect(
      service.rejectCollection({
        collectionId: COLLECTION_ID,
        remarks: REMARKS,
        actor: SUPER,
      }),
    ).rejects.toMatchObject({ code: "QR_COLLECTION_HAS_PENDING_REQUEST" });

    expect(row.status).toBe("ASSIGN_PENDING");
  });

  it("409s when the collection is already terminal", async () => {
    row.status = "CREDITED";

    await expect(
      service.rejectCollection({
        collectionId: COLLECTION_ID,
        remarks: REMARKS,
        actor: SUPER,
      }),
    ).rejects.toMatchObject({ code: "QR_COLLECTION_NOT_REJECTABLE" });
  });
});

describe("onManualTopupSettled", () => {
  beforeEach(() => {
    row = baseRow({
      status: "ASSIGN_PENDING",
      manualTopupRequestId: REQUEST_ID,
    });
    prisma.qrCollection.findUnique.mockImplementation(async () => ({ ...row }));
  });

  const settled = (overrides) => ({
    id: REQUEST_ID,
    walletUserId: "9876543210",
    clientCode: "DEFAULT",
    amount: 5000,
    externalReferenceId: `MANUAL_${REQUEST_ID}`,
    requestedBy: ACTOR.id,
    reviewedBy: SUPER.id,
    metadata: { source: "UPI_QR", qrCollectionId: COLLECTION_ID },
    ...overrides,
  });

  it("ignores an ordinary manual top-up with no qrCollectionId", async () => {
    const out = await service.onManualTopupSettled({
      request: { id: REQUEST_ID, status: "CREDITED", metadata: null },
    });

    expect(out).toEqual({ handled: false, reason: "NOT_QR_ORIGINATED" });
    expect(prisma.qrCollection.updateMany).not.toHaveBeenCalled();
  });

  it("CREDITED -> collection CREDITED", async () => {
    const out = await service.onManualTopupSettled({
      request: settled({ status: "CREDITED", externalTransactionId: "TXN1" }),
    });

    expect(out).toEqual({ handled: true, status: "CREDITED" });
    expect(row.status).toBe("CREDITED");
    expect(row.unattributedReason).toBeNull();
    expect(auditActions()).toContain("QR_COLLECTION_ASSIGN_CREDITED");
  });

  it("REJECTED -> collection back to UNATTRIBUTED with the link cleared", async () => {
    const out = await service.onManualTopupSettled({
      request: settled({
        status: "REJECTED",
        reviewRemarks: "wrong outlet entirely",
      }),
    });

    expect(out).toEqual({ handled: true, status: "UNATTRIBUTED" });
    expect(row.status).toBe("UNATTRIBUTED");
    expect(row.manualTopupRequestId).toBeNull();
    expect(row.walletUserId).toBeNull();
    expect(auditActions()).toContain("QR_COLLECTION_ASSIGN_RELEASED");
  });

  it("FAILED -> stays ASSIGN_PENDING with needsManualAction and lastError", async () => {
    const out = await service.onManualTopupSettled({
      request: settled({ status: "FAILED", creditError: "gateway 503" }),
    });

    expect(out).toEqual({ handled: true, status: "ASSIGN_PENDING" });
    expect(row.status).toBe("ASSIGN_PENDING");
    expect(row.needsManualAction).toBe(true);
    expect(row.lastError).toContain("gateway 503");
  });

  it("skips a settlement whose request does not match the collection's link", async () => {
    row.manualTopupRequestId = "66666666-6666-4666-8666-666666666666";

    const out = await service.onManualTopupSettled({
      request: settled({ status: "CREDITED" }),
    });

    expect(out).toEqual({ handled: false, reason: "REQUEST_LINK_MISMATCH" });
    expect(row.status).toBe("ASSIGN_PENDING");
  });

  it("never throws, even when the database explodes", async () => {
    prisma.qrCollection.findUnique.mockRejectedValue(new Error("db down"));

    await expect(
      service.onManualTopupSettled({
        request: settled({ status: "CREDITED" }),
      }),
    ).resolves.toEqual({ handled: false, reason: "HANDLER_ERROR" });
  });
});

describe("registerSettlementHandler", () => {
  it("registers onManualTopupSettled on the manualTopupService seam", () => {
    service.registerSettlementHandler();
    expect(manualTopupService.setSettlementHandler).toHaveBeenCalledWith(
      service.onManualTopupSettled,
    );
  });
});
