/**
 * CCAvenue Crypto / Serialisation Core
 *
 * Pure functions implementing CCAvenue's non-seamless (redirect) request and
 * response codec. This module is the ONLY place that knows how CCAvenue turns a
 * parameter string into `encRequest` / reads back `encResp`.
 *
 * CONTRACT RULES honoured here:
 *  - PURE: no I/O, no DB, no `process.env`, no logger. Every function takes its
 *    inputs and returns a value. The working key always arrives as an argument,
 *    already decrypted and mode-selected by the provider config service.
 *  - NO SECRET LOGGING / NO SECRET IN ERRORS: the working key, the derived AES
 *    key and any ciphertext must NEVER appear in an error message. Error
 *    messages here are deliberately content-free.
 *  - INTEGER PAISE INTERNALLY: rupee strings only ever exist at the CCAvenue
 *    boundary. Everything upstream speaks integer paise.
 *
 * ============================ PROTOCOL NOTES ============================
 * These are CCAvenue's choices, not ours. Several of them look wrong to a
 * modern eye; all of them are load-bearing.
 *
 *  1. AES-128-CBC with PKCS7 padding.
 *
 *  2. THE KEY IS THE RAW 16-BYTE MD5 DIGEST OF THE WORKING KEY.
 *     Not the working key itself, and NOT its 32-character hex string.
 *     This is the single most common CCAvenue integration failure: feeding the
 *     32-char hex STRING to `crypto.createCipheriv` gives Node a 32-byte key,
 *     which silently selects a perfectly valid AES-256 setup. Everything
 *     encrypts and round-trips locally, and CCAvenue simply cannot decrypt any
 *     of it. The symptom is "the gateway rejects everything" with no useful
 *     error anywhere. `deriveKey()` below returns the raw digest Buffer, and
 *     the test suite pins this with an explicit assertion that the derived key
 *     is NOT the utf8 bytes of the hex string.
 *
 *  3. THE IV IS A FIXED 16 BYTES: 0x00 0x01 0x02 ... 0x0f.
 *     Not random, not zeroed. This is CCAvenue's protocol and is not our
 *     choice — it is baked into their merchant kits and is required for them to
 *     decrypt us. A consequence is that encryption is DETERMINISTIC (the same
 *     plaintext always yields the same ciphertext). Do not "fix" this.
 *
 *  4. Ciphertext is transported as LOWERCASE HEX.
 *
 *  5. The plaintext is a raw `key=value&key=value` string that is NOT
 *     URL-ENCODED. CCAvenue's own kits concatenate raw values; encoding them
 *     produces a double-encoded string on their side and is another classic
 *     silent failure. Because nothing is encoded, a value that itself contains
 *     `&` or `=` would corrupt the parameter string — `buildParamString()`
 *     therefore REJECTS such values loudly rather than emitting a string that
 *     parses into garbage on the far end.
 *     TODO: confirm against the merchant integration kit that raw (unencoded)
 *     values are what their `Crypto.php` / `Crypto.java` expects.
 *
 *  6. Amounts are decimal rupee STRINGS with exactly two decimal places
 *     ("1499.00"). Never a float (binary rounding), and never
 *     `Number.prototype.toString()` which yields "1499" and has been observed
 *     to fail merchant-side validation.
 *
 * @module services/payments/ccavenueCrypto
 */

const crypto = require("crypto");

const { APIError } = require("../../shared/lib/errors");

/**
 * CCAvenue's fixed initialisation vector: bytes 0x00..0x0f.
 * PROTOCOL CONSTANT — not our choice, not a security parameter. See note 3.
 * @type {Buffer}
 */
const CCAVENUE_IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
  0x0d, 0x0e, 0x0f,
]);

const AES_ALGORITHM = "aes-128-cbc";

