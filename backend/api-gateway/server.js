require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://logistics.example.com'] 
    : true,
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'api-gateway'
  });
});

// Service routing configuration
const services = {
  auth: {
    target: 'http://auth-service:8001',
    pathRewrite: { '^/api/v1/auth': '' }
  },
  users: {
    target: 'http://user-service:8002',
    pathRewrite: { '^/api/v1/users': '' }
  },
  shipments: {
    target: 'http://shipment-service:8003',
    pathRewrite: { '^/api/v1/shipments': '' }
  },
  support: {
    target: 'http://support-service:8004',
    pathRewrite: { '^/api/v1/support': '' }
  },
  platforms: {
    target: 'http://platform-service:8005',
    pathRewrite: { '^/api/v1/platforms': '' }
  }
};

// Create proxy middleware for each service
Object.keys(services).forEach(service => {
  const config = services[service];
  app.use(`/api/v1/${service}`, createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite,
    onError: (err, req, res) => {
      console.error(`Proxy error for ${service}:`, err);
      res.status(503).json({
        status: 'error',
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `${service} service is currently unavailable`
        }
      });
    }
  }));
});

// Catch all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});