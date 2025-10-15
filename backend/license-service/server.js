require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "license-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// Swagger UI removed - documentation available via API Gateway only
// const swaggerUi = require("swagger-ui-express");
const logger = require("./shared/lib/logger");

const licenseRoutes = require("./routes/licenseRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const activationRoutes = require("./routes/activationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const metricsRoutes = require("./routes/metricsRoutes");

const { errorHandler } = require("./middleware/errorHandler");
const { initializeDatabase, getDatabase } = require("./config/database");
const { initializeRedis, getClient } = require("./config/redis");
const { specs: swaggerSpecs } = require("./config/swagger");
const corsConfig = require("./shared/lib/corsConfig");

const app = express();
const PORT = process.env.PORT || 3011;

// Security middleware
app.use(helmet());
app.use(cors(corsConfig));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request processed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// API Documentation - Swagger UI removed, only JSON endpoint available
// Access Swagger UI through API Gateway at http://localhost:3001/swagger/license-service
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
        url: "http://localhost:3011",
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

// Service info endpoint
app.get("/", (req, res) => {
  res.json({
    service: "License Management Service",
    version: "1.0.0",
    status: "operational",
    endpoints: [
      "/health",
      "/api/v1/licenses",
      "/api/v1/subscriptions",
      "/api/v1/activate",
      "/api/v1/admin",
      "/api/v1/metrics",
      "/api-docs",
    ],
  });
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const startTime = Date.now();
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "license-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: {},
  };

  let isHealthy = true;

  try {
    // Check database connection
    const prisma = getDatabase();
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
    const redisClient = getClient();
    const redisStart = Date.now();
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

  healthStatus.responseTime = Date.now() - startTime;

  if (!isHealthy) {
    healthStatus.status = "error";
    return res.status(503).json(healthStatus);
  }

  res.json(healthStatus);
});

// API Routes
app.use("/api/v1/licenses", licenseRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/activate", activationRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/metrics", metricsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Resource not found",
    path: req.url,
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  try {
    const prisma = getDatabase();
    await prisma.$disconnect();
    const redisClient = getClient();
    if (redisClient) {
      await redisClient.quit();
    }
  } catch (error) {
    logger.error("Error during shutdown:", error);
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  try {
    const prisma = getDatabase();
    await prisma.$disconnect();
    const redisClient = getClient();
    if (redisClient) {
      await redisClient.quit();
    }
  } catch (error) {
    logger.error("Error during shutdown:", error);
  }
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info("Database connected via Prisma");

    // Initialize Redis
    await initializeRedis();
    logger.info("Redis connected");

    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 License Service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(
        `Swagger docs: http://localhost:3001/swagger/license-service (via API Gateway)`,
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
