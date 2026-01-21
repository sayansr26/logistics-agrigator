const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
// Swagger UI removed - documentation available via API Gateway only
// const swaggerUi = require("swagger-ui-express");
require("dotenv").config();
const { corsConfig } = require("./shared");
const swaggerSpecs = require("./config/swagger");

// Import logger for security logging
const logger = console; // Support service uses console for now

const app = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.use(helmet());
app.use(cors(corsConfig.getCorsOptions()));
app.use(morgan("combined"));
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
// Access Swagger UI through API Gateway at http://localhost:3001/swagger/support-service
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
        url: "http://localhost:3007",
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
 *     description: Returns the health status of the support service
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "support-service",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     tags: [Tickets]
 *     summary: Get support tickets
 *     description: Placeholder endpoint - ready for implementation
 *     responses:
 *       200:
 *         description: Tickets endpoint placeholder
 */
app.get("/api/tickets", (req, res) => {
  res.json({
    message: "Support Service - Tickets endpoint ready for implementation",
  });
});

/**
 * @swagger
 * /api/faq:
 *   get:
 *     tags: [FAQ]
 *     summary: Get frequently asked questions
 *     description: Placeholder endpoint - ready for implementation
 *     responses:
 *       200:
 *         description: FAQ endpoint placeholder
 */
app.get("/api/faq", (req, res) => {
  res.json({
    message: "Support Service - FAQ endpoint ready for implementation",
  });
});

/**
 * @swagger
 * /api/knowledge-base:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get knowledge base articles
 *     description: Placeholder endpoint - ready for implementation
 *     responses:
 *       200:
 *         description: Knowledge base endpoint placeholder
 */
app.get("/api/knowledge-base", (req, res) => {
  res.json({
    message: "Support Service - Knowledge base ready for implementation",
  });
});

// Admin logs routes
const adminLogsRoutes = require("./routes/adminLogs");
app.use("/api/v1/admin", adminLogsRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong!",
  });
});

// Log CORS configuration
corsConfig.logCorsConfiguration();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Support Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(
    `📚 Swagger docs: http://localhost:3001/swagger/support-service (via API Gateway)`,
  );
});

module.exports = app;
