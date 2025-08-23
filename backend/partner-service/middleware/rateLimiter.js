const rateLimit = require("express-rate-limit");

// Helper function for secure IP key generation (IPv6 compatible)
const generateSecureKey = (req, identifier = "unknown") => {
  // Use the built-in IP normalization from express-rate-limit
  const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
  return `${ip}:${identifier}`;
};

// Rate limiter for partner creation/updates (admin operations)
const partnerManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 partner management operations per windowMs
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many partner management operations. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

// Rate limiter for rate calculation endpoint (high usage)
const rateCalculationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 rate calculations per minute
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many rate calculation requests. Please try again in 1 minute.",
      retryAfter: 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

// Rate limiter for serviceability checks (high usage)
const serviceabilityLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 serviceability checks per minute
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many serviceability requests. Please try again in 1 minute.",
      retryAfter: 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

// General API rate limiter for partner service
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs (higher than auth service)
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for geographical data searches (moderate usage)
const geographicalSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 150, // Limit each IP to 150 geographical searches per minute
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many geographical searches. Please try again in 1 minute.",
      retryAfter: 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

module.exports = {
  partnerManagementLimiter,
  rateCalculationLimiter,
  serviceabilityLimiter,
  geographicalSearchLimiter,
  generalLimiter,
};
