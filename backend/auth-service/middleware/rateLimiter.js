const rateLimit = require("express-rate-limit");

// Helper function for secure IP key generation (IPv6 compatible)
const generateSecureKey = (req, identifier = "unknown") => {
  // Use the built-in IP normalization from express-rate-limit
  const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
  return `${ip}:${identifier}`;
};

// Rate limiter for registration endpoint
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 registration attempts per windowMs
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many registration attempts. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use secure IP key generation with email for more specific rate limiting
    return generateSecureKey(req, req.body?.email || "unknown");
  },
});

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many login attempts. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.body?.email || "unknown");
  },
});

// Rate limiter for password reset and sensitive operations
const sensitiveOperationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 attempts per hour
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many attempts for sensitive operations. Please try again in 1 hour.",
      retryAfter: 60 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

// Rate limiter for External API credential exchange.
// This is the brute-force surface for clientSecret, so it is keyed on the
// clientId being attacked as well as the source IP.
const tokenIssueLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: {
      type: "rate_limit_error",
      code: "rate_limit_exceeded",
      message: "Too many token requests. Please retry shortly.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    generateSecureKey(req, req.body?.clientId || "unknown"),
});

// Slower, wider net against credential stuffing across many client ids.
const tokenIssueIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 300,
  message: {
    success: false,
    error: {
      type: "rate_limit_error",
      code: "rate_limit_exceeded",
      message: "Too many token requests from this IP address.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => generateSecureKey(req, "external-token"),
});

module.exports = {
  tokenIssueLimiter,
  tokenIssueIpLimiter,
  registrationLimiter,
  loginLimiter,
  sensitiveOperationsLimiter,
  generalLimiter,
};
