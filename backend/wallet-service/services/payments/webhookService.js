/**
 * Payment Webhook Service — THE ONLY CODE PATH THAT MOVES MONEY.
 *
 * Everything that can credit a wallet from a payment gateway funnels through
 * `creditOrder()` in this file: the provider webhook, the `/self/verify`
 * browser fast-path, the admin "refresh link status" button and the reconcile
 * worker. There is exactly ONE crediting implementation on purpose — a second
 * one would be a second place to get idempotency wrong.
 *
 * THE INVARIANTS (do not violate these from any other module):
 *
 *   I1. NEVER credit an unverified body. Signature verification gates
 *       everything below step 4 of handleWebhook().
 *   I2. NEVER credit twice. Two independent guards stand in the way:
 *       (a) the local guarded `updateMany` CREATED|PENDING|EXPIRED -> PAID
 *           claim, which exactly one concurrent caller can win, and
 *       (b) the external wallet API's uniqueness constraint on
 *           `reference_id` (= `RZP_<providerPaymentId>`), which is our
 *           CROSS-PROCESS idempotency key. Its 409 is a SUCCESS signal.
 *   I3. NEVER credit an amount we did not ask for. The comparison is done in
 *       integer PAISE, never in floats/Decimal.
 *   I4. NEVER let TEST money reach a LIVE balance (or vice versa). A TEST
 *       order short-circuits before `externalWalletClient.topup` is called.
 *   I5. The EXTERNAL wallet API is the real balance. The local Prisma
 *       `Wallet`/`Transaction` tables are legacy and are NOT touched here.
 *   I6. Once the signature verifies, ALWAYS return HTTP 200 — even on credit
 *       failure (which becomes RECONCILE_PENDING and is retried by the
 *       worker). A non-2xx makes Razorpay redeliver an event we have already
 *       durably recorded, and the replay guard would then swallow it as a
 *       duplicate without crediting. That is how money gets lost.
 *   I7. Every state change writes an AuditLog row.
 *   I8. Every terminal transition uses a guarded `updateMany` with an explicit
 *       allowed-from set, so a late or out-of-order event can never overwrite
 *       a terminal state (an `order.failed` arriving after `payment.captured`
 *       must not un-credit a paid order).
 *
 * @module services/payments/webhookService
 */

const { prisma } = require("../../config/database");
const { getRedisClient } = require("../../config/redis");
const logger = require("../../shared/lib/logger");
const { APIError } = require("../../shared/lib/errors");

const { getProvider } = require("./index");
const {
  resolveConfigForMode,
  resolveActiveConfig,
} = require("./providerConfigService");
const {
  buildBalanceCacheKeys,
  normalizeClientCode,
} = require("./walletIdentity");
const { getExternalWalletClient } = require("../externalWalletClient");

/* ------------------------------------------------------------------ *
 * Status transition tables (I8)
 *
 * Each constant is the ALLOWED-FROM set for one transition. They are the
 * single source of truth for "can this event still move this order?" and are
 * deliberately narrow.
 * ------------------------------------------------------------------ */

/**
 * -> PAID (the credit claim).
 * EXPIRED is included ON PURPOSE: `expiresAt` is our local *guess* at when the
 * gateway link dies. A real captured payment always beats that guess — a
 * customer who paid at T+1s past our expiry window must still be credited.
 */
const CLAIMABLE_FOR_CREDIT = ["CREATED", "PENDING", "EXPIRED"];

/** -> FAILED. A paid/credited/refunded order is terminal for failure events. */
const FAILABLE_FROM = ["CREATED", "PENDING"];

/** -> EXPIRED. Same reasoning: expiry may never undo a capture. */
const EXPIRABLE_FROM = ["CREATED", "PENDING"];

/** -> REFUNDED / partial refund accounting. Only money that landed can go back. */
const REFUNDABLE_FROM = ["PAID", "CREDITED", "REFUNDED", "RECONCILE_PENDING"];

/** -> CREDITED via the TEST short-circuit (no external call). */
const TEST_CREDITABLE_FROM = ["CREATED", "PENDING", "EXPIRED", "PAID"];

/** Max reconcile backoff, in minutes. */
const MAX_BACKOFF_MINUTES = 60;

/** Header keys that are never persisted with the webhook event. */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
]);

/* ------------------------------------------------------------------ *
 * handleWebhook
 * ------------------------------------------------------------------ */

/**
 * Ingest one provider webhook delivery.
 *
 * Returns a plain result object; the controller maps `status` onto the HTTP
 * response. This function only THROWS for genuine infrastructure failures that
 * happened BEFORE the event was durably recorded (see I6) — those must surface
 * as 503 so the gateway redelivers.
 *
 * @param {Object} params
 * @param {string} params.provider    - provider name, e.g. "razorpay"
 * @param {Buffer|string} params.rawBody - EXACT bytes received (HMAC input)
 * @param {Object} [params.parsedBody]
 * @param {Object} [params.headers]
 * @param {string} [params.ip]
 * @returns {Promise<{status:number, code?:string, handled:string, outcome?:string,
 *   orderId?:string|null, eventId?:string|null, result?:Object}>}
 */
