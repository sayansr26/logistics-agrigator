/**
 * Manual (offline) Wallet Top-up Service — Wave 3.3
 *
 * WHAT THIS IS
 * ------------
 * An admin credits a wallet for money that arrived OUTSIDE any payment
 * gateway: a NEFT/RTGS transfer, a cheque, a cash deposit at the counter. No
 * gateway ever confirms it, so the ONLY controls are procedural. This module
 * implements the three that were signed off, and every one of them is
 * enforced HERE (service layer), never in a route or a controller:
 *
 *   1. REASON + EXTERNAL REFERENCE ARE MANDATORY.
 *      Joi (`manualTopupSchema`) already enforces reason >= 10 chars and
 *      externalReference >= 3 chars. Both are persisted on the row so the
 *      manual-credit register can always answer "why, and against which bank
 *      reference?" months later.
 *
 *   2. PER-TRANSACTION CAP (`policy.manualMaxPerTransaction`).
 *      `amount > cap` is rejected with HTTP 422 MANUAL_TOPUP_CAP_EXCEEDED.
 *      An optional per-user daily cap (`manualMaxPerDayPerUser`) is applied on
 *      top when configured.
 *
 *   3. MAKER-CHECKER (`policy.manualApprovalThreshold`).
 *      `amount >= threshold` -> the row is parked in PENDING_APPROVAL and only
 *      a SUPERADMIN may approve or reject it, and never the person who raised
 *      it. Below the threshold the credit lands immediately.
 *
 * THE MONEY IS NOT IN THIS DATABASE
 * ---------------------------------
 * Balances live in the external wallet API (wapi.websiteduniya.com). The local
 * Prisma `Wallet` / `Transaction` tables are LEGACY and this module never
 * writes to them. `ManualTopupRequest` is a control/audit record of an
 * instruction; `getExternalWalletClient().topup()` is the money movement.
 *
 * IDEMPOTENCY — WHY A 409 FROM THE EXTERNAL API MEANS SUCCESS
 * ----------------------------------------------------------
 * Every row carries `externalReferenceId = "MANUAL_<row.id>"`, generated once
 * at request time and never regenerated. The external wallet API rejects a
 * reference_id it has already seen with HTTP 409. So on a retry there are only
 * two outcomes: the credit lands (200), or the API says "already have that
 * reference" (409) — which is proof the credit landed on an earlier attempt.
 * Both are treated as CREDITED. Treating 409 as a failure would be the actual
 * bug: it would leave a real credit recorded as FAILED and invite a human to
 * "fix" it by crediting the wallet a second time under a fresh reference.
 *
 * ORDERING RULE: the network call NEVER happens inside a `prisma.$transaction`.
 * A slow gateway would otherwise hold a Postgres transaction open for the whole
 * HTTP timeout. Each DB state change is its own short transaction that carries
 * its audit log with it (same shape as `controllers/payoutController.js:281`).
 */

const crypto = require("crypto");

const { prisma } = require("../../config/database");
const { getRedisClient } = require("../../config/redis");
const { getExternalWalletClient } = require("../externalWalletClient");
const {
  APIError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} = require("../../shared/lib/errors");
const logger = require("../../shared/lib/logger");
const { getTopupPolicy } = require("./providerConfigService");
const {
  resolveForAdmin,
  buildBalanceCacheKeys,
  normalizeClientCode,
} = require("./walletIdentity");

const RESOURCE = "ManualTopupRequest";

/** Statuses that consume a user's daily manual-credit allowance. */
const DAILY_CAP_STATUSES = ["CREDITED", "PENDING_APPROVAL"];

/**
 * Statuses a reviewer may act on.
 *
 * PENDING_APPROVAL is the normal case. FAILED is included so a credit whose
 * external call died (network blip, gateway 5xx) can be retried by approving
 * again — safe precisely because `externalReferenceId` is deterministic, so a
 * re-credit either lands once or comes back 409 (= already landed).
 * APPROVED / REJECTED / CREDITED are terminal and fall through to 409
 * ALREADY_REVIEWED.
 */
