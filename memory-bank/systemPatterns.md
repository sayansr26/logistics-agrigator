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

**3. Zone System v2 + Charge Packages Pattern (December 2025) ✅ COMPLETED**

Two related initiatives completed with 17 total tasks:

```
# Zone System v2 Migration (6 tasks)
PARTNER-012: Database Schema Migration (0.5 day) ✅
PARTNER-013: Pincode Type Service (1 day) ✅
PARTNER-014: Distance Zone Service (1.5 days) ✅
PARTNER-015: Zone Controller & Routes (1 day) ✅
PARTNER-016: ServiceType Cleanup (0.5 day) ✅
PARTNER-017: Integration Testing (0.5 day) ✅

# Charge Packages + Quote Engine (11 tasks)
schema-charge-packages: Prisma models ✅
charge-packages-crud: CRUD API ✅
gateway-charge-packages-route: API Gateway proxy ✅
quote-engine: Quote calculation service ✅
partner-calc-endpoints: Update calculate/serviceability ✅
routes-no-inline: Controller pattern refactor ✅
shipment-integration-header: Internal auth headers ✅
frontend-charge-packages-rtk: RTK Query slice ✅
frontend-fix-partnersApi-shapes: Type updates ✅
frontend-sidebar-unblock-charges: Sidebar navigation ✅
deprecate-legacy: 410 Gone responses ✅
```

**Key Patterns Established**:

- Modal-based CRUD UI (create/view/edit in modals, not separate pages)
- Multi-partner selection for bulk resource creation
- Quote calculation engine with breakdown structure
- Zone-based serviceability with milestone matching
- Legacy endpoint deprecation with 410 Gone responses

**4. Task Structure Template**

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

### Docker Dependency Synchronization (Permanent Fix) ⭐ NEW

**Critical Issue Resolved**: MODULE_NOT_FOUND errors after package.json changes or Docker cleanup

**Solution**: Automatic dependency synchronization via enhanced entrypoint script

```dockerfile
# Enhanced entrypoint pattern (all services)
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["pnpm", "run", "dev"]
```

**Features**:

- ✅ Auto-detects package.json changes
- ✅ Installs missing dependencies on startup
- ✅ Handles Prisma client generation
- ✅ Works after volume cleanup
- ✅ Zero manual intervention needed

**Documentation**: See [dockerDependencyFix.md](./dockerDependencyFix.md) for complete details

**Usage**:

```bash
# Just restart the container - dependencies auto-sync!
docker-compose restart [service-name]

# Even after clean:
docker-compose down -v && docker-compose up -d
# ↑ No manual pnpm install needed!
```

**Implementation Status**: ✅ All 9 services (api-gateway, auth, user, shipment, partner, wallet, license, support, platform)

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

### Gateway JWT Validation Pattern (GATE-003)

**1. Centralized Authentication at Gateway**

All API requests are validated at the API Gateway before proxying to backend services:

```javascript
// authValidator.js - JWT validation middleware
const jwt = require("jsonwebtoken");
const logger = require("../shared/lib/logger");

const publicPaths = [
  "/health",
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/swagger",
  "/openapi.json",
];

exports.validateJWT = async (req, res, next) => {
  // Skip auth for public endpoints
  if (publicPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      error: {
        code: "INVALID_TOKEN_FORMAT",
        message: "Authorization header must be in format: Bearer <token>",
      },
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Add user context to headers for backend services
    req.headers["x-user-id"] = decoded.userId;
    req.headers["x-user-role"] = decoded.role;
    req.headers["x-user-email"] = decoded.email;

    next();
  } catch (error) {
    logger.error("JWT validation failed:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        error: {
          code: "TOKEN_EXPIRED",
          message: "Authentication token has expired",
        },
      });
    }

    return res.status(401).json({
      status: "error",
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
      },
    });
  }
};
```

**2. Body Parsing Configuration**

Critical fix to prevent request abortion when proxying:

```javascript
// IMPORTANT: Skip body parsing for proxy routes
// Express body parsing consumes request body, preventing proxy from forwarding it
app.use((req, res, next) => {
  // Skip body parsing for API routes that will be proxied
  if (req.path.startsWith("/api/v1/")) {
    return next();
  }
  // Apply body parsing only for non-proxied routes
  express.json({ limit: "10mb" })(req, res, next);
});
```

