# Backend API Gateway & RBAC Tasks

## Task Management System

All tasks related to API Gateway security and RBAC implementation.

## Priority Levels

- **P0**: Critical security fixes (must complete first)
- **P1**: Core functionality (required for release)
- **P2**: Enhancements (nice to have)

---

## 📋 ACTIVE TASKS

### Task ID: GATE-001

**Task Name**: Remove External Service Ports
**Priority**: P0 (CRITICAL SECURITY)
**Status**: COMPLETED
**Estimated Time**: 2 hours
**Started**: 2025-10-10
**Completed**: 2025-10-10

**Planning**:

- **Objective**: Block all direct service access
- **Scope**: Modify docker-compose.yml for all services
- **Approach**: Remove ports, keep expose for internal network

**Implementation Checklist**:

- [x] Backup current docker-compose.yml (created backup-20251010-193116)
- [x] Remove port mappings for auth-service (3002)
- [x] Remove port mappings for user-service (3003)
- [x] Remove port mappings for shipment-service (3004)
- [x] Remove port mappings for partner-service (3005)
- [x] Remove port mappings for wallet-service (3006)
- [x] Remove port mappings for support-service (3007)
- [x] Remove port mappings for platform-service (3008)
- [x] Remove port mappings for license-service (3011)
- [x] Keep API Gateway (3001) and Frontend (3000) exposed
- [x] Updated docker-compose.backend.yml with same changes
- [x] Archived docker-compose.production.yml (not needed)
- [x] Tested with docker-compose up
- [x] Verified port 3002 returns connection refused
- [x] Verified API Gateway (3001) and Frontend (3000) accessible

**Implementation Notes**:

- Discovered multiple docker-compose files (main, backend, production)
- Updated ALL relevant compose files for consistency
- Removed orphaned containers from previous runs
- All services now use `expose` instead of `ports` for internal communication
- **CRITICAL SECURITY FIX**: Also removed external access to Postgres and Redis
- Only API Gateway (3001) and Frontend (3000) remain externally accessible
- Postgres and Redis now accessible only within Docker network (no external ports)

**Validation**:

```bash
# All backend services should fail with connection refused
curl http://localhost:3002/health  # auth-service - BLOCKED ✅
curl http://localhost:3003/health  # user-service - BLOCKED ✅
curl http://localhost:3004/health  # shipment-service - BLOCKED ✅
curl http://localhost:3005/health  # partner-service - BLOCKED ✅
curl http://localhost:3006/health  # wallet-service - BLOCKED ✅
curl http://localhost:3007/health  # support-service - BLOCKED ✅
curl http://localhost:3008/health  # platform-service - BLOCKED ✅
curl http://localhost:3011/health  # license-service - BLOCKED ✅

# Database and Redis should also be blocked
curl http://localhost:3009         # postgres - BLOCKED ✅
curl http://localhost:3010         # redis - BLOCKED ✅

# Only Gateway and Frontend should be accessible
curl http://localhost:3001/health  # API Gateway - ACCESSIBLE ✅
curl http://localhost:3000         # Frontend - ACCESSIBLE ✅
```

**Final Port Status**:

- Backend Services (3002-3008, 3011): Internal only (exposed within Docker)
- Postgres (5432): Internal only (no external mapping)
- Redis (6379): Internal only (no external mapping)
- API Gateway (3001): Externally accessible ✅
- Frontend (3000): Externally accessible ✅

---

### Task ID: GATE-002

**Task Name**: Add Internal Request Validation
**Priority**: P0 (CRITICAL SECURITY)
**Status**: NOT_STARTED
**Dependencies**: GATE-001
**Estimated Time**: 3 hours

**Planning**:

- **Objective**: Services accept only gateway requests
- **Scope**: Add middleware to all services
- **Approach**: Check X-Internal-Request header

**Implementation Per Service**:

