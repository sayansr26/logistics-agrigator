/**
 * Payment reconciliation service.
 *
 * THE SAFETY NET UNDER THE MONEY PATH.
 *
 * Everything here exists because the happy path (webhook -> creditOrder) can be
 * interrupted at any point by a process restart, a network partition, an
 * external-wallet outage, or a gateway that simply never delivers. This module
 * sweeps the four ways a captured payment can end up un-credited and pushes
 * each one back onto the SAME money path — it never credits anything itself.
 *
 * HARD RULE: `webhookService.creditOrder` is the ONLY implementation that moves
 * money. This file never calls `externalWalletClient.topup`. Every scan below
 * ends in a `creditOrder(...)` call with `source: "RECONCILE"`, which carries
 * all of the invariants with it:
 *   - `externalReferenceId` = `<PREFIX>_<providerPaymentId>` (RZP_ for
 *     razorpay, CCAV_ for ccavenue), IMMUTABLE — a retry
 *     reuses the value already stored on the row, so the external wallet's
 *     uniqueness check sees the same key it saw last time.
 *   - a 409 from the external wallet MEANS SUCCESS (the credit already landed).
 *   - amounts are compared in integer paise only.
 *   - TEST-mode orders short-circuit before the external API is ever touched.
 *   - no Prisma transaction is ever open across a network call.
 *
 * The five scans, in the order `runPending` executes them:
 *   1. RECONCILE_PENDING orders   — the main retry queue (backoff-scheduled).
 *   2. Stuck PAID orders          — process died between claim and credit.
 *   3. Unprocessed webhook events — THE CRITICAL ONE, see below.
 *   4. Stuck QR collections       — the same death, one level up: a
 *                                   `QrCollection` claimed at CREDIT_PENDING
 *                                   whose order was never minted or never
 *                                   reconciled back. Retried through
 *                                   `qrCreditService.attributeAndCredit`,
 *                                   which itself ends in `creditOrder`.
 *   5. Expiry sweep               — local expiry when the gateway is slow.
 *
 * WHY SCAN 3 IS THE CRITICAL ONE
 * `webhookService.handleWebhook` answers HTTP 200 even when post-record
 * processing fails, leaving `PaymentWebhookEvent.processed = false` with a
 * `processingError`. It must: a non-2xx would make Razorpay redeliver, and the
 * redelivery would collide with the replay guard `@@unique([provider,
 * providerEventId])` and be swallowed as a duplicate WITHOUT crediting. So the
 * gateway can never usefully retry those rows. If nothing sweeps them, a
 * captured payment stays permanently un-credited while the order still sits in
 * CREATED/PENDING and no retry queue knows about it. Scan 3 is that sweep.
 *
 * @module services/payments/reconcileService
 */

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");

const { getProvider } = require("./index");
const {
  resolveConfigForMode,
  resolveActiveConfig,
} = require("./providerConfigService");
const webhookService = require("./webhookService");

/* ------------------------------------------------------------------ *
 * Tunables
 * ------------------------------------------------------------------ */

/** Backoff ceiling, in minutes. Mirrors webhookService's own ceiling. */
const MAX_BACKOFF_MINUTES = 60;

/** Default attempt ceiling; overridable per-deployment. */
const DEFAULT_MAX_ATTEMPTS = 10;

/**
 * A PAID order whose credit never completed. 10 minutes is comfortably longer
 * than the external wallet client's own timeout + circuit-breaker window, so a
 * credit that is merely SLOW is never mistaken for one that died.
 */
const STUCK_PAID_MINUTES = 10;

/**
 * Grace period before an unprocessed webhook event is swept. The webhook
 * request may still be in flight (it writes `processed: true` only at the very
 * end), and stealing an in-flight event would just race the request handler.
 */
const EVENT_GRACE_MINUTES = 2;

/**
 * Age at which a still-failing webhook event is abandoned to a human, even if
 * the in-memory attempt counter was reset by a restart. See `giveUpOnEvent`.
 */
const EVENT_GIVEUP_MINUTES = 24 * 60;

/** Claim states creditOrder will accept — mirrors CLAIMABLE_FOR_CREDIT there. */
const RETRYABLE_ORDER_STATUSES = ["RECONCILE_PENDING", "PAID"];

/**
 * POISON-EVENT GUARD.
 *
 * `PaymentWebhookEvent` has no `reconcileAttempts` column (adding one would be
 * a migration this wave does not own), so the per-event attempt counter lives
 * IN MEMORY: eventId -> { attempts, lastSeenAt }. That is deliberately weaker
 * than the order-row counter, and the weakness is covered by a second,
 * durable bound — `EVENT_GIVEUP_MINUTES` on `receivedAt`. Together:
 *   - a fast-failing event burns MAX_ATTEMPTS ticks and is given up;
 *   - a restart that clears the map cannot resurrect an ancient event forever,
 *     because the age bound gives up on the first failure past the cutoff;
 *   - a genuine backlog present at first deploy still gets one real attempt
 *     before the age bound applies.
 * The map is pruned every run so it cannot grow without limit.
 */
const eventAttempts = new Map();

/** Prune entries untouched for this long (ms). */
const EVENT_MEMORY_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * A static-QR collection claimed for credit whose credit never completed.
 * Same 10-minute reasoning as `STUCK_PAID_MINUTES`: comfortably longer than the
 * external wallet client's timeout + circuit-breaker window, so a credit that
 * is merely SLOW is never mistaken for one that died.
 */
const STUCK_QR_MINUTES = 10;

/**
 * Age at which a still-failing CREDIT_PENDING collection is abandoned to a
 * human, even if the in-memory attempt counter was cleared by a restart.
 */
const QR_GIVEUP_MINUTES = 24 * 60;

/**
 * POISON-COLLECTION GUARD — the same two-bound shape as `eventAttempts`.
 *
 * `QrCollection` has no `reconcileAttempts` column (adding one would be a
 * migration this wave does not own), so the per-collection attempt counter
 * lives IN MEMORY: collectionId -> { attempts, lastSeenAt }, backed by the
 * durable `QR_GIVEUP_MINUTES` age bound on `updatedAt`. Pruned every run.
 */
