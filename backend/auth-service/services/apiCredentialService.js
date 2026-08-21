/**
 * API Credential Service
 *
 * Owns the lifecycle of External API credentials: secret generation/verification,
 * resolution of the frozen acting principal, token minting, and revocation.
 *
 * Design note — one credential, one acting principal:
 * A credential stores `actingUserId` / `actingPhone` / `outletId`, all resolved
 * ONCE at creation. Tokens are always minted for that principal, so the
 * existing shipment controllers need no changes: `applyScopeFilter()` scopes
 * the data and `resolveOutletContext()` finds its wallet context without the
 * caller passing anything. A superadmin creating a key "for outlet X" produces
 * a key that acts AS outlet X, not as the superadmin.
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { getRedisClient } = require("../config/redis");
const {
  getPermissionsForRole,
  matchesPermission,
} = require("../shared/constants/permissions");

const EXTERNAL_API_AUDIENCE = "external-api";
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour; clients re-mint, there is no refresh token
const BCRYPT_ROUNDS = 12;
const CURRENT_API_VERSION = "2026-08-21";

/**
 * Generate a public client id, e.g. "lgk_live_9f2a...".
 * @param {string} environment - "live" | "test"
 */
function generateClientId(environment = "live") {
  return `lgk_${environment}_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Generate a plaintext secret. Returned to the caller exactly once.
 * @param {string} environment - "live" | "test"
 */
function generateClientSecret(environment = "live") {
  return `sk_${environment}_${crypto.randomBytes(24).toString("hex")}`;
}

async function hashSecret(secret) {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

/**
 * A real bcrypt hash of a random value, computed once at startup.
 *
 * Used as the comparison target when the supplied clientId does not exist, so
 * an unknown client id costs the same wall-clock time as a wrong secret and
 * cannot be distinguished by timing. It must be a genuine hash - bcrypt
 * rejects a malformed one immediately, which would reintroduce the very timing
 * signal this exists to remove.
 */
const DECOY_HASH = bcrypt.hashSync(
  crypto.randomBytes(24).toString("hex"),
  BCRYPT_ROUNDS,
);

function getDecoyHash() {
  return DECOY_HASH;
}

/**
 * Constant-time-ish secret verification (bcrypt.compare is constant time for
 * a given hash).
 */
async function verifySecret(secret, secretHash) {
  return bcrypt.compare(secret, secretHash);
}

/**
 * Narrow a requested scope list to what the role actually grants.
 *
 * A credential can never exceed its owner's rights: the effective permission
 * list is `requested ∩ roleDefaults`. An empty request means "everything the
 * role allows".
 *
 * @param {string} role
 * @param {string[]} requestedScopes - "module:action:scope" strings
 * @returns {string[]} effective permission strings
 */
function resolveEffectiveScopes(role, requestedScopes = []) {
  const roleDefaults = getPermissionsForRole(role) || [];

  if (!requestedScopes.length) return [...roleDefaults];

  return requestedScopes.filter((requested) =>
    roleDefaults.some((granted) => matchesPermission(requested, granted)),
  );
}

/**
 * Mint the short-lived JWT a credential is exchanged for.
 *
 * The payload deliberately mirrors a normal login token (so every downstream
 * service reads it the same way) plus the external-API markers. It must NOT
 * create a `session:<userId>` Redis key: the absence of one is part of what
 * confines these tokens (see shared/lib/auth.js and the gateway's audience
 * binding).
 *
 * @param {Object} credential - ApiCredential row
 * @returns {{accessToken: string, expiresIn: number, jti: string, scopes: string[]}}
 */
function mintAccessToken(credential) {
  const jti = crypto.randomUUID();
  const scopes = credential.scopes || [];

  const payload = {
    userId: credential.actingUserId,
    clientId: credential.tenantId || null,
    role: credential.role,
    phone: credential.actingPhone || null,
    permissions: scopes,
    accessLevel: null,
    assignedIds: [],
    parentClientId: null,
    parentUserId: null,

    // External API markers
    aud: EXTERNAL_API_AUDIENCE,
    jti,
    apiCredentialId: credential.id,
    apiClientId: credential.clientId,
    outletId: credential.outletId || null,
    scopes,
    apiVersion: credential.pinnedVersion || CURRENT_API_VERSION,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });

  return { accessToken, expiresIn: TOKEN_TTL_SECONDS, jti, scopes };
}

/**
 * Mark a credential revoked in Redis so already-issued tokens die immediately.
 * The DB `revokedAt` column is the source of truth; this key is the fast path
 * every service checks on each request.
 */
async function markCredentialRevoked(credentialId) {
  try {
    const redis = getRedisClient();
    // Outlive the longest possible unexpired token.
    await redis.setEx(
      `apicred:revoked:${credentialId}`,
      TOKEN_TTL_SECONDS * 2,
      "1",
    );
  } catch (error) {
    // Redis being down must not block a revocation; the DB flag still applies
    // on the next credential revalidation.
    console.warn("Failed to write revocation key:", error.message);
  }
}

/**
 * Drop the cached credential status so a scope / rate-limit / allowlist change
 * takes effect immediately.
 *
 * This is NOT revocation: it clears the status cache that shipment-service's
 * externalAuth reads, forcing a fresh revalidation on the next request. Using
 * the revocation key for this would permanently disable the credential.
 */
async function invalidateCredentialCache(credentialId) {
  try {
    const redis = getRedisClient();

    // The status cache read by shipment-service's externalAuth...
    const keys = [
      `apicred:status:${credentialId}`,
      `perms:apicred:${credentialId}`,
    ];

    // ...and every per-permission decision cached under this credential's
    // namespace by shared/lib/auth.js checkPermission. Without this, a widened
    // scope stays invisible for up to 5 minutes because the cached "false"
    // wins before the new scope list is ever consulted.
    for await (const key of redis.scanIterator({
      MATCH: `perm:apicred:${credentialId}:*`,
      COUNT: 100,
    })) {
      keys.push(key);
    }

    if (keys.length) await redis.del(keys);
  } catch (error) {
    // Best-effort; every one of these entries expires on its own.
    console.warn("Failed to invalidate credential cache:", error.message);
  }
}

/**
 * Reasons a credential cannot be used right now.
 * @returns {?{code: string, message: string}} null when usable
 */
function checkCredentialUsable(credential) {
  if (!credential) {
    return {
      code: "invalid_credentials",
      message: "Invalid client id or client secret.",
    };
  }
  if (credential.revokedAt) {
    return {
      code: "credential_revoked",
      message: "This API credential has been revoked.",
    };
  }
  if (credential.expiresAt && credential.expiresAt <= new Date()) {
    return {
      code: "credential_expired",
      message: "This API credential has expired.",
    };
  }
  return null;
}

/**
 * Enforce the credential's IP allowlist. An empty list allows any source.
 */
function checkIpAllowed(credential, ip) {
  const allowlist = credential.ipAllowlist || [];
  if (!allowlist.length) return true;
  return allowlist.includes(ip);
}

module.exports = {
  EXTERNAL_API_AUDIENCE,
  TOKEN_TTL_SECONDS,
  CURRENT_API_VERSION,
  generateClientId,
  generateClientSecret,
  hashSecret,
  verifySecret,
  getDecoyHash,
  resolveEffectiveScopes,
  mintAccessToken,
  markCredentialRevoked,
  invalidateCredentialCache,
  checkCredentialUsable,
  checkIpAllowed,
};
