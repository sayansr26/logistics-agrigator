/**
 * CCAvenue Static UPI QR — PaymentProvider implementation (collection only).
 *
 * This provider exists so the static-QR channel can reuse the SAME registry,
 * config resolution and webhook discipline as the checkout gateway, without
 * pretending to be a checkout gateway. It collects money that has ALREADY
 * arrived; it can never create an order, a link or a refund.
 *
 *   name     = "ccavenue_upi_qr"
 *   supports = { orders: false, paymentLinks: false, refunds: false }
 *
 * Every order/link/refund function therefore throws
 * `APIError(..., 400, "PROVIDER_OPERATION_UNSUPPORTED")` rather than returning a
 * plausible-looking empty result. `assertContract` in providerRegistry.js
 * requires all ten functions to EXIST; it does not require them to work, and a
 * loud throw at the call site is the only honest implementation of an operation
 * this channel does not have.
 *
 * ============================= THE BIG CAVEAT =============================
 * ⚠️ THE STATIC-QR NOTIFICATION PAYLOAD IS UNDOCUMENTED.
 *
 * CCAvenue's published merchant kit documents the REDIRECT (`encResp`) response
 * for the checkout gateway. The server-to-server notification for a static UPI
 * QR collection is issued per-merchant and we have not seen a real one. Every
 * field mapping below is therefore a best guess drawn from the checkout
 * response's vocabulary and is marked `TODO(ccavenue-kit)`.
 *
 * The design rule that makes that guessing SAFE:
 *   AN UNRECOGNISED SHAPE YIELDS `outcome: "IGNORED"`, NEVER A GUESS.
 * A payload we cannot read is recorded (the webhook event row is written either
 * way) and left for a human. It is never turned into a wallet credit on the
 * strength of a field name we invented. Getting `outcome` wrong in the
 * permissive direction credits real money against a payload we do not
 * understand; getting it wrong in the conservative direction leaves a row in an
 * ops queue. Only one of those is recoverable.
 *
 * PURITY: `verifyWebhookSignature` and `parseQrNotification` are SYNC and do no
 * I/O. Secrets arrive as an already-resolved config object (see
 * providerRegistry.js's contract rule) and are never logged.
 *
 * @module services/payments/ccavenueQrProvider
 */

const crypto = require("crypto");

const logger = require("../../shared/lib/logger");
const { APIError } = require("../../shared/lib/errors");

const {
  decryptFromHex,
  parseParamString,
  parseAmountToPaise,
  scrubSensitiveFields,
  isHex,
} = require("./ccavenueCrypto");

const PROVIDER_NAME = "ccavenue_upi_qr";
const DEFAULT_CURRENCY = "INR";

/**
 * Body keys that may carry the AES-hex envelope.
 * `encResp` is the checkout gateway's key; the others are defensive variants.
 * TODO(ccavenue-kit): confirm which key the QR notification actually uses and
 * delete the rest — a shorter list is a stronger fail-closed check.
 */
const ENVELOPE_KEYS = Object.freeze([
  "enc_response",
  "encResp",
  "encResponse",
  "encData",
  "encrypted_data",
]);

/**
 * Header that would carry a detached shared-secret HMAC, if CCAvenue ever
 * sends one for this channel. WIRED BUT DORMANT: the credential descriptor has
 * no `webhookHmacSecret` field today, so `resolveSharedSecret` always returns
 * null and this strategy never fires. It is present so that turning it on is a
 * descriptor change plus a config write, not a re-think of this file.
 * TODO(ccavenue-kit): confirm whether a detached signature header exists.
 */
const HMAC_HEADERS = Object.freeze([
  "x-ccavenue-signature",
  "x-ccav-signature",
  "x-qr-signature",
]);

/* ------------------------------------------------------------------ *
 * Status vocabulary
 * ------------------------------------------------------------------ */

/**
 * Statuses that mean "money landed in the merchant account".
 * TODO(ccavenue-kit): confirm the exact status strings the QR notification
 * uses. The checkout gateway sends "Success"; a collection feed may well send
 * "CREDIT" / "COLLECTED" / "SUCCESS" instead.
 */
