require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "shipment-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const logger = require("./shared/lib/logger");

const shipmentRoutes = require("./routes/shipments");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB, prisma } = require("./config/database");
const { connectRedis, getRedisClient } = require("./config/redis");
const swaggerSpecs = require("./config/swagger");
const { generalLimiter } = require("./middleware/rateLimiter");
const { corsConfig } = require("./shared");

const app = express();
const PORT = process.env.PORT || 3004;

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

// API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Logistics Shipment Service API",
    // Disable external CDN resources to prevent HTTPS/CORS issues
    customCssUrl: null,
    customfavIcon: null,
    customJs: null,
    swaggerOptions: {
      // Force HTTP protocol for development to avoid SSL errors with IP access
      url:
        process.env.NODE_ENV === "production"
          ? undefined
          : `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3004}/openapi.json`,
      // Disable "Try it out" HTTPS enforcement
      supportedSubmitMethods: ["get", "post", "put", "delete", "patch"],
      // Force HTTP scheme for development
      schemes:
        process.env.NODE_ENV === "production" ? ["https", "http"] : ["http"],
    },
  }),
);

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
        url: "http://localhost:3004",
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
app.use("/api/v1/shipments", shipmentRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Returns the health status of the shipment service and its dependencies
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
 *               service: shipment-service
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
 *                 partnerService:
 *                   status: healthy
 *                   responseTime: 50
 *                 walletService:
 *                   status: healthy
 *                   responseTime: 30
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
    service: "shipment-service",
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

  // Check Partner Service
  try {
    const axios = require("axios");
    const partnerStart = Date.now();
    const partnerResponse = await axios.get("http://localhost:3005/health", {
      timeout: 5000,
    });
    const partnerTime = Date.now() - partnerStart;

    healthStatus.dependencies.partnerService = {
      status: partnerResponse.status === 200 ? "healthy" : "unhealthy",
      responseTime: partnerTime,
      version: partnerResponse.data?.version || "unknown",
    };
  } catch (error) {
    // Don't mark overall service as unhealthy if partner service is down
    // since we can still create shipments without immediate partner assignment
    healthStatus.dependencies.partnerService = {
      status: "unhealthy",
      error: error.message,
      note: "Partner service unavailable, deferred assignment available",
    };
  }

  // Check Wallet Service (SHIP-003: Real integration implemented)
  try {
    const paymentProcessingService = require("./services/paymentProcessingService");
    const walletHealth = await paymentProcessingService.healthCheck();

    healthStatus.dependencies.walletService = {
      ...walletHealth,
      integration: "payment-processing-service",
    };
  } catch (error) {
    // Don't mark overall service as unhealthy if wallet service is down
    // since we can still create COD shipments
    healthStatus.dependencies.walletService = {
      status: "unhealthy",
      error: error.message,
      note: "Wallet service unavailable, COD shipments still available",
      integration: "payment-processing-service",
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
    service: "shipment-service",
    version: "1.0.0",
    description:
      "Shipment Service for Logistics Aggregator Portal - Complete Shipment Management and Processing",
    endpoints: {
      health: "/health",
      docs: "/api-docs",
      shipments: "/api/v1/shipments",
      createShipment: "/api/v1/shipments",
      getShipments: "/api/v1/shipments",
      getShipment: "/api/v1/shipments/{id}",
      updateShipment: "/api/v1/shipments/{id}",
      cancelShipment: "/api/v1/shipments/{id}/cancel",
      trackShipment: "/api/v1/shipments/{id}/tracking",
      addTrackingEvent: "/api/v1/shipments/{id}/tracking/events",
    },
    features: [
      "Shipment Management",
      "Real-time Tracking",
      "Partner Integration",
      "Wallet Integration",
      "Payment Processing",
      "Rate Calculation",
      "Address Validation",
      "Status Management",
      "COD Support",
      "Multi-service Types",
      "Audit Logging",
      "Comprehensive Validation",
    ],
    integrations: {
      partnerService: "Rate calculation and serviceability checking",
      walletService: "Payment processing and balance management",
      authService: "Authentication and authorization",
      userService: "Client management and multi-tenancy",
    },
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
        `🚀 Shipment Service running on port ${PORT} (LIVE RELOAD ENABLED)`,
      );
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
