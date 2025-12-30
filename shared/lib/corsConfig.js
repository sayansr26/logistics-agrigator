/**
 * Shared CORS Configuration for All Services
 *
 * CRITICAL SECURITY: This file fixes the CORS vulnerability across all services
 * - Development: Allows necessary localhost origins for testing
 * - Production: Only allows production frontend and API gateway domains
 *
 * USAGE:
 * ```javascript
 * const { getCorsOptions } = require('../shared/lib/corsConfig');
 * app.use(cors(getCorsOptions()));
 * ```
 */

const logger = require("./logger");

/**
 * Development CORS Origins
 * Allows all necessary localhost ports for development and testing
 */
const developmentOrigins = (process.env.DEVELOPMENT_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Production CORS Origins
 * SECURITY: Only allows production domains - no wildcards or broad access
 */
const productionOrigins = (process.env.PRODUCTION_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Staging Environment Origins (if needed)
 */
const stagingOrigins = (process.env.STAGING_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Get environment-appropriate CORS options
 * @returns {Object} CORS configuration options
 */
function getCorsOptions() {
  const nodeEnv = process.env.NODE_ENV || "development";

  let allowedOrigins;

  switch (nodeEnv) {
    case "production":
      allowedOrigins = productionOrigins;
      logger.info("Using production CORS origins", {
        count: productionOrigins.length,
        origins: productionOrigins,
      });
      break;

    case "staging":
      allowedOrigins = [...stagingOrigins, ...developmentOrigins];
      logger.info("Using staging CORS origins", {
        count: allowedOrigins.length,
      });
      break;

    case "development":
    case "dev":
    default:
      allowedOrigins = developmentOrigins;
      logger.info("Using development CORS origins", {
        count: developmentOrigins.length,
      });
      break;
  }

  return {
    // Origin configuration
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        logger.debug("CORS: Allowed origin", { origin });
        callback(null, true);
      } else {
        logger.warn("CORS: Blocked origin", {
          origin,
          allowed: allowedOrigins,
          nodeEnv,
        });
        callback(new Error(`CORS: Origin ${origin} not allowed`), false);
      }
    },

    // Credentials configuration
    credentials: true,

    // Allowed methods
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    // Allowed headers
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "X-Access-Token",
      "X-API-Key",
    ],

    // Exposed headers (headers that browsers are allowed to access)
    exposedHeaders: [
      "Authorization",
      "X-Total-Count",
      "X-Page-Count",
      "X-Rate-Limit-Remaining",
      "X-Rate-Limit-Reset",
    ],

    // Preflight cache duration (in seconds)
    maxAge: 86400, // 24 hours

    // Success status for preflight requests
    optionsSuccessStatus: 200,
  };
}

/**
 * Get simple CORS options for less restrictive endpoints (like public health checks)
 * @returns {Object} Simplified CORS configuration
 */
function getPublicCorsOptions() {
  return {
    origin: true, // Allow all origins for public endpoints
    methods: ["GET"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
    maxAge: 3600, // 1 hour cache
  };
}

/**
 * Log CORS configuration on startup
 * Helps with debugging CORS issues
 */
function logCorsConfiguration() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const corsOptions = getCorsOptions();

  logger.info("CORS Configuration Initialized", {
    environment: nodeEnv,
    credentialsEnabled: corsOptions.credentials,
    methods: corsOptions.methods,
    maxAge: corsOptions.maxAge,
    timestamp: new Date().toISOString(),
  });

  // Log allowed origins (but not in production for security)
  if (nodeEnv !== "production") {
    const allowedOrigins =
      nodeEnv === "development"
        ? developmentOrigins
        : nodeEnv === "staging"
          ? [...stagingOrigins, ...developmentOrigins]
          : productionOrigins;
    logger.debug("CORS Allowed Origins", { origins: allowedOrigins });
  }
}

module.exports = {
  getCorsOptions,
  getPublicCorsOptions,
  logCorsConfiguration,
  // Export origins for testing/debugging purposes
  developmentOrigins,
  productionOrigins,
  stagingOrigins,
};