1. auth-service/server.js
2. user-service/server.js
3. shipment-service/server.js
4. partner-service/server.js
5. wallet-service/server.js
6. support-service/server.js (if exists)
7. platform-service/server.js (if exists)
8. license-service/server.js

**Code to Add** (after imports, before routes):

```javascript
// Internal request validation middleware
app.use((req, res, next) => {
  // Allow health checks from Docker
  if (req.path === "/health" && req.method === "GET") {
    return next();
  }

  // Skip validation for internal endpoints like openapi.json
  if (req.path === "/openapi.json") {
    // Still check for internal header but with less strict validation
    if (!req.headers["x-internal-request"]) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  }

  // Validate internal requests for all other endpoints
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

**Environment Variables to Add**:

```env
# Add to each service's .env file
INTERNAL_SECRET=your-secure-internal-secret-change-in-production
```

---

### Task ID: GATE-003

**Task Name**: Implement Gateway JWT Validation
**Priority**: P0
**Status**: NOT_STARTED
**Dependencies**: GATE-002
**Estimated Time**: 2 hours

**Files to Create/Modify**:

- `backend/api-gateway/middleware/authValidator.js` (create)
- `backend/api-gateway/middleware/rbacChecker.js` (create)
- `backend/api-gateway/server.js` (modify)

**Implementation for authValidator.js**:

```javascript
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

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      status: "error",
      error: {
        code: "NO_TOKEN",
        message: "No authentication token provided",
      },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Add user info to headers for backend services
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

**Add to Gateway server.js**:

```javascript
const { validateJWT } = require("./middleware/authValidator");

// Apply JWT validation before proxying (after CORS, before proxy)
app.use(validateJWT);
```

---

### Task ID: RBAC-001

**Task Name**: Create Permission Constants
**Priority**: P0
**Status**: NOT_STARTED
**Estimated Time**: 1 hour

**File to Create**: `shared/constants/permissions.js`

**Implementation**:

```javascript
// 11-Role System
const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  CLIENT: "client",
  ACCOUNTS: "accounts",
  SALES: "sales",
  SUPPORT: "support",
  CUSTOMER: "customer",
  CUSTOMER_ACCOUNT: "customer_account",
  CUSTOMER_SALES: "customer_sales",
  CUSTOMER_SUPPORT: "customer_support",
  AFFILIATE: "affiliate",
};

// Permission Modules (Resources)
const PERMISSION_MODULES = {
  CLIENT: "client",
  LICENSE: "license",
  CUSTOMER: "customer",
  SHIPMENT: "shipment",
  WALLET: "wallet",
  PARTNER: "partner",
  USER: "user",
  BILLING: "billing",
  ANALYTICS: "analytics",
  SUPPORT: "support",
  PLATFORM: "platform",
  SETTINGS: "settings",
};

// Permission Actions
const PERMISSION_ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  EXPORT: "export",
  MANAGE: "manage",
  APPROVE: "approve",
  ASSIGN: "assign",
};

// Permission Scopes (Data Access Level)
const PERMISSION_SCOPES = {
  OWN: "own", // User's own data only
  PARENT: "parent", // Parent client's data
  ASSIGNED: "assigned", // Assigned customers/entities
  ALL: "all", // All data in tenant
  WILDCARD: "*", // System-wide (superadmin only)
};

// Default role permissions matrix
const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: ["*:*:*"], // All permissions

  [ROLES.ADMIN]: [
    "client:*:all",
    "license:*:all",
    "user:*:all",
    "settings:*:all",
    "platform:*:all",
    "analytics:read:all",
  ],

  [ROLES.CLIENT]: [
    "customer:*:parent",
    "shipment:*:parent",
    "wallet:*:own",
    "analytics:read:parent",
    "user:create:parent",
    "user:read:parent",
    "user:update:parent",
  ],

  [ROLES.ACCOUNTS]: [
    "billing:*:assigned",
    "wallet:read:assigned",
    "customer:read:assigned",
    "analytics:read:assigned",
  ],

  [ROLES.SALES]: [
    "customer:create:parent",
    "customer:read:assigned",
    "shipment:create:assigned",
    "shipment:read:assigned",
    "analytics:read:assigned",
  ],

  [ROLES.SUPPORT]: [
    "support:*:assigned",
    "customer:read:assigned",
    "shipment:read:assigned",
    "user:read:assigned",
  ],

  [ROLES.CUSTOMER]: [
    "shipment:*:own",
    "wallet:read:own",
    "support:create:own",
    "user:read:own",
    "user:update:own",
  ],

  [ROLES.CUSTOMER_ACCOUNT]: [
    "billing:read:parent",
    "wallet:read:parent",
    "analytics:read:parent",
  ],

  [ROLES.CUSTOMER_SALES]: [
    "shipment:create:parent",
    "shipment:read:parent",
    "analytics:read:parent",
  ],

  [ROLES.CUSTOMER_SUPPORT]: ["support:*:parent", "shipment:read:parent"],

  [ROLES.AFFILIATE]: [
    "customer:read:assigned",
    "analytics:read:assigned",
    "billing:read:assigned",
  ],
};

// Helper function to check if permission matches
function matchesPermission(required, userPermission) {
  const [reqModule, reqAction, reqScope] = required.split(":");
  const [userModule, userAction, userScope] = userPermission.split(":");

  // Check module match
  if (userModule !== "*" && userModule !== reqModule) return false;

  // Check action match
  if (userAction !== "*" && userAction !== reqAction) return false;

  // Check scope match
  if (userScope !== "*" && userScope !== reqScope) return false;

  return true;
}

module.exports = {
  ROLES,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
  DEFAULT_ROLE_PERMISSIONS,
  matchesPermission,
};
```