const qrAttempts = new Map();

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** Attempt ceiling, read at call time so env changes need no redeploy. */
function maxAttempts() {
  const parsed = parseInt(process.env.TOPUP_RECONCILE_MAX_ATTEMPTS || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ATTEMPTS;
}

/** Positive-integer env reader with a fallback. @private */
function envMinutes(name, fallback) {
  const parsed = parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Staleness cutoff for the stuck-QR sweep, read at call time. */
function stuckQrMinutes() {
  return envMinutes("TOPUP_QR_STUCK_MINUTES", STUCK_QR_MINUTES);
}

/** Durable give-up age for a CREDIT_PENDING collection, read at call time. */
function qrGiveUpMinutes() {
  return envMinutes("TOPUP_QR_GIVEUP_MINUTES", QR_GIVEUP_MINUTES);
}

/**
 * Exponential backoff: `min(2^attempts, 60)` minutes. Same curve webhookService
 * uses when it parks an order, so a retry scheduled here and one scheduled
 * there are indistinguishable.
 */
function backoffMinutes(attempts) {
  const n = Number.isInteger(attempts) && attempts > 0 ? attempts : 1;
  return Math.min(Math.pow(2, n), MAX_BACKOFF_MINUTES);
}

/** Prisma Decimal | string | number -> number. */
function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function ageMinutes(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

/** Audit rows are never allowed to break a reconcile tick. */
async function writeAudit({ action, resourceId, userId, details, resource }) {
  try {
    await prisma.auditLog.create({
      data: {
        // AuditLog.userId is @db.Uuid — only a LOCAL uuid may go here.
        // `walletUserId` is a phone number and belongs in `details`.
        userId: isUuid(userId) ? userId : null,
        action,
        resource: resource || "PaymentOrder",
        resourceId: resourceId || null,
        details: details || {},
      },
    });
  } catch (error) {
    logger.error("AUDIT WRITE FAILED during reconcile", {
      action,
      resourceId,
      error: error.message,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Provider config / truth fetching
 * ------------------------------------------------------------------ */

/**
 * Resolve the credentials for the mode SNAPSHOTTED ON THE ORDER.
 *
 * `requireEnabled: false` for the same reason the webhook path uses it: a
 * provider disabled after an order was created must still have its in-flight
 * payments reconciled — the customer's money is already gone.
 *
 * @private
 */
async function configForOrder(order) {
  return resolveConfigForMode(order.provider, order.mode, {
    requireEnabled: false,
  });
}

/**
 * Build the `parsed`-shaped object `creditOrder` expects:
 * `{ providerPaymentId, amountPaise, currency, capturedAt, outcome }`.
 *
 * Two cases, and the difference matters:
 *
 *  (a) THE ORDER WAS ALREADY CLAIMED — it carries a `providerPaymentId`, and
 *      `amountPaise` was written at creation from the amount we charged. The
 *      row IS the record of what the gateway told us, so we synthesise from it
 *      and make no network call. Critically this reuses the stored
 *      `externalReferenceId` derived from that same payment id, which is what
 *      makes the retry idempotent at the external wallet.
 *
 *  (b) THE ORDER WAS NEVER CLAIMED — no `providerPaymentId`. We must not
 *      invent one, so we ask the provider for the truth (`fetchPayment` /
 *      `fetchPaymentLink`) and build `parsed` from that. Returns null when the
 *      provider says nothing was captured; the caller then leaves the order
 *      alone.
 *
 * Note for TEST orders: hitting the provider here uses TEST credentials
 * against the gateway's test API. That is not the external WALLET API — the
 * invariant that TEST money never reaches the wallet is enforced inside
 * `creditOrder`, which short-circuits before any wallet call.
 *
 * @private
 * @returns {Promise<Object|null>}
 */
async function buildParsedForOrder(order, config) {
  // (a) already claimed — the row is the record.
  if (order.providerPaymentId && Number.isInteger(order.amountPaise)) {
    const capturedAt = order.lastReconcileAt || order.updatedAt || null;
    return {
      providerPaymentId: order.providerPaymentId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      capturedAt: capturedAt ? new Date(capturedAt).toISOString() : null,
      outcome: "PAID",
      raw: order.gatewayData || null,
    };
  }

  // (b) never claimed — go and ask the provider.
  const impl = getProvider(order.provider);

  if (order.providerLinkId) {
    const link = await impl.fetchPaymentLink({
      config,
      providerLinkId: order.providerLinkId,
    });

    if (!link || !link.providerPaymentId) return null;

    // The link tells us WHICH payment; the payment tells us the authoritative
    // captured amount. Never credit off `amount_paid` when the payment entity
    // is one call away — a partial capture must reach creditOrder's paise
    // comparison with the real number so it can refuse.
    const payment = await impl.fetchPayment({
      config,
      providerPaymentId: link.providerPaymentId,
    });

    if (!payment || !payment.captured) return null;

    return {
      providerPaymentId: payment.providerPaymentId,
      amountPaise: payment.amountPaise,
      currency: payment.currency || link.currency || order.currency,
      capturedAt: payment.capturedAt || null,
      outcome: "PAID",
      raw: payment.raw || null,
    };
  }

  // No link and no payment id: nothing addressable to fetch (the provider
  // contract exposes no order-level fetch). Leave it for a human.
  return null;
}

/* ------------------------------------------------------------------ *
 * Attempt bookkeeping
 * ------------------------------------------------------------------ */

/**
 * Park an order for a later tick without going through creditOrder — used when
 * we could not even BUILD the retry (config unresolvable, provider fetch
 * failed). Increments the same counter creditOrder uses so the two paths share
 * one budget.
 *
 * @private
 */
async function deferOrder(order, reason) {
  const attempts = (order.reconcileAttempts || 0) + 1;
  const now = new Date();

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      reconcileAttempts: { increment: 1 },
      lastReconcileAt: now,
      nextRetryAt: new Date(
        now.getTime() + backoffMinutes(attempts) * 60 * 1000,
      ),
      reconcileError: String(reason || "").slice(0, 2000),
    },
  });

  if (attempts >= maxAttempts()) {
    await exhaustOrder(order, reason, attempts);
    return { handled: "exhausted", credited: false };
  }

  return { handled: "deferred", credited: false, attempt: attempts };
}

/**
 * Attempt budget spent. Stop retrying and put it in front of a human: the
 * order leaves the automated queue (`needsManualAction: true` is excluded by
 * every scan) and an audit row records exactly why.
 *
 * @private
 */
async function exhaustOrder(order, reason, attempts) {
  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      needsManualAction: true,
      nextRetryAt: null,
      lastReconcileAt: new Date(),
      reconcileError: String(reason || "RECONCILE_EXHAUSTED").slice(0, 2000),
    },
  });

  await writeAudit({
    action: "TOPUP_RECONCILE_EXHAUSTED",
    resourceId: order.id,
    userId: order.subjectUserId,
    details: {
      provider: order.provider,
      mode: order.mode,
      status: order.status,
      amount: toNumber(order.amount),
      amountPaise: order.amountPaise,
      walletUserId: order.walletUserId,
      clientCode: order.clientCode,
      providerPaymentId: order.providerPaymentId,
      externalReferenceId: order.externalReferenceId,
      attempts: attempts || order.reconcileAttempts,
      maxAttempts: maxAttempts(),
      lastError: String(reason || "").slice(0, 500),
      note:
        "Automated reconciliation gave up. The customer's money is at the gateway; " +
        "an operator must credit or refund it by hand. The stored externalReferenceId " +
        "MUST be reused for any manual credit so the external wallet still de-duplicates.",
    },
  });

  logger.error("Reconcile attempts EXHAUSTED — manual action required", {
    orderId: order.id,
    provider: order.provider,
    attempts: attempts || order.reconcileAttempts,
    externalReferenceId: order.externalReferenceId,
  });
}

/**
 * Run one `creditOrder` retry for an order, resolving config and parsed first.
 * Never throws — a single bad order must not abort the whole tick.
 *
 * @private
 */
async function retryCredit(order, { source = "RECONCILE" } = {}) {
  let config;
  try {
    config = await configForOrder(order);
  } catch (error) {
    logger.warn("Reconcile could not resolve provider config", {
      orderId: order.id,
      provider: order.provider,
      mode: order.mode,
      error: error.message,
    });
    return deferOrder(order, `CONFIG_UNRESOLVED: ${error.message}`);
  }

  let parsed;
  try {
    parsed = await buildParsedForOrder(order, config);
  } catch (error) {
    logger.warn("Reconcile could not fetch payment truth from provider", {
      orderId: order.id,
      provider: order.provider,
      error: error.message,
    });
    return deferOrder(order, `PROVIDER_FETCH_FAILED: ${error.message}`);
  }

  if (!parsed) {
    // The provider says nothing was captured. Not an error and not a retry
    // failure — do not burn an attempt, just push the next look out a little.
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        lastReconcileAt: new Date(),
        nextRetryAt: new Date(Date.now() + MAX_BACKOFF_MINUTES * 60 * 1000),
      },
    });
    return { handled: "no_capture", credited: false };
  }

  // THE money path. `creditOrder` never throws on external failure — it parks
  // the order with its own backoff — so the result is always usable.
  const result = await webhookService.creditOrder(order, parsed, {
    source,
    verifiedMode: order.mode, // give the mode assertion something to assert
    config,
  });

  // creditOrder increments `reconcileAttempts` itself when it parks the order,
  // and reports the resulting count as `attempt`.
  if (
    result &&
    result.handled === "reconcile_pending" &&
    Number.isInteger(result.attempt) &&
    result.attempt >= maxAttempts()
  ) {
    await exhaustOrder(
      order,
      `EXTERNAL_CREDIT_FAILED after ${result.attempt} attempts`,
      result.attempt,
    );
    return { ...result, handled: "exhausted" };
  }

  return result || { handled: "unknown", credited: false };
}

