/**
 * Razorpay Payment Provider
 *
 * Implements the PaymentProvider contract documented in ./providerRegistry.js
 * for Razorpay (Orders API, Payment Links API, Webhooks).
 *
 * CONTRACT RULES honoured here:
 *  - STATELESS: never touches the database, never reads process.env. Every
 *    function receives a RESOLVED PLAIN CONFIG object
 *    `{ provider, mode, keyId, keySecret, webhookSecret, currency, ... }`
 *    already decrypted and mode-selected by the caller (config service).
 *  - INTEGER PAISE ONLY: Razorpay speaks integer minor units. Float rupees are
 *    rejected at the door — a silent 100x error here is real money.
 *  - NO SECRET LOGGING: key secrets, webhook secrets and card payloads never
 *    reach the logger. Only ids, event types and error codes do.
 *
 * @typedef {import("./providerRegistry").ResolvedProviderConfig} ResolvedProviderConfig
 */

const crypto = require("crypto");
const Razorpay = require("razorpay");

const { APIError } = require("../../shared/lib/errors");
const logger = require("../../shared/lib/logger");

const PROVIDER_NAME = "razorpay";
const DEFAULT_CURRENCY = "INR";
const WEBHOOK_SIGNATURE_HEADER = "x-razorpay-signature";
const WEBHOOK_EVENT_ID_HEADER = "x-razorpay-event-id";

/** Normalised webhook outcomes consumed by the webhook service. */
const OUTCOME = Object.freeze({
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED",
  IGNORED: "IGNORED",
});

/**
 * eventType -> outcome.
 *
 * `order.paid` is deliberately IGNORED: Razorpay fires BOTH `order.paid` and
 * `payment.captured` for the same rupees. We credit the wallet on
 * `payment.captured` ONLY, so the same money can never be handled twice.
 * `payment_link.cancelled` is IGNORED too — an admin cancelling a link is a
 * lifecycle event, not a money movement.
 */
const EVENT_OUTCOMES = Object.freeze({
  "payment.captured": OUTCOME.PAID,
  "payment.failed": OUTCOME.FAILED,
  "payment_link.paid": OUTCOME.PAID,
  "payment_link.expired": OUTCOME.EXPIRED,
  "payment_link.cancelled": OUTCOME.IGNORED,
  "refund.created": OUTCOME.REFUNDED,
  "refund.processed": OUTCOME.REFUNDED,
  "order.paid": OUTCOME.IGNORED,
});

/* ------------------------------------------------------------------ *
 * SDK instance cache
 * ------------------------------------------------------------------ */

/**
 * Memoised Razorpay SDK instances, keyed by keyId.
 *
 * The SDK instance is a thin auth-carrying HTTP wrapper, so rebuilding it on
 * every call is pure waste — but it also PINS the credentials it was built
 * with. The config service MUST call `resetInstanceCache(keyId)` whenever a
 * key/secret is rotated or a config is switched between TEST and LIVE,
 * otherwise stale credentials keep being used until process restart.
 *
 * @type {Map<string, InstanceType<typeof Razorpay>>}
 */
const instanceCache = new Map();

/**
 * Build (or reuse) an SDK instance for a resolved config.
 *
 * @param {ResolvedProviderConfig} config
 * @returns {InstanceType<typeof Razorpay>}
 * @throws {APIError} PROVIDER_CONFIG_INVALID
 */
