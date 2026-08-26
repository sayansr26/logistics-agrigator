/**
 * Static-QR CREDIT path — the bridge between an attributed collection and the
 * ONE money path.
 *
 * `qrCollectionService` records what arrived and never moves money.
 * `webhookService.creditOrder` moves money and knows nothing about QRs.
 * This module is the only thing in between: it mints a `PaymentOrder` FROM a
 * collection and hands it to `creditOrder`.
 *
 * ⚠️ THIS MODULE MUST NEVER CALL `externalWalletClient.topup` ITSELF.
 * There is exactly one crediting implementation in this service on purpose —
 * a second one would be a second place to get idempotency wrong. Everything
 * here funnels into `creditOrder`, which owns the amount check, the mode
 * assertion, the TEST short-circuit, the guarded PAID claim, the 409-as-success
 * rule and the RECONCILE_PENDING backoff.
 *
 * SHAPE OF THE FLOW (identical to `webhookService.adoptOrphanPayment`):
 *   1. claim the collection (guarded `updateMany`, never a bare `update`)
 *   2. mint an order from the payment
 *   3. build the synthetic `parsed` the credit path expects
 *   4. `creditOrder(order, parsed, ...)`
 *   5. reflect the verdict back onto the collection row
 *
 * ═════════════════════════════════════════════════════════════════════════
 * CONFIRMED PRODUCT RULE — READ BEFORE "FIXING" ANYTHING BELOW
 *
 *   AN ATTRIBUTED COLLECTION ALWAYS AUTO-CREDITS. AT ANY AMOUNT.
 *
 * `OutletPaymentQr.maxPerCreditAmount`, `maxPerDayAmount` and `maxPerDayCount`
 * are ALERTING / VELOCITY SIGNALS ONLY. They are NOT credit gates. When one is
 * breached we log at `warn`, write an audit row, set a metadata flag — AND WE
 * STILL CREDIT.
 *
 * WHY: by the time this code runs, the payer's money has already left their
 * bank and landed in the merchant account. Refusing to credit does not prevent
 * anything — it converts a completed payment into a REFUND LIABILITY plus a
 * support ticket, while the merchant's wallet stays short. A limit is useful
 * for spotting a compromised QR or a data-entry error; it is worthless as a
 * gate on money that has already arrived.
 *
 * If you are here to turn one of these into a block: don't. Take it to product
 * first. The schema comment on `OutletPaymentQr` says the same thing.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * @module services/payments/qrCreditService
 */

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");

const qrCollectionService = require("./qrCollectionService");
const { creditOrder } = require("./webhookService");
const { resolveConfigForMode } = require("./providerConfigService");

const PROVIDER = "ccavenue_upi_qr";
const DEFAULT_CURRENCY = "INR";

/** Statuses from which a credit attempt may be claimed. @see claimForCredit */
const CLAIMABLE_FOR_CREDIT = ["ATTRIBUTED", "CREDIT_PENDING"];

/** Audit actions written by this module. */
const AUDIT_ACTIONS = Object.freeze({
  QR_COLLECTION_ORDER_MINTED: "QR_COLLECTION_ORDER_MINTED",
  QR_COLLECTION_CREDITED: "QR_COLLECTION_CREDITED",
  QR_COLLECTION_CREDIT_DEFERRED: "QR_COLLECTION_CREDIT_DEFERRED",
  QR_VELOCITY_SIGNAL_BREACHED: "QR_VELOCITY_SIGNAL_BREACHED",
});

const AUDIT_RESOURCE = "QrCollection";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ *
 * The entry point
 * ------------------------------------------------------------------ */

/**
 * Credit one attributed static-QR collection.
 *
 * NEVER THROWS for an expected failure. A failure to credit leaves the row at
 * `CREDIT_PENDING` with `needsManualAction` and `lastError` — a recoverable
 * state an admin or the reconcile worker can drive forward. Throwing would only
 * bubble into `qrCollectionService.invokeCreditHandler`'s generic catch, which
 * writes a less specific version of the same thing.
 *
 * @param {Object} collection - a QrCollection row at ATTRIBUTED / CREDIT_PENDING
 * @param {Object} [options]
 * @param {string} [options.source="INGEST"] - INGEST | ADMIN | RECONCILE | REPLAY
 * @param {?string} [options.actorUserId] - local portal UUID of the actor
 * @returns {Promise<{credited: boolean, handled: string, paymentOrderId: ?string,
 *   collection?: Object}>}
 */
