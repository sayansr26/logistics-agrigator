# API Gateway AGENTS.md

## Service Overview

The API Gateway serves as the single entry point for all client requests, handling request routing, authentication, rate limiting, load balancing, and API monitoring for the entire logistics platform.

**Status**: ✅ **Operational** - Basic routing and authentication  
**Enhancement**: 📋 **Planned** - Production-ready features and monitoring

## Development Commands

```bash
# Start API Gateway only
docker-compose up api-gateway

# Development with live reload
cd backend/api-gateway
pnpm install
pnpm run dev

# Testing
pnpm test
```

## Service Architecture

### Port Configuration

- **Development**: `http://localhost:3001`
- **Health Check**: `http://localhost:3001/health`
- **API Documentation**: `http://localhost:3001/api-docs`

### Key Features

- ✅ Request routing to microservices
- ✅ JWT authentication middleware
- ✅ Basic rate limiting
- 📋 Advanced rate limiting per service
- 📋 Load balancing with failover
- 📋 API monitoring and analytics
- 📋 Request/response transformation
- 📋 CORS and security headers

## Current Routing Configuration

### Service Routes

```javascript
// Current routing (basic implementation)
const routes = {
  "/api/v1/auth": "http://auth-service:3002",
  "/api/v1/users": "http://user-service:3003",
  "/api/v1/shipments": "http://shipment-service:3004",
  "/api/v1/partners": "http://partner-service:3005",
  "/api/v1/support": "http://support-service:3006",
  "/api/v1/platforms": "http://platform-service:3007",
};
```

### Enhanced Routing (Planned)

```javascript
// Enhanced routing configuration
const serviceConfig = {
  "auth-service": {
    url: "http://auth-service:3002",
    healthCheck: "/health",
    timeout: 5000,
    retries: 3,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
    },
  },
  "user-service": {
    url: "http://user-service:3003",
    healthCheck: "/health",
    timeout: 5000,
    retries: 3,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 200,
    },
  },
  "partner-service": {
    url: "http://partner-service:3005",
    healthCheck: "/health",
    timeout: 10000, // Higher timeout for rate calculations
    retries: 2,
    rateLimit: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // For rate calculations
    },
  },
  // ... other services
};
```

## Code Patterns (Following Auth Service)

### Enhanced Gateway Implementation

```javascript
// server.js - Enhanced API Gateway
const express = require("express");
const httpProxy = require("http-proxy-middleware");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("./shared/lib/logger");

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Global limit per IP
  message: {
    error: "Too many requests from this IP",
    retryAfter: 15 * 60,
  },
});

app.use(globalLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Service-specific routing with middleware
const createServiceProxy = (serviceName, config) => {
  return httpProxy({
    target: config.url,
    changeOrigin: true,
    timeout: config.timeout,
    retries: config.retries,
    pathRewrite: (path, req) => {
      // Remove /api/v1 prefix for backend services
      return path.replace("/api/v1", "");
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add service context headers
      proxyReq.setHeader("X-Gateway-Service", serviceName);
      proxyReq.setHeader("X-Request-ID", req.id);
      proxyReq.setHeader("X-Forwarded-For", req.ip);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add response headers
      proxyRes.headers["X-Gateway-Service"] = serviceName;
      proxyRes.headers["X-Response-Time"] = Date.now() - req.startTime;
    },
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}:`, err);
      res.status(503).json({
        error: "Service temporarily unavailable",
        service: serviceName,
        timestamp: new Date().toISOString(),
      });
    },
  });
};
```

### Authentication Middleware

```javascript
// middleware/auth.js
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("../shared/lib/auth");

const gatewayAuth = async (req, res, next) => {
  try {
    // Skip auth for public endpoints
    const publicPaths = [
      "/health",
      "/api-docs",
      "/api/v1/auth/login",
      "/api/v1/auth/register",
    ];
    if (publicPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Extract and verify JWT token
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
        code: "MISSING_TOKEN",
      });
    }

    // Verify token using shared auth middleware
    const decoded = await authMiddleware.verifyToken(token);
    req.user = decoded;

    // Add user context to forwarded requests
    req.headers["x-user-id"] = decoded.userId;
    req.headers["x-user-role"] = decoded.role;
    req.headers["x-user-email"] = decoded.email;

    next();
  } catch (error) {
    logger.error("Gateway authentication error:", error);
    res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }
};
```

### Service Health Monitoring

```javascript
// services/healthMonitor.js
class HealthMonitor {
  constructor(services) {
    this.services = services;
    this.healthStatus = {};
    this.startMonitoring();
  }

