/**
 * Unattributed static-QR payment ASSIGNMENT — Wave 3.4
 *
 * WHAT THIS IS
 * ------------
 * Money arrived on the static-UPI-QR channel that we could NOT attribute
 * automatically: the QR identifier resolved to nothing, it matched a retired
 * QR, or the notification carried no identifier at all. The row sits at
 * `UNATTRIBUTED` and a human has to say which wallet it belongs to.
 *
 * WHY THIS MODULE OWNS NO MONEY PATH
 * ----------------------------------
 * "An admin decides that wallet X gets ₹N on the strength of off-system
 * evidence" is EXACTLY the manual-top-up risk shape, so this module raises a
 * `ManualTopupRequest` and lets `manualTopupService` do the crediting. It
 * inherits, for free and without a second implementation to keep in sync:
 *
 *   - the per-transaction cap and the per-user daily cap;
 *   - the policy snapshot (`thresholdAtRequest` / `capAtRequest`) so a later
 *     policy edit cannot rewrite the rule a past credit was judged under;
 *   - maker-checker: at/above the threshold the credit is parked for a
 *     SUPERADMIN, enforced three ways (`wallet:approve:all`, which `admin`
 *     deliberately lacks; an explicit role assertion; and maker != checker);
 *   - `MANUAL_<id>` deterministic external idempotency, so a retry either
 *     lands once or comes back 409 (= already landed);
 *   - the full manual-credit register, which an auditor can read as ONE table.
 *
 * `ManualTopupRequest.externalReference` is documented as "bank UTR / NEFT ref
 * / cheque no". The QR case fills it with the actual UTR — its intended use.
 *
 * >>> THERE IS NO CALL TO THE EXTERNAL WALLET CLIENT ANYWHERE IN THIS FILE.
 * >>> The ONLY way a rupee moves on this path is
 * >>> `manualTopupService.requestManualTopup()` / `.approve()`.
 *
 * THE TWO HALVES
 * --------------
 *   MAKER   `assignUnattributed()` — claims the collection, raises the request.
 *           It never credits, not even below the threshold: below-threshold
 *           credits happen INSIDE `requestManualTopup`, under that module's
 *           caps and audit.
 *   CHECKER the superadmin approves/rejects the `ManualTopupRequest` on the
 *           EXISTING manual top-up endpoints. `onManualTopupSettled()` then
 *           moves the collection to match. It is a push callback, not a poll,
 *           so `ManualTopupRequest.status` stays the single source of truth.
 *
 * @module services/payments/qrAssignmentService
 */

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");
const {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} = require("../../shared/lib/errors");
const manualTopupService = require("./manualTopupService");
const qrCollectionService = require("./qrCollectionService");

const AUDIT_RESOURCE = "QrCollection";

/** Audit actions owned by this module. */
const AUDIT_ACTIONS = Object.freeze({
  QR_COLLECTION_ASSIGN_REQUESTED: "QR_COLLECTION_ASSIGN_REQUESTED",
  QR_COLLECTION_ASSIGN_CREDITED: "QR_COLLECTION_ASSIGN_CREDITED",
  QR_COLLECTION_ASSIGN_RELEASED: "QR_COLLECTION_ASSIGN_RELEASED",
  QR_COLLECTION_ASSIGN_FAILED: "QR_COLLECTION_ASSIGN_FAILED",
  QR_COLLECTION_REJECTED: "QR_COLLECTION_REJECTED",
});

/** The only status a collection may be assigned FROM. */
const ASSIGNABLE_STATUSES = Object.freeze(["UNATTRIBUTED"]);

