/**
 * CCAvenue Payment Provider (non-seamless / redirect checkout)
 *
 * Implements the PaymentProvider contract documented in ./providerRegistry.js
 * on top of the pure codec in ./ccavenueCrypto.js.
 *
 * CONTRACT RULES honoured here:
 *  - STATELESS: never touches the database, never reads `process.env`. Every
 *    function receives a RESOLVED PLAIN CONFIG object already decrypted and
 *    mode-selected by providerConfigService. TEST vs LIVE hosts are chosen from
 *    `config.isTest` and NEVER from NODE_ENV — a production container is
 *    routinely asked to drive a merchant's TEST credentials from the admin
 *    screen, and keying hosts off the deployment environment would send those
 *    to the live gateway.
 *  - INTEGER PAISE ONLY: rupee strings exist only at the CCAvenue boundary,
 *    produced/consumed by ccavenueCrypto's formatAmount/parseAmountToPaise.
 *  - NO SECRET LOGGING: the working key, the derived AES key and any ciphertext
 *    never reach the logger, an error message, or the `raw` payload we hand
 *    back for persistence.
 *
 * ======================== HOW CCAVENUE DIFFERS ========================
 * Razorpay is an API-first gateway: you create an order over HTTPS and get an
 * id back. CCAvenue's non-seamless flow is a FORM POST — there is no
 * "create order" call at all. `createOrder()` below therefore performs NO
 * NETWORK I/O: it mints our own `order_id`, encrypts the parameter string and
 * returns the redirect envelope. The order only exists once the customer's
 * browser POSTs `encRequest` to the transaction URL. Everything downstream
 * (topupService, reconcileService) is unchanged because the returned shape is
 * deliberately the same as razorpayProvider's.
 *
 * A second consequence: CCAvenue has no payment-id-keyed lookup. Status is
 * keyed on the ORDER. `fetchPayment()` therefore delegates to `fetchOrder()`
 * and normalises the result into RAZORPAY'S payment shape, which is what makes
 * topupService.pollProvider's hard-coded
 * `payment.captured === true && payment.status === "captured"` work unchanged.
 *
 * @typedef {import("./providerRegistry").ResolvedProviderConfig} ResolvedProviderConfig
 */

const crypto = require("crypto");
const axios = require("axios");

const { APIError } = require("../../shared/lib/errors");
const logger = require("../../shared/lib/logger");

const {
  encryptToHex,
  decryptFromHex,
  parseParamString,
  buildParamString,
  formatAmount,
  parseAmountToPaise,
  scrubSensitiveFields,
  isHex,
} = require("./ccavenueCrypto");

const PROVIDER_NAME = "ccavenue";
const DEFAULT_CURRENCY = "INR";
const DEFAULT_LANGUAGE = "EN";
const REQUEST_TIMEOUT_MS = 20000;

/**
 * A shared-secret HMAC header for the Dynamic Event Notification callback.
 * WIRED BUT DORMANT — see verifyWebhookSignature strategy (2).
 */
const WEBHOOK_SIGNATURE_HEADER = "x-ccavenue-signature";

/**
 * Field names an encrypted webhook envelope might use. CCAvenue's own kits are
 * inconsistent between `encResp` (browser redirect) and `enc_response` (server
 * APIs), so we accept both plus the camelCase variant.
 * TODO(ccavenue-kit): confirm DEN payload shape, encryption and whether a
 * signature header exists.
 */
const ENC_RESPONSE_KEYS = Object.freeze([
  "enc_response",
  "encResp",
  "encResponse",
  "enc_resp",
]);

/**
 * Maximum length of a `merchant_param1..4` value. Truncating here is safer than
 * having the gateway silently truncate (or reject) mid-UUID.
 * TODO(ccavenue-kit): confirm merchant_param max length.
 */
const MERCHANT_PARAM_MAX_LENGTH = 100;

/**
 * Maximum length / charset of our own `order_id`.
 * TODO(ccavenue-kit): confirm order_id max length/charset and whether reuse is
 * permitted.
 */
const ORDER_ID_MAX_LENGTH = 30;
const ORDER_ID_ALLOWED = /[^A-Z0-9-]/g;

/** Normalised webhook outcomes consumed by the webhook service. */
const OUTCOME = Object.freeze({
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED",
  IGNORED: "IGNORED",
});

/**
 * LOWERCASED `order_status` -> outcome.
 *
 * `initiated` / `awaited` are money-in-flight, not money-moved: they are
 * IGNORED so the credit path never fires twice for one payment (the terminal
 * `Success` notification is the only thing that credits).
 * An UNKNOWN status also resolves to IGNORED — fail-safe, never credit on a
 * value we do not recognise — but `eventType` is still populated so the
 * unrecognised value lands in the webhook event log and can be triaged.
 *
 * TODO(ccavenue-kit): confirm the complete order_status value list.
 */
const ORDER_STATUS_OUTCOMES = Object.freeze({
  success: OUTCOME.PAID,
  failure: OUTCOME.FAILED,
  aborted: OUTCOME.FAILED,
  invalid: OUTCOME.FAILED,
  timeout: OUTCOME.FAILED,
  initiated: OUTCOME.IGNORED,
  awaited: OUTCOME.IGNORED,
});

/* ------------------------------------------------------------------ *
 * Config / credentials
 * ------------------------------------------------------------------ */

