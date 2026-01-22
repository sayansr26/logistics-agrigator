require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "user-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// Swagger UI removed - documentation available via API Gateway only
// const swaggerUi = require("swagger-ui-express");
const { PrismaClient } = require("@prisma/client");
const logger = require("./shared/lib/logger");

// Initialize Prisma client
const prisma = new PrismaClient();

// Import Swagger configuration
const swaggerSpecs = require("./config/swagger");
const { corsConfig } = require("./shared");

// Import middleware
const auth = require("./middleware/auth");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { validatePaginationQuery } = require("./middleware/validate");
const APIResponse = require("./shared/lib/response");

// Import routes
const userRoutes = require("./routes/users");
const clientRoutes = require("./routes/clients");
const outletRoutes = require("./routes/outlets");
const internalRoutes = require("./routes/internal");
const dashboardRoutes = require("./routes/dashboard");
const affiliateRoutes = require("./routes/affiliate");
const adminAffiliateRoutes = require("./routes/admin/affiliates");

const app = express();
const PORT = process.env.PORT || 8002;

// Middleware
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

app.use(logger.httpLogger);
app.use(express.json({ limit: "10mb" }));
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
  const expectedSecret =
    process.env.INTERNAL_SECRET || "internal-service-secret";

  if (!internalHeader || internalHeader !== expectedSecret) {
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
// Access Swagger UI through API Gateway at http://localhost:3001/swagger/user-service
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {...}));

// Swagger JSON endpoint with dynamic server URLs
app.get("/api-docs.json", (req, res) => {
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
        url: "http://localhost:8002",
        description: "Development server (localhost)",
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              url: "https://api.logistics.com/user",
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
 *     summary: Health check endpoint
 *     description: Returns the current health status of the User Service including database and dependency checks
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
app.get("/health", async (req, res) => {
  const startTime = Date.now();
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "user-service",
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
    // Check Redis connection (if configured)
    if (process.env.REDIS_URL) {
      const redisStart = Date.now();
      const redisUtils = require("./shared/lib/redis");

      try {
        const redisClient = redisUtils.getClient();
        await redisClient.ping();
        const redisTime = Date.now() - redisStart;

        healthStatus.redis = "connected";
        healthStatus.dependencies.redis = {
          status: "healthy",
          responseTime: redisTime,
        };
      } catch (clientError) {
        // Try to create client if not initialized
        if (clientError.message.includes("not initialized")) {
          await redisUtils.createClient(process.env.REDIS_URL);
          const redisClient = redisUtils.getClient();
          await redisClient.ping();
          const redisTime = Date.now() - redisStart;

          healthStatus.redis = "connected";
          healthStatus.dependencies.redis = {
            status: "healthy",
            responseTime: redisTime,
          };
        } else {
          throw clientError;
        }
      }
    } else {
      healthStatus.redis = "not_configured";
      healthStatus.dependencies.redis = {
        status: "not_configured",
        note: "Redis URL not provided in environment variables",
      };
    }
  } catch (error) {
    // Redis connectivity is not critical for user service core functionality
    healthStatus.redis = "disconnected";
    healthStatus.dependencies.redis = {
      status: "degraded",
      error: error.message,
      note: "Redis connectivity issue - caching features may be limited",
    };
  }

  try {
    // Check Auth Service connectivity
    const authStart = Date.now();
    const authResponse = await fetch(`${process.env.AUTH_SERVICE_URL}/health`, {
      timeout: 3000,
    });
    const authTime = Date.now() - authStart;

    if (authResponse.ok) {
      healthStatus.dependencies.authService = {
        status: "healthy",
        responseTime: authTime,
      };
    } else {
      throw new Error(`Auth service returned ${authResponse.status}`);
    }
  } catch (error) {
    // Auth service connectivity is not critical for user service health
    healthStatus.dependencies.authService = {
      status: "degraded",
      error: error.message,
      note: "Auth service connectivity issue - some features may be limited",
    };
  }

  // System metrics
  const memUsage = process.memoryUsage();
  healthStatus.system = {
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      unit: "MB",
    },
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version,
  };

  healthStatus.responseTime = Date.now() - startTime;

  if (!isHealthy) {
    healthStatus.status = "error";
    return res.status(503).json(healthStatus);
  }

  res.json(healthStatus);
});

// Test endpoints for middleware validation

/**
 * @swagger
 * /api/test/public:
 *   get:
 *     summary: Public test endpoint
 *     description: Test endpoint that requires no authentication - used for testing API connectivity
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Public endpoint accessible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: "success"
 *               data:
 *                 message: "Public endpoint - no authentication required"
 */