/** Statuses a collection may be rejected FROM. */
const REJECTABLE_STATUSES = Object.freeze(["UNATTRIBUTED", "ASSIGN_PENDING"]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_REASON_LENGTH = 10;

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

/**
 * 422 + a machine code for a business-rule refusal (the payload is well formed;
 * it is the rule that says no). Mirrors `manualTopupService.policyError`.
 * @private
 */
function policyError(message, code, details = null) {
  const error = new ValidationError(message, details);
  error.code = code;
  error.statusCode = 422;
  return error;
}

/** @private */
function conflictError(message, code, details = null) {
  const error = new ConflictError(message);
  error.code = code;
  error.details = details;
  return error;
}

/** @private */
function notFoundError(message, code, details = null) {
  const error = new NotFoundError(message);
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Layer (b) of the superadmin gate, copied in intent from
 * `manualTopupService.assertSuperadmin`.
 *
 * WHY NOT `authMiddleware.requireRole(["superadmin"])`: `shared/lib/auth.js`
 * short-circuits with `if (userRole === "admin" || userRole === "superadmin")
 * return next()`, so requireRole hands ADMIN every role list it is given and is
 * structurally incapable of expressing a superadmin-only gate.
 *
 * Layer (a) is the route's `wallet:approve:all` permission, which the `admin`
 * role deliberately does not hold.
 *
 * @private
 * @throws {AuthorizationError} 403 SUPERADMIN_REQUIRED
 */
function assertSuperadmin(actor) {
  if (actor?.role !== "superadmin") {
    const error = new AuthorizationError(
      "Only a superadmin may reject an unattributed QR collection.",
    );
    error.code = "SUPERADMIN_REQUIRED";
    error.details = {
      requiredRole: "superadmin",
      yourRole: actor?.role ?? null,
    };
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** @private */
function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/** @private */
function toNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** @private */
function truncate(value, max) {
  const text = String(value === null || value === undefined ? "" : value);
  return text.length > max ? text.slice(0, max) : text;
}

/** @private */
function trimOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** Prisma unique-constraint violation. @private */
function isUniqueViolation(error) {
  return error?.code === "P2002";
}

/**
 * Standalone audit write. The state change has already committed by the time we
 * get here, so a failing audit insert is logged loudly rather than allowed to
 * roll back a transition — and NEVER allowed to roll back a credit.
 * @private
 */
async function writeAudit({
  action,
  resourceId,
  userId,
  details,
  ip,
  userAgent,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        // AuditLog.userId is @db.Uuid — only a LOCAL portal uuid belongs here.
        // `walletUserId` is a phone number and rides in `details`.
        userId: isUuid(userId) ? userId : null,
        action,
        resource: AUDIT_RESOURCE,
        resourceId: isUuid(resourceId) ? resourceId : null,
        details: details || {},
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (error) {
    logger.error("AUDIT WRITE FAILED for QR collection assignment", {
      action,
      resourceId,
      error: error.message,
    });
  }
}

/**
 * A state transition that is safe under concurrency.
 *
 * `updateMany` with the from-statuses in the WHERE clause makes Postgres the
 * arbiter: two admins clicking Assign at the same instant produce exactly one
 * `count: 1` and one `count: 0`. A read-then-write would let both pass the read
 * and raise two top-up requests for the same rupees. A bare `update` is never
 * used on this path.
 *
 * @private
 * @returns {Promise<?Object>} the updated row, or null when the guard lost
 */
async function guardedTransition(collectionId, fromStatuses, data) {
  const { count } = await prisma.qrCollection.updateMany({
    where: { id: collectionId, status: { in: fromStatuses } },
    data,
  });

  if (count === 0) return null;

  return prisma.qrCollection.findUnique({ where: { id: collectionId } });
}

/** @private */
async function loadCollectionOrThrow(collectionId) {
  if (!isUuid(collectionId)) {
    throw policyError(
      "collectionId must be a valid UUID.",
      "QR_COLLECTION_ID_INVALID",
      { collectionId: collectionId ?? null },
    );
  }

  const row = await prisma.qrCollection.findUnique({
    where: { id: collectionId },
  });

  if (!row) {
    throw notFoundError(
      `QR collection '${collectionId}' was not found.`,
      "QR_COLLECTION_NOT_FOUND",
      { collectionId },
    );
  }

  return row;
}

/* ------------------------------------------------------------------ *
 * MAKER — assign an unattributed collection
 * ------------------------------------------------------------------ */

/**
 * Assign an unattributed QR payment to a wallet. THE MAKER STEP.
 *
 * THIS FUNCTION MOVES NO MONEY. It claims the row and delegates to
 * `manualTopupService.requestManualTopup`, which applies the caps and the
 * maker-checker threshold and is the only code that talks to the wallet API.
 *
 * At or above the threshold the request parks at `PENDING_APPROVAL` and the
 * collection stays `ASSIGN_PENDING` until a *different* superadmin approves it;
 * `onManualTopupSettled` then moves the collection.
 *
 * @param {Object} args
 * @param {string} args.collectionId          QrCollection.id (uuid)
 * @param {string} args.walletUserId          EXTERNAL wallet id (phone for outlets)
 * @param {string} [args.clientCode]
 * @param {string} [args.subjectUserId]       local users.id, when one exists
 * @param {string} [args.outletPaymentQrId]   bind this collection to a QR row
 * @param {string} args.reason                MANDATORY, min 10 chars
 * @param {Object} args.actor                 req.user
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<{collection: Object, manualTopupRequest: Object,
 *   credited: boolean, requiresApproval: boolean, status: string}>}
 * @throws {ValidationError}    422 ASSIGN_REASON_REQUIRED / QR_COLLECTION_AMOUNT_INVALID
 * @throws {NotFoundError}      404 QR_COLLECTION_NOT_FOUND
 * @throws {ConflictError}      409 QR_COLLECTION_NOT_ASSIGNABLE / QR_COLLECTION_ALREADY_ASSIGNED
 * @throws {ValidationError}    422 MANUAL_TOPUP_CAP_EXCEEDED (surfaced from manualTopupService)
 */
async function assignUnattributed({
  collectionId,
  walletUserId,
  clientCode,
  subjectUserId,
  outletPaymentQrId,
  reason,
  actor,
  ip,
  userAgent,
} = {}) {
  // --- Defence in depth. Joi enforces these on the HTTP path, but the reason
  // --- is the entire audit value of a human attribution, so the service
  // --- refuses without it even if called from an unvalidated caller.
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (cleanReason.length < MIN_REASON_LENGTH) {
    throw policyError(
      `A reason of at least ${MIN_REASON_LENGTH} characters is required to assign an unattributed QR payment.`,
      "ASSIGN_REASON_REQUIRED",
      { collectionId: collectionId ?? null },
    );
  }

  const cleanWalletUserId = trimOrNull(walletUserId);
  if (!cleanWalletUserId) {
    throw policyError(
      "walletUserId is required (the external wallet id, e.g. the outlet's phone number).",
      "WALLET_IDENTITY_UNAVAILABLE",
      { collectionId: collectionId ?? null },
    );
  }

  if (
    outletPaymentQrId !== undefined &&
    outletPaymentQrId !== null &&
    !isUuid(outletPaymentQrId)
  ) {
    throw policyError(
      "outletPaymentQrId must be a valid UUID.",
      "QR_BINDING_INVALID",
      { outletPaymentQrId },
    );
  }

  const collection = await loadCollectionOrThrow(collectionId);

  const amount = toNumber(collection.amount);
  if (amount === null || amount <= 0) {
    throw policyError(
      "This QR collection has no positive amount and cannot be assigned.",
      "QR_COLLECTION_AMOUNT_INVALID",
      { collectionId, amount },
    );
  }

  if (collection.manualTopupRequestId) {
    throw conflictError(
      `This QR collection is already linked to manual top-up request '${collection.manualTopupRequestId}'.`,
      "QR_COLLECTION_ALREADY_ASSIGNED",
      {
        collectionId,
        manualTopupRequestId: collection.manualTopupRequestId,
        currentStatus: collection.status,
      },
    );
  }

  // ---------------------------------------------------------------- 1. CLAIM
  // UNATTRIBUTED -> ASSIGN_PENDING, guarded. `unattributedReason` is left AS IS
  // on purpose: if the top-up request is later rejected the row returns to
  // UNATTRIBUTED and must still say why it was unattributable in the first
  // place. It is cleared only when the collection finally reaches CREDITED.
  const claimData = {
    status: "ASSIGN_PENDING",
    walletUserId: cleanWalletUserId,
    clientCode: trimOrNull(clientCode),
    subjectUserId: isUuid(subjectUserId) ? subjectUserId : null,
    attributedBy: isUuid(actor?.id) ? actor.id : null,
    attributedAt: new Date(),
    remarks: truncate(cleanReason, 2000),
    lastError: null,
    needsManualAction: false,
  };

  // Optional forward binding: record WHICH QR this payment is being read as.
  // We deliberately do NOT create or repoint an `OutletPaymentQr` row here —
  // that is the registry's job and it is gated on `settings:manage:all`,
  // because repointing a QR changes where every FUTURE payment on it lands.
  if (isUuid(outletPaymentQrId)) {
    claimData.outletPaymentQrId = outletPaymentQrId;
  }

  const claimed = await guardedTransition(
    collectionId,
    ASSIGNABLE_STATUSES,
    claimData,
  );

  if (!claimed) {
    const current = await prisma.qrCollection.findUnique({
      where: { id: collectionId },
      select: { status: true, manualTopupRequestId: true, walletUserId: true },
    });

    throw conflictError(
      `This QR collection is not assignable (current status: ${current?.status ?? "UNKNOWN"}). Only an UNATTRIBUTED collection can be assigned.`,
      "QR_COLLECTION_NOT_ASSIGNABLE",
      {
        collectionId,
        currentStatus: current?.status ?? null,
        manualTopupRequestId: current?.manualTopupRequestId ?? null,
        assignableFrom: ASSIGNABLE_STATUSES,
      },
    );
  }

  // ------------------------------------------------------- 2. RAISE THE REQUEST
  let result;
  try {
    result = await manualTopupService.requestManualTopup({
      actor,
      body: {
        walletUserId: cleanWalletUserId,
        clientCode: claimed.clientCode ?? undefined,
        subjectUserId: claimed.subjectUserId ?? undefined,
        amount,
        currency: collection.currency || "INR",
        reason: cleanReason,
        // The bank's own reference for this transfer — precisely what
        // `externalReference` ("bank UTR / NEFT ref / cheque no") is for. The
        // collection id is the fallback for a UTR-less notification.
        externalReference: collection.utr || collection.id,
        metadata: {
          source: "UPI_QR",
          qrCollectionId: collection.id,
          qrIdentifier: collection.qrIdentifier ?? null,
          payerVpa: collection.payerVpa ?? null,
          utr: collection.utr ?? null,
          outletPaymentQrId:
            claimData.outletPaymentQrId ?? collection.outletPaymentQrId ?? null,
        },
      },
      ip,
      userAgent,
    });
  } catch (error) {
    await handleRequestRaiseFailure({
      collection: claimed,
      error,
      actor,
      ip,
      userAgent,
    });
    throw error;
  }

  const requestId = result.requestId;
  const requiresApproval = Boolean(result.requiresApproval);
  const credited = result.status === "CREDITED";

  // ------------------------------------------------------------- 3. STAMP LINK
  // `qr_collections_manual_request_uniq` is a PARTIAL UNIQUE INDEX on
  // ("manualTopupRequestId") WHERE NOT NULL, so the database itself is the last
  // line of defence against two collections sharing one request.
  let linked = claimed;
  try {
    linked = await prisma.qrCollection.update({
      where: { id: collection.id },
      data: {
        manualTopupRequestId: requestId,
        externalReferenceId:
          result.request?.externalReferenceId ?? `MANUAL_${requestId}`,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      logger.error(
        "QR collection assign lost the link race — manual top-up request already linked elsewhere",
        { collectionId: collection.id, requestId, error: error.message },
      );

      await writeAudit({
        action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_FAILED,
        resourceId: collection.id,
        userId: actor?.id,
        details: { requestId, error: "MANUAL_REQUEST_ALREADY_LINKED" },
        ip,
        userAgent,
      });

      throw conflictError(
        "This QR collection could not be linked to its manual top-up request because the request is already linked to another collection.",
        "QR_COLLECTION_ALREADY_ASSIGNED",
        { collectionId: collection.id, manualTopupRequestId: requestId },
      );
    }

    // A non-unique failure must NOT lose the request: the row exists (and may
    // already have credited). Stamp what we can and keep going — the audit line
    // below still records the requestId, so the link is recoverable by hand.
    logger.error("Could not stamp manualTopupRequestId on QR collection", {
      collectionId: collection.id,
      requestId,
      error: error.message,
    });
  }

  await writeAudit({
    action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_REQUESTED,
    resourceId: collection.id,
    userId: actor?.id,
    details: {
      walletUserId: cleanWalletUserId,
      clientCode: linked.clientCode ?? null,
      subjectUserId: linked.subjectUserId ?? null,
      outletPaymentQrId: claimData.outletPaymentQrId ?? null,
      amount,
      currency: collection.currency,
      utr: collection.utr ?? null,
      reason: cleanReason,
      requestId,
      requiresApproval,
      credited,
      previousStatus: collection.status,
      unattributedReason: collection.unattributedReason ?? null,
    },
    ip,
    userAgent,
  });

  // ---------------------------------------------------------- 4. SETTLE OR PARK
  let finalCollection = linked;

  if (credited) {
    // Below the threshold `requestManualTopup` already credited, inside its own
    // caps and audit. Nothing is credited here; we only mirror the outcome.
    const settledRow = await guardedTransition(
      collection.id,
      ["ASSIGN_PENDING"],
      {
        status: "CREDITED",
        unattributedReason: null,
        lastError: null,
        needsManualAction: false,
      },
    );

    if (settledRow) {
      finalCollection = settledRow;

      await writeAudit({
        action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_CREDITED,
        resourceId: collection.id,
        userId: actor?.id,
        details: {
          requestId,
          walletUserId: cleanWalletUserId,
          amount,
          autoApproved: true,
          reason: "Below the maker-checker threshold",
        },
        ip,
        userAgent,
      });
    } else {
      logger.warn(
        "QR collection moved out of ASSIGN_PENDING before the credit could be mirrored",
        { collectionId: collection.id, requestId },
      );
    }
  }

  logger.info("Unattributed QR collection assigned", {
    collectionId: collection.id,
    requestId,
    walletUserId: cleanWalletUserId,
    amount,
    requiresApproval,
    credited,
    actorId: actor?.id,
  });

  return {
    collection: qrCollectionService.serializeCollection(finalCollection),
    manualTopupRequest: result.request ?? null,
    credited,
    requiresApproval,
    status: finalCollection.status,
    requestId,
    threshold: result.threshold ?? null,
  };
}

/**
 * `requestManualTopup` threw. Decide whether the claim may be released.
 *
 * TWO VERY DIFFERENT FAILURES:
 *
 *  - MANUAL_TOPUP_CREDIT_FAILED (502): the request ROW EXISTS and its external
 *    credit failed. A failure here can be a TIMEOUT, which means the money may
 *    or may not have moved. Releasing the collection back to UNATTRIBUTED would
 *    invite a second assignment under a FRESH `externalReferenceId` — and a
 *    fresh reference defeats the external API's idempotency, i.e. a genuine
 *    double credit. So the row STAYS at ASSIGN_PENDING, linked, flagged
 *    `needsManualAction`. The retry path is approving the existing request,
 *    whose reference is deterministic.
 *
 *  - anything else (cap breach, daily cap, identity): the caps are checked
 *    BEFORE any row is written, so no request exists and no money moved. The
 *    claim is released so the collection re-enters the unattributed queue
 *    instead of being stranded by a validation error.
 *
 * @private
 */
async function handleRequestRaiseFailure({
  collection,
  error,
  actor,
  ip,
  userAgent,
}) {
  const requestId = error?.details?.requestId ?? null;
  const creditAttempted = error?.code === "MANUAL_TOPUP_CREDIT_FAILED";

  if (creditAttempted) {
    try {
      await prisma.qrCollection.update({
        where: { id: collection.id },
        data: {
          manualTopupRequestId: requestId,
          needsManualAction: true,
          lastError: truncate(
            `MANUAL_TOPUP_CREDIT_FAILED: ${error.message}`,
            2000,
          ),
        },
      });
    } catch (stampError) {
      logger.error("Could not stamp a failed assignment on a QR collection", {
        collectionId: collection.id,
        error: stampError.message,
      });
    }

    await writeAudit({
      action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_FAILED,
      resourceId: collection.id,
      userId: actor?.id,
      details: {
        requestId,
        error: truncate(error.message, 500),
        code: error.code ?? null,
        heldAt: "ASSIGN_PENDING",
        retryable: true,
        note: "Retry by APPROVING the manual top-up request — its externalReferenceId is deterministic, so a re-credit either lands once or returns 409 (already landed).",
      },
      ip,
      userAgent,
    });

    return;
  }

  // No request row, no money movement — safe to release.
  const released = await guardedTransition(collection.id, ["ASSIGN_PENDING"], {
    status: "UNATTRIBUTED",
    walletUserId: null,
    clientCode: null,
    subjectUserId: null,
    attributedBy: null,
    attributedAt: null,
    manualTopupRequestId: null,
  });

  await writeAudit({
    action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_RELEASED,
    resourceId: collection.id,
    userId: actor?.id,
    details: {
      error: truncate(error?.message ?? "unknown", 500),
      code: error?.code ?? null,
      released: Boolean(released),
      note: "The manual top-up request was refused before any row was written; no money moved.",
    },
    ip,
    userAgent,
  });
}

/* ------------------------------------------------------------------ *
 * Terminal rejection — "this is not our money"
 * ------------------------------------------------------------------ */

/**
 * Mark a collection as not-ours. SUPERADMIN ONLY. NEVER CREDITS — there is no
 * call to `manualTopupService` and no external call anywhere on this path.
 *
 * A collection whose manual top-up request is still PENDING_APPROVAL is refused
 * (409 QR_COLLECTION_HAS_PENDING_REQUEST): rejecting it here would leave a live
 * request that could still credit and then drag the row back out of REJECTED
 * via `onManualTopupSettled`. Reject the manual top-up request instead — that
 * returns the collection to UNATTRIBUTED, and it can then be rejected.
 *
 * @param {Object} args
 * @param {string} args.collectionId
 * @param {string} args.remarks REQUIRED, min 10 chars
 * @param {Object} args.actor req.user (superadmin)
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<{collection: Object, status: "REJECTED", remarks: string}>}
 */
async function rejectCollection({
  collectionId,
  remarks,
  actor,
  ip,
  userAgent,
} = {}) {
  assertSuperadmin(actor);

  const cleanRemarks = typeof remarks === "string" ? remarks.trim() : "";
  if (cleanRemarks.length < MIN_REASON_LENGTH) {
    throw policyError(
      `Rejection remarks are required and must be at least ${MIN_REASON_LENGTH} characters.`,
      "REJECT_REMARKS_REQUIRED",
      { collectionId: collectionId ?? null },
    );
  }

  const collection = await loadCollectionOrThrow(collectionId);

  if (collection.manualTopupRequestId) {
    const linkedRequest = await prisma.manualTopupRequest.findUnique({
      where: { id: collection.manualTopupRequestId },
      select: { id: true, status: true },
    });

    if (
      linkedRequest &&
      manualTopupService.REVIEWABLE_STATUSES.includes(linkedRequest.status)
    ) {
      throw conflictError(
        `This QR collection is linked to manual top-up request '${linkedRequest.id}' (status ${linkedRequest.status}). Reject that request first — the collection returns to UNATTRIBUTED and can then be rejected.`,
        "QR_COLLECTION_HAS_PENDING_REQUEST",
        {
          collectionId,
          manualTopupRequestId: linkedRequest.id,
          requestStatus: linkedRequest.status,
        },
      );
    }
  }

  const rejected = await guardedTransition(collectionId, REJECTABLE_STATUSES, {
    status: "REJECTED",
    rejectedBy: isUuid(actor?.id) ? actor.id : null,
    rejectedAt: new Date(),
    remarks: truncate(cleanRemarks, 2000),
    needsManualAction: false,
  });

  if (!rejected) {
    const current = await prisma.qrCollection.findUnique({
      where: { id: collectionId },
      select: { status: true },
    });

    throw conflictError(
      `This QR collection cannot be rejected (current status: ${current?.status ?? "UNKNOWN"}).`,
      "QR_COLLECTION_NOT_REJECTABLE",
      {
        collectionId,
        currentStatus: current?.status ?? null,
        rejectableFrom: REJECTABLE_STATUSES,
      },
    );
  }

  await writeAudit({
    action: AUDIT_ACTIONS.QR_COLLECTION_REJECTED,
    resourceId: collectionId,
    userId: actor?.id,
    details: {
      previousStatus: collection.status,
      amount: toNumber(collection.amount),
      currency: collection.currency,
      utr: collection.utr ?? null,
      qrIdentifier: collection.qrIdentifier ?? null,
      payerVpa: collection.payerVpa ?? null,
      remarks: cleanRemarks,
      rejectedBy: actor?.id ?? null,
      credited: false,
    },
    ip,
    userAgent,
  });

  logger.info("QR collection rejected as not-ours", {
    collectionId,
    previousStatus: collection.status,
    rejectedBy: actor?.id,
  });

  return {
    collection: qrCollectionService.serializeCollection(rejected),
    status: "REJECTED",
    remarks: cleanRemarks,
  };
}

/* ------------------------------------------------------------------ *
 * CHECKER — the completion callback
 * ------------------------------------------------------------------ */

/**
 * Move a QR collection to match the manual top-up request that has just settled.
 *
 * WHY A CALLBACK AND NOT A POLLER: a poller would be a SECOND source of truth
 * for "did this credit happen", and the two would disagree the moment one of
 * them lagged. `ManualTopupRequest.status` is the record; this handler only
 * mirrors it onto the collection.
 *
 * NEVER THROWS. It runs AFTER the money has already moved, so a failure here
 * must not roll a credit back — it is logged, and the collection is left in a
 * state an admin or the reconcile queue can drive forward.
 *
 * TRANSITIONS
 *   request CREDITED -> collection ASSIGN_PENDING            -> CREDITED
 *   request REJECTED -> collection ASSIGN_PENDING            -> UNATTRIBUTED
 *                       (link cleared, so it can be re-assigned; it re-enters
 *                        the queue instead of silently vanishing)
 *   request FAILED   -> collection stays ASSIGN_PENDING, needsManualAction
 *
 * @param {Object} args
 * @param {Object} args.request the settled ManualTopupRequest row
 * @returns {Promise<{handled: boolean, reason?: string, status?: string}>}
 */
async function onManualTopupSettled({ request } = {}) {
  try {
    const collectionId = request?.metadata?.qrCollectionId ?? null;

    // An ordinary manual top-up (NEFT, cheque, cash). Not ours.
    if (!collectionId) return { handled: false, reason: "NOT_QR_ORIGINATED" };

    const collection = await prisma.qrCollection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      logger.warn("Settled manual top-up references an unknown QR collection", {
        requestId: request.id,
        collectionId,
      });
      return { handled: false, reason: "COLLECTION_NOT_FOUND" };
    }

    // A link to a DIFFERENT request means something re-assigned this row; do not
    // let a stale settlement overwrite the live one.
    if (
      collection.manualTopupRequestId &&
      collection.manualTopupRequestId !== request.id
    ) {
      logger.warn(
        "Settled manual top-up does not match the collection's link",
        {
          requestId: request.id,
          collectionId,
          linkedRequestId: collection.manualTopupRequestId,
        },
      );
      return { handled: false, reason: "REQUEST_LINK_MISMATCH" };
    }

    if (request.status === "CREDITED") {
      const credited = await guardedTransition(
        collectionId,
        ["ASSIGN_PENDING", "UNATTRIBUTED"],
        {
          status: "CREDITED",
          manualTopupRequestId: request.id,
          externalReferenceId: request.externalReferenceId ?? null,
          unattributedReason: null,
          lastError: null,
          needsManualAction: false,
        },
      );

      if (!credited) {
        logger.warn(
          "QR collection was not in a creditable state on settlement",
          {
            requestId: request.id,
            collectionId,
            currentStatus: collection.status,
          },
        );
        return { handled: false, reason: "NOT_IN_ASSIGN_PENDING" };
      }

      await writeAudit({
        action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_CREDITED,
        resourceId: collectionId,
        userId: request.reviewedBy,
        details: {
          requestId: request.id,
          walletUserId: request.walletUserId,
          clientCode: request.clientCode,
          amount: toNumber(request.amount),
          externalReferenceId: request.externalReferenceId ?? null,
          externalTransactionId: request.externalTransactionId ?? null,
          approvedBy: request.reviewedBy ?? null,
          requestedBy: request.requestedBy ?? null,
          autoApproved: false,
        },
      });

      return { handled: true, status: "CREDITED" };
    }

    if (request.status === "REJECTED") {
      // Back into the queue, NOT to REJECTED. A superadmin refusing "credit
      // wallet X" has not said "this money is not ours" — only that this
      // attribution was wrong. The payment still has to be attributed to
      // someone, so it must stay visible. `rejectCollection` is the separate,
      // deliberate act for "not our money".
      const released = await guardedTransition(
        collectionId,
        ["ASSIGN_PENDING"],
        {
          status: "UNATTRIBUTED",
          manualTopupRequestId: null,
          externalReferenceId: null,
          walletUserId: null,
          clientCode: null,
          subjectUserId: null,
          attributedBy: null,
          attributedAt: null,
          needsManualAction: false,
          lastError: null,
        },
      );

      if (!released) {
        logger.warn("QR collection was not in ASSIGN_PENDING on rejection", {
          requestId: request.id,
          collectionId,
          currentStatus: collection.status,
        });
        return { handled: false, reason: "NOT_IN_ASSIGN_PENDING" };
      }

      await writeAudit({
        action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_RELEASED,
        resourceId: collectionId,
        userId: request.reviewedBy,
        details: {
          requestId: request.id,
          rejectedBy: request.reviewedBy ?? null,
          requestedBy: request.requestedBy ?? null,
          reviewRemarks: request.reviewRemarks ?? null,
          proposedWalletUserId: request.walletUserId,
          amount: toNumber(request.amount),
          returnedTo: "UNATTRIBUTED",
          credited: false,
        },
      });

      return { handled: true, status: "UNATTRIBUTED" };
    }

    if (request.status === "FAILED") {
      // The credit was attempted and did not confirm. Hold the row where it is:
      // it stays linked to a request whose `externalReferenceId` is
      // deterministic, so approving again is the safe retry.
      try {
        await prisma.qrCollection.update({
          where: { id: collectionId },
          data: {
            needsManualAction: true,
            lastError: truncate(
              `MANUAL_TOPUP_FAILED: ${request.creditError ?? "unknown error"}`,
              2000,
            ),
          },
        });
      } catch (error) {
        logger.error("Could not stamp a failed settlement on a QR collection", {
          collectionId,
          error: error.message,
        });
      }

      await writeAudit({
        action: AUDIT_ACTIONS.QR_COLLECTION_ASSIGN_FAILED,
        resourceId: collectionId,
        userId: request.reviewedBy,
        details: {
          requestId: request.id,
          creditError: truncate(request.creditError ?? "", 500),
          heldAt: "ASSIGN_PENDING",
          retryable: true,
        },
      });

      return { handled: true, status: "ASSIGN_PENDING" };
    }

    return { handled: false, reason: `UNHANDLED_STATUS_${request.status}` };
  } catch (error) {
    // Belt and braces: `manualTopupService` already swallows a handler throw so
    // a settled credit is never rolled back. This catch means the handler does
    // not even rely on that.
    logger.error("QR settlement handler failed", {
      requestId: request?.id ?? null,
      error: error.message,
      stack: error.stack,
    });
    return { handled: false, reason: "HANDLER_ERROR" };
  }
}

/* ------------------------------------------------------------------ *
 * Bootstrap wiring
 * ------------------------------------------------------------------ */

/**
 * Register this module as `manualTopupService`'s settlement handler.
 *
 * ⚠️ DELIBERATELY NOT CALLED AT MODULE LOAD — same rule as
 * `qrCreditService.registerCreditHandler`: requiring a module must never have
 * the side effect of arming a money-adjacent path.
 *
 * WHERE TO CALL IT: `backend/wallet-service/server.js`, inside the
 * `app.listen(...)` callback of `startServer()`, immediately after the existing
 * `qrCreditService.registerCreditHandler()` block (~line 418-425):
 *
 *   try {
 *     require("./services/payments/qrAssignmentService").registerSettlementHandler();
 *     logger.info("QR assignment settlement handler registered");
 *   } catch (e) {
 *     logger.warn("Failed to register QR settlement handler", { error: e.message });
 *   }
 *
 * WITHOUT THIS, an approved assignment credits the wallet correctly but the
 * collection is stranded at ASSIGN_PENDING forever — the money is right and the
 * queue is wrong, which is the hardest kind of drift to notice.
 *
 * @returns {void}
 */
function registerSettlementHandler() {
  manualTopupService.setSettlementHandler(onManualTopupSettled);

  logger.info(
    "QR assignment settlement handler registered with manualTopupService",
  );
}

module.exports = {
  assignUnattributed,
  rejectCollection,
  onManualTopupSettled,
  registerSettlementHandler,

  AUDIT_ACTIONS,
  ASSIGNABLE_STATUSES,
  REJECTABLE_STATUSES,
};
