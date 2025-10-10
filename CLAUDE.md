# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Logistics Aggregator Portal** - A comprehensive logistics management solution for e-Commerce, B2B, and B2C enterprises in India, built with modern microservices architecture and Prisma ORM.

**Current Status**: Shipment Service 90% complete (tracking operational), Partner Service & Wallet Service complete, Platform Service & Support Service pending.

## Architecture

### Microservices Structure (7 Services)

```
✅ Auth Service (Port 3002) - JWT, RBAC, 2FA - PRODUCTION READY
✅ User Service (Port 3003) - Multi-tenant, white-label - PRODUCTION READY
✅ Partner Service (Port 3005) - 75+ endpoints, external API integration - COMPLETED
✅ Wallet Service (Port 3006) - 14 endpoints, payment processing - COMPLETED
🔄 Shipment Service (Port 3004) - 90% complete, tracking operational
❌ Platform Service (Port 3008) - E-commerce integrations - NOT STARTED
❌ Support Service (Port 3007) - Help desk, disputes - NOT STARTED
✅ API Gateway (Port 3001) - Routing, security - OPERATIONAL
✅ Frontend (Port 3000) - Next.js 14 with TypeScript - FOUNDATION READY
```

### Technology Stack

- **Backend**: Node.js 18+ with Express.js microservices
- **Database**: PostgreSQL 15+ with Prisma ORM (database-per-service pattern)
- **Caching**: Redis 7+ for sessions, API responses, permission caching, and performance
- **Authentication**: JWT with Redis sessions, RBAC with 11 roles (superadmin, admin, client, accounts, sales, support, customer, customer_account, customer_sales, customer_support, affiliate)
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand
- **Package Manager**: PNPM 8+ (monorepo workspace)
- **Containerization**: Docker with Docker Compose

## Development Commands

### Quick Start

```bash
# Complete fresh installation (cleanup + setup + dev)
pnpm run fresh:install

# Or step-by-step:
pnpm run setup:dev        # Auto-create .env files + install dependencies
pnpm run dev              # Start all services
```

### Service Management

```bash
# Full stack development
pnpm run dev                    # All services
pnpm run dev:detached          # Background mode
pnpm run stop                   # Stop all services

# Focused development
pnpm run dev:frontend          # Frontend + API Gateway only
pnpm run dev:backend           # Backend services + databases

# Service-specific profiles
docker-compose --profile user-service up
docker-compose --profile shipment-service up
docker-compose --profile partner-service up
docker-compose --profile wallet-service up
docker-compose --profile all-services up
```

### Database Operations (Prisma)

```bash
# Visual database browser
pnpm run prisma:studio

# Generate Prisma clients (after schema changes)
pnpm run prisma:generate

# Create migrations (service-specific)
docker-compose exec auth-service npx prisma migrate dev --name "description"
docker-compose exec user-service npx prisma migrate dev --name "description"

# Deploy migrations (production)
pnpm run migrate:deploy        # Core services
pnpm run migrate:deploy:all    # All services
```

### Testing & Quality

```bash
# Run tests
pnpm run test                   # All workspaces
pnpm run test:coverage         # With coverage reports

# Linting & formatting
pnpm run lint                   # All workspaces
pnpm run lint:fix              # Auto-fix issues
pnpm run type-check            # TypeScript type checking

# Health checks
pnpm run health                 # Backend API health
pnpm run health:frontend       # Frontend health
curl http://localhost:3002/health  # Specific service
```

### Monitoring & Logs

```bash
# View logs
pnpm run logs                   # All services
pnpm run logs:frontend         # Frontend only
pnpm run logs:backend          # Backend only
pnpm run logs:auth             # Auth service
pnpm run logs:user             # User service

# Service status
pnpm run ps                     # Running containers
pnpm run ps:all                # All containers (including stopped)
```

### Cleanup Operations

```bash
# Standard cleanup
pnpm run cleanup               # Remove dependencies, build files

# Deep cleanup
pnpm run cleanup:deep          # Includes Docker system prune

# Windows equivalents
pnpm run cleanup:win
pnpm run cleanup:deep:win
```

## Project Structure

### Critical Architecture Patterns

**ALWAYS check `backend/auth-service/` first for reference patterns** - it's the established standard.

```
logistics/
├── backend/                    # Microservices (standard structure)
│   ├── auth-service/          # ⭐ REFERENCE IMPLEMENTATION
│   │   ├── prisma/           # Schema + migrations
│   │   ├── controllers/      # Business logic (NEVER inline in routes)
│   │   ├── middleware/       # Auth, validation, errors
│   │   ├── routes/          # API route definitions
│   │   ├── config/          # Database, Redis, Swagger
│   │   └── server.js        # Express app entry
│   ├── user-service/
│   ├── shipment-service/
│   ├── partner-service/
│   ├── wallet-service/
│   ├── support-service/
│   ├── platform-service/
│   └── api-gateway/
├── frontend/                  # Next.js 14 application
│   ├── src/app/             # App Router pages
│   ├── src/components/      # Reusable UI components
│   └── src/lib/            # Utilities and configurations
├── shared/                    # Shared utilities (CRITICAL)
│   └── lib/                # Logger, response, auth, errors
├── docs/                      # Project documentation
├── memory-bank/              # Project context files
├── .cursor/rules/            # Development standards (READ THESE)
├── scripts/                  # Setup and automation scripts
└── docker-compose.yml       # Service orchestration
```

### Shared Library Usage (CRITICAL)