const REVIEWABLE_STATUSES = ["PENDING_APPROVAL", "FAILED"];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * `ValidationError` hard-codes 400/VALIDATION_ERROR, but the product spec wants
 * 422 + a specific machine code for a policy breach (the payload is well
 * formed; it is the *business rule* that refuses it). Overriding the two fields
 * keeps the class (so `errorHandler`/`isOperationalError` still recognise it)
 * while producing the agreed contract.
 *
 * @param {string} message
 * @param {string} code
 * @param {Object|null} details
 * @returns {ValidationError}
 */
function policyError(message, code, details = null) {
  const error = new ValidationError(message, details);
  error.code = code;
  error.statusCode = 422;
  return error;
}

/**
 * @param {*} value Prisma Decimal | number | string | null
 * @returns {number|null}
 */
function toNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A positive, finite limit is "configured"; null/0/NaN means "no limit". */
function isLimitConfigured(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * API projection of a request row. Decimals become numbers so JSON does not
 * ship Prisma's Decimal wrapper object to the frontend.
 *
 * @param {Object|null} row
 * @returns {Object|null}
 */
function serializeRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    requestId: row.id,
    walletUserId: row.walletUserId,
    clientCode: row.clientCode,
    subjectUserId: row.subjectUserId ?? null,
    amount: toNumber(row.amount),
    currency: row.currency,
    reason: row.reason,
    externalReference: row.externalReference,
    status: row.status,
    thresholdAtRequest: toNumber(row.thresholdAtRequest),
    capAtRequest: toNumber(row.capAtRequest),
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? null,
    reviewRemarks: row.reviewRemarks ?? null,
    externalReferenceId: row.externalReferenceId ?? null,
    externalTransactionId: row.externalTransactionId ?? null,
    creditedAt: row.creditedAt ?? null,
    creditError: row.creditError ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Best-effort extraction of the external transaction id. The external wallet
 * API is not consistent across endpoints about nesting/naming, and this value
 * is a convenience for reconciliation only — never a control. A miss must NOT
 * fail the credit.
 *
 * @param {Object} response
 * @returns {string|null}
 */
function extractExternalTransactionId(response) {
  const body = response?.data ?? response ?? {};

  const candidate =
    body.transaction_id ??
    body.transactionId ??
    body.reference_id ??
    body.id ??
    response?.transaction_id ??
    response?.id ??
    null;

  return candidate === null || candidate === undefined
    ? null
    : String(candidate);
}

/**
 * Bust every Redis key that could serve a stale balance after a credit.
 *
 * EVERY delete is individually try/catch + warn: a cache outage must never turn
 * a credit that already moved real money into an error response. The worst case
 * of a failed bust is a stale balance for the TTL; the worst case of throwing
 * here is a caller who retries a credit that already landed.
 *
 * @param {string} walletUserId
 * @param {string} clientCode
 */
async function bustBalanceCache(walletUserId, clientCode) {
  let redis;
  try {
    redis = getRedisClient();
  } catch (error) {
    logger.warn("Balance cache bust skipped — Redis client unavailable", {
      walletUserId,
      error: error.message,
    });
    return;
  }

  if (!redis) return;

  const keys = buildBalanceCacheKeys(walletUserId, clientCode);

  for (const key of keys) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn("Failed to bust wallet balance cache key", {
        key,
        walletUserId,
        error: error.message,
      });
    }
  }
}

/**
 * Assert the reviewer is a superadmin.
 *
 * WHY THIS IS NOT `authMiddleware.requireRole(["superadmin"])`:
 * `shared/lib/auth.js:544-547` short-circuits with `if (userRole === "admin" ||
 * userRole === "superadmin") return next();` — requireRole grants ADMIN access
 * to every role list it is given, so it is structurally incapable of expressing
 * a superadmin-only gate. Using it here would silently hand admins the checker
 * half of maker-checker and collapse safeguard #3.
 *
 * This is layer (b) of three:
 *   (a) route requires `wallet:approve:all`, which the `admin` role deliberately
 *       does NOT hold (see shared/constants/permissions.js:105-115).
 *   (b) this explicit role assertion.
 *   (c) the self-approval check below.
 *
 * @param {Object} reviewer req.user
 * @throws {AuthorizationError} 403 SUPERADMIN_REQUIRED
 */
