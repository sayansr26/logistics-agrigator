require("dotenv").config();

// Set service name for logger before importing
process.env.SERVICE_NAME = "user-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("./shared/lib/logger");

const app = express();
const PORT = process.env.PORT || 8002;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(logger.httpLogger);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "user-service",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API routes placeholder
app.get("/api/users", (req, res) => {
  res.json({
    message: "User Service - Users endpoint ready for implementation",
  });
});

app.get("/api/profile", (req, res) => {
  res.json({
    message: "User Service - Profile endpoint ready for implementation",
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
app.use((err, req, res, _next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong!",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    `🚀 User Service running on port ${PORT} (LIVE RELOAD ENABLED ✨)`,
  );
  logger.info(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
