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
- **Caching**: Redis 7+ for sessions, API responses, and performance
- **Authentication**: JWT with Redis sessions, RBAC with 5 roles (admin, finance, operations, client, support)
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
**Current Focus**: Shipment Service final phase (SHIP-005) and enhanced logging infrastructure
**Project Status**: 70% complete - Core services operational, Platform & Support services pending
**AI Assistance**: 7 specialized agents + 6 auto-applying rules
