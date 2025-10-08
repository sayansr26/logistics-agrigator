require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "partner-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const logger = require("./shared/lib/logger");

const partnerRoutes = require("./routes/partners");
const { errorHandler } = require("./middleware/errorHandler");
const { connectDB, prisma } = require("./config/database");
const { connectRedis, getRedisClient } = require("./config/redis");
const swaggerSpecs = require("./config/swagger");
const { generalLimiter } = require("./middleware/rateLimiter");
const { corsConfig } = require("./shared");

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

// API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Logistics Partner Service API",
    swaggerOptions: {
      // Force HTTP protocol for development to avoid SSL errors with IP access
      url:
        process.env.NODE_ENV === "production"
          ? undefined
          : `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3005}/openapi.json`,
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
app.use("/api/geographical", require("./routes/geographical"));
app.use("/api", require("./routes/zones"));
app.use("/api/packages", require("./routes/packages"));
app.use("/api/customer-charges", require("./routes/customerCharges"));
app.use("/api/discounts", require("./routes/discounts"));
app.use("/api", require("./routes/partnerData"));
app.use("/api/v1/charge-calculation", require("./routes/chargeCalculation"));
app.use("/api/v1/partner-assignment", require("./routes/partnerAssignment"));
app.use("/api/v1", require("./routes/partnerPerformance"));
app.use("/api/v1", require("./routes/systemManagement"));

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
    version: "1.0.0",
    description:
      "Partner Service for Logistics Aggregator Portal - Courier Management and External API Integration",
    endpoints: {
      health: "/health",
      docs: "/api-docs",
      partners: "/api/partners",
      geographical: "/api/geographical",
      zones: "/api/zones",
      serviceTypes: "/api/service-types",
      partnerZones: "/api/partner-zones",
      comprehensiveData: "/api/partners/comprehensive-data",
      zoneCoverage: "/api/zones/coverage/validate",
      packages: "/api/packages",
      packageCharges: "/api/packages/charges",
      customerCharges: "/api/customer-charges",
      chargeCalculation: "/api/packages/charges/calculate",
      customerChargeCalculation: "/api/customer-charges/calculate",
      discounts: "/api/discounts",
      discountCalculation: "/api/discounts/calculate",
      activeDiscounts: "/api/discounts/active",
      discountAnalytics: "/api/discounts/analytics",
      bulkDiscounts: "/api/discounts/bulk",
      rateCalculationWithDiscounts: "/api/partners/calculate-with-discounts",
      partnerPackages: "/api/partner-packages",
      partnerCharges: "/api/partner-charges",
      partnerDiscounts: "/api/partner-discounts",
      partnerServices: "/api/partner-services",
      comprehensivePartnerData: "/api/partners/comprehensive-data",
      partnerMetrics: "/api/partners/{partnerId}/metrics",
      partnerDataExport: "/api/partners/{partnerId}/export",
      partnerCacheManagement: "/api/partners/{partnerId}/cache",
      partnerDataHealth: "/api/partners/{partnerId}/health",
      chargeCalculationSurcharge:
        "/api/v1/charge-calculation/{partnerId}/calculate",
      shipmentChargeCalculation:
        "/api/v1/charge-calculation/shipments/calculate-charges",
      partnerAvailabilityCheck: "/api/v1/partner-assignment/availability/check",
      shipmentAssignment: "/api/v1/partner-assignment/assign",
      partnerPerformance: "/api/v1/partner-performance/{partnerId}",
      systemDashboard: "/api/v1/main-system-dashboard",
      partnerAnalytics: "/api/v1/partner-analytics/{partnerId}",
      partnerBenchmarks: "/api/v1/partner-benchmarks/{partnerId}",
      partnerKPIs: "/api/v1/partner-kpis/{partnerId}",
      performanceAlerts: "/api/v1/performance-alerts",
      performanceStatistics: "/api/v1/partner-performance/statistics",
      performanceReport: "/api/v1/partner-performance/report",
      systemInitialization: "/api/v1/main-system",
      rateLimitManagement: "/api/v1/main-system-rate-limit",
      cacheManagement: "/api/v1/main-system-cache",
      auditTrail: "/api/v1/audit",
      webhookManagement: "/api/v1/webhooks",
      systemHealth: "/api/v1/system-health",
      servicesStatus: "/api/v1/services-status",
      systemConfiguration: "/api/v1/system-configuration",
      systemStatistics: "/api/v1/system-statistics",
      systemMaintenance: "/api/v1/system-maintenance",
      systemAlerts: "/api/v1/system-alerts",
    },
    features: [
      "Partner Management",
      "Rate Calculation",
      "Serviceability Checking",
      "Geographical Data Services",
      "Pincode Search and Validation",
      "City and State Information",
      "Zone Management and Configuration",
      "Service Type Management",
      "Zone Coverage Validation",
      "Package Charge Management",
      "Customer Charge Configuration",
      "Bulk Charge Operations",
      "Charge Calculation Workflows",
      "FSC, COD, Insurance Charges",
      "Weight-based Charge Calculation",
      "Zone-to-Zone Charge Mapping",
      "Comprehensive Partner Data Retrieval",
      "External Courier API Integration",
      "Charge Preview and Validation",
      "Discount Management and Configuration",
      "Discount Calculation and Application",
      "Time-based Discount Activation",
      "Bulk Discount Operations",
      "Discount Conflict Resolution",
      "Discount Performance Analytics",
      "Active Discount Retrieval",
      "Comprehensive Partner Data Retrieval",
      "Partner Package Data Aggregation",
      "Partner Charge Data Consolidation",
      "Partner Discount Management",
      "Partner Service Capability Analysis",
      "Partner Performance Metrics",
      "Partner Data Export (JSON/CSV)",
      "Partner Data Cache Management",
      "Partner Data Health Monitoring",
      "Multi-source Data Integration",
      "Real-time Data Aggregation",
      "Advanced Charge Calculation Services",
      "Surcharge Calculation and Management",
      "Shipment Charge Calculation",
      "Charge Validation and Verification",
      "Comprehensive Charge Breakdown",
      "Partner Assignment Algorithms",
      "Partner Availability Checking",
      "Shipment Assignment Workflows",
      "Assignment Strategy Optimization",
      "Partner Performance Analytics",
      "System Dashboard and Monitoring",
      "Partner Analytics and Insights",
      "Benchmark Comparisons",
      "Key Performance Indicators (KPIs)",
      "Performance Alerts and Notifications",
      "Performance Statistics and Reporting",
      "Comprehensive Performance Reports",
      "System Management and Control",
      "System Initialization and Configuration",
      "Rate Limiting Management",
      "Cache Management and Optimization",
      "Audit Trail and Logging",
      "Webhook Management and Integration",
      "System Health Monitoring",
      "Services Status Tracking",
      "System Configuration Management",
      "System Statistics and Metrics",
      "System Maintenance Operations",
      "System Alerts and Notifications",
      "Advanced Analytics and Insights",
      "Performance Benchmarking",
      "Quality Metrics and Scoring",
      "Cost Optimization Analysis",
      "Delivery Efficiency Tracking",
      "Customer Satisfaction Monitoring",
      "Trend Analysis and Forecasting",
      "Recommendation Engine",
      "Smart Partner Selection",
      "Automated Failover Mechanisms",
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
      logger.info(
        `🚀 Partner Service running on port ${PORT} (LIVE RELOAD ENABLED)`,
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
