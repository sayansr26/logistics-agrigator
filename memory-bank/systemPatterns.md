# System Patterns: Architecture & Technical Decisions

## Microservices Architecture Patterns

### Service Design Principles

**1. Auth-Service Pattern (Established Standard)**

```javascript
// Consistent structure across all services
/service-name/
├── config/           // Database, Redis, Swagger configs
├── controllers/      // Route handlers with proper error handling
├── middleware/       // Auth, validation, rate limiting
├── routes/          // API route definitions
├── prisma/          // Database schema and migrations
├── server.js        // Express app setup
└── package.json     // Dependencies and scripts
```

**2. Shared Library Integration**

```javascript
// All services use shared utilities from /shared/lib/
const {
  database,
  redis,
  auth,
  errors,
  logger,
  response,
} = require("../../shared");

// Consistent error handling
const { APIError, ValidationError, AuthenticationError } = errors;

// Standardized response format
return response.success(data, message, statusCode);
return response.error(message, statusCode, details);
```

**3. Database-per-Service Pattern**

```javascript
// Each service has its own PostgreSQL database
-auth_service_db - // Users, sessions, audit logs
  user_service_db - // Clients, settings, invitations
  shipment_service_db - // Shipments, tracking, disputes
  platform_service_db - // Integrations, orders, webhooks
  support_service_db; // Tickets, knowledge base
```

## Data Management Patterns

### Prisma ORM Integration

**1. Type-Safe Database Operations**

```prisma
// Schema definition with relationships
model User {
  id       String  @id @default(uuid()) @db.Uuid
  email    String  @unique @db.VarChar(255)
  role     Role    @default(client)
  clientId String? @db.Uuid

  client    Client?    @relation(fields: [clientId], references: [id])
  sessions  Session[]
  auditLogs AuditLog[]

  @@map("users")
}
```

**2. Migration-First Development**

```bash
# Schema changes always through migrations
npx prisma migrate dev --name "add_user_roles"
npx prisma generate  # Update TypeScript types
```

**3. Query Optimization Patterns**

```javascript
// Use select and include strategically
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, role: true },
  include: {
    client: { select: { name: true, branding: true } },
    sessions: { take: 5, orderBy: { createdAt: "desc" } },
  },
});
```

### Caching Strategy

**1. Redis Usage Patterns**

```javascript
// Session management (Auth Service)
await redis.setex(`session:${userId}`, 86400, JSON.stringify(sessionData));

// API response caching (Partner Service)
await redis.setex(`charges:${hash}`, 300, JSON.stringify(chargesResponse));

// Rate limiting (All Services)
const key = `ratelimit:${ip}:${endpoint}`;
const requests = await redis.incr(key);
```

## Authentication & Authorization Patterns

### JWT + Redis Session Pattern

**1. Token Structure**

```javascript
// Access Token (15 minutes)
const accessToken = jwt.sign(
  {
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    permissions: user.permissions,
  },
  JWT_SECRET,
  { expiresIn: "15m" },
);

// Refresh Token (7 days)
const refreshToken = jwt.sign(
  {
    userId: user.id,
    tokenId: uuid(),
  },
  JWT_REFRESH_SECRET,
  { expiresIn: "7d" },
);
```

**2. Middleware Integration**

```javascript
// Consistent auth middleware across all services
router.use("/api/v1/protected", auth.verifyToken);
router.use("/api/v1/admin", auth.authorize(["admin", "operations"]));

// Permission-based authorization
router.post("/shipments", auth.authorize(["shipment.create"]), createShipment);
```

### Role-Based Access Control (RBAC)

**Roles & Permissions Matrix:**

```javascript
const ROLE_PERMISSIONS = {
  admin: ["*"], // All permissions
  finance: ["wallet.*", "billing.*", "reports.financial"],
  operations: ["shipment.*", "partner.*", "tracking.*"],
  client: ["shipment.create", "shipment.view", "wallet.view"],
  support: ["ticket.*", "dispute.*", "knowledge.*"],
};
```

## API Design Patterns

### Standardized Response Format

**1. Success Response**

```javascript
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2024-01-10T15:30:00Z",
    "requestId": "uuid",
    "pagination": { /* if applicable */ }
  }
}
```

**2. Error Response**

