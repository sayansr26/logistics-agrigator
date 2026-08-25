require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "wallet-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// Swagger UI removed - documentation available via API Gateway only
// const swaggerUi = require("swagger-ui-express");
const logger = require("./shared/lib/logger");

const walletRoutes = require("./routes/wallet");
const payoutRoutes = require("./routes/payout");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB, prisma } = require("./config/database");
const { connectRedis, getRedisClient } = require("./config/redis");
const swaggerSpecs = require("./config/swagger");
const { generalLimiter } = require("./middleware/rateLimiter");
const { corsConfig } = require("./shared");

const app = express();
const PORT = process.env.PORT || 3006;

// Security middleware
app.use(helmet());
app.use(cors(corsConfig.getCorsOptions()));

// Security headers to prevent mixed content issues
app.use((req, res, next) => {
  // Allow loading resources over HTTP in development
  if (process.env.NODE_ENV !== "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' http: data:; img-src 'self' data: http:;",
    );
  }
  next();
});

// Rate limiting
app.use(generalLimiter);

// Logging - use shared logger
app.use(logger.httpLogger);

// Body parsing
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      // Payment providers sign the exact bytes they sent. JSON.stringify(req.body)
      // is NOT byte-identical (key order, unicode escaping), so the raw buffer must
      // be kept for HMAC verification in services/payments/webhookService.js.
      if (buf && buf.length) req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Internal request validation middleware
// Only allow requests from API Gateway or health checks
app.use((req, res, next) => {
  // Allow health checks from Docker
  if (req.path === "/health" && req.method === "GET") {
    return next();
  }

  // Allow openapi.json but require internal header
  if (req.path === "/openapi.json" || req.path === "/api-docs.json") {
    if (!req.headers["x-internal-request"]) {
      return res.status(403).json({
        status: "error",
        error: {
          code: "DIRECT_ACCESS_FORBIDDEN",
          message:
            "Swagger documentation accessible only through API Gateway at port 3001",
        },
      });
    }
    return next();
  }

  // Validate internal requests for all other endpoints
  const internalHeader = req.headers["x-internal-request"];

  if (!internalHeader || internalHeader !== process.env.INTERNAL_SECRET) {
    logger.warn(`Direct access attempt blocked from ${req.ip} to ${req.path}`);
    return res.status(403).json({
      status: "error",
      error: {
        code: "DIRECT_ACCESS_FORBIDDEN",
        message: "Service accessible only through API Gateway at port 3001",
      },
    });
  }

  next();
});

// API Documentation - Swagger UI removed, only JSON endpoint available
// Access Swagger UI through API Gateway at http://localhost:3001/swagger/wallet-service
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {...}));

// OpenAPI JSON endpoint with dynamic server URLs
app.get("/openapi.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");

  // Create dynamic swagger specs with current host
  const dynamicSpecs = {
    ...swaggerSpecs,
    servers: [
      {
        url: `http://${req.get("host")}`,
        description: "Current server",
      },
      {
        url: "http://localhost:3006",
        description: "Development server (localhost)",
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              url: "https://api.logistics.com",
              description: "Production server",
            },
          ]
        : []),
    ],
  };

  res.json(dynamicSpecs);
});