/**
 * Pull the three CCAvenue credentials out of a resolved config.
 *
 * We read `config.credentials.*` BY NAME because the flat aliases are easy to
 * misread: `keyId` is the access code and `keySecret`/`webhookSecret` are BOTH
 * the same working key (CCAvenue has no separate webhook secret). The aliases
 * are tolerated as a fallback so a caller that only populated the flat shape
 * still works.
 *
 * @param {ResolvedProviderConfig} config
 * @returns {{merchantId: string, accessCode: string, workingKey: string}}
 * @throws {APIError} 400 PROVIDER_CONFIG_INVALID — message names the MISSING
 *   FIELD only, never a value.
 */
function requireCredentials(config) {
  if (!config || typeof config !== "object") {
    throw new APIError(
      "CCAvenue provider config is required",
      400,
      "PROVIDER_CONFIG_INVALID",
    );
  }

  const credentials =
    config.credentials && typeof config.credentials === "object"
      ? config.credentials
      : {};

  const merchantId = trimmedOrNull(credentials.merchantId);
  const accessCode =
    trimmedOrNull(credentials.accessCode) || trimmedOrNull(config.keyId);
  const workingKey =
    trimmedOrNull(credentials.workingKey) ||
    trimmedOrNull(config.keySecret) ||
    trimmedOrNull(config.webhookSecret);

  const missing = [];
  if (!merchantId) missing.push("merchantId");
  if (!accessCode) missing.push("accessCode");
  if (!workingKey) missing.push("workingKey");

  if (missing.length > 0) {
    throw new APIError(
      `CCAvenue credentials are incomplete: missing ${missing.join(", ")}`,
      400,
      "PROVIDER_CONFIG_INVALID",
    );
  }

  return { merchantId, accessCode, workingKey };
}

/**
 * TEST/LIVE endpoints, chosen from `config.isTest` ONLY.
 *
 * TODO(ccavenue-kit): confirm exact TEST/LIVE transaction URLs and command
 * param.
 *
 * @param {ResolvedProviderConfig} config
 * @returns {{api: string, txn: string}}
 */
function resolveHosts(config) {
  const isTest = Boolean(config && config.isTest);

  return isTest
    ? {
        api: "https://apitest.ccavenue.com",
        txn: "https://test.ccavenue.com/transaction/transaction.do",
      }
    : {
        api: "https://api.ccavenue.com",
        txn: "https://secure.ccavenue.com/transaction/transaction.do",
      };
}

function transactionUrl(config) {
  return `${resolveHosts(config).txn}?command=initiateTransaction`;
}

function resolveCurrency(config, currency) {
  return (
    trimmedOrNull(currency) ||
    trimmedOrNull(config && config.currency) ||
    DEFAULT_CURRENCY
  ).toUpperCase();
}

/* ------------------------------------------------------------------ *
 * Small pure helpers
 * ------------------------------------------------------------------ */

function trimmedOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * `receipt` -> a CCAvenue-safe `order_id`.
 * Uppercased, restricted to [A-Z0-9-], truncated.
 * TODO(ccavenue-kit): confirm order_id max length/charset and whether reuse is
 * permitted.
 */
function toOrderId(receipt) {
  const cleaned = String(
    receipt === null || receipt === undefined ? "" : receipt,
  )
    .toUpperCase()
    .replace(ORDER_ID_ALLOWED, "")
    .slice(0, ORDER_ID_MAX_LENGTH);

  if (cleaned.length === 0) {
    throw new APIError(
      "A receipt is required to derive a CCAvenue order_id",
      400,
      "PROVIDER_REQUEST_INVALID",
    );
  }

  return cleaned;
}

/**
 * Sanitise one note value for a `merchant_param`.
 *
 * The parameter string is NOT url-encoded (ccavenueCrypto protocol note 5), so
 * a `&` or `=` inside a value would split into extra parameters on the far end.
 * buildParamString would (correctly) throw; we strip instead, because a note is
 * metadata and losing a stray character is better than failing a payment.
 * TODO(ccavenue-kit): confirm merchant_param max length.
 */
