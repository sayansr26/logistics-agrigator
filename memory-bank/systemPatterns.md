# System Patterns - Architecture & Technical Decisions

## Architectural Overview

### Microservices Architecture Pattern

Our system follows a **Domain-Driven Design** approach with **bounded contexts** represented as independent microservices.

```
┌─────────────────── Logistics Aggregator Portal ───────────────────┐
│                                                                    │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐   │
│  │ API Gateway │    │           New Services                  │   │
│  │ (Port 8000) │───▶│ ┌─────────┐ ┌─────────┐ ┌─────────────┐ │   │
│  │             │    │ │  Auth   │ │  User   │ │  Shipment   │ │   │
│  │- Routing    │    │ │ (8001)  │ │ (8002)  │ │   (8003)    │ │   │
│  │- Rate Limit │    │ └─────────┘ └─────────┘ └─────────────┘ │   │
│  │- Security   │    │ ┌─────────┐ ┌─────────┐                │   │
│  └─────────────┘    │ │Support  │ │Platform │                │   │
│                     │ │ (8004)  │ │ (8005)  │                │   │
│  ┌─────────────┐    │ └─────────┘ └─────────┘                │   │
│  │  Frontend   │    └─────────────────────────────────────────┘   │
│  │ (Port 3000) │                                                  │
│  │             │    ┌─────────────────────────────────────────┐   │
│  │- Next.js 14 │    │        Existing Services                │   │
│  │- TypeScript │───▶│ ┌─────────┐ ┌─────────┐                │   │
│  │- Tailwind   │    │ │ Wallet  │ │Partner  │                │   │
│  └─────────────┘    │ │ (8006)  │ │ (8007)  │                │   │
│                     │ └─────────┘ └─────────┘                │   │
│                     └─────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

## Core Design Patterns

### 1. Database-Per-Service Pattern with Prisma ORM

**Pattern**: Each microservice owns its data and schema
**Implementation**: Prisma ORM for type-safe, migration-based database operations

```javascript
// Service-specific database configuration
// backend/auth-service/config/database.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

