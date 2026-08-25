/**
 * Secret Crypto — AES-256-GCM envelope encryption for payment credentials at rest.
 *
 * WHY GCM (and not the existing CBC precedent):
 * The only prior crypto-at-rest precedent in this repo is
 * `backend/license-service/controllers/licenseController.js:93-117`, which uses
 * aes-256-cbc with a hardcoded "salt" and stores { encrypted, iv } as two
 * columns. CBC is unauthenticated: a tampered ciphertext decrypts to garbage
 * (or padding-errors) rather than being *detected*. Payment gateway API secrets
 * and webhook secrets are live-money credentials, so we deliberately upgrade to
 * AES-256-GCM, which carries a 16-byte auth tag and fails loudly on any
 * tampering or key mismatch. We also store everything in ONE string column via
 * a versioned envelope, so key/algorithm rotation is a prefix bump.
 *
 * Envelope format:  "v1:<ivHex>:<authTagHex>:<cipherHex>"
 *
 * Key derivation: scrypt(PAYMENT_SECRET_ENC_KEY, "wallet-payment-secrets", 32).
 * The raw env value is NEVER used directly as a key.
 *
 * FAIL-CLOSED: getEncryptionKey() throws when PAYMENT_SECRET_ENC_KEY is unset
 * or too short. Same shape as `getSecret()` in
 * `backend/shipment-service/services/quoteSigningService.js`. We never fall back
 * to a default key — a default key on a payment credential store is worse than
 * an outage, because it silently makes every stored secret readable.
 */

const crypto = require("crypto");

const ENVELOPE_VERSION = "v1";
const KEY_SALT = "wallet-payment-secrets";
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard nonce size
const MIN_RAW_KEY_LENGTH = 32;
const ALGORITHM = "aes-256-gcm";

/**
 * Resolve the derived 32-byte AES key. Fail-closed.
 *
 * @returns {Buffer} 32-byte key
 * @throws {Error} when PAYMENT_SECRET_ENC_KEY is missing or too short
 */
function getEncryptionKey() {
  const rawKey = process.env.PAYMENT_SECRET_ENC_KEY;

  if (!rawKey) {
    throw new Error(
      "PAYMENT_SECRET_ENC_KEY is not configured — payment gateway credentials cannot be encrypted or decrypted",
    );
  }

  if (rawKey.length < MIN_RAW_KEY_LENGTH) {
    throw new Error(
      `PAYMENT_SECRET_ENC_KEY is too short (${rawKey.length} chars) — it must be at least ${MIN_RAW_KEY_LENGTH} characters`,
    );
  }

  return crypto.scryptSync(rawKey, KEY_SALT, KEY_LENGTH);
}

/**
 * Encrypt a plaintext secret into a versioned envelope string.
 *
 * @param {string} plaintext - the raw secret (e.g. a Razorpay key_secret)
 * @returns {string} "v1:<ivHex>:<authTagHex>:<cipherHex>"
 * @throws {Error} on missing/invalid input or missing key
 */
function encryptSecret(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptSecret requires a non-empty string");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const cipherText = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("hex"),
    authTag.toString("hex"),
    cipherText.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a versioned envelope back to plaintext.
 *
 * @param {string} envelope - "v1:<ivHex>:<authTagHex>:<cipherHex>"
 * @returns {string} plaintext secret
 * @throws {Error} with an operator-actionable message when decryption fails
 */
function decryptSecret(envelope) {
  if (typeof envelope !== "string" || envelope.length === 0) {
    throw new Error("decryptSecret requires a non-empty envelope string");
  }

  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
    throw new Error(
      "Stored payment credential is not in the expected encrypted format — re-enter the credentials in Settings › Payments",
    );
  }

  const [, ivHex, authTagHex, cipherHex] = parts;

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, "hex")),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  } catch (error) {
    // A GCM auth-tag failure here almost always means the env key changed.
    // Never leak the ciphertext or the underlying error detail to the caller.
    const err = new Error(
      "Failed to decrypt the stored payment credential. The encryption key (PAYMENT_SECRET_ENC_KEY) may have been rotated — the credentials must be re-entered in Settings › Payments.",
    );
    err.cause = error;
    err.code = "PAYMENT_SECRET_DECRYPT_FAILED";
    throw err;
  }
}

/**
 * Mask a plaintext secret for display / logging.
 * e.g. "rzp_live_ABCDEF1234f2a" -> "rzp_live_••••••4f2a"
 *
 * @param {string} plaintext
 * @returns {string|null} masked value, or null for empty input
 */
function maskSecret(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    return null;
  }

  const last4 = plaintext.slice(-4);

  // Keep a recognizable prefix when the secret has one (rzp_live_, rzp_test_,
  // sk_live_, ...). Otherwise fall back to the first 2 characters.
  const prefixMatch = plaintext.match(/^([a-zA-Z]+_[a-zA-Z]+_)/);
  let prefix = prefixMatch ? prefixMatch[1] : plaintext.slice(0, 2);

  // Never reveal more than we hide on short secrets.
  if (prefix.length + last4.length >= plaintext.length) {
    prefix = "";
    return `••••••${last4}`;
  }

  return `${prefix}••••••${last4}`;
}

/**
 * Is this value already an encrypted envelope?
 *
 * @param {*} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  const parts = value.split(":");
  return (
    parts.length === 4 &&
    parts[0] === ENVELOPE_VERSION &&
    /^[0-9a-f]+$/i.test(parts[1]) &&
    /^[0-9a-f]+$/i.test(parts[2]) &&
    /^[0-9a-f]+$/i.test(parts[3])
  );
}

module.exports = {
  getEncryptionKey,
  encryptSecret,
  decryptSecret,
  maskSecret,
  isEncrypted,
  ENVELOPE_VERSION,
};