function getInstance(config) {
  const { keyId, keySecret } = requireCredentials(config);

  const cached = instanceCache.get(keyId);
  if (cached) return cached;

  let instance;
  try {
    instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (error) {
    throw new APIError(
      `Failed to initialise Razorpay client: ${error.message}`,
      500,
      "PROVIDER_INIT_FAILED",
    );
  }

  instanceCache.set(keyId, instance);
  return instance;
}

/**
 * Drop cached SDK instance(s). Call on ANY credential change.
 *
 * @param {string} [keyId] - when omitted, clears the whole cache
 * @returns {number} number of cached instances dropped
 */
function resetInstanceCache(keyId) {
  if (typeof keyId === "string" && keyId.length > 0) {
    const dropped = instanceCache.delete(keyId) ? 1 : 0;
    if (dropped) {
      logger.info("Razorpay SDK instance cache invalidated", {
        provider: PROVIDER_NAME,
        keyIdHint: keyIdHint(keyId),
      });
    }
    return dropped;
  }

  const size = instanceCache.size;
  instanceCache.clear();
  if (size > 0) {
    logger.info("Razorpay SDK instance cache cleared", {
      provider: PROVIDER_NAME,
      dropped: size,
    });
  }
  return size;
}

/* ------------------------------------------------------------------ *
 * Guards & helpers
 * ------------------------------------------------------------------ */

function requireCredentials(config) {
  if (!config || typeof config !== "object") {
    throw new APIError(
      "Razorpay config is required (resolved plain object)",
      400,
      "PROVIDER_CONFIG_INVALID",
    );
  }

  const keyId = typeof config.keyId === "string" ? config.keyId.trim() : "";
  const keySecret =
    typeof config.keySecret === "string" ? config.keySecret.trim() : "";

  if (!keyId || !keySecret) {
    throw new APIError(
      "Razorpay config is missing keyId/keySecret",
      400,
      "PROVIDER_CONFIG_INVALID",
    );
  }

  return { keyId, keySecret };
}

/**
 * Razorpay amounts are ALWAYS integer paise. Anything else is a bug upstream
 * (a float rupee value that would be silently truncated or 100x wrong).
 */
function assertAmountPaise(amountPaise) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new APIError(
      `Razorpay amount must be a positive integer in paise, received: ${amountPaise}`,
      400,
      "INVALID_AMOUNT",
    );
  }
  return amountPaise;
}

function resolveCurrency(config, currency) {
  return (
    (typeof currency === "string" && currency.trim().toUpperCase()) ||
    (config && typeof config.currency === "string"
      ? config.currency.trim().toUpperCase()
      : "") ||
    DEFAULT_CURRENCY
  );
}

/** Safe, non-secret identifier fragment for logs (key ids are public-ish). */
function keyIdHint(keyId) {
  if (typeof keyId !== "string" || keyId.length <= 8) return "unknown";
  return `${keyId.slice(0, 8)}...${keyId.slice(-2)}`;
}

/**
 * Convert a Razorpay SDK/HTTP failure into an APIError, preserving the
 * gateway's own error.code / description so support can grep for it.
 * Nothing secret is copied out of the error.
 */
function wrapSdkError(error, operation, context = {}) {
  if (error instanceof APIError) return error;

  const detail = extractRazorpayError(error);
  const statusCode = normalizeStatus(
    error && (error.statusCode || error.status),
  );

  logger.error(`Razorpay ${operation} failed`, {
    provider: PROVIDER_NAME,
    operation,
    statusCode,
    razorpayCode: detail.code,
    razorpayReason: detail.reason,
    ...context,
  });

  return new APIError(
    `Razorpay ${operation} failed [${detail.code}]: ${detail.description}`,
    statusCode,
    "PROVIDER_REQUEST_FAILED",
  );
}

/**
 * The SDK surfaces failures in several shapes across versions:
 *   { error: { code, description, reason, source, step } }
 *   { statusCode, error: {...} }
 *   plain Error
 */
function extractRazorpayError(error) {
  const raw =
    (error && error.error && error.error.error) ||
    (error && error.error) ||
    error ||
    {};

  return {
    code: raw.code || "UNKNOWN_ERROR",
    description:
      raw.description ||
      raw.message ||
      (error && error.message) ||
      "Unknown Razorpay error",
    reason: raw.reason || null,
  };
}

function normalizeStatus(statusCode) {
  const value = Number(statusCode);
  if (!Number.isInteger(value) || value < 400 || value > 599) return 502;
  // Gateway auth/permission problems are OUR misconfiguration, not the
  // caller's — never propagate a bare 401/403 to the API client.
  if (value === 401 || value === 403) return 502;
  return value;
}