**3. User Context Forwarding**

Backend services receive validated user information without re-validating JWT:

```javascript
// In gateway's onProxyReq handler
onProxyReq: (proxyReq, req, res) => {
  // Add internal request header for service validation
  proxyReq.setHeader("X-Internal-Request", process.env.INTERNAL_SECRET);

  // Forward user context from JWT (if authenticated)
  if (req.user) {
    proxyReq.setHeader("x-user-id", req.user.userId);
    proxyReq.setHeader("x-user-role", req.user.role);
    proxyReq.setHeader("x-user-email", req.user.email);
  }
};
```

**4. Public Path Handling**

Flexible path matching for public endpoints:

```javascript
// Supports both exact matches and prefix matches
const isPublicPath = publicPaths.some((path) => req.path.startsWith(path));
// Handles: /health, /api/v1/auth/login, /api/v1/auth/register/:token, etc.
```

**Benefits:**

- Single point of authentication (no JWT validation needed in backend services)
- Consistent error responses across all APIs
- User context available in request headers
- Public endpoints accessible without authentication
- Comprehensive error handling for all JWT error types

**Implementation in Gateway:**

- Location: `backend/api-gateway/middleware/authValidator.js`
- Applied: In `server.js` before proxy middleware
- Config: Public paths list easily extensible

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

## Customer Type & Public Signup Patterns (NEW - December 2025)

### Customer Type Model Pattern

**1. CustomerType Enum with Conditional Fields**

```prisma
enum CustomerType {
  DIRECT // B2C - Self-registered customers
  OUTLET // B2B - Admin-managed business customers
}

model Customer {
  id           String       @id @default(uuid()) @db.Uuid
  clientId     String?      @map("client_id") @db.Uuid // Optional for DIRECT
  customerType CustomerType @default(DIRECT)

  // Base fields (both types)
  name  String  @db.VarChar(200)
  email String  @db.VarChar(255)
  phone String? @db.VarChar(20)

  // Outlet-specific fields (OUTLET type only)
  outletCode         String? @unique @db.VarChar(50)
  outletAddress      Json?
  contactPersonName  String? @db.VarChar(200)
  contactPersonEmail String? @db.VarChar(255)
  contactPersonPhone String? @db.VarChar(20)

  // Unique constraints
  @@unique([clientId, email]) // For OUTLET customers under a client
  @@unique([email]) // For DIRECT customers (clientId IS NULL)
  @@index([customerType])
  @@index([outletCode])
}
```

**2. Conditional Validation Pattern**

```javascript
// Joi schema with conditional validation based on customerType
const customerCreateSchema = Joi.object({
  customerType: Joi.string().valid("DIRECT", "OUTLET").default("DIRECT"),
  name: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().optional(),

  // Outlet fields - required only when customerType is OUTLET
  outletCode: Joi.string().max(50).when("customerType", {
    is: "OUTLET",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  outletAddress: Joi.object().when("customerType", {
    is: "OUTLET",
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  // ... more conditional fields
});
```

### Inter-Service Communication Pattern (Auth → User Service)

**1. Internal Bootstrap Endpoint**

```javascript
// user-service/routes/internal.js
const internalAuth = require("../middleware/internal");

// Protected internal endpoint
router.post(
  "/bootstrap-customer",
  internalAuth, // Validates X-Internal-Request header
  bootstrapController.bootstrapDirectCustomer,
);

// Internal auth middleware
const internalAuth = (req, res, next) => {
  const internalHeader = req.headers["x-internal-request"];
  if (
    !internalHeader ||
    internalHeader !== process.env.INTERNAL_SERVICE_SECRET
  ) {
    return res.status(403).json({
      status: "error",
      error: { code: "INTERNAL_ACCESS_DENIED", message: "Internal endpoint" },
    });
  }
  next();
};
```

**2. Bootstrap Orchestration Pattern**