function assertSuperadmin(reviewer) {
  if (reviewer?.role !== "superadmin") {
    const error = new AuthorizationError(
      "Only a superadmin may approve or reject a manual wallet top-up.",
    );
    error.code = "SUPERADMIN_REQUIRED";
    error.details = {
      requiredRole: "superadmin",
      yourRole: reviewer?.role ?? null,
    };
    throw error;
  }
}

/**
 * Maker != checker. Layer (c).
 *
 * @param {Object} row
 * @param {Object} reviewer
 * @throws {AuthorizationError} 403 SELF_APPROVAL_FORBIDDEN
 */
function assertNotSelfReview(row, reviewer) {
  if (row.requestedBy === reviewer?.id) {
    const error = new AuthorizationError(
      "You raised this manual top-up request and therefore cannot review it. A different superadmin must approve or reject it.",
    );
    error.code = "SELF_APPROVAL_FORBIDDEN";
    error.details = { requestId: row.id };
    throw error;
  }
}

/**
 * @param {string} requestId
 * @returns {Promise<Object>} row
 * @throws {NotFoundError} 404 MANUAL_TOPUP_NOT_FOUND
 */
async function loadRequestOrThrow(requestId) {
  const row = await prisma.manualTopupRequest.findUnique({
    where: { id: requestId },
  });

  if (!row) {
    const error = new NotFoundError(
      `Manual top-up request '${requestId}' was not found.`,
    );
    error.code = "MANUAL_TOPUP_NOT_FOUND";
    throw error;
  }

  return row;
}

/**
 * A state transition that is safe under concurrency.
 *
 * `updateMany` with the status in the WHERE clause makes Postgres itself the
 * arbiter: two superadmins clicking Approve at the same instant produce exactly
 * one `count: 1` and one `count: 0`. A read-then-write would let both pass the
 * read and credit the wallet twice.
 *
 * @param {string} requestId
 * @param {Object} data fields to set alongside the new status
 * @returns {Promise<Object>} the updated row
 * @throws {ConflictError} 409 ALREADY_REVIEWED
 */
async function guardedTransition(requestId, data) {
  const { count } = await prisma.manualTopupRequest.updateMany({
    where: { id: requestId, status: { in: REVIEWABLE_STATUSES } },
    data,
  });

  if (count === 0) {
    const current = await prisma.manualTopupRequest.findUnique({
      where: { id: requestId },
      select: { status: true, reviewedBy: true, reviewedAt: true },
    });

    const error = new ConflictError(
      `This manual top-up request has already been reviewed (current status: ${current?.status ?? "UNKNOWN"}).`,
    );
    error.code = "ALREADY_REVIEWED";
    error.details = {
      requestId,
      currentStatus: current?.status ?? null,
      reviewedBy: current?.reviewedBy ?? null,
      reviewedAt: current?.reviewedAt ?? null,
    };
    throw error;
  }

  return prisma.manualTopupRequest.findUnique({ where: { id: requestId } });
}

// ---------------------------------------------------------------------------
// External credit
// ---------------------------------------------------------------------------

/**
 * Move the money, then record the outcome.
 *
 * NETWORK CALL FIRST, OUTSIDE ANY PRISMA TRANSACTION — see the ordering rule in
 * the module header.
 *
 * @param {Object} row a persisted ManualTopupRequest
 * @param {Object} actor req.user driving the credit (requester or reviewer)
 * @param {Object} [reqMeta] `{ ip, userAgent }`
 * @returns {Promise<{ok: boolean, row: Object, transaction: Object|null, alreadyCredited: boolean, error: Error|null}>}
 */
