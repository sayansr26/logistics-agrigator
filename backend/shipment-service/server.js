const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8003;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Import routes
const shipmentRoutes = require("./routes/shipments");

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "shipment-service",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    features: {
      walletIntegration: "enabled",
      paymentProcessing: "enabled",
    },
  });
});

// API routes
app.use("/api/shipments", shipmentRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🚚 Shipment Service with Wallet Integration",
    status: "operational",
    endpoints: {
      health: "/health",
      shipments: "/api/shipments",
      walletBalance: "/api/shipments/wallet/balance",
      walletTransactions: "/api/shipments/wallet/transactions",
      walletHealth: "/api/shipments/wallet/health",
    },
    features: {
      walletIntegration: "External Wallet Service integration enabled",
      paymentProcessing: "Automatic payment reservation and confirmation",
      refundProcessing: "Automatic refund processing for cancellations",
    },
  });
});

// Legacy API routes (for backward compatibility)
app.get("/api/tracking/:id", (req, res) => {
  res.json({
    message: "Shipment Service - Tracking endpoint ready for implementation",
    trackingId: req.params.id,
  });
});

app.get("/api/rates", (req, res) => {
  res.json({
    message: "Shipment Service - Rate calculation ready for implementation",
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Shipment Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