async function attributeAndCredit(collection, options = {}) {
  const source = options.source || "INGEST";
  const actorUserId = isUuid(options.actorUserId) ? options.actorUserId : null;

  if (!collection || !collection.id) {
    return {
      credited: false,
      handled: "invalid_collection",
      paymentOrderId: null,
    };
  }

  try {
    // ---- 1. GUARDED CLAIM ------------------------------------------------
    // The double-credit guard, mirroring `creditOrder`'s CREATED|PENDING|
    // EXPIRED -> PAID claim. Exactly one concurrent caller (webhook redelivery
    // racing an admin "retry credit" racing the reconcile worker) can flip
    // ATTRIBUTED|CREDIT_PENDING -> CREDIT_PENDING and proceed. Everyone else
    // sees count === 0 and stops.
    //
    // NEVER a bare `update` here: an unguarded write would let two callers both
    // proceed to mint + credit, and the only thing standing between that and a
    // double credit would be the external wallet's reference_id uniqueness.
    // That guard is real, but it is the LAST line of defence, not the first.
    //
    // CREDIT_PENDING is in the allowed-from set on purpose: a previous attempt
    // that failed at the external wallet must be retryable, and it retries with
    // the SAME `externalReferenceId` so the external 409 decides whether the
    // money already landed.
    const externalReferenceId = buildQrExternalReferenceId(collection);

    const claimed = await prisma.qrCollection.updateMany({
      where: { id: collection.id, status: { in: CLAIMABLE_FOR_CREDIT } },
      data: {
        status: "CREDIT_PENDING",
        attributedAt: new Date(),
        // Stamped HERE, before anything external can happen, so every retry
        // reads back the identical string. See buildQrExternalReferenceId.
        externalReferenceId,
      },
    });

    if (claimed.count === 0) {
      logger.info(
        "QR credit skipped — collection already past the claim point",
        {
          collectionId: collection.id,
          status: collection.status,
          source,
        },
      );
      return {
        credited: false,
        handled: "already_processed",
        paymentOrderId: collection.paymentOrderId || null,
      };
    }

    // ---- 2. Resolve the QR row and the provider config -------------------
    const qr = await resolveQrRow(collection);

    if (!qr) {
      return defer(collection, {
        source,
        actorUserId,
        reason: "QR_ROW_MISSING",
        message:
          "Collection is attributed but its OutletPaymentQr row could not be read — cannot determine whose wallet to credit.",
      });
    }

    // THE MODE COMES FROM THE QR ROW'S SNAPSHOT, NEVER FROM LIVE CONFIG.
    // Same reasoning as `PaymentOrder.mode`: an admin may flip the provider
    // between TEST and LIVE at any moment, and a payment made against a QR that
    // was provisioned in TEST must never credit a LIVE balance because the
    // platform happened to be switched over five minutes later. `qr.mode` is
    // what the sticker on the counter was printed under. `collection.mode` is
    // the same value copied at ingest and is used only as a fallback for a row
    // whose QR was edited in between.
    const mode = qr.mode || collection.mode || null;

    if (mode !== "TEST" && mode !== "LIVE") {
      return defer(collection, {
        source,
        actorUserId,
        reason: "MODE_UNRESOLVED",
        message: `Cannot credit: the QR row carries no usable mode (got ${JSON.stringify(mode)}).`,
      });
    }

    let config;
    try {
      // `requireEnabled: false` for the same reason `webhookService` uses it:
      // a provider disabled AFTER the money arrived must still have that money
      // credited. The customer already paid.
      config = await resolveConfigForMode(
        collection.provider || PROVIDER,
        mode,
        {
          requireEnabled: false,
        },
      );
    } catch (error) {
      return defer(collection, {
        source,
        actorUserId,
        reason: "PROVIDER_CONFIG_UNAVAILABLE",
        message: `Cannot credit: ${mode} config for ${collection.provider || PROVIDER} is unavailable (${error.code || error.message}).`,
      });
    }

    // ---- 2b. Velocity signals — ALERT ONLY, NEVER A GATE -----------------
    // Evaluated BEFORE the credit so the alert is on the record even if the
    // external call then fails. It cannot change the outcome; see the banner.
    await evaluateVelocitySignals(collection, qr, { source, actorUserId });

    // ---- 3. Mint the order ------------------------------------------------
    const order = await createQrPaymentOrder(collection, qr, mode, {
      actorUserId,
      externalReferenceId,
    });

    await writeAudit({
      action: AUDIT_ACTIONS.QR_COLLECTION_ORDER_MINTED,
      resourceId: collection.id,
      userId: actorUserId || collection.subjectUserId,
      details: {
        paymentOrderId: order.id,
        provider: order.provider,
        mode,
        amountPaise: collection.amountPaise,
        utr: collection.utr,
        externalReferenceId,
        source,
      },
    });

    // ---- 4. The synthetic `parsed` ---------------------------------------
    const parsed = buildSyntheticParsed(collection, order);

    // ---- 5. THE ONE MONEY PATH -------------------------------------------
    // `creditOrder` never throws for an external-API failure; it resolves with
    // `{handled: "reconcile_pending"}` and parks the order for the worker.
    const result = await creditOrder(order, parsed, {
      source: `QR_${source}`,
      verifiedMode: mode,
      config,
    });

    // ---- 6. Reflect the verdict back onto the collection ------------------
    if (result && result.credited) {
      return await markCredited(collection, order, result, {
        source,
        actorUserId,
      });
    }

    return await defer(collection, {
      source,
      actorUserId,
      reason: `CREDIT_${String((result && result.handled) || "unknown").toUpperCase()}`,
      message: `creditOrder returned "${(result && result.handled) || "unknown"}" — money not yet in the wallet.`,
      paymentOrderId: order.id,
    });
  } catch (error) {
    logger.error("QR credit path threw — collection left for manual action", {
      collectionId: collection.id,
      source,
      error: error.message,
    });

    return await defer(collection, {
      source,
      actorUserId,
      reason: "CREDIT_PATH_ERROR",
      message: String(error.message || error),
    });
  }
}

