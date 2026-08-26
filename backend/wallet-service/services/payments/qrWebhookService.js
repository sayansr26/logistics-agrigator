/**
 * Static-QR WEBHOOK INGEST.
 *
 * The inbound door for `POST /webhooks/qr/:provider`. It mirrors
 * `webhookService.handleWebhook`'s discipline exactly, minus the one thing a
 * static QR does not have: an ORDER to look up. Nobody created an order — the
 * payer scanned a sticker on a counter — so there is no `PaymentOrder` to route
 * on, no mode snapshotted on it, and no gateway notes to reconstruct one from.
 *
 * THE INVARIANTS (the same ones, restated for this path):
 *
 *   I1. NEVER act on an unverified body. Verification gates step 5 onward.
 *   I2. NEVER ingest twice. `@@unique([provider, providerEventId])` on
 *       PaymentWebhookEvent is the first guard; `QrCollection.dedupeKey` is the
 *       second; the external wallet's `reference_id` 409 is the third.
 *   I3. NEVER move money here. This module records and delegates. Crediting is
 *       `qrCreditService` -> `webhookService.creditOrder`, and nothing else.
 *   I4. A REVERSAL IS NEVER AUTO-DEBITED. See handleReversal.
 *   I6. ALWAYS 200 ONCE THE EVENT ROW EXISTS — including on a credit failure.
 *       A non-2xx makes the provider redeliver, the redelivery hits the replay
 *       guard, and the guard swallows it as a duplicate WITHOUT crediting. That
 *       is how money gets lost. Failures after the row exists are annotated on
 *       the row for the reconcile worker instead.
 *   I7. Every state change writes an AuditLog row (via the services it calls).
 *
 * @module services/payments/qrWebhookService
 */

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");
const { APIError } = require("../../shared/lib/errors");

const { getProvider, registerLazy } = require("./index");
const {
  resolveConfigForMode,
  resolveActiveConfig,
} = require("./providerConfigService");
const qrCollectionService = require("./qrCollectionService");

const DEFAULT_PROVIDER = "ccavenue_upi_qr";

/**
 * QR collection providers this module knows how to load.
 *
 * `services/payments/index.js` is the registration entry point and is owned by
 * the bootstrap wave; until it lists this provider, `getProvider` would answer
 * PROVIDER_NOT_SUPPORTED. Rather than reach around the registry, we register
 * the SAME lazy factory `index.js` will — on first use, not at module load, so
 * requiring this file still cannot pull in a provider module. Once `index.js`
 * carries the line, `getProvider` succeeds first try and this never fires.
 */
const QR_PROVIDER_FACTORIES = Object.freeze({
  ccavenue_upi_qr: () => require("./ccavenueQrProvider"),
});

/** Header keys never persisted with the webhook event. */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
]);

/* ------------------------------------------------------------------ *
 * handleQrWebhook
 * ------------------------------------------------------------------ */

/**
 * Ingest one static-QR collection notification.
 *
 * Returns a plain result object; the controller maps `status` onto the HTTP
 * response. Only THROWS for infrastructure failures that happened BEFORE the
 * event row existed — those must surface as 503 so the provider redelivers.
 *
 * @param {Object} params
 * @param {string} [params.provider="ccavenue_upi_qr"]
 * @param {Buffer|string} [params.rawBody] - EXACT bytes received
 * @param {Object} [params.parsedBody]
 * @param {Object} [params.headers]
 * @param {string} [params.ip]
 * @returns {Promise<{status:number, code?:string, handled:string,
 *   outcome?:string, eventId?:string|null, collectionId?:string|null,
 *   paymentOrderId?:string|null, result?:Object}>}
 */