const COLLECTED_STATUSES = new Set([
  "success",
  "successful",
  "collected",
  "credit",
  "credited",
  "captured",
  "paid",
  "completed",
]);

/**
 * Statuses that mean the credit was pulled back.
 * A REVERSAL IS NEVER AUTO-DEBITED (see qrWebhookService) — by the time we hear
 * about it the balance may already be spent. It is flagged for an admin.
 * TODO(ccavenue-kit): confirm the reversal / chargeback status vocabulary.
 */
const REVERSED_STATUSES = new Set([
  "reversed",
  "reversal",
  "refunded",
  "refund",
  "chargeback",
  "returned",
  "debit_reversal",
]);

/** Keys that may carry the transaction status. TODO(ccavenue-kit): confirm. */
const STATUS_KEYS = Object.freeze([
  "order_status",
  "txn_status",
  "transaction_status",
  "status",
  "payment_status",
]);

/** Keys that may carry the bank UTR. TODO(ccavenue-kit): confirm. */
const UTR_KEYS = Object.freeze([
  "bank_ref_no",
  "bankRefNo",
  "utr",
  "upi_utr",
  "rrn",
  "customer_ref_no",
]);

/** Keys that may carry CCAvenue's own transaction id. TODO(ccavenue-kit): confirm. */
const TXN_ID_KEYS = Object.freeze([
  "tracking_id",
  "trackingId",
  "reference_no",
  "txn_id",
  "transaction_id",
  "order_id",
]);

/**
 * Keys that may identify WHICH static QR was scanned. THE MOST IMPORTANT
 * MAPPING IN THIS FILE: it is the attribution key, and getting it wrong routes
 * money to the wrong outlet's wallet. `qrCollectionService.resolveQr` never
 * guesses, so a wrong-but-unknown identifier lands in the unattributed queue
 * (safe); a wrong-but-COLLIDING identifier would not (not safe).
 * TODO(ccavenue-kit): confirm the QR identifier field name and, critically,
 * that its value matches what we store in `OutletPaymentQr.qrIdentifier` at
 * provisioning time.
 */
const QR_IDENTIFIER_KEYS = Object.freeze([
  "qr_code_id",
  "qrCodeId",
  "qr_identifier",
  "merchant_param1",
  "sub_merchant_id",
  "sub_account_id",
]);

/** Keys that may carry the payer's VPA (the fallback attribution key). TODO(ccavenue-kit). */
const VPA_KEYS = Object.freeze([
  "payer_vpa",
  "customer_vpa",
  "payer_va",
  "upi_va",
  "vpa",
  "payee_vpa",
]);

/** Keys that may carry the payer's name (display only, never trusted). TODO(ccavenue-kit). */
const PAYER_NAME_KEYS = Object.freeze([
  "payer_name",
  "customer_name",
  "billing_name",
  "payerName",
]);

/** Keys that may carry the rupee amount string. TODO(ccavenue-kit). */
const AMOUNT_KEYS = Object.freeze([
  "amount",
  "mer_amount",
  "txn_amount",
  "transaction_amount",
  "gross_amount",
]);

/** Keys that may carry the transaction timestamp. TODO(ccavenue-kit). */
const TXN_AT_KEYS = Object.freeze([
  "trans_date",
  "txn_date",
  "transaction_date",
  "payment_date",
  "created_at",
]);

/** Keys that may carry the currency. TODO(ccavenue-kit). */
const CURRENCY_KEYS = Object.freeze(["currency", "txn_currency"]);

/* ------------------------------------------------------------------ *
 * Unsupported operations
 * ------------------------------------------------------------------ */

/**
 * The single throw used by every operation this channel does not have.
 *
 * NOT a silent no-op and NOT a fabricated empty result: a caller that reaches
 * one of these has confused the collection channel with the checkout gateway,
 * and the only useful outcome is a loud, typed 400 at the call site.
 *
 * @private
 * @param {string} operation
 * @returns {never}
 */
function unsupported(operation) {
  throw new APIError(
    `Provider "${PROVIDER_NAME}" does not support ${operation} — it is a static-QR COLLECTION channel. Use the checkout gateway provider for ${operation}.`,
    400,
    "PROVIDER_OPERATION_UNSUPPORTED",
  );
}

