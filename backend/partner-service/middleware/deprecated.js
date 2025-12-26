/**
 * Middleware to mark endpoints as deprecated and return 410 Gone responses.
 *
 * Use this for legacy endpoints that have been replaced by new implementations.
 */

const logger = require("../shared/lib/logger");

/**
 * Returns a 410 Gone response for deprecated endpoints
 * @param {string} replacementEndpoint - The new endpoint to use instead
 * @param {string} deprecationDate - Date when the endpoint was deprecated
 * @returns {Function} Express middleware function
 */
function deprecated(
  replacementEndpoint,
  deprecationDate = new Date().toISOString().split("T")[0],
) {
  return (req, res) => {
    logger.warn("Deprecated endpoint accessed", {
      path: req.originalUrl,
      method: req.method,
      replacement: replacementEndpoint,
      deprecationDate,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(410).json({
      status: "error",
      error: {
        code: "ENDPOINT_DEPRECATED",
        message:
          "This endpoint has been deprecated and is no longer available.",
        details: {
          deprecatedEndpoint: req.originalUrl,
          deprecationDate,
          replacement: replacementEndpoint,
          documentation:
            "Please update your integration to use the new endpoint.",
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        service: "partner-service",
      },
    });
  };
}

/**
 * Middleware that logs deprecation warnings but still allows the request through
 * Use this for endpoints in transition period
 * @param {string} replacementEndpoint - The new endpoint to use instead
 * @param {string} sunsetDate - Date when endpoint will be fully deprecated
 * @returns {Function} Express middleware function
 */
function deprecationWarning(replacementEndpoint, sunsetDate) {
  return (req, res, next) => {
    logger.warn("Endpoint deprecation warning", {
      path: req.originalUrl,
      method: req.method,
      replacement: replacementEndpoint,
      sunsetDate,
    });

    // Add deprecation headers
    res.set("Deprecation", "true");
    res.set("Sunset", sunsetDate);
    res.set("Link", `<${replacementEndpoint}>; rel="successor-version"`);

    next();
  };
}

module.exports = {
  deprecated,
  deprecationWarning,
};