```javascript
{
  "status": "error",
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-10T15:30:00Z",
    "requestId": "uuid"
  }
}
```

### Validation Patterns

**1. Joi Schema Validation**

```javascript
const shipmentSchema = Joi.object({
  orderId: Joi.string().required().max(100),
  customerDetails: Joi.object({
    name: Joi.string().required().max(255),
    phone: Joi.string().pattern(/^\+91-[0-9]{10}$/),
    email: Joi.string().email().optional(),
  }),
  pickupAddress: addressSchema.required(),
  deliveryAddress: addressSchema.required(),
});
```

**2. Database Constraints**

```prisma
model Shipment {
  id          String      @id @default(uuid())
  orderId     String      @db.VarChar(100)
  status      Status      @default(CREATED)
  paymentType PaymentType // COD, PREPAID
  codAmount   Decimal?    @db.Decimal(10, 2)

  // Constraints
  @@unique([orderId, clientId])
  @@index([status, createdAt])
}
```

## Integration Patterns

### External Service Integration

**1. HTTP Client Pattern**

```javascript
class ExternalServiceClient {
  constructor(baseURL, apiKey, options = {}) {
    this.client = axios.create({
      baseURL,
      timeout: options.timeout || 30000,
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Request/Response interceptors
    this.setupInterceptors();

    // Circuit breaker pattern
    this.circuitBreaker = new CircuitBreaker(this.makeRequest);
  }

  async makeRequest(config) {
    try {
      const response = await this.client(config);
      return response.data;
    } catch (error) {
      logger.error("External API error", { error, config });
      throw new APIError("External service unavailable");
    }
  }
}
```

**2. Caching with Fallback**

```javascript
async getCharges(shipmentData) {
  const cacheKey = `charges:${this.createHash(shipmentData)}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Call external API
  const charges = await this.externalClient.calculateCharges(shipmentData);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(charges));

  return charges;
}
```

### Inter-Service Communication

**1. Service Discovery Pattern**

```javascript
// Environment-based service URLs
const SERVICE_URLS = {
  auth: process.env.AUTH_SERVICE_URL || "http://auth-service:8001",
  user: process.env.USER_SERVICE_URL || "http://user-service:8002",
  wallet: process.env.WALLET_SERVICE_URL || "http://wallet-service:8006",
  partner: process.env.PARTNER_SERVICE_URL || "http://partner-service:8007",
};
```

**2. Health Check Integration**

```javascript
// Standard health check endpoint
app.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    service: process.env.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      externalServices: await checkExternalServices(),
    },
  };

  const status = Object.values(health.checks).every((check) => check === "ok")
    ? 200
    : 503;
  res.status(status).json(health);
});
```

## Error Handling Patterns

### Centralized Error Management

**1. Custom Error Classes**

```javascript
class APIError extends Error {
  constructor(message, statusCode = 500, code = "API_ERROR", details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

class ValidationError extends APIError {
  constructor(message, details) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}
```

**2. Global Error Handler**

```javascript
app.use((error, req, res, next) => {
  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
  });

  if (error.isOperational) {
    return res
      .status(error.statusCode)
      .json(response.error(error.message, error.statusCode, error.details));
  }

  // Unknown error - don't leak details
  return res.status(500).json(response.error("Internal server error", 500));
});
```

## Performance Patterns

### Database Optimization

**1. Connection Pooling**

```javascript
// Prisma connection pooling
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Connection pool settings
  connection_limit = 20
  pool_timeout     = 20
  statement_timeout = "30s"
}
```

**2. Query Optimization**

```javascript
// Use indexes strategically
@@index([clientId, status, createdAt]) // Composite index
@@index([awbNumber])                   // Unique lookups
@@index([status])                      // Filtering
@@index([createdAt])                   // Sorting
```

### Caching Strategy

**1. Multi-Layer Caching**

```javascript
// 1. Application-level caching (Redis)
const userPermissions = await cache.get(`permissions:${userId}`);

// 2. Database query result caching
const recentShipments = await cache.get(`shipments:recent:${clientId}`);

// 3. API response caching
const courierCharges = await cache.get(`charges:${hashKey}`);
```

---

These patterns ensure consistency, maintainability, and scalability across all services while leveraging modern development practices and tools.