/* eslint-disable no-unused-vars */
async function createOrder(_options) {
  return unsupported("createOrder");
}

async function createPaymentLink(_options) {
  return unsupported("createPaymentLink");
}

async function cancelPaymentLink(_options) {
  return unsupported("cancelPaymentLink");
}

async function fetchPayment(_options) {
  return unsupported("fetchPayment");
}

async function fetchOrder(_options) {
  return unsupported("fetchOrder");
}

async function fetchPaymentLink(_options) {
  return unsupported("fetchPaymentLink");
}
/* eslint-enable no-unused-vars */

/**
 * There is no browser redirect for a static QR — nobody ever returns from a
 * checkout page — so there is no client signature to verify.
 *
 * This one does NOT throw, unlike its siblings: the contract declares it a SYNC
 * BOOLEAN, and a function whose return value gates authentication must fail
 * CLOSED rather than raise. A throw here could be caught somewhere upstream and
 * mistaken for "not applicable, carry on".
 *
 * @returns {false} always
 */
function verifyClientSignature() {
  logger.warn(
    "verifyClientSignature called on the static-QR collection provider — there is no redirect flow here; returning false (fail-closed)",
    { provider: PROVIDER_NAME },
  );
  return false;
}

/**
 * Credential sanity check.
 *
 * CCAvenue exposes NO ping/echo endpoint for the QR collection account, so this
 * cannot prove the credentials work — only that all three are present and
 * shaped plausibly. It is deliberately honest about that in `message` rather
 * than reporting a green tick nobody should trust.
 *
 * TODO(ccavenue-kit): if the merchant kit ships a QR status/enquiry endpoint,
 * call it here so this becomes a real connectivity test.
 *
 * @param {{config: Object}} options
 * @returns {Promise<{ok: boolean, message: string, accountHint?: string, latencyMs?: number}>}
 */