module.exports = { prisma };
```

**Schema Pattern**:

```prisma
// Standard model pattern for all services
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique @db.VarChar(255)
  role         String   @default("client")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Always include audit relationships
  auditLogs    AuditLog[]

  @@map("users")
}
```

### 2. API Gateway Pattern

**Purpose**: Single entry point for all client requests
**Responsibilities**: Routing, authentication, rate limiting, request/response transformation

```javascript
// API Gateway routing pattern
app.use("/api/v1/auth", proxy("http://auth-service:8001"));
app.use("/api/v1/users", authMiddleware, proxy("http://user-service:8002"));
app.use(
  "/api/v1/shipments",
  authMiddleware,
  proxy("http://shipment-service:8003")
);
```

**Benefits**:

- **Centralized Security**: Single authentication and authorization point
- **Rate Limiting**: Prevent abuse and ensure fair usage
- **Request/Response Transformation**: Consistent API contracts
- **Service Discovery**: Route requests to appropriate services

### 3. Event-Driven Architecture (Future)

**Current**: Synchronous REST API communication
**Evolution Path**: Event-driven with message queues for complex workflows

```javascript
// Future event pattern for shipment lifecycle
const events = {
  "shipment.created": [
    "wallet.debit",
    "partner.calculate",
    "notification.send",
  ],
  "shipment.picked": ["tracking.update", "customer.notify"],
  "shipment.delivered": ["wallet.settlement", "analytics.record"],
};
```

## Data Patterns

### 1. Multi-Tenant Data Isolation

**Pattern**: Client data separation at application level
**Implementation**: Client ID filtering in all queries

```javascript
// Standard multi-tenant query pattern
const getUserShipments = async (userId, clientId) => {
  return await prisma.shipment.findMany({
    where: {
      userId,
      clientId, // Always include client isolation
    },
    include: {
      tracking: true,
      addresses: true,
    },
  });
};
```

### 2. Audit Trail Pattern

**Pattern**: Complete action history for compliance and debugging
**Implementation**: Standardized audit logging across all services

```javascript
// Audit log creation pattern
const createAuditLog = async (
  userId,
  action,
  resource,
  resourceId,
  changes,
  req
) => {
  await prisma.auditLog.create({
    data: {
      userId,
      action, // 'CREATE', 'UPDATE', 'DELETE'
      resource, // 'user', 'shipment', 'client'
      resourceId, // UUID of affected resource
      changes, // JSON of what changed
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date(),
    },
  });
};
```

### 3. Soft Delete Pattern

**Pattern**: Logical deletion for data recovery and audit compliance
**Implementation**: Boolean `isDeleted` field with filtered queries

```javascript
// Soft delete implementation
const softDeleteUser = async (id) => {
  const user = await prisma.user.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  // Audit the deletion
  await createAuditLog(user.id, "DELETE", "user", id, { isDeleted: true });
};
```

## Security Patterns

### 1. JWT Authentication Pattern

**Pattern**: Stateless authentication with refresh token rotation
**Implementation**: Access tokens (short-lived) + Refresh tokens (long-lived)

```javascript
// JWT token generation pattern
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // Short-lived access token
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // Long-lived refresh token
  );

  return { accessToken, refreshToken };
};
```

### 2. Role-Based Access Control (RBAC)

**Pattern**: Granular permissions based on user roles
**Implementation**: Middleware-based permission checking

```javascript
// RBAC middleware pattern
const requirePermission = (permission) => {
  return (req, res, next) => {
    const userPermissions = getRolePermissions(req.user.role);

    if (
      !userPermissions.includes(permission) &&
      !userPermissions.includes("all_permissions")
    ) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Usage in routes
router.get(
  "/admin/users",
  requirePermission("admin_user_access"),
  getUsersController
);
```

### 3. Input Validation Pattern

**Pattern**: Centralized validation with detailed error responses
**Implementation**: Joi-based schema validation middleware

```javascript
// Validation schema pattern
const userRegistrationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required(),
  role: Joi.string()
    .valid("admin", "finance", "operations", "client", "support")
    .optional(),
});

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        details: error.details.map((d) => ({
          field: d.path[0],
          message: d.message,
        })),
      });
    }
    req.body = value;
    next();
  };
};
```

## Integration Patterns

### 1. External Service Integration

**Pattern**: Resilient API clients with retry and fallback mechanisms
**Implementation**: Axios-based clients with interceptors

```javascript
// External service client pattern
class WalletServiceClient {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.WALLET_SERVICE_URL,
      timeout: 10000,
      headers: { "Content-Type": "application/json" },
    });

    // Add retry interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status >= 500 && error.config?.retryCount < 3) {
          error.config.retryCount = (error.config.retryCount || 0) + 1;
          return this.client(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  async getBalance(userId) {
    try {
      const response = await this.client.get(`/wallet/balance/${userId}`);
      return response.data;
    } catch (error) {
      logger.error(`Wallet service error: ${error.message}`);
      throw new APIError("Wallet service unavailable", 503);
    }
  }
}
```

### 2. Platform Integration Pattern (Shopify)

**Pattern**: OAuth-based authentication with webhook subscriptions
**Implementation**: Secure token management with real-time updates

```javascript
// Platform integration pattern
class ShopifyIntegration {
  async authenticateStore(shop, code) {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      `https://${shop}.myshopify.com/admin/oauth/access_token`,
      {
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }
    );

    // Store encrypted token
    const encryptedToken = encrypt(tokenResponse.data.access_token);

    await prisma.platformIntegration.create({
      data: {
        clientId: req.user.clientId,
        platform: "shopify",
        shopDomain: shop,
        accessToken: encryptedToken,
        isActive: true,
      },
    });

    // Setup webhooks
    await this.setupWebhooks(shop, tokenResponse.data.access_token);
  }
}
```

## Error Handling Patterns

### 1. Centralized Error Handling

**Pattern**: Consistent error responses across all services
**Implementation**: Custom error classes with middleware

```javascript
// Error handling pattern
class APIError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "APIError";
  }
}