```javascript
// user-service/controllers/bootstrapController.js
async function bootstrapDirectCustomer(req, res) {
  const { userId, email, firstName, lastName, phone } = req.body;

  // Atomic transaction: Create Customer + UserProfile + CustomerUser
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Customer with auth user's ID
    const customer = await tx.customer.create({
      data: {
        id: userId, // Same ID as auth user
        name: `${firstName} ${lastName}`,
        email,
        phone,
        customerType: "DIRECT",
        isActive: true,
      },
    });

    // 2. Create UserProfile
    const profile = await tx.userProfile.create({
      data: {
        userId,
        customerId: customer.id,
        firstName,
        lastName,
        email,
        phone,
      },
    });

    // 3. Link CustomerUser
    const customerUser = await tx.customerUser.create({
      data: {
        customerId: customer.id,
        userId,
        isPrimary: true,
        isActive: true,
      },
    });

    return { customer, profile, customerUser };
  });

  res.status(201).json(APIResponse.success(result));
}
```

**3. Auth Service Registration with Bootstrap Call**

```javascript
// auth-service/controllers/authController.js
static async register(req, res) {
  const { email, password, firstName, lastName, phone } = req.body;

  // 1. Create auth user with role=customer
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role: 'customer',  // Enforced, not from request
    }
  });

  // 2. Call user-service bootstrap (direct service-to-service)
  try {
    const bootstrapResponse = await axios.post(
      `${process.env.USER_SERVICE_URL}/api/v1/internal/bootstrap-customer`,
      { userId: user.id, email, firstName, lastName, phone },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': process.env.INTERNAL_SERVICE_SECRET
        }
      }
    );
  } catch (bootstrapError) {
    // Rollback: Delete auth user if bootstrap fails
    await prisma.user.delete({ where: { id: user.id } });
    throw new Error('Registration failed - unable to create customer profile');
  }

  // 3. Generate tokens and return like login
  const { accessToken, refreshToken } = generateTokens(user);

  res.status(201).json(APIResponse.success({
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    expiresIn: 3600
  }));
}
```

### Environment Configuration Pattern

**1. Docker Compose Internal Secrets**

```yaml
# All services need BOTH for compatibility
services:
  api-gateway:
    environment:
      - INTERNAL_SERVICE_SECRET=internal-service-secret
      - INTERNAL_SECRET=internal-service-secret # Alias for older code

  auth-service:
    environment:
      - INTERNAL_SERVICE_SECRET=internal-service-secret
      - INTERNAL_SECRET=internal-service-secret
      - USER_SERVICE_URL=http://user-service:3003 # Direct internal URL

  user-service:
    environment:
      - INTERNAL_SERVICE_SECRET=internal-service-secret
      - INTERNAL_SECRET=internal-service-secret

  # ... repeat for all 9 services
```

**2. Service-to-Service vs Gateway Communication**

```javascript
// ✅ CORRECT: Direct service-to-service within Docker network
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";

// ❌ WRONG: Going through gateway for internal calls
const USER_SERVICE_URL = "http://api-gateway:3001/api/v1/user-service";
```

## Charge Package & Quote Calculation Patterns (NEW - December 2025)

### Charge Package Model Pattern

**1. Package Types with Milestone Calculation**

```prisma
enum ChargePackageType {
  WEIGHT // Base + addon per extra kg
  DISTANCE // Base + addon per extra km
  GENERIC // Flat charges (COD, Prepaid, etc.)
}

model ChargePackage {
  id          String                 @id @default(cuid())
  partnerId   String
  name        String // Unique per partner
  type        ChargePackageType
  baseCharge  Decimal                @db.Decimal(10, 2)
  baseUnit    Decimal? // e.g., first 5 kg, first 10 km
  addonUnit   Decimal? // e.g., per 1 kg, per 1 km
  addonCharge Decimal? // charge per addon unit
  appliesTo   ChargePackageAppliesTo @default(ANY) // ANY/COD/PREPAID
  calcType    ChargePackageCalcType  @default(FLAT)
  isActive    Boolean                @default(true)

  @@unique([partnerId, name])
  @@index([partnerId, type, isActive])
}
```

**2. Charge Calculation Formula**

```javascript
// Weight/Distance package calculation
const calculatePackageCharge = (pkg, value) => {
  if (!pkg.baseUnit || !pkg.addonUnit || !pkg.addonCharge) {
    return pkg.baseCharge; // Flat charge only
  }

  if (value <= pkg.baseUnit) {
    return pkg.baseCharge; // Within base unit
  }

  // Calculate addon
  const extraUnits = Math.ceil((value - pkg.baseUnit) / pkg.addonUnit);
  return pkg.baseCharge + extraUnits * pkg.addonCharge;
};
```

