/**
 * External API authentication.
 *
 * Deliberately NOT `shared/lib/auth.js`'s `authenticate`: that one requires a
 * Redis `session:<userId>` key, which is created by a portal login and which an
 * API token has no business creating (its absence is part of what confines
 * these tokens — see the gateway's audience binding).
 *
 * What this does instead:
 *   1. verify the JWT and require aud="external-api"
 *   2. check credential/token revocation (Redis fast path, then a cached
 *      revalidation against auth-service)
 *   3. enforce the credential's IP allowlist
 *   4. populate `req.user` in EXACTLY the shape the existing shipment
 *      controllers expect, so they run unchanged
 */

const jwt = require("jsonwebtoken");
const axios = require("axios");

const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const { sendExternalError } = require("./externalEnvelope");
const { matchesPermission } = require("../shared/constants/permissions");

const EXTERNAL_API_AUDIENCE = "external-api";
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://auth-service:3002";
/** How long a credential-status revalidation is trusted. */
const STATUS_CACHE_TTL_SECONDS = 60;

/**
 * Revalidate a credential against auth-service, behind a short Redis cache.
 * Returns null when the credential cannot be confirmed active.
 */
async function loadCredentialStatus(credentialId) {
  const cacheKey = `apicred:status:${credentialId}`;

  let redis = null;
  try {
    redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    // Redis unavailable — fall through to a live lookup.
    logger.warn("Redis unavailable for credential status cache", {
      service: "shipment-service",
      error: error.message,
    });
  }

  try {
    const response = await axios.get(
      `${AUTH_SERVICE_URL}/api/v1/internal/api-credentials/${credentialId}/status`,
      {
        headers: {
          "X-Internal-Request":
            process.env.INTERNAL_SECRET || "internal-service-secret",
        },
        timeout: 5000,
      },
    );

    const status = response.data?.data || null;

    if (status && redis) {
      try {
        await redis.setEx(
          cacheKey,
          STATUS_CACHE_TTL_SECONDS,
          JSON.stringify(status),
        );
      } catch {
        // Caching is best-effort.
      }
    }

    return status;
  } catch (error) {
    logger.error("Failed to revalidate API credential", {
      service: "shipment-service",
      credentialId,
      error: error.message,
    });
    // Fail closed: an unverifiable credential is not usable.
    return null;
  }
}

/**
 * Authenticate an External API request.
 */
async function externalAuth(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader
      ? String(authHeader)
          .replace(/^Bearer\s+/i, "")
          .trim()
      : null;

    if (!token) {
      return sendExternalError(
        res,
        401,
        "authentication_error",
        "missing_token",
        "Provide a bearer token obtained from POST /api/v1/external/auth/token.",
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      const expired = error.name === "TokenExpiredError";
      return sendExternalError(
        res,
        401,
        "authentication_error",
        expired ? "token_expired" : "invalid_token",
        expired
          ? "The access token has expired. Request a new one."
          : "The access token is invalid.",
      );
    }

    if (decoded.aud !== EXTERNAL_API_AUDIENCE || !decoded.apiCredentialId) {
      return sendExternalError(
        res,
        401,
        "authentication_error",
        "invalid_token",
        "This endpoint requires an External API token.",
      );
    }

    // Fast revocation path.
    try {
      const redis = getRedisClient();
      const [credRevoked, tokenRevoked] = await Promise.all([
        redis.get(`apicred:revoked:${decoded.apiCredentialId}`),
        decoded.jti ? redis.get(`apitoken:revoked:${decoded.jti}`) : null,
      ]);
      if (credRevoked || tokenRevoked) {
        return sendExternalError(
          res,
          401,
          "authentication_error",
          "credential_revoked",
          "This API credential has been revoked.",
        );
      }
    } catch {
      // Redis down — the revalidation below is authoritative anyway.
    }

    const status = await loadCredentialStatus(decoded.apiCredentialId);
    if (!status || status.active === false) {
      return sendExternalError(
        res,
        401,
        "authentication_error",
        status?.reason || "credential_revoked",
        "This API credential is no longer active.",
      );
    }

    if (
      Array.isArray(status.ipAllowlist) &&
      status.ipAllowlist.length > 0 &&
      !status.ipAllowlist.includes(req.ip)
    ) {
      return sendExternalError(
        res,
        403,
        "permission_error",
        "credential_ip_not_allowed",
        "Requests from this IP address are not permitted for this credential.",
      );
    }

    // Scopes are re-read from the credential, not the token, so a scope change
    // takes effect within the status cache TTL rather than at token expiry.
    const scopes = status.scopes || decoded.scopes || decoded.permissions || [];

    // Shape matters: downstream controllers read userId/id/role/phone/clientId,
    // applyScopeFilter() reads role + id, requirePermission() reads permissions,
    // and services forward `token` on internal hops.
    req.user = {
      ...decoded,
      id: decoded.userId,
      userId: decoded.userId,
      role: decoded.role,
      phone: decoded.phone || null,
      clientId: decoded.clientId || null,
      permissions: scopes,
      scopes,
      apiCredentialId: decoded.apiCredentialId,
      apiClientId: decoded.apiClientId,
      outletId: decoded.outletId || null,
      apiVersion: status.pinnedVersion || decoded.apiVersion,
      rateLimitPerMin: status.rateLimitPerMin || 60,
      token,
      isExternalApi: true,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Require a permission string on the credential.
 *
 * This is enforced explicitly rather than relying solely on
 * `requirePermission`, because that helper short-circuits for the superadmin
 * role — which would let a platform-level credential ignore its own scopes.
 *
 * @param {string} required - e.g. "shipment:create:own"
 */
function requireScope(required) {
  return (req, res, next) => {
    const held = req.user?.scopes || [];
    const ok = held.some((granted) => matchesPermission(required, granted));

    if (!ok) {
      return sendExternalError(
        res,
        403,
        "permission_error",
        "insufficient_scope",
        `This credential is missing the required scope: ${required}`,
        { requiredScope: required, grantedScopes: held },
      );
    }

    return next();
  };
}

module.exports = { externalAuth, requireScope };