/* ------------------------------------------------------------------ *
 * Order minting
 * ------------------------------------------------------------------ */

/**
 * Mint the `PaymentOrder` this collection will be credited through.
 *
 * A static-QR payment has no order at the gateway — nobody created one, the
 * payer just scanned a sticker. We mint the order FROM the payment, which is
 * structurally the same move `webhookService.createOrphanOrder` makes for a
 * capture against an order we lost. The order exists so the collection can flow
 * through the ordinary credit path rather than getting a bespoke one.
 *
 * `providerPaymentId` is `utr` when we have one (the bank's own globally-unique
 * reference) and `C:<collection.id>` otherwise. It participates in
 * `@@unique([provider, providerPaymentId])`, so it MUST be deterministic per
 * payment — the collection id is, and a UTR-less collection is unique by its
 * own row anyway. (In practice a UTR-less collection never reaches this
 * function: `ingestCollection` forces it to UNATTRIBUTED / NO_UTR and only an
 * admin attribution can move it on. The branch exists for that admin path.)
 *
 * @private
 */
async function createQrPaymentOrder(collection, qr, mode, options = {}) {
  const providerPaymentId = collection.utr || `C:${collection.id}`;
  const provider = collection.provider || PROVIDER;

  const data = {
    kind: "QR_STATIC",
    provider,
    mode,
    isTest: mode === "TEST",

    // WALLET IDENTITY COMES FROM THE QR ROW, NEVER FROM THE PAYLOAD.
    // The payer controls the payload; only the QR row says whose money this is.
    walletUserId: qr.walletUserId,
    clientCode: qr.clientCode,
    subjectUserId: qr.subjectUserId ?? null,

    payerName: collection.payerName ?? null,

    // Decimal built from the integer paise by STRING arithmetic — never
    // `paise / 100`, which is a float round-trip and can land a paisa off.
    amount: paiseToAmountString(collection.amountPaise),
    amountPaise: collection.amountPaise,
    currency: collection.currency || DEFAULT_CURRENCY,

    status: "CREATED",
    providerPaymentId,
    externalReferenceId:
      options.externalReferenceId || buildQrExternalReferenceId(collection),

    notes: buildOrderNotes(collection, qr),
    gatewayData: collection.rawPayload || null,
    createdBy: options.actorUserId || null,
  };

  try {
    return await prisma.paymentOrder.create({ data });
  } catch (error) {
    // A concurrent delivery won the mint race. REUSE THE WINNER'S ROW rather
    // than minting a second order for the same money — verbatim the handling
    // `webhookService.createOrphanOrder` already does. The credit guard inside
    // `creditOrder` then makes the loser a no-op.
    if (error && error.code === "P2002" && providerPaymentId) {
      const existing = await prisma.paymentOrder.findFirst({
        where: { provider, providerPaymentId },
      });
      if (existing) {
        logger.info("Reusing the winner of a QR order mint race", {
          collectionId: collection.id,
          paymentOrderId: existing.id,
          providerPaymentId,
        });
        return existing;
      }
    }
    throw error;
  }
}