// Routes
// COD/settlement routers must be mounted BEFORE the general wallet router,
// otherwise "/wallet/cod" / "/wallet/settlement" are captured by wallet's "/:userId".
app.use("/api/v1/wallet/cod", require("./routes/cod"));
app.use("/api/v1/wallet/settlement", require("./routes/settlement"));
// Payment provider configuration MUST be mounted BEFORE the general wallet
// router: wallet's "/:userId" route would otherwise swallow
// "/api/v1/wallet/payment-providers" and treat "payment-providers" as a userId.
app.use(
  "/api/v1/wallet/payment-providers",
  require("./routes/paymentProvider"),
);
// Top-up (gateway checkout, admin payment links, manual top-ups, webhook) MUST
// also be mounted BEFORE the general wallet router: wallet's "/:userId" would
// otherwise swallow "/api/v1/wallet/topup" and treat "topup" as a userId.
app.use("/api/v1/wallet/topup", require("./routes/topup"));
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/payout", payoutRoutes);
const adminLogsRoutes = require("./routes/adminLogs");
app.use("/api/v1/admin", adminLogsRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Returns the health status of the wallet service and its dependencies
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: ok
 *               timestamp: '2024-01-01T00:00:00.000Z'
 *               uptime: 3600
 *               service: wallet-service
 *               version: '1.0.0'
 *               database: connected
 *               redis: connected
 *               dependencies:
 *                 postgres:
 *                   status: healthy
 *                   responseTime: 5
 *                 redis:
 *                   status: healthy
 *                   responseTime: 2
 *                 externalWalletAPI:
 *                   status: healthy
 *                   responseTime: 150
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Enhanced health check
app.get("/health", async (req, res) => {
  const startTime = Date.now();
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "wallet-service",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: {},
  };

  let isHealthy = true;

  // Database is disabled - wallet-service is stateless (proxies external wallet API)
  healthStatus.database = "stateless/disabled";
  healthStatus.dependencies.postgres = {
    status: "stateless",
    note: "wallet-service operates without a local database; all data is proxied from the external wallet API",
  };

  try {
    // Check Redis connection
    const redisStart = Date.now();
    const redisClient = getRedisClient();
    await redisClient.ping();
    const redisTime = Date.now() - redisStart;

    healthStatus.redis = "connected";
    healthStatus.dependencies.redis = {
      status: "healthy",
      responseTime: redisTime,
    };
  } catch (error) {
    isHealthy = false;
    healthStatus.redis = "disconnected";
    healthStatus.dependencies.redis = {
      status: "unhealthy",
      error: error.message,
    };
  }

  // Check External Wallet API
  try {
    const {
      getExternalWalletClient,
    } = require("./services/externalWalletClient");
    const externalClient = getExternalWalletClient();
    const externalHealth = await externalClient.healthCheck();

    healthStatus.dependencies.externalWalletAPI = externalHealth;

    if (externalHealth.status !== "healthy") {
      // Don't mark overall service as unhealthy if external service is down
      // since we have fallback mechanisms
      logger.warn(
        "External Wallet API is unhealthy, using fallback mechanisms",
      );
    }
  } catch (error) {
    healthStatus.dependencies.externalWalletAPI = {
      status: "unhealthy",
      error: error.message,
      note: "Wallet operations may be limited without external API",
    };
  }

  // Top-up reconciliation backlog + worker liveness.
  // NOTE: this deliberately does NOT touch `isHealthy`. A reconciliation
  // backlog means money is waiting to be credited — that is an ALERTING signal
  // for operators, not a reason to fail the container health check and have the
  // orchestrator restart (and thereby stop) the very worker that drains it.
  try {
    const reconcileService = require("./services/payments/reconcileService");
    const reconcileWorker = require("./services/payments/reconcileWorker");
    healthStatus.reconcile = {
      ...(await reconcileService.getBacklogCounts()),
      running: reconcileWorker.isRunning(),
    };
  } catch (error) {
    healthStatus.reconcile = { status: "unavailable", error: error.message };
  }

  // Add memory and CPU usage
  const memUsage = process.memoryUsage();
  healthStatus.system = {
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      unit: "MB",
    },
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version,
  };

  // Overall response time
  healthStatus.responseTime = Date.now() - startTime;

  if (!isHealthy) {
    healthStatus.status = "error";
    return res.status(503).json(healthStatus);
  }

  res.json(healthStatus);
});

// Root endpoint with service information
app.get("/", (req, res) => {
  res.json({
    service: "wallet-service",
    version: "1.0.0",
    description:
      "Wallet Service for Logistics Aggregator Portal - Payment Processing and External Wallet API Integration",
    endpoints: {
      health: "/health",
      docs: "/api-docs",
      wallet: "/api/v1/wallet",
      walletBalance: "/api/v1/wallet/{userId}/balance",
      walletTransactions: "/api/v1/wallet/{userId}/transactions",
      walletDebit: "/api/v1/wallet/{userId}/debit",
      walletCredit: "/api/v1/wallet/{userId}/credit",
      adminLoadBalance: "/api/v1/wallet/{userId}/load-balance",
      adminAllWallets: "/api/v1/wallet/admin/all-wallets",
      adminAllTransactions: "/api/v1/wallet/admin/transactions",
      topup: "/api/v1/wallet/topup",
      topupWebhook: "/api/v1/wallet/topup/webhook/{provider}",
      paymentProviders: "/api/v1/wallet/payment-providers",
      detailedHealth: "/api/v1/wallet/health",
    },
    features: [
      "Wallet Management",
      "External Wallet API Integration",
      "HMAC Authentication",
      "Auto Wallet Creation",
      "Balance Operations",
      "Transaction Processing",
      "Debit for Shipment Charges",
      "Credit for Refunds",
      "Transaction History",
      "Payment Gateway Foundation",
      "Manual Balance Loading (Admin)",
      "Role-based Access Control",
      "Redis Caching",
      "Circuit Breaker Pattern",
      "Comprehensive Error Handling",
      "Audit Logging",
      "Real-time Balance Checking",
    ],
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");
  // No prisma disconnect needed - wallet-service is stateless
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  // No prisma disconnect needed - wallet-service is stateless
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Database connection skipped - wallet-service is stateless
    // connectDB() intentionally not called; service proxies external wallet API
    logger.info("Wallet service running in stateless mode (no local DB)");

    // Connect to Redis
    await connectRedis();
    logger.info("Redis connected");

    // Log CORS configuration
    corsConfig.logCorsConfiguration();

    app.listen(PORT, () => {
      logger.info(`🚀 Wallet Service running on port ${PORT} (Production)`);
      logger.info(`Health check: http://localhost:3006/health`);
      logger.info(
        `Swagger docs: http://localhost:3001/swagger/wallet-service (via API Gateway)`,
      );

      // Start the auto-settlement scheduler (no-op unless AUTO_SETTLEMENT_ENABLED=true)
      try {
        require("./services/settlementScheduler").start();
      } catch (e) {
        logger.warn("Failed to start settlement scheduler", {
          error: e.message,
        });
      }

      // Start the top-up reconcile worker (no-op unless TOPUP_RECONCILE_ENABLED !== "false")
      try {
        require("./services/payments/reconcileWorker").start();
      } catch (e) {
        logger.warn("Failed to start top-up reconcile worker", {
          error: e.message,
        });
      }
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
