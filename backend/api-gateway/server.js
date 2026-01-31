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
const { validateJWT } = require("./middleware/authValidator");
const swaggerSpecs = require("./config/swagger");
const corsConfig = require("./shared/lib/corsConfig");

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors(corsConfig.getCorsOptions()));

// Logging - use shared logger
app.use(logger.httpLogger);

// Body parsing - only for non-proxy routes (health, swagger, etc.)
// Proxy routes should not have body parsed here as it prevents forwarding
app.use((req, res, next) => {
  // Skip body parsing for API routes that will be proxied
  if (req.path.startsWith("/api/v1/")) {
    return next();
  }
  // Apply body parsing for other routes
  express.json({ limit: "10mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api/v1/")) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, next);
});

// Rate limiting - Increased limits for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for dev)
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Intercept and block any HTTPS asset requests
app.use("/api-docs/*", (req, res, next) => {
  // If request is for swagger assets that might load from CDN, return empty
  if (
    req.path.includes(".css") ||
    req.path.includes(".js") ||
    req.path.includes(".png") ||
    req.path.includes("favicon")
  ) {
    if (req.path.includes(".css")) {
      res.setHeader("Content-Type", "text/css");
      res.send("/* Empty CSS to prevent external loading */");
    } else if (req.path.includes(".js")) {
      res.setHeader("Content-Type", "application/javascript");
      res.send("// Empty JS to prevent external loading");
    } else {
      res.status(204).send();
    }
    return;
  }
  next();
});

// API Documentation
const swaggerHtml = swaggerUi.generateHTML(swaggerSpecs, {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Logistics API Gateway",
  swaggerOptions: {
    url: "/openapi.json",
    validatorUrl: null,
    tryItOutEnabled: true,
    supportedSubmitMethods: ["get", "post", "put", "delete", "patch"],
  },
});

app.use("/api-docs", swaggerUi.serveFiles(swaggerSpecs, {}));
app.get("/api-docs", (req, res) => {
  res.send(swaggerHtml);
});

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
 * JWT Validation Middleware
 * Applied to all API routes to validate JWT tokens
 * Public paths (login, register, etc.) are exempted in the middleware
 */
logger.info("🔒 Applying JWT validation middleware to all API routes");
app.use(validateJWT);

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

// Swagger aggregation routes (dev only)
if (
  process.env.NODE_ENV === "development" ||
  process.env.SWAGGER_ENABLED === "true"
) {
  const swaggerRoutes = require("./routes/swagger");
  app.use("/swagger", swaggerRoutes);
  logger.info("📚 Swagger aggregation enabled at /swagger");
}

