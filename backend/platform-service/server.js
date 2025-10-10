const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();
const { corsConfig } = require("./shared");
const swaggerSpecs = require("./config/swagger");

const app = express();
const PORT = process.env.PORT || 3008;

// Middleware
app.use(helmet());
app.use(cors(corsConfig.getCorsOptions()));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Swagger API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Platform Service API",
  }),
);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Returns the health status of the platform service
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
    service: "platform-service",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

/**
 * @swagger
 * /api/platforms:
 *   get:
 *     tags: [Platforms]
 *     summary: Get available platforms
 *     description: Placeholder endpoint - ready for implementation
 *     responses:
 *       200:
 *         description: Available platforms placeholder
 */
app.get("/api/platforms", (req, res) => {
  res.json({
    message: "Platform Service - Available platforms endpoint ready",
  });
});

/**
 * @swagger
 * /api/shopify/connect:
 *   get:
 *     tags: [Shopify]
 *     summary: Connect Shopify store
 *     description: Placeholder endpoint - ready for implementation
 *     responses:
 *       200:
 *         description: Shopify connection endpoint placeholder
 */
app.get("/api/shopify/connect", (req, res) => {
  res.json({ message: "Platform Service - Shopify connection endpoint ready" });
});

/**
 * @swagger
 * /api/woocommerce/connect:
 *   get:
 *     tags: [WooCommerce]
 *     summary: Connect WooCommerce store
 *     description: Placeholder endpoint - ready for implementation
 *     responses:
 *       200:
 *         description: WooCommerce connection endpoint placeholder
 */
app.get("/api/woocommerce/connect", (req, res) => {
  res.json({
    message: "Platform Service - WooCommerce connection endpoint ready",
  });
});

/**
 * @swagger
 * /api/integrations:
 *   get:
 *     tags: [Integrations]
 *     summary: Get user integrations
 *     description: Placeholder endpoint - ready for implementation
 *     responses:
 *       200:
 *         description: User integrations endpoint placeholder
 */
app.get("/api/integrations", (req, res) => {
  res.json({ message: "Platform Service - User integrations endpoint ready" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong!",
  });
});

// Log CORS configuration
corsConfig.logCorsConfiguration();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Platform Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