async function _creditExternal(row, actor, reqMeta = {}) {
  const client = getExternalWalletClient();

  let external = null;
  let alreadyCredited = false;

  try {
    external = await client.topup(row.clientCode, row.walletUserId, {
      amount: Number(row.amount),
      currency: row.currency,
      reference_id: row.externalReferenceId,
      description: `Manual top-up: ${row.reason}`,
      metadata: {
        source: "MANUAL",
        requestId: row.id,
        externalReference: row.externalReference,
        actorId: actor?.id ?? null,
      },
    });
  } catch (error) {
    // 409 == the external wallet already holds a transaction under this
    // reference_id. The credit LANDED on a previous attempt; this is our
    // idempotency working, not a failure. See module header.
    if (error?.statusCode === 409) {
      alreadyCredited = true;
      logger.warn(
        "Manual top-up already credited externally (409 on deterministic reference) — treating as success",
        {
          requestId: row.id,
          walletUserId: row.walletUserId,
          externalReferenceId: row.externalReferenceId,
        },
      );
    } else {
      logger.error("Manual top-up external credit failed", {
        requestId: row.id,
        walletUserId: row.walletUserId,
        clientCode: row.clientCode,
        amount: toNumber(row.amount),
        error: error.message,
      });

      const failedRow = await prisma.$transaction(async (tx) => {
        const updated = await tx.manualTopupRequest.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            creditError: String(error.message ?? "Unknown error").slice(
              0,
              2000,
            ),
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actor?.id ?? null,
            action: "MANUAL_TOPUP_FAILED",
            resource: RESOURCE,
            resourceId: row.id,
            details: {
              walletUserId: row.walletUserId,
              clientCode: row.clientCode,
              subjectUserId: row.subjectUserId ?? null,
              amount: toNumber(row.amount),
              currency: row.currency,
              externalReference: row.externalReference,
              externalReferenceId: row.externalReferenceId,
              error: String(error.message ?? "Unknown error").slice(0, 2000),
              // Retry is safe: the reference is deterministic, so a re-credit
              // either lands once or returns 409 (= already landed).
              retryable: true,
            },
            ipAddress: reqMeta.ip ?? row.ipAddress ?? null,
            userAgent: reqMeta.userAgent ?? row.userAgent ?? null,
          },
        });

        return updated;
      });

      return {
        ok: false,
        row: failedRow,
        transaction: null,
        alreadyCredited: false,
        error,
      };
    }
  }

  const externalTransactionId = extractExternalTransactionId(external);

  const creditedRow = await prisma.$transaction(async (tx) => {
    const updated = await tx.manualTopupRequest.update({
      where: { id: row.id },
      data: {
        status: "CREDITED",
        externalTransactionId,
        creditedAt: new Date(),
        creditError: null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        action: "MANUAL_TOPUP_CREDITED",
        resource: RESOURCE,
        resourceId: row.id,
        details: {
          walletUserId: row.walletUserId,
          clientCode: row.clientCode,
          subjectUserId: row.subjectUserId ?? null,
          amount: toNumber(row.amount),
          currency: row.currency,
          reason: row.reason,
          externalReference: row.externalReference,
          externalReferenceId: row.externalReferenceId,
          externalTransactionId,
          requestedBy: row.requestedBy,
          creditedBy: actor?.id ?? null,
          // Distinguishes "we just moved money" from "the external wallet told
          // us it had already moved it" — important when auditing a retry.
          alreadyCredited,
        },
        ipAddress: reqMeta.ip ?? row.ipAddress ?? null,
        userAgent: reqMeta.userAgent ?? row.userAgent ?? null,
      },
    });

    return updated;
  });

  await bustBalanceCache(row.walletUserId, row.clientCode);

  logger.info("Manual top-up credited", {
    requestId: row.id,
    walletUserId: row.walletUserId,
    amount: toNumber(row.amount),
    alreadyCredited,
    creditedBy: actor?.id,
  });

  return {
    ok: true,
    row: creditedRow,
    transaction: external,
    alreadyCredited,
    error: null,
  };
}

/**
 * Turn a failed credit into the caller-facing error. 502 because the failure is
 * upstream (the external wallet), not the client's payload.
 *
 * @param {Object} failedRow
 * @param {Error} cause
 * @returns {APIError}
 */