  async checkServiceHealth(serviceName, config) {
    try {
      const response = await fetch(`${config.url}${config.healthCheck}`, {
        timeout: 3000,
      });

      const isHealthy = response.ok;
      this.healthStatus[serviceName] = {
        status: isHealthy ? "healthy" : "unhealthy",
        lastCheck: new Date(),
        responseTime: response.responseTime,
      };

      return isHealthy;
    } catch (error) {
      this.healthStatus[serviceName] = {
        status: "unhealthy",
        lastCheck: new Date(),
        error: error.message,
      };
      return false;
    }
  }

  startMonitoring() {
    // Check all services every 30 seconds
    setInterval(async () => {
      for (const [serviceName, config] of Object.entries(this.services)) {
        await this.checkServiceHealth(serviceName, config);
      }
    }, 30000);
  }

  getHealthStatus() {
    return this.healthStatus;
  }
}
```

### Load Balancing (Planned)

```javascript
// services/loadBalancer.js
class LoadBalancer {
  constructor(services) {
    this.services = services;
    this.serviceInstances = {};
    this.currentIndex = {};
  }

  addServiceInstance(serviceName, instance) {
    if (!this.serviceInstances[serviceName]) {
      this.serviceInstances[serviceName] = [];
      this.currentIndex[serviceName] = 0;
    }
    this.serviceInstances[serviceName].push(instance);
  }

  getNextInstance(serviceName) {
    const instances = this.serviceInstances[serviceName];
    if (!instances || instances.length === 0) {
      return null;
    }

    // Round-robin load balancing
    const instance = instances[this.currentIndex[serviceName]];
    this.currentIndex[serviceName] =
      (this.currentIndex[serviceName] + 1) % instances.length;

    return instance;
  }

  removeUnhealthyInstance(serviceName, instance) {
    const instances = this.serviceInstances[serviceName];
    if (instances) {
      const index = instances.indexOf(instance);
      if (index > -1) {
        instances.splice(index, 1);
        logger.warn(`Removed unhealthy instance: ${serviceName} - ${instance}`);
      }
    }
  }
}
```

## API Monitoring and Analytics

### Request Analytics

```javascript
// middleware/analytics.js
const analytics = {
  requests: new Map(),
  errors: new Map(),
  responseTimes: new Map(),
};

const analyticsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  req.startTime = startTime;

  // Track request
  const service = getServiceFromPath(req.path);
  analytics.requests.set(service, (analytics.requests.get(service) || 0) + 1);

  // Track response
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;

    // Track response time
    if (!analytics.responseTimes.has(service)) {
      analytics.responseTimes.set(service, []);
    }
    analytics.responseTimes.get(service).push(responseTime);

    // Track errors
    if (res.statusCode >= 400) {
      analytics.errors.set(service, (analytics.errors.get(service) || 0) + 1);
    }
  });

  next();
};