// Global error handler middleware
const errorHandler = (error, req, res, next) => {
  logger.error(`Error in ${req.method} ${req.path}:`, error);

  if (error instanceof APIError) {
    return res.status(error.statusCode).json({
      status: "error",
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Default error response
  res.status(500).json({
    status: "error",
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
};
```

### 2. Prisma Error Handling

**Pattern**: Transform Prisma errors into user-friendly responses
**Implementation**: Error code mapping with detailed messages

```javascript
// Prisma error transformation
const handlePrismaError = (error) => {
  switch (error.code) {
    case "P2002": // Unique constraint violation
      return new APIError(
        "A record with this data already exists",
        409,
        "DUPLICATE_ERROR"
      );

    case "P2025": // Record not found
      return new APIError(
        "The requested resource was not found",
        404,
        "NOT_FOUND"
      );

    case "P2003": // Foreign key constraint violation
      return new APIError(
        "Invalid reference to related record",
        400,
        "INVALID_REFERENCE"
      );

    default:
      return new APIError("Database operation failed", 500, "DATABASE_ERROR");
  }
};
```

## Performance Patterns

### 1. Caching Strategy

**Pattern**: Multi-layer caching with Redis
**Implementation**: Query result caching with smart invalidation

```javascript
// Redis caching pattern
const getCachedOrExecute = async (key, fetchFunction, ttl = 3600) => {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  // Execute and cache
  const result = await fetchFunction();
  await redis.setex(key, ttl, JSON.stringify(result));

  return result;
};

// Usage example
const getUserProfile = async (userId) => {
  return await getCachedOrExecute(
    `user:profile:${userId}`,
    () => prisma.user.findUnique({ where: { id: userId } }),
    1800 // 30 minutes
  );
};
```

### 2. Database Optimization

**Pattern**: Efficient queries with proper indexing
**Implementation**: Strategic use of Prisma's `select` and `include`

```javascript
// Optimized query patterns
const getShipmentsList = async (clientId, page = 1, limit = 20) => {
  return await prisma.shipment.findMany({
    where: { clientId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      customer: {
        select: { name: true, phone: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
};
```

## Testing Patterns

### 1. Service Testing Strategy

**Pattern**: Unit tests for business logic, integration tests for APIs
**Implementation**: Jest with Prisma test database

```javascript
// Test database setup
beforeAll(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE TABLE users CASCADE");
});

// API integration test pattern
describe("User Registration", () => {
  test("should create user with valid data", async () => {
    const userData = {
      email: "test@example.com",
      password: "SecurePass123!",
      role: "client",
    };

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(userData)
      .expect(201);

    expect(response.body.status).toBe("success");
    expect(response.body.data.user.email).toBe(userData.email);
  });
});
```

## Deployment Patterns

### 1. Docker Container Pattern

**Pattern**: Service-specific containers with shared base images
**Implementation**: Multi-stage builds with development/production variants

```dockerfile
# Standard Dockerfile pattern for all services
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

FROM base AS development
RUN npm install -g pnpm@8.15.1 && pnpm install --frozen-lockfile
RUN npx prisma generate
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS production
RUN npm install -g pnpm@8.15.1 && pnpm install --prod --frozen-lockfile
RUN npx prisma generate
COPY . .
USER node
CMD ["node", "server.js"]
```

### 2. Environment Configuration

**Pattern**: Environment-specific configuration with secrets management
**Implementation**: Docker Compose with environment files

```yaml
# Docker Compose pattern
services:
  auth-service:
    build:
      context: ./backend/auth-service
      target: development
    environment:
      - NODE_ENV=development
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    command: sh -c "npx prisma migrate deploy && pnpm run dev"
```

**Current Status**: All patterns implemented and validated in Auth Service. Ready for replication across remaining services (User, Shipment, Platform, Support).