function creditFailureError(failedRow, cause) {
  const error = new APIError(
    `The manual top-up request was recorded but the wallet credit failed: ${cause?.message ?? "unknown error"}. The request is retryable.`,
    502,
    "MANUAL_TOPUP_CREDIT_FAILED",
  );
  error.details = {
    requestId: failedRow.id,
    status: failedRow.status,
    creditError: failedRow.creditError ?? null,
    retryable: true,
  };
  return error;
}

// ---------------------------------------------------------------------------
// Safeguard #2 — caps
// ---------------------------------------------------------------------------

/**
 * Per-transaction cap.
 *
 * @throws {ValidationError} 422 MANUAL_TOPUP_CAP_EXCEEDED
 */
function assertWithinPerTransactionCap(amount, cap) {
  if (isLimitConfigured(cap) && amount > cap) {
    throw policyError(
      `Manual top-up amount ${amount} exceeds the per-transaction cap of ${cap}. Split the credit or ask a superadmin to raise the policy cap.`,
      "MANUAL_TOPUP_CAP_EXCEEDED",
      { cap, amount },
    );
  }
}

/**
 * Optional per-user daily cap, computed from TODAY's rows raised by this actor.
 *
 * Counts CREDITED (money already moved) plus PENDING_APPROVAL (money committed,
 * awaiting a checker) — otherwise an admin could park ten pending requests and
 * blow past the cap the moment they are approved. FAILED and REJECTED rows
 * released their allowance and are excluded.
 *
 * @throws {ValidationError} 422 MANUAL_TOPUP_DAILY_CAP_EXCEEDED
 */
