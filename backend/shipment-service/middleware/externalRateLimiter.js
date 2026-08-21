/**
 * Per-credential rate limiting for the External API.
 *
 * Keyed on the API credential, never on IP: MCP clients and server-side
 * integrations routinely share an egress IP, so an IP-keyed limit would either
 * punish unrelated tenants or have to be set uselessly high.
 *
 * Must be registered AFTER externalAuth so `req.user` exists. (The internal
 * shipment routes put their limiter first, where `req.user` is undefined and
 * the key degrades to "ip:anonymous" — don't copy that.)
 */

const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const { sendExternalError } = require("./externalEnvelope");

/**
 * Fixed-window counter in Redis.
 *
 * @param {Object} options
 * @param {string} options.bucket - Operation name, e.g. "booking"
 * @param {number} options.max - Requests allowed per window
 * @param {number} [options.windowSeconds=60]
 */
function externalRateLimiter({ bucket, max, windowSeconds = 60 }) {
  return async (req, res, next) => {
    const credentialId = req.user?.apiCredentialId;
    if (!credentialId) return next();

    // The credential's own ceiling still applies to the global bucket.
    const effectiveMax =
      bucket === "global" ? req.user.rateLimitPerMin || max : max;

    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `extrl:${credentialId}:${bucket}:${window}`;

    let count;
    try {
      const redis = getRedisClient();
      count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
    } catch (error) {
      // Never fail a request because the limiter is unavailable.
      logger.warn("External rate limiter unavailable, allowing request", {
        service: "shipment-service",
        error: error.message,
      });
      return next();
    }

    const remaining = Math.max(effectiveMax - count, 0);
    const resetSeconds =
      (window + 1) * windowSeconds - Math.floor(Date.now() / 1000);

    res.set("RateLimit-Limit", String(effectiveMax));
    res.set("RateLimit-Remaining", String(remaining));
    res.set("RateLimit-Reset", String(Math.max(resetSeconds, 0)));

    if (count > effectiveMax) {
      res.set("Retry-After", String(Math.max(resetSeconds, 1)));
      logger.warn("External API rate limit exceeded", {
        service: "shipment-service",
        credentialId,
        bucket,
        count,
        max: effectiveMax,
      });
      return sendExternalError(
        res,
        429,
        "rate_limit_error",
        "rate_limit_exceeded",
        `Rate limit exceeded for ${bucket}. Retry in ${Math.max(resetSeconds, 1)}s.`,
      );
    }

    return next();
  };
}

/** Every External API request counts against the credential's overall ceiling. */
const globalLimiter = externalRateLimiter({ bucket: "global", max: 60 });
/** Booking is the expensive, money-moving path. */
const bookingLimiter = externalRateLimiter({ bucket: "booking", max: 20 });
const quoteLimiter = externalRateLimiter({ bucket: "quotes", max: 60 });
const trackingLimiter = externalRateLimiter({ bucket: "tracking", max: 120 });
const documentsLimiter = externalRateLimiter({ bucket: "documents", max: 30 });

module.exports = {
  externalRateLimiter,
  globalLimiter,
  bookingLimiter,
  quoteLimiter,
  trackingLimiter,
  documentsLimiter,
};