### Quote Calculation Engine Pattern

**1. Zone-Based Serviceability**

```javascript
// Check if partner services the route via distance zones
const checkServiceability = async (fromPincode, toPincode) => {
  const partners = await getActivePartners();
  const results = [];

  for (const partner of partners) {
    const zoneMatch = await distanceZoneService.getZoneForShipment(
      partner.id,
      fromPincode,
      toPincode,
    );
    results.push({
      partnerId: partner.id,
      isServiceable: zoneMatch.matched,
      zoneName: zoneMatch.zoneName,
      zoneSuffix: zoneMatch.suffix,
      distanceKm: zoneMatch.distanceKm,
    });
  }
  return results;
};
```

**2. Quote Breakdown Structure**

```javascript
// Standard quote response with breakdown
const calculateQuote = async (params) => {
  return {
    partnerId: partner.id,
    partnerName: partner.displayName,
    totalRate:
      distanceCharge + weightCharge + genericCharges + pincodeTypeCharges,
    deliveryDays: partner.defaultDeliveryDays,
    distanceKm: zoneMatch.distanceKm,
    zoneName: zoneMatch.zoneName,
    zoneSuffix: zoneMatch.suffix,
    breakdown: {
      distance: { name: "Distance Charge", amount: distanceCharge },
      weight: { name: "Weight Charge", amount: weightCharge },
      generic: genericBreakdown, // Array of {name, amount}
      pincodeTypes: pincodeTypeBreakdown, // Array of {type, location, charge}
    },
  };
};
```

### Modal-Based CRUD UI Pattern

**1. Single Page with Modals**

```jsx
// Page manages modal state, not separate routes
const [createModalOpen, setCreateModalOpen] = useState(false);
const [viewModalOpen, setViewModalOpen] = useState(false);
const [editModalOpen, setEditModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);

// Table actions trigger modals
const handleView = (item) => {
  setSelectedItem(item);
  setViewModalOpen(true);
};
const handleEdit = (item) => {
  setSelectedItem(item);
  setEditModalOpen(true);
};
```

**2. View Modal with Edit Transition**

```jsx
// View modal has Edit button that switches modes
const ViewEditModal = ({ pkg, open, onClose }) => {
  const [mode, setMode] = useState("view");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogHeader>
        {mode === "view" ? (
          <Button onClick={() => setMode("edit")}>Edit</Button>
        ) : (
          <Button onClick={() => setMode("view")}>View</Button>
        )}
      </DialogHeader>
      {mode === "view" ? <ViewContent pkg={pkg} /> : <EditForm pkg={pkg} />}
    </Dialog>
  );
};
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

## Outlet Tenant Architecture Patterns (NEW - December 2025)

### Outlet Model Pattern

**1. Outlet Entity with Full Business Details**

```prisma
enum OutletType {
  RETAIL
  WAREHOUSE
  HUB
  FRANCHISE
}

enum OutletStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

model Outlet {
  id            String       @id @default(uuid())
  code          String       @unique // Auto-generated: OUT-{random}-{hash}
  name          String
  type          OutletType   @default(RETAIL)
  status        OutletStatus @default(ACTIVE)
  
  // Contact info
  email         String
  phone         String?
  contactPerson String?
  
  // Address
  address       String?
  city          String?
  state         String?
  pincode       String?
  country       String       @default("India")
  
  // Business details
  gstNumber     String?
  panNumber     String?
  bankDetails   Json?        // { accountNumber, bankName, ifscCode, accountHolderName }
  
  // Relationships
  outletUsers   OutletUser[]
  customers     Customer[]   // B2B customers linked to this outlet
  
  isActive      Boolean      @default(true)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}
```

**2. Outlet User Roles**

```prisma
model OutletUser {
  id             String   @id @default(uuid())
  outletId       String
  userId         String   // Links to auth-service User
  role           String   // 'outlet_admin' | 'outlet_staff'
  enabledModules String[] // ['shipment', 'billing', 'wallet', 'analytics', 'customer', 'partner']
  isActive       Boolean  @default(true)
  
  outlet         Outlet   @relation(fields: [outletId], references: [id])
  
  @@unique([outletId, userId])
}
```

### Outlet Tenant Scoping Pattern

**1. Adding outletId to Service Models**

```prisma
// partner-service/schema.prisma
model Zone {
  id        String  @id @default(cuid())
  partnerId String
  outletId  String? // Tenant scoping - null for global zones
  // ... other fields
  
  @@index([outletId])
}

