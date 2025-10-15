# System Patterns: Architecture & Technical Decisions

## Task Management Patterns

### Service Implementation Strategy

**1. Partner Service Pattern (Proven Success)**

Breaking large service implementations into focused, manageable tasks:

```
PARTNER-001: Service Foundation (2 days)
PARTNER-002: External API Integration (2 days)
PARTNER-003: Geographical Data Services (1 day)
PARTNER-004: Zone Management Services (1 day)
PARTNER-005: Package and Charge Management (1.5 days)
PARTNER-006: Discount Management System (1 day)
PARTNER-007: Partner Data Retrieval Services (1 day)
PARTNER-008: Charge Calculation and Assignment (1 day)
PARTNER-009: Advanced Features and Analytics (1.5 days)
```

**Result**: 75+ endpoints delivered across 9 service areas in 16 days

**2. Shipment Service Pattern (Following Partner Success) ✅ COMPLETED**

```
SHIP-001: Shipment Service Foundation (2 days) ✅ COMPLETED
SHIP-002: Partner Service Integration (2 days) ✅ COMPLETED
SHIP-003: Wallet Service Integration (2 days) ✅ COMPLETED
SHIP-004: Tracking and Status Management (2 days) ✅ COMPLETED
SHIP-005: Bulk Operations and Advanced Features (2 days) - FINAL PHASE
```

**Proven Benefits**:

- ✅ Manageable scope per task (2 days max)
- ✅ Clear dependencies and sequential progress
- ✅ Incremental value delivery achieved
- ✅ Easier testing and debugging verified
- ✅ Consistent with proven patterns validated

**Results**: 90% shipment service completion with comprehensive tracking system

**3. Task Structure Template**

```markdown
### SERVICE-XXX: Task Name

**Status**: NOT_STARTED | IN_PROGRESS | COMPLETED
**Planning**: Objective, Scope, Approach, Estimated Time
**Dependencies**: Clear prerequisite tasks
**Implementation Details**: Phase-by-phase breakdown
**Completion Criteria**: Specific, measurable outcomes
**API Endpoints**: Specific endpoints to implement
```

## Development Environment Patterns

### Nodemon Configuration (Mandatory for All Services)

**1. Standard nodemon.json Configuration**

To prevent crash loops from log file watching and ensure stable development:

```json
{
  "watch": [
    "*.js",
    "routes/**/*.js",
    "controllers/**/*.js",
    "middleware/**/*.js",
    "services/**/*.js",
    "config/**/*.js",
    "shared/**/*.js"
  ],
  "ignore": [
    "logs/*",
    "*.log",
    "node_modules/*",
    "prisma/migrations/*",
    ".git/*"
  ],
  "ext": "js,json",
  "delay": "1000"
}
```

**Problem Solved**: After clean Docker rebuilds, services using the shared logger would crash in infinite restart loops because nodemon watched all files including logs being written in real-time.

**Services with nodemon.json**:

- api-gateway
- auth-service
- partner-service
- platform-service
- shipment-service
- support-service
- user-service
- wallet-service
- license-service

**Key Configuration Points**:

- `watch`: Only source code directories (not logs or generated files)
- `ignore`: Logs, lock files, migrations, node_modules
- `delay`: 1-second delay prevents rapid restart cascades
- `ext`: Watch .js and .json files only

**Impact**: Services remain stable after `docker-compose down -v && docker-compose up --build`

## Security Patterns

### Internal Service Validation Pattern (GATE-002)

**1. Zero-Trust Service Architecture**

All microservices implement internal request validation to prevent direct access:

```javascript
// Internal request validation middleware
// Applied after body parsing, before routes
app.use((req, res, next) => {
  // Allow health checks from Docker (monitoring requirement)
  if (req.path === "/health" && req.method === "GET") {
    return next();
  }

  // Protect Swagger docs (require internal header)
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

  // Validate all other endpoints
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
```

**Benefits:**

- Defense-in-depth security (even if ports exposed, access blocked)
- Zero-trust internal architecture
- Audit trail of blocked access attempts
- Maintains health check compatibility for Docker