**Import Path Rules:**

```javascript
// ✅ CORRECT: From controllers/routes/middleware/services
const logger = require("../shared/lib/logger");
const { APIResponse } = require("../shared/lib/response");
const { authMiddleware } = require("../shared/lib/auth");

// ✅ CORRECT: From server.js only
const logger = require("./shared/lib/logger");

// ❌ FORBIDDEN: Never use relative paths like this
const logger = require("../../shared/lib/logger");
```

**Available Shared Libraries:**

- `shared/lib/logger.js` - Winston logger with service-specific logs
- `shared/lib/response.js` - Standard API response formats
- `shared/lib/auth.js` - JWT authentication middleware
- `shared/lib/errors.js` - Custom error classes (APIError, ValidationError, etc.)
- `shared/lib/database.js` - Prisma connection patterns
- `shared/lib/redis.js` - Redis client configuration
- `shared/lib/corsConfig.js` - CORS security configuration

## Development Standards

### Backend Service Rules (MANDATORY)

**Read `.cursor/rules/backend.mdc` for complete standards**

1. **Controller Pattern** - NO inline functions in routes, ALL business logic in controller methods
2. **Prisma ORM** - NEVER raw SQL, always use Prisma for type-safe operations
3. **Audit Logging** - MANDATORY for all CRUD operations
4. **JWT Authentication** - Required for all protected endpoints
5. **Input Validation** - Joi schemas for ALL endpoints
6. **Standard Response Format** - Use `shared/lib/response.js`
7. **Health Checks** - Every service MUST have `/health` endpoint
8. **Swagger Documentation** - All endpoints documented at `/api-docs`

### Verification Before Completion (MANDATORY)

**EVERY backend task MUST pass these checks:**

```bash
# 1. Restart Docker service
docker-compose restart service-name

# 2. Check logs for errors
docker logs logistics-service-name --tail=30

# 3. Look for MODULE_NOT_FOUND errors
docker logs logistics-service-name | grep "MODULE_NOT_FOUND"

# 4. Test health endpoint
curl http://localhost:PORT/health | jq .

# 5. Test API endpoints
curl -X GET http://localhost:PORT/api/v1/endpoint

# 6. Verify new endpoints are accessible
curl -s http://localhost:PORT/ | jq '.endpoints'
```

**If ANY verification fails, the task is NOT complete!**

### Service Communication Patterns

**Environment-based service URLs:**

```javascript
const SERVICE_URLS = {
  auth: process.env.AUTH_SERVICE_URL || "http://auth-service:3002",
  user: process.env.USER_SERVICE_URL || "http://user-service:3003",
  wallet: process.env.WALLET_SERVICE_URL || "http://wallet-service:3006",
  partner: process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
  shipment: process.env.SHIPMENT_SERVICE_URL || "http://shipment-service:3004",
};
```

## External Service Integrations

### Partner Micro Service (External API)

- **URL**: `https://calc.websiteduniya.com`
- **Authentication**: HMAC SHA-256
- **Endpoints**: 75+ endpoints for charge calculation, zone management
- **Caching**: Redis with 5-30 minute TTL
- **Status**: ✅ Fully integrated in partner-service

### Wallet API (External)

- **URL**: `https://wapi.websiteduniya.com/api/v1`
- **Authentication**: HMAC SHA-256
- **Endpoints**: 14 endpoints for wallet operations
- **Features**: Auto wallet creation, balance validation, debit/credit operations
- **Status**: ✅ Fully integrated in wallet-service

## Key Implementation Patterns

### Task Breakdown Strategy

**Following proven Partner Service pattern:**

Break large services into focused 2-day tasks:

- SHIP-001: Foundation (2 days) ✅ COMPLETED
- SHIP-002: Partner Integration (2 days) ✅ COMPLETED
- SHIP-003: Wallet Integration (2 days) ✅ COMPLETED
- SHIP-004: Tracking System (2 days) ✅ COMPLETED
- SHIP-005: Bulk Operations (2 days) - FINAL PHASE

**Benefits**: Manageable scope, clear dependencies, easier testing, consistent with proven patterns.

### Shipment Status Workflow

```javascript
const SHIPMENT_STATUS_FLOW = {
  CREATED: ["BOOKED", "CANCELLED"],
  BOOKED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "RTO"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "RTO"],
  OUT_FOR_DELIVERY: ["DELIVERED", "NDR", "RTO"],
  DELIVERED: [], // Terminal state
  CANCELLED: [], // Terminal state
  RTO: ["DELIVERED"],
  NDR: ["OUT_FOR_DELIVERY", "RTO"],
};
```

### Tracking System Features

- **Status Workflow Management**: Automatic validation of status transitions
- **Public AWB Tracking**: Customer-friendly tracking without authentication
- **POD Management**: Signature capture, delivery images, OTP verification
- **Analytics Engine**: Performance metrics with time-based reporting (1d/7d/30d/90d)
- **Redis Caching**: 80% performance improvement on tracking operations
- **Multi-Source Events**: SYSTEM, PARTNER, MANUAL, API, WEBHOOK sources

### Caching Strategy

```javascript
// Different TTLs based on data volatility
const CACHE_STRATEGIES = {
  tracking: { ttl: 300 }, // 5 minutes - volatile data
  awbTracking: { ttl: 600 }, // 10 minutes - public tracking
  analytics: { ttl: 3600 }, // 1 hour - aggregated data
  geographical: { ttl: 86400 }, // 24 hours - static data
};
```

## Database Design