async function handleWebhook({ provider, rawBody, parsedBody, headers, ip }) {
  // ---- 1. Resolve the provider implementation -----------------------------
  let impl;
  try {
    impl = getProvider(provider);
  } catch (error) {
    logger.warn("Webhook received for unsupported provider", {
      provider,
      error: error.message,
    });
    return {
      status: 404,
      code: "PROVIDER_NOT_SUPPORTED",
      handled: "unsupported_provider",
    };
  }

  // ---- 2. PARSE FIRST, VERIFY SECOND --------------------------------------
  // We cannot verify until we know WHICH SECRET to verify with, and that
  // depends on the mode recorded on the order this event refers to — which we
  // only learn by parsing. Parsing is pure and side-effect free (it never
  // throws; a malformed body yields outcome IGNORED), so doing it before
  // verification is safe. NOTHING is trusted from the parse result until the
  // signature check in step 3/4 passes.
  const parsed = impl.parseWebhookEvent({ rawBody, parsedBody, headers });

  let order = null;
  try {
    order = await findOrderForEvent(provider, parsed);
  } catch (error) {
    // Pre-record infrastructure failure -> let the gateway redeliver.
    throw infraError(error, "order lookup");
  }

  // ---- 3. Verify with the secret for the mode ON THAT ORDER ----------------
  // Razorpay posts BOTH test and live traffic to the SAME webhook URL, and an
  // admin may flip the platform between TEST and LIVE while an order is still
  // in flight. `PaymentOrder.mode` is snapshotted at creation time, so an
  // in-flight order is always verified against the secret it was created with
  // and survives the switch. `requireEnabled: false` for the same reason: a
  // provider disabled *after* an order was created must still have its
  // in-flight payments verified and credited — the customer's money is
  // already gone.
  //
  // With no local order (orphan / unknown reference) we cannot know the mode,
  // so we try the currently-active mode first, then the other one.
  const verification = await verifySignature({
    impl,
    provider,
    order,
    rawBody,
    headers,
  });

  // ---- 4. Signature mismatch: record and reject ---------------------------
  if (!verification.verified) {
    // Persist the rejection for forensics. Never log the secret, the raw body,
    // or the signature — only the event identity.
    await safeRecordRejectedEvent({ provider, parsed, headers, order, ip });

    logger.warn("Webhook signature verification FAILED — body not processed", {
      provider,
      eventType: parsed.eventType,
      providerEventId: parsed.providerEventId,
      orderId: order ? order.id : null,
      triedModes: verification.triedModes,
      ip,
    });

    return {
      status: 401,
      code: "INVALID_SIGNATURE",
      handled: "rejected",
      eventId: parsed.providerEventId,
    };
  }

  const config = verification.config;
  const verifiedMode = verification.mode;

  // ---- 5. Replay guard ----------------------------------------------------
  // `@@unique([provider, providerEventId])` is the dedupe. Razorpay retries an
  // event until it gets a 2xx, and an admin can replay one by hand from the
  // dashboard; both arrive with the SAME `x-razorpay-event-id`. Losing this
  // race must cost nothing, so a P2002 returns 200 WITHOUT touching money.
  let eventRow;
  try {
    eventRow = await prisma.paymentWebhookEvent.create({
      data: {
        provider,
        providerEventId: parsed.providerEventId || `unidentified:${Date.now()}`,
        eventType: parsed.eventType || "unknown",
        payload: parsed.raw || {},
        headers: sanitizeHeaders(headers),
        signatureValid: true,
        paymentOrderId: order ? order.id : null,
      },
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      logger.info("Duplicate webhook delivery ignored (replay guard)", {
        provider,
        providerEventId: parsed.providerEventId,
        eventType: parsed.eventType,
      });
      return {
        status: 200,
        handled: "duplicate",
        eventId: parsed.providerEventId,
      };
    }
    // Not yet durably recorded -> 503 is safe, the event will be redelivered.
    throw infraError(error, "webhook event persist");
  }

  // ---- 6/7. Route on outcome ----------------------------------------------
  // From here on the event IS durably recorded. An unexpected failure below
  // must NOT become a non-2xx: a redelivery would hit the replay guard and be
  // swallowed as a duplicate without crediting (I6). Instead we record the
  // error on the event row for the reconcile worker / an admin.
  let result = { handled: "ignored" };
  let effectiveOrderId = order ? order.id : null;

  try {
    switch (parsed.outcome) {
      case "PAID": {
        if (order) {
          result = await creditOrder(order, parsed, {
            source: "WEBHOOK",
            verifiedMode,
            config,
          });
        } else {
          // Paid against an order we have no local record of.
          const adopted = await adoptOrphanPayment(parsed, {
            provider,
            mode: verifiedMode,
            config,
          });
          effectiveOrderId = adopted.orderId || null;
          result = adopted;
        }
        break;
      }
      case "FAILED":
        result = order
          ? await markOrderFailed(order, parsed, { source: "WEBHOOK" })
          : { handled: "no_order" };
        break;
      case "EXPIRED":
        result = order
          ? await markOrderExpired(order, parsed, { source: "WEBHOOK" })
          : { handled: "no_order" };
        break;
      case "REFUNDED":
        result = order
          ? await recordRefund(order, parsed, { source: "WEBHOOK" })
          : { handled: "no_order" };
        break;
      case "IGNORED":
      default:
        // `order.paid` and `payment_link.cancelled` land here by design — the
        // provider already maps them to IGNORED because the authoritative
        // event for those flows is `payment.captured`. Do not re-handle them.
        result = { handled: "ignored" };
        break;
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        processed: true,
        processedAt: new Date(),
        paymentOrderId: effectiveOrderId,
      },
    });
  } catch (error) {
    logger.error("Webhook processing failed AFTER the event was recorded", {
      provider,
      eventId: eventRow.id,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      orderId: effectiveOrderId,
      error: error.message,
    });

    // Best-effort: leave a breadcrumb, still answer 200 (I6).
    try {
      await prisma.paymentWebhookEvent.update({
        where: { id: eventRow.id },
        data: {
          processed: false,
          processingError: String(error.message || error).slice(0, 2000),
          paymentOrderId: effectiveOrderId,
        },
      });
    } catch (markError) {
      logger.error("Could not annotate failed webhook event", {
        eventId: eventRow.id,
        error: markError.message,
      });
    }

    return {
      status: 200,
      handled: "deferred",
      outcome: parsed.outcome,
      orderId: effectiveOrderId,
      eventId: parsed.providerEventId,
    };
  }

  // ---- 8. Always 200 once the signature verified (I6) ---------------------
  return {
    status: 200,
    handled: result.handled || "processed",
    outcome: parsed.outcome,
    orderId: effectiveOrderId,
    eventId: parsed.providerEventId,
    result,
  };
}