async function handleQrWebhook({
  provider = DEFAULT_PROVIDER,
  rawBody,
  parsedBody,
  headers,
  ip,
} = {}) {
  // ---- 1. Resolve the provider implementation -----------------------------
  let impl;
  try {
    impl = resolveImpl(provider);
  } catch (error) {
    logger.warn("QR webhook received for unsupported provider", {
      provider,
      error: error.message,
    });
    return {
      status: 404,
      code: "PROVIDER_NOT_SUPPORTED",
      handled: "unsupported_provider",
    };
  }

  if (typeof impl.parseQrNotification !== "function") {
    logger.error(
      "Provider is registered but does not implement parseQrNotification — it is not a QR collection provider",
      { provider },
    );
    return {
      status: 404,
      code: "PROVIDER_NOT_SUPPORTED",
      handled: "unsupported_provider",
    };
  }

  // ---- 2. Parse (PURE, never throws) --------------------------------------
  // A first pass with no decryption key. For a plaintext feed this is already
  // the final answer; for an encrypted one it yields the nulled IGNORED shape
  // and exists so that a delivery we then FAIL to authenticate still gets
  // recorded with whatever identity we could read. NOTHING from it is trusted
  // until step 3 passes.
  const preliminary = impl.parseQrNotification({
    rawBody,
    parsedBody,
    headers,
  });

  // ---- 3. Verify against the active mode's secret, then the other ---------
  const verification = await verifyAgainstBothModes({
    impl,
    provider,
    rawBody,
    parsedBody,
    headers,
  });

  // ---- 4. Unauthenticated: RECORD IT, then reject -------------------------
  // The event row is written with `signatureValid: false` on purpose. This is
  // not bookkeeping for its own sake: THE STATIC-QR PAYLOAD IS UNDOCUMENTED,
  // and the first real delivery from CCAvenue is very likely to land here. That
  // row — its headers and whatever body shape we could see — is exactly the
  // artefact needed to finish the field mappings during dashboard bring-up.
  // Without it we would answer 401 and keep no evidence at all.
  if (!verification.verified) {
    await safeRecordRejectedEvent({
      provider,
      parsed: preliminary,
      headers,
      parsedBody,
      ip,
    });

    logger.warn(
      "QR webhook could not be authenticated — body not processed (recorded for forensics)",
      {
        provider,
        triedModes: verification.triedModes,
        providerEventId: preliminary.providerEventId,
        ip,
      },
    );

    return {
      status: 401,
      code: "INVALID_SIGNATURE",
      handled: "rejected",
      eventId: preliminary.providerEventId || null,
    };
  }

  const verifiedMode = verification.mode;

  // Re-parse with the opened envelope. For a plaintext provider `decrypted` is
  // null and this is the same call as step 2.
  const parsed = verification.decrypted
    ? impl.parseQrNotification({
        rawBody,
        parsedBody,
        headers,
        decrypted: verification.decrypted,
      })
    : preliminary;

  // ---- 5. Replay guard ----------------------------------------------------
  // The provider retries until it gets a 2xx and an admin can replay by hand;
  // both arrive with the same deterministic `providerEventId`. Losing this race
  // must cost nothing, so a P2002 returns 200 WITHOUT TOUCHING MONEY.
  let eventRow;
  try {
    eventRow = await prisma.paymentWebhookEvent.create({
      data: {
        provider,
        providerEventId: parsed.providerEventId || `unidentified:${Date.now()}`,
        eventType: parsed.eventType || "qr.unknown",
        // The SCRUBBED, decrypted fields — this is what `replayStoredEvent`
        // re-parses later, and the raw bytes are deliberately not kept.
        payload: parsed.raw || {},
        headers: sanitizeHeaders(headers),
        signatureValid: true,
      },
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      logger.info("Duplicate QR webhook delivery ignored (replay guard)", {
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
    // Not yet durably recorded -> 503 is safe, the provider will redeliver.
    throw infraError(error, "qr webhook event persist");
  }

  // ---- 6/7. Route on outcome, then mark processed -------------------------
  const routed = await routeAndMark({
    eventRow,
    provider,
    parsed,
    verifiedMode,
    source: "WEBHOOK",
  });

  // ---- 8. ALWAYS 200 once the event row exists (I6) -----------------------
  return {
    status: 200,
    handled: routed.handled,
    outcome: parsed.outcome,
    eventId: parsed.providerEventId,
    collectionId: routed.collectionId || null,
    paymentOrderId: routed.paymentOrderId || null,
    result: routed.result,
  };
}

/* ------------------------------------------------------------------ *
 * replayStoredEvent
 * ------------------------------------------------------------------ */

/**
 * Re-drive ONE stored QR event whose processing failed.
 *
 * The reconcile worker's existing unprocessed-event sweep
 * (`reconcileService.scanUnprocessedEvents`, restricted to `signatureValid:
 * true, processed: false`) can call this for rows whose provider is a QR
 * collection provider, so a QR event that failed after being recorded is
 * recovered by the same machinery as a gateway event.
 *
 * SIGNATURE IS NOT RE-VERIFIED, DELIBERATELY — the same reasoning
 * `reconcileService` documents: the sweep only selects rows whose
 * authentication already passed at receipt time, and `payload` holds the
 * decrypted, scrubbed fields that passed. The raw bytes are not persisted (they
 * carry PII and are only needed for the check), so re-verification is
 * impossible here anyway.
 *
 * Re-ingestion is safe by construction: `ingestCollection` dedupes on
 * `dedupeKey`, so a replay of an event whose collection already landed is a
 * duplicate, not a second credit.
 *
 * @param {Object} event - a PaymentWebhookEvent row
 * @returns {Promise<{ok:boolean, handled:string, collectionId?:?string,
 *   paymentOrderId?:?string, credited?:boolean, error?:string}>}
 */
async function replayStoredEvent(event) {
  if (!event || !event.id) {
    return { ok: false, handled: "invalid_event" };
  }

  let impl;
  try {
    impl = resolveImpl(event.provider);
  } catch (error) {
    await recordEventFailure(event, `PROVIDER_NOT_SUPPORTED: ${error.message}`);
    return { ok: false, handled: "unsupported_provider", error: error.message };
  }

  if (typeof impl.parseQrNotification !== "function") {
    await recordEventFailure(event, "NOT_A_QR_PROVIDER");
    return { ok: false, handled: "unsupported_provider" };
  }

  // The stored payload IS the already-decrypted, already-verified field map, so
  // it is handed in as `decrypted`.
  const parsed = impl.parseQrNotification({
    rawBody: null,
    parsedBody: event.payload || {},
    headers: event.headers || {},
    decrypted: event.payload || {},
  });

  // The mode that verified this delivery is not recorded on the event row, so
  // we use the only honest signal available — the provider's currently-active
  // mode — exactly as `reconcileService` does for an orphan. It is only used as
  // metadata here: the CREDIT's mode comes from the QR row's snapshot inside
  // `qrCreditService`, which is the authoritative source and cannot be spoofed
  // by a stale event row.
  let activeMode = null;
  try {
    const active = await resolveActiveConfig(event.provider);
    activeMode = active && active.mode;
  } catch (error) {
    logger.warn("Could not resolve active config while replaying a QR event", {
      provider: event.provider,
      error: error.message,
    });
  }

  const routed = await routeAndMark({
    eventRow: event,
    provider: event.provider,
    parsed,
    verifiedMode: activeMode,
    source: "REPLAY",
  });

  return {
    ok: routed.handled !== "deferred",
    handled: routed.handled,
    collectionId: routed.collectionId || null,
    paymentOrderId: routed.paymentOrderId || null,
    credited: Boolean(routed.result && routed.result.credited),
  };
}

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

/**
 * Steps 6 and 7 shared by the live webhook and the replay path.
 *
 * From here on the event IS durably recorded, so an unexpected failure must NOT
 * become a non-2xx (I6): it is annotated on the event row and the caller still
 * answers 200.
 *
 * @private
 */
async function routeAndMark({
  eventRow,
  provider,
  parsed,
  verifiedMode,
  source,
}) {
  let result = { handled: "ignored" };
  let collectionId = null;
  let paymentOrderId = null;

  try {
    switch (parsed.outcome) {
      case "COLLECTED": {
        // THE ONLY WAY A STATIC-QR PAYMENT ENTERS THE SYSTEM. The row is
        // written unconditionally; the credit (if the QR matched) happens
        // inside the handler `qrCreditService.registerCreditHandler` installed.
        const ingested = await qrCollectionService.ingestCollection({
          provider,
          source: "WEBHOOK",
          utr: parsed.utr,
          providerTxnId: parsed.providerTxnId,
          qrIdentifier: parsed.qrIdentifier,
          payerVpa: parsed.payerVpa,
          payerName: parsed.payerName,
          amountPaise: parsed.amountPaise,
          currency: parsed.currency,
          txnAt: parsed.txnAt,
          rawPayload: parsed.raw || {},
          metadata: {
            webhookEventId: eventRow.id,
            providerEventId: parsed.providerEventId,
            verifiedMode,
            replayed: source === "REPLAY" || undefined,
          },
        });

        collectionId = ingested.collection ? ingested.collection.id : null;
        paymentOrderId = ingested.collection
          ? ingested.collection.paymentOrderId || null
          : null;

        result = {
          handled: ingested.duplicate
            ? "duplicate_collection"
            : ingested.matched
              ? "ingested"
              : "unattributed",
          duplicate: ingested.duplicate,
          matched: ingested.matched,
          status: ingested.status,
          credited: ingested.status === "CREDITED",
        };
        break;
      }

      case "REVERSED": {
        result = await handleReversal({ provider, parsed, eventRow });
        collectionId = result.collectionId || null;
        break;
      }

      case "IGNORED":
      default:
        // An unrecognised payload shape lands here BY DESIGN — the provider
        // maps anything it cannot read to IGNORED rather than guessing. The
        // event row is the record; a human reads it.
        result = { handled: "ignored" };
        break;
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        processed: true,
        processedAt: new Date(),
        processingError: null,
        ...(paymentOrderId ? { paymentOrderId } : {}),
      },
    });

    return {
      handled: result.handled || "processed",
      result,
      collectionId,
      paymentOrderId,
    };
  } catch (error) {
    logger.error("QR webhook processing failed AFTER the event was recorded", {
      provider,
      eventId: eventRow.id,
      providerEventId: parsed.providerEventId,
      outcome: parsed.outcome,
      error: error.message,
    });

    await recordEventFailure(eventRow, error);

    return {
      handled: "deferred",
      result: { handled: "deferred", error: String(error.message || error) },
      collectionId,
      paymentOrderId,
    };
  }
}

/**
 * A reversal / chargeback on money we may already have credited.
 *
 * ⚠️ NEVER AUTO-DEBITS. The wallet balance is the EXTERNAL system's, the credit
 * may be hours old, and the merchant may already have spent it on shipments. An
 * automatic debit would either fail (leaving a half-applied reversal) or drive
 * the balance negative behind the merchant's back. The correct move is to make
 * the row impossible to miss and let an admin reconcile it deliberately via the
 * existing `/admin/debit` flow, where the decision is attributable.
 *
 * @private
 */
async function handleReversal({ provider, parsed, eventRow }) {
  const collection = parsed.utr
    ? await prisma.qrCollection.findFirst({
        where: { provider, utr: parsed.utr },
        orderBy: { receivedAt: "desc" },
      })
    : null;

  if (!collection) {
    logger.error(
      "QR REVERSAL reported for a collection we have no record of — MANUAL ACTION REQUIRED",
      {
        provider,
        utr: parsed.utr,
        providerTxnId: parsed.providerTxnId,
        amountPaise: parsed.amountPaise,
        eventId: eventRow.id,
      },
    );
    return { handled: "reversal_no_collection", collectionId: null };
  }

  await prisma.qrCollection.update({
    where: { id: collection.id },
    data: {
      needsManualAction: true,
      lastError: truncate(
        `REVERSAL_REPORTED: the provider reported this collection reversed (event ${eventRow.id}). NOT auto-debited — reconcile via /admin/debit.`,
        2000,
      ),
      metadata: {
        ...(isPlainObject(collection.metadata) ? collection.metadata : {}),
        reversal: {
          at: new Date().toISOString(),
          providerEventId: parsed.providerEventId,
          amountPaise: parsed.amountPaise,
          autoDebited: false,
        },
      },
    },
  });

  await writeAudit({
    action: "QR_COLLECTION_REVERSAL_FLAGGED",
    resourceId: collection.id,
    userId: collection.subjectUserId,
    details: {
      provider,
      utr: parsed.utr,
      amountPaise: parsed.amountPaise,
      collectionStatus: collection.status,
      paymentOrderId: collection.paymentOrderId || null,
      webhookEventId: eventRow.id,
      note: "Reversal recorded and flagged. NEVER auto-debited — the balance may already be spent; an admin reconciles via /admin/debit.",
    },
  });

  logger.error(
    "QR collection REVERSED by the provider — flagged for manual reconciliation, NOT auto-debited",
    {
      collectionId: collection.id,
      status: collection.status,
      paymentOrderId: collection.paymentOrderId || null,
      amountPaise: parsed.amountPaise,
      utr: parsed.utr,
    },
  );

  return { handled: "reversal_flagged", collectionId: collection.id };
}

/* ------------------------------------------------------------------ *
 * Verification
 * ------------------------------------------------------------------ */

/**
 * Try the currently-active mode's secret first, then the other one.
 *
 * The reasoning is identical to `webhookService.verifySignature`'s no-order
 * branch, and for the same two reasons: the provider posts both TEST and LIVE
 * traffic to ONE webhook URL, and an admin may flip the platform between modes
 * while a payment is in flight. There is no order to take a snapshotted mode
 * from here — there never is, for a static QR — so the mode returned is simply
 * the mode of the key that actually worked.
 *
 * `requireEnabled: false`: a provider disabled AFTER the money arrived must
 * still have that delivery authenticated. The customer already paid.
 *
 * @private
 * @returns {Promise<{verified:boolean, config:?Object, mode:?string,
 *   decrypted:?Object, triedModes:string[]}>}
 */
async function verifyAgainstBothModes({
  impl,
  provider,
  rawBody,
  parsedBody,
  headers,
}) {
  let activeMode = null;
  try {
    const active = await resolveActiveConfig(provider);
    activeMode = active && active.mode;
  } catch (error) {
    logger.warn(
      "Could not resolve active provider config for QR verification",
      {
        provider,
        error: error.message,
      },
    );
  }

  const modes = activeMode
    ? [activeMode, activeMode === "LIVE" ? "TEST" : "LIVE"]
    : ["LIVE", "TEST"];

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
      logger.warn("No usable QR webhook secret for provider mode", {
        provider,
        mode,
        code: error.code,
      });
      continue;
    }

    let ok = false;
    try {
      ok = impl.verifyWebhookSignature({
        config,
        rawBody,
        parsedBody,
        headers,
      });
    } catch (error) {
      // The contract says SYNC boolean and fail-closed; a throw is a rejection.
      logger.error("QR signature verification threw — treated as a rejection", {
        provider,
        mode,
        error: error.message,
      });
      ok = false;
    }

    if (ok === true) {
      let decrypted = null;
      if (typeof impl.decryptQrEnvelope === "function") {
        try {
          decrypted = impl.decryptQrEnvelope({ config, rawBody, parsedBody });
        } catch (error) {
          logger.warn(
            "QR envelope decryption failed after a successful verify",
            {
              provider,
              mode,
              error: error.message,
            },
          );
        }
      }
      return { verified: true, config, mode, decrypted, triedModes: tried };
    }
  }

  return {
    verified: false,
    config: null,
    mode: null,
    decrypted: null,
    triedModes: tried,
  };
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/**
 * Resolve the provider implementation, registering the known QR factory on
 * first use if `services/payments/index.js` does not list it yet.
 * @private
 */
function resolveImpl(provider) {
  const key = String(provider || "")
    .trim()
    .toLowerCase();

  try {
    return getProvider(key);
  } catch (error) {
    const factory = QR_PROVIDER_FACTORIES[key];
    if (!factory) throw error;

    registerLazy(key, factory);
    return getProvider(key);
  }
}

/**
 * Persist an unauthenticated delivery for forensics. Best-effort only: a
 * failure here must not change the 401 we are about to return.
 *
 * `signatureValid: false` keeps it out of `reconcileService`'s replay sweep,
 * which is restricted to already-authenticated rows.
 * @private
 */
async function safeRecordRejectedEvent({
  provider,
  parsed,
  headers,
  parsedBody,
  ip,
}) {
  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider,
        providerEventId:
          (parsed && parsed.providerEventId) ||
          `unverified:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        eventType: (parsed && parsed.eventType) || "qr.unauthenticated",
        // Whatever shape we could see. NEVER the raw bytes and never a secret:
        // this is the key set an engineer needs to finish the field mappings.
        payload:
          (parsed && parsed.raw && Object.keys(parsed.raw).length > 0
            ? parsed.raw
            : { _unreadable: true, _bodyKeys: describeKeys(parsedBody) }) || {},
        headers: { ...sanitizeHeaders(headers), _sourceIp: ip || null },
        signatureValid: false,
        processed: false,
        processingError: "INVALID_SIGNATURE",
      },
    });
  } catch (error) {
    if (!error || error.code !== "P2002") {
      logger.error("Could not persist rejected QR webhook event", {
        provider,
        error: error.message,
      });
    }
  }
}

/** @private */
async function recordEventFailure(eventRow, error) {
  try {
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        processed: false,
        processingError: truncate(
          String((error && error.message) || error),
          2000,
        ),
      },
    });
  } catch (markError) {
    logger.error("Could not annotate failed QR webhook event", {
      eventId: eventRow.id,
      error: markError.message,
    });
  }
}

/** @private */
async function writeAudit({ action, resourceId, userId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: isUuid(userId) ? userId : null,
        action,
        resource: "QrCollection",
        resourceId: resourceId || null,
        details: details || {},
      },
    });
  } catch (error) {
    logger.error("AUDIT WRITE FAILED for a QR webhook state change", {
      action,
      resourceId,
      error: error.message,
    });
  }
}

/** @private */
function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(String(key).toLowerCase())) continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}

/** @private */
function describeKeys(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.keys(obj).slice(0, 40);
}

/**
 * Wrap a PRE-RECORD infrastructure failure as a 503 so the provider REDELIVERS.
 * Only valid before the PaymentWebhookEvent row exists (I6).
 * @private
 */
function infraError(error, stage) {
  logger.error(`QR webhook infrastructure failure during ${stage}`, {
    stage,
    error: error.message,
  });
  return new APIError(
    "QR webhook could not be processed — please retry",
    503,
    "WEBHOOK_INFRA_UNAVAILABLE",
  );
}

/** @private */
function truncate(value, max) {
  const text = String(value === null || value === undefined ? "" : value);
  return text.length > max ? text.slice(0, max) : text;
}

/** @private */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @private */
function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

module.exports = {
  handleQrWebhook,
  replayStoredEvent,
  DEFAULT_PROVIDER,
};
