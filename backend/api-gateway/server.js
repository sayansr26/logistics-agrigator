require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "api-gateway";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");
const swaggerUi = require("swagger-ui-express");
const logger = require("./shared/lib/logger");
const { connectRedis, getRedisClient } = require("./config/redis");
const { errorHandler } = require("./middleware/errorHandler");
const swaggerSpecs = require("./config/swagger");
const corsConfig = require("./shared/lib/corsConfig");

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors(corsConfig.getCorsOptions()));

// Logging - use shared logger
app.use(logger.httpLogger);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Logistics API Gateway",
    swaggerOptions: {
      url:
        process.env.NODE_ENV === "production"
          ? undefined
          : `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3001}/openapi.json`,
      supportedSubmitMethods: ["get", "post", "put", "delete", "patch"],
      schemes:
        process.env.NODE_ENV === "production" ? ["https", "http"] : ["http"],
    },
  }),
);

/**
 * @swagger
 * /openapi.json:
 *   get:
 *     tags: [Health]
 *     summary: OpenAPI specification
 *     description: Returns the OpenAPI 3.0 specification for the API Gateway
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: OpenAPI 3.0 specification
 */
// OpenAPI JSON endpoint
app.get("/openapi.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const dynamicSpecs = {
    ...swaggerSpecs,
    servers: [
      {
        url: `http://${req.get("host")}`,
        description: "Current server",
      },
      {
        url: "http://localhost:3001",
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

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Returns the health status of the API Gateway and its dependencies
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
 *               service: api-gateway
 *               version: '1.0.0'
 *               environment: development
 *               dependencies:
 *                 redis:
 *                   status: healthy
 *                   responseTime: 2
 *               redis: connected
 *               system:
 *                 memory:
 *                   used: 17
 *                   total: 20
 *                   external: 1
 *                   unit: MB
 *                 pid: 107
 *                 platform: linux
 *                 nodeVersion: v18.20.8
 *               responseTime: 3
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
    service: "api-gateway",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: {},
  };

  let isHealthy = true;

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

// Service routing configuration using environment variables
logger.info("🔗 API Gateway Service Configuration:", {
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || "http://auth-service:3002",
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || "http://user-service:3003",
  SHIPMENT_SERVICE_URL:
    process.env.SHIPMENT_SERVICE_URL || "http://shipment-service:3004",
  PARTNER_SERVICE_URL:
    process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
  WALLET_SERVICE_URL:
    process.env.WALLET_SERVICE_URL || "http://wallet-service:3006",
  SUPPORT_SERVICE_URL:
    process.env.SUPPORT_SERVICE_URL || "http://support-service:3007",
  PLATFORM_SERVICE_URL:
    process.env.PLATFORM_SERVICE_URL || "http://platform-service:3008",
});

const services = {
  auth: {
    target: process.env.AUTH_SERVICE_URL || "http://auth-service:3002",
    pathRewrite: { "^/api/v1/auth": "" },
  },
  users: {
    target: process.env.USER_SERVICE_URL || "http://user-service:3003",
    pathRewrite: { "^/api/v1/users": "" },
  },
  shipments: {
    target: process.env.SHIPMENT_SERVICE_URL || "http://shipment-service:3004",
    pathRewrite: { "^/api/v1/shipments": "" },
  },
  partners: {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: { "^/api/v1/partners": "" },
  },
  wallet: {
    target: process.env.WALLET_SERVICE_URL || "http://wallet-service:3006",
    pathRewrite: { "^/api/v1/wallet": "" },
  },
  support: {
    target: process.env.SUPPORT_SERVICE_URL || "http://support-service:3007",
    pathRewrite: { "^/api/v1/support": "" },
  },
  platforms: {
    target: process.env.PLATFORM_SERVICE_URL || "http://platform-service:3008",
    pathRewrite: { "^/api/v1/platforms": "" },
  },
};

/**
 * @swagger
 * /api/v1/auth/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy requests to Auth Service
 *     description: Routes authentication requests to the auth service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Auth service endpoint path
 *     responses:
 *       200:
 *         description: Success response from auth service
 *       503:
 *         description: Auth service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to Auth Service
 *     description: Routes authentication POST requests to the auth service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Auth service endpoint path
 *     responses:
 *       200:
 *         description: Success response from auth service
 *       503:
 *         description: Auth service unavailable
 */

/**
 * @swagger
 * /api/v1/users/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy requests to User Service
 *     description: Routes user management requests to the user service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User service endpoint path
 *     responses:
 *       200:
 *         description: Success response from user service
 *       503:
 *         description: User service unavailable
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to User Service
 *     description: Routes user management POST requests to the user service
 */

/**
 * @swagger
 * /api/v1/shipments/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy requests to Shipment Service
 *     description: Routes shipment requests to the shipment service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Shipment service endpoint path
 *     responses:
 *       200:
 *         description: Success response from shipment service
 *       503:
 *         description: Shipment service unavailable
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to Shipment Service
 *     description: Routes shipment POST requests to the shipment service
 */

/**
 * @swagger
 * /api/v1/partners/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy GET requests to Partner Service
 *     description: Routes partner GET requests to the partner service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner service endpoint path
 *     responses:
 *       200:
 *         description: Success response from partner service
 *       503:
 *         description: Partner service unavailable
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to Partner Service
 *     description: Routes partner POST requests to the partner service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner service endpoint path
 *     responses:
 *       200:
 *         description: Success response from partner service
 *       503:
 *         description: Partner service unavailable
 *   put:
 *     tags: [Gateway]
 *     summary: Proxy PUT requests to Partner Service
 *     description: Routes partner PUT requests to the partner service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner service endpoint path
 *     responses:
 *       200:
 *         description: Success response from partner service
 *       503:
 *         description: Partner service unavailable
 *   delete:
 *     tags: [Gateway]
 *     summary: Proxy DELETE requests to Partner Service
 *     description: Routes partner DELETE requests to the partner service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner service endpoint path
 *     responses:
 *       200:
 *         description: Success response from partner service
 *       503:
 *         description: Partner service unavailable
 */

/**
 * @swagger
 * /api/v1/wallet/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy requests to Wallet Service
 *     description: Routes wallet requests to the wallet service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet service endpoint path
 *     responses:
 *       200:
 *         description: Success response from wallet service
 *       503:
 *         description: Wallet service unavailable
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to Wallet Service
 *     description: Routes wallet POST requests to the wallet service
 */

/**
 * @swagger
 * /api/v1/support/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy GET requests to Support Service
 *     description: Routes support GET requests to the support service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Support service endpoint path
 *     responses:
 *       200:
 *         description: Success response from support service
 *       503:
 *         description: Support service unavailable
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to Support Service
 *     description: Routes support POST requests to the support service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Support service endpoint path
 *     responses:
 *       200:
 *         description: Success response from support service
 *       503:
 *         description: Support service unavailable
 *   put:
 *     tags: [Gateway]
 *     summary: Proxy PUT requests to Support Service
 *     description: Routes support PUT requests to the support service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Support service endpoint path
 *     responses:
 *       200:
 *         description: Success response from support service
 *       503:
 *         description: Support service unavailable
 *   delete:
 *     tags: [Gateway]
 *     summary: Proxy DELETE requests to Support Service
 *     description: Routes support DELETE requests to the support service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Support service endpoint path
 *     responses:
 *       200:
 *         description: Success response from support service
 *       503:
 *         description: Support service unavailable
 */

/**
 * @swagger
 * /api/v1/platforms/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy GET requests to Platform Service
 *     description: Routes platform GET requests to the platform service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform service endpoint path
 *     responses:
 *       200:
 *         description: Success response from platform service
 *       503:
 *         description: Platform service unavailable
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to Platform Service
 *     description: Routes platform POST requests to the platform service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform service endpoint path
 *     responses:
 *       200:
 *         description: Success response from platform service
 *       503:
 *         description: Platform service unavailable
 *   put:
 *     tags: [Gateway]
 *     summary: Proxy PUT requests to Platform Service
 *     description: Routes platform PUT requests to the platform service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform service endpoint path
 *     responses:
 *       200:
 *         description: Success response from platform service
 *       503:
 *         description: Platform service unavailable
 *   delete:
 *     tags: [Gateway]
 *     summary: Proxy DELETE requests to Platform Service
 *     description: Routes platform DELETE requests to the platform service
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform service endpoint path
 *     responses:
 *       200:
 *         description: Success response from platform service
 *       503:
 *         description: Platform service unavailable
 */

// Create proxy middleware for each service
Object.keys(services).forEach((service) => {
  const config = services[service];
  app.use(
    `/api/v1/${service}`,
    createProxyMiddleware({
      target: config.target,
      changeOrigin: true,
      pathRewrite: config.pathRewrite,
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${service}:`, {
          error: err.message,
          target: config.target,
          path: req.path,
        });
        res.status(503).json({
          status: "error",
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: `${service} service is currently unavailable`,
          },
          meta: {
            timestamp: new Date().toISOString(),
            service: "api-gateway",
          },
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Log proxy requests
        logger.info(`Proxying ${req.method} ${req.path} to ${service} service`);
      },
    }),
  );
});

// Catch all for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info("Redis connected");

    // Log CORS configuration
    corsConfig.logCorsConfiguration();

    app.listen(PORT, () => {
      logger.info(
        `🚀 API Gateway running on port ${PORT} (LIVE RELOAD ENABLED)`,
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
