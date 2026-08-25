const rateLimit = require("express-rate-limit");
const { getRedisClient } = require("../config/redis");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");

// Redis store for rate limiting (if Redis is available)
const createRedisStore = () => {
  try {
    const redisClient = getRedisClient();

    return {
      incr: async (key) => {
        const current = await redisClient.incr(key);
        if (current === 1) {
          // Set expiration on first increment
          await redisClient.expire(key, 900); // 15 minutes
        }
        return { current, resetTime: Date.now() + 900000 };
      },
      decrement: async (key) => {
        return await redisClient.decr(key);
      },
      resetKey: async (key) => {
        return await redisClient.del(key);
      },
    };
  } catch (error) {
    logger.warn(
      "Redis not available for rate limiting, using memory store",
      error,
    );
    return null;
  }
};

// General rate limiter for all endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    status: "error",
    message: "Too many requests from this IP, please try again later",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: "15 minutes",
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: createRedisStore(),
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
    });

    res.status(429).json(
      APIResponse.error(
        "Too many requests from this IP, please try again later",
        429,
        {
          retryAfter: "15 minutes",
          limit: 1000,
          windowMs: 15 * 60 * 1000,
        },
      ),
    );
  },
});

// Strict rate limiter for sensitive operations (balance loading, admin operations)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    status: "error",
    message:
      "Too many sensitive operations from this IP, please try again later",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: "15 minutes",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  handler: (req, res) => {
    logger.warn("Strict rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
    });

    res.status(429).json(
      APIResponse.error(
        "Too many sensitive operations from this IP, please try again later",
        429,
        {
          retryAfter: "15 minutes",
          limit: 50,
          windowMs: 15 * 60 * 1000,
        },
      ),
    );
  },
});

// Balance operation limiter (for balance checks and transaction history)
const balanceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 balance operations per minute
  message: {
    status: "error",
    message: "Too many balance operations, please try again later",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: "1 minute",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  handler: (req, res) => {
    logger.warn("Balance operation rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(429).json(
      APIResponse.error(
        "Too many balance operations, please try again later",
        429,
        {
          retryAfter: "1 minute",
          limit: 100,
          windowMs: 1 * 60 * 1000,
        },
      ),
    );
  },
});

// Transaction limiter (for debit/credit operations)
const transactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 transactions per minute
  message: {
    status: "error",
    message: "Too many transaction requests, please try again later",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: "1 minute",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  handler: (req, res) => {
    logger.warn("Transaction rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(429).json(
      APIResponse.error(
        "Too many transaction requests, please try again later",
        429,
        {
          retryAfter: "1 minute",
          limit: 30,
          windowMs: 1 * 60 * 1000,
        },
      ),
    );
  },
});

// Webhook limiter (for payment provider callbacks)
// Sized for provider retry storms: Razorpay & friends replay undelivered events
// aggressively, and every retry arrives from a small pool of provider IPs. The
// ceiling exists to stop abuse, not to throttle legitimate delivery, so it is
// deliberately generous and tunable via RATE_LIMIT_WEBHOOK_MAX.
const WEBHOOK_MAX = parseInt(process.env.RATE_LIMIT_WEBHOOK_MAX || "600", 10);

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: WEBHOOK_MAX,
  message: {
    status: "error",
    message: "Too many webhook requests, please try again later",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: "1 minute",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.warn("Webhook rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
    });

    res.status(429).json(
      APIResponse.error(
        "Too many webhook requests, please try again later",
        429,
        {
          retryAfter: "1 minute",
          limit: WEBHOOK_MAX,
          windowMs: 60 * 1000,
        },
      ),
    );
  },
});

module.exports = {
  generalLimiter,
  strictLimiter,
  balanceLimiter,
  transactionLimiter,
  webhookLimiter,
};
