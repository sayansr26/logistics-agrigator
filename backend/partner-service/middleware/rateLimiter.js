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
  max: 100, // Limit each IP to 100 partner management (write) operations per windowMs — applied to mutations only, not reads
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

/**
 * Zone Management Rate Limiter
 * Applies to zone CRUD operations and service type management
 * 30 requests per 15 minutes per user
 */
const zoneManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user to 30 requests per windowMs
  message: {
    error: "Too many zone management requests",
    retryAfter: "15 minutes",
    limit: 30,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Package Management Rate Limiter
 * Applies to package charge CRUD operations and bulk operations
 * 25 requests per 15 minutes per user
 */
const packageManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Limit each user to 25 package management operations per windowMs
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many package management requests. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Discount Management Rate Limiter
 * Applies to discount CRUD operations, bulk operations, and calculations
 * 35 requests per 15 minutes per user (slightly higher due to calculation needs)
 */
const discountManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 35, // Limit each user to 35 discount management operations per windowMs
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many discount management requests. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Charge Calculation Rate Limiter
 * Applies to surcharge calculation, shipment charge calculation, and validation
 * 100 requests per 5 minutes per user (high usage for calculation operations)
 */
const chargeCalculationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each user to 100 charge calculations per 5 minutes
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many charge calculation requests. Please try again in 5 minutes.",
      retryAfter: 5 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Partner Assignment Rate Limiter
 * Applies to partner availability checks, assignment operations, and workflows
 * 50 requests per 10 minutes per user (moderate usage for assignment operations)
 */
const partnerAssignmentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // Limit each user to 50 assignment operations per 10 minutes
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many partner assignment requests. Please try again in 10 minutes.",
      retryAfter: 10 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Performance Analytics Rate Limiter
 * Applies to performance metrics, analytics, KPIs, benchmarks, and reporting
 * 40 requests per 5 minutes per user (moderate usage for analytics operations)
 */
const performanceAnalyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 40, // Limit each user to 40 performance analytics requests per 5 minutes
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many performance analytics requests. Please try again in 5 minutes.",
      retryAfter: 5 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * System Management Rate Limiter
 * Applies to system initialization, cache management, rate limit config, audit, webhooks
 * 15 requests per 15 minutes per user (restrictive for admin-only operations)
 */
const systemManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each user to 15 system management operations per 15 minutes
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many system management requests. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Pincode Type Management Rate Limiter
 * Applies to pincode type CRUD operations and bulk assignment
 * 30 requests per 15 minutes per user (admin/operations only)
 */
const pincodeTypeManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user to 30 requests per windowMs
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many pincode type management requests. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Courier Operation Rate Limiter
 * Applies to courier booking, cancellation, tracking, pickup, label, manifest
 * 30 requests per 15 minutes per user (courier APIs have their own rate limits)
 */
const courierOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many courier operation requests. Please try again in 15 minutes.",
      retryAfter: 15 * 60,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Charges Rule Management Rate Limiter
 * Applies to charge rule write operations (POST/PUT/DELETE)
 * 100 requests per 15 minutes per user — supports bulk milestone creation
 */
const chargesManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Supports creating many milestone rules in a single session
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many charges management requests. Please try again in 15 minutes.",
      retryAfter: 15 * 60, // seconds
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return generateSecureKey(req, req.user?.id || "unknown");
  },
});

/**
 * Charges Read Rate Limiter
 * Applies to GET charge rule list and detail endpoints
 * 200 requests per 5 minutes per user — accommodates RTK Query refetches after mutations
 */
const chargesReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200,
  message: {
    status: "error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many charge rule read requests. Please try again in 5 minutes.",
      retryAfter: 5 * 60,
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
  zoneManagementLimiter,
  packageManagementLimiter,
  discountManagementLimiter,
  chargeCalculationLimiter,
  chargesManagementLimiter,
  chargesReadLimiter,
  courierOperationLimiter,
  partnerAssignmentLimiter,
  performanceAnalyticsLimiter,
  systemManagementLimiter,
  pincodeTypeManagementLimiter,
  generalLimiter,
};
