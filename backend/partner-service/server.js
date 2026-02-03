require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "partner-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// Swagger UI removed - documentation available via API Gateway only
// const swaggerUi = require("swagger-ui-express");
const logger = require("./shared/lib/logger");

const partnerRoutes = require("./routes/partners");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB, prisma } = require("./config/database");
const { connectRedis, getRedisClient } = require("./config/redis");
const swaggerSpecs = require("./config/swagger");
const { generalLimiter } = require("./middleware/rateLimiter");
const { corsConfig } = require("./shared");
const { deprecated } = require("./middleware/deprecated");

const app = express();
const PORT = process.env.PORT || 3005;

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
// Access Swagger UI through API Gateway at http://localhost:3001/swagger/partner-service
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
        url: "http://localhost:3005",
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
app.use("/api/partners", partnerRoutes);

// Geological Zone Management Routes (NEW)
// IMPORTANT: Zone coverage routes MUST come before zone routes to prevent path conflicts
app.use("/api/v1/geography", require("./routes/geographical"));
app.use("/api/v1/geography/distance", require("./routes/geographicalDistance")); // Distance calculation routes (NEW)
app.use("/api/v1/zones/coverage", require("./routes/zoneCoverage"));
app.use("/api/v1/zones", require("./routes/zones"));

// Pincode Type Management Routes (Simplified - No service charges)
app.use("/api/v1/pincode-types", require("./routes/pincodeTypes"));

// Charges Type Management Routes (NEW - Partner-specific charge types)
app.use("/api/v1/charges-types", require("./routes/chargesTypes"));

// Partner Channel Management Routes (NEW - Single/Multi API Configuration)
app.use("/api/v1", require("./routes/partnerChannels"));

// Charge Package Management Routes (NEW - replaces legacy packages)
app.use("/api/v1/charge-packages", require("./routes/chargePackages"));

// Partner Pincode Assignment Routes (NEW - Pincode assignment with type values)
app.use("/api/v1", require("./routes/partnerPincodes"));

// ============================================================================
// DEPRECATED ENDPOINTS - Return 410 Gone responses
// These endpoints have been replaced by the new Zone System v2 and Charge Packages
// ============================================================================
app.all("/api/packages/*", deprecated("/api/v1/charge-packages", "2024-12-26"));
app.all("/api/packages", deprecated("/api/v1/charge-packages", "2024-12-26"));
app.all(
  "/api/discounts/*",
  deprecated("/api/v1/charge-packages", "2024-12-26"),
);
app.all("/api/discounts", deprecated("/api/v1/charge-packages", "2024-12-26"));
app.all(
  "/api/v1/charge-calculation/*",
  deprecated("/api/v1/partners/calculate", "2024-12-26"),
);
app.all(
  "/api/v1/charge-calculation",
  deprecated("/api/v1/partners/calculate", "2024-12-26"),
);
app.all(
  "/api/v1/partner-assignment/*",
  deprecated("/api/v1/partners/serviceability", "2024-12-26"),
);
app.all(
  "/api/v1/partner-assignment",
  deprecated("/api/v1/partners/serviceability", "2024-12-26"),
);

// Partner Data - Still active but uses external API (keeping for backward compatibility)
app.use("/api", require("./routes/partnerData"));

// Performance & System Management - Still active
app.use("/api/v1", require("./routes/partnerPerformance"));
app.use("/api/v1", require("./routes/systemManagement"));