async function assertWithinDailyCap(actorId, amount, dailyCap) {
  if (!isLimitConfigured(dailyCap)) return;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const aggregate = await prisma.manualTopupRequest.aggregate({
    _sum: { amount: true },
    where: {
      requestedBy: actorId,
      requestedAt: { gte: startOfDay },
      status: { in: DAILY_CAP_STATUSES },
    },
  });

  const usedToday = toNumber(aggregate._sum.amount) ?? 0;

  if (usedToday + amount > dailyCap) {
    throw policyError(
      `This manual top-up would take your total for today to ${usedToday + amount}, above your daily manual-credit limit of ${dailyCap}.`,
      "MANUAL_TOPUP_DAILY_CAP_EXCEEDED",
      {
        dailyCap,
        usedToday,
        amount,
        remaining: Math.max(0, dailyCap - usedToday),
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Raise a manual top-up.
 *
 * A ROW IS ALWAYS WRITTEN, even for a below-threshold instant credit
 * (status CREDITED, `reviewedBy = requestedBy`). The manual-credit register
 * must be complete: "every rupee credited outside a gateway, who ordered it,
 * why, and against which bank reference" has to be answerable from ONE table.
 * Writing the row only for the approval path would leave the small credits —
 * the ones most likely to be abused precisely because they need no checker —
 * invisible to an auditor.
 *
 * @param {Object} args
 * @param {Object} args.actor req.user
 * @param {Object} args.body validated `manualTopupSchema` payload
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<Object>} `{ requestId, status, requiresApproval, ... }`
 */
async function requestManualTopup({ actor, body, ip, userAgent }) {
  const identity = resolveForAdmin(body);
  const policy = await getTopupPolicy();

  const amount = Number(body.amount);
  const currency = body.currency || "INR";
  const cap = toNumber(policy.manualMaxPerTransaction);
  const threshold = toNumber(policy.manualApprovalThreshold);
  const dailyCap = toNumber(policy.manualMaxPerDayPerUser);

  // Safeguard #2 — caps, checked BEFORE any row is written so a rejected
  // request never pollutes the register or the daily aggregate.
  assertWithinPerTransactionCap(amount, cap);
  await assertWithinDailyCap(actor.id, amount, dailyCap);

  // Safeguard #3 — maker-checker.
  const requiresApproval = isLimitConfigured(threshold) && amount >= threshold;

  // The id is generated here, not by Prisma's @default(uuid()), so
  // `externalReferenceId` can be written in the SAME insert. Deriving it in a
  // second UPDATE would leave a window where a crash produces a row with no
  // idempotency key — and therefore a credit that could be issued twice.
  const requestId = crypto.randomUUID();
  const externalReferenceId = `MANUAL_${requestId}`;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.manualTopupRequest.create({
      data: {
        id: requestId,
        walletUserId: identity.walletUserId,
        clientCode: normalizeClientCode(identity.clientCode),
        subjectUserId: identity.subjectUserId,
        amount,
        currency,
        reason: body.reason,
        externalReference: body.externalReference,
        status: "PENDING_APPROVAL",
        // Snapshot the policy AS IT WAS. If a superadmin later raises the
        // threshold, this row must still show the rule it was judged under —
        // otherwise a policy edit silently rewrites the audit history of every
        // past credit.
        thresholdAtRequest: isLimitConfigured(threshold) ? threshold : 0,
        capAtRequest: isLimitConfigured(cap) ? cap : 0,
        requestedBy: actor.id,
        externalReferenceId,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        metadata: body.metadata ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "MANUAL_TOPUP_REQUESTED",
        resource: RESOURCE,
        resourceId: row.id,
        details: {
          walletUserId: row.walletUserId,
          clientCode: row.clientCode,
          subjectUserId: row.subjectUserId ?? null,
          amount,
          currency,
          reason: row.reason,
          externalReference: row.externalReference,
          externalReferenceId,
          requiresApproval,
          policySnapshot: {
            manualMaxPerTransaction: cap,
            manualApprovalThreshold: threshold,
            manualMaxPerDayPerUser: dailyCap,
          },
        },
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return row;
  });

  // ---- At or above threshold: park it for a superadmin (HTTP 202) ----------
  if (requiresApproval) {
    logger.info("Manual top-up parked for superadmin approval", {
      requestId: created.id,
      walletUserId: created.walletUserId,
      amount,
      threshold,
      requestedBy: actor.id,
    });

    return {
      requestId: created.id,
      status: "PENDING_APPROVAL",
      requiresApproval: true,
      threshold,
      amount,
      currency,
      walletUserId: created.walletUserId,
      clientCode: created.clientCode,
      transaction: null,
      request: serializeRequest(created),
    };
  }

  // ---- Below threshold: credit now (HTTP 200) -----------------------------
  // The requester is recorded as their own reviewer so `reviewedBy` is never
  // NULL on a CREDITED row — a report that groups by reviewer then shows the
  // no-checker credits explicitly instead of dropping them.
  const selfReviewed = await prisma.manualTopupRequest.update({
    where: { id: created.id },
    data: {
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      reviewRemarks: "Auto-approved: below the maker-checker threshold",
    },
  });

  const result = await _creditExternal(selfReviewed, actor, { ip, userAgent });

  if (!result.ok) {
    throw creditFailureError(result.row, result.error);
  }

  return {
    requestId: result.row.id,
    status: "CREDITED",
    requiresApproval: false,
    threshold,
    amount,
    currency,
    walletUserId: result.row.walletUserId,
    clientCode: result.row.clientCode,
    alreadyCredited: result.alreadyCredited,
    transaction: result.transaction,
    request: serializeRequest(result.row),
  };
}

/**
 * Approve a pending manual top-up and credit the wallet. SUPERADMIN ONLY.
 *
 * @param {Object} args
 * @param {string} args.requestId
 * @param {Object} args.reviewer req.user
 * @param {string} [args.reviewRemarks]
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<Object>}
 */
async function approve({ requestId, reviewer, reviewRemarks, ip, userAgent }) {
  assertSuperadmin(reviewer); // layer (b)

  const row = await loadRequestOrThrow(requestId);

  assertNotSelfReview(row, reviewer); // layer (c)

  const reviewedAt = new Date();

  const approved = await guardedTransition(requestId, {
    status: "APPROVED",
    reviewedBy: reviewer.id,
    reviewedAt,
    reviewRemarks: reviewRemarks || null,
  });

  await prisma.auditLog.create({
    data: {
      userId: reviewer.id,
      action: "MANUAL_TOPUP_APPROVED",
      resource: RESOURCE,
      resourceId: requestId,
      details: {
        walletUserId: approved.walletUserId,
        clientCode: approved.clientCode,
        subjectUserId: approved.subjectUserId ?? null,
        amount: toNumber(approved.amount),
        currency: approved.currency,
        reason: approved.reason,
        externalReference: approved.externalReference,
        externalReferenceId: approved.externalReferenceId,
        requestedBy: approved.requestedBy,
        approvedBy: reviewer.id,
        reviewRemarks: reviewRemarks || null,
        previousStatus: row.status,
        thresholdAtRequest: toNumber(approved.thresholdAtRequest),
      },
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
    },
  });

  const result = await _creditExternal(approved, reviewer, { ip, userAgent });

  if (!result.ok) {
    throw creditFailureError(result.row, result.error);
  }

  return {
    requestId: result.row.id,
    status: "CREDITED",
    amount: toNumber(result.row.amount),
    currency: result.row.currency,
    walletUserId: result.row.walletUserId,
    clientCode: result.row.clientCode,
    alreadyCredited: result.alreadyCredited,
    transaction: result.transaction,
    request: serializeRequest(result.row),
  };
}

/**
 * Reject a pending manual top-up. SUPERADMIN ONLY. NEVER TOUCHES MONEY —
 * there is no external call anywhere on this path.
 *
 * @param {Object} args
 * @param {string} args.requestId
 * @param {Object} args.reviewer req.user
 * @param {string} args.reviewRemarks REQUIRED (Joi: min 10 chars)
 * @param {string} [args.ip]
 * @param {string} [args.userAgent]
 * @returns {Promise<Object>}
 */
async function reject({ requestId, reviewer, reviewRemarks, ip, userAgent }) {
  assertSuperadmin(reviewer); // layer (b)

  const row = await loadRequestOrThrow(requestId);

  assertNotSelfReview(row, reviewer); // layer (c)

  // Defence in depth: Joi already makes this required, but the rejection reason
  // is the whole audit value of a rejection, so the service refuses without it
  // even if this function is ever called from an unvalidated path.
  const remarks = typeof reviewRemarks === "string" ? reviewRemarks.trim() : "";
  if (remarks.length < 10) {
    throw policyError(
      "Rejection remarks are required and must be at least 10 characters.",
      "REVIEW_REMARKS_REQUIRED",
      { requestId },
    );
  }

  const rejected = await guardedTransition(requestId, {
    status: "REJECTED",
    reviewedBy: reviewer.id,
    reviewedAt: new Date(),
    reviewRemarks: remarks,
  });

  await prisma.auditLog.create({
    data: {
      userId: reviewer.id,
      action: "MANUAL_TOPUP_REJECTED",
      resource: RESOURCE,
      resourceId: requestId,
      details: {
        walletUserId: rejected.walletUserId,
        clientCode: rejected.clientCode,
        subjectUserId: rejected.subjectUserId ?? null,
        amount: toNumber(rejected.amount),
        currency: rejected.currency,
        reason: rejected.reason,
        externalReference: rejected.externalReference,
        requestedBy: rejected.requestedBy,
        rejectedBy: reviewer.id,
        reviewRemarks: remarks,
        previousStatus: row.status,
      },
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
    },
  });

  logger.info("Manual top-up rejected", {
    requestId,
    rejectedBy: reviewer.id,
    amount: toNumber(rejected.amount),
  });

  return {
    requestId: rejected.id,
    status: "REJECTED",
    amount: toNumber(rejected.amount),
    currency: rejected.currency,
    walletUserId: rejected.walletUserId,
    clientCode: rejected.clientCode,
    reviewRemarks: remarks,
    request: serializeRequest(rejected),
  };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/**
 * Build the Prisma WHERE + the echoed filter block from a validated query.
 *
 * @param {Object} query
 * @param {string} [forcedStatus]
 * @returns {{where: Object, filters: Object}}
 */
function buildListWhere(query, forcedStatus) {
  const status = forcedStatus || query.status || null;
  const where = {};

  if (status) where.status = status;
  if (query.walletUserId) where.walletUserId = query.walletUserId;
  if (query.clientCode)
    where.clientCode = normalizeClientCode(query.clientCode);

  if (query.startDate || query.endDate) {
    where.requestedAt = {};
    if (query.startDate) where.requestedAt.gte = new Date(query.startDate);
    if (query.endDate) where.requestedAt.lte = new Date(query.endDate);
  }

  return {
    where,
    filters: {
      status,
      walletUserId: query.walletUserId ?? null,
      clientCode: where.clientCode ?? null,
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
      sortDir: query.sortDir || "desc",
    },
  };
}

/**
 * THE LIST ENVELOPE IS A HARD CONTRACT.
 *
 * The frontend's RTK Query slice uses `transformResponse: r => r.data ?? r`, so
 * it only ever sees the `data` half of `APIResponse.success(payload)`. Anything
 * placed in `meta` — which is exactly where `APIResponse.paginated()` puts
 * pagination — is DISCARDED before the component sees it, and the table renders
 * with no page count. So pagination must ride INSIDE the payload, in the
 * snake_case shape the already-built UI reads, with a 0-BASED `current_page`.
 *
 * Do not "tidy" this into `APIResponse.paginated()`.
 *
 * @param {Array} rows
 * @param {number} total
 * @param {number} page 0-based
 * @param {number} size
 * @param {Object} filters
 * @returns {Object}
 */
function buildListEnvelope(rows, total, page, size, filters) {
  const totalPages = size > 0 ? Math.ceil(total / size) : 0;

  return {
    data: rows.map(serializeRequest),
    pagination: {
      total_elements: total,
      has_previous: page > 0,
      has_next: (page + 1) * size < total,
      total_pages: totalPages,
      current_page: page,
      page_size: size,
    },
    success: true,
    filters,
  };
}

/**
 * @param {Object} query validated `manualTopupListQuerySchema`
 * @param {string} [forcedStatus]
 * @returns {Promise<Object>} the list envelope
 */
async function runList(query, forcedStatus) {
  const page = Number.isInteger(query.page)
    ? query.page
    : Number(query.page ?? 0) || 0;
  const size = Number(query.size ?? 20) || 20;
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";

  const { where, filters } = buildListWhere(query, forcedStatus);

  const [total, rows] = await Promise.all([
    prisma.manualTopupRequest.count({ where }),
    prisma.manualTopupRequest.findMany({
      where,
      orderBy: { requestedAt: sortDir },
      skip: page * size,
      take: size,
    }),
  ]);

  return buildListEnvelope(rows, total, page, size, filters);
}

/**
 * List manual top-up requests (any status).
 *
 * @param {Object} args
 * @param {Object} args.query validated query
 * @param {Object} args.actor req.user
 * @returns {Promise<Object>}
 */
async function list({ query, actor }) {
  logger.debug("Listing manual top-up requests", {
    actorId: actor?.id,
    status: query?.status ?? null,
  });

  return runList(query || {});
}

/**
 * The superadmin approval queue — PENDING_APPROVAL only. `status` from the
 * query is deliberately ignored so this endpoint can never be widened into a
 * general list by a crafted query string.
 *
 * @param {Object} args
 * @param {Object} args.query validated query
 * @param {Object} args.actor req.user
 * @returns {Promise<Object>}
 */
async function listPending({ query, actor }) {
  logger.debug("Listing pending manual top-up approvals", {
    actorId: actor?.id,
  });

  return runList(query || {}, "PENDING_APPROVAL");
}

module.exports = {
  requestManualTopup,
  approve,
  reject,
  list,
  listPending,

  // Exported for reuse/tests — not part of the HTTP surface.
  _creditExternal,
  serializeRequest,
  REVIEWABLE_STATUSES,
};