/* ------------------------------------------------------------------ *
 * Scan 1 — the RECONCILE_PENDING queue
 * ------------------------------------------------------------------ */

/**
 * The main retry queue. Served by the existing `@@index([status, nextRetryAt])`.
 * `needsManualAction` rows are excluded on purpose: once a human owns an order
 * the machine must stop touching it.
 *
 * @private
 */
async function scanReconcilePending(limit) {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      status: "RECONCILE_PENDING",
      needsManualAction: false,
      reconcileAttempts: { lt: maxAttempts() },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });

  const summary = {
    scanned: orders.length,
    credited: 0,
    deferred: 0,
    exhausted: 0,
  };

  for (const order of orders) {
    try {
      const result = await retryCredit(order, { source: "RECONCILE" });
      if (result.credited) summary.credited += 1;
      else if (result.handled === "exhausted") summary.exhausted += 1;
      else summary.deferred += 1;
    } catch (error) {
      summary.deferred += 1;
      logger.error("Reconcile retry threw unexpectedly", {
        orderId: order.id,
        error: error.message,
      });
    }
  }

  return summary;
}

/* ------------------------------------------------------------------ *
 * Scan 2 — stuck PAID orders
 * ------------------------------------------------------------------ */

/**
 * PAID but never credited.
 *
 * `creditOrder` flips CREATED|PENDING|EXPIRED -> PAID (the claim) and only then
 * calls the external wallet. A process that dies in between leaves the row at
 * PAID with `creditedAt: null` and NOTHING scheduled — no `nextRetryAt`, so
 * scan 1 will never see it. This is the only sweep that finds those.
 *
 * The retry is safe: `creditOrder` re-reads such a row, sees it is past the
 * claim point, and the stored immutable `externalReferenceId` makes the
 * external call idempotent (a 409 is success).
 *
 * @private
 */
async function scanStuckPaid(limit) {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      status: "PAID",
      creditedAt: null,
      needsManualAction: false,
      reconcileAttempts: { lt: maxAttempts() },
      updatedAt: { lte: minutesAgo(STUCK_PAID_MINUTES) },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  const summary = {
    scanned: orders.length,
    credited: 0,
    deferred: 0,
    exhausted: 0,
  };

  for (const order of orders) {
    logger.warn(
      "Found PAID order with no credit — resuming interrupted credit",
      {
        orderId: order.id,
        providerPaymentId: order.providerPaymentId,
        stuckForMinutes: ageMinutes(order.updatedAt),
      },
    );

    try {
      // A PAID row is past the claim point, so creditOrder's `updateMany`
      // claim returns 0 and it re-reads. Only a RECONCILE_PENDING row falls
      // through to the external call there, so we first park it into the
      // retry lane the money path understands.
      const parked = await prisma.paymentOrder.updateMany({
        where: { id: order.id, status: "PAID", creditedAt: null },
        data: {
          status: "RECONCILE_PENDING",
          reconcileError: "STUCK_PAID_RESUMED",
        },
      });

      if (parked.count === 0) {
        // Someone finished it while we were looking. Nothing to do.
        continue;
      }

      const fresh = await prisma.paymentOrder.findUnique({
        where: { id: order.id },
      });
      if (!fresh) continue;

      const result = await retryCredit(fresh, { source: "RECONCILE" });
      if (result.credited) summary.credited += 1;
      else if (result.handled === "exhausted") summary.exhausted += 1;
      else summary.deferred += 1;
    } catch (error) {
      summary.deferred += 1;
      logger.error("Stuck-PAID recovery threw unexpectedly", {
        orderId: order.id,
        error: error.message,
      });
    }
  }

  return summary;
}