model ChargePackage {
  id        String  @id @default(cuid())
  partnerId String
  outletId  String? // Tenant scoping
  // ... other fields
  
  @@index([outletId])
}

// shipment-service/schema.prisma
model Shipment {
  id        String  @id @default(uuid())
  outletId  String? // Tenant scoping
  // ... other fields
  
  @@index([outletId])
}
```

**2. Controller Query Filtering**

```javascript
// Outlet-scoped queries in controllers
async function listZones(req, res) {
  const { outletId } = req.query;
  
  const where = { partnerId: req.params.partnerId };
  
  // Filter by outlet if provided
  if (outletId) {
    where.outletId = outletId;
  }
  
  const zones = await prisma.zone.findMany({ where });
  res.json(APIResponse.success({ zones }));
}
```

### Internal Service Communication Pattern

**1. Service-to-Service User Creation**

```javascript
// auth-service/routes/auth.js - Internal endpoint (no requirePermission)
router.post(
  "/internal/users",
  sharedAuthMiddleware.authenticate,
  sharedAuthMiddleware.internalServiceOnly, // Only checks X-Internal-Request header
  AuthController.createUser
);

// PUT for updates
router.put(
  "/internal/users/:id",
  sharedAuthMiddleware.internalServiceOnly,
  AuthController.updateUser
);
```

**2. Calling Internal Endpoint from Other Services**

```javascript
// user-service calling auth-service
async function createAuthUser(userData, authToken) {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3002";
  const internalSecret = process.env.INTERNAL_SECRET;

  const response = await fetch(`${authServiceUrl}/auth/internal/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authToken, // Pass through original auth
      "X-Internal-Request": internalSecret, // Internal service identification
    },
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role, // 'outlet_admin' | 'outlet_staff'
      isActive: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to create user");
  }
  
  return (await response.json()).data.user;
}
```

### Outlet-Specific Frontend Navigation Pattern

**1. Role-Based Sidebar Menu**

```javascript
// sidebar.jsx
const getNavigationForRole = (user) => {
  // Outlet users get outlet-specific navigation
  if (user?.outletRole === "outlet_admin" || user?.outletRole === "outlet_staff") {
    return [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Shipments", href: "/shipments", icon: Package },
      { title: "Pincode Types", href: "/pricing/pincode-types", icon: MapPin },
      { title: "Zone Management", href: "/zones", icon: Globe },
      { title: "Charge Packages", href: "/charge-packages", icon: IndianRupee },
      { title: "Customer Management", href: "/customers", icon: Users },
    ];
  }
  
  // Default admin/superadmin navigation
  return defaultNavigation;
};
```

**2. Auth State with Outlet Context**

```typescript
// authSlice.ts
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  outletId?: string;    // Outlet user's outlet ID
  outletRole?: string;  // 'outlet_admin' | 'outlet_staff'
}

// Login response includes outlet context
{
  user: {
    id: "...",
    role: "outlet_admin",
    outletId: "f7043064-...",
    outletRole: "outlet_admin"
  },
  accessToken: "..."
}
```

### B2B Customer Linking Pattern

**1. Customer with Outlet Association**

```javascript
// Customer creation with outlet link
const customerData = {
  name: formData.name,
  email: formData.email,
  customerType: "B2B",  // or "OUTLET" for backwards compatibility
  outletId: selectedOutletId, // Links customer to specific outlet
  // ... other fields
};
```

**2. Filtering Customers by Outlet**

```javascript
// customerController.js - listCustomers
const where = {};

if (customerType) {
  // Handle both B2B and legacy OUTLET types
  if (customerType === "B2B") {
    where.customerType = { in: ["B2B", "OUTLET"] };
  } else {
    where.customerType = customerType;
  }
}

if (outletId) {
  where.outletId = outletId;
}

const customers = await prisma.customer.findMany({
  where,
  include: {
    outlet: { select: { id: true, name: true, code: true } },
  },
});
```

---

These patterns ensure consistency, maintainability, and scalability across all services while leveraging modern development practices and tools. The rule enforcement system guarantees quality standards are maintained throughout development.
