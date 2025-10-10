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
pnpm run fresh:install   # Complete fresh installation
pnpm run setup:dev       # Auto-create .env files + install deps
pnpm run dev             # Start all services
```

### Service Management

```bash
pnpm run dev             # All services
pnpm run dev:detached    # Background mode
pnpm run dev:frontend    # Frontend + API Gateway only
pnpm run dev:backend     # Backend services + databases
docker-compose --profile [service-name] up
```

### Database Operations (Prisma)

```bash
pnpm run prisma:studio                                            # Visual DB browser
pnpm run prisma:generate                                          # Generate clients
docker-compose exec [service] npx prisma migrate dev --name ""    # Create migration
pnpm run migrate:deploy                                           # Deploy migrations
```

### Testing & Quality

```bash
pnpm run test            # All workspaces
pnpm run lint            # Lint all
pnpm run health          # Health checks
```

### Monitoring & Logs

```bash
pnpm run logs            # All services
pnpm run logs:[service]  # Specific service
pnpm run ps              # Running containers
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
│   ├── [other-services]/
│   └── api-gateway/
├── frontend/                  # Next.js 14 application
├── shared/                    # Shared utilities (CRITICAL)
│   └── lib/                # Logger, response, auth, errors
├── docs/                      # Project documentation
├── memory-bank/              # Project context files
├── .cursor/rules/            # Development standards
└── docker-compose.yml       # Service orchestration
```

### Shared Library Usage (CRITICAL)

**Import Path Rules:**

```javascript
// ✅ CORRECT: From controllers/routes/middleware/services
const logger = require("../shared/lib/logger");
const { APIResponse } = require("../shared/lib/response");

// ✅ CORRECT: From server.js only
const logger = require("./shared/lib/logger");
```

**Available Shared Libraries:**

- `shared/lib/logger.js` - Winston logger
- `shared/lib/response.js` - Standard API responses
- `shared/lib/auth.js` - JWT authentication middleware
- `shared/lib/errors.js` - Custom error classes
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
docker-compose restart service-name                              # 1. Restart
docker logs logistics-service-name --tail=30                     # 2. Check logs
docker logs logistics-service-name | grep "MODULE_NOT_FOUND"    # 3. Look for errors
curl http://localhost:PORT/health | jq .                         # 4. Test health
curl -X GET http://localhost:PORT/api/v1/endpoint                # 5. Test API
```

**If ANY verification fails, the task is NOT complete!**

### Service Communication Patterns

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

- **Partner Micro Service**: `https://calc.websiteduniya.com` - HMAC SHA-256 auth, 75+ endpoints
- **Wallet API**: `https://wapi.websiteduniya.com/api/v1` - HMAC SHA-256 auth, 14 endpoints

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

## RBAC System Implementation (11-Role Hierarchy)

### Overview

**Current Priority**: Comprehensive RBAC system with 11 roles, granular permissions, client/customer hierarchy, and license integration.

**Role Hierarchy**:

- **superadmin** - System owner (all permissions)
- **admin** - Platform administrator (manage clients, licenses, system config)
- **client** - License-based deployment customer (manage own customers, sub-users)
- **accounts/sales/support** - Client's team members (limited to client's scope)
- **customer** - Client's customer (manage own shipments)
- **customer_account/customer_sales/customer_support** - Customer's sub-users
- **affiliate** - Commission-based partner (referral tracking)

### RBAC Implementation Guidelines

#### 1. Permission System Constants (MANDATORY)

**Location**: `shared/constants/permissions.js`

```javascript
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

// Usage: {module}:{action}:{scope}
// Example: 'shipment:create:own', 'customer:read:assigned'
```

#### 2. Core Schema Models

**11-Role Enum** (auth-service):

```prisma
enum Role {
  superadmin admin client accounts sales support
  customer customer_account customer_sales customer_support affiliate
}
```

**Enhanced User Model** (auth-service):

```prisma
model User {
  id       String @id @default(uuid()) @db.Uuid
  email    String @unique @db.VarChar(255)
  password String
  role     Role   @default(customer)

  // RBAC Fields
  parentClientId      String?     @db.Uuid
  parentUserId        String?     @db.Uuid
  accessLevel         AccessLevel @default(LIMITED)
  assignedCustomerIds String[]    @db.Uuid
  licenseId           String?     @db.Uuid
  commissionRate      Decimal?    @db.Decimal(5, 2)

  // Relations
  rolePermissions RolePermission[]
  userPermissions UserPermission[]

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email, role, parentClientId, licenseId])
  @@map("users")
}

enum AccessLevel { FULL LIMITED READ_ONLY }
```