async function testConnection({ config } = {}) {
  const started = Date.now();
  const credentials = (config && config.credentials) || {};

  const missing = ["merchantId", "accessCode", "workingKey"].filter(
    (field) => !credentials[field],
  );

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing ${PROVIDER_NAME} credentials: ${missing.join(", ")}`,
      latencyMs: Date.now() - started,
    };
  }

  return {
    ok: true,
    message:
      "Credentials are present and well-formed. NOTE: CCAvenue exposes no enquiry endpoint for the static-QR channel, so this is a local check only — it does not prove the working key is accepted by the gateway. The first real notification is the true test.",
    accountHint: String(credentials.merchantId).slice(0, 6),
    latencyMs: Date.now() - started,
  };
}

/* ------------------------------------------------------------------ *
 * Webhook authentication
 * ------------------------------------------------------------------ */

/**
 * Authenticate one inbound static-QR notification. SYNC, FAIL-CLOSED.
 *
 * Ordered strategies, identical in spirit to the checkout gateway provider:
 *
 *   1. DECRYPTION IS AUTHENTICATION. If the body carries an AES-hex envelope
 *      that decrypts to a well-formed `k=v&k=v` string under this mode's
 *      working key, the delivery could only have been produced by the holder of
 *      that key. This is the strongest signal available for a provider that
 *      sends no detached signature, and it is exactly the reasoning
 *      `webhookService.decryptFirstVerification` already applies to the
 *      checkout gateway.
 *   2. DETACHED SHARED-SECRET HMAC (wired, dormant — see HMAC_HEADERS).
 *   3. OTHERWISE FALSE, with an `logger.error` naming the key set we did not
 *      recognise. That log line is the whole debugging story for the first real
 *      delivery during dashboard bring-up, so it names KEYS — never values,
 *      never the ciphertext, never the secret.
 *
 * `parsedBody` is accepted in addition to the contract's `{config, rawBody,
 * headers}` because CCAvenue posts form-urlencoded bodies that Express has
 * usually already parsed; the extra key is ignored by any caller that does not
 * pass it.
 *
 * @param {Object} options
 * @param {Object} options.config - resolved config; `webhookSecret` is the working key
 * @param {Buffer|string} [options.rawBody]
 * @param {Object} [options.parsedBody]
 * @param {Object} [options.headers]
 * @returns {boolean}
 */
function verifyWebhookSignature({ config, rawBody, parsedBody, headers } = {}) {
  try {
    const workingKey = config && config.webhookSecret;

    if (typeof workingKey !== "string" || workingKey.length === 0) {
      logger.warn(
        "CCAvenue QR working key is not configured for this mode — cannot authenticate",
        { provider: PROVIDER_NAME, mode: config && config.mode },
      );
      return false;
    }

    // ---- Strategy 1: decryption IS authentication ------------------------
    const envelope = extractEnvelope({ rawBody, parsedBody });
    if (envelope) {
      const fields = tryDecrypt(envelope, workingKey);
      if (fields && Object.keys(fields).length > 0) {
        return true;
      }
      // Fall through: an envelope that will not open under this mode's key is
      // not proof of forgery — it may simply be the OTHER mode's key. The
      // caller tries both before rejecting.
    }

    // ---- Strategy 2: detached shared-secret HMAC (dormant) ----------------
    const sharedSecret = resolveSharedSecret(config);
    const signature = headerValue(headers, HMAC_HEADERS);
    if (sharedSecret && signature && hasBytes(rawBody)) {
      if (safeCompareHmac(rawBody, sharedSecret, signature)) {
        return true;
      }
      logger.warn("CCAvenue QR detached HMAC did not match", {
        provider: PROVIDER_NAME,
        mode: config.mode,
      });
      return false;
    }

    // ---- Strategy 3: fail closed ------------------------------------------
    logger.error(
      "CCAvenue QR notification could not be authenticated — no decryptable envelope and no recognised signature header. This is the payload shape we need in order to finish the static-QR implementation: capture it from the webhook event row.",
      {
        provider: PROVIDER_NAME,
        mode: config.mode,
        bodyKeys: describeKeys(parsedBody),
        headerKeys: describeKeys(headers),
        rawBodyBytes: byteLength(rawBody),
        hadEnvelope: Boolean(envelope),
      },
    );
    return false;
  } catch (error) {
    // A throw inside an authentication check is a rejection, never a pass.
    logger.error(
      "CCAvenue QR signature verification errored — failing closed",
      {
        provider: PROVIDER_NAME,
        error: error.message,
      },
    );
    return false;
  }
}

/**
 * Open the AES envelope with one mode's working key and return the decoded
 * fields, or null if it will not open / does not decode to a parameter string.
 *
 * Deliberately NOT named `decryptEnvelope`: `webhookService.handleWebhook`
 * branches on the presence of a `decryptEnvelope` function, and a static-QR
 * notification must never be routed through the order-first webhook path.
 *
 * @param {Object} options
 * @param {Object} options.config
 * @param {Buffer|string} [options.rawBody]
 * @param {Object} [options.parsedBody]
 * @returns {?Object<string,string>} decoded fields, or null
 */
function decryptQrEnvelope({ config, rawBody, parsedBody } = {}) {
  const workingKey = config && config.webhookSecret;
  if (typeof workingKey !== "string" || workingKey.length === 0) return null;

  const envelope = extractEnvelope({ rawBody, parsedBody });
  if (!envelope) return null;

  const fields = tryDecrypt(envelope, workingKey);
  return fields && Object.keys(fields).length > 0 ? fields : null;
}

/* ------------------------------------------------------------------ *
 * Notification parsing
 * ------------------------------------------------------------------ */

/**
 * Normalise one static-QR notification into the shape `qrWebhookService` and
 * `qrCollectionService.ingestCollection` consume.
 *
 * SYNC. NEVER THROWS. An unusable payload yields the fully-nulled
 * `outcome: "IGNORED"` shape — see THE BIG CAVEAT in the module header.
 *
 * @param {Object} options
 * @param {Buffer|string} [options.rawBody]
 * @param {Object} [options.parsedBody]
 * @param {Object} [options.headers]
 * @param {Object} [options.decrypted] - fields from `decryptQrEnvelope`
 * @returns {{providerEventId: ?string, eventType: ?string,
 *   outcome: "COLLECTED"|"REVERSED"|"IGNORED", utr: ?string,
 *   providerTxnId: ?string, qrIdentifier: ?string, payerVpa: ?string,
 *   payerName: ?string, amountPaise: ?number, currency: ?string,
 *   txnAt: ?string, raw: Object}}
 */
function parseQrNotification({ rawBody, parsedBody, decrypted } = {}) {
  try {
    const fields = selectFields({ rawBody, parsedBody, decrypted });

    if (!fields || Object.keys(fields).length === 0) {
      return ignoredNotification(null, {});
    }

    const raw = scrubSensitiveFields(fields);

    const utr = pickString(fields, UTR_KEYS);
    const providerTxnId = pickString(fields, TXN_ID_KEYS);
    const qrIdentifier = pickString(fields, QR_IDENTIFIER_KEYS);
    const payerVpa = pickString(fields, VPA_KEYS);
    const payerName = pickString(fields, PAYER_NAME_KEYS);
    const statusText = pickString(fields, STATUS_KEYS);
    const currency = pickString(fields, CURRENCY_KEYS) || DEFAULT_CURRENCY;
    const txnAt = toIsoOrNull(pickString(fields, TXN_AT_KEYS));

    const amountRaw = pickString(fields, AMOUNT_KEYS);
    const amountPaise =
      amountRaw === null ? null : parseAmountToPaise(amountRaw);

    // `providerEventId` MUST be deterministic. It is the replay guard's key
    // (`@@unique([provider, providerEventId])`), so anything time- or
    // random-based would make every redelivery look like a brand-new event and
    // defeat the guard entirely.
    const providerEventId = buildProviderEventId(utr, raw);

    const outcome = resolveOutcome(statusText, amountPaise);

    if (outcome === "IGNORED") {
      logger.warn(
        "CCAvenue QR notification did not map to a known outcome — recorded and IGNORED rather than guessed",
        {
          provider: PROVIDER_NAME,
          statusText,
          hadAmount: amountPaise !== null,
          bodyKeys: Object.keys(raw).slice(0, 40),
        },
      );
      return ignoredNotification(providerEventId, raw, statusText);
    }

    return {
      providerEventId,
      eventType: statusText
        ? `qr.${statusText.toLowerCase()}`
        : "qr.collection",
      outcome,
      utr,
      providerTxnId,
      qrIdentifier,
      payerVpa,
      payerName,
      amountPaise,
      currency,
      txnAt,
      raw,
    };
  } catch (error) {
    // "Never throws" is a hard contract: this parser runs on input we do not
    // control, and the caller must be able to park an unusable payload rather
    // than have the request blow up.
    logger.error("CCAvenue QR notification parse threw — treating as IGNORED", {
      provider: PROVIDER_NAME,
      error: error.message,
    });
    return ignoredNotification(null, {});
  }
}

/**
 * The contract-required parser.
 *
 * ALWAYS maps to `outcome: "IGNORED"`, on purpose. `webhookService.handleWebhook`
 * routes on this outcome and its "PAID" branch does an ORDER lookup and, failing
 * that, `adoptOrphanPayment` — a path that would try to reconstruct an order
 * from gateway notes a QR collection does not have. A static-QR payment must
 * only ever enter through `qrWebhookService` -> `ingestCollection`, so this
 * function's job is to make the order-first router a guaranteed no-op while
 * still surfacing a stable `providerEventId` for the replay guard and forensics.
 *
 * @param {Object} options - same shape as parseQrNotification
 * @returns {Object} the webhookService-shaped event, always IGNORED
 */
function parseWebhookEvent(options = {}) {
  const qr = parseQrNotification(options);

  return {
    providerEventId: qr.providerEventId,
    eventType: qr.eventType || "qr.collection",
    outcome: "IGNORED",
    providerOrderId: null,
    providerLinkId: null,
    providerPaymentId: null,
    amountPaise: null,
    currency: null,
    errorCode: null,
    errorDescription: null,
    raw: qr.raw || {},
    // Breadcrumb for anyone reading a webhook event row and wondering why a
    // real collection shows as IGNORED here.
    qrOutcome: qr.outcome,
  };
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

/**
 * Decide which flat field map represents the notification.
 * Order: explicit `decrypted` > a plaintext parsed body > a plaintext raw body.
 * A body that carries ONLY an envelope with no `decrypted` yields `{}` — we
 * refuse to read an unopened envelope.
 * @private
 */
function selectFields({ rawBody, parsedBody, decrypted }) {
  if (isPlainObject(decrypted) && Object.keys(decrypted).length > 0) {
    return flattenScalars(decrypted);
  }

  if (isPlainObject(parsedBody)) {
    const flat = flattenScalars(parsedBody);
    const withoutEnvelope = withoutEnvelopeKeys(flat);
    if (Object.keys(withoutEnvelope).length > 0) return withoutEnvelope;
  }

  const text = bodyText(rawBody);
  if (text) {
    // JSON first (a modern feed), then CCAvenue's own `k=v&k=v`.
    const asJson = tryJson(text);
    if (isPlainObject(asJson)) {
      const flat = withoutEnvelopeKeys(flattenScalars(asJson));
      if (Object.keys(flat).length > 0) return flat;
    }

    const asParams = withoutEnvelopeKeys(parseParamString(text));
    if (Object.keys(asParams).length > 0) return asParams;
  }

  return {};
}

/**
 * Pull the AES-hex envelope out of wherever it might be hiding.
 * @private
 * @returns {?string} lowercase-hex ciphertext, or null
 */
function extractEnvelope({ rawBody, parsedBody }) {
  if (isPlainObject(parsedBody)) {
    const found = pickString(flattenScalars(parsedBody), ENVELOPE_KEYS);
    if (found && isHex(found)) return found;
  }

  const text = bodyText(rawBody);
  if (!text) return null;

  const asJson = tryJson(text);
  if (isPlainObject(asJson)) {
    const found = pickString(flattenScalars(asJson), ENVELOPE_KEYS);
    if (found && isHex(found)) return found;
  }

  const params = parseParamString(text);
  const fromParams = pickString(params, ENVELOPE_KEYS);
  if (fromParams && isHex(fromParams)) return fromParams;

  // A body that is nothing but hex is the envelope.
  const trimmed = text.trim();
  if (isHex(trimmed)) return trimmed;

  return null;
}

/**
 * Decrypt + decode, swallowing the "wrong key" case.
 * `decryptFromHex` throws a content-free APIError on a bad key by design; here
 * that simply means "not this mode", so it must not escape.
 * @private
 * @returns {?Object<string,string>}
 */
function tryDecrypt(envelope, workingKey) {
  let plain;
  try {
    plain = decryptFromHex(envelope, workingKey);
  } catch (_error) {
    return null;
  }

  const fields = parseParamString(plain);
  return Object.keys(fields).length > 0 ? fields : null;
}

/**
 * Map the provider's status vocabulary onto our three outcomes.
 * ANYTHING UNRECOGNISED IS "IGNORED" — the whole safety property of this file.
 * @private
 */
function resolveOutcome(statusText, amountPaise) {
  if (!statusText) return "IGNORED";

  const key = statusText
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (REVERSED_STATUSES.has(key)) return "REVERSED";

  if (COLLECTED_STATUSES.has(key)) {
    // A collection with no usable amount is not a collection we can act on.
    // `ingestCollection` would reject it anyway; refusing here keeps the
    // rejection in the pure layer where it costs nothing.
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) return "IGNORED";
    return "COLLECTED";
  }

  return "IGNORED";
}

/**
 * The replay-guard key. DETERMINISTIC BY CONSTRUCTION:
 *  - with a UTR: the bank's own globally-unique reference for the transfer;
 *  - without one: a sha256 over the payload's own stable serialisation, so the
 *    same bytes always produce the same id.
 * Never `Date.now()`, never a random suffix — see the note in
 * `parseQrNotification`.
 * @private
 */
function buildProviderEventId(utr, raw) {
  if (utr) return `qr:utr:${utr}`;

  const material = stableStringify(raw);
  if (!material || material === "{}") return null;

  return `qr:h:${crypto.createHash("sha256").update(material).digest("hex")}`;
}

/** The fully-nulled shape. @private */
function ignoredNotification(providerEventId, raw, statusText) {
  return {
    providerEventId: providerEventId || null,
    eventType: statusText ? `qr.${String(statusText).toLowerCase()}` : null,
    outcome: "IGNORED",
    utr: null,
    providerTxnId: null,
    qrIdentifier: null,
    payerVpa: null,
    payerName: null,
    amountPaise: null,
    currency: null,
    txnAt: null,
    raw: raw || {},
  };
}

/**
 * The dormant shared secret for strategy 2. Returns null until a
 * `webhookHmacSecret` credential exists in the descriptor.
 * @private
 */
function resolveSharedSecret(config) {
  const credentials = (config && config.credentials) || {};
  const candidate = credentials.webhookHmacSecret;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

/** Timing-safe HMAC-SHA256 compare over the exact bytes. @private */
function safeCompareHmac(rawBody, secret, signature) {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8"))
      .digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(signature).trim().toLowerCase(), "utf8");

    // timingSafeEqual throws on a length mismatch; a length mismatch is already
    // a definitive "no match", so short-circuiting it leaks nothing.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_error) {
    return false;
  }
}

/** @private */
function headerValue(headers, names) {
  if (!headers || typeof headers !== "object") return null;

  const lowered = {};
  for (const [key, value] of Object.entries(headers)) {
    lowered[String(key).toLowerCase()] = value;
  }

  for (const name of names) {
    const value = lowered[name];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/** First non-empty string value among `keys`. @private */
function pickString(fields, keys) {
  if (!isPlainObject(fields)) return null;

  const lowered = {};
  for (const [key, value] of Object.entries(fields)) {
    lowered[String(key).toLowerCase()] = value;
  }

  for (const key of keys) {
    const value = lowered[String(key).toLowerCase()];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

/** Keep only scalar leaves — a nested object is never a CCAvenue field. @private */
function flattenScalars(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
}

/** @private */
function withoutEnvelopeKeys(fields) {
  const envelopeSet = new Set(ENVELOPE_KEYS.map((k) => k.toLowerCase()));
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (envelopeSet.has(String(key).toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

/** @private */
function bodyText(rawBody) {
  if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");
  if (typeof rawBody === "string") return rawBody;
  return null;
}

/** @private */
function tryJson(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return null;
  }
}

/**
 * Deterministic serialisation for the hash-based event id: keys sorted, so two
 * deliveries of the same payload with a different key order still collide in
 * the replay guard.
 * @private
 */
function stableStringify(obj) {
  if (!isPlainObject(obj)) return "";
  const keys = Object.keys(obj).sort();
  return JSON.stringify(keys.map((k) => [k, String(obj[k])]));
}

/**
 * ISO string or null. A timestamp we cannot read is NOT a reason to drop a
 * payment — `txnAt` is informational; the UTR is the identity.
 * TODO(ccavenue-kit): confirm the timestamp format. CCAvenue's checkout
 * response uses "DD/MM/YYYY HH:MM:SS", which `Date.parse` reads as US
 * MM/DD — the explicit branch below exists for exactly that trap.
 * @private
 */
function toIsoOrNull(value) {
  if (!value) return null;

  const dmy =
    /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (dmy) {
    const [, dd, mm, yyyy, hh, mi, ss] = dmy;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss || "00"}.000Z`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Key names only — values may be PII or ciphertext. @private */
function describeKeys(obj) {
  if (!isPlainObject(obj)) return [];
  return Object.keys(obj).slice(0, 40);
}

/** @private */
function byteLength(rawBody) {
  if (Buffer.isBuffer(rawBody)) return rawBody.length;
  if (typeof rawBody === "string") return Buffer.byteLength(rawBody, "utf8");
  return 0;
}

/** @private */
function hasBytes(rawBody) {
  return byteLength(rawBody) > 0;
}

/** @private */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  name: PROVIDER_NAME,
  supports: { orders: false, paymentLinks: false, refunds: false },

  // Unsupported by design — all throw PROVIDER_OPERATION_UNSUPPORTED.
  createOrder,
  createPaymentLink,
  cancelPaymentLink,
  fetchPayment,
  fetchOrder,
  fetchPaymentLink,

  // Sync, fail-closed.
  verifyClientSignature,
  verifyWebhookSignature,
  parseWebhookEvent,

  testConnection,

  // Static-QR specifics (outside the base contract).
  parseQrNotification,
  decryptQrEnvelope,

  // Exported for tests / future kit confirmation.
  COLLECTED_STATUSES,
  REVERSED_STATUSES,
  ENVELOPE_KEYS,
};
