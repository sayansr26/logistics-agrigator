/**
 * Static-QR Collection Service — Wave 2 (INGESTION + ATTRIBUTION MATCHING ONLY)
 *
 * WHAT THIS IS
 * ------------
 * A static UPI QR is printed once and pinned to one outlet. A customer scans it
 * and types WHATEVER AMOUNT THEY LIKE. There is therefore:
 *
 *   - no pre-existing order,
 *   - no expected amount,
 *   - and nothing the gateway can echo back to tell us whose money it is.
 *
 * The whole order-first `topupService` / `webhookService` path assumes the
 * opposite (an order exists, its amount is known, its `notes` carry the wallet
 * identity), so it structurally cannot ingest this traffic.
 *
 * The precedent that CAN is the COD remittance module in this same service:
 * `codService.addCollection` looks up a match and then writes the collection row
 * BEFORE and REGARDLESS of whether it matched (`matchedCodShipmentId: match ?
 * match.id : null`). Money that arrived must be recorded even when we cannot yet
 * say whose it is — dropping unmatched rows destroys the evidence.
 * `QrCollection.outletPaymentQrId IS NULL` is the direct analogue: a STATE (the
 * ops queue), not an error.
 *
 * WHAT COD LACKS AND THIS MODULE ADDS: IDEMPOTENCY.
 * -------------------------------------------------
 * Nothing in `codService.importCollections` stops the same CSV being imported
 * twice, so it double-counts. Here every row carries `dedupeKey @unique` plus a
 * partial unique on `(provider, utr) WHERE utr IS NOT NULL`, and a re-delivery
 * or re-import is a NO-OP that returns `{duplicate: true}` — not an error, not a
 * failed row, and never a second credit.
 *
 * SCOPE LIMIT — THIS MODULE NEVER MOVES MONEY.
 * --------------------------------------------
 * Crediting is Wave 3 (`attributeAndCredit`: mint a `PaymentOrder`, call
 * `webhookService.creditOrder`). This module ingests, matches, and stops. The
 * only seam to Wave 3 is `setCreditHandler()` (see below) — Wave 3's module is
 * deliberately NOT imported here, so ingestion can never be blocked by, or
 * circularly depend on, the credit path.
 */

const crypto = require("crypto");

const { prisma } = require("../../config/database");
const logger = require("../../shared/lib/logger");
const { ValidationError } = require("../../shared/lib/errors");

const DEFAULT_PROVIDER = "ccavenue_upi_qr";
const DEFAULT_CURRENCY = "INR";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Audit actions written by this module. Exported so controllers/tests reference
 *  the constant rather than re-typing the string. */
const AUDIT_ACTIONS = {
  QR_COLLECTION_INGESTED: "QR_COLLECTION_INGESTED",
  QR_COLLECTION_DUPLICATE_IGNORED: "QR_COLLECTION_DUPLICATE_IGNORED",
  QR_COLLECTION_IMPORTED: "QR_COLLECTION_IMPORTED",
  QR_COLLECTION_CREDIT_HANDLER_FAILED: "QR_COLLECTION_CREDIT_HANDLER_FAILED",
};

const AUDIT_RESOURCE = "QrCollection";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ *
 * The Wave-3 credit seam
 * ------------------------------------------------------------------ */

/**
 * THE SEAM. Wave 3 calls `setCreditHandler(fn)` once at wiring time (server
 * bootstrap / its own module init); this module never requires Wave 3.
 *
 * A per-call `input.onAttributed` overrides the module handler for one
 * ingestion — that exists for tests and one-off replays only. The MODULE HOOK
 * is the documented production seam, because `importCollections` and the
 * webhook controller both funnel through `ingestCollection` and neither should
 * have to know about the credit path.
 *
 * The handler is invoked as `handler({ collection, qr })` ONLY when the row
 * settles at `ATTRIBUTED`. It is fail-safe: a throw is caught, audited, stamped
 * onto `lastError`, and the collection row survives untouched otherwise.
 *
 * @type {null|function(Object): (Promise<any>|any)}
 */
let creditHandler = null;

/**
 * Register (or clear, with `null`) the Wave-3 credit handler.
 * @param {?function(Object): (Promise<any>|any)} fn
 * @returns {void}
 */
function setCreditHandler(fn) {
  if (fn !== null && typeof fn !== "function") {
    throw new TypeError("setCreditHandler expects a function or null");
  }
  creditHandler = fn;
}

/** @returns {?Function} the currently registered handler (diagnostics/tests). */
function getCreditHandler() {
  return creditHandler;
}

/* ------------------------------------------------------------------ *
 * Dedupe key
 * ------------------------------------------------------------------ */