/**
 * Response fields that must NEVER be persisted into
 * `payment_webhook_events.payload` (or any audit row, or any log line).
 *
 * This list is a STARTING POINT built from the plausible card-ish keys in
 * CCAvenue's documented response set. Scrubbing is deliberately DEFENSIVE
 * rather than exhaustive: we cannot enumerate a payload we have not seen in
 * production, so unknown keys pass through untouched and known-sensitive keys
 * are DROPPED ENTIRELY (not masked — a mask still tells an attacker the field
 * existed and how long it was).
 *
 * @type {string[]}
 */
const SENSITIVE_RESPONSE_FIELDS = [
  // TODO: confirm the actual CCAvenue response field list
  "card_name",
  // TODO: confirm the actual CCAvenue response field list
  "card_number",
  // TODO: confirm the actual CCAvenue response field list
  "cardholder_name",
  // TODO: confirm the actual CCAvenue response field list
  "bank_receipt",
  // TODO: confirm the actual CCAvenue response field list
  "card_holder_name",
];

const SENSITIVE_RESPONSE_FIELD_SET = new Set(
  SENSITIVE_RESPONSE_FIELDS.map((field) => field.toLowerCase()),
);

/**
 * Even-length hex string test.
 *
 * @param {*} value
 * @returns {boolean} true when `value` is a non-empty, even-length string of
 *   hex digits (either case accepted — we emit lowercase but tolerate whatever
 *   the gateway sends back).
 */
function isHex(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length % 2 === 0 &&
    /^[0-9a-fA-F]+$/.test(value)
  );
}

/**
 * Derive the 16-byte AES key from the merchant working key.
 *
 * THE KEY IS THE RAW MD5 DIGEST — see protocol note 2 at the top of this file.
 * Passing the working key directly, or its 32-character hex string, produces a
 * setup CCAvenue cannot decrypt while looking entirely healthy locally.
 *
 * @param {string} workingKey Merchant working key (plaintext, already decrypted
 *   by the config service).
 * @returns {Buffer} 16-byte AES-128 key.
 * @throws {APIError} 400 PROVIDER_CONFIG_INVALID when the working key is absent
 *   or not a non-empty string. The message never echoes the value.
 */
function deriveKey(workingKey) {
  if (typeof workingKey !== "string" || workingKey.length === 0) {
    throw new APIError(
      "CCAvenue working key is missing or malformed",
      400,
      "PROVIDER_CONFIG_INVALID",
    );
  }

  // Raw digest Buffer (16 bytes). NOT .digest("hex").
  return crypto.createHash("md5").update(workingKey, "utf8").digest();
}

/**
 * Encrypt a parameter string for transport as `encRequest`.
 *
 * Deterministic by protocol (fixed IV). Do not treat the ciphertext as
 * semantically secure against a chosen-plaintext adversary; it is an
 * interoperability format, and its confidentiality rests on the working key
 * being a shared secret.
 *
 * @param {string} plainText Raw `key=value&key=value` string (NOT url-encoded).
 * @param {string} workingKey Merchant working key.
 * @returns {string} lowercase hex ciphertext.
 * @throws {APIError} 400 PROVIDER_REQUEST_INVALID when `plainText` is not a
 *   string. Never includes the plaintext or the key.
 */
function encryptToHex(plainText, workingKey) {
  if (typeof plainText !== "string") {
    throw new APIError(
      "CCAvenue request payload must be a string",
      400,
      "PROVIDER_REQUEST_INVALID",
    );
  }

  const key = deriveKey(workingKey);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, CCAVENUE_IV);
  cipher.setAutoPadding(true); // PKCS7 — explicit for the next reader.

  return Buffer.concat([
    cipher.update(Buffer.from(plainText, "utf8")),
    cipher.final(),
  ]).toString("hex");
}