/**
 * The external wallet idempotency key for a static-QR credit.
 *
 *   `UPIQR_<utr>`  — or `UPIQRC_<collection.id>` when there is no UTR.
 *
 * WHY THIS IS THE WHOLE IDEMPOTENCY STORY: the external wallet API enforces
 * uniqueness on `reference_id` and answers 409 on reuse, and `creditOrder`
 * treats that 409 as SUCCESS. That only works if every attempt at this payment
 * sends the IDENTICAL string. Both inputs are immutable per payment (the bank's
 * UTR, or our own row id), so the value is stable across process restarts,
 * redeliveries and manual retries. It is stamped onto the collection row at
 * claim time so it is visible to ops and identical on every retry.
 *
 * `webhookService`'s own `EXTERNAL_REF_PREFIX` map lists `ccavenue_upi_qr ->
 * UPIQR` explicitly, so when `creditOrder` derives the key itself (the path
 * where `order.externalReferenceId` is somehow absent) it produces the SAME
 * string this function does. Two paths disagreeing about the reference is
 * precisely how a payment gets credited twice.
 *
 * @param {Object} collection
 * @returns {string}
 */
function buildQrExternalReferenceId(collection) {
  const utr = collection && collection.utr ? String(collection.utr).trim() : "";
  if (utr) return `UPIQR_${utr}`;
  return `UPIQRC_${collection.id}`;
}

/**
 * The synthetic `parsed` event `creditOrder` consumes.
 *
 * WHY THE PAISE-EXACT CHECK IN `creditOrder` PASSES BY CONSTRUCTION:
 * `creditOrder`'s first guard is `parsed.amountPaise !== order.amountPaise ->
 * AMOUNT_MISMATCH`. Both sides of that comparison are THE SAME INTEGER,
 * `collection.amountPaise`, copied once each from the ingestion payload — the
 * order took it at mint time (step 3), this object takes it here. They cannot
 * disagree on a first attempt.
 *
 * That is not a reason to weaken or skip the guard, and it is not the guard
 * being pointless:
 *
 *  - For a gateway checkout there IS an "expected amount": we asked for ₹500
 *    and the guard catches a ₹5 capture. A free-form static-QR top-up has no
 *    expected amount — the payer decides what to send, and whatever arrived is
 *    by definition the right number. There is nothing for it to disagree with.
 *  - The guard stays fully armed for the case that matters here: a RETRY. On a
 *    retry the order row is re-read from the database, while `parsed` is
 *    rebuilt from the collection row. If those two ever diverge — a corrupted
 *    row, a bad admin edit to a collection amount, a partially-applied
 *    migration — the credit is REFUSED and parked as AMOUNT_MISMATCH instead of
 *    moving an amount nobody authorised.
 *
 * So: passing by construction on the happy path, still load-bearing on the
 * unhappy one. Leave it alone.
 *
 * @private
 */