app.get("/api/test/public", (req, res) => {
  res.json(
    APIResponse.success({
      message: "Public endpoint - no authentication required",
    }),
  );
});

/**
 * @swagger
 * /api/test/authenticated:
 *   get:
 *     summary: Authenticated test endpoint
 *     description: Test endpoint that requires valid JWT authentication - returns user context
 *     tags: [Testing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated endpoint accessible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: "success"
 *               data:
 *                 message: "Authenticated endpoint"
 *                 user:
 *                   userId: "123e4567-e89b-12d3-a456-426614174000"
 *                   email: "user@example.com"
 *                   role: "client"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/api/test/authenticated", auth.authenticate, (req, res) => {
  res.json(
    APIResponse.success({
      message: "Authenticated endpoint",
      user: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
      },
    }),
  );
});

/**
 * @swagger
 * /api/test/with-profile:
 *   get:
 *     summary: Authenticated with profile test endpoint
 *     description: Test endpoint that requires authentication and enriches user context with profile data
 *     tags: [Testing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated endpoint with profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: "success"
 *               data:
 *                 message: "Authenticated with profile endpoint"
 *                 user:
 *                   userId: "123e4567-e89b-12d3-a456-426614174000"
 *                   email: "user@example.com"
 *                   role: "client"
 *                   hasProfile: true
 *                   clientId: "CLIENT_001"
 *                 profile:
 *                   id: "profile-123"
 *                   firstName: "John"
 *                   lastName: "Doe"
 *                   isActive: true
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/api/test/with-profile", auth.authenticateWithProfile, (req, res) => {
  res.json(
    APIResponse.success({
      message: "Authenticated with profile endpoint",
      user: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        hasProfile: req.user.hasProfile,
        clientId: req.user.clientId,
      },
      profile: req.userProfile
        ? {
            id: req.userProfile.id,
            firstName: req.userProfile.firstName,
            lastName: req.userProfile.lastName,
            isActive: req.userProfile.isActive,
          }
        : null,
    }),
  );
});

/**
 * @swagger
 * /api/test/admin-only:
 *   get:
 *     summary: Admin-only test endpoint
 *     description: Test endpoint that requires admin role authentication
 *     tags: [Testing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin endpoint accessible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: "success"
 *               data:
 *                 message: "Admin only endpoint"
 *                 role: "admin"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/api/test/admin-only", auth.adminOnly, (req, res) => {
  res.json(
    APIResponse.success({
      message: "Admin only endpoint",
      role: req.user.role,
    }),
  );
});

/**
 * @swagger
 * /api/test/client-access:
 *   get:
 *     summary: Client access test endpoint
 *     description: Test endpoint that requires client, operations, or admin role access
 *     tags: [Testing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client access endpoint accessible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: "success"
 *               data:
 *                 message: "Client access endpoint"
 *                 role: "client"
 *                 clientId: "CLIENT_001"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get(
  "/api/test/client-access",
  auth.requireClientAccess(["client", "operations", "admin"]),
  (req, res) => {
    res.json(
      APIResponse.success({
        message: "Client access endpoint",
        role: req.user.role,
        clientId: req.user.clientId,
      }),
    );
  },
);

/**
 * @swagger
 * /api/test/pagination:
 *   get:
 *     summary: Pagination test endpoint
 *     description: Test endpoint for validating pagination query parameters
 *     tags: [Testing]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Pagination parameters validated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               status: "success"
 *               data:
 *                 message: "Pagination test endpoint"
 *                 query:
 *                   page: 1
 *                   limit: 20
 *                   sortOrder: "desc"
 *       400:
 *         description: Invalid pagination parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get("/api/test/pagination", validatePaginationQuery, (req, res) => {
  res.json(
    APIResponse.success({
      message: "Pagination test endpoint",
      query: req.query,
    }),
  );
});

// API Routes
app.use("/api", userRoutes);
app.use("/api", clientRoutes);
app.use("/api", outletRoutes);
app.use("/api/v1/internal", internalRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/v1/affiliate", affiliateRoutes);
app.use("/api/v1/admin/affiliates", adminAffiliateRoutes);
const adminLogsRoutes = require("./routes/adminLogs");
app.use("/api/v1/admin", adminLogsRoutes);

// 404 handler
app.use("*", notFoundHandler);

// Error handler
app.use(errorHandler);

// Log CORS configuration
corsConfig.logCorsConfiguration();

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 User Service running on port ${PORT} (Production)`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(
    `📚 Swagger docs: http://localhost:3001/swagger/user-service (via API Gateway)`,
  );
});

module.exports = app;