/**
 * Decrypt an `encResp` / `encRequest` hex payload.
 *
 * A THROW HERE IS A MEANINGFUL AUTHENTICITY SIGNAL, not just a parse failure.
 * Only CCAvenue and this service hold the working key, so a payload that
 * decrypts cleanly with correct PKCS7 padding is strong evidence it came from
 * CCAvenue. Callers should treat a throw as "reject / park this webhook", never
 * as "retry with different parsing".
 *
 * @param {string} hexText Hex ciphertext as received.
 * @param {string} workingKey Merchant working key.
 * @returns {string} utf8 plaintext parameter string.
 * @throws {APIError} 400 PROVIDER_RESPONSE_INVALID when the input is not hex,
 *   or 400 PROVIDER_RESPONSE_UNDECRYPTABLE when the key is wrong or the padding
 *   is bad. Neither message includes the ciphertext or any key material.
 */
function decryptFromHex(hexText, workingKey) {
  if (!isHex(hexText)) {
    throw new APIError(
      "CCAvenue response payload is not valid hex",
      400,
      "PROVIDER_RESPONSE_INVALID",
    );
  }

  const key = deriveKey(workingKey);

  try {
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, CCAVENUE_IV);
    decipher.setAutoPadding(true);

    return Buffer.concat([
      decipher.update(Buffer.from(hexText, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch (_error) {
    // Deliberately swallow the underlying OpenSSL message and attach nothing
    // from the input: a padding-oracle-shaped error string plus the ciphertext
    // in a log is exactly what we do not want to hand out.
    throw new APIError(
      "CCAvenue response could not be decrypted (wrong key or corrupt payload)",
      400,
      "PROVIDER_RESPONSE_UNDECRYPTABLE",
    );
  }
}

/**
 * Parse a raw CCAvenue parameter string into a flat object.
 *
 * NEVER THROWS. This runs on webhook input we do not control, and the caller
 * must be able to decide what to do with an unusable payload (park it) rather
 * than have the request blow up. Unusable input yields `{}`.
 *
 * Semantics:
 *  - values are NOT url-decoded (they were never encoded — protocol note 5);
 *  - empty segments (`a=1&&b=2`) are skipped;
 *  - a segment with no `=` is skipped;
 *  - only the FIRST `=` splits, so `a=b=c` yields `{a: "b=c"}`;
 *  - duplicate keys: LAST WINS.
 *
 * @param {string} text
 * @returns {Object<string,string>}
 */
function parseParamString(text) {
  const result = {};

  if (typeof text !== "string" || text.length === 0) {
    return result;
  }

  const segments = text.split("&");

  for (const segment of segments) {
    if (!segment) {
      continue; // empty segment from a leading/trailing/doubled '&'
    }

    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0) {
      continue; // no '=' at all, or a segment starting with '=' (empty key)
    }

    const key = segment.slice(0, separatorIndex);
    const value = segment.slice(separatorIndex + 1);

    result[key] = value; // last wins
  }

  return result;
}

/**
 * Build a raw CCAvenue parameter string from a flat object.
 *
 * Values are emitted RAW — no url-encoding (protocol note 5). Because of that,
 * a value containing `&` or `=` would silently split into extra parameters on
 * CCAvenue's side and corrupt the whole request (imagine an address line, or a
 * billing name with an ampersand). We refuse loudly instead. Callers must
 * sanitise such values upstream — never by encoding them here, which would
 * double-encode.
 *
 * `null` / `undefined` values are skipped entirely. Numbers and booleans are
 * stringified (amounts must already be `formatAmount()` output).
 *
 * @param {Object} obj
 * @returns {string} `a=1&b=2`
 * @throws {APIError} 400 PROVIDER_REQUEST_INVALID for a non-object input, a key
 *   containing `&`/`=`, or a value containing `&`/`=`. The message names the
 *   offending KEY only — never the value, which may be customer data.
 */
function buildParamString(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    throw new APIError(
      "CCAvenue parameters must be a plain object",
      400,
      "PROVIDER_REQUEST_INVALID",
    );
  }

  const parts = [];

  for (const [key, rawValue] of Object.entries(obj)) {
    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    if (key.includes("&") || key.includes("=")) {
      throw new APIError(
        "CCAvenue parameter name contains a reserved character",
        400,
        "PROVIDER_REQUEST_INVALID",
      );
    }

    const value = String(rawValue);

    if (value.includes("&") || value.includes("=")) {
      // Name the key, never the value.
      throw new APIError(
        `CCAvenue parameter "${key}" contains a reserved character ("&" or "=")`,
        400,
        "PROVIDER_REQUEST_INVALID",
      );
    }

    parts.push(`${key}=${value}`);
  }

  return parts.join("&");
}

/**
 * Integer paise -> CCAvenue rupee string with exactly two decimals.
 *
 * Pure integer arithmetic: no division into a float, so no binary rounding can
 * shift a paisa. `formatAmount(149900) === "1499.00"`.
 *
 * @param {number} amountPaise Positive integer paise.
 * @returns {string} e.g. "1499.00"
 * @throws {APIError} 400 INVALID_AMOUNT for a non-integer, zero, or negative
 *   amount. A zero-value payment order is always a bug upstream.
 */
function formatAmount(amountPaise) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new APIError(
      "Amount must be a positive integer number of paise",
      400,
      "INVALID_AMOUNT",
    );
  }

  const rupees = Math.floor(amountPaise / 100);
  const paise = amountPaise % 100;

  return `${rupees}.${String(paise).padStart(2, "0")}`;
}

