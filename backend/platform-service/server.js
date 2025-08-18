const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8005;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'platform-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes placeholder
app.get('/api/platforms', (req, res) => {
  res.json({ message: 'Platform Service - Available platforms endpoint ready' });
});

app.get('/api/shopify/connect', (req, res) => {
  res.json({ message: 'Platform Service - Shopify connection endpoint ready' });
});

app.get('/api/woocommerce/connect', (req, res) => {
  res.json({ message: 'Platform Service - WooCommerce connection endpoint ready' });
});

app.get('/api/integrations', (req, res) => {
  res.json({ message: 'Platform Service - User integrations endpoint ready' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: 'Something went wrong!'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Platform Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;