/**
 * Build the idempotency key for an inbound collection.
 *
 * WHY THIS SHAPE:
 *  - A UTR is the bank's own globally-unique reference for the transfer. When
 *    one is present, `sha256(provider|utr)` is the STRONGEST possible key: the
 *    same money re-delivered by webhook, re-imported from a CSV, and re-fetched
 *    by the poller all collapse onto one row, because all three carry the same
 *    UTR even though every other field (source, receivedAt, payload shape)
 *    differs.
 *  - With no UTR we fall back to a CONTENT hash of the identifying facts:
 *    provider, QR, amount in paise, txn timestamp truncated to the second, and
 *    the provider's own txn id.
 *  - `txnAt` is truncated to the second because providers round the same
 *    instant differently across delivery channels (ms in JSON, seconds in CSV);
 *    without truncation a genuine re-delivery would MISS and double-count.
 *  - NOTHING time-of-ingest and NOTHING random may enter this key. `receivedAt`,
 *    `Date.now()`, a uuid — any of those would make every re-delivery a fresh
 *    row, which is precisely the COD bug this column exists to fix.
 *  - Output is sha256 hex = 64 chars, comfortably inside `VarChar(80)`.
 *
 * @param {Object} params
 * @param {string} [params.provider]
 * @param {?string} [params.utr]
 * @param {?string} [params.qrIdentifier]
 * @param {?number} [params.amountPaise]
 * @param {?(Date|string)} [params.txnAt]
 * @param {?string} [params.providerTxnId]
 * @returns {string} 64-char lowercase hex
 */
function buildDedupeKey({
  provider,
  utr,
  qrIdentifier,
  amountPaise,
  txnAt,
  providerTxnId,
} = {}) {
  const prov = normalizeProvider(provider);
  const normalizedUtr = normalizeUtr(utr);

  if (normalizedUtr) {
    return sha256(`${prov}|${normalizedUtr}`);
  }

  const material = [
    prov,
    qrIdentifier ? String(qrIdentifier).trim() : "",
    Number.isInteger(amountPaise) ? String(amountPaise) : "",
    truncateToSecond(txnAt),
    providerTxnId ? String(providerTxnId).trim() : "",
  ].join("|");

  return sha256(material);
}

/* ------------------------------------------------------------------ *
 * Attribution matching
 * ------------------------------------------------------------------ */

/**
 * Resolve the outlet QR a payment landed on.
 *
 * NEVER GUESS. Exact match on an ACTIVE row by `qrIdentifier`, else by `vpa`,
 * else `null`. No fuzzy matching, no amount heuristics, no "nearest outlet", no
 * "only one outlet has that name". Same discipline as
 * `webhookService.adoptOrphanPayment`'s no-notes branch: an unattributed row
 * handed to an admin is a RECOVERABLE problem; money credited to the wrong
 * merchant's wallet is not.
 *
 * A row that matches but is INACTIVE (a retired QR still in circulation on a
 * printed sticker) resolves to `null` — the system must not act on it — but its
 * id is surfaced to the caller as `matchedInactiveQrId` so an admin sees "this
 * looks like outlet X's retired QR" in the unattributed queue.
 *
 * @param {Object} params
 * @param {string} [params.provider]
 * @param {?string} [params.qrIdentifier]
 * @param {?string} [params.payerVpa]
 * @returns {Promise<?Object>} the active OutletPaymentQr row, or null
 */
async function resolveQr({ provider, qrIdentifier, payerVpa } = {}) {
  const found = await findQrCandidate({ provider, qrIdentifier, payerVpa });
  return found && found.isActive ? found : null;
}

/**
 * Same lookup as `resolveQr` but WITHOUT the isActive gate, so the caller can
 * distinguish "no such QR at all" from "a retired QR".
 * @private
 * @returns {Promise<?Object>}
 */