function buildSyntheticParsed(collection, order) {
  return {
    providerPaymentId: order.providerPaymentId,
    providerOrderId: collection.providerTxnId || null,
    providerLinkId: null,
    amountPaise: collection.amountPaise,
    currency: collection.currency || DEFAULT_CURRENCY,
    capturedAt: collection.txnAt ? toIso(collection.txnAt) : null,
    outcome: "PAID",
    raw: collection.rawPayload || {},
  };
}

/** Human-readable provenance for the order row. @private */
function buildOrderNotes(collection, qr) {
  const utrPart = collection.utr
    ? `UTR ${collection.utr}`
    : `no UTR (collection ${collection.id})`;
  const qrPart =
    qr.label || qr.outletName || qr.qrIdentifier || qr.vpa || qr.id;
  return `Static UPI QR collection — ${utrPart} on QR ${qrPart} (${qr.id}).`;
}

/* ------------------------------------------------------------------ *
 * Verdict reflection
 * ------------------------------------------------------------------ */

/**
 * CREDIT_PENDING -> CREDITED. Guarded, for the same reason the claim is.
 * @private
 */
async function markCredited(
  collection,
  order,
  result,
  { source, actorUserId },
) {
  const updated = await prisma.qrCollection.updateMany({
    where: { id: collection.id, status: "CREDIT_PENDING" },
    data: {
      status: "CREDITED",
      paymentOrderId: order.id,
      needsManualAction: false,
      lastError: null,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.QR_COLLECTION_CREDITED,
    resourceId: collection.id,
    userId: actorUserId || collection.subjectUserId,
    details: {
      paymentOrderId: order.id,
      provider: order.provider,
      mode: order.mode,
      isTest: Boolean(result.isTest),
      amountPaise: collection.amountPaise,
      utr: collection.utr,
      externalReferenceId: order.externalReferenceId,
      externalTransactionId: result.externalTransactionId || null,
      walletUserId: order.walletUserId,
      clientCode: order.clientCode,
      source,
      ...(updated.count === 0
        ? {
            note: "Status was already moved past CREDIT_PENDING by a concurrent caller.",
          }
        : {}),
    },
  });

  logger.info("Static-QR collection credited", {
    collectionId: collection.id,
    paymentOrderId: order.id,
    amountPaise: collection.amountPaise,
    mode: order.mode,
    isTest: Boolean(result.isTest),
    source,
  });

  return {
    credited: true,
    handled: "credited",
    paymentOrderId: order.id,
    isTest: Boolean(result.isTest),
    collection: await safeReadCollection(collection.id, collection),
  };
}

/**
 * Leave the row at CREDIT_PENDING with `needsManualAction` + `lastError`.
 *
 * NOT a rollback to ATTRIBUTED: the money is real and an order may already
 * exist, so the row must stay in the "we are trying to credit this" state where
 * a retry is legal and an admin can see it.
 * @private
 */
async function defer(
  collection,
  { source, actorUserId, reason, message, paymentOrderId },
) {
  const lastError = truncate(`${reason}: ${message}`, 2000);

  let updatedRow = collection;
  try {
    updatedRow = await prisma.qrCollection.update({
      where: { id: collection.id },
      data: {
        needsManualAction: true,
        lastError,
        ...(paymentOrderId ? { paymentOrderId } : {}),
      },
    });
  } catch (error) {
    logger.error("Could not stamp lastError on QR collection", {
      collectionId: collection.id,
      error: error.message,
    });
  }

  await writeAudit({
    action: AUDIT_ACTIONS.QR_COLLECTION_CREDIT_DEFERRED,
    resourceId: collection.id,
    userId: actorUserId || collection.subjectUserId,
    details: {
      reason,
      message: truncate(message, 500),
      amountPaise: collection.amountPaise,
      utr: collection.utr,
      paymentOrderId: paymentOrderId || null,
      source,
    },
  });

  logger.error(
    "Static-QR collection NOT credited — left at CREDIT_PENDING for manual action",
    {
      collectionId: collection.id,
      reason,
      paymentOrderId: paymentOrderId || null,
      amountPaise: collection.amountPaise,
      source,
    },
  );

  return {
    credited: false,
    handled: "credit_deferred",
    paymentOrderId: paymentOrderId || null,
    reason,
    collection: updatedRow,
  };
}

/* ------------------------------------------------------------------ *
 * Velocity signals — ALERTING ONLY
 * ------------------------------------------------------------------ */

/**
 * Compare this collection against the QR's configured limits and RAISE AN
 * ALERT when one is breached. It returns nothing the caller acts on, because
 * there is nothing to act on: THE CREDIT PROCEEDS EITHER WAY.
 *
 * Read the banner at the top of this file before changing that. In one line:
 * the money is already in the merchant account, so a block here creates a
 * refund liability instead of preventing a loss.
 *
 * Best-effort by design: a failure to compute a signal must never delay or
 * block a credit, so everything here is inside one try/catch that swallows.
 *
 * @private
 */
async function evaluateVelocitySignals(
  collection,
  qr,
  { source, actorUserId },
) {
  try {
    const breaches = [];
    const amountPaise = collection.amountPaise;

    const perCreditPaise = decimalToPaise(qr.maxPerCreditAmount);
    if (perCreditPaise !== null && amountPaise > perCreditPaise) {
      breaches.push({
        signal: "maxPerCreditAmount",
        limitPaise: perCreditPaise,
        observedPaise: amountPaise,
      });
    }

    const perDayAmountPaise = decimalToPaise(qr.maxPerDayAmount);
    const perDayCount = Number.isInteger(qr.maxPerDayCount)
      ? qr.maxPerDayCount
      : null;

    if (perDayAmountPaise !== null || perDayCount !== null) {
      const since = startOfUtcDay(collection.receivedAt || new Date());
      const dayTotals = await prisma.qrCollection.aggregate({
        where: {
          outletPaymentQrId: qr.id,
          receivedAt: { gte: since },
          status: { in: ["CREDIT_PENDING", "CREDITED"] },
        },
        _sum: { amountPaise: true },
        _count: { _all: true },
      });

      const sumPaise =
        (dayTotals && dayTotals._sum && dayTotals._sum.amountPaise) || 0;
      const count =
        (dayTotals && dayTotals._count && dayTotals._count._all) || 0;

      if (perDayAmountPaise !== null && sumPaise > perDayAmountPaise) {
        breaches.push({
          signal: "maxPerDayAmount",
          limitPaise: perDayAmountPaise,
          observedPaise: sumPaise,
        });
      }

      if (perDayCount !== null && count > perDayCount) {
        breaches.push({
          signal: "maxPerDayCount",
          limit: perDayCount,
          observed: count,
        });
      }
    }

    if (breaches.length === 0) return;

    logger.warn(
      "Static-QR velocity signal breached — CREDITING ANYWAY (signals are alerting only, never a gate)",
      {
        collectionId: collection.id,
        outletPaymentQrId: qr.id,
        walletUserId: qr.walletUserId,
        amountPaise,
        breaches,
        source,
      },
    );

    await writeAudit({
      action: AUDIT_ACTIONS.QR_VELOCITY_SIGNAL_BREACHED,
      resourceId: collection.id,
      userId: actorUserId || collection.subjectUserId,
      details: {
        outletPaymentQrId: qr.id,
        amountPaise,
        breaches,
        source,
        note: "ALERT ONLY — the credit proceeded. Money that has already arrived is never refused.",
      },
    });

    // A metadata flag so the ops queue can filter for it without re-deriving.
    await prisma.qrCollection.update({
      where: { id: collection.id },
      data: {
        metadata: {
          ...(isPlainObject(collection.metadata) ? collection.metadata : {}),
          velocityAlert: {
            at: new Date().toISOString(),
            breaches,
            credited: true,
          },
        },
      },
    });
  } catch (error) {
    logger.warn(
      "Velocity signal evaluation failed — ignored, the credit is unaffected",
      { collectionId: collection.id, error: error.message },
    );
  }
}

/* ------------------------------------------------------------------ *
 * Bootstrap wiring
 * ------------------------------------------------------------------ */

/**
 * Register this module as `qrCollectionService`'s credit handler.
 *
 * ⚠️ DELIBERATELY NOT CALLED AT MODULE LOAD. Requiring a module must never have
 * the side effect of arming the money path — a test that requires this file, or
 * a script that pulls it in transitively, would silently start crediting.
 * Wiring is an explicit act performed once at server bootstrap.
 *
 * WHERE TO CALL IT: `backend/wallet-service/server.js`, inside the
 * `app.listen(...)` callback in `startServer()`, alongside the settlement
 * scheduler and the reconcile worker (currently at ~line 396-412) — i.e.:
 *
 *   try {
 *     require("./services/payments/qrCreditService").registerCreditHandler();
 *   } catch (e) {
 *     logger.warn("Failed to register QR credit handler", { error: e.message });
 *   }
 *
 * It must run BEFORE the first webhook is served; `ingestCollection` silently
 * skips crediting when no handler is registered (the collection row is still
 * written, so nothing is lost — it just sits at ATTRIBUTED until someone
 * retries it).
 *
 * The handler returns the UPDATED collection row rather than the result object:
 * `qrCollectionService.invokeCreditHandler` adopts a returned value that has an
 * `.id`, so this makes `ingestCollection`'s caller see the post-credit status
 * (`CREDITED`) instead of the stale `ATTRIBUTED`.
 *
 * @returns {void}
 */
function registerCreditHandler() {
  qrCollectionService.setCreditHandler(async ({ collection }) => {
    const result = await attributeAndCredit(collection, { source: "INGEST" });
    return (result && result.collection) || collection;
  });

  logger.info("QR credit handler registered with qrCollectionService", {
    provider: PROVIDER,
  });
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/** @private */
async function resolveQrRow(collection) {
  if (!collection.outletPaymentQrId) return null;
  try {
    return await prisma.outletPaymentQr.findUnique({
      where: { id: collection.outletPaymentQrId },
    });
  } catch (error) {
    logger.error("Could not read the OutletPaymentQr row for a collection", {
      collectionId: collection.id,
      outletPaymentQrId: collection.outletPaymentQrId,
      error: error.message,
    });
    return null;
  }
}

/** @private */
async function safeReadCollection(id, fallback) {
  try {
    const row = await prisma.qrCollection.findUnique({ where: { id } });
    return row || fallback;
  } catch (_error) {
    return fallback;
  }
}

/** @private */
async function writeAudit({ action, resourceId, userId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        // AuditLog.userId is @db.Uuid — only a LOCAL portal UUID may go here.
        // `walletUserId` is a phone number and belongs in `details`.
        userId: isUuid(userId) ? userId : null,
        action,
        resource: AUDIT_RESOURCE,
        resourceId: resourceId || null,
        details: details || {},
      },
    });
  } catch (error) {
    logger.error("AUDIT WRITE FAILED for a QR credit state change", {
      action,
      resourceId,
      error: error.message,
    });
  }
}