function isAuthFailure(error) {
  const status = Number(error && (error.statusCode || error.status));
  const { code, description } = extractRazorpayError(error);
  if (status === 401) return true;
  if (code === "BAD_REQUEST_ERROR" && /authenticat/i.test(description || "")) {
    return true;
  }
  return /invalid api key|authentication failed/i.test(description || "");
}

/** Razorpay timestamps are unix SECONDS; we hand out ISO strings or null. */
function unixToIso(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function toIntOrNull(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/**
 * Constant-time HMAC-SHA256 comparison.
 *
 * Length is checked BEFORE timingSafeEqual because timingSafeEqual THROWS on
 * unequal buffer lengths (guard shape copied from
 * shipment-service/services/quoteSigningService.js). Returns false — never
 * throws — on any malformed input, so a garbage signature is a rejection and
 * not a 500.
 */
function safeCompareHmac(payload, secret, providedHex) {
  try {
    if (typeof secret !== "string" || secret.length === 0) return false;
    if (typeof providedHex !== "string" || providedHex.length === 0) {
      return false;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest();
    const provided = Buffer.from(providedHex.trim(), "hex");

    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(provided, expected);
  } catch (error) {
    return false;
  }
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return null;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value =
    direct ??
    (() => {
      const lower = name.toLowerCase();
      const hit = Object.keys(headers).find((k) => k.toLowerCase() === lower);
      return hit ? headers[hit] : undefined;
    })();

  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

/**
 * Create a Razorpay Order for the standard Checkout flow.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {number} params.amountPaise - INTEGER paise
 * @param {string} [params.currency]
 * @param {string} [params.receipt] - our internal reference (<= 40 chars)
 * @param {Object} [params.notes]
 * @returns {Promise<{providerOrderId: string, amountPaise: number, currency: string, status: string, receipt: string|null, checkoutParams: Object, raw: Object}>}
 */
async function createOrder({
  config,
  amountPaise,
  currency,
  receipt,
  notes,
} = {}) {
  const { keyId } = requireCredentials(config);
  assertAmountPaise(amountPaise);

  const resolvedCurrency = resolveCurrency(config, currency);
  const instance = getInstance(config);

  let order;
  try {
    order = await instance.orders.create({
      amount: amountPaise,
      currency: resolvedCurrency,
      receipt: receipt || undefined,
      notes: notes || undefined,
      // Auto-capture: we never want an "authorized but uncaptured" payment
      // sitting around that a wallet credit cannot be reconciled against.
      payment_capture: 1,
    });
  } catch (error) {
    throw wrapSdkError(error, "createOrder", { receipt: receipt || null });
  }

  logger.info("Razorpay order created", {
    provider: PROVIDER_NAME,
    providerOrderId: order.id,
    amountPaise,
    currency: resolvedCurrency,
    receipt: receipt || null,
  });

  return {
    providerOrderId: order.id,
    amountPaise: toIntOrNull(order.amount) ?? amountPaise,
    currency: order.currency || resolvedCurrency,
    status: order.status || null,
    receipt: order.receipt || null,
    // Everything the browser Checkout widget needs. key_id is PUBLIC — the
    // key SECRET must never appear here.
    checkoutParams: {
      key: keyId,
      order_id: order.id,
      amount: toIntOrNull(order.amount) ?? amountPaise,
      currency: order.currency || resolvedCurrency,
    },
    raw: order,
  };
}

/**
 * Fetch an order by provider id.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {string} params.providerOrderId
 * @returns {Promise<{providerOrderId: string, status: string|null, amountPaise: number|null, amountPaidPaise: number|null, amountDuePaise: number|null, currency: string|null, receipt: string|null, createdAt: string|null, raw: Object}>}
 */
async function fetchOrder({ config, providerOrderId } = {}) {
  requireCredentials(config);

  if (typeof providerOrderId !== "string" || !providerOrderId.trim()) {
    throw new APIError(
      "providerOrderId is required",
      400,
      "INVALID_PROVIDER_REFERENCE",
    );
  }

  const instance = getInstance(config);

  let order;
  try {
    order = await instance.orders.fetch(providerOrderId.trim());
  } catch (error) {
    throw wrapSdkError(error, "fetchOrder", { providerOrderId });
  }

  return {
    providerOrderId: order.id,
    status: order.status || null,
    amountPaise: toIntOrNull(order.amount),
    amountPaidPaise: toIntOrNull(order.amount_paid),
    amountDuePaise: toIntOrNull(order.amount_due),
    currency: order.currency || null,
    receipt: order.receipt || null,
    createdAt: unixToIso(order.created_at),
    raw: order,
  };
}

/* ------------------------------------------------------------------ *
 * Payment Links
 * ------------------------------------------------------------------ */

/**
 * Create a Razorpay Payment Link.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {number} params.amountPaise - INTEGER paise
 * @param {string} [params.currency]
 * @param {string} [params.description]
 * @param {number} [params.expiresAtUnix] - unix SECONDS
 * @param {Object} [params.customer] - { name, email, contact }
 * @param {Object} [params.notes]
 * @param {string} [params.callbackUrl]
 * @param {string} [params.referenceId] - our internal reference
 * @returns {Promise<{providerLinkId: string, shortUrl: string|null, status: string|null, amountPaise: number|null, currency: string|null, referenceId: string|null, expiresAt: string|null, raw: Object}>}
 */
async function createPaymentLink({
  config,
  amountPaise,
  currency,
  description,
  expiresAtUnix,
  customer,
  notes,
  callbackUrl,
  referenceId,
} = {}) {
  requireCredentials(config);
  assertAmountPaise(amountPaise);

  const resolvedCurrency = resolveCurrency(config, currency);
  const instance = getInstance(config);

  const payload = {
    amount: amountPaise,
    currency: resolvedCurrency,
    // LOAD-BEARING: partial payments are the single most expensive bug
    // available here. A partially-paid link produces a credit that does not
    // match the invoice and a link that is still "open" for the remainder.
    // The wallet top-up flow is all-or-nothing — never flip this to true.
    accept_partial: false,
    description: description || undefined,
    expire_by:
      Number.isInteger(expiresAtUnix) && expiresAtUnix > 0
        ? expiresAtUnix
        : undefined,
    reference_id: referenceId || undefined,
    customer: customer || undefined,
    // LOAD-BEARING: product decision — admins share the payment link
    // themselves (WhatsApp/email/their own template). Razorpay must NOT send
    // its own SMS or email to the customer; flipping either to true means
    // customers get unbranded gateway messages we never approved.
    notify: { sms: false, email: false },
    // Same reason: no automated Razorpay reminder cadence.
    reminder_enable: false,
    callback_url: callbackUrl || undefined,
    callback_method: callbackUrl ? "get" : undefined,
    notes: notes || undefined,
  };

  let link;
  try {
    link = await instance.paymentLink.create(payload);
  } catch (error) {
    throw wrapSdkError(error, "createPaymentLink", {
      referenceId: referenceId || null,
    });
  }

  logger.info("Razorpay payment link created", {
    provider: PROVIDER_NAME,
    providerLinkId: link.id,
    amountPaise,
    currency: resolvedCurrency,
    referenceId: referenceId || null,
  });

  return {
    providerLinkId: link.id,
    shortUrl: link.short_url || null,
    status: link.status || null,
    amountPaise: toIntOrNull(link.amount) ?? amountPaise,
    currency: link.currency || resolvedCurrency,
    referenceId: link.reference_id || null,
    expiresAt: unixToIso(link.expire_by),
    raw: link,
  };
}

/**
 * Cancel an open payment link.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {string} params.providerLinkId
 * @returns {Promise<{providerLinkId: string, status: string|null, cancelled: boolean, raw: Object}>}
 */
async function cancelPaymentLink({ config, providerLinkId } = {}) {
  requireCredentials(config);

  if (typeof providerLinkId !== "string" || !providerLinkId.trim()) {
    throw new APIError(
      "providerLinkId is required",
      400,
      "INVALID_PROVIDER_REFERENCE",
    );
  }

  const instance = getInstance(config);

  let link;
  try {
    link = await instance.paymentLink.cancel(providerLinkId.trim());
  } catch (error) {
    throw wrapSdkError(error, "cancelPaymentLink", { providerLinkId });
  }

  logger.info("Razorpay payment link cancelled", {
    provider: PROVIDER_NAME,
    providerLinkId: link.id || providerLinkId,
    status: link.status || null,
  });

  return {
    providerLinkId: link.id || providerLinkId.trim(),
    status: link.status || null,
    cancelled: link.status === "cancelled",
    raw: link,
  };
}

/**
 * Fetch a payment link by provider id.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {string} params.providerLinkId
 * @returns {Promise<{providerLinkId: string, status: string|null, amountPaise: number|null, amountPaid: number|null, providerPaymentId: string|null, shortUrl: string|null, currency: string|null, referenceId: string|null, expiresAt: string|null, raw: Object}>}
 */
async function fetchPaymentLink({ config, providerLinkId } = {}) {
  requireCredentials(config);

  if (typeof providerLinkId !== "string" || !providerLinkId.trim()) {
    throw new APIError(
      "providerLinkId is required",
      400,
      "INVALID_PROVIDER_REFERENCE",
    );
  }

  const instance = getInstance(config);

  let link;
  try {
    link = await instance.paymentLink.fetch(providerLinkId.trim());
  } catch (error) {
    throw wrapSdkError(error, "fetchPaymentLink", { providerLinkId });
  }

  return {
    providerLinkId: link.id || providerLinkId.trim(),
    status: link.status || null,
    amountPaise: toIntOrNull(link.amount),
    // `amountPaid` is in PAISE like everything else on this module's surface.
    amountPaid: toIntOrNull(link.amount_paid) ?? 0,
    providerPaymentId: firstPaymentIdFromLink(link),
    shortUrl: link.short_url || null,
    currency: link.currency || null,
    referenceId: link.reference_id || null,
    expiresAt: unixToIso(link.expire_by),
    raw: link,
  };
}

/** A paid link carries its captured payment(s) in `payments[]`. */
function firstPaymentIdFromLink(link) {
  if (!link || !Array.isArray(link.payments) || link.payments.length === 0) {
    return null;
  }
  const captured =
    link.payments.find((p) => p && p.status === "captured") || link.payments[0];
  return (captured && (captured.payment_id || captured.id)) || null;
}

/* ------------------------------------------------------------------ *
 * Payments
 * ------------------------------------------------------------------ */

/**
 * Fetch a payment by provider id.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {string} params.providerPaymentId
 * @returns {Promise<{providerPaymentId: string, providerOrderId: string|null, status: string|null, captured: boolean, amountPaise: number|null, amountRefundedPaise: number|null, currency: string|null, method: string|null, capturedAt: string|null, errorCode: string|null, errorDescription: string|null, raw: Object}>}
 */
async function fetchPayment({ config, providerPaymentId } = {}) {
  requireCredentials(config);

  if (typeof providerPaymentId !== "string" || !providerPaymentId.trim()) {
    throw new APIError(
      "providerPaymentId is required",
      400,
      "INVALID_PROVIDER_REFERENCE",
    );
  }

  const instance = getInstance(config);

  let payment;
  try {
    payment = await instance.payments.fetch(providerPaymentId.trim());
  } catch (error) {
    throw wrapSdkError(error, "fetchPayment", { providerPaymentId });
  }

  return normalizePayment(payment);
}

/**
 * Normalise a Razorpay payment entity (used by fetchPayment AND by
 * parseWebhookEvent, so both paths agree on field names).
 */
function normalizePayment(payment) {
  const entity = payment || {};
  return {
    providerPaymentId: entity.id || null,
    providerOrderId: entity.order_id || null,
    status: entity.status || null,
    captured: entity.status === "captured" || entity.captured === true,
    amountPaise: toIntOrNull(entity.amount),
    amountRefundedPaise: toIntOrNull(entity.amount_refunded) ?? 0,
    currency: entity.currency || null,
    // NOTE: `method` only (card/upi/netbanking) — the full card payload is
    // never surfaced or logged.
    method: entity.method || null,
    capturedAt: unixToIso(entity.created_at),
    errorCode: entity.error_code || null,
    errorDescription: entity.error_description || null,
    raw: entity,
  };
}

/* ------------------------------------------------------------------ *
 * Signature verification
 * ------------------------------------------------------------------ */

/**
 * Verify the browser Checkout handler payload.
 *
 * HMAC-SHA256 of `order_id|payment_id` keyed by the API key SECRET.
 *
 * We deliberately do NOT use the SDK's own `validatePaymentVerification`
 * helper: across published versions it has compared signatures with `===`,
 * which is not timing-safe. This uses a length check followed by
 * crypto.timingSafeEqual instead.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {{razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string}} params.payload
 * @returns {boolean} never throws — malformed input is simply false
 */
function verifyClientSignature({ config, payload } = {}) {
  try {
    if (!config || !payload || typeof payload !== "object") return false;

    const orderId = payload.razorpay_order_id;
    const paymentId = payload.razorpay_payment_id;
    const signature = payload.razorpay_signature;

    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string" ||
      !orderId ||
      !paymentId ||
      !signature
    ) {
      return false;
    }

    const ok = safeCompareHmac(
      `${orderId}|${paymentId}`,
      config.keySecret,
      signature,
    );

    if (!ok) {
      logger.warn("Razorpay client signature verification failed", {
        provider: PROVIDER_NAME,
        providerOrderId: orderId,
        providerPaymentId: paymentId,
      });
    }

    return ok;
  } catch (error) {
    logger.warn("Razorpay client signature verification errored", {
      provider: PROVIDER_NAME,
      error: error.message,
    });
    return false;
  }
}

/**
 * Verify a webhook.
 *
 * HMAC-SHA256 over the RAW REQUEST BODY keyed by the WEBHOOK SECRET (a
 * different secret from keySecret), compared against `x-razorpay-signature`.
 *
 * CRITICAL: `rawBody` must be the exact bytes Razorpay sent — captured by the
 * `express.json({ verify })` hook in server.js. There is deliberately NO
 * fallback to JSON.stringify(parsedBody): re-serialising is not byte-identical
 * (key order, unicode escaping, whitespace) and would fail silently on a real
 * payment. If rawBody is missing, this returns false and says so loudly.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {Buffer|string} params.rawBody
 * @param {Object} params.headers
 * @returns {boolean} never throws
 */
function verifyWebhookSignature({ config, rawBody, headers } = {}) {
  try {
    if (!config || typeof config.webhookSecret !== "string") {
      logger.warn("Razorpay webhook secret is not configured", {
        provider: PROVIDER_NAME,
      });
      return false;
    }

    const isBuffer = Buffer.isBuffer(rawBody);
    if (!isBuffer && typeof rawBody !== "string") {
      logger.error(
        "Razorpay webhook rawBody missing — express.json({verify}) raw-body capture is not wired",
        { provider: PROVIDER_NAME },
      );
      return false;
    }
    if ((isBuffer && rawBody.length === 0) || rawBody.length === 0) {
      return false;
    }

    const signature = headerValue(headers, WEBHOOK_SIGNATURE_HEADER);
    if (!signature) {
      logger.warn("Razorpay webhook missing signature header", {
        provider: PROVIDER_NAME,
        header: WEBHOOK_SIGNATURE_HEADER,
      });
      return false;
    }

    const ok = safeCompareHmac(rawBody, config.webhookSecret, signature);

    if (!ok) {
      logger.warn("Razorpay webhook signature verification failed", {
        provider: PROVIDER_NAME,
        eventId: headerValue(headers, WEBHOOK_EVENT_ID_HEADER),
      });
    }

    return ok;
  } catch (error) {
    logger.warn("Razorpay webhook signature verification errored", {
      provider: PROVIDER_NAME,
      error: error.message,
    });
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Webhook parsing
 * ------------------------------------------------------------------ */

/**
 * Normalise a Razorpay webhook into the provider-agnostic shape the webhook
 * service consumes. Signature verification is the CALLER's job and must have
 * already passed before this is called.
 *
 * @param {Object} params
 * @param {Buffer|string} [params.rawBody] - used only if parsedBody is absent
 * @param {Object} [params.parsedBody]
 * @param {Object} [params.headers]
 * @returns {{providerEventId: string|null, eventType: string|null, outcome: string,
 *   providerOrderId: string|null, providerLinkId: string|null, providerPaymentId: string|null,
 *   amountPaise: number|null, currency: string|null, capturedAt: string|null,
 *   errorCode: string|null, errorDescription: string|null, raw: Object|null}}
 */
function parseWebhookEvent({ rawBody, parsedBody, headers } = {}) {
  const body = parsedBody || safeJsonParse(rawBody);

  if (!body || typeof body !== "object") {
    return ignoredEvent(null, headers, null);
  }

  const eventType = typeof body.event === "string" ? body.event : null;
  const outcome = EVENT_OUTCOMES[eventType] || OUTCOME.IGNORED;

  const payload =
    body.payload && typeof body.payload === "object" ? body.payload : {};
  const paymentEntity = entityOf(payload.payment);
  const linkEntity = entityOf(payload.payment_link);
  const orderEntity = entityOf(payload.order);
  const refundEntity = entityOf(payload.refund);

  const providerPaymentId =
    (paymentEntity && paymentEntity.id) ||
    (refundEntity && refundEntity.payment_id) ||
    null;

  const providerOrderId =
    (paymentEntity && paymentEntity.order_id) ||
    (orderEntity && orderEntity.id) ||
    (linkEntity && linkEntity.order_id) ||
    null;

  const providerLinkId = (linkEntity && linkEntity.id) || null;

  // Amount priority: the payment moves the money. For refunds the refund
  // entity's amount is the one that matters; for link-only events (expired /
  // cancelled) fall back to the link's face value.
  const amountSource =
    outcome === OUTCOME.REFUNDED
      ? refundEntity || paymentEntity
      : paymentEntity || linkEntity || orderEntity || refundEntity;

  const amountPaise = amountSource ? toIntOrNull(amountSource.amount) : null;
  const currency = (amountSource && amountSource.currency) || null;

  const capturedAt =
    (paymentEntity && unixToIso(paymentEntity.created_at)) ||
    (refundEntity && unixToIso(refundEntity.created_at)) ||
    (linkEntity && unixToIso(linkEntity.updated_at)) ||
    unixToIso(body.created_at);

  return {
    providerEventId: resolveEventId(
      headers,
      eventType,
      providerPaymentId,
      providerLinkId,
    ),
    eventType,
    outcome,
    providerOrderId,
    providerLinkId,
    providerPaymentId,
    amountPaise,
    currency,
    capturedAt,
    errorCode: (paymentEntity && paymentEntity.error_code) || null,
    errorDescription:
      (paymentEntity && paymentEntity.error_description) || null,
    raw: body,
  };
}

/**
 * The replay-dedupe key.
 *
 * Razorpay sends `x-razorpay-event-id`, which is stable across its own
 * retries — that is the ideal key. When the header is absent (older accounts,
 * manual replays from the dashboard, proxies that strip headers) we synthesise
 * `${eventType}:${providerPaymentId}`. It MUST be deterministic per payment:
 * anything time- or random-based would make every retry look like a brand new
 * event and credit the same money twice. Falls back to the link id, then to
 * the event type alone, in that order of specificity.
 */
function resolveEventId(headers, eventType, providerPaymentId, providerLinkId) {
  const headerId = headerValue(headers, WEBHOOK_EVENT_ID_HEADER);
  if (headerId) return headerId;

  const subject = providerPaymentId || providerLinkId;
  if (eventType && subject) return `${eventType}:${subject}`;
  return eventType || null;
}

function ignoredEvent(eventType, headers, providerPaymentId) {
  return {
    providerEventId: resolveEventId(
      headers,
      eventType,
      providerPaymentId,
      null,
    ),
    eventType,
    outcome: OUTCOME.IGNORED,
    providerOrderId: null,
    providerLinkId: null,
    providerPaymentId: providerPaymentId || null,
    amountPaise: null,
    currency: null,
    capturedAt: null,
    errorCode: null,
    errorDescription: null,
    raw: null,
  };
}

function entityOf(node) {
  if (!node || typeof node !== "object") return null;
  const entity = node.entity;
  return entity && typeof entity === "object" ? entity : null;
}

function safeJsonParse(rawBody) {
  try {
    if (Buffer.isBuffer(rawBody)) return JSON.parse(rawBody.toString("utf8"));
    if (typeof rawBody === "string") return JSON.parse(rawBody);
    return null;
  } catch (error) {
    logger.warn("Razorpay webhook body is not valid JSON", {
      provider: PROVIDER_NAME,
    });
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Connectivity test
 * ------------------------------------------------------------------ */

/**
 * Cheapest authenticated call Razorpay offers — list one payment.
 * An auth failure is a RESULT, not an exception: the admin config screen wants
 * `{ ok: false, message }` to render, not a 502.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @returns {Promise<{ok: boolean, message: string, accountHint: string|null, latencyMs: number}>}
 */
async function testConnection({ config } = {}) {
  const startedAt = Date.now();

  let keyId;
  try {
    ({ keyId } = requireCredentials(config));
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      accountHint: null,
      latencyMs: Date.now() - startedAt,
    };
  }

  try {
    const instance = getInstance(config);
    const result = await instance.payments.all({ count: 1 });
    const latencyMs = Date.now() - startedAt;

    logger.info("Razorpay connection test succeeded", {
      provider: PROVIDER_NAME,
      mode: config.mode || null,
      keyIdHint: keyIdHint(keyId),
      latencyMs,
    });

    return {
      ok: true,
      message: `Connected to Razorpay (${config.mode || "UNKNOWN"} mode)`,
      accountHint: keyIdHint(keyId),
      // count is present even when the account has zero payments
      latencyMs,
      paymentsVisible: toIntOrNull(result && result.count) ?? 0,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const detail = extractRazorpayError(error);

    if (isAuthFailure(error)) {
      logger.warn("Razorpay connection test rejected credentials", {
        provider: PROVIDER_NAME,
        mode: config.mode || null,
        keyIdHint: keyIdHint(keyId),
        razorpayCode: detail.code,
        latencyMs,
      });
      return {
        ok: false,
        message: "Invalid key_id/key_secret",
        accountHint: keyIdHint(keyId),
        latencyMs,
      };
    }

    logger.warn("Razorpay connection test failed", {
      provider: PROVIDER_NAME,
      mode: config.mode || null,
      keyIdHint: keyIdHint(keyId),
      razorpayCode: detail.code,
      latencyMs,
    });

    return {
      ok: false,
      message: `Razorpay unreachable [${detail.code}]: ${detail.description}`,
      accountHint: keyIdHint(keyId),
      latencyMs,
    };
  }
}

/* ------------------------------------------------------------------ *
 * Contract export
 * ------------------------------------------------------------------ */

module.exports = {
  // MUST match the registry key in ./index.js exactly.
  name: PROVIDER_NAME,
  supports: {
    orders: true,
    paymentLinks: true,
    refunds: true,
  },

  createOrder,
  createPaymentLink,
  cancelPaymentLink,
  verifyClientSignature,
  verifyWebhookSignature,
  parseWebhookEvent,
  fetchPayment,
  fetchOrder,
  fetchPaymentLink,
  testConnection,

  // Cache busting for the config service (call on credential/mode change).
  resetInstanceCache,

  // Exported for the webhook service + tests.
  OUTCOME,
  EVENT_OUTCOMES,
};
