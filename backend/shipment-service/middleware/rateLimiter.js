const rateLimit = require("express-rate-limit");

// Helper function for secure IP key generation (IPv6 compatible)
const generateSecureKey = (req, identifier = "unknown") => {
  // Use the built-in IP normalization from express-rate-limit
  const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
  return `${ip}:${identifier}`;
};

// Rate limiter for shipment creation endpoint
const createShipmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 shipment creations per windowMs
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many shipment creation attempts. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return generateSecureKey(req, req.user?.userId || "anonymous");
  },
});

// Rate limiter for bulk operations
const bulkOperationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 bulk operations per hour
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many bulk operation attempts. Please try again in 1 hour.",
      retryAfter: 60 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.userId || "anonymous");
  },
});

// Rate limiter for tracking operations
const trackingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 tracking requests per 5 minutes
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many tracking requests. Please try again in 5 minutes.",
      retryAfter: 5 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter for shipment service
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
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

module.exports = {
  createShipmentLimiter,
  bulkOperationsLimiter,
  trackingLimiter,
  generalLimiter,
};