/**
 * Integer paise -> a "1234.56" Decimal string, by STRING arithmetic.
 * Never `paise / 100`: that is a float round-trip and lands a paisa off for
 * values a wallet will absolutely see.
 * @private
 */
function paiseToAmountString(amountPaise) {
  const paise = Number(amountPaise);
  if (!Number.isSafeInteger(paise)) return "0.00";

  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");

  return `${negative ? "-" : ""}${rupees}.${fraction}`;
}

/** Prisma Decimal | string | number -> integer paise, or null. @private */
function decimalToPaise(value) {
  if (value === null || value === undefined) return null;

  const text =
    typeof value === "object" && typeof value.toString === "function"
      ? value.toString()
      : String(value);

  const match = /^-?(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;

  const rupees = Number(match[1]);
  const fraction = Number((match[2] || "").padEnd(2, "0") || 0);
  const total = rupees * 100 + fraction;

  return Number.isSafeInteger(total) ? total : null;
}

/** @private */
function startOfUtcDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** @private */
function toIso(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** @private */
function truncate(value, max) {
  const text = String(value === null || value === undefined ? "" : value);
  return text.length > max ? text.slice(0, max) : text;
}

/** @private */
function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/** @private */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  attributeAndCredit,
  registerCreditHandler,
  buildQrExternalReferenceId,
  createQrPaymentOrder,
  AUDIT_ACTIONS,
  CLAIMABLE_FOR_CREDIT,
};