### Database-Per-Service Pattern

Each service has its own PostgreSQL database:

- `logistics_auth` - Users, sessions, audit logs
- `logistics_users` - Clients, settings, invitations
- `logistics_partners` - Partners, zones, charges, discounts
- `logistics_wallet` - Wallets, transactions, payment gateways
- `logistics_shipments` - Shipments, tracking, disputes, POD
- `logistics_platforms` - Integrations, orders, webhooks
- `logistics_support` - Tickets, knowledge base

### Mandatory Schema Patterns

**Every service schema MUST include:**

```prisma
// Base fields for ALL models
id        String   @id @default(uuid()) @db.Uuid
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

// Audit logging model (REQUIRED for every service)
model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String?  @db.Uuid
  action     String   @db.VarChar(50)
  resource   String   @db.VarChar(100)
  resourceId String?  @db.Uuid
  changes    Json?
  ipAddress  String?  @db.VarChar(50)
  userAgent  String?
  createdAt  DateTime @default(now())

  @@map("audit_logs")
}
```

## Authentication & Authorization

### JWT + Redis Session Pattern

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

### RBAC Permission Matrix

```javascript
const ROLE_PERMISSIONS = {
  admin: ["*"], // All permissions
  finance: ["wallet.*", "billing.*", "reports.financial"],
  operations: ["shipment.*", "partner.*", "tracking.*"],
  client: ["shipment.create", "shipment.view", "wallet.view"],
  support: ["ticket.*", "dispute.*", "knowledge.*"],
};
```

## RBAC System Implementation (11-Role Hierarchy)

### Overview

**Current Priority**: Comprehensive RBAC system with 11 roles, granular permissions, client/customer hierarchy, and license integration.

**Role Hierarchy**:
- **superadmin** - System owner (all permissions)
- **admin** - Platform administrator (manage clients, licenses, system config)
- **client** - License-based deployment customer (manage own customers, sub-users)
- **accounts** / **sales** / **support** - Client's team members (limited to client's scope)
- **customer** - Client's customer (manage own shipments)
- **customer_account** / **customer_sales** / **customer_support** - Customer's sub-users (limited to customer's scope)
- **affiliate** - Commission-based partner (referral tracking)

### RBAC Rules for Claude Code

**These rules are Claude-specific and supersede .cursor rules for RBAC implementation.**

#### 1. Permission System Constants (MANDATORY)

**Location**: `shared/constants/permissions.js`

**ALWAYS use these constants** - NEVER hardcode permission strings:

```javascript
// Permission Modules (Resources)
const PERMISSION_MODULES = {
  CLIENT: 'client',
  LICENSE: 'license',
  CUSTOMER: 'customer',
  SHIPMENT: 'shipment',
  WALLET: 'wallet',
  PARTNER: 'partner',
  USER: 'user',
  BILLING: 'billing',
  ANALYTICS: 'analytics',
  SUPPORT: 'support',
  PLATFORM: 'platform',
  SETTINGS: 'settings'
};

// Permission Actions
const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  EXPORT: 'export',
  MANAGE: 'manage',  // Full CRUD
  APPROVE: 'approve',
  ASSIGN: 'assign'
};

// Permission Scopes (Data Access Level)
const PERMISSION_SCOPES = {
  OWN: 'own',           // User's own data only
  PARENT: 'parent',     // Parent client's data (for client role)
  ASSIGNED: 'assigned', // Assigned customers/entities
  ALL: 'all',           // All data in tenant
  WILDCARD: '*'         // System-wide (superadmin only)
};

// Usage Pattern: {module}:{action}:{scope}
// Example: 'shipment:create:own' - Create shipments for own account
// Example: 'customer:read:assigned' - Read assigned customers only
```

**Claude Workflow**:
1. When implementing RBAC-002, create `shared/constants/permissions.js` FIRST
2. Use Task tool to invoke backend-service-builder agent for constant file creation
3. Verify constants are exported correctly with `module.exports`
4. Update `shared/lib/auth.js` to import these constants

#### 2. Role System Standards

**Location**: `backend/auth-service/prisma/schema.prisma` and `backend/user-service/prisma/schema.prisma`

**11-Role Enum** (RBAC-001):

```prisma
enum Role {
  superadmin         // System owner - full access
  admin              // Platform admin - manage clients
  client             // License holder - manage customers
  accounts           // Client's finance team
  sales              // Client's sales team
  support            // Client's support team
  customer           // End customer - use platform
  customer_account   // Customer's finance access
  customer_sales     // Customer's sales access
  customer_support   // Customer's support access
  affiliate          // Referral partner
}
```

**Enhanced User Model** (auth-service):

```prisma
model User {
  id                String    @id @default(uuid()) @db.Uuid
  email             String    @unique @db.VarChar(255)
  password          String
  role              Role      @default(customer)

  // RBAC Fields
  parentClientId    String?   @db.Uuid  // For client role hierarchy
  parentUserId      String?   @db.Uuid  // For sub-user roles
  accessLevel       AccessLevel @default(LIMITED)
  assignedCustomerIds String[] @db.Uuid  // For assigned scope

  // License Integration
  licenseId         String?   @db.Uuid

  // Affiliate Fields
  commissionRate    Decimal?  @db.Decimal(5,2)

  // Relations
  rolePermissions   RolePermission[]
  userPermissions   UserPermission[]

  // Standard fields
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([email])
  @@index([role])
  @@index([parentClientId])
  @@index([licenseId])
  @@map("users")
}

enum AccessLevel {
  FULL      // Full access to parent's data
  LIMITED   // Restricted access
  READ_ONLY // View-only access
}
```