/**
 * CCAvenue rupee string -> integer paise.
 *
 * RETURNS `null` INSTEAD OF THROWING. This is called from the webhook path,
 * where `creditOrder`'s paise-exact amount check must be able to REFUSE a
 * mismatched or malformed amount by parking the order for manual review. A
 * throw here would crash the webhook handler and turn a recoverable
 * discrepancy into a retry storm.
 *
 * Parsed as a decimal STRING, never via `parseFloat` — `parseFloat("1499.99")`
 * times 100 is 149998.99999999999. More than two decimal places is treated as
 * unparseable rather than rounded: we cannot silently invent a paise value.
 *
 * @param {string|number} amountString e.g. "1499.00", "1499", 1499
 * @returns {number|null} integer paise, or null if unparseable / negative /
 *   non-finite.
 */
function parseAmountToPaise(amountString) {
  let text;

  if (typeof amountString === "number") {
    if (!Number.isFinite(amountString) || amountString < 0) {
      return null;
    }
    text = String(amountString);
  } else if (typeof amountString === "string") {
    text = amountString.trim();
  } else {
    return null;
  }

  if (text.length === 0) {
    return null;
  }

  // Optional leading '+', digits, optional '.' with 1-2 digits. A leading '-'
  // is intentionally NOT matched: negative gateway amounts are nonsense.
  const match = /^\+?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    return null;
  }

  const rupees = Number(match[1]);
  const fraction = (match[2] || "").padEnd(2, "0");
  const paise = Number(fraction);

  const total = rupees * 100 + paise;

  if (!Number.isSafeInteger(total)) {
    return null;
  }

  return total;
}

/**
 * Strip fields that must never be persisted into
 * `payment_webhook_events.payload`.
 *
 * Defensive, not exhaustive: unknown keys PASS THROUGH (we cannot enumerate a
 * payload we have not seen), known-sensitive keys are DROPPED ENTIRELY rather
 * than masked. Key matching is case-insensitive because the gateway's casing is
 * not something we should have to trust.
 *
 * Returns a NEW object; the input is never mutated.
 *
 * @param {Object} fields
 * @returns {Object} a shallow copy without the sensitive keys.
 */
function scrubSensitiveFields(fields) {
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    return {};
  }

  const scrubbed = {};

  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_RESPONSE_FIELD_SET.has(String(key).toLowerCase())) {
      continue; // dropped entirely — no masked placeholder left behind
    }
    scrubbed[key] = value;
  }

  return scrubbed;
}

module.exports = {
  CCAVENUE_IV,
  SENSITIVE_RESPONSE_FIELDS,
  deriveKey,
  encryptToHex,
  decryptFromHex,
  parseParamString,
  buildParamString,
  formatAmount,
  parseAmountToPaise,
  scrubSensitiveFields,
  isHex,
};