/* ------------------------------------------------------------------ *
 * creditOrder — THE MONEY PATH
 * ------------------------------------------------------------------ */

/**
 * Credit one paid order to the EXTERNAL wallet. The single crediting
 * implementation shared by the webhook, `/self/verify`, the admin link
 * refresh and the reconcile worker.
 *
 * Never throws for an external-API failure: such a failure becomes
 * RECONCILE_PENDING and resolves normally so the caller can still answer 200.
 *
 * @param {Object} order  - PaymentOrder row
 * @param {Object} parsed - normalized event (or fetchPayment result)
 * @param {Object} [options]
 * @param {string} [options.source] - WEBHOOK | SELF_VERIFY | ADMIN_REFRESH | RECONCILE
 * @param {string} [options.verifiedMode] - mode of the config used to verify (b)
 * @param {Object} [options.config] - resolved provider config (its `.mode` is used if verifiedMode is absent)
 * @returns {Promise<Object>}
 */
async function creditOrder(order, parsed, options = {}) {
  const source = options.source || "WEBHOOK";
  const verifiedMode =
    options.verifiedMode || (options.config && options.config.mode) || null;

  // ---- (a) AMOUNT CHECK, IN PAISE ----------------------------------------
  // Integer paise only. A partial capture, an over-payment, or a null amount
  // must NEVER be credited — crediting a mismatched amount is the single most
  // expensive bug available in this file, and it is not automatically
  // recoverable. Park it for a human instead.
  if (parsed.amountPaise !== order.amountPaise) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "RECONCILE_PENDING",
        needsManualAction: true,
        reconcileError: "AMOUNT_MISMATCH",
        providerPaymentId: parsed.providerPaymentId || order.providerPaymentId,
        lastReconcileAt: new Date(),
      },
    });

    await writeAudit({
      action: "TOPUP_AMOUNT_MISMATCH",
      resourceId: order.id,
      userId: order.subjectUserId,
      details: {
        expectedPaise: order.amountPaise,
        receivedPaise: parsed.amountPaise,
        provider: order.provider,
        providerPaymentId: parsed.providerPaymentId,
        source,
      },
    });

    logger.error(
      "Payment amount mismatch — credit refused, manual action required",
      {
        orderId: order.id,
        expectedPaise: order.amountPaise,
        receivedPaise: parsed.amountPaise,
        providerPaymentId: parsed.providerPaymentId,
        source,
      },
    );

    return {
      handled: "amount_mismatch",
      credited: false,
      needsManualAction: true,
    };
  }

  // ---- (b) MODE ASSERTION -------------------------------------------------
  // The secret that verified this event must belong to the same mode the order
  // was created in. A TEST payment must never credit a LIVE wallet, and a LIVE
  // payment must never be written off as test money.
  if (verifiedMode && verifiedMode !== order.mode) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "RECONCILE_PENDING",
        needsManualAction: true,
        reconcileError: "MODE_MISMATCH",
        lastReconcileAt: new Date(),
      },
    });

    await writeAudit({
      action: "TOPUP_MODE_MISMATCH",
      resourceId: order.id,
      userId: order.subjectUserId,
      details: {
        orderMode: order.mode,
        verifiedMode,
        provider: order.provider,
        providerPaymentId: parsed.providerPaymentId,
        source,
      },
    });

    logger.error(
      "Payment mode mismatch — credit refused, manual action required",
      {
        orderId: order.id,
        orderMode: order.mode,
        verifiedMode,
        source,
      },
    );

    return {
      handled: "mode_mismatch",
      credited: false,
      needsManualAction: true,
    };
  }

  // ---- (c) TEST MODE SHORT-CIRCUIT (confirmed product decision) -----------
  // A TEST payment is fake money. It is recorded end-to-end so the admin can
  // exercise the whole flow, but it must NEVER reach
  // `externalWalletClient.topup` — the external wallet has no notion of test
  // money, so a test credit would be indistinguishable from a real one and
  // would inflate a real balance. Nothing to cache-bust either: no balance
  // moved.
  if (order.mode === "TEST" || order.isTest === true) {
    const claimedTest = await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: { in: TEST_CREDITABLE_FROM } },
      data: {
        status: "CREDITED",
        isTest: true,
        providerPaymentId: parsed.providerPaymentId || order.providerPaymentId,
        externalReferenceId:
          order.externalReferenceId ||
          buildExternalReferenceId(parsed.providerPaymentId),
        creditedAt: new Date(),
        reconcileError: null,
      },
    });

    if (claimedTest.count === 0) {
      return { handled: "already_processed", credited: false, isTest: true };
    }

    await writeAudit({
      action: "TOPUP_CREDITED_TEST",
      resourceId: order.id,
      userId: order.subjectUserId,
      details: {
        amount: toNumber(order.amount),
        provider: order.provider,
        mode: order.mode,
        providerPaymentId: parsed.providerPaymentId,
        source,
        note: "TEST mode — no external wallet call was made, no real balance changed.",
      },
    });

    logger.info("TEST-mode payment recorded as credited (no external call)", {
      orderId: order.id,
      provider: order.provider,
      providerPaymentId: parsed.providerPaymentId,
      source,
    });

    return { handled: "credited", credited: true, isTest: true };
  }

  // ---- (d) GUARDED TRANSITION — the double-credit guard (I2a) -------------
  // Exactly one concurrent caller can flip CREATED|PENDING|EXPIRED -> PAID.
  // Everyone else sees count === 0 and stops. EXPIRED is in the allowed set on
  // purpose: a real capture must beat our local expiry guess.
  const externalReferenceId =
    order.externalReferenceId ||
    buildExternalReferenceId(parsed.providerPaymentId);

  const claimed = await prisma.paymentOrder.updateMany({
    where: { id: order.id, status: { in: CLAIMABLE_FOR_CREDIT } },
    data: {
      status: "PAID",
      providerPaymentId: parsed.providerPaymentId,
      externalReferenceId,
    },
  });

  let current = order;

  if (claimed.count === 0) {
    // Someone else claimed it, or it is already past PAID. Re-read to decide.
    current = await prisma.paymentOrder.findUnique({ where: { id: order.id } });

    if (!current) {
      logger.error("Payment order vanished during credit claim", {
        orderId: order.id,
      });
      return { handled: "already_processed", credited: false };
    }

    if (current.status !== "RECONCILE_PENDING") {
      // CREDITED / PAID / FAILED / CANCELLED / REFUNDED — nothing to do. This
      // is the normal, expected outcome of a webhook racing /self/verify.
      logger.info("Credit skipped — order already past the claim point", {
        orderId: order.id,
        status: current.status,
        source,
      });
      return {
        handled: "already_processed",
        credited: current.status === "CREDITED",
        status: current.status,
      };
    }
    // RECONCILE_PENDING -> this is a RETRY of a previously failed external
    // credit. Fall through to (e) with the SAME externalReferenceId, so the
    // external API's idempotency (I2b) decides whether it already landed.
  } else {
    current = {
      ...order,
      status: "PAID",
      providerPaymentId: parsed.providerPaymentId,
      externalReferenceId,
    };
  }

  const referenceId = current.externalReferenceId || externalReferenceId;

  // ---- (e) EXTERNAL CREDIT — deliberately OUTSIDE any Prisma transaction --
  // This is a network call to a third-party API. Holding a database
  // transaction open across it would pin a connection and a row lock for the
  // duration of an unbounded remote round-trip (and the circuit breaker's
  // timeouts), which is exactly how this service would deadlock under load.
  // The `updateMany` claim above already provides the mutual exclusion a
  // transaction would have given us.
  let topupResponse;
  try {
    topupResponse = await getExternalWalletClient().topup(
      current.clientCode,
      current.walletUserId,
      {
        // FACE VALUE. Gateway fees are absorbed by the platform: the customer
        // is credited exactly what they were charged.
        amount: toNumber(current.amount),
        currency: current.currency,
        reference_id: referenceId, // RZP_<paymentId> — the idempotency key (I2b)
        description: `Wallet top-up via ${current.provider} (${parsed.providerPaymentId})`,
        metadata: {
          source: source || "WEBHOOK",
          provider: current.provider,
          mode: current.mode,
          orderId: current.id,
          providerPaymentId: parsed.providerPaymentId,
        },
      },
    );
  } catch (error) {
    // ---- (f) A 409 FROM THE EXTERNAL API MEANS SUCCESS --------------------
    // The external wallet enforces uniqueness on `reference_id`. A 409
    // therefore PROVES this exact credit already landed on a previous attempt
    // (a retry, a redelivered webhook, another process). Treating it as a
    // failure would park a fully-credited order in RECONCILE_PENDING and
    // invite an operator to credit it a second time.
    if (error && error.statusCode === 409) {
      logger.info(
        "External wallet returned 409 on reference_id — credit already landed, treating as success",
        {
          orderId: current.id,
          referenceId,
          providerPaymentId: parsed.providerPaymentId,
          source,
        },
      );

      return finalizeCredited({
        order: current,
        parsed,
        source,
        externalTransactionId: null,
        note: "External wallet reported 409 on reference_id — idempotent duplicate, credit already applied on an earlier attempt.",
      });
    }

    // ---- (g) Any other external failure -> RECONCILE_PENDING --------------
    // The customer's money is at the gateway; we simply have not moved it
    // into the wallet yet. Park it with exponential backoff for the reconcile
    // worker. This resolves normally so the webhook still answers 200 (I6).
    const attempts = (current.reconcileAttempts || 0) + 1;
    const now = new Date();
    const backoffMinutes = Math.min(Math.pow(2, attempts), MAX_BACKOFF_MINUTES);

    await prisma.paymentOrder.update({
      where: { id: current.id },
      data: {
        status: "RECONCILE_PENDING",
        reconcileAttempts: { increment: 1 },
        lastReconcileAt: now,
        nextRetryAt: new Date(now.getTime() + backoffMinutes * 60 * 1000),
        reconcileError: String(error.message || error).slice(0, 2000),
      },
    });

    await writeAudit({
      action: "TOPUP_RECONCILE_PENDING",
      resourceId: current.id,
      userId: current.subjectUserId,
      details: {
        amount: toNumber(current.amount),
        provider: current.provider,
        providerPaymentId: parsed.providerPaymentId,
        referenceId,
        attempt: attempts,
        nextRetryInMinutes: backoffMinutes,
        error: String(error.message || error).slice(0, 500),
        source,
      },
    });

    logger.error("External wallet credit FAILED — order parked for reconcile", {
      orderId: current.id,
      referenceId,
      attempt: attempts,
      nextRetryInMinutes: backoffMinutes,
      statusCode: error && error.statusCode,
      error: error.message,
      source,
    });

    return {
      handled: "reconcile_pending",
      credited: false,
      attempt: attempts,
      nextRetryInMinutes: backoffMinutes,
    };
  }

  // ---- (h) Success --------------------------------------------------------
  return finalizeCredited({
    order: current,
    parsed,
    source,
    externalTransactionId: extractTransactionId(topupResponse),
    note: null,
  });
}