**Permission Models**:

```prisma
model Permission {
  id          String  @id @default(uuid()) @db.Uuid
  module      String  @db.VarChar(50)
  action      String  @db.VarChar(50)
  scope       String  @db.VarChar(50)
  description String
  isActive    Boolean @default(true)

  rolePermissions RolePermission[]
  userPermissions UserPermission[]

  @@unique([module, action, scope])
  @@index([module, isActive])
  @@map("permissions")
}

model RolePermission {
  id           String     @id @default(uuid()) @db.Uuid
  role         Role
  permissionId String     @db.Uuid
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([role, permissionId])
  @@map("role_permissions")
}

model UserPermission {
  id           String     @id @default(uuid()) @db.Uuid
  userId       String     @db.Uuid
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permissionId String     @db.Uuid
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  isGranted    Boolean    @default(true) // false = explicitly denied

  @@unique([userId, permissionId])
  @@map("user_permissions")
}
```

#### 3. Permission Checking Functions

**Location**: `shared/lib/auth.js`

```javascript
// Check if user has permission (with Redis caching)
async function checkPermission(user, module, action, scope = "all") {
  if (user.role === "superadmin") return true;

  const cacheKey = `perm:${user.id}:${module}:${action}:${scope}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === "true";

  const permissions = await getEffectivePermissions(user);
  const hasPermission = permissions.some(
    (p) =>
      (p.module === module || p.module === "*") &&
      (p.action === action || p.action === "*") &&
      (p.scope === scope || p.scope === "*" || scope === "*"),
  );

  await redis.setex(cacheKey, 300, hasPermission ? "true" : "false");
  return hasPermission;
}

// Get effective permissions (role + user overrides)
async function getEffectivePermissions(user) {
  // Fetch from cache or DB, merge role + user permissions
  // User permissions override role permissions
  // Cache for 5 minutes
}

// Invalidate permission cache
async function invalidatePermissionCache(userId) {
  await redis.del(`perms:${userId}`);
  const keys = await redis.keys(`perm:${userId}:*`);
  if (keys.length > 0) await redis.del(...keys);
}
```

#### 4. Permission Middleware

**Location**: `shared/middleware/requirePermission.js`

```javascript
function requirePermission(module, action, scope = "all") {
  return async (req, res, next) => {
    if (!req.user) throw new APIError("Unauthorized", 401);

    const hasPermission = await checkPermission(
      req.user,
      module,
      action,
      scope,
    );
    if (!hasPermission) {
      logger.warn(
        `Permission denied: ${req.user.email} attempted ${module}:${action}:${scope}`,
      );
      throw new APIError(`Insufficient permissions`, 403);
    }
    next();
  };
}

// Usage: router.post('/clients', requirePermission('client', 'create'), handler)
```

#### 5. Scope Filtering Utilities

**Location**: `shared/utils/scopeFilter.js`

```javascript
// Apply scope-based filtering to Prisma queries
function applyScopeFilter(user, scope, baseWhere = {}) {
  if (user.role === "superadmin" || scope === "*") return baseWhere;

  switch (scope) {
    case "own":
      return {
        ...baseWhere,
        OR: [{ userId: user.id }, { createdBy: user.id }],
      };
    case "parent":
      return {
        ...baseWhere,
        clientId: user.role === "client" ? user.id : user.parentClientId,
      };
    case "assigned":
      return {
        ...baseWhere,
        customerId: { in: user.assignedCustomerIds || [] },
      };
    case "all":
      // Return all within tenant scope
      return { ...baseWhere, clientId: user.parentClientId || user.id };
    default:
      return baseWhere;
  }
}
```

#### 6. Cache Invalidation Strategy (CRITICAL)

**ALWAYS invalidate permission cache when:**

```javascript
// 1. User role changes
await invalidatePermissionCache(userId);

// 2. User permissions modified
await invalidatePermissionCache(userId);

// 3. Role permissions change (invalidate ALL users with that role)
const users = await prisma.user.findMany({
  where: { role },
  select: { id: true },
});
for (const user of users) await invalidatePermissionCache(user.id);