// Logs aggregation routes
const logsRoutes = require("./routes/logs");
app.use("/api/v1", logsRoutes);
logger.info(
  "📊 Logs aggregation enabled at /api/v1/audit-logs and /api/v1/admin/audit-logs",
);

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
    pathRewrite: {
      "^/api/v1/auth/health": "/health", // Health endpoint → /health
      "^/api/v1/auth": "/auth", // API endpoints → /auth/*
    },
  },
  user: {
    target: process.env.USER_SERVICE_URL || "http://user-service:3003",
    pathRewrite: {
      "^/api/v1/user/health": "/health", // Health endpoint → /health
      "^/api/v1/user": "/api", // API endpoints → /api/* (user-service profiles, clients, etc.)
    },
  },
  users: {
    target: process.env.AUTH_SERVICE_URL || "http://auth-service:3002",
    pathRewrite: {
      "^/api/v1/users/health": "/health", // Health endpoint → /health
      "^/api/v1/users": "/auth/users", // API endpoints → /auth/users/* (auth-service manages users table)
    },
  },
  outlets: {
    target: process.env.USER_SERVICE_URL || "http://user-service:3003",
    pathRewrite: {
      "^/api/v1/outlets": "/api/outlets", // Outlet endpoints → /api/outlets/* (user-service outlet management)
    },
  },
  shipments: {
    target: process.env.SHIPMENT_SERVICE_URL || "http://shipment-service:3004",
    pathRewrite: {
      "^/api/v1/shipments/health": "/health", // Health endpoint → /health
      "^/api/v1/shipments": "/api/v1/shipments", // API endpoints → /api/v1/shipments/*
    },
  },
  partners: {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/partners/health": "/health", // Health endpoint → /health
      "^/api/v1/partners": "/api/partners", // API endpoints → /api/partners/*
    },
  },
  // Geographical Data Management (in partner service - public endpoints)
  geography: {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/geography": "/api/v1/geography", // Geography endpoints → /api/v1/geography/*
    },
  },
  // Zone Management (in partner service)
  zones: {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/zones": "/api/v1/zones", // Zones endpoints → /api/v1/zones/*
    },
  },
  // Pincode Type Management (Simplified - admin/operations only)
  "pincode-types": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/pincode-types": "/api/v1/pincode-types", // Pincode types → /api/v1/pincode-types/*
    },
  },
  // Charges Type Management (Partner-specific charge types - admin/operations only)
  "charges-types": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/charges-types": "/api/v1/charges-types", // Charges types → /api/v1/charges-types/*
    },
  },
  // Charge Package Management (Zone System v2 - partner charge packages)
  "charge-packages": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/charge-packages": "/api/v1/charge-packages", // Charge packages → /api/v1/charge-packages/*
    },
  },
  // System management endpoints (also in partner service)
  "services-status": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/services-status": "/api/v1/services-status",
    },
  },
  "system-health": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/system-health": "/api/v1/system-health",
    },
  },
  "system-configuration": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/system-configuration": "/api/v1/system-configuration",
    },
  },
  "system-cache": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/system-cache": "/api/v1/system-cache",
    },
  },
  "system-statistics": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/system-statistics": "/api/v1/system-statistics",
    },
  },
  "system-alerts": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/system-alerts": "/api/v1/system-alerts",
    },
  },
  "system-maintenance": {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/system-maintenance": "/api/v1/system-maintenance",
    },
  },
  webhooks: {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/webhooks": "/api/v1/webhooks",
    },
  },
  audit: {
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    pathRewrite: {
      "^/api/v1/audit": "/api/v1/audit",
    },
  },
  wallet: {
    target: process.env.WALLET_SERVICE_URL || "http://wallet-service:3006",
    pathRewrite: {
      "^/api/v1/wallet/health": "/health", // Health endpoint → /health
      "^/api/v1/wallet": "/api/v1/wallet", // API endpoints → /api/v1/wallet/*
    },
  },
  support: {
    target: process.env.SUPPORT_SERVICE_URL || "http://support-service:3007",
    pathRewrite: {
      "^/api/v1/support/health": "/health", // Health endpoint → /health
      "^/api/v1/support": "/api/v1/support", // API endpoints → /api/v1/support/*
    },
  },
  platforms: {
    target: process.env.PLATFORM_SERVICE_URL || "http://platform-service:3008",
    pathRewrite: {
      "^/api/v1/platforms/health": "/health", // Health endpoint → /health
      "^/api/v1/platforms": "/api/v1/platforms", // API endpoints → /api/v1/platforms/*
    },
  },
  // Internal Service Communication (in user service) - for inter-service bootstrap, etc.
  internal: {
    target: process.env.USER_SERVICE_URL || "http://user-service:3003",
    pathRewrite: {
      "^/api/v1/internal": "/api/v1/internal", // Internal → /api/v1/internal/*
    },
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
 * /api/v1/pincode-types/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy GET requests to Pincode Types (Partner Service)
 *     description: Routes pincode type management GET requests to partner service (admin/operations only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Pincode types endpoint path
 *     responses:
 *       200:
 *         description: Success response from partner service
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin/operations role required
 *       503:
 *         description: Partner service unavailable
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy POST requests to Pincode Types (Partner Service)
 *     description: Routes pincode type management POST requests (create, assign) to partner service
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Pincode types endpoint path
 *     responses:
 *       200:
 *         description: Success response from partner service
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin/operations role required
 *       503:
 *         description: Partner service unavailable
 *   put:
 *     tags: [Gateway]
 *     summary: Proxy PUT requests to Pincode Types (Partner Service)
 *     description: Routes pincode type management PUT requests (update) to partner service
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Pincode types endpoint path
 *     responses:
 *       200:
 *         description: Success response from partner service
 *       503:
 *         description: Partner service unavailable
 *   delete:
 *     tags: [Gateway]
 *     summary: Proxy DELETE requests to Pincode Types (Partner Service)
 *     description: Routes pincode type management DELETE requests (soft delete, unassign) to partner service
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: path
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Pincode types endpoint path
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
      // Don't parse body in Express for proxy requests
      // This prevents body consumption before proxying
      parseReqBody: false,
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
      onProxyReq: (proxyReq, req, _res) => {
        // Add internal secret header for backend service validation
        const internalSecret = process.env.INTERNAL_SECRET;
        if (!internalSecret) {
          logger.error("INTERNAL_SECRET not configured!");
        }
        proxyReq.setHeader("X-Internal-Request", internalSecret);

        // Log proxy requests
        logger.info(
          `Proxying ${req.method} ${req.path} to ${service} service`,
          {
            userId: req.user?.userId,
            role: req.user?.role,
            hasInternalSecret: !!internalSecret,
          },
        );
      },
    }),
  );
});

// Manual proxy for Partner Channel Management endpoints
// These must be registered BEFORE the catch-all but AFTER the general partners proxy
// Routes: /api/v1/partners/:partnerId/channels/* and /api/v1/channels/*
logger.info("Adding manual proxy for partner channel management endpoints");
app.use(
  [
    "/api/v1/partners/:partnerId/channels",
    "/api/v1/partners/:partnerId/channel-mode",
    "/api/v1/channels",
  ],
  createProxyMiddleware({
    target: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
    changeOrigin: true,
    pathRewrite: (path) => {
      // Keep the full path, no rewriting
      logger.info(`Proxying channel request: ${path}`);
      return path;
    },
    parseReqBody: false,
    onError: (err, req, res) => {
      logger.error(`Proxy error for partner channels:`, {
        error: err.message,
        path: req.path,
      });
      res.status(503).json({
        status: "error",
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Partner service is currently unavailable",
        },
      });
    },
    onProxyReq: (proxyReq, req, _res) => {
      const internalSecret = process.env.INTERNAL_SECRET;
      if (internalSecret) {
        proxyReq.setHeader("X-Internal-Request", internalSecret);
      }
    },
  }),
);

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
      logger.info(`🚀 API Gateway running on port ${PORT} (Production)`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