---

### Task ID: RBAC-002

**Task Name**: Update Auth Service Schema
**Priority**: P0
**Status**: NOT_STARTED
**Dependencies**: RBAC-001
**Estimated Time**: 2 hours

**Files to Modify**:

- `backend/auth-service/prisma/schema.prisma`

**Schema Updates Required**:

1. Add Role enum with 11 roles
2. Add AccessLevel enum
3. Update User model with RBAC fields
4. Add Permission model
5. Add RolePermission model
6. Add UserPermission model

**Migration Commands**:

```bash
# Create migration
docker-compose exec auth-service npx prisma migrate dev --name add_rbac_system

# If migration fails, reset and try again
docker-compose exec auth-service npx prisma migrate reset --force
docker-compose exec auth-service npx prisma migrate dev --name add_rbac_system
```

---

### Task ID: RBAC-003

**Task Name**: Implement Permission Checking
**Priority**: P0
**Status**: NOT_STARTED
**Dependencies**: RBAC-002
**Estimated Time**: 3 hours

**Files to Modify**:

- `shared/lib/auth.js` (already has basic implementation, needs enhancement)
- `shared/middleware/requirePermission.js` (create if not exists)

**Key Implementation Points**:

- Use Redis caching for permission checks
- Implement scope-based filtering
- Add cache invalidation logic
- Create middleware for route protection

---

### Task ID: SWAG-001

**Task Name**: Remove Swagger UI from Services
**Priority**: P1
**Status**: NOT_STARTED
**Estimated Time**: 1 hour

**Services to Modify**:

- auth-service
- user-service
- shipment-service
- partner-service
- wallet-service
- license-service
- support-service (if exists)
- platform-service (if exists)

**Changes Per Service**:

```javascript
// REMOVE or comment out these lines:
// const swaggerUi = require('swagger-ui-express');
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// KEEP but protect the JSON endpoint:
app.get("/openapi.json", (req, res) => {
  // Only respond to internal requests
  if (!req.headers["x-internal-request"]) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(swaggerSpec);
});
```

---

### Task ID: SWAG-002