/* ------------------------------------------------------------------ *
 * Scan 3 — unprocessed webhook events (THE CRITICAL ONE)
 * ------------------------------------------------------------------ */

/**
 * Re-drive webhook events that were durably recorded but whose processing
 * failed. See the module header for why the gateway can never redeliver these.
 *
 * SIGNATURE IS NOT RE-VERIFIED, DELIBERATELY.
 * The scan is restricted to `signatureValid: true`, i.e. rows whose HMAC
 * already passed at receipt time, and `payload` holds the body that passed.
 * The RAW body is not persisted (by design — it can carry PII and is only
 * needed for the HMAC), so re-verification is impossible here anyway: HMAC is
 * over exact bytes and a JSON round-trip does not preserve them. Re-parsing
 * the stored, already-verified payload is therefore the correct move, and the
 * `signatureValid: true` filter is what keeps it safe.
 *
 * @private
 */
async function scanUnprocessedEvents(limit) {
  const events = await prisma.paymentWebhookEvent.findMany({
    where: {
      signatureValid: true,
      processed: false,
      receivedAt: { lte: minutesAgo(EVENT_GRACE_MINUTES) },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  const summary = {
    scanned: events.length,
    processed: 0,
    credited: 0,
    failed: 0,
    gaveUp: 0,
  };

  for (const event of events) {
    try {
      const result = await processStoredEvent(event);
      if (result.gaveUp) summary.gaveUp += 1;
      else if (result.ok) {
        summary.processed += 1;
        if (result.credited) summary.credited += 1;
      } else summary.failed += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("Stored webhook event replay threw unexpectedly", {
        eventId: event.id,
        error: error.message,
      });
    }
  }

  pruneEventMemory();
  return summary;
}

/**
 * Replay ONE stored event through exactly the routing `handleWebhook` uses.
 *
 * @private
 * @returns {Promise<{ok:boolean, credited?:boolean, gaveUp?:boolean}>}
 */
/**
 * True for providers whose webhooks are static-QR collections rather than
 * order-keyed gateway events.
 * @private
 */
function isQrProvider(provider) {
  return String(provider || "")
    .toLowerCase()
    .endsWith("_upi_qr");
}

async function processStoredEvent(event) {
  // Static-QR events are NOT order-first: they carry no providerOrderId, and
  // their provider's `parseWebhookEvent` deliberately returns IGNORED so this
  // order-keyed router can never pick them up. Route them to the QR replay path
  // instead, or they sit unprocessed forever and the money is never credited.
  if (isQrProvider(event.provider)) {
    try {
      const qrWebhookService = require("./qrWebhookService");
      const result = await qrWebhookService.replayStoredEvent(event);
      return result && result.ok
        ? {
            handled: result.handled || "qr_replayed",
            credited: Boolean(result.credited),
          }
        : recordEventFailure(
            event,
            `QR_REPLAY_FAILED: ${result?.handled || "unknown"}`,
          );
    } catch (error) {
      return recordEventFailure(event, `QR_REPLAY_ERROR: ${error.message}`);
    }
  }

  let impl;
  try {
    impl = getProvider(event.provider);
  } catch (error) {
    return recordEventFailure(
      event,
      `PROVIDER_NOT_SUPPORTED: ${error.message}`,
    );
  }

  // `rawBody: null` — not persisted; the stored payload is the verified body.
  const parsed = impl.parseWebhookEvent({
    rawBody: null,
    parsedBody: event.payload,
    headers: event.headers || {},
  });

  if (!parsed) {
    return recordEventFailure(event, "PARSE_RETURNED_NOTHING");
  }

  let order = null;
  let config = null;
  let credited = false;
  let effectiveOrderId = event.paymentOrderId || null;

  try {
    order = await findOrderForParsed(
      event.provider,
      parsed,
      event.paymentOrderId,
    );

    if (order) {
      effectiveOrderId = order.id;
      config = await resolveConfigForMode(event.provider, order.mode, {
        requireEnabled: false,
      });
    }

    // Same routing as handleWebhook step 6/7 — kept in lock-step on purpose.
    switch (parsed.outcome) {
      case "PAID": {
        if (order) {
          const result = await webhookService.creditOrder(order, parsed, {
            source: "RECONCILE",
            verifiedMode: order.mode,
            config,
          });
          credited = Boolean(result && result.credited);
        } else {
          // Captured against an order we hold no record of.
          //
          // adoptOrphanPayment SNAPSHOTS the mode onto the row it creates, and
          // `createOrphanOrder` defaults a missing mode to LIVE — i.e. guessing
          // here could credit real money for a test payment. The event row does
          // not record which mode's secret verified it, so we use the only
          // honest signal available: the provider's currently-active mode, the
          // same fallback `handleWebhook` uses when it has no order. If that
          // cannot be resolved we refuse to guess and fail the event.
          const active = await resolveActiveConfig(event.provider);
          const adopted = await webhookService.adoptOrphanPayment(parsed, {
            provider: event.provider,
            mode: active && active.mode,
            config: active,
          });
          effectiveOrderId = (adopted && adopted.orderId) || null;
          credited = Boolean(adopted && adopted.credited);
        }
        break;
      }
      case "EXPIRED":
        if (order)
          await webhookService.markOrderExpired(order, parsed, {
            source: "RECONCILE",
          });
        break;
      case "FAILED":
        if (order)
          await webhookService.markOrderFailed(order, parsed, {
            source: "RECONCILE",
          });
        break;
      case "REFUNDED":
        if (order)
          await webhookService.recordRefund(order, parsed, {
            source: "RECONCILE",
          });
        break;
      case "IGNORED":
      default:
        // Nothing to do — `order.paid` / `payment_link.cancelled` land here by
        // design. Marking it processed is the whole job.
        break;
    }
  } catch (error) {
    return recordEventFailure(
      event,
      `${parsed.outcome || "UNKNOWN"}: ${error.message}`,
      effectiveOrderId,
    );
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: {
      processed: true,
      processedAt: new Date(),
      processingError: null,
      paymentOrderId: effectiveOrderId,
    },
  });

  eventAttempts.delete(event.id);

  logger.info("Recovered unprocessed webhook event", {
    eventId: event.id,
    provider: event.provider,
    eventType: event.eventType,
    outcome: parsed.outcome,
    orderId: effectiveOrderId,
    credited,
  });

  return { ok: true, credited };
}

/**
 * Record a failed replay, and decide whether this event is poison.
 *
 * Two independent bounds (see the `eventAttempts` comment): the in-memory
 * attempt count, and the durable age of `receivedAt`. Either one trips the
 * give-up.
 *
 * @private
 */
async function recordEventFailure(event, reason, orderId) {
  const seen = eventAttempts.get(event.id) || { attempts: 0 };
  const attempts = seen.attempts + 1;
  eventAttempts.set(event.id, { attempts, lastSeenAt: Date.now() });

  const tooOld = ageMinutes(event.receivedAt) >= EVENT_GIVEUP_MINUTES;
  const tooMany = attempts >= maxAttempts();

  if (tooOld || tooMany) {
    await giveUpOnEvent(
      event,
      reason,
      attempts,
      orderId,
      tooOld ? "age" : "attempts",
    );
    return { ok: false, gaveUp: true };
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: {
      processingError: `[reconcile attempt ${attempts}] ${String(reason).slice(0, 1900)}`,
      paymentOrderId: orderId || event.paymentOrderId || null,
    },
  });

  logger.warn("Webhook event replay failed — will retry next tick", {
    eventId: event.id,
    provider: event.provider,
    eventType: event.eventType,
    attempts,
    reason: String(reason).slice(0, 300),
  });

  return { ok: false };
}

/**
 * Abandon a poison event to a human.
 *
 * `processed: true` here does NOT mean "handled" — it means "no longer machine
 * actionable". Leaving it false would let the row eat a slot of every future
 * tick forever. The human-facing handles are the `GAVE_UP` prefix on
 * `processingError`, the linked order's `needsManualAction`, and the
 * `TOPUP_RECONCILE_EXHAUSTED` audit row.
 *
 * @private
 */
async function giveUpOnEvent(event, reason, attempts, orderId, bound) {
  const linkedId = orderId || event.paymentOrderId || null;

  await prisma.paymentWebhookEvent.update({
    where: { id: event.id },
    data: {
      processed: true,
      processedAt: new Date(),
      processingError: `GAVE_UP after ${attempts} reconcile attempts (bound=${bound}): ${String(
        reason,
      ).slice(0, 1800)}`,
      paymentOrderId: linkedId,
    },
  });

  eventAttempts.delete(event.id);

  let order = null;
  if (linkedId) {
    order = await prisma.paymentOrder.findUnique({ where: { id: linkedId } });
    if (order) {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          needsManualAction: true,
          nextRetryAt: null,
          reconcileError: `WEBHOOK_EVENT_UNPROCESSABLE: ${String(reason).slice(0, 1900)}`,
        },
      });
    }
  }

  await writeAudit({
    action: "TOPUP_RECONCILE_EXHAUSTED",
    resourceId: linkedId,
    userId: order ? order.subjectUserId : null,
    details: {
      source: "WEBHOOK_EVENT",
      eventId: event.id,
      provider: event.provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      receivedAt: event.receivedAt,
      attempts,
      bound,
      maxAttempts: maxAttempts(),
      lastError: String(reason).slice(0, 500),
      note:
        "A signature-valid webhook event could not be processed. The payment it " +
        "describes may be captured and un-credited — an operator must check the " +
        "gateway and credit by hand using <PREFIX>_<providerPaymentId> (RZP_ / CCAV_) as the reference.",
    },
  });

  logger.error(
    "GAVE UP on unprocessable webhook event — manual action required",
    {
      eventId: event.id,
      provider: event.provider,
      eventType: event.eventType,
      orderId: linkedId,
      attempts,
      bound,
    },
  );
}