/**
 * Mark an order CREDITED (order row + audit row in ONE transaction so the
 * money trail can never exist without its audit entry — I7) and then bust the
 * balance caches.
 *
 * @private
 */
async function finalizeCredited({
  order,
  parsed,
  source,
  externalTransactionId,
  note,
}) {
  const creditedAt = new Date();

  await prisma.$transaction([
    prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "CREDITED",
        externalTransactionId: externalTransactionId || null,
        creditedAt,
        reconcileError: null,
        needsManualAction: false,
        nextRetryAt: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: order.subjectUserId || null,
        action: "TOPUP_CREDITED",
        resource: "PaymentOrder",
        resourceId: order.id,
        details: {
          amount: toNumber(order.amount),
          currency: order.currency,
          provider: order.provider,
          mode: order.mode,
          providerPaymentId: parsed.providerPaymentId,
          externalReferenceId: order.externalReferenceId,
          externalTransactionId: externalTransactionId || null,
          source,
          ...(note ? { note } : {}),
        },
      },
    }),
  ]);

  logger.info("Wallet credited", {
    orderId: order.id,
    provider: order.provider,
    providerPaymentId: parsed.providerPaymentId,
    externalTransactionId: externalTransactionId || null,
    source,
  });

  await invalidateBalanceCaches(order);

  return {
    handled: "credited",
    credited: true,
    isTest: false,
    externalTransactionId: externalTransactionId || null,
  };
}