**Implementation in All Services:**

- auth-service: lines 45-82
- user-service: lines 58-95
- shipment-service: lines 49-86
- partner-service: lines 49-86
- wallet-service: lines 50-87
- license-service: lines 35-72
- support-service: lines 23-60
- platform-service: lines 23-60

**Environment Configuration:**

```env
# Shared secret for internal service communication
INTERNAL_SECRET=<64-character-hex-string>
```

**Security Response Format:**

```json
{
  "status": "error",
  "error": {
    "code": "DIRECT_ACCESS_FORBIDDEN",
    "message": "Service accessible only through API Gateway at port 3001"
  }
}
```

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
} = require("../shared/lib/");

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
  partner_service_db - // Partners, zones, charges, discounts
  wallet_service_db - // Wallets, transactions, payment gateways
  shipment_service_db - // Shipments, tracking, disputes
  platform_service_db; // Integrations, orders, webhooks
support_service_db; // Tickets, knowledge base
```

## Tracking Service Patterns

### Comprehensive Tracking Engine

**1. Status Workflow Management**

```javascript
// Shipment status flow definitions with validation
const SHIPMENT_STATUS_FLOW = {
  CREATED: ["BOOKED", "CANCELLED"],
  BOOKED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "RTO"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "RTO"],
  OUT_FOR_DELIVERY: ["DELIVERED", "NDR", "RTO"],
  DELIVERED: [], // Terminal state
  CANCELLED: [], // Terminal state
  RTO: ["DELIVERED"], // Return to origin can be delivered
  NDR: ["OUT_FOR_DELIVERY", "RTO"], // Non-delivery report can retry or RTO
};

