const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();
const { corsConfig } = require("./shared");
const swaggerSpecs = require("./config/swagger");

const app = express();
const PORT = process.env.PORT || 3007;

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
    customSiteTitle: "Support Service API",
  }),
);

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
  console.log(`🚀 Support Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