/* ------------------------------------------------------------------ *
 * adoptOrphanPayment
 * ------------------------------------------------------------------ */

/**
 * Credit a payment made against an order Razorpay knows about but we do not.
 *
 * This happens when `createOrder` succeeded at the gateway and our local
 * INSERT was lost (process crash / deploy / DB blip between the two). The
 * customer then pays against an order we have no record of, and without this
 * function their money would be silently unrecoverable.
 *
 * Every order and link we create carries
 * `notes: { walletUserId, clientCode, subjectUserId, kind }` precisely so the
 * order can be reconstructed from the gateway's own copy of the truth.
 *
 * @param {Object} parsed
 * @param {Object} params
 * @param {string} params.provider
 * @param {string} params.mode - mode of the config whose secret verified the event
 * @param {Object} [params.config]
 * @returns {Promise<Object>}
 */
async function adoptOrphanPayment(parsed, { provider, mode, config } = {}) {
  const notes = extractNotes(parsed.raw);
  const walletUserId =
    notes && typeof notes.walletUserId === "string" && notes.walletUserId.trim()
      ? notes.walletUserId.trim()
      : null;

  const amountPaise = Number.isInteger(parsed.amountPaise)
    ? parsed.amountPaise
    : null;

  // Unusable notes: we cannot know WHOSE wallet to credit. Record everything we
  // do know and hand it to an admin. This converts a silent money-LOSS into a
  // recoverable one — never guess an owner.
  if (!walletUserId || amountPaise === null) {
    const parked = await createOrphanOrder({
      provider,
      mode,
      parsed,
      walletUserId: walletUserId || "UNKNOWN",
      clientCode: normalizeClientCode(notes && notes.clientCode),
      subjectUserId: null,
      kind: resolveKind(notes),
      amountPaise: amountPaise === null ? 0 : amountPaise,
      status: "RECONCILE_PENDING",
      needsManualAction: true,
      reconcileError: "ORPHAN_NO_NOTES",
    });

    await writeAudit({
      action: "TOPUP_ORPHAN_UNRESOLVED",
      resourceId: parked.id,
      userId: null,
      details: {
        provider,
        mode,
        providerPaymentId: parsed.providerPaymentId,
        providerOrderId: parsed.providerOrderId,
        providerLinkId: parsed.providerLinkId,
        amountPaise: parsed.amountPaise,
        reason: "ORPHAN_NO_NOTES",
      },
    });

    logger.error(
      "Orphan payment could not be attributed to a wallet — MANUAL ACTION REQUIRED",
      {
        orderId: parked.id,
        provider,
        providerPaymentId: parsed.providerPaymentId,
        amountPaise: parsed.amountPaise,
      },
    );

    return {
      handled: "orphan_unresolved",
      credited: false,
      needsManualAction: true,
      orderId: parked.id,
    };
  }

  // Reconstruct the order exactly as `createOrder` would have written it.
  const adopted = await createOrphanOrder({
    provider,
    mode,
    parsed,
    walletUserId,
    clientCode: normalizeClientCode(notes.clientCode),
    subjectUserId: isUuid(notes.subjectUserId) ? notes.subjectUserId : null,
    kind: resolveKind(notes),
    amountPaise,
    status: "CREATED",
    needsManualAction: false,
    reconcileError: null,
  });

  await writeAudit({
    action: "TOPUP_ORDER_ADOPTED",
    resourceId: adopted.id,
    userId: adopted.subjectUserId,
    details: {
      provider,
      mode,
      providerPaymentId: parsed.providerPaymentId,
      providerOrderId: parsed.providerOrderId,
      providerLinkId: parsed.providerLinkId,
      amountPaise,
      walletUserId,
      clientCode: adopted.clientCode,
      reason:
        "Gateway reported a payment for an order with no local row — reconstructed from gateway notes.",
    },
  });

  logger.warn("Adopted an orphan payment — local order row was missing", {
    orderId: adopted.id,
    provider,
    providerPaymentId: parsed.providerPaymentId,
  });

  // Now run it through the ONE credit path like any other paid order.
  const result = await creditOrder(adopted, parsed, {
    source: "WEBHOOK_ORPHAN",
    verifiedMode: mode,
    config,
  });

  return { ...result, orderId: adopted.id, adopted: true };
}