/** Keep the poison-guard map bounded. @private */
function pruneEventMemory() {
  const cutoff = Date.now() - EVENT_MEMORY_TTL_MS;
  for (const [id, entry] of eventAttempts.entries()) {
    if (!entry.lastSeenAt || entry.lastSeenAt < cutoff)
      eventAttempts.delete(id);
  }
}

/**
 * Locate the order an event refers to. Prefers the link already recorded on
 * the event row, then the same precedence webhookService uses.
 *
 * @private
 */
async function findOrderForParsed(provider, parsed, linkedOrderId) {
  if (linkedOrderId) {
    const linked = await prisma.paymentOrder.findUnique({
      where: { id: linkedOrderId },
    });
    if (linked) return linked;
  }

  if (parsed.providerPaymentId) {
    const byPayment = await prisma.paymentOrder.findFirst({
      where: { provider, providerPaymentId: parsed.providerPaymentId },
    });
    if (byPayment) return byPayment;
  }

  if (parsed.providerOrderId) {
    const byOrder = await prisma.paymentOrder.findFirst({
      where: { provider, providerOrderId: parsed.providerOrderId },
      orderBy: { createdAt: "desc" },
    });
    if (byOrder) return byOrder;
  }

  if (parsed.providerLinkId) {
    const byLink = await prisma.paymentOrder.findFirst({
      where: { provider, providerLinkId: parsed.providerLinkId },
      orderBy: { createdAt: "desc" },
    });
    if (byLink) return byLink;
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Scan 4 — stuck static-QR collections
 * ------------------------------------------------------------------ */

/**
 * A `QrCollection` stuck at CREDIT_PENDING.
 *
 * `qrCreditService.attributeAndCredit` claims the row
 * (ATTRIBUTED|CREDIT_PENDING -> CREDIT_PENDING) BEFORE it mints the
 * `PaymentOrder` and calls `creditOrder`. A process that dies anywhere in that
 * window — or a `creditOrder` that deferred and was never retried — leaves the
 * row at CREDIT_PENDING with no order to point at, so NONE of the
 * PaymentOrder-level scans above can see it. The money is in the merchant
 * account and the outlet never sees it, with no error recorded anywhere.
 *
 * Scans 1 and 2 already cover the OTHER half of this failure: an order that WAS
 * minted and parked RECONCILE_PENDING. What is left for this scan is the
 * collection-level half — claimed but no `paymentOrderId`, or an order that
 * exists while the collection was never reconciled back to CREDITED.
 *
 * THE RETRY IS `attributeAndCredit`, NEVER `creditOrder` DIRECTLY.
 * Its own guarded `updateMany` claim makes a concurrent retry a no-op, and its
 * deterministic `UPIQR_<utr>` external reference makes a duplicate credit
 * impossible: the external wallet 409s on the reused reference and
 * `creditOrder` reads that 409 as success. Re-implementing any part of that
 * here would be a second place to get idempotency wrong.
 *
 * INDEX NOTE: `QrCollection` has no index on `updatedAt`. The staleness rule is
 * expressed on `updatedAt` (the only column that moves when a retry touches the
 * row), but the query is ALSO narrowed and ordered on `receivedAt` so it is
 * served by the existing `@@index([status, receivedAt])`. That narrowing is
 * lossless: `updatedAt >= receivedAt` always holds, so every row matching the
 * `updatedAt` cutoff necessarily matches the `receivedAt` one — the latter is a
 * strict superset the index can seek, with `updatedAt` left as the residual
 * filter. Oldest-arrived-first is also the fairer drain order for money that
 * has been sitting un-credited the longest.
 *
 * @private
 */
async function scanStuckQrCollections(limit) {
  const cutoff = minutesAgo(stuckQrMinutes());

  const collections = await prisma.qrCollection.findMany({
    where: {
      status: "CREDIT_PENDING",
      // Once a human owns the row the machine must stop touching it. This is
      // also what makes `giveUpOnQrCollection` permanent.
      needsManualAction: false,
      receivedAt: { lte: cutoff },
      updatedAt: { lte: cutoff },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  const summary = {
    scanned: collections.length,
    credited: 0,
    deferred: 0,
    gaveUp: 0,
  };

  for (const collection of collections) {
    try {
      const result = await retryQrCollection(collection);
      if (result.credited) summary.credited += 1;
      else if (result.gaveUp) summary.gaveUp += 1;
      else summary.deferred += 1;
    } catch (error) {
      summary.deferred += 1;
      logger.error("Stuck-QR collection recovery threw unexpectedly", {
        collectionId: collection.id,
        error: error.message,
      });
    }
  }

  pruneQrMemory();
  return summary;
}

/**
 * Drive one stuck collection back onto the QR credit path, and decide whether
 * it is poison. Never throws.
 *
 * @private
 * @returns {Promise<{credited:boolean, gaveUp?:boolean, handled:string}>}
 */
async function retryQrCollection(collection) {
  logger.warn(
    "Found CREDIT_PENDING QR collection with no completed credit — resuming",
    {
      collectionId: collection.id,
      utr: collection.utr,
      paymentOrderId: collection.paymentOrderId,
      amountPaise: collection.amountPaise,
      stuckForMinutes: ageMinutes(collection.updatedAt),
    },
  );

  const qrCreditService = require("./qrCreditService");

  let result;
  let failure = null;

  try {
    result = await qrCreditService.attributeAndCredit(collection, {
      source: "RECONCILE",
    });
  } catch (error) {
    // attributeAndCredit is documented never to throw for an expected failure,
    // so anything landing here is unexpected — treat it as a failed attempt.
    result = null;
    failure = `QR_CREDIT_THREW: ${error.message}`;
  }

  if (result && result.credited) {
    qrAttempts.delete(collection.id);
    return { credited: true, handled: result.handled || "credited" };
  }

  // Another caller (a webhook redelivery, an admin retry) got there first.
  // Not a failure, and not something to burn an attempt on.
  if (result && result.handled === "already_processed") {
    qrAttempts.delete(collection.id);
    return { credited: false, handled: "already_processed" };
  }

  const reason =
    failure ||
    `QR_CREDIT_${String((result && result.handled) || "unknown").toUpperCase()}` +
      (result && result.reason ? `: ${result.reason}` : "");

  return recordQrFailure(collection, reason);
}

/**
 * Record a failed sweep of a collection against BOTH bounds.
 *
 * The in-memory attempt count catches a fast-failing row inside one process
 * lifetime; the durable `updatedAt` age catches a row whose counter a restart
 * wiped. Either one trips the give-up.
 *
 * Note that `attributeAndCredit`'s own `defer` already sets
 * `needsManualAction: true` for the failures it can name, which removes the row
 * from this scan's `where` on its own. These bounds exist for the failures it
 * CANNOT name — a crash loop that never reaches `defer`.
 *
 * @private
 */
async function recordQrFailure(collection, reason) {
  const seen = qrAttempts.get(collection.id) || { attempts: 0 };
  const attempts = seen.attempts + 1;
  qrAttempts.set(collection.id, { attempts, lastSeenAt: Date.now() });

  const tooOld = ageMinutes(collection.updatedAt) >= qrGiveUpMinutes();
  const tooMany = attempts >= maxAttempts();

  if (tooOld || tooMany) {
    await giveUpOnQrCollection(
      collection,
      reason,
      attempts,
      tooOld ? "age" : "attempts",
    );
    return { credited: false, gaveUp: true, handled: "exhausted" };
  }

  logger.warn("Stuck-QR collection retry failed — will retry next tick", {
    collectionId: collection.id,
    attempts,
    reason: String(reason).slice(0, 300),
  });

  return { credited: false, handled: "deferred" };
}

/**
 * Attempt budget spent. Take the collection out of the automated queue and put
 * it in front of a human. Mirrors `exhaustOrder`: `needsManualAction: true` is
 * excluded by this scan's `where`, so the flag is what makes the give-up
 * permanent, and the audit row records exactly why.
 *
 * @private
 */
async function giveUpOnQrCollection(collection, reason, attempts, bound) {
  try {
    await prisma.qrCollection.update({
      where: { id: collection.id },
      data: {
        needsManualAction: true,
        lastError: `RECONCILE_EXHAUSTED after ${attempts} attempts (bound=${bound}): ${String(
          reason,
        ).slice(0, 1800)}`,
      },
    });
  } catch (error) {
    logger.error("Could not flag exhausted QR collection for manual action", {
      collectionId: collection.id,
      error: error.message,
    });
  }

  qrAttempts.delete(collection.id);

  await writeAudit({
    action: "QR_COLLECTION_RECONCILE_EXHAUSTED",
    resource: "QrCollection",
    resourceId: collection.id,
    userId: collection.subjectUserId,
    details: {
      provider: collection.provider,
      mode: collection.mode,
      status: collection.status,
      amount: toNumber(collection.amount),
      amountPaise: collection.amountPaise,
      utr: collection.utr,
      walletUserId: collection.walletUserId,
      clientCode: collection.clientCode,
      paymentOrderId: collection.paymentOrderId,
      externalReferenceId: collection.externalReferenceId,
      receivedAt: collection.receivedAt,
      attempts,
      bound,
      maxAttempts: maxAttempts(),
      lastError: String(reason).slice(0, 500),
      note:
        "Automated reconciliation gave up on a static-QR collection stuck at CREDIT_PENDING. " +
        "The payer's money is already in the merchant account and the outlet's wallet is short — " +
        "an operator must credit it by hand. The stored externalReferenceId (UPIQR_<utr>) MUST be " +
        "reused for any manual credit so the external wallet still de-duplicates.",
    },
  });

  logger.error("GAVE UP on stuck QR collection — manual action required", {
    collectionId: collection.id,
    utr: collection.utr,
    amountPaise: collection.amountPaise,
    externalReferenceId: collection.externalReferenceId,
    attempts,
    bound,
  });
}

/** Keep the poison-guard map bounded. @private */
function pruneQrMemory() {
  const cutoff = Date.now() - EVENT_MEMORY_TTL_MS;
  for (const [id, entry] of qrAttempts.entries()) {
    if (!entry.lastSeenAt || entry.lastSeenAt < cutoff) qrAttempts.delete(id);
  }
}

/* ------------------------------------------------------------------ *
 * Scan 5 — expiry sweep
 * ------------------------------------------------------------------ */

/**
 * Locally expire orders whose `expiresAt` has passed.
 *
 * Razorpay's `payment_link.expired` is not guaranteed to be prompt (and for a
 * plain Checkout order there is no expiry event at all), so an abandoned order
 * would otherwise sit in CREATED forever and pollute every queue and count.
 *
 * This is safe against a late genuine capture: `creditOrder`'s claim set
 * includes EXPIRED, so a real payment arriving after our local expiry guess
 * still wins and still credits.
 *
 * @private
 */
async function scanExpired(limit) {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      status: { in: ["CREATED", "PENDING"] },
      expiresAt: { lt: new Date() },
    },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });

  const summary = { scanned: orders.length, expired: 0 };

  for (const order of orders) {
    try {
      const result = await webhookService.markOrderExpired(
        order,
        { providerPaymentId: null },
        { source: "RECONCILE" },
      );
      if (result && result.handled === "expired") summary.expired += 1;
    } catch (error) {
      logger.error("Expiry sweep failed for order", {
        orderId: order.id,
        error: error.message,
      });
    }
  }

  return summary;
}

/* ------------------------------------------------------------------ *
 * Public surface
 * ------------------------------------------------------------------ */

/**
 * One reconciliation pass: all four scans, in order.
 *
 * Every scan is individually guarded — one failing scan never prevents the
 * others from running, and the function resolves with a summary rather than
 * throwing, so the worker's interval callback can never see an exception.
 *
 * @param {Object} [options]
 * @param {number} [options.limit=25] per-scan row budget
 * @returns {Promise<Object>} summary
 */
async function runPending({ limit = 25 } = {}) {
  const budget = Math.max(1, Math.min(500, Number(limit) || 25));
  const startedAt = Date.now();

  const summary = {
    limit: budget,
    reconcilePending: null,
    stuckPaid: null,
    events: null,
    stuckQrCollections: null,
    expired: null,
    errors: [],
  };

  // ORDER MATTERS. The four money-recovery scans run first and contiguously;
  // the expiry sweep is terminal bookkeeping that moves no money and stays
  // last so it can never delay a credit.
  //
  // The QR sweep sits AFTER the events scan on purpose: that scan routes
  // `*_upi_qr` events to `qrWebhookService.replayStoredEvent`, which can leave
  // a collection freshly claimed at CREDIT_PENDING. Running the collection
  // sweep straight after closes out anything that replay could not finish
  // within the SAME pass rather than a tick later — and its own staleness
  // cutoff means a collection the replay just touched is not stolen mid-flight.
  const scans = [
    ["reconcilePending", () => scanReconcilePending(budget)],
    ["stuckPaid", () => scanStuckPaid(budget)],
    ["events", () => scanUnprocessedEvents(budget)],
    ["stuckQrCollections", () => scanStuckQrCollections(budget)],
    ["expired", () => scanExpired(budget)],
  ];

  for (const [name, run] of scans) {
    try {
      summary[name] = await run();
    } catch (error) {
      summary.errors.push({ scan: name, error: error.message });
      logger.error("Reconcile scan failed", {
        scan: name,
        error: error.message,
      });
    }
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}

/**
 * Force an immediate retry of one order, bypassing the backoff schedule.
 * Backing the admin "retry" button.
 *
 * `needsManualAction` is deliberately NOT cleared here: an AMOUNT_MISMATCH or
 * MODE_MISMATCH order must stay flagged, and `creditOrder` clears the flag
 * itself the moment a credit actually succeeds.
 *
 * @param {string} orderId
 * @param {Object} [options]
 * @param {Object} [options.actor] req.user
 * @returns {Promise<Object>}
 */
async function retryOne(orderId, { actor } = {}) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return { handled: "not_found", credited: false, orderId };
  }

  if (order.status === "CREDITED") {
    return {
      handled: "already_credited",
      credited: true,
      orderId,
      status: order.status,
    };
  }

  if (!RETRYABLE_ORDER_STATUSES.includes(order.status)) {
    return {
      handled: "not_retryable",
      credited: false,
      orderId,
      status: order.status,
    };
  }

  // Clear the schedule so this attempt runs now, and reset the counter so an
  // operator-initiated retry gets a fresh budget rather than instantly
  // re-exhausting.
  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: "RECONCILE_PENDING",
      nextRetryAt: null,
      reconcileAttempts: 0,
      lastReconcileAt: new Date(),
    },
  });

  await writeAudit({
    action: "TOPUP_RECONCILE_RETRY",
    resourceId: order.id,
    userId: actor && actor.id,
    details: {
      provider: order.provider,
      mode: order.mode,
      previousStatus: order.status,
      previousAttempts: order.reconcileAttempts,
      providerPaymentId: order.providerPaymentId,
      externalReferenceId: order.externalReferenceId,
      requestedBy: (actor && actor.id) || null,
    },
  });

  const fresh = await prisma.paymentOrder.findUnique({
    where: { id: order.id },
  });
  const result = await retryCredit(fresh, { source: "RECONCILE" });

  return { ...result, orderId: order.id };
}

