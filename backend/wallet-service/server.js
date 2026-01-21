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
app.use(express.json());
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

  try {
    // Check PostgreSQL connection
    const pgStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const pgTime = Date.now() - pgStart;

    healthStatus.database = "connected";
    healthStatus.dependencies.postgres = {
      status: "healthy",
      responseTime: pgTime,
    };
  } catch (error) {
    isHealthy = false;
    healthStatus.database = "disconnected";
    healthStatus.dependencies.postgres = {
      status: "unhealthy",
      error: error.message,
    };
  }

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
      paymentGatewayInitiate: "/api/v1/wallet/payment-gateway/initiate",
      paymentGatewayWebhook: "/api/v1/wallet/payment-gateway/webhook",
      paymentGatewayStatus: "/api/v1/wallet/payment-gateway/status/{paymentId}",
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDB();
    logger.info("Database connected via Prisma");

    // Connect to Redis
    await connectRedis();
    logger.info("Redis connected");

    // Log CORS configuration
    corsConfig.logCorsConfiguration();

    app.listen(PORT, () => {
      logger.info(
        `🚀 Wallet Service running on port ${PORT} (LIVE RELOAD ENABLED)`,
      );
      logger.info(`Health check: http://localhost:3006/health`);
      logger.info(
        `Swagger docs: http://localhost:3001/swagger/wallet-service (via API Gateway)`,
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