// Validate status transitions
function isValidStatusTransition(currentStatus, newStatus) {
  if (!currentStatus) return true;
  const allowedTransitions = SHIPMENT_STATUS_FLOW[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}
```

**2. Event Source Tracking**

```javascript
const EVENT_SOURCES = {
  SYSTEM: "SYSTEM", // Internal system events
  PARTNER: "PARTNER", // Courier partner updates
  MANUAL: "MANUAL", // Manual admin/ops updates
  API: "API", // API-triggered events
  WEBHOOK: "WEBHOOK", // External webhook events
};
```

**3. Public Tracking Architecture**

```javascript
// Sanitized public tracking data (no sensitive information)
async function trackByAwbNumber(awbNumber) {
  const publicTrackingData = {
    awbNumber: shipment.awbNumber,
    status: shipment.status,
    partnerName: shipment.partnerName,
    estimatedDelivery: shipment.estimatedDelivery,
    actualDelivery: shipment.actualDelivery,
    destination: {
      city: shipment.deliveryCity,
      state: shipment.deliveryState,
      pincode: shipment.deliveryPincode,
    },
    events: shipment.trackingEvents.map((event) => ({
      status: event.status,
      message: event.message,
      location: event.location,
      timestamp: event.timestamp,
    })),
  };
}
```

**4. POD Management System**

```javascript
// Proof of Delivery with signature capture and verification
async function recordDeliveryConfirmation(
  shipmentId,
  deliveryData,
  userId = null,
) {
  const {
    recipientName,
    recipientSignature = null, // URL to signature image
    deliveryImage = null, // URL to delivery photo
    otp = null, // 6-digit OTP verification
    notes = null, // Additional delivery notes
    deliveryPersonName = null, // Delivery person name
    deliveryTime = null, // Actual delivery timestamp
  } = deliveryData;

  // Create delivery confirmation event with POD metadata
  const deliveryEvent = await createTrackingEvent(shipmentId, {
    status: "DELIVERED",
    message: `Package delivered successfully to ${recipientName}`,
    eventMetadata: {
      pod: {
        recipientName,
        recipientSignature,
        deliveryImage,
        otp,
        notes,
        deliveryPersonName,
        deliveryTime: deliveryTime || new Date().toISOString(),
      },
      confirmationType: "POD",
    },
    source: EVENT_SOURCES.PARTNER,
  });
}
```

**5. Tracking Analytics Engine**

```javascript
// Performance analytics with time-based reporting
async function getTrackingAnalytics(timeRange = "7d", clientId = null) {
  const analytics = {
    timeRange,
    generatedAt: new Date().toISOString(),
    statusDistribution: statusDistribution.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    deliveryPerformance: {
      totalDelivered: deliveryStats._count.id,
    },
    eventsBySource: eventsBySource.map((e) => ({
      source: e.source,
      count: e._count.id,
    })),
    ndrStats: {
      totalNDRs: ndrStats.reduce((sum, s) => sum + s._count.id, 0),
    },
  };
}
```

### Tracking Performance Optimization

**1. Multi-Layer Caching Strategy**

```javascript
// Different TTLs based on data volatility
const CACHE_STRATEGIES = {
  tracking: { ttl: 300, key: `tracking:${shipmentId}:${includeDetails}` }, // 5 minutes
  awbTracking: { ttl: 600, key: `awb-tracking:${awbNumber}` }, // 10 minutes
  analytics: { ttl: 3600, key: `analytics:${timeRange}:${clientId}` }, // 1 hour
};
```

**2. Notification Preparation Pattern**

```javascript
// Prepare notification data for multiple channels
function prepareTrackingNotification(trackingEvent, shipmentData, type) {
  switch (type) {
    case NOTIFICATION_TYPES.SMS:
      return {
        smsText: `Order ${orderId}: ${message}${location ? ` at ${location}` : ""}`,
        phoneNumber: deliveryPhone,
      };
    case NOTIFICATION_TYPES.EMAIL:
      return {
        subject: `Shipment Update - Order ${orderId}`,
        emailBody: `Your order has been updated...`,
      };
    case NOTIFICATION_TYPES.PUSH:
      return {
        title: `Order ${orderId} Update`,
        body: message,
        data: { orderId, awbNumber, status },
      };
  }
}
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

// Package charges caching (30 minutes)
await redis.setex(
  `package_charges:${partnerId}`,
  1800,
  JSON.stringify(charges),
);

// Customer charges caching (1 hour)
await redis.setex(
  `customer_charges:${customerId}:${partnerId}`,
  3600,
  JSON.stringify(charges),
);

// Geographical data caching (24 hours)
await redis.setex(`geographical:${type}:${hash}`, 86400, JSON.stringify(data));

// Rate limiting (All Services)
const key = `ratelimit:${ip}:${endpoint}`;
const requests = await redis.incr(key);
```

### Charge Management Patterns

**1. Package Charge Structure**

```javascript
// Package charge configuration with external API integration
class PackageService {
  async getPackageCharges(filters) {
    const cacheKey = `package_service:charges:${this.createFilterHash(filters)}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Call external API with HMAC authentication
    const response = await this.externalClient.makeRequest({
      method: "GET",
      url: "/api/v1/packages/charges",
      params: filters,
    });

    // Cache for 30 minutes
    await redis.setex(cacheKey, 1800, JSON.stringify(response));
    return response;
  }
}
```

**2. Customer Charge Types**

```javascript
// Comprehensive charge type support
const CHARGE_TYPES = {
  FSC: "fsc", // Fuel Surcharge
  COD: "cod", // Cash on Delivery
  INSURANCE: "insurance", // Insurance charges
  HANDLING: "handling", // Handling charges
  PICKUP: "pickup", // Pickup charges
  DELIVERY: "delivery", // Delivery charges
  FRAGILE: "fragile", // Fragile item charges
  OVERSIZED: "oversized", // Oversized item charges
  PRIORITY: "priority", // Priority delivery
  WEEKEND: "weekend", // Weekend delivery
  REMOTE: "remote", // Remote area charges
  OTHER: "other", // Custom charges
};

const CALCULATION_TYPES = {
  PERCENTAGE: "percentage", // Percentage of shipment value
  FLAT: "flat", // Flat rate charge
  PER_KG: "per_kg", // Per kilogram charge
  SLAB: "slab", // Slab-based charges
  TIERED: "tiered", // Tiered pricing
};
```

**3. Bulk Operations Pattern**

```javascript
// Efficient bulk processing with validation
async createBulkPackageCharges(bulkData, partnerId) {
  // Validate bulk data structure
  if (!bulkData.packages || !Array.isArray(bulkData.packages)) {
    throw new ValidationError("Invalid bulk data: packages array is required");
  }

  // Validate each package in the bulk data
  bulkData.packages.forEach((pkg, index) => {
    try {
      this.validatePackageData(pkg);
    } catch (error) {
      throw new ValidationError(`Invalid package data at index ${index}: ${error.message}`);
    }
  });

  // Process bulk operation with external API
  const response = await this.externalClient.makeRequest({
    method: "POST",
    url: "/api/v1/packages/charges/bulk",
    data: bulkData,
    params: { partnerId },
  });

  // Clear related cache entries
  await this.clearPackageCache(partnerId);

  return response;
}
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

## Rule Enforcement Patterns

### Mandatory Task Verification Workflow

**1. Reference Check Pattern**

```bash
# ALWAYS check auth-service patterns first
grep -r "require.*shared" backend/auth-service/
ls -la backend/auth-service/controllers/
cat backend/auth-service/controllers/authController.js | head -20
```

**2. Import Path Verification**

```javascript
// ✅ CORRECT: From controllers/routes/middleware/services directories
const APIResponse = require("../shared/lib/response");
const { authMiddleware } = require("../shared/lib/auth");
const logger = require("../shared/lib/logger");

// ✅ CORRECT: From server.js only
const logger = require("./shared/lib/logger");

// ❌ FORBIDDEN: Never use these paths
const APIResponse = require("../../shared/lib/response");
```

**3. Docker Testing Sequence**

```bash
# MANDATORY: Before marking any task complete
# 1. Restart Docker service
docker-compose restart service-name

# 2. Check logs for errors
docker logs logistics-service-name --tail=30

# 3. Look for MODULE_NOT_FOUND errors
docker logs logistics-service-name | grep "MODULE_NOT_FOUND"

# 4. Test health endpoint
curl http://localhost:PORT/health | jq .

# 5. Test API endpoints
curl -X GET http://localhost:PORT/api/endpoint

# 6. Verify new endpoints are accessible
curl -s http://localhost:PORT/ | jq '.endpoints'

# 7. Test authentication on protected endpoints
curl -X GET http://localhost:PORT/api/v1/protected-endpoint
```

**4. Controller Pattern Enforcement**

```javascript
// ✅ CORRECT: Function-based exports (like auth-service)
async function getEntity(req, res) {
  try {
    // Implementation
    res.json(APIResponse.success(data));
  } catch (error) {
    logger.error("Error:", error);
    throw error;
  }
}

module.exports = {
  getEntity,
  createEntity,
  updateEntity,
};

// ❌ FORBIDDEN: Class-based exports
class EntityController {
  async getEntity(req, res) {}
}
module.exports = new EntityController();
```

### Quality Assurance Patterns

**1. Task Completion Criteria**

```javascript
// Task is ONLY complete when ALL criteria pass:
const completionCriteria = {
  dockerService: "starts without errors",
  healthEndpoint: "returns 200 OK",
  importErrors: "no MODULE_NOT_FOUND in logs",
  apiEndpoints: "respond correctly",
  authPatterns: "follow auth-service exactly",
  documentation: "updated with implementation details",
};
```

**2. Rule Enforcement Files**

```
.cursor/rules/
├── task-verification.mdc    # Mandatory verification workflow
├── rule-enforcement.mdc     # Complete rule enforcement system
├── backend.mdc             # Backend development standards
├── shared-libraries.mdc    # Import patterns and usage
└── development-workflow.mdc # Quality standards
```

---

These patterns ensure consistency, maintainability, and scalability across all services while leveraging modern development practices and tools. The rule enforcement system guarantees quality standards are maintained throughout development.