**Task Name**: Create Gateway Swagger Aggregation
**Priority**: P1
**Status**: NOT_STARTED
**Dependencies**: SWAG-001
**Estimated Time**: 2 hours

**Files to Create**:

- `backend/api-gateway/routes/swagger.js`
- `backend/api-gateway/utils/swaggerMerger.js`

**Implementation for swagger.js**:

```javascript
const express = require("express");
const router = express.Router();
const axios = require("axios");
const logger = require("../shared/lib/logger");

// Only enable in development
if (process.env.NODE_ENV === "development") {
  // Service swagger endpoints (internal)
  const serviceSpecs = {
    auth: "http://auth-service:3002/openapi.json",
    users: "http://user-service:3003/openapi.json",
    shipments: "http://shipment-service:3004/openapi.json",
    partners: "http://partner-service:3005/openapi.json",
    wallet: "http://wallet-service:3006/openapi.json",
    support: "http://support-service:3007/openapi.json",
    platforms: "http://platform-service:3008/openapi.json",
    license: "http://license-service:3011/openapi.json",
  };

  // Individual service specs
  Object.entries(serviceSpecs).forEach(([service, url]) => {
    router.get(`/${service}.json`, async (req, res) => {
      try {
        const response = await axios.get(url, {
          headers: { "X-Internal-Request": process.env.INTERNAL_SECRET },
          timeout: 5000,
        });

        // Update server URL to gateway
        const spec = response.data;
        spec.servers = [
          {
            url: `http://localhost:3001/api/v1`,
            description: "API Gateway",
          },
        ];

        res.json(spec);
      } catch (error) {
        logger.error(`Failed to fetch ${service} swagger:`, error);
        res.status(503).json({
          error: `${service} service swagger unavailable`,
        });
      }
    });
  });

  // Merged spec endpoint
  router.get("/all.json", async (req, res) => {
    // Implementation for merging all specs
    res.json({ message: "Merged spec endpoint - to be implemented" });
  });
}

module.exports = router;
```

**Add to Gateway server.js**:

```javascript
// Swagger routes (dev only)
if (process.env.NODE_ENV === "development") {
  const swaggerRoutes = require("./routes/swagger");
  app.use("/swagger", swaggerRoutes);
}
```

---

## 📊 Task Summary

| Priority | Total | Not Started | In Progress | Completed | Blocked |
| -------- | ----- | ----------- | ----------- | --------- | ------- |
| P0       | 6     | 6           | 0           | 0         | 0       |
| P1       | 2     | 2           | 0           | 0         | 0       |
| P2       | 0     | 0           | 0           | 0         | 0       |

## Dependencies Graph

```
GATE-001 (Service Isolation)
    ↓
GATE-002 (Internal Validation)
    ↓
GATE-003 (JWT Validation)

RBAC-001 (Constants)
    ↓
RBAC-002 (Schema)
    ↓
RBAC-003 (Implementation)

SWAG-001 (Remove UI)
    ↓
SWAG-002 (Aggregation)
```

## Validation Checklist

### Security Validation

- [ ] All service ports return connection refused
- [ ] Direct service calls return 403
- [ ] Gateway routes work with valid token
- [ ] Invalid tokens return 401

### RBAC Validation

- [ ] Permissions correctly calculated
- [ ] Cache working properly
- [ ] Scope filtering applied
- [ ] Role hierarchy respected

### Documentation Validation

- [ ] Swagger JSON accessible via gateway
- [ ] All services documented
- [ ] Examples valid
- [ ] Gateway URLs used

## Testing Commands

```bash
# Test service isolation
./scripts/test-security.sh

# Test RBAC permissions
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/v1/users

# Test Swagger access
curl http://localhost:3001/swagger/auth.json | jq '.info'

# Generate TypeScript types
npx openapi-typescript \
  http://localhost:3001/swagger/all.json \
  --output ../frontend/src/types/api.generated.ts
```