**Permission Models** (auth-service):

```prisma
model Permission {
  id                 String   @id @default(uuid()) @db.Uuid
  module             String   @db.VarChar(50)      // From PERMISSION_MODULES
  action             String   @db.VarChar(50)      // From PERMISSION_ACTIONS
  scope              String   @db.VarChar(50)      // From PERMISSION_SCOPES
  description        String
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  rolePermissions    RolePermission[]
  userPermissions    UserPermission[]

  @@unique([module, action, scope])
  @@index([module])
  @@index([isActive])
  @@map("permissions")
}

model RolePermission {
  id           String     @id @default(uuid()) @db.Uuid
  role         Role
  permissionId String     @db.Uuid
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([role, permissionId])
  @@index([role])
  @@map("role_permissions")
}

model UserPermission {
  id           String     @id @default(uuid()) @db.Uuid
  userId       String     @db.Uuid
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permissionId String     @db.Uuid
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  isGranted    Boolean    @default(true)  // false = explicitly denied
  createdAt    DateTime   @default(now())

  @@unique([userId, permissionId])
  @@index([userId])
  @@map("user_permissions")
}
```

**Claude Workflow**:
1. Use database-manager agent for schema updates (RBAC-001)
2. Generate migration with descriptive name: `npx prisma migrate dev --name "add_rbac_11_role_system"`
3. ALWAYS verify migration in Docker: `docker-compose exec auth-service npx prisma migrate status`
4. Test migration rollback BEFORE marking complete

#### 3. Permission Checking Patterns (RBAC-004)

**Location**: `shared/lib/auth.js` (extend existing auth utilities)

**Core Permission Functions**:

```javascript
const prisma = require('./database').getAuthPrisma();
const redis = require('./redis');
const { PERMISSION_SCOPES } = require('../constants/permissions');

/**
 * Check if user has permission
 * @param {Object} user - User object with id, role
 * @param {string} module - Permission module (from PERMISSION_MODULES)
 * @param {string} action - Permission action (from PERMISSION_ACTIONS)
 * @param {string} scope - Permission scope (from PERMISSION_SCOPES)
 * @returns {Promise<boolean>}
 */
async function checkPermission(user, module, action, scope = 'all') {
  // Superadmin bypass
  if (user.role === 'superadmin') return true;

  // Cache check (5-minute TTL)
  const cacheKey = `perm:${user.id}:${module}:${action}:${scope}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === 'true';

  // Get effective permissions (role + user-specific)
  const permissions = await getEffectivePermissions(user);

  // Check permission match (support wildcards)
  const hasPermission = permissions.some(p =>
    (p.module === module || p.module === '*') &&
    (p.action === action || p.action === '*') &&
    (p.scope === scope || p.scope === '*' || scope === '*')
  );

  // Cache result
  await redis.setex(cacheKey, 300, hasPermission ? 'true' : 'false');

  return hasPermission;
}

/**
 * Get effective permissions (role-based + user-specific overrides)
 */