// 4. Assigned customers change
await invalidatePermissionCache(userId);
```

### RBAC Implementation Checklist

**BEFORE starting**:

- [ ] Read RBAC section in `backend/BACKEND_TASK.md`
- [ ] Understand 11-role hierarchy
- [ ] Study auth-service reference implementation

**DURING implementation**:

- [ ] Create `shared/constants/permissions.js` FIRST
- [ ] Update schemas with UUID (NOT CUID)
- [ ] Test migrations in Docker
- [ ] Add cache invalidation to ALL permission-modifying functions
- [ ] Apply scope filtering to ALL list/read operations
- [ ] Add RBAC tests (minimum 80% coverage)
- [ ] Verify Docker service restart after changes

**AFTER completion**:

- [ ] Run full test suite
- [ ] Test permission checks with different roles
- [ ] Verify cache invalidation
- [ ] Use task-verifier agent for final verification

### RBAC-Specific Never Do

- ❌ Hardcode permission strings
- ❌ Skip cache invalidation after role/permission changes
- ❌ Use CUID (always UUID with `@db.Uuid`)
- ❌ Mark task complete without integration tests
- ❌ Skip rollback testing for migrations

### RBAC-Specific Always Do

- ✅ Create permission constants FIRST
- ✅ Use database-manager agent for schema changes
- ✅ Test migrations: `docker-compose exec auth-service npx prisma migrate status`
- ✅ Invalidate cache when roles/permissions change
- ✅ Apply scope filtering to ALL data access
- ✅ Add comprehensive tests (80%+ coverage)

## Memory Bank System

**READ THESE at the start of EVERY session:**

1. `memory-bank/projectbrief.md` - Project vision, scope
2. `memory-bank/productContext.md` - Business problems and solutions
3. `memory-bank/systemPatterns.md` - Architecture decisions
4. `memory-bank/techContext.md` - Technologies and tools
5. `memory-bank/activeContext.md` - Current work focus
6. `memory-bank/progress.md` - Build status

## Important Notes

### India-Specific Features

- **GST Compliance**: 18% tax calculations
- **Local Couriers**: Delhivery, Blue Dart, DTDC integration
- **Pincode Validation**: 6-digit Indian postal codes
- **Currency**: INR-focused

### Security Requirements

- **CORS**: Use `shared/lib/corsConfig.js`
- **Rate Limiting**: Redis-based throttling
- **Password Security**: bcrypt hashing (12 rounds)
- **2FA Support**: TOTP-based

### Never Do

- ❌ Use inline functions in routes
- ❌ Write raw SQL (use Prisma only)
- ❌ Skip audit logging for CRUD
- ❌ Create endpoints without authentication
- ❌ Skip input validation
- ❌ Mark task complete without Docker verification

### Always Do

- ✅ Check `backend/auth-service/` patterns first
- ✅ Use controller methods for business logic
- ✅ Include audit logging
- ✅ Validate inputs with Joi
- ✅ Use standard response formats
- ✅ Test Docker service restart
- ✅ Verify health endpoint
- ✅ Check logs before marking complete

## Claude Code Sub-Agents

7 specialized AI agents in `.claude/agents/`:

| Agent                      | Use For                         |
| -------------------------- | ------------------------------- |
| 🏗️ Backend Service Builder | Microservices, Prisma, Docker   |
| ✅ Task Verifier           | Task completion, Docker testing |
| 👁️ Code Reviewer           | Code quality, security audits   |
| 🗄️ Database Manager        | Prisma schemas, migrations      |
| 🎨 Frontend Developer      | Next.js, React, TypeScript      |
| 📝 Documentation Updater   | Memory bank, API docs           |
| 🔗 Integration Tester      | End-to-end testing              |

### How to Use Agents

- **Automatic**: "Create a new platform service"
- **Explicit**: "Use the task-verifier agent to check shipment service"
- **Chained**: "Build feature X, verify it, then document it"

## Next Priorities

1. **RBAC-001 to RBAC-007**: Complete comprehensive RBAC system
2. **SHIP-005**: Complete Shipment Service - Bulk operations
3. **PLAT-001**: Platform Service Foundation - Shopify integration
4. **Frontend Integration**: Connect frontend with backend services

---

**Last Updated**: January 2025
**Current Focus**: Comprehensive RBAC System Implementation (RBAC-001 to RBAC-007)
**Project Status**: 70% complete - Core services operational, RBAC in progress
**AI Assistance**: 7 specialized agents + 6 auto-applying rules + dedicated RBAC guidelines