function toMerchantParam(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/[&=]/g, "")
    .trim()
    .slice(0, MERCHANT_PARAM_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * CCAvenue timestamps -> ISO string, or null.
 *
 * `trans_date` has been observed as "10/03/2023 18:20:45" (dd/mm/yyyy), which
 * `new Date()` parses as MONTH/DAY in V8 — silently wrong for any day > 12 and
 * an exception for day > 12 in month position. We therefore parse the
 * dd/mm/yyyy shape EXPLICITLY and only fall back to Date.parse for
 * ISO-8601-looking input.
 * TODO(ccavenue-kit): confirm the trans_date format and timezone.
 */
function toIsoOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber.toISOString();
  }

  const text = trimmedOrNull(value);
  if (!text) return null;

  const dmy =
    /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (dmy) {
    const [, dd, mm, yyyy, hh, mi, ss] = dmy;
    const date = new Date(
      Date.UTC(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(mi),
        Number(ss || "0"),
      ),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return null;
  const lower = String(name).toLowerCase();
  const hit = Object.keys(headers).find((key) => key.toLowerCase() === lower);
  if (!hit) return null;
  const value = headers[hit];
  if (Array.isArray(value))
    return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
}

/**
 * Constant-time HMAC-SHA256 comparison. Never throws (timingSafeEqual THROWS on
 * unequal buffer lengths, so the length check must come first).
 */
function safeCompareHmac(payload, secret, providedHex) {
  try {
    if (typeof secret !== "string" || secret.length === 0) return false;
    if (typeof providedHex !== "string" || providedHex.trim().length === 0) {
      return false;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest();
    const provided = Buffer.from(providedHex.trim(), "hex");

    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(provided, expected);
  } catch (_error) {
    return false;
  }
}

function bodyText(rawBody) {
  if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");
  if (typeof rawBody === "string") return rawBody;
  return null;
}

/**
 * Parse a webhook body from its RAW BYTES ONLY.
 *
 * Deliberately never re-serialises `parsedBody`: an express body-parser round
 * trip is lossy (key ordering, numeric coercion, `+` vs space), and a payload
 * we authenticate must be the payload we actually received.
 *
 * Tries JSON first, then url-encoded form, then CCAvenue's raw unencoded
 * `k=v&k=v`. Never throws — unusable input yields null.
 *
 * @returns {Object|null}
 */
function parseRawBody(rawBody) {
  const text = bodyText(rawBody);
  if (!text || text.trim().length === 0) return null;

  const trimmed = text.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  try {
    const params = new URLSearchParams(trimmed);
    const out = {};
    for (const [key, value] of params.entries()) out[key] = value;
    if (Object.keys(out).length > 0) return out;
  } catch (_error) {
    // fall through to the raw parser
  }

  const raw = parseParamString(trimmed);
  return Object.keys(raw).length > 0 ? raw : null;
}

/** Locate the encrypted envelope inside a parsed body, whatever it is called. */
function findEncPayload(body) {
  if (!body || typeof body !== "object") return null;
  for (const key of ENC_RESPONSE_KEYS) {
    const value = trimmedOrNull(body[key]);
    if (value) return value;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Error mapping
 * ------------------------------------------------------------------ */

/**
 * Convert a CCAvenue transport/HTTP/business failure into an APIError.
 *
 * Mirrors razorpayProvider.wrapSdkError, including the 401/403 -> 502 rule: a
 * gateway auth rejection means OUR access code / working key is wrong, i.e. a
 * server misconfiguration, and must never surface to the API caller as "you
 * are unauthorised".
 *
 * Nothing secret is copied out — only the gateway's own error code/description.
 */
function wrapCcavenueError(error, operation, context = {}) {
  if (error instanceof APIError) return error;

  const detail = extractCcavenueError(error);
  const statusCode = normalizeStatus(detail.httpStatus);

  logger.error(`CCAvenue ${operation} failed`, {
    provider: PROVIDER_NAME,
    operation,
    statusCode,
    ccavenueCode: detail.code,
    ccavenueReason: detail.description,
    ...context,
  });

  return new APIError(
    `CCAvenue ${operation} failed [${detail.code}]: ${detail.description}`,
    statusCode,
    "PROVIDER_REQUEST_FAILED",
  );
}

/**
 * Failures arrive in three shapes:
 *   - axios network/HTTP error   ({ response: { status, data }, code, message })
 *   - a synthesised gateway error ({ httpStatus, code, description })
 *   - a plain Error
 */
function extractCcavenueError(error) {
  const source = error || {};

  if (source.httpStatus || source.enc_error_code || source.error_desc) {
    return {
      httpStatus: source.httpStatus || null,
      code: source.code || source.enc_error_code || "UNKNOWN_ERROR",
      description:
        source.description ||
        source.error_desc ||
        source.message ||
        "Unknown CCAvenue error",
    };
  }

  const response = source.response || {};
  return {
    httpStatus: response.status || null,
    code: source.code || "UNKNOWN_ERROR",
    description: source.message || "Unknown CCAvenue error",
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

/** Heuristic: does this gateway error code/description smell like bad creds? */
function isAuthishError(code, description) {
  const haystack = `${code || ""} ${description || ""}`.toLowerCase();
  return /access\s*code|authenticat|unauthor|invalid\s*(request|merchant|access)|merchant\s*id/.test(
    haystack,
  );
}

/* ------------------------------------------------------------------ *
 * Orders — createOrder performs NO NETWORK I/O
 * ------------------------------------------------------------------ */

/**
 * Build the CCAvenue redirect envelope for a new order.
 *
 * NO NETWORK CALL HAPPENS HERE. The order comes into existence when the
 * customer's browser POSTs `redirect.fields` to `redirect.url`.
 *
 * NOTES ARE LOAD-BEARING. webhookService.adoptOrphanPayment reconstructs a lost
 * topup order purely from what comes back on the notification, and CCAvenue's
 * only round-trippable slots are `merchant_param1..4`. They are mapped ONE
 * VALUE PER PARAM — never a JSON blob in a single param — because the params
 * are length-limited and the parameter string is unencoded, so braces, quotes
 * and commas ride badly through `k=v&k=v`.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {number} params.amountPaise INTEGER paise
 * @param {string} [params.currency]
 * @param {string} params.receipt our internal reference; becomes `order_id`
 * @param {{walletUserId?: string, clientCode?: string, subjectUserId?: string, kind?: string}} [params.notes]
 * @param {string} [params.returnUrl]
 * @param {string} [params.cancelUrl]
 * @returns {Promise<Object>}
 */
async function createOrder({
  config,
  amountPaise,
  currency,
  receipt,
  notes,
  returnUrl,
  cancelUrl,
  providerOrderId,
} = {}) {
  const { merchantId, accessCode, workingKey } = requireCredentials(config);

  // Throws INVALID_AMOUNT for a non-integer / zero / negative amount.
  const amount = formatAmount(amountPaise);
  const resolvedCurrency = resolveCurrency(config, currency);
  // `providerOrderId` REBUILDS the redirect form for an order that already
  // exists (topupService.deriveRedirect, on the idempotent-replay path). It must
  // reproduce the SAME order_id: the return and webhook handlers both look the
  // order up by it, so a re-mint under a fresh id would strand the payment.
  // toOrderId() is idempotent over an id it produced, so passing `receipt` alone
  // happens to work — this parameter makes that explicit rather than incidental.
  const orderId = toOrderId(providerOrderId || receipt);

  const safeNotes = notes && typeof notes === "object" ? notes : {};
  const merchantParam1 = toMerchantParam(safeNotes.walletUserId);
  const merchantParam2 = toMerchantParam(safeNotes.clientCode);
  const merchantParam3 = toMerchantParam(safeNotes.subjectUserId);
  const merchantParam4 = toMerchantParam(safeNotes.kind);

  // Raw, unencoded `k=v&k=v` — buildParamString rejects any value carrying a
  // reserved character rather than emitting a string that parses to garbage.
  const plainText = buildParamString({
    merchant_id: merchantId,
    order_id: orderId,
    currency: resolvedCurrency,
    amount,
    redirect_url: trimmedOrNull(returnUrl),
    cancel_url: trimmedOrNull(cancelUrl) || trimmedOrNull(returnUrl),
    language: DEFAULT_LANGUAGE,
    merchant_param1: merchantParam1,
    merchant_param2: merchantParam2,
    merchant_param3: merchantParam3,
    merchant_param4: merchantParam4,
  });

  const encRequest = encryptToHex(plainText, workingKey);

  logger.info("CCAvenue order envelope built", {
    provider: PROVIDER_NAME,
    providerOrderId: orderId,
    amountPaise,
    currency: resolvedCurrency,
    mode: config && config.mode ? config.mode : null,
  });

  return {
    providerOrderId: orderId,
    amountPaise,
    currency: resolvedCurrency,
    // There is no gateway-side order yet; CREATED is our own lifecycle state.
    status: "CREATED",
    receipt: receipt || null,
    // The access code is PUBLIC (it travels in the browser form). The working
    // key must never appear here.
    checkoutParams: {
      key: accessCode,
      order_id: orderId,
      amount: amountPaise,
      currency: resolvedCurrency,
    },
    redirect: {
      url: transactionUrl(config),
      method: "POST",
      fields: {
        encRequest,
        access_code: accessCode,
      },
    },
    // `raw` is PERSISTED. It carries the plaintext echo of what we sent and
    // MUST NEVER contain the ciphertext or the working key.
    raw: {
      order_id: orderId,
      amount,
      currency: resolvedCurrency,
      merchant_param1: merchantParam1,
      merchant_param2: merchantParam2,
      merchant_param3: merchantParam3,
      merchant_param4: merchantParam4,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Payment Links — unsupported
 * ------------------------------------------------------------------ */

/**
 * CCAvenue's non-seamless integration has no payment-link primitive we support.
 * These three exist ONLY because providerRegistry.assertContract requires every
 * contract function to be present; each refuses immediately so a caller can
 * never get halfway through a link flow.
 */
async function createPaymentLink() {
  throw new APIError(
    "CCAvenue does not support payment links",
    400,
    "PROVIDER_NOT_SUPPORTED",
  );
}

async function cancelPaymentLink() {
  throw new APIError(
    "CCAvenue does not support payment links",
    400,
    "PROVIDER_NOT_SUPPORTED",
  );
}

async function fetchPaymentLink() {
  throw new APIError(
    "CCAvenue does not support payment links",
    400,
    "PROVIDER_NOT_SUPPORTED",
  );
}

/* ------------------------------------------------------------------ *
 * Signature verification
 * ------------------------------------------------------------------ */

/**
 * Verify the browser return payload (`encResp` posted back to our redirect_url).
 *
 * !! AES-CBC WITHOUT A MAC IS MALLEABLE !!
 * A successful decrypt with correct PKCS7 padding is STRONG EVIDENCE the
 * payload came from CCAvenue — only they and we hold the working key — but it
 * is NOT INTEGRITY PROOF. A bit-flipping attacker who can replay a genuine
 * ciphertext can corrupt an earlier block in a predictable way while later
 * blocks still decrypt cleanly. This function therefore answers only "is this
 * plausibly ours?", and the CALLER MUST RE-CONFIRM VIA `fetchOrder()` (a
 * server-to-server lookup) BEFORE CREDITING ANY WALLET. Never treat `true`
 * here as authorisation to move money.
 *
 * SYNC and NEVER THROWS: malformed input is simply `false`.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {{encResp: string, orderId?: string}} params.payload
 * @returns {boolean}
 */
function verifyClientSignature({ config, payload } = {}) {
  try {
    if (!config || !payload || typeof payload !== "object") return false;

    const { workingKey } = requireCredentials(config);

    const encResp =
      trimmedOrNull(payload.encResp) ||
      trimmedOrNull(payload.enc_response) ||
      trimmedOrNull(payload.encResponse);

    if (!encResp || !isHex(encResp)) return false;

    // Throws on a wrong key or bad padding -> caught below -> false.
    const plainText = decryptFromHex(encResp, workingKey);
    const fields = parseParamString(plainText);

    const orderId = trimmedOrNull(fields.order_id);
    if (!orderId) return false;

    const expectedOrderId = trimmedOrNull(payload.orderId);
    if (
      expectedOrderId &&
      expectedOrderId.toUpperCase() !== orderId.toUpperCase()
    ) {
      // Decrypts fine, but it is a DIFFERENT order — a replayed envelope from
      // another (possibly the attacker's own) successful payment.
      return false;
    }

    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Authenticate a Dynamic Event Notification (server-to-server webhook).
 *
 * FAIL-CLOSED. CCAvenue's DEN payload shape is not publicly specified, so
 * rather than guess we run an ORDERED LIST OF STRATEGIES, each of which must
 * PROVE something. If none proves anything we log loudly and return false —
 * we never "probably it's fine".
 *
 * NOTE: authentication reads the RAW BYTES ONLY. Re-serialising `parsedBody`
 * would authenticate a body-parser's reconstruction rather than what the
 * gateway actually sent.
 *
 * TODO(ccavenue-kit): confirm DEN payload shape, encryption and whether a
 * signature header exists.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {Buffer|string} params.rawBody
 * @param {Object} params.headers
 * @returns {boolean} SYNC, never throws
 */
function verifyWebhookSignature({ config, rawBody, headers } = {}) {
  let parsed = null;

  try {
    const { workingKey } = requireCredentials(config);
    parsed = parseRawBody(rawBody);

    // --- Strategy 1: the body carries an encrypted envelope ---------------
    // Proof: only CCAvenue and this service hold the working key, so a clean
    // AES-128-CBC decrypt with valid PKCS7 padding is evidence of origin.
    // (Malleable, as documented on verifyClientSignature — the credit path
    // still re-confirms with fetchOrder.)
    const encPayload = findEncPayload(parsed);
    if (encPayload && isHex(encPayload)) {
      decryptFromHex(encPayload, workingKey); // throws on wrong key/padding
      return true;
    }

    // --- Strategy 2: a shared-secret HMAC header (DORMANT) ----------------
    // Wired, but inert until CCAvenue actually sends such a header: the whole
    // branch is gated on the header being present, so today it never runs.
    const signature = headerValue(headers, WEBHOOK_SIGNATURE_HEADER);
    if (signature) {
      const credentials =
        config.credentials && typeof config.credentials === "object"
          ? config.credentials
          : {};
      const hmacSecret =
        trimmedOrNull(credentials.webhookHmacSecret) || workingKey;
      const text = bodyText(rawBody);
      if (text !== null && safeCompareHmac(text, hmacSecret, signature)) {
        return true;
      }
      // A present-but-wrong signature is a hard reject: fall through to false.
    }
  } catch (_error) {
    // Any throw (missing credentials, undecryptable envelope) is a rejection.
  }

  // --- Strategy 3: nothing proved anything -> REFUSE --------------------
  logger.error(
    "CCAvenue webhook could not be authenticated — payload shape unrecognised",
    { keys: Object.keys(parsed || {}) },
  );
  return false;
}

/* ------------------------------------------------------------------ *
 * Webhook decryption + parsing
 * ------------------------------------------------------------------ */

/**
 * Decrypt a webhook envelope into flat CCAvenue fields.
 *
 * CONTRACT EXTENSION (not in REQUIRED_FUNCTIONS): consumed by webhookService's
 * decrypt-first branch. It exists because `parseWebhookEvent` receives NO
 * CONFIG — and therefore no working key — and so cannot decrypt anything by
 * itself. The webhook service calls this first and hands the result down.
 *
 * Never throws.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {Buffer|string} params.rawBody
 * @param {Object} [params.parsedBody]
 * @param {Object} [params.headers]
 * @returns {{ok: boolean, fields: Object|null, source: "webhook"}}
 */
function decryptEnvelope({ config, rawBody, parsedBody } = {}) {
  const failure = { ok: false, fields: null, source: "webhook" };

  try {
    const { workingKey } = requireCredentials(config);

    // Raw bytes first (authoritative); the framework-parsed body is only ever
    // used to LOCATE the envelope, never as the authenticated payload.
    const encPayload =
      findEncPayload(parseRawBody(rawBody)) || findEncPayload(parsedBody);

    if (!encPayload || !isHex(encPayload)) return failure;

    const plainText = decryptFromHex(encPayload, workingKey);
    const fields = parseParamString(plainText);

    if (Object.keys(fields).length === 0) return failure;

    return { ok: true, fields, source: "webhook" };
  } catch (_error) {
    return failure;
  }
}

/**
 * Normalise a decrypted CCAvenue notification into the webhook-service event
 * shape. SYNC and NEVER THROWS.
 *
 * Consumes `decrypted.fields` from `decryptEnvelope`. When `decrypted` is
 * absent we return the fully-nulled IGNORED shape rather than guessing at the
 * ciphertext — parsing a payload we could not authenticate is exactly how a
 * forged credit gets in.
 *
 * @param {Object} params
 * @param {Buffer|string} [params.rawBody]
 * @param {Object} [params.parsedBody]
 * @param {Object} [params.headers]
 * @param {{ok: boolean, fields: Object|null}} [params.decrypted]
 * @returns {Object}
 */
function parseWebhookEvent({ decrypted } = {}) {
  try {
    const fields =
      decrypted &&
      decrypted.ok &&
      decrypted.fields &&
      typeof decrypted.fields === "object"
        ? decrypted.fields
        : null;

    if (!fields) return ignoredEvent(null, null);

    const orderStatusRaw = trimmedOrNull(fields.order_status);
    const statusKey = orderStatusRaw ? orderStatusRaw.toLowerCase() : null;

    // Populated even for an UNRECOGNISED status so the value reaches the event
    // log and can be triaged instead of vanishing.
    const eventType = statusKey ? `ccavenue.order_status.${statusKey}` : null;
    const outcome =
      (statusKey && ORDER_STATUS_OUTCOMES[statusKey]) || OUTCOME.IGNORED;

    const providerPaymentId =
      trimmedOrNull(fields.tracking_id) || trimmedOrNull(fields.reference_no);
    const providerOrderId = trimmedOrNull(fields.order_id);

    // parseAmountToPaise returns null (never throws, never rounds) for a
    // malformed/non-finite amount. A null then makes the credit path's
    // paise-exact check REFUSE the credit and park the order — which is the
    // behaviour we want, not a best-effort guess at how much money moved.
    const amountPaise = parseAmountToPaise(fields.amount);

    return {
      providerEventId: buildEventId(
        statusKey,
        providerPaymentId,
        providerOrderId,
      ),
      eventType,
      outcome,
      providerOrderId,
      // CCAvenue has no payment-link primitive; always null by construction.
      providerLinkId: null,
      providerPaymentId,
      amountPaise: Number.isInteger(amountPaise) ? amountPaise : null,
      currency: trimmedOrNull(fields.currency),
      capturedAt: toIsoOrNull(fields.trans_date),
      // TODO(ccavenue-kit): confirm the failure field names
      // (status_code / status_message / failure_message).
      errorCode: trimmedOrNull(fields.status_code),
      errorDescription:
        trimmedOrNull(fields.failure_message) ||
        trimmedOrNull(fields.status_message),
      // The DECRYPTED fields, scrubbed of card-ish data. NEVER the hex.
      raw: scrubSensitiveFields(fields),
    };
  } catch (_error) {
    // parseWebhookEvent must never throw: a crash here turns a recoverable
    // payload into a gateway retry storm.
    return ignoredEvent(null, null);
  }
}

/**
 * The REPLAY-DEDUPE KEY.
 *
 * MUST BE DETERMINISTIC PER PAYMENT. CCAvenue retries its Dynamic Event
 * Notification, and the webhook service dedupes on this id alone. Anything
 * time-based (Date.now) or random (uuid) would make every retry look like a
 * brand-new event and CREDIT THE SAME MONEY TWICE. It is derived only from the
 * payment's own identifiers plus its status, so the same notification always
 * yields the same id, while a genuine status transition
 * (initiated -> success) correctly yields a different one.
 *
 * @returns {string|null}
 */
function buildEventId(statusKey, providerPaymentId, providerOrderId) {
  const subject = providerPaymentId || providerOrderId;
  if (!subject || !statusKey) return null;
  return `ccav_wh:${subject}:${statusKey}`;
}

function ignoredEvent(eventType, providerOrderId) {
  return {
    providerEventId: null,
    eventType: eventType || null,
    outcome: OUTCOME.IGNORED,
    providerOrderId: providerOrderId || null,
    providerLinkId: null,
    providerPaymentId: null,
    amountPaise: null,
    currency: null,
    capturedAt: null,
    errorCode: null,
    errorDescription: null,
    raw: null,
  };
}

/**
 * Gateway "notes" from a CCAvenue payload. The inverse of the
 * `merchant_param1..4` mapping performed by `createOrder`, consumed by
 * webhookService's per-provider notes delegation to adopt an orphan payment.
 * Non-contract extra export.
 *
 * @param {Object} raw decrypted+scrubbed fields (or a createOrder `raw`)
 * @returns {{walletUserId: string|null, clientCode: string|null, subjectUserId: string|null, kind: string|null}}
 */
function extractNotes(raw) {
  const fields = raw && typeof raw === "object" ? raw : {};

  return {
    walletUserId: trimmedOrNull(fields.merchant_param1),
    clientCode: trimmedOrNull(fields.merchant_param2),
    subjectUserId: trimmedOrNull(fields.merchant_param3),
    kind: trimmedOrNull(fields.merchant_param4),
  };
}

/* ------------------------------------------------------------------ *
 * Server-to-server status lookup
 * ------------------------------------------------------------------ */

/**
 * One `DoWebTrans` round trip.
 *
 * Throws only on TRANSPORT / HTTP / UNDECRYPTABLE failures. A BUSINESS-level
 * error (e.g. "order not found") is returned as data, because `testConnection`
 * treats exactly that as a SUCCESS signal (see below) while `fetchOrder`
 * treats it as a failure. Splitting the two lets both read the same call.
 *
 * TODO(ccavenue-kit): confirm field name order_no vs order_id, version, and
 * whether enc_request wraps JSON or a param string.
 *
 * @returns {Promise<{decrypted: boolean, payload: Object|null, plainText: string|null, responseFields: Object, encError: {code: string|null, description: string|null}|null}>}
 */
async function doWebTrans({ config, orderNo, operation }) {
  const { accessCode, workingKey } = requireCredentials(config);
  const { api } = resolveHosts(config);
  const url = `${api}/apis/servlet/DoWebTrans`;

  // TODO(ccavenue-kit): confirm enc_request wraps JSON (assumed here) rather
  // than a `k=v&k=v` param string, and confirm order_no vs order_id.
  const encRequest = encryptToHex(
    JSON.stringify({ order_no: orderNo }),
    workingKey,
  );

  const form = new URLSearchParams({
    request_type: "JSON",
    response_type: "JSON",
    version: "1.2",
    command: "orderStatusTracker",
    access_code: accessCode,
    enc_request: encRequest,
  });

  let response;
  try {
    response = await axios.post(url, form.toString(), {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "*/*",
      },
      responseType: "text",
      // Keep the raw text: the response is form-encoded, not JSON, and axios
      // would happily hand back a mangled object.
      transformResponse: [(data) => data],
      validateStatus: () => true,
    });
  } catch (error) {
    throw wrapCcavenueError(error, operation, { providerOrderId: orderNo });
  }

  const status = Number(response && response.status);
  const text = typeof response.data === "string" ? response.data : "";
  const responseFields = parseRawBody(text) || {};

  if (Number.isInteger(status) && status >= 400) {
    throw wrapCcavenueError(
      {
        httpStatus: status,
        code: responseFields.enc_error_code || `HTTP_${status}`,
        description:
          responseFields.error_desc || "CCAvenue returned an HTTP error",
      },
      operation,
      { providerOrderId: orderNo },
    );
  }

  const encResponse = findEncPayload(responseFields);

  if (!encResponse || !isHex(encResponse)) {
    return {
      decrypted: false,
      payload: null,
      plainText: null,
      responseFields,
      encError: {
        code: trimmedOrNull(responseFields.enc_error_code) || "NO_ENC_RESPONSE",
        description:
          trimmedOrNull(responseFields.error_desc) ||
          trimmedOrNull(responseFields.status_message) ||
          "CCAvenue returned no decryptable enc_response",
      },
    };
  }

  // Throws PROVIDER_RESPONSE_UNDECRYPTABLE when the working key is wrong.
  const plainText = decryptFromHex(encResponse, workingKey);

  let payload;
  try {
    payload = JSON.parse(plainText);
  } catch (_error) {
    // TODO(ccavenue-kit): confirm the response is JSON — some commands answer
    // with a `k=v&k=v` param string instead.
    payload = parseParamString(plainText);
  }

  return {
    decrypted: true,
    payload: payload && typeof payload === "object" ? payload : {},
    plainText: null, // never surfaced: it is decrypted gateway data
    responseFields,
    encError: null,
  };
}

/**
 * CCAvenue nests the order under a result envelope whose key has been observed
 * with several casings. Flatten defensively.
 * TODO(ccavenue-kit): confirm the orderStatusTracker response envelope key.
 */
function unwrapOrderPayload(payload) {
  if (!payload || typeof payload !== "object") return {};

  const candidates = [
    "Order_Status_Result",
    "order_status_result",
    "orderStatusResult",
    "Order_Result",
  ];

  for (const key of candidates) {
    const node = payload[key];
    if (node && typeof node === "object" && !Array.isArray(node)) return node;
  }

  return payload;
}

function isSuccessStatus(orderStatus) {
  return (
    typeof orderStatus === "string" &&
    orderStatus.trim().toLowerCase() === "success"
  );
}

/**
 * Server-to-server order status lookup — the ONLY source of truth for whether
 * money actually moved. The browser return payload is never enough (see
 * verifyClientSignature).
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {string} params.providerOrderId
 * @returns {Promise<{providerOrderId: string, status: string|null, amountPaise: number|null, amountPaidPaise: number|null, amountDuePaise: null, currency: string|null, receipt: string|null, createdAt: string|null, raw: Object}>}
 */
async function fetchOrder({ config, providerOrderId } = {}) {
  if (typeof providerOrderId !== "string" || !providerOrderId.trim()) {
    throw new APIError(
      "providerOrderId is required",
      400,
      "INVALID_PROVIDER_REFERENCE",
    );
  }

  const orderNo = providerOrderId.trim();
  const result = await doWebTrans({ config, orderNo, operation: "fetchOrder" });

  if (!result.decrypted) {
    const { code, description } = result.encError || {};
    throw wrapCcavenueError(
      {
        // An auth-ish gateway rejection is OUR misconfiguration -> 502.
        httpStatus: isAuthishError(code, description) ? 401 : 502,
        code,
        description,
      },
      "fetchOrder",
      { providerOrderId: orderNo },
    );
  }

  const order = unwrapOrderPayload(result.payload);

  const errorCode =
    trimmedOrNull(order.enc_error_code) || trimmedOrNull(order.error_code);
  if (errorCode) {
    const description =
      trimmedOrNull(order.error_desc) ||
      trimmedOrNull(order.status_message) ||
      "CCAvenue rejected the order status lookup";
    throw wrapCcavenueError(
      {
        httpStatus: isAuthishError(errorCode, description) ? 401 : 502,
        code: errorCode,
        description,
      },
      "fetchOrder",
      { providerOrderId: orderNo },
    );
  }

  const orderStatus = trimmedOrNull(order.order_status);
  const amountPaise = parseAmountToPaise(
    order.order_bill_amount === null || order.order_bill_amount === undefined
      ? order.amount
      : order.order_bill_amount,
  );
  const paid = isSuccessStatus(orderStatus);

  return {
    providerOrderId:
      trimmedOrNull(order.order_no) || trimmedOrNull(order.order_id) || orderNo,
    status: orderStatus,
    amountPaise: Number.isInteger(amountPaise) ? amountPaise : null,
    amountPaidPaise: paid && Number.isInteger(amountPaise) ? amountPaise : 0,
    // CCAvenue has no partial-capture concept in this flow.
    amountDuePaise: null,
    currency:
      trimmedOrNull(order.currency) || resolveCurrency(config, undefined),
    receipt: trimmedOrNull(order.order_id) || orderNo,
    createdAt: toIsoOrNull(order.order_date_time || order.trans_date),
    raw: scrubSensitiveFields(order),
  };
}

/**
 * Fetch a "payment".
 *
 * CCAvenue keys status lookups on the ORDER, so this delegates to
 * `fetchOrder()` and then NORMALISES DELIBERATELY INTO RAZORPAY'S PAYMENT
 * SHAPE. That single normalisation is what makes topupService.pollProvider's
 * hard-coded `payment.captured === true && payment.status === "captured"` work
 * unchanged — and with it `getOrderWithLiveStatus`, `refreshFromProvider` and
 * the reconcile worker, none of which need a CCAvenue branch.
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @param {string} [params.providerPaymentId] CCAvenue tracking_id / reference_no
 * @param {string} [params.providerOrderId] preferred lookup key
 * @returns {Promise<{providerPaymentId: string|null, providerOrderId: string|null, status: string|null, captured: boolean, amountPaise: number|null, currency: string|null, capturedAt: string|null, raw: Object}>}
 */
async function fetchPayment({
  config,
  providerPaymentId,
  providerOrderId,
} = {}) {
  const orderRef = trimmedOrNull(providerOrderId);

  if (!orderRef) {
    throw new APIError(
      "CCAvenue looks payments up by order: providerOrderId is required",
      400,
      "INVALID_PROVIDER_REFERENCE",
    );
  }

  const order = await fetchOrder({ config, providerOrderId: orderRef });
  const raw = order.raw && typeof order.raw === "object" ? order.raw : {};

  const orderStatus = trimmedOrNull(raw.order_status);
  // Compared case-insensitively: CCAvenue's casing has been observed to vary
  // between the redirect payload ("Success") and the API ("SUCCESS").
  const captured = isSuccessStatus(orderStatus);

  return {
    providerPaymentId:
      trimmedOrNull(raw.reference_no) ||
      trimmedOrNull(raw.tracking_id) ||
      trimmedOrNull(providerPaymentId),
    providerOrderId: order.providerOrderId,
    // "captured" is Razorpay's vocabulary, mapped here on purpose.
    status: captured
      ? "captured"
      : orderStatus
        ? orderStatus.toLowerCase()
        : null,
    captured,
    amountPaise: order.amountPaise,
    currency: order.currency,
    capturedAt: toIsoOrNull(raw.trans_date) || order.createdAt,
    raw,
  };
}

/* ------------------------------------------------------------------ *
 * Connectivity test
 * ------------------------------------------------------------------ */

/**
 * Prove all three credentials in one call — NEVER THROWS.
 *
 * We ask `orderStatusTracker` about an order that cannot exist. The trick is
 * that a DECRYPTABLE RESPONSE — INCLUDING A BUSINESS-LEVEL "order not found" —
 * is itself the proof we want:
 *   - the merchant id + access code were accepted, else the gateway would not
 *     have processed the request at all;
 *   - the response decrypted, so the working key is right.
 * A decrypt failure means the working key is wrong even though everything else
 * was accepted, which is the single most common CCAvenue misconfiguration and
 * deserves its own message rather than a generic "connection failed".
 *
 * @param {Object} params
 * @param {ResolvedProviderConfig} params.config
 * @returns {Promise<{ok: boolean, message: string, accountHint: string|null, latencyMs: number}>}
 */
async function testConnection({ config } = {}) {
  const startedAt = Date.now();

  let merchantId = null;
  try {
    ({ merchantId } = requireCredentials(config));
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      accountHint: null,
      latencyMs: Date.now() - startedAt,
    };
  }

  const orderNo = `CONNTEST-${merchantId}-0`;

  try {
    const result = await doWebTrans({
      config,
      orderNo,
      operation: "testConnection",
    });

    if (result.decrypted) {
      return {
        ok: true,
        message:
          "CCAvenue credentials verified — merchant id, access code and working key all accepted",
        accountHint: merchantId,
        latencyMs: Date.now() - startedAt,
      };
    }

    const { code, description } = result.encError || {};
    return {
      ok: false,
      message: isAuthishError(code, description)
        ? `CCAvenue rejected the merchant id or access code [${code}]: ${description}`
        : `CCAvenue returned no decryptable response [${code}]: ${description}`,
      accountHint: merchantId,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const isUndecryptable =
      error &&
      (error.code === "PROVIDER_RESPONSE_UNDECRYPTABLE" ||
        error.code === "PROVIDER_RESPONSE_INVALID");

    return {
      ok: false,
      message: isUndecryptable
        ? "Working key rejected — the response could not be decrypted"
        : error && error.message
          ? error.message
          : "CCAvenue connection test failed",
      accountHint: merchantId,
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * No-op. This provider is fully stateless (no SDK instance to cache), but
 * providerConfigService.invalidateConfigCache calls `resetInstanceCache()` on
 * every provider that exposes it, so the shape is kept uniform rather than
 * making the caller special-case CCAvenue.
 */
function resetInstanceCache() {
  // intentionally empty
}

/* ------------------------------------------------------------------ *
 * Contract export
 * ------------------------------------------------------------------ */

module.exports = {
  // MUST match the registry key in ./index.js exactly.
  name: PROVIDER_NAME,
  supports: {
    orders: true,
    paymentLinks: false,
    refunds: false,
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

  // Contract EXTENSION: webhookService's decrypt-first branch.
  decryptEnvelope,

  // Non-contract extras.
  resetInstanceCache,
  extractNotes,

  // Exported for the webhook service + tests.
  OUTCOME,
  ORDER_STATUS_OUTCOMES,
};