/**
 * Cheap counters for `/health` and for the admin queue header.
 *
 * ALL OF THESE ARE ALERTING SIGNALS, NEVER A HEALTH VERDICT. `/health` folds
 * this block in WITHOUT touching `isHealthy` (see the note in `server.js`) —
 * a backlog means work is queued, not that the service is broken, and flipping
 * the probe would take a healthy replica out of rotation and stop the very
 * worker that drains the backlog. The two QR counters below are here for the
 * same reason: they surface the depth of the HUMAN queue.
 *
 * Both QR counts are served by `@@index([status])` on `qr_collections`.
 *
 * @returns {Promise<{reconcilePending:number, needsManualAction:number,
 *   unprocessedEvents:number, stuckQrCollections:number,
 *   unattributedQrCollections:number, oldestAgeMinutes:number|null}>}
 */
async function getBacklogCounts() {
  const [
    reconcilePending,
    needsManualAction,
    unprocessedEvents,
    stuckQrCollections,
    unattributedQrCollections,
    oldest,
  ] = await Promise.all([
    prisma.paymentOrder.count({ where: { status: "RECONCILE_PENDING" } }),
    prisma.paymentOrder.count({ where: { needsManualAction: true } }),
    prisma.paymentWebhookEvent.count({
      where: { signatureValid: true, processed: false },
    }),
    // Money that arrived on a static QR and is still not in a wallet.
    prisma.qrCollection.count({ where: { status: "CREDIT_PENDING" } }),
    // Money that arrived but could not be matched to an outlet's QR at all —
    // purely a human queue; nothing automated can move these forward.
    prisma.qrCollection.count({ where: { status: "UNATTRIBUTED" } }),
    prisma.paymentOrder.findFirst({
      where: { status: "RECONCILE_PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    reconcilePending,
    needsManualAction,
    unprocessedEvents,
    stuckQrCollections,
    unattributedQrCollections,
    oldestAgeMinutes: oldest ? ageMinutes(oldest.createdAt) : null,
  };
}

/**
 * THE LIST ENVELOPE IS A HARD CONTRACT.
 *
 * The frontend's RTK Query slice unwraps `response.data`, so anything placed
 * in `meta` (where `APIResponse.paginated()` puts pagination) is DISCARDED
 * before the table sees it. Pagination therefore rides INSIDE the payload, in
 * snake_case, with a 0-BASED `current_page`. Do not "tidy" this into
 * `APIResponse.paginated()`.
 *
 * @private
 */
function buildListEnvelope(rows, total, page, size, filters, counts) {
  const totalPages = size > 0 ? Math.ceil(total / size) : 0;

  return {
    data: rows.map(serializeOrder),
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
    counts,
  };
}

/** Row -> API shape. Money as numbers; no secrets, no raw gateway payloads. @private */
function serializeOrder(order) {
  return {
    id: order.id,
    kind: order.kind,
    provider: order.provider,
    mode: order.mode,
    isTest: order.isTest,
    status: order.status,

    walletUserId: order.walletUserId,
    clientCode: order.clientCode,
    subjectUserId: order.subjectUserId,

    amount: toNumber(order.amount),
    amountPaise: order.amountPaise,
    currency: order.currency,
    refundedAmount: toNumber(order.refundedAmount),

    providerOrderId: order.providerOrderId,
    providerLinkId: order.providerLinkId,
    providerPaymentId: order.providerPaymentId,

    externalReferenceId: order.externalReferenceId,
    externalTransactionId: order.externalTransactionId,
    creditedAt: order.creditedAt,

    reconcileAttempts: order.reconcileAttempts,
    lastReconcileAt: order.lastReconcileAt,
    nextRetryAt: order.nextRetryAt,
    reconcileError: order.reconcileError,
    needsManualAction: order.needsManualAction,

    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ageMinutes: ageMinutes(order.createdAt),
  };
}

/**
 * The admin reconcile queue.
 *
 * @param {Object} args
 * @param {Object} args.query validated query ({ status, provider, walletUserId,
 *   needsManualAction, page, size, sortDir })
 * @param {Object} [args.actor] req.user
 * @returns {Promise<Object>} the list envelope + `counts`
 */
async function listPending({ query = {}, actor } = {}) {
  const page = Math.max(
    0,
    Number.isInteger(query.page) ? query.page : Number(query.page ?? 0) || 0,
  );
  const rawSize = Number(query.size ?? 20) || 20;
  const size = Math.max(1, Math.min(100, rawSize));
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";

  const where = {};

  if (query.status) {
    where.status = query.status;
  } else {
    // Default view: everything a human might have to act on.
    where.status = { in: ["RECONCILE_PENDING", "PAID"] };
  }

  if (query.provider) where.provider = query.provider;
  if (query.walletUserId) where.walletUserId = query.walletUserId;
  if (query.clientCode) where.clientCode = query.clientCode;
  if (typeof query.needsManualAction === "boolean") {
    where.needsManualAction = query.needsManualAction;
  }

  const [total, rows, counts] = await Promise.all([
    prisma.paymentOrder.count({ where }),
    prisma.paymentOrder.findMany({
      where,
      orderBy: { createdAt: sortDir },
      skip: page * size,
      take: size,
    }),
    getBacklogCounts(),
  ]);

  logger.debug("Listing reconcile queue", {
    actorId: actor && actor.id,
    total,
    page,
    size,
  });

  return buildListEnvelope(
    rows,
    total,
    page,
    size,
    {
      status: query.status ?? null,
      provider: query.provider ?? null,
      walletUserId: query.walletUserId ?? null,
      clientCode: query.clientCode ?? null,
      needsManualAction:
        typeof query.needsManualAction === "boolean"
          ? query.needsManualAction
          : null,
      sortDir,
    },
    counts,
  );
}

module.exports = {
  runPending,
  retryOne,
  listPending,
  getBacklogCounts,

  // Exported for the worker, tests and manual triage — not part of the HTTP
  // surface.
  backoffMinutes,
  maxAttempts,
  serializeOrder,
  stuckQrMinutes,
  qrGiveUpMinutes,
  MAX_BACKOFF_MINUTES,
  STUCK_PAID_MINUTES,
  EVENT_GRACE_MINUTES,
  EVENT_GIVEUP_MINUTES,
  STUCK_QR_MINUTES,
  QR_GIVEUP_MINUTES,
};