async function findQrCandidate({ provider, qrIdentifier, payerVpa } = {}) {
  const prov = normalizeProvider(provider);
  const qrId = qrIdentifier ? String(qrIdentifier).trim() : "";
  const vpa = payerVpa ? String(payerVpa).trim() : "";

  if (qrId) {
    // Active rows first: the partial unique index guarantees at most ONE active
    // row per (provider, qrIdentifier), so this can never be ambiguous.
    const byQr =
      (await prisma.outletPaymentQr.findFirst({
        where: { provider: prov, qrIdentifier: qrId, isActive: true },
      })) ||
      (await prisma.outletPaymentQr.findFirst({
        where: { provider: prov, qrIdentifier: qrId },
        orderBy: { createdAt: "desc" },
      }));
    if (byQr) return byQr;
  }

  if (vpa) {
    const byVpa =
      (await prisma.outletPaymentQr.findFirst({
        where: { provider: prov, vpa, isActive: true },
      })) ||
      (await prisma.outletPaymentQr.findFirst({
        where: { provider: prov, vpa },
        orderBy: { createdAt: "desc" },
      }));
    if (byVpa) return byVpa;
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Ingestion
 * ------------------------------------------------------------------ */

/**
 * THE ONLY WAY A STATIC-QR PAYMENT ENTERS THE SYSTEM.
 *
 * Webhook, CSV import, manual entry and poller all funnel through here, so the
 * dedupe rule, the never-guess matching rule and the audit trail are enforced
 * exactly once, in the service layer — never in a route or controller.
 *
 * @param {Object} input
 * @param {string} [input.provider="ccavenue_upi_qr"]
 * @param {("WEBHOOK"|"IMPORT"|"MANUAL"|"POLL")} [input.source="WEBHOOK"]
 * @param {?string} [input.utr]
 * @param {?string} [input.providerTxnId]
 * @param {?string} [input.qrIdentifier]
 * @param {?string} [input.payerVpa]
 * @param {?string} [input.payerName]
 * @param {number} input.amountPaise positive integer
 * @param {string} [input.currency="INR"]
 * @param {?(Date|string)} [input.txnAt]
 * @param {?Object} [input.rawPayload]
 * @param {?string} [input.actorUserId] local portal UUID of the actor
 * @param {?Object} [input.metadata]
 * @param {?Function} [input.onAttributed] per-call override of the credit seam
 * @returns {Promise<{collection: Object, duplicate: boolean, matched: boolean,
 *                    status: string, qr: ?Object}>}
 */
async function ingestCollection(input = {}) {
  const normalized = normalizeInput(input);

  const dedupeKey = buildDedupeKey({
    provider: normalized.provider,
    utr: normalized.utr,
    qrIdentifier: normalized.qrIdentifier,
    amountPaise: normalized.amountPaise,
    txnAt: normalized.txnAt,
    providerTxnId: normalized.providerTxnId,
  });

  const candidate = await findQrCandidate({
    provider: normalized.provider,
    qrIdentifier: normalized.qrIdentifier,
    payerVpa: normalized.payerVpa,
  });
  const qr = candidate && candidate.isActive ? candidate : null;
  const matchedInactiveQrId =
    candidate && !candidate.isActive ? candidate.id : null;

  // Fast path for the overwhelmingly common duplicate (a webhook redelivery or
  // a re-imported CSV): read first so we do not burn a sequence value or write
  // an error-level Prisma log for a perfectly normal event. The P2002 catch
  // below still covers the concurrent-delivery race.
  const preExisting = await prisma.qrCollection.findUnique({
    where: { dedupeKey },
  });
  if (preExisting) {
    return handleDuplicate(preExisting, normalized, dedupeKey, qr);
  }

  const matched = Boolean(qr);

  // A UTR-LESS COLLECTION IS FORCED INTO THE MANUAL QUEUE EVEN WHEN THE QR
  // MATCHED. Without a UTR the dedupe key is only a content hash: two genuinely
  // distinct payments of the same amount, on the same QR, in the same second,
  // with no provider txn id, would collide — and conversely a provider that
  // starts sending millisecond timestamps would stop colliding. That is a weak
  // enough guarantee that no such row may ever reach an automatic credit; a
  // human confirms it first. `needsManualAction` is what puts it in front of one.
  const utrless = !normalized.utr;
  const status = matched && !utrless ? "ATTRIBUTED" : "UNATTRIBUTED";
  const needsManualAction = !matched || utrless;

  // Typed counterparts of what buildMetadata() also records as JSON. These exist
  // as columns so the ops queue is filterable (`WHERE unattributedReason = ...`)
  // and so an operator can see at a glance whether a row's idempotency key is
  // the bank's UTR or a weaker content hash.
  const dedupeStrategy = normalized.utr ? "UTR" : "CONTENT";
  let unattributedReason = null;
  if (status === "UNATTRIBUTED") {
    if (utrless) unattributedReason = "NO_UTR";
    else if (matchedInactiveQrId) unattributedReason = "INACTIVE_QR";
    else unattributedReason = "NO_QR_MATCH";
  }

  const data = {
    provider: normalized.provider,
    source: normalized.source,
    status,
    utr: normalized.utr,
    dedupeKey,
    dedupeStrategy,
    unattributedReason,
    providerTxnId: normalized.providerTxnId,
    qrIdentifier: normalized.qrIdentifier,
    payerVpa: normalized.payerVpa,
    payerName: normalized.payerName,
    // Decimal from the integer paise via STRING arithmetic — never
    // `paise / 100`, which is a float round-trip and can land 1p off.
    amount: paiseToAmountString(normalized.amountPaise),
    amountPaise: normalized.amountPaise,
    currency: normalized.currency,
    txnAt: normalized.txnAt,
    outletPaymentQrId: qr ? qr.id : null,
    // Wallet identity is SNAPSHOTTED FROM THE QR ROW, never from the payload.
    // The payer controls the payload; only the QR row says whose money this is.
    walletUserId: qr ? qr.walletUserId : null,
    clientCode: qr ? qr.clientCode : null,
    subjectUserId: qr ? (qr.subjectUserId ?? null) : null,
    mode: qr ? qr.mode : null,
    needsManualAction,
    rawPayload: normalized.rawPayload ?? undefined,
    metadata: buildMetadata(normalized, { matchedInactiveQrId, utrless }),
    createdBy: normalized.actorUserId,
  };

  let collection;
  try {
    collection = await prisma.qrCollection.create({ data });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Lost a race with a concurrent delivery of the same money. Re-read and
      // treat it exactly as the fast path would have.
      const existing = await findExisting(dedupeKey, normalized);
      if (existing) {
        return handleDuplicate(existing, normalized, dedupeKey, qr);
      }
    }
    throw error;
  }

  await writeAudit({
    action: AUDIT_ACTIONS.QR_COLLECTION_INGESTED,
    resourceId: collection.id,
    userId: normalized.actorUserId,
    details: {
      source: normalized.source,
      utr: normalized.utr,
      qrIdentifier: normalized.qrIdentifier,
      amountPaise: normalized.amountPaise,
      matched,
      status,
      provider: normalized.provider,
      ...(matchedInactiveQrId ? { matchedInactiveQrId } : {}),
      ...(utrless ? { forcedManual: "NO_UTR" } : {}),
    },
  });

  if (!matched) {
    // Deliberately as LOUD as `webhookService`'s orphan log: this is money that
    // has already left the customer's account and currently belongs to nobody.
    logger.error(
      "QR payment could not be attributed — MANUAL ACTION REQUIRED",
      {
        collectionId: collection.id,
        provider: normalized.provider,
        source: normalized.source,
        utr: normalized.utr,
        qrIdentifier: normalized.qrIdentifier,
        payerVpa: normalized.payerVpa,
        amountPaise: normalized.amountPaise,
        matchedInactiveQrId,
      },
    );
  }

  const result = {
    collection,
    duplicate: false,
    matched,
    status: collection.status,
    qr,
  };

  if (collection.status === "ATTRIBUTED") {
    result.collection = await invokeCreditHandler(collection, qr, normalized);
    result.status = result.collection.status;
  }

  return result;
}

/**
 * Duplicate resolution — the row already exists, so NO money and NO error.
 *
 * Three sub-cases, all of them ending `{duplicate: true}`:
 *  1. plain re-delivery                 -> record the audit, return as-is
 *  2. same UTR, DIFFERENT amount        -> warn + `needsManualAction`
 *  3. IMPORT row later seen by webhook  -> enrich payload fields in place
 *
 * @private
 */
async function handleDuplicate(existing, normalized, dedupeKey, qr) {
  // Material changes only. The delivery counter is applied separately at the
  // write below: folding it in here would make `Object.keys(updates).length`
  // always true, which is this function's "did anything actually change?" test.
  const updates = {};
  const auditDetails = {
    source: normalized.source,
    utr: normalized.utr,
    qrIdentifier: normalized.qrIdentifier,
    amountPaise: normalized.amountPaise,
    existingId: existing.id,
    existingStatus: existing.status,
    existingSource: existing.source,
    reason: "DEDUPE_KEY_ALREADY_PRESENT",
  };

  // (2) A bank NEVER reuses a UTR for a different amount. Either the source data
  // is corrupt or somebody is probing us — either way a human must look, but the
  // stored amount is NOT overwritten, because the first record is the one the
  // money arrived with.
  const amountMismatch =
    Number.isInteger(normalized.amountPaise) &&
    Number.isInteger(existing.amountPaise) &&
    normalized.amountPaise !== existing.amountPaise;

  if (amountMismatch) {
    updates.needsManualAction = true;
    updates.lastError = truncate(
      `DUPLICATE_AMOUNT_MISMATCH: stored ${existing.amountPaise} paise, ` +
        `re-delivered as ${normalized.amountPaise} paise (source ${normalized.source})`,
      2000,
    );
    auditDetails.reason = "DUPLICATE_AMOUNT_MISMATCH";
    auditDetails.storedAmountPaise = existing.amountPaise;

    logger.warn(
      "Duplicate QR collection arrived with a DIFFERENT amount — bad data or an attack",
      {
        collectionId: existing.id,
        utr: existing.utr,
        storedAmountPaise: existing.amountPaise,
        incomingAmountPaise: normalized.amountPaise,
        incomingSource: normalized.source,
      },
    );
  } else {
    // (3) Import-then-webhook enrichment. A CSV row carries no raw payload and
    // often no provider txn id / payer VPA; when the webhook for the same UTR
    // lands later we backfill those EVIDENCE fields in place. Never the amount,
    // never the status, never the wallet identity — enrichment must not be able
    // to change where the money goes.
    if (
      existing.source === "IMPORT" &&
      (existing.rawPayload === null || existing.rawPayload === undefined)
    ) {
      if (
        normalized.rawPayload !== null &&
        normalized.rawPayload !== undefined
      ) {
        updates.rawPayload = normalized.rawPayload;
      }
      if (!existing.providerTxnId && normalized.providerTxnId) {
        updates.providerTxnId = normalized.providerTxnId;
      }
      if (!existing.payerVpa && normalized.payerVpa) {
        updates.payerVpa = normalized.payerVpa;
      }
      if (Object.keys(updates).length > 0) {
        auditDetails.reason = "DUPLICATE_ENRICHED_FROM_" + normalized.source;
        auditDetails.enrichedFields = Object.keys(updates);
      }
    }
  }

  // Every duplicate is still a delivery. Counting them on the row makes "this
  // UTR arrived 14 times" visible in the ops queue rather than only in the audit
  // log — which is how a provider stuck in a redelivery loop shows up. The
  // counter rides along with any material updates so this stays a single write.
  const updated = await prisma.qrCollection.update({
    where: { id: existing.id },
    data: { ...updates, deliveryCount: { increment: 1 } },
  });
  // Merge rather than replace: callers read identity fields (utr, amountPaise)
  // off this row, and they must survive regardless of what the write returned.
  const row = updated ? { ...existing, ...updated } : existing;

  await writeAudit({
    action: AUDIT_ACTIONS.QR_COLLECTION_DUPLICATE_IGNORED,
    resourceId: row.id,
    userId: normalized.actorUserId,
    details: { ...auditDetails, dedupeKey },
  });

  logger.info("Duplicate QR collection ignored", {
    collectionId: row.id,
    dedupeKey,
    source: normalized.source,
    reason: auditDetails.reason,
  });

  // `matched` reports the STORED row's attribution, not this delivery's lookup —
  // callers must never conclude "matched" from a delivery that wrote nothing.
  return {
    collection: row,
    duplicate: true,
    matched: Boolean(row.outletPaymentQrId),
    status: row.status,
    qr: qr || null,
  };
}

/**
 * Call the Wave-3 credit seam, fail-safe.
 *
 * A throw here must NEVER lose the collection: the row is already committed and
 * is the record that money arrived. We stamp `lastError` + `needsManualAction`
 * (a credit that did not happen needs a human, exactly like an unattributed row)
 * and return the row.
 * @private
 */
async function invokeCreditHandler(collection, qr, normalized) {
  const handler =
    typeof normalized.onAttributed === "function"
      ? normalized.onAttributed
      : creditHandler;

  if (typeof handler !== "function") return collection;

  try {
    const handled = await handler({ collection, qr });
    return handled && typeof handled === "object" && handled.id
      ? handled
      : collection;
  } catch (error) {
    logger.error("QR credit handler failed — collection row left intact", {
      collectionId: collection.id,
      error: error.message,
    });

    await writeAudit({
      action: AUDIT_ACTIONS.QR_COLLECTION_CREDIT_HANDLER_FAILED,
      resourceId: collection.id,
      userId: normalized.actorUserId,
      details: { error: truncate(String(error.message || error), 500) },
    });

    try {
      return await prisma.qrCollection.update({
        where: { id: collection.id },
        data: {
          lastError: truncate(
            `CREDIT_HANDLER_FAILED: ${String(error.message || error)}`,
            2000,
          ),
          needsManualAction: true,
        },
      });
    } catch (stampError) {
      logger.error("Could not stamp lastError on QR collection", {
        collectionId: collection.id,
        error: stampError.message,
      });
      return collection;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Bulk import
 * ------------------------------------------------------------------ */

/**
 * Import parsed CSV/statement rows.
 *
 * Per-row try/catch, mirroring `codService.importCollections`: ONE bad row never
 * aborts a batch of a thousand good ones.
 *
 * DUPLICATE IS A FIRST-CLASS OUTCOME, NOT A FAILURE. Re-importing yesterday's
 * file is the normal way an operator makes sure nothing was missed; it must read
 * as "40 already had, 3 new", never as "40 errors".
 *
 * @param {Array<Object>} rows rows shaped like `ingestCollection` input
 * @param {Object} [options]
 * @param {("WEBHOOK"|"IMPORT"|"MANUAL"|"POLL")} [options.source="IMPORT"]
 * @param {?string} [options.actorUserId]
 * @param {boolean} [options.dryRun=false] resolve + dedupe-check, WRITE NOTHING
 * @returns {Promise<{total:number, successCount:number, duplicateCount:number,
 *   unmatchedCount:number, failureCount:number,
 *   successful:Array<{utr:?string, matched:boolean, status:string}>,
 *   duplicates:Array<{utr:?string, existingId:string}>,
 *   failed:Array<{index:number, utr:?string, error:string}>, dryRun:boolean}>}
 */
async function importCollections(rows, options = {}) {
  const { source = "IMPORT", actorUserId = null, dryRun = false } = options;
  const list = Array.isArray(rows) ? rows : [];

  const successful = [];
  const duplicates = [];
  const failed = [];
  let unmatchedCount = 0;

  for (let index = 0; index < list.length; index += 1) {
    const row = list[index] || {};
    try {
      const outcome = dryRun
        ? await previewRow(row, { source, actorUserId })
        : await ingestCollection({ ...row, source, actorUserId });

      if (outcome.duplicate) {
        duplicates.push({
          utr: outcome.collection ? outcome.collection.utr : (row.utr ?? null),
          existingId: outcome.collection ? outcome.collection.id : null,
        });
      } else {
        if (!outcome.matched) unmatchedCount += 1;
        successful.push({
          utr: outcome.collection ? outcome.collection.utr : (row.utr ?? null),
          matched: outcome.matched,
          status: outcome.status,
        });
      }
    } catch (error) {
      failed.push({
        index,
        utr: row.utr ? String(row.utr).trim().toUpperCase() : null,
        error: error.message,
      });
    }
  }

  const summary = {
    total: list.length,
    successCount: successful.length,
    duplicateCount: duplicates.length,
    unmatchedCount,
    failureCount: failed.length,
    successful,
    duplicates,
    failed,
    dryRun: Boolean(dryRun),
  };

  if (!dryRun) {
    await writeAudit({
      action: AUDIT_ACTIONS.QR_COLLECTION_IMPORTED,
      resourceId: null,
      userId: actorUserId,
      details: {
        source,
        total: summary.total,
        successCount: summary.successCount,
        duplicateCount: summary.duplicateCount,
        unmatchedCount: summary.unmatchedCount,
        failureCount: summary.failureCount,
      },
    });
  }

  return summary;
}

/**
 * Dry-run of one row: validate, resolve, dedupe-check — WITHOUT WRITING.
 * This powers the admin "preview before import" screen, which is the only thing
 * standing between an operator and importing the wrong bank statement.
 * @private
 */
async function previewRow(row, { source, actorUserId }) {
  const normalized = normalizeInput({ ...row, source, actorUserId });

  const dedupeKey = buildDedupeKey({
    provider: normalized.provider,
    utr: normalized.utr,
    qrIdentifier: normalized.qrIdentifier,
    amountPaise: normalized.amountPaise,
    txnAt: normalized.txnAt,
    providerTxnId: normalized.providerTxnId,
  });

  const existing = await prisma.qrCollection.findUnique({
    where: { dedupeKey },
  });
  if (existing) {
    return {
      collection: existing,
      duplicate: true,
      matched: Boolean(existing.outletPaymentQrId),
      status: existing.status,
      qr: null,
    };
  }

  const candidate = await findQrCandidate({
    provider: normalized.provider,
    qrIdentifier: normalized.qrIdentifier,
    payerVpa: normalized.payerVpa,
  });
  const qr = candidate && candidate.isActive ? candidate : null;
  const matched = Boolean(qr);
  const status = matched && normalized.utr ? "ATTRIBUTED" : "UNATTRIBUTED";

  return {
    // A PROJECTION of what WOULD be written; it has no `id` because nothing was.
    collection: {
      id: null,
      utr: normalized.utr,
      amountPaise: normalized.amountPaise,
      qrIdentifier: normalized.qrIdentifier,
      dedupeKey,
      status,
    },
    duplicate: false,
    matched,
    status,
    qr,
  };
}

/* ------------------------------------------------------------------ *
 * Listing
 * ------------------------------------------------------------------ */

/**
 * @param {Object} query
 * @returns {{where: Object, filters: Object}}
 * @private
 */
function buildListWhere(query = {}, forced = {}) {
  const where = {};
  const status = forced.status || query.status || null;

  if (forced.where) Object.assign(where, forced.where);
  if (status) where.status = status;
  if (query.provider) where.provider = normalizeProvider(query.provider);
  if (query.source) where.source = query.source;
  if (query.qrIdentifier)
    where.qrIdentifier = String(query.qrIdentifier).trim();
  if (query.walletUserId)
    where.walletUserId = String(query.walletUserId).trim();
  if (query.utr) where.utr = normalizeUtr(query.utr);
  if (typeof query.needsManualAction === "boolean") {
    where.needsManualAction = query.needsManualAction;
  }

  if (query.startDate || query.endDate) {
    where.receivedAt = {};
    if (query.startDate) where.receivedAt.gte = new Date(query.startDate);
    if (query.endDate) where.receivedAt.lte = new Date(query.endDate);
  }

  return {
    where,
    filters: {
      status: status ?? null,
      provider: query.provider ? normalizeProvider(query.provider) : null,
      source: query.source ?? null,
      qrIdentifier: query.qrIdentifier ?? null,
      walletUserId: query.walletUserId ?? null,
      utr: query.utr ? normalizeUtr(query.utr) : null,
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    },
  };
}

/**
 * THE LIST ENVELOPE IS A HARD CONTRACT.
 *
 * The frontend's RTK Query slice unwraps `response.data`, so anything in `meta`
 * — exactly where `APIResponse.paginated()` puts pagination — is DISCARDED and
 * the table renders with no page count. Pagination therefore rides INSIDE the
 * payload, snake_case, with a 0-BASED `current_page`. Identical to
 * `manualTopupService.buildListEnvelope`. Do not "tidy" this into
 * `APIResponse.paginated()`.
 *
 * @private
 */
function buildListEnvelope(rows, total, page, size, filters) {
  const totalPages = size > 0 ? Math.ceil(total / size) : 0;

  return {
    data: rows.map(serializeCollection),
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
 * @param {Object} query
 * @param {Object} [forced] internal: `{status, where}` overrides
 * @returns {Promise<Object>} the list envelope
 * @private
 */
async function runList(query = {}, forced = {}) {
  const page = Math.max(0, Number(query.page ?? 0) || 0);
  const size = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.size ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
  );
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";

  const { where, filters } = buildListWhere(query, forced);

  const [total, rows] = await Promise.all([
    prisma.qrCollection.count({ where }),
    prisma.qrCollection.findMany({
      where,
      orderBy: { receivedAt: sortDir },
      skip: page * size,
      take: size,
    }),
  ]);

  return buildListEnvelope(rows, total, page, size, filters);
}

/**
 * List QR collections with filters + pagination.
 * @param {Object} [query] `{status, provider, source, qrIdentifier,
 *   walletUserId, utr, needsManualAction, startDate, endDate, page, size, sortDir}`
 * @returns {Promise<Object>} the list envelope
 */
async function listCollections(query = {}) {
  return runList(query);
}

/**
 * The OPS QUEUE: collections that arrived but cannot yet be credited.
 *
 * Status `UNATTRIBUTED` is the authoritative marker and is a superset of
 * `outletPaymentQrId IS NULL`: a UTR-less collection that DID match a QR is also
 * parked here on purpose (see the comment in `ingestCollection`), so filtering
 * on the null FK alone would let it slip out of the queue.
 *
 * @param {Object} [query] same filters as `listCollections`; `status` is forced
 * @returns {Promise<Object>} the list envelope
 */
async function listUnattributed(query = {}) {
  return runList(query, { status: "UNATTRIBUTED" });
}

/* ------------------------------------------------------------------ *
 * Serialization
 * ------------------------------------------------------------------ */

/**
 * API projection of a collection row.
 *
 * `rawPayload` IS DELIBERATELY WITHHELD: it is the provider's verbatim body,
 * can carry payer PII and provider-side identifiers, and is evidence for
 * reconciliation rather than something a list screen needs. It stays in the
 * database and in the audit trail.
 *
 * @param {?Object} row
 * @returns {?Object}
 */
function serializeCollection(row) {
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    source: row.source,
    status: row.status,
    utr: row.utr ?? null,
    dedupeKey: row.dedupeKey,
    providerTxnId: row.providerTxnId ?? null,
    qrIdentifier: row.qrIdentifier ?? null,
    payerVpa: row.payerVpa ?? null,
    payerName: row.payerName ?? null,
    amount: toNumber(row.amount),
    amountPaise: row.amountPaise,
    currency: row.currency,
    txnAt: row.txnAt ?? null,
    receivedAt: row.receivedAt,
    outletPaymentQrId: row.outletPaymentQrId ?? null,
    matched: Boolean(row.outletPaymentQrId),
    walletUserId: row.walletUserId ?? null,
    clientCode: row.clientCode ?? null,
    subjectUserId: row.subjectUserId ?? null,
    mode: row.mode ?? null,
    paymentOrderId: row.paymentOrderId ?? null,
    manualTopupRequestId: row.manualTopupRequestId ?? null,
    externalReferenceId: row.externalReferenceId ?? null,
    attributedBy: row.attributedBy ?? null,
    attributedAt: row.attributedAt ?? null,
    rejectedBy: row.rejectedBy ?? null,
    rejectedAt: row.rejectedAt ?? null,
    remarks: row.remarks ?? null,
    lastError: row.lastError ?? null,
    needsManualAction: Boolean(row.needsManualAction),
    metadata: row.metadata ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // rawPayload intentionally omitted — see the JSDoc above.
  };
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/**
 * Normalise + validate the ingestion input. Every rule lives here so webhook,
 * import, manual and poll all get the same treatment.
 * @private
 */
function normalizeInput(input) {
  const amountPaise = input.amountPaise;
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw validationError(
      "amountPaise must be a positive integer number of paise",
      "INVALID_AMOUNT",
      { amountPaise },
    );
  }

  const currency = String(input.currency || DEFAULT_CURRENCY).toUpperCase();
  if (currency !== DEFAULT_CURRENCY) {
    throw validationError(
      "Only INR static-QR collections are supported",
      "INVALID_CURRENCY",
      { currency },
    );
  }

  const source = input.source || "WEBHOOK";
  if (!["WEBHOOK", "IMPORT", "MANUAL", "POLL"].includes(source)) {
    throw validationError("Unknown collection source", "INVALID_SOURCE", {
      source,
    });
  }

  return {
    provider: normalizeProvider(input.provider),
    source,
    utr: normalizeUtr(input.utr),
    providerTxnId: trimOrNull(input.providerTxnId),
    qrIdentifier: trimOrNull(input.qrIdentifier),
    payerVpa: trimOrNull(input.payerVpa),
    payerName: trimOrNull(input.payerName),
    amountPaise,
    currency,
    txnAt: toDateOrNull(input.txnAt),
    rawPayload: input.rawPayload ?? null,
    actorUserId: isUuid(input.actorUserId) ? input.actorUserId : null,
    metadata:
      input.metadata && typeof input.metadata === "object"
        ? input.metadata
        : null,
    onAttributed: input.onAttributed,
  };
}

/** @private */
function buildMetadata(normalized, { matchedInactiveQrId, utrless }) {
  const meta = { ...(normalized.metadata || {}) };
  if (matchedInactiveQrId) {
    // Surfaced, never acted on: "this looks like outlet X's RETIRED QR".
    meta.matchedInactiveQrId = matchedInactiveQrId;
  }
  if (utrless) meta.forcedManualReason = "NO_UTR";
  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * Re-read the row a P2002 collided with — by dedupeKey, or by the
 * `(provider, utr)` partial unique when that was the constraint that fired.
 * @private
 */
async function findExisting(dedupeKey, normalized) {
  const byKey = await prisma.qrCollection.findUnique({ where: { dedupeKey } });
  if (byKey) return byKey;

  if (normalized.utr) {
    return prisma.qrCollection.findFirst({
      where: { provider: normalized.provider, utr: normalized.utr },
      orderBy: { createdAt: "asc" },
    });
  }
  return null;
}

/** @private */
function isUniqueViolation(error) {
  return Boolean(error) && error.code === "P2002";
}

/**
 * Standalone audit write. The state change has already committed by the time we
 * get here, so a failing audit insert is logged loudly rather than allowed to
 * roll back an ingestion — losing the record of money that arrived would be
 * strictly worse than losing its audit line.
 * @private
 */
async function writeAudit({ action, resourceId, userId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        // AuditLog.userId is @db.Uuid — only a LOCAL portal uuid may go here.
        // `walletUserId` is a phone number and belongs in `details`.
        userId: isUuid(userId) ? userId : null,
        action,
        resource: AUDIT_RESOURCE,
        resourceId: isUuid(resourceId) ? resourceId : null,
        details: details || {},
      },
    });
  } catch (error) {
    logger.error("AUDIT WRITE FAILED for QR collection", {
      action,
      resourceId,
      error: error.message,
    });
  }
}

/** @private */
function validationError(message, code, details) {
  const err = new ValidationError(message, details || null);
  err.code = code;
  return err;
}

/** @private */
function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** @private */
function normalizeProvider(provider) {
  return typeof provider === "string" && provider.trim()
    ? provider.trim()
    : DEFAULT_PROVIDER;
}

/**
 * UTRs are printed on statements in mixed case and pasted with stray spaces;
 * upper-casing + trimming is what makes the webhook copy and the CSV copy
 * hash to the SAME dedupe key.
 * @private
 */
function normalizeUtr(utr) {
  if (typeof utr !== "string") return null;
  const trimmed = utr.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** @private */
function trimOrNull(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** @private */
function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** @private */
function truncateToSecond(value) {
  const date = toDateOrNull(value);
  if (!date) return "";
  return new Date(Math.floor(date.getTime() / 1000) * 1000).toISOString();
}

/**
 * Integer paise -> a Decimal-safe rupee STRING. Prisma accepts a string for
 * `Decimal`, so the value never passes through a JS float and can never land a
 * paisa off the way `paise / 100` can.
 * @private
 */
function paiseToAmountString(amountPaise) {
  const sign = amountPaise < 0 ? "-" : "";
  const abs = Math.abs(amountPaise);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** @private */
function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** @private */
function truncate(value, max) {
  const str = String(value);
  return str.length > max ? str.slice(0, max) : str;
}

/** @private */
function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

module.exports = {
  // Wave-3 seam
  setCreditHandler,
  getCreditHandler,
  // Ingestion
  buildDedupeKey,
  resolveQr,
  ingestCollection,
  importCollections,
  // Listing
  listCollections,
  listUnattributed,
  serializeCollection,
  // Constants
  AUDIT_ACTIONS,
  AUDIT_RESOURCE,
  DEFAULT_PROVIDER,
};