async function getEffectivePermissions(user) {
  const cacheKey = `perms:${user.id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Get role permissions
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: user.role },
    include: { permission: true }
  });

  // Get user-specific permissions
  const userPermissions = await prisma.userPermission.findMany({
    where: { userId: user.id },
    include: { permission: true }
  });

  // Merge: user permissions override role permissions
  const permMap = new Map();

  // Add role permissions
  rolePermissions.forEach(rp => {
    if (rp.permission.isActive) {
      const key = `${rp.permission.module}:${rp.permission.action}:${rp.permission.scope}`;
      permMap.set(key, rp.permission);
    }
  });

  // Override with user permissions
  userPermissions.forEach(up => {
    if (up.permission.isActive) {
      const key = `${up.permission.module}:${up.permission.action}:${up.permission.scope}`;
      if (up.isGranted) {
        permMap.set(key, up.permission);
      } else {
        permMap.delete(key); // Explicitly denied
      }
    }
  });

  const permissions = Array.from(permMap.values());

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(permissions));

  return permissions;
}

/**
 * Invalidate permission cache for user
 */
async function invalidatePermissionCache(userId) {
  await redis.del(`perms:${userId}`);
  // Also clear individual permission checks
  const keys = await redis.keys(`perm:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

module.exports = {
  checkPermission,
  getEffectivePermissions,
  invalidatePermissionCache,
  // ... existing auth exports
};
```

**Claude Workflow**:
1. Read existing `shared/lib/auth.js` to understand current patterns
2. Add new functions WITHOUT breaking existing JWT auth
3. Test permission checking with Docker restart: `docker-compose restart auth-service`
4. Verify no MODULE_NOT_FOUND errors in logs

#### 4. Permission Middleware (RBAC-004)

**Location**: `shared/middleware/requirePermission.js` (NEW FILE)

```javascript
const { checkPermission } = require('../lib/auth');
const { APIError } = require('../lib/errors');
const logger = require('../lib/logger');

/**
 * Middleware to require specific permission
 * Usage: router.post('/clients', requirePermission('client', 'create', 'all'), ClientController.create)
 */
function requirePermission(module, action, scope = 'all') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new APIError('Unauthorized', 401);
      }

      const hasPermission = await checkPermission(req.user, module, action, scope);

      if (!hasPermission) {
        logger.warn(`Permission denied: ${req.user.email} (${req.user.role}) attempted ${module}:${action}:${scope}`);
        throw new APIError(
          `Insufficient permissions. Required: ${module}:${action}:${scope}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check customer access (for customer-scoped operations)
 */
function requireCustomerAccess(customerId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new APIError('Unauthorized', 401);
      }

      const { role, assignedCustomerIds, parentClientId } = req.user;

      // Superadmin and admin have access to all
      if (role === 'superadmin' || role === 'admin') {
        return next();
      }

      // Client role can access own customers
      if (role === 'client') {
        // Check if customer belongs to this client
        const customer = await prisma.customer.findFirst({
          where: {
            id: customerId || req.params.customerId,
            clientId: req.user.id
          }
        });

        if (!customer) {
          throw new APIError('Customer not found or access denied', 403);
        }

        return next();
      }

      // Sub-user roles (accounts, sales, support) check assigned customers
      if (['accounts', 'sales', 'support'].includes(role)) {
        if (!assignedCustomerIds || !assignedCustomerIds.includes(customerId || req.params.customerId)) {
          throw new APIError('Customer not assigned to you', 403);
        }
        return next();
      }

      // Customer roles can only access their own data
      if (role.startsWith('customer')) {
        if (req.user.customerId !== (customerId || req.params.customerId)) {
          throw new APIError('Access denied', 403);
        }
        return next();
      }

      throw new APIError('Insufficient permissions', 403);

    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  requirePermission,
  requireCustomerAccess
};
```

**Claude Workflow**:
1. Create middleware file using Write tool
2. Test import in a service: `const { requirePermission } = require('../shared/middleware/requirePermission');`
3. Apply to ONE test route first: `router.post('/test', authMiddleware, requirePermission('client', 'create'), ...)`
4. Verify with curl: `curl -H "Authorization: Bearer $TOKEN" -X POST http://localhost:3002/api/v1/test`
5. Check logs for permission check execution

#### 5. Scope Filtering Utilities (RBAC-005)

**Location**: `shared/utils/scopeFilter.js` (NEW FILE)

```javascript
const { PERMISSION_SCOPES } = require('../constants/permissions');

/**
 * Apply scope-based filtering to Prisma query
 * @param {Object} user - Current user
 * @param {string} scope - Permission scope (own, parent, assigned, all, *)
 * @param {Object} baseWhere - Existing where clause
 * @returns {Object} Modified where clause
 */
function applyScopeFilter(user, scope, baseWhere = {}) {
  const { role, id: userId, parentClientId, assignedCustomerIds, customerId } = user;

  // Superadmin and wildcard scope - no filtering
  if (role === 'superadmin' || scope === PERMISSION_SCOPES.WILDCARD) {
    return baseWhere;
  }

  switch (scope) {
    case PERMISSION_SCOPES.OWN:
      // Only user's own data
      return {
        ...baseWhere,
        OR: [
          { userId },
          { createdBy: userId },
          { ownerId: userId }
        ]
      };

    case PERMISSION_SCOPES.PARENT:
      // Parent client's data
      if (role === 'client') {
        return {
          ...baseWhere,
          clientId: userId
        };
      }
      if (parentClientId) {
        return {
          ...baseWhere,
          clientId: parentClientId
        };
      }
      return baseWhere;

    case PERMISSION_SCOPES.ASSIGNED:
      // Assigned customers/entities
      if (assignedCustomerIds && assignedCustomerIds.length > 0) {
        return {
          ...baseWhere,
          customerId: { in: assignedCustomerIds }
        };
      }
      return { ...baseWhere, id: null }; // No access if nothing assigned

    case PERMISSION_SCOPES.ALL:
      // All within tenant (client's scope)
      if (role === 'client') {
        return {
          ...baseWhere,
          clientId: userId
        };
      }
      if (parentClientId) {
        return {
          ...baseWhere,
          clientId: parentClientId
        };
      }
      if (customerId) {
        return {
          ...baseWhere,
          customerId
        };
      }
      return baseWhere;

    default:
      return baseWhere;
  }
}

module.exports = { applyScopeFilter };
```

**Usage in Controllers**:

```javascript
const { applyScopeFilter } = require('../shared/utils/scopeFilter');

async function listShipments(req, res) {
  const { user } = req;

  // Apply scope filtering based on user's role and permissions
  const where = applyScopeFilter(user, 'parent', {
    status: req.query.status
  });

  const shipments = await prisma.shipment.findMany({
    where,
    include: { customer: true }
  });

  res.json(APIResponse.success(shipments));
}
```

**Claude Workflow**:
1. Create scope filter utility file
2. Import in controller: `const { applyScopeFilter } = require('../shared/utils/scopeFilter');`
3. Test with different roles (superadmin, client, accounts, customer)
4. Verify data isolation with SQL queries in Prisma Studio

#### 6. Cache Invalidation Strategy (CRITICAL)

**When to Invalidate Permission Cache**:

```javascript
const { invalidatePermissionCache } = require('../shared/lib/auth');

// 1. When user role changes
async function updateUserRole(userId, newRole) {
  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole }
  });

  await invalidatePermissionCache(userId);  // ⚡ MANDATORY
}

// 2. When user permissions are modified
async function grantPermission(userId, permissionId) {
  await prisma.userPermission.create({
    data: { userId, permissionId, isGranted: true }
  });

  await invalidatePermissionCache(userId);  // ⚡ MANDATORY
}

// 3. When role permissions change (invalidate ALL users with that role)
async function updateRolePermission(role, permissionId) {
  await prisma.rolePermission.create({
    data: { role, permissionId }
  });

  // Invalidate all users with this role
  const users = await prisma.user.findMany({
    where: { role },
    select: { id: true }
  });

  for (const user of users) {
    await invalidatePermissionCache(user.id);  // ⚡ MANDATORY
  }
}

// 4. When assigned customers change
async function updateAssignedCustomers(userId, customerIds) {
  await prisma.user.update({
    where: { id: userId },
    data: { assignedCustomerIds: customerIds }
  });

  await invalidatePermissionCache(userId);  // ⚡ MANDATORY
}
```

**Claude Workflow**:
1. ALWAYS call `invalidatePermissionCache()` after permission/role changes
2. Add cache invalidation to EVERY controller that modifies roles/permissions
3. Test cache invalidation: Change role → Check permission immediately → Should reflect new permissions
4. Monitor Redis keys with: `docker-compose exec redis redis-cli KEYS "perm:*"`

#### 7. Role Migration Strategy (5 → 11 Roles)

**Migration File**: `backend/auth-service/prisma/migrations/{timestamp}_expand_role_enum/migration.sql`

**Safe Migration Steps**:

```sql
-- Step 1: Add new roles to enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_account';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_sales';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_support';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'affiliate';

-- Step 2: Migrate existing users (ONLY if mapping is clear)
-- admin → admin (no change)
-- finance → accounts (rename)
-- operations → support (rename)
-- client → client (no change, but enhance with license)
-- support → support (no change)

-- Step 3: Add new user fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentClientId" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentUserId" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accessLevel" VARCHAR(50) DEFAULT 'LIMITED';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assignedCustomerIds" UUID[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "licenseId" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,2);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS "users_parentClientId_idx" ON "users"("parentClientId");
CREATE INDEX IF NOT EXISTS "users_licenseId_idx" ON "users"("licenseId");
```

**Claude Workflow**:
1. Use database-manager agent for migration creation
2. Run migration in Docker: `docker-compose exec auth-service npx prisma migrate dev --name "expand_role_enum_to_11_roles"`
3. VERIFY migration success: `docker-compose exec auth-service npx prisma migrate status`
4. Test rollback BEFORE production: `npx prisma migrate reset --skip-seed`
5. Backup production database BEFORE applying migration

#### 8. RBAC Testing Requirements

**Test Coverage Requirements**:

```javascript
// 1. Permission Checking Tests
describe('Permission System', () => {
  test('superadmin has all permissions', async () => {
    const hasPermission = await checkPermission(
      { id: 'user1', role: 'superadmin' },
      'client', 'delete', 'all'
    );
    expect(hasPermission).toBe(true);
  });

  test('client role cannot delete clients', async () => {
    const hasPermission = await checkPermission(
      { id: 'user2', role: 'client' },
      'client', 'delete', 'all'
    );
    expect(hasPermission).toBe(false);
  });

  test('user-specific permission overrides role', async () => {
    // Grant special permission to specific user
    await prisma.userPermission.create({
      data: {
        userId: 'user3',
        permissionId: 'perm_client_delete',
        isGranted: true
      }
    });

    const hasPermission = await checkPermission(
      { id: 'user3', role: 'client' },
      'client', 'delete', 'all'
    );
    expect(hasPermission).toBe(true);
  });
});

// 2. Scope Filtering Tests
describe('Scope Filtering', () => {
  test('OWN scope filters to user data only', () => {
    const where = applyScopeFilter(
      { id: 'user1', role: 'customer' },
      'own',
      { status: 'active' }
    );

    expect(where).toMatchObject({
      status: 'active',
      OR: expect.arrayContaining([
        { userId: 'user1' }
      ])
    });
  });

  test('ASSIGNED scope filters to assigned customers', () => {
    const where = applyScopeFilter(
      {
        id: 'user1',
        role: 'accounts',
        assignedCustomerIds: ['cust1', 'cust2']
      },
      'assigned'
    );

    expect(where.customerId).toEqual({ in: ['cust1', 'cust2'] });
  });
});

// 3. Cache Invalidation Tests
describe('Permission Cache', () => {
  test('cache invalidation clears permission cache', async () => {
    // Check permission (should cache)
    await checkPermission(user, 'client', 'create', 'all');

    // Change role
    await invalidatePermissionCache(user.id);

    // Verify cache is cleared
    const cached = await redis.get(`perms:${user.id}`);
    expect(cached).toBeNull();
  });
});
```

**Claude Workflow**:
1. Create test files in `backend/auth-service/__tests__/rbac/`
2. Run tests with: `docker-compose exec auth-service npm test`
3. NEVER mark RBAC task complete without test coverage
4. Verify test success in CI/CD pipeline

#### 9. Cross-Service RBAC Integration (RBAC-005)

**Pattern for Service-to-Service Permission Checks**:

```javascript
// shipment-service/controllers/shipmentController.js
const axios = require('axios');

async function createShipment(req, res) {
  const { user } = req;

  // Call auth-service to verify permission
  const permissionCheck = await axios.post(
    `${process.env.AUTH_SERVICE_URL}/api/v1/auth/check-permission`,
    {
      userId: user.id,
      module: 'shipment',
      action: 'create',
      scope: 'parent'
    },
    {
      headers: { Authorization: req.headers.authorization }
    }
  );

  if (!permissionCheck.data.data.hasPermission) {
    throw new APIError('Insufficient permissions', 403);
  }

  // Proceed with shipment creation
  const shipment = await prisma.shipment.create({
    data: {
      ...req.body,
      createdBy: user.id,
      clientId: user.role === 'client' ? user.id : user.parentClientId
    }
  });

  res.json(APIResponse.success(shipment));
}
```

**Auth Service Permission Check Endpoint** (NEW):

```javascript
// auth-service/controllers/authController.js
async function checkPermissionEndpoint(req, res) {
  const { userId, module, action, scope } = req.body;

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new APIError('User not found', 404);
  }

  // Check permission
  const hasPermission = await checkPermission(user, module, action, scope);

  res.json(APIResponse.success({ hasPermission }));
}

// Route
router.post('/check-permission', authMiddleware, checkPermissionEndpoint);
```

**Claude Workflow**:
1. Create permission check endpoint in auth-service first (RBAC-004)
2. Update other services to call this endpoint (RBAC-005)
3. Add error handling for auth-service downtime (fallback to local cache)
4. Test cross-service calls with Docker network

#### 10. Client Registration with License Integration (RBAC-003)

**Pattern for Client Registration Flow**:

```javascript
// user-service/controllers/clientController.js
const axios = require('axios');
const crypto = require('crypto');

async function registerClient(req, res) {
  const { companyName, adminEmail, adminPassword, licenseType, services } = req.body;

  try {
    // Step 1: Create client in user-service
    const client = await prisma.client.create({
      data: {
        companyName,
        clientType: 'LICENSE_BASED',
        isActive: false  // Activate after license generation
      }
    });

    // Step 2: Create admin user in auth-service
    const authResponse = await axios.post(
      `${process.env.AUTH_SERVICE_URL}/api/v1/users`,
      {
        email: adminEmail,
        password: adminPassword,
        role: 'client',
        clientId: client.id
      }
    );

    const adminUser = authResponse.data.data;

    // Step 3: Generate license via license-service
    const licenseResponse = await axios.post(
      `${process.env.LICENSE_SERVICE_URL}/api/v1/licenses/generate`,
      {
        clientId: client.id,
        clientName: companyName,
        licenseType,
        maxActivations: licenseType === 'TRIAL' ? 1 : 3,
        features: services,
        expiresAt: licenseType === 'TRIAL'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 days
          : null
      }
    );

    const license = licenseResponse.data.data;

    // Step 4: Update client with license
    await prisma.client.update({
      where: { id: client.id },
      data: {
        licenseId: license.id,
        isActive: true
      }
    });

    // Step 5: Update user with license
    await axios.patch(
      `${process.env.AUTH_SERVICE_URL}/api/v1/users/${adminUser.id}`,
      { licenseId: license.id }
    );

    // Step 6: Trigger secure Docker image build
    const buildResponse = await axios.post(
      `${process.env.DOCKER_BUILDER_URL}/build`,
      {
        clientId: client.id,
        clientName: companyName,
        services,
        licenseKey: license.licenseKey,
        registry: process.env.DOCKER_REGISTRY
      }
    );

    res.json(APIResponse.success({
      client,
      adminUser: { id: adminUser.id, email: adminUser.email },
      license: {
        licenseKey: license.licenseKey,
        expiresAt: license.expiresAt
      },
      deployment: buildResponse.data.data
    }, 'Client registered successfully'));

  } catch (error) {
    // Rollback on failure
    if (client?.id) {
      await prisma.client.delete({ where: { id: client.id } }).catch(() => {});
    }
    throw error;
  }
}
```

**Claude Workflow**:
1. Implement client registration in user-service (RBAC-003)
2. Test rollback scenarios (license generation failure, Docker build failure)
3. Add comprehensive error logging for each step
4. Verify with integration-tester agent

### RBAC Implementation Checklist

**BEFORE starting RBAC-001**:

- [ ] Read this entire RBAC section
- [ ] Review `backend/BACKEND_TASK.md` RBAC tasks (RBAC-001 to RBAC-007)
- [ ] Understand 11-role hierarchy and permission patterns
- [ ] Study auth-service reference implementation
- [ ] Plan 12-hour preparation phase

**DURING implementation**:

- [ ] Create permission constants FIRST (`shared/constants/permissions.js`)
- [ ] Update schemas with UUID (NOT CUID) for consistency
- [ ] Test migrations in Docker BEFORE production
- [ ] Add cache invalidation to ALL permission-modifying functions
- [ ] Apply scope filtering to ALL list/read operations
- [ ] Create permission check endpoint in auth-service
- [ ] Add RBAC tests for each task (minimum 80% coverage)
- [ ] Verify Docker service restart after each change
- [ ] Check logs for MODULE_NOT_FOUND errors

**AFTER task completion**:

- [ ] Run full test suite: `docker-compose exec auth-service npm test`
- [ ] Test permission checks with different roles (superadmin, client, customer)
- [ ] Verify cache invalidation works correctly
- [ ] Test scope filtering with real data
- [ ] Use task-verifier agent for final verification
- [ ] Update memory bank with completion status

### RBAC-Specific Never Do

- ❌ Hardcode permission strings (use PERMISSION_MODULES/ACTIONS/SCOPES constants)
- ❌ Skip cache invalidation after role/permission changes
- ❌ Use class-based controllers (use function-based exports)
- ❌ Use CUID (always use UUID with `@db.Uuid`)
- ❌ Mark task complete without cross-service integration tests
- ❌ Skip rollback testing for role enum migration
- ❌ Implement RBAC without reading this section first

### RBAC-Specific Always Do

- ✅ Create `shared/constants/permissions.js` FIRST (before any permission logic)
- ✅ Use database-manager agent for schema changes
- ✅ Test migrations in Docker: `docker-compose exec auth-service npx prisma migrate status`
- ✅ Invalidate permission cache when roles/permissions change
- ✅ Apply scope filtering to ALL data access operations
- ✅ Use integration-tester agent for cross-service permission checks
- ✅ Add comprehensive tests for permission logic (80%+ coverage)
- ✅ Verify license integration works end-to-end (client registration → license → Docker build)

## Memory Bank System

**READ THESE at the start of EVERY session:**

1. `memory-bank/projectbrief.md` - Project vision, scope, success metrics
2. `memory-bank/productContext.md` - Business problems and solutions
3. `memory-bank/systemPatterns.md` - Architecture and technical decisions
4. `memory-bank/techContext.md` - Technologies and tools
5. `memory-bank/activeContext.md` - Current work focus and priorities
6. `memory-bank/progress.md` - What's built and what's remaining

**The memory bank is the source of truth for project context and progress.**

## Important Notes

### India-Specific Features

- **GST Compliance**: 18% tax calculations and reporting
- **Local Couriers**: Delhivery, Blue Dart, DTDC integration
- **Pincode Validation**: 6-digit Indian postal code system
- **Currency**: INR-focused financial calculations

### Security Requirements

- **CORS Configuration**: Use `shared/lib/corsConfig.js` - production domains only
- **Rate Limiting**: API throttling with Redis store
- **SQL Injection Prevention**: Prisma ORM built-in protection
- **Password Security**: bcrypt hashing with 12 rounds
- **2FA Support**: TOTP-based two-factor authentication

### Git Workflow

- **Conventional Commits**: Enforced via commitlint
- **Pre-commit Hooks**: Husky + lint-staged (linting, formatting)
- **Smart Linting**: Only lint changed files for performance

### Never Do

- ❌ Use inline functions in routes (ALL logic in controllers)
- ❌ Write raw SQL queries (use Prisma only)
- ❌ Skip audit logging for CRUD operations
- ❌ Create endpoints without authentication
- ❌ Skip input validation with Joi
- ❌ Use custom response formats (use shared/lib/response.js)
- ❌ Mark task complete without Docker verification
- ❌ Ignore MODULE_NOT_FOUND or import errors

### Always Do

- ✅ Check `backend/auth-service/` patterns first (REFERENCE IMPLEMENTATION)
- ✅ Use controller methods for all business logic
- ✅ Include audit logging in all CRUD operations
- ✅ Validate all inputs with Joi schemas
- ✅ Use standard response formats from shared library
- ✅ Test Docker service restart after changes
- ✅ Verify health endpoint responds successfully
- ✅ Check Docker logs for any errors before marking complete
- ✅ Read `.cursor/rules/` for detailed development standards
- ✅ Update memory bank after significant changes

## Getting Help

- **Documentation**: See `docs/` directory for detailed specs
- **Architecture**: `docs/SystemArchitecture.md`
- **Development Roadmap**: `docs/DevelopmentRoadmap.md`
- **API Specs**: `docs/API-Specifications.md`
- **Development Standards**: `.cursor/rules/*.mdc` files

## Claude Code Sub-Agents

This project has **7 specialized AI agents** in `.claude/agents/` that provide expert assistance:

### Available Agents

| Agent                      | File                         | Use For                                                  |
| -------------------------- | ---------------------------- | -------------------------------------------------------- |
| 🏗️ Backend Service Builder | `backend-service-builder.md` | Creating/modifying microservices, Prisma, Docker         |
| ✅ Task Verifier           | `task-verifier.md`           | Verifying task completion, Docker testing, health checks |
| 👁️ Code Reviewer           | `code-reviewer.md`           | Code quality, security audits, standards compliance      |
| 🗄️ Database Manager        | `database-manager.md`        | Prisma schemas, migrations, query optimization           |
| 🎨 Frontend Developer      | `frontend-developer.md`      | Next.js components, React, TypeScript, Tailwind          |
| 📝 Documentation Updater   | `documentation-updater.md`   | Memory bank, task docs, API documentation                |
| 🔗 Integration Tester      | `integration-tester.md`      | End-to-end testing, service integrations                 |

### How to Use Agents

**Automatic (Claude chooses):**

```
"Create a new platform service"
```

**Explicit (you choose):**

```
"Use the task-verifier agent to check shipment service"
```

**Chained (multiple agents):**

```
"Build feature X, verify it, then document it"
```

### Agent Capabilities

Each agent:

- ✅ Knows project structure and patterns
- ✅ Follows auth-service reference implementation
- ✅ Enforces mandatory verification workflows
- ✅ Maintains documentation standards
- ✅ Has access to Read, Write, Edit, Bash tools

## Next Priorities

1. **SHIP-005**: Complete Shipment Service - Bulk operations, NDR management, label generation (2 days)
2. **PLAT-001**: Platform Service Foundation - Shopify OAuth integration (3 days)
3. **Frontend Integration**: Connect frontend with completed backend services
4. **Production Deployment**: Environment configuration and deployment scripts

---

**Last Updated**: January 2025
**Current Focus**: Comprehensive RBAC System Implementation (RBAC-001 to RBAC-007)
**Project Status**: 70% complete - Core services operational, RBAC system in progress, Platform & Support services pending
**AI Assistance**: 7 specialized agents + 6 auto-applying rules + dedicated RBAC guidelines