// Admin logs routes
const adminLogsRoutes = require("./routes/adminLogs");
app.use("/api/v1/admin", adminLogsRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Returns the health status of the partner service and its dependencies
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
 *               service: partner-service
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
    service: "partner-service",
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

  // Check External Partner Micro Service
  try {
    const {
      getExternalPartnerClient,
    } = require("./services/externalPartnerClient");
    const externalClient = getExternalPartnerClient();
    const externalHealth = await externalClient.healthCheck();

    healthStatus.dependencies.partnerMicroService = externalHealth;

    if (externalHealth.status !== "healthy") {
      // Don't mark overall service as unhealthy if external service is down
      // since we have fallback mechanisms
      console.warn(
        "External Partner Micro Service is unhealthy, using fallback",
      );
    }
  } catch (error) {
    healthStatus.dependencies.partnerMicroService = {
      status: "unhealthy",
      error: error.message,
      note: "Fallback to local rate calculation available",
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
    service: "partner-service",
    version: "2.0.0",
    description:
      "Partner Service for Logistics Aggregator Portal - Courier Management, Zone-based Pricing, and Charge Package Management",
    endpoints: {
      // Core endpoints
      health: "/health",
      docs: "/api-docs",

      // Partner Management
      partners: "/api/partners",
      partnerCalculate: "/api/partners/calculate",
      partnerServiceability: "/api/partners/serviceability",

      // Zone System v2
      zones: "/api/v1/zones",
      zoneCoverage: "/api/v1/zones/coverage",
      pincodeTypes: "/api/v1/pincode-types",
      chargesTypes: "/api/v1/charges-types",

      // Pincode Type Service Charges (NEW)
      pincodeTypeServiceCharges: "/api/v1/pincode-type-service-charges",

      // Partner Channel Management (NEW - Single/Multi API Configuration)
      partnerChannels: "/api/v1/partners/:partnerId/channels",
      channelMode: "/api/v1/partners/:partnerId/channel-mode",

      // Charge Packages (NEW - replaces legacy packages/charges)
      chargePackages: "/api/v1/charge-packages",

      // Geography
      geography: "/api/v1/geography",
      distanceCalculation: "/api/v1/geography/distance",

      // Performance & System (still active)
      partnerPerformance: "/api/v1/partner-performance/{partnerId}",
      systemDashboard: "/api/v1/main-system-dashboard",
    },
    deprecatedEndpoints: {
      note: "The following endpoints have been deprecated and return 410 Gone",
      deprecated: [
        "/api/packages/* -> Use /api/v1/charge-packages",
        "/api/discounts/* -> Use /api/v1/charge-packages",
        "/api/v1/charge-calculation/* -> Use /api/partners/calculate",
        "/api/v1/partner-assignment/* -> Use /api/partners/serviceability",
      ],
    },
    features: [
      "Partner Management (CRUD)",
      "Zone System v2 with Distance and Geological Zones",
      "Charge Package Management (Weight, Distance, Generic)",
      "Quote Engine with Charge Breakdown",
      "Pincode Type Management",
      "Charges Type Management (Partner-specific)",
      "Pincode Type Service Charge Management",
      "Partner Channel Management (Single/Multi API Endpoints)",
      "Zone Coverage Validation",
      "Distance-based Rate Calculation",
      "Weight-based Rate Calculation",
      "COD/Prepaid Charge Configuration",
      "Serviceability Checking",
      "External Courier API Integration",
      "Partner Performance Analytics",
      "System Dashboard and Monitoring",
      "Audit Logging for All Operations",
      "Rate Limiting and Security",
    ],
  });
});

// Error handling
app.use(errorHandler);

// Global error handlers to prevent service crashes
process.on("unhandledRejection", (reason, promise) => {
  logger.error("unhandledRejection:", {
    error: reason,
    stack: reason?.stack,
    promise: promise,
    date: new Date().toISOString(),
    process: {
      pid: process.pid,
      uid: process.getuid ? process.getuid() : "unknown",
      gid: process.getgid ? process.getgid() : "unknown",
      cwd: process.cwd(),
      execPath: process.execPath,
      version: process.version,
      argv: process.argv,
      memoryUsage: process.memoryUsage(),
    },
    os: {
      loadavg: require("os").loadavg(),
      uptime: require("os").uptime(),
    },
    trace: reason?.stack
      ? reason.stack.split("\n").map((line) => {
          const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
          if (match) {
            return {
              function: match[1],
              file: match[2],
              line: parseInt(match[3]),
              column: parseInt(match[4]),
            };
          }
          return { raw: line };
        })
      : [],
  });
  // Don't exit the process, just log the error
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", {
    error: error.message,
    stack: error.stack,
    date: new Date().toISOString(),
    process: {
      pid: process.pid,
      uid: process.getuid ? process.getuid() : "unknown",
      gid: process.getgid ? process.getgid() : "unknown",
      cwd: process.cwd(),
      execPath: process.execPath,
      version: process.version,
      argv: process.argv,
      memoryUsage: process.memoryUsage(),
    },
    os: {
      loadavg: require("os").loadavg(),
      uptime: require("os").uptime(),
    },
  });
  // Don't exit the process, just log the error
});

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
      logger.info(`🚀 Partner Service running on port ${PORT} (Production)`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(
        `Swagger docs: http://localhost:3001/swagger/partner-service (via API Gateway)`,
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