/**
 * Insert the reconstructed order, tolerating the case where a concurrent
 * delivery already adopted the same payment (unique [provider, providerPaymentId]).
 *
 * @private
 */
async function createOrphanOrder({
  provider,
  mode,
  parsed,
  walletUserId,
  clientCode,
  subjectUserId,
  kind,
  amountPaise,
  status,
  needsManualAction,
  reconcileError,
}) {
  const data = {
    kind,
    provider,
    mode: mode || "LIVE",
    isTest: mode === "TEST",
    walletUserId,
    clientCode,
    subjectUserId,
    amount: (amountPaise / 100).toFixed(2),
    amountPaise,
    currency: parsed.currency || "INR",
    status,
    providerOrderId: parsed.providerOrderId || null,
    providerLinkId: parsed.providerLinkId || null,
    providerPaymentId: parsed.providerPaymentId || null,
    needsManualAction,
    reconcileError,
    notes: "Adopted from gateway webhook — local order row was missing.",
    gatewayData: parsed.raw || null,
  };

  try {
    return await prisma.paymentOrder.create({ data });
  } catch (error) {
    if (error && error.code === "P2002" && parsed.providerPaymentId) {
      // A concurrent delivery won the adoption race. Use its row — the credit
      // guard in creditOrder() then makes the loser a no-op.
      const existing = await prisma.paymentOrder.findFirst({
        where: { provider, providerPaymentId: parsed.providerPaymentId },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * Terminal transitions (all guarded — I8)
 * ------------------------------------------------------------------ */

/**
 * CREATED|PENDING -> FAILED.
 * Guarded so a late `payment.failed` (customer's first attempt failing, the
 * second succeeding, events arriving out of order) can never fail an order
 * that has since been paid or credited.
 */
async function markOrderFailed(order, parsed, options = {}) {
  const source = options.source || "WEBHOOK";

  const updated = await prisma.paymentOrder.updateMany({
    where: { id: order.id, status: { in: FAILABLE_FROM } },
    data: {
      status: "FAILED",
      providerPaymentId: parsed.providerPaymentId || order.providerPaymentId,
      reconcileError: parsed.errorDescription || parsed.errorCode || null,
    },
  });

  if (updated.count === 0) {
    logger.info("Failure event ignored — order is no longer failable", {
      orderId: order.id,
      status: order.status,
      source,
    });
    return { handled: "ignored_terminal", status: order.status };
  }

  await writeAudit({
    action: "TOPUP_FAILED",
    resourceId: order.id,
    userId: order.subjectUserId,
    details: {
      provider: order.provider,
      providerPaymentId: parsed.providerPaymentId,
      errorCode: parsed.errorCode,
      errorDescription: parsed.errorDescription,
      source,
    },
  });

  return { handled: "failed", credited: false };
}

/**
 * CREATED|PENDING -> EXPIRED.
 * Note the asymmetry with CLAIMABLE_FOR_CREDIT: an expiry may never undo a
 * capture, but a capture MAY override an expiry.
 */
async function markOrderExpired(order, parsed, options = {}) {
  const source = options.source || "WEBHOOK";

  const updated = await prisma.paymentOrder.updateMany({
    where: { id: order.id, status: { in: EXPIRABLE_FROM } },
    data: { status: "EXPIRED" },
  });

  if (updated.count === 0) {
    logger.info("Expiry event ignored — order is no longer expirable", {
      orderId: order.id,
      status: order.status,
      source,
    });
    return { handled: "ignored_terminal", status: order.status };
  }

  await writeAudit({
    action: "TOPUP_EXPIRED",
    resourceId: order.id,
    userId: order.subjectUserId,
    details: {
      provider: order.provider,
      providerOrderId: order.providerOrderId,
      providerLinkId: order.providerLinkId,
      source,
    },
  });

  return { handled: "expired", credited: false };
}

/**
 * Record a refund against a paid/credited order.
 *
 * DELIBERATELY DOES NOT DEBIT THE EXTERNAL WALLET.
 * An automatic debit here would be actively harmful: by the time a refund is
 * processed the customer may already have SPENT the credited balance on
 * shipments. Force-debiting would drive the wallet negative and could strand
 * an in-flight shipment mid-journey. Refund reconciliation is a deliberate
 * human decision — an admin performs it through the existing `/admin/debit`
 * endpoint after checking the balance. This function only records the fact.
 *
 * Status becomes REFUNDED only when the order is FULLY refunded; a partial
 * refund leaves the status alone and only moves `refundedAmount`.
 */
async function recordRefund(order, parsed, options = {}) {
  const source = options.source || "WEBHOOK";

  if (!REFUNDABLE_FROM.includes(order.status)) {
    logger.warn("Refund event for an order that never held money — ignored", {
      orderId: order.id,
      status: order.status,
      source,
    });
    return { handled: "ignored_terminal", status: order.status };
  }

  const refundAmount = Number.isInteger(parsed.amountPaise)
    ? parsed.amountPaise / 100
    : 0;

  if (refundAmount <= 0) {
    logger.warn("Refund event carried no usable amount — ignored", {
      orderId: order.id,
      amountPaise: parsed.amountPaise,
      source,
    });
    return { handled: "ignored_no_amount" };
  }

  // Increment atomically in the database (never read-modify-write in JS), so
  // two concurrent partial-refund events cannot lose one another's amount.
  const updated = await prisma.paymentOrder.updateMany({
    where: { id: order.id, status: { in: REFUNDABLE_FROM } },
    data: { refundedAmount: { increment: refundAmount } },
  });

  if (updated.count === 0) {
    return { handled: "ignored_terminal", status: order.status };
  }

  const fresh = await prisma.paymentOrder.findUnique({
    where: { id: order.id },
  });
  const refundedTotal = toNumber(fresh && fresh.refundedAmount);
  const orderAmount = toNumber(fresh && fresh.amount);
  const fullyRefunded = refundedTotal >= orderAmount;

  if (fullyRefunded && fresh.status !== "REFUNDED") {
    await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: { in: REFUNDABLE_FROM } },
      data: {
        status: "REFUNDED",
        // A refunded credit still needs a human to decide whether to claw the
        // balance back. Flag it rather than acting.
        needsManualAction: fresh.status === "CREDITED",
      },
    });
  }

  await writeAudit({
    action: fullyRefunded ? "TOPUP_REFUNDED" : "TOPUP_PARTIALLY_REFUNDED",
    resourceId: order.id,
    userId: order.subjectUserId,
    details: {
      provider: order.provider,
      providerPaymentId: parsed.providerPaymentId,
      refundAmount,
      refundedTotal,
      orderAmount,
      fullyRefunded,
      source,
      note: "Recorded only. The external wallet is NOT auto-debited — an admin must reconcile via /admin/debit.",
    },
  });

  logger.warn("Refund recorded — external wallet NOT auto-debited", {
    orderId: order.id,
    refundAmount,
    refundedTotal,
    fullyRefunded,
    source,
  });

  return {
    handled: fullyRefunded ? "refunded" : "partially_refunded",
    credited: false,
    refundedTotal,
  };
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/**
 * Locate the local order this event refers to, most specific reference first.
 *
 * ORDER MATTERS: `payment.captured` sets `providerLinkId: null` even for a
 * link-originated payment, so a link's payment is matched by its ORDER id
 * (Razorpay creates an order behind every link) or by the link's own
 * `payment_link.*` event — never by a link id on the capture event.
 *
 * @private
 */
async function findOrderForEvent(provider, parsed) {
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

/**
 * Resolve the right webhook secret and verify.
 *
 * With an order: use the mode SNAPSHOTTED ON THAT ORDER (`requireEnabled:
 * false`, so a provider disabled after the order was created can still have
 * its in-flight payments verified).
 * Without an order: try the currently-active mode, then the other one —
 * Razorpay posts both TEST and LIVE deliveries to the same URL.
 *
 * @private
 * @returns {Promise<{verified:boolean, config:Object|null, mode:string|null, triedModes:string[]}>}
 */
async function verifySignature({ impl, provider, order, rawBody, headers }) {
  let modes;

  if (order && order.mode) {
    modes = [order.mode];
  } else {
    let activeMode = null;
    try {
      const active = await resolveActiveConfig(provider);
      activeMode = active && active.mode;
    } catch (error) {
      logger.warn(
        "Could not resolve active provider config for webhook verification",
        {
          provider,
          error: error.message,
        },
      );
    }
    modes = activeMode
      ? [activeMode, activeMode === "LIVE" ? "TEST" : "LIVE"]
      : ["LIVE", "TEST"];
  }

  const tried = [];

  for (const mode of modes) {
    tried.push(mode);

    let config;
    try {
      config = await resolveConfigForMode(provider, mode, {
        requireEnabled: false,
      });
    } catch (error) {
      // PROVIDER_NOT_CONFIGURED / PROVIDER_DISABLED for this mode — that mode
      // simply has no secret to try. Move on.
      logger.warn("No usable webhook secret for provider mode", {
        provider,
        mode,
        code: error.code,
      });
      continue;
    }

    if (impl.verifyWebhookSignature({ config, rawBody, headers })) {
      return { verified: true, config, mode, triedModes: tried };
    }
  }

  return { verified: false, config: null, mode: null, triedModes: tried };
}

/**
 * Persist a signature-rejected delivery for forensics. Best-effort only: a
 * failure here must not change the 401 we are about to return.
 * @private
 */
async function safeRecordRejectedEvent({
  provider,
  parsed,
  headers,
  order,
  ip,
}) {
  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider,
        providerEventId:
          parsed.providerEventId ||
          `unverified:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        eventType: parsed.eventType || "unknown",
        payload: parsed.raw || {},
        headers: { ...sanitizeHeaders(headers), _sourceIp: ip || null },
        signatureValid: false,
        processed: false,
        processingError: "INVALID_SIGNATURE",
        paymentOrderId: order ? order.id : null,
      },
    });
  } catch (error) {
    if (!error || error.code !== "P2002") {
      logger.error("Could not persist rejected webhook event", {
        provider,
        error: error.message,
      });
    }
  }
}

/**
 * Delete every Redis key that could serve a stale balance (I5 fallout).
 *
 * A cache-bust failure must NEVER fail a credit — the money has already moved
 * and the credit is durably recorded. But a missed bust means the booking
 * screen shows a stale balance for up to the TTL (300s) and may wrongly reject
 * a shipment for "insufficient balance", so it is logged loudly.
 * @private
 */
async function invalidateBalanceCaches(order) {
  const keys = buildBalanceCacheKeys(order.walletUserId, order.clientCode);
  if (keys.length === 0) return;

  let redis;
  try {
    redis = getRedisClient();
  } catch (error) {
    logger.warn(
      "BALANCE CACHE NOT BUSTED after credit — Redis unavailable; a stale balance may be served for up to the cache TTL",
      { orderId: order.id, keys, error: error.message },
    );
    return;
  }

  for (const key of keys) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn(
        "BALANCE CACHE KEY NOT BUSTED after credit — a stale balance may be served for up to the cache TTL",
        { orderId: order.id, key, error: error.message },
      );
    }
  }
}

/**
 * Standalone audit write (I7). Inside `finalizeCredited` the audit row is part
 * of the same transaction as the status change; elsewhere the state change has
 * already committed, so a failing audit write is logged rather than allowed to
 * roll back / abort webhook handling.
 * @private
 */
async function writeAudit({ action, resourceId, userId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        // NOTE: AuditLog.userId is @db.Uuid — only the LOCAL subjectUserId may
        // go here. `walletUserId` is a phone number and belongs in `details`.
        userId: isUuid(userId) ? userId : null,
        action,
        resource: "PaymentOrder",
        resourceId: resourceId || null,
        details: details || {},
      },
    });
  } catch (error) {
    logger.error("AUDIT WRITE FAILED for payment state change", {
      action,
      resourceId,
      error: error.message,
    });
  }
}

/**
 * The external wallet idempotency key. Deterministic per captured payment —
 * anything time- or random-based here would defeat I2b and double-credit.
 * @private
 */
function buildExternalReferenceId(providerPaymentId) {
  return providerPaymentId ? `RZP_${providerPaymentId}` : null;
}

/** Gateway notes live on the payment, link or order entity, in that order. @private */
function extractNotes(raw) {
  const payload = raw && typeof raw.payload === "object" ? raw.payload : null;
  if (!payload) return null;

  const entities = ["payment", "payment_link", "order"];
  for (const name of entities) {
    const node = payload[name];
    const entity = node && typeof node === "object" ? node.entity : null;
    if (entity && entity.notes && typeof entity.notes === "object") {
      return entity.notes;
    }
  }
  return null;
}

/** @private */
function resolveKind(notes) {
  const kind = notes && notes.kind;
  return kind === "ADMIN_LINK" || kind === "SELF_SERVE" ? kind : "SELF_SERVE";
}

/** @private */
function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

/** Prisma Decimal | string | number -> number. @private */
function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The external wallet API's response shape varies by version. @private */
function extractTransactionId(response) {
  if (!response || typeof response !== "object") return null;
  const data =
    response.data && typeof response.data === "object"
      ? response.data
      : response;
  return (
    data.transaction_id ||
    data.transactionId ||
    data.reference_id ||
    data.id ||
    null
  );
}

/** Strip credentials before a header map is persisted. @private */
function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(String(key).toLowerCase())) continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}

/**
 * Wrap a pre-record infrastructure failure as a 503 so the gateway REDELIVERS
 * the event. Only valid before the PaymentWebhookEvent row exists (I6).
 * @private
 */
function infraError(error, stage) {
  logger.error(`Webhook infrastructure failure during ${stage}`, {
    stage,
    error: error.message,
  });
  return new APIError(
    "Webhook could not be processed — please retry",
    503,
    "WEBHOOK_INFRA_UNAVAILABLE",
  );
}

module.exports = {
  handleWebhook,
  creditOrder,
  adoptOrphanPayment,
  markOrderFailed,
  markOrderExpired,
  recordRefund,
};
