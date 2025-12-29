// Internal Request Middleware
// Validates requests from other microservices using shared secret

const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * Middleware to verify internal requests from other microservices
 * Validates X-Internal-Request header with shared secret
 */
function requireInternalRequest(req, res, next) {
  const internalSecret = req.get("X-Internal-Request");
  const expectedSecret =
    process.env.INTERNAL_SECRET || "internal-service-secret";

  // In development, also allow requests without secret for testing
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (!internalSecret) {
    // In development, log warning but allow through if from localhost
    if (isDevelopment) {
      const isLocalhost =
        req.ip === "127.0.0.1" ||
        req.ip === "::1" ||
        req.ip === "::ffff:127.0.0.1" ||
        req.hostname === "localhost" ||
        req.get("host")?.includes("localhost");

      if (isLocalhost) {
        logger.warn(
          "Internal request without secret allowed from localhost (dev mode)",
          {
            ip: req.ip,
            path: req.path,
            service: "user-service",
          },
        );
        return next();
      }
    }

    logger.warn(
      "Internal request rejected - missing X-Internal-Request header",
      {
        ip: req.ip,
        path: req.path,
        service: "user-service",
      },
    );

    return res.status(403).json(
      APIResponse.error({
        code: "INTERNAL_AUTH_REQUIRED",
        message: "This endpoint requires internal service authentication",
      }),
    );
  }

  if (internalSecret !== expectedSecret) {
    logger.warn("Internal request rejected - invalid secret", {
      ip: req.ip,
      path: req.path,
      service: "user-service",
    });

    return res.status(403).json(
      APIResponse.error({
        code: "INTERNAL_AUTH_INVALID",
        message: "Invalid internal service credentials",
      }),
    );
  }

  // Mark request as internal for downstream handlers
  req.isInternalRequest = true;

  logger.debug("Internal request authenticated", {
    ip: req.ip,
    path: req.path,
    service: "user-service",
  });

  next();
}

/**
 * Optional middleware to check if request is internal
 * Does not block, just sets flag
 */
function checkInternalRequest(req, res, next) {
  const internalSecret = req.get("X-Internal-Request");
  const expectedSecret =
    process.env.INTERNAL_SECRET || "internal-service-secret";

  req.isInternalRequest = internalSecret === expectedSecret;
  next();
}

module.exports = {
  requireInternalRequest,
  checkInternalRequest,
};