// Analytics endpoint
app.get("/api/analytics", (req, res) => {
  const stats = {};

  for (const [service, count] of analytics.requests) {
    const responseTimes = analytics.responseTimes.get(service) || [];
    const errors = analytics.errors.get(service) || 0;

    stats[service] = {
      requests: count,
      errors,
      errorRate: count > 0 ? ((errors / count) * 100).toFixed(2) + "%" : "0%",
      avgResponseTime:
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((a, b) => a + b) / responseTimes.length,
            )
          : 0,
    };
  }

  res.json({ stats, timestamp: new Date().toISOString() });
});
```

## Rate Limiting Configuration

### Service-Specific Rate Limits

```javascript
// middleware/rateLimiter.js
const createServiceLimiter = (serviceName, config) => {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    keyGenerator: (req) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      return req.user?.id || req.ip;
    },
    message: {
      error: `Rate limit exceeded for ${serviceName}`,
      service: serviceName,
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Apply service-specific rate limiting
app.use(
  "/api/v1/partners/calculate",
  createServiceLimiter("partner-service", {
    rateLimit: { windowMs: 60 * 1000, max: 60 }, // 60 requests per minute for rate calculations
  }),
);

app.use(
  "/api/v1/auth",
  createServiceLimiter("auth-service", {
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  }),
);
```

## Current Implementation Status

### ✅ Operational Features

- Basic request routing to all services
- JWT authentication middleware
- Global rate limiting
- CORS configuration
- Basic error handling
- Health check endpoint

### 📋 Planned Enhancements (API-001)

- Service-specific rate limiting
- Load balancing with failover
- Advanced health monitoring
- Request/response analytics
- API monitoring dashboard
- Request transformation and validation
- Circuit breaker pattern
- Response caching

## Environment Configuration

```bash
# API Gateway Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Service URLs
AUTH_SERVICE_URL=http://auth-service:3002
USER_SERVICE_URL=http://user-service:3003
SHIPMENT_SERVICE_URL=http://shipment-service:3004
PARTNER_SERVICE_URL=http://partner-service:3005
SUPPORT_SERVICE_URL=http://support-service:3006
PLATFORM_SERVICE_URL=http://platform-service:3007

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Rate Limiting
REDIS_URL=redis://redis:6379

# Monitoring
ENABLE_ANALYTICS=true
ANALYTICS_RETENTION_DAYS=30
```

## Testing

### Health Check

```bash
curl http://localhost:3001/health
```

### Service Routing

```bash
# Test auth service routing
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  http://localhost:3001/api/v1/auth/login

# Test authenticated request
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/v1/users/profile

# Test partner service routing
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/v1/partners
```

### Analytics

```bash
# Get API analytics
curl http://localhost:3001/api/analytics

# Get service health status
curl http://localhost:3001/api/health/services
```

## Performance Metrics

### Current Performance

- **Request Routing**: <50ms overhead
- **Authentication**: <100ms JWT verification
- **Throughput**: 1000+ requests/second
- **Availability**: 99.9% uptime target

### Target Performance (After Enhancement)

- **Load Balancing**: <10ms routing decision
- **Health Checks**: 30-second intervals
- **Analytics**: Real-time metrics collection
- **Circuit Breaker**: <5ms failure detection

## Security Features

### Current Security

- **JWT Authentication**: Token verification for protected routes
- **CORS Protection**: Configurable origin restrictions
- **Rate Limiting**: Global IP-based rate limiting
- **Security Headers**: Helmet.js security headers

### Enhanced Security (Planned)

- **Request Validation**: Schema validation for all requests
- **API Key Management**: Service-to-service authentication
- **Request Sanitization**: Input sanitization and XSS protection
- **Audit Logging**: Complete request/response logging
- **DDoS Protection**: Advanced rate limiting and IP blocking

## Troubleshooting

### Common Issues

1. **Service unavailable**: Check service health and Docker containers
2. **Authentication failures**: Verify JWT secret and token validity
3. **Rate limit exceeded**: Check rate limiting configuration
4. **CORS errors**: Verify CORS origin configuration

### Debug Commands

```bash
# Check API Gateway logs
docker-compose logs -f api-gateway

# Check service connectivity
curl http://localhost:3002/health  # Auth Service
curl http://localhost:3003/health  # User Service
curl http://localhost:3005/health  # Partner Service

# Test rate limiting
for i in {1..10}; do curl http://localhost:3001/api/v1/auth/me; done
```

### Monitoring Commands

```bash
# Check service health status
curl http://localhost:3001/api/health/services

# Get request analytics
curl http://localhost:3001/api/analytics

# Monitor response times
curl -w "@curl-format.txt" http://localhost:3001/api/v1/users/profile
```

## Integration Points

### Service Dependencies

- **All Backend Services**: Routes requests to appropriate services
- **Redis**: Rate limiting and caching (when implemented)
- **Frontend**: Single API endpoint for all requests

### Used By

- **Frontend Application**: All API requests go through gateway
- **External Clients**: Mobile apps, third-party integrations
- **Monitoring Systems**: Health checks and analytics

---

**Note**: The API Gateway serves as the central entry point for all requests and will be enhanced with production-ready features including advanced rate limiting, load balancing, and comprehensive monitoring in the API-001 task.
