/**
 * Quote Signing Service
 *
 * HMAC-signed quote tokens close the quoteSnapshot tampering hole: the wallet
 * debit amount (systemCharge) comes from VERIFIED token claims issued by
 * getShipmentQuotes, never from the client-supplied snapshot.
 *
 * Token format: base64url(claimsJson) + "." + base64url(hmacSha256(claims))
 * Claims: { v, partnerId, totalAmount, chargeableWeight, volumetricDivisor,
 *           fromPincode, toPincode, weight, paymentType, codAmount,
 *           shipmentType, serviceType, vasHash, iat, exp }
 *
 * The outlet markup IS part of the token (charges-engine v3): it is priced as
 * a taxable line inside totalAmount, so the signed total already contains it
 * and markupAmount rides along for the OutletEarning ledger. It is still
 * resolved and cap-checked server-side (markupService) before quoting.
 */

const crypto = require("crypto");
const { ValidationError } = require("../shared/lib/errors");

const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 15 * 60;

function getSecret() {
  const secret = process.env.QUOTE_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "QUOTE_SIGNING_SECRET is not configured — quote tokens cannot be issued/verified",
    );
  }
  return secret;
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hmac(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest();
}

/**
 * Canonical hash of vasSelections so create-time answers must match the
 * answers the quote was priced with.
 */
function hashVasSelections(vasSelections = []) {
  if (!Array.isArray(vasSelections) || vasSelections.length === 0) {
    return "none";
  }
  const canonical = [...vasSelections]
    .map((s) => ({ chargeCode: s.chargeCode, answer: s.answer }))
    .sort((a, b) => a.chargeCode.localeCompare(b.chargeCode));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 24);
}

/**
 * Sign one quote for later verification at shipment creation.
 *
 * @param {Object} quote - normalized quote ({ partnerId, totalAmount, chargeableWeight, volumetricDivisor })
 * @param {Object} params - the quote request params
 * @param {Array} vasSelections
 * @returns {string} quoteToken
 */
function signQuote(quote, params, vasSelections = []) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    v: TOKEN_VERSION,
    partnerId: quote.partnerId,
    totalAmount: Number(quote.totalAmount),
    chargeableWeight: Number(quote.chargeableWeight),
    volumetricDivisor: quote.volumetricDivisor ?? null,
    fromPincode: params.fromPincode,
    toPincode: params.toPincode,
    weight: Number(params.weight),
    paymentType: params.paymentType || "PREPAID",
    codAmount:
      (params.paymentType || "PREPAID") === "COD"
        ? Number(params.codAmount) || 0
        : 0,
    shipmentType: params.shipmentType || "B2C",
    serviceType: params.serviceType || "STANDARD",
    vasHash: hashVasSelections(vasSelections),
    // Outlet markup is priced INSIDE totalAmount by the charges engine, so it
    // is signed along with it: the booking cannot invent a different margin
    // than the one the customer was quoted.
    markupType: params.markupType || null,
    markupValue: params.markupValue ?? null,
    markupAmount: Number(params.markupAmount) || 0,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  const payload = b64url(JSON.stringify(claims));
  const signature = b64url(hmac(payload));
  return `${payload}.${signature}`;
}

/**
 * Verify a quote token's signature and expiry, returning its claims.
 * Throws ValidationError on tamper; returns { claims, expired } so the caller
 * can run the stale-quote re-verification path on expiry.
 */
function verifyQuoteToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    throw new ValidationError("Invalid quote token format");
  }

  const [payload, signature] = token.split(".");
  const expected = b64url(hmac(payload));

  const sigBuf = fromB64url(signature);
  const expBuf = fromB64url(expected);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    throw new ValidationError("Quote token signature verification failed");
  }

  let claims;
  try {
    claims = JSON.parse(fromB64url(payload).toString("utf8"));
  } catch (error) {
    throw new ValidationError("Quote token payload is not valid JSON");
  }

  if (claims.v !== TOKEN_VERSION) {
    throw new ValidationError(`Unsupported quote token version: ${claims.v}`);
  }

  const now = Math.floor(Date.now() / 1000);
  return { claims, expired: now > claims.exp };
}

/**
 * Assert the create-shipment payload matches the verified claims.
 * Throws ValidationError listing every mismatched field.
 */
function assertClaimsMatchPayload(claims, payload) {
  const mismatches = [];
  const check = (field, claimValue, payloadValue) => {
    if (String(claimValue) !== String(payloadValue)) {
      mismatches.push(
        `${field}: quoted with ${claimValue}, booking has ${payloadValue}`,
      );
    }
  };

  check("partnerId", claims.partnerId, payload.partnerId);
  check("fromPincode", claims.fromPincode, payload.fromPincode);
  check("toPincode", claims.toPincode, payload.toPincode);
  check("weight", claims.weight, Number(payload.weight));
  check("paymentType", claims.paymentType, payload.paymentType || "PREPAID");
  check("shipmentType", claims.shipmentType, payload.shipmentType || "B2C");
  check(
    "codAmount",
    claims.codAmount,
    (payload.paymentType || "PREPAID") === "COD"
      ? Number(payload.codAmount) || 0
      : 0,
  );
  check(
    "vasSelections",
    claims.vasHash,
    hashVasSelections(payload.vasSelections),
  );

  if (mismatches.length > 0) {
    throw new ValidationError(
      `Booking does not match the quoted shipment: ${mismatches.join("; ")}`,
    );
  }
}

module.exports = {
  signQuote,
  verifyQuoteToken,
  assertClaimsMatchPayload,
  hashVasSelections,
  TOKEN_TTL_SECONDS,
};
