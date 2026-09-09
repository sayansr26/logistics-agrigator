# CLAUDE.md - Logistics Aggregator Portal

> Claude Code Configuration v2.0 | Last Updated: January 2025
> Essential context and guidelines for Claude Code when working with this codebase

## 🎯 Memory Bank Protocol (MANDATORY)

**CRITICAL**: Read ALL memory bank entries at session start. They contain the complete project context and are the single source of truth.

The memory bank lives in **Serena memories** (`.serena/memories/`, read via the
`mcp__serena__read_memory` tool by name — no `.md` extension). It was migrated
out of the old top-level `memory-bank/` directory; that path no longer exists.

### Core Memory Entries (Read in Exact Order)

```
.serena/memories/
├── projectbrief.md      # Vision, scope, requirements
├── productContext.md    # Business problems & solutions
├── systemPatterns.md    # Architecture & design patterns
├── techContext.md       # Technologies & tools
├── activeContext.md     # Current focus & priorities
└── progress.md          # Development status & changelog
```

### Session Start Checklist

```
# MANDATORY: Execute in this exact sequence
1. mcp__serena__read_memory("projectbrief")     # Core requirements
2. mcp__serena__read_memory("productContext")   # Business context
3. mcp__serena__read_memory("systemPatterns")   # Architecture
4. mcp__serena__read_memory("techContext")      # Tech stack
5. mcp__serena__read_memory("activeContext")    # Current work
6. mcp__serena__read_memory("progress")         # Latest status

# If the Serena MCP server is unavailable, read the files directly:
#   cat .serena/memories/projectbrief.md   (etc.)
```

**Writing back**: use `mcp__serena__write_memory` / `mcp__serena__edit_memory`
(or edit the file under `.serena/memories/` directly). `activeContext` and
`progress` are the two that change most often. `.serena/memories/` is tracked
in git — commit memory updates alongside the code change they describe.

## Project Overview

**Logistics Aggregator Portal** - Multi-tenant B2B/B2C logistics platform for Indian e-commerce with white-label capabilities and 75+ courier integrations.

### Current Sprint Focus

🔒 **CRITICAL**: API Gateway Security & 11-Role RBAC Implementation (See: `docs/PRD_API_GATEWAY_RBAC.md`)

- Phase 1: Service isolation via API Gateway
- Phase 2: Granular permission system
- Phase 3: Frontend Redux/RTK migration
- Phase 4: 100% Swagger documentation

### Service Architecture & Status

| Service              | Port | Path                        | Status        | Completion | Next Task           |
| -------------------- | ---- | --------------------------- | ------------- | ---------- | ------------------- |
| **API Gateway**      | 3001 | `backend/api-gateway/`      | 🔄 Upgrading  | 60%        | RBAC integration    |
| **Auth Service**     | 3002 | `backend/auth-service/`     | ✅ Production | 100%       | Reference standard  |
| **User Service**     | 3003 | `backend/user-service/`     | ✅ Production | 100%       | Stable              |
| **Shipment Service** | 3004 | `backend/shipment-service/` | 🔄 Active     | 90%        | Bulk operations     |
| **Partner Service**  | 3005 | `backend/partner-service/`  | ✅ Complete   | 100%       | Stable              |
| **Wallet Service**   | 3006 | `backend/wallet-service/`   | ✅ Complete   | 100%       | Stable              |
| **License Service**  | 3009 | `backend/license-service/`  | 🆕 New        | 30%        | Integration pending |
| **Support Service**  | 3007 | `backend/support-service/`  | ❌ Pending    | 0%         | Not started         |
| **Platform Service** | 3008 | `backend/platform-service/` | ❌ Pending    | 0%         | Shopify next        |
| **Frontend**         | 3000 | `frontend/`                 | 🔄 Migrating  | 40%        | Redux/RTK Query     |

## Shell Rules (CRITICAL)

**`builtin cd`**: The shell uses zoxide which overrides `cd`. Always use `builtin cd` when changing directories in Bash commands.

**`builtin` is ONLY for `cd`**: NEVER prefix any other command with `builtin`. Commands like `yarn`, `docker-compose`, `node`, `npm`, etc. must be run directly without `builtin`.

```bash
# ✅ CORRECT
builtin cd /path/to/dir
yarn run build
docker restart logistics-frontend

# ❌ WRONG — will fail with "no such builtin"
builtin yarn run build
builtin docker restart logistics-frontend
```

## Quick Start Commands

```bash
# Initial Setup
yarn run fresh:install          # Complete fresh installation
yarn run setup:dev              # Auto-create .env files + dependencies

# Development
yarn run dev                    # Start all services
yarn run dev:frontend           # Frontend + API Gateway only
yarn run dev:backend            # Backend services only

# Docker Management
docker-compose ps               # View running containers
docker-compose logs [service]   # View service logs
docker-compose restart [service] # Restart specific service

# Database Operations
yarn run prisma:studio          # Visual database browser
yarn run prisma:generate        # Generate Prisma clients
yarn run migrate:deploy         # Deploy migrations

# Testing & Validation
yarn run test                   # Run all tests
yarn run lint                   # Lint all code
yarn run health                 # Health check all services
```

## Architecture Patterns

### Technology Stack

- **Runtime**: Node.js 18+ with Express.js microservices
- **Database**: PostgreSQL 15+ with Prisma ORM (database-per-service)
- **Cache**: Redis 7+ for sessions, permissions, API responses
- **Auth**: JWT with Redis sessions, 11-role RBAC system
- **Frontend**: Next.js 14, TypeScript, Tailwind, Redux Toolkit + RTK Query
- **Package Manager**: yarn monorepo workspace
- **Container**: Docker with Docker Compose orchestration

## Project Structure

### Backend Services

```
backend/
├── api-gateway/         # Central routing, security, RBAC
├── auth-service/        # ⭐ REFERENCE IMPLEMENTATION
│   ├── prisma/         # Schema, migrations, seeds
│   ├── controllers/    # Business logic (NEVER inline)
│   ├── middleware/     # Auth, validation, errors
│   ├── routes/         # API endpoints only
│   └── config/         # DB, Redis, Swagger
├── user-service/        # Multi-tenant users & customers
├── shipment-service/    # Shipments, tracking, NDR
├── partner-service/     # 75+ courier integrations
├── wallet-service/      # Payments, transactions
├── license-service/     # License management (NEW)
├── platform-service/    # E-commerce integrations
└── support-service/     # Tickets, disputes
```

### Frontend Application

```
frontend/
├── src/
│   ├── app/            # Next.js 14 app router pages
│   │   ├── auth/       # Login, registration
│   │   ├── dashboard/  # Main dashboard
│   │   ├── shipments/  # Shipment management
│   │   ├── partners/   # Partner management
│   │   ├── wallet/     # Wallet & transactions
│   │   └── users/      # User management
│   ├── components/     # React components
│   ├── services/       # API service layer
│   ├── store/          # Zustand stores (migrating to Redux)
│   └── hooks/          # Custom React hooks
```

### Shared Resources

```
shared/
├── constants/
│   └── permissions.js   # RBAC permission definitions
└── lib/
    ├── auth.js         # JWT & permission middleware
    ├── response.js     # Standard API responses
    ├── logger.js       # Winston logging
    ├── redis.js        # Redis client config
    ├── database.js     # Prisma helpers
    └── errors.js       # Custom error classes
```

### Documentation & Tasks

```
docs/
├── PRD_API_GATEWAY_RBAC.md           # Current sprint PRD
├── RBAC-*.md                         # RBAC implementation docs
├── API-Specifications.md             # API documentation
└── SystemArchitecture.md             # System design

backend/
├── BACKEND_TASK.md                   # General backend tasks
├── BACKEND_GATEWAY_TASK.md           # API Gateway tasks
├── BACKEND_AUTH_TASK.md              # Auth service tasks
├── BACKEND_SHIPMENT_TASK.md          # Shipment tasks
├── PARTNER_SERVICE_TASK.md           # Partner tasks
└── USER_SERVICE_TASK.md              # User tasks

frontend/
└── FRONTEND_ARCHITECTURE_TASK.md     # Frontend migration tasks
```

## Critical Development Rules

### ⚠️ MANDATORY - NO EXCEPTIONS, NO BYPASSING

These rules are ABSOLUTE. Violating any rule means task failure. Use the appropriate agents to ensure compliance.

### 1. Controller Pattern (MANDATORY - Use `backend-service-builder` agent)

```javascript
// ✅ CORRECT - Business logic in controller
// routes/users.js
router.post('/users', validateInput, userController.create);

// controllers/userController.js
async create(req, res) {
  // Business logic here
}

// ❌ NEVER - Inline functions in routes (AUTOMATIC FAILURE)
router.post('/users', async (req, res) => {
  // NEVER put logic here - NO EXCEPTIONS
});
```

### 2. Prisma ORM Only (Use `database-manager` agent)

```javascript
// ✅ CORRECT - Type-safe Prisma
const user = await prisma.user.findUnique({
  where: { id },
});

// ❌ NEVER - Raw SQL (AUTOMATIC FAILURE)
const user = await db.query("SELECT * FROM users WHERE id = ?");
```

### 3. Audit Logging (ALL CRUD - Use `task-verifier` agent to confirm)

```javascript
// REQUIRED for EVERY create, update, delete operation
await prisma.auditLog.create({
  data: {
    userId: req.user.id,
    action: "CREATE",
    resource: "shipment",
    resourceId: newShipment.id,
    changes: diffData,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  },
});
// Missing audit log = TASK INCOMPLETE
```

### 4. Shared Library Imports (NO ALTERNATIVES)

```javascript
// From controllers/routes/middleware - ONLY THIS WAY:
const logger = require("../shared/lib/logger");
const { APIResponse } = require("../shared/lib/response");

// From server.js only:
const logger = require("./shared/lib/logger");
```

### 5. Agent Usage (MANDATORY FOR TASKS)

- **Creating/Modifying Services**: MUST use `backend-service-builder` agent
- **Schema Changes**: MUST use `database-manager` agent
- **Code Quality**: MUST use `code-reviewer` agent before completion
- **Task Completion**: MUST use `task-verifier` agent
- **Frontend Work**: MUST use `frontend-developer` agent
- **Documentation**: MUST use `documentation-updater` agent

### 6. API Testing with curl (MANDATORY BEFORE UI)

**CRITICAL**: ALWAYS test backend APIs with curl BEFORE updating or adding UI components

```bash
# REQUIRED WORKFLOW FOR ANY API WORK:

# 1. Test the API endpoint with curl FIRST
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Verify response is correct (200/201 status, valid JSON)
# 3. Test with invalid data to verify error handling
# 4. Test with missing authentication to verify security
# 5. ONLY THEN update or create UI components

# Common API Testing Patterns:
# GET request:
curl http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN"

# POST with authentication:
curl -X POST http://localhost:3001/api/v1/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"field":"value"}'

# PUT/PATCH request:
curl -X PUT http://localhost:3001/api/v1/users/123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"field":"newvalue"}'

# DELETE request:
curl -X DELETE http://localhost:3001/api/v1/users/123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Why This Rule Exists:**

- Prevents building UI for broken APIs
- Catches backend issues early (missing tables, wrong endpoints, auth errors)
- Saves time by testing at API level first
- Ensures API contract matches UI expectations
- Verifies authentication and authorization work correctly

**Example Failure Prevented:**

- User complained login UI not working
- Investigation revealed `users` table didn't exist in database
- Should have been caught with curl test BEFORE updating UI
- Lesson: Test API → Fix backend → Then update UI

⚠️ **NEVER update UI for an API you haven't tested with curl first**
⚠️ **Backend API must work perfectly before frontend work begins**

## Verification Protocol (MANDATORY - NO BYPASSING)

**Task is NOT complete without ALL verifications passing. Use `task-verifier` agent to ensure compliance.**

```bash
# 0. Pre-verification - Check agent usage
echo "Did you use the appropriate agents for this task? (Y/N)"
echo "- backend-service-builder for service changes?"
echo "- database-manager for schema changes?"
echo "- code-reviewer for quality checks?"

# 1. Restart service (REQUIRED)
docker-compose restart [service-name]

# 2. Check logs (MUST BE ERROR-FREE)
docker logs logistics-[service-name] --tail=50
# Any errors = TASK INCOMPLETE

# 3. Verify no module errors (ZERO TOLERANCE)
docker logs logistics-[service-name] | grep "MODULE_NOT_FOUND"
# Should return nothing - ANY result = FAILURE

# 4. Test health endpoint (MUST RETURN 200)
curl http://localhost:[PORT]/health | jq .
# Should return {"status": "healthy"}

# 5. Test actual endpoint (MUST WORK WITH AUTH)
curl -X GET http://localhost:[PORT]/api/v1/[endpoint]
# Should return expected response

# 6. Rule Compliance Check (MANDATORY)
echo "Verify ALL rules followed:"
echo "✓ Controller pattern used (no inline handlers)"
echo "✓ Prisma ORM only (no raw SQL)"
echo "✓ Audit logging included for CRUD"
echo "✓ Input validation with Joi"
echo "✓ UUID format with @db.Uuid"
echo "✓ Shared libraries imported correctly"
echo "✓ Auth middleware applied"
echo "✓ Error handling implemented"

⚠️ IF ANY STEP FAILS = TASK INCOMPLETE
⚠️ IF ANY RULE VIOLATED = AUTOMATIC FAILURE
⚠️ NO EXCEPTIONS, NO BYPASSING
```

### Frontend Verification Protocol (MANDATORY)

**CRITICAL**: After ANY frontend changes, MUST run build to verify no breakage

```bash
# Frontend Verification (REQUIRED after EVERY task)
cd frontend

# 1. Run build (MUST SUCCEED or identify PRE-EXISTING errors)
yarn run build

# Build Success Criteria:
# ✅ "Compiled successfully" appears
# ✅ Linting errors ONLY in pre-existing files (not your changes)
# ❌ Compilation errors in your new files = FAIL
# ❌ Module not found errors = FAIL

# 2. Restart frontend container (REQUIRED after successful build)
docker-compose restart frontend

# This is CRITICAL because:
# - Next.js build creates optimized production assets
# - Container needs to reload the new build artifacts
# - Without restart, users see old/cached version
# - Changes won't be visible until container restart

# 3. If build fails on YOUR files:
#    - Fix ESLint/TypeScript errors immediately
#    - Re-run build until success
#    - NEVER commit broken code

# 4. Document pre-existing errors:
#    - Note which OLD files have errors
#    - These will be fixed in future tasks
#    - Your task only needs YOUR files working

⚠️ FRONTEND STOPPED WORKING = IMMEDIATE FIX REQUIRED
⚠️ NO EXCEPTIONS - BUILD MUST PASS FOR YOUR CODE
⚠️ PRE-EXISTING ERRORS ARE ACCEPTABLE IF DOCUMENTED
⚠️ ALWAYS RESTART FRONTEND AFTER SUCCESSFUL BUILD
```

### Rule Violation = Automatic Failure

- Inline route handler found → FAIL
- Raw SQL query found → FAIL
- Missing audit log → FAIL
- No input validation → FAIL
- Wrong ID format → FAIL
- Skipped verification → FAIL
- Agent not used → FAIL
- UI updated without testing API with curl first → FAIL

## Common Pitfalls (AVOID AT ALL COSTS)

### ❌ Developer Mistakes That Cause Immediate Failure

1. **"I'll just quickly add logic in the route"**
   - NO! Always use controllers, NO EXCEPTIONS
   - Use `backend-service-builder` agent to create proper structure

2. **"Raw SQL is faster for this query"**
   - NO! Always use Prisma ORM, NO EXCEPTIONS
   - Use `database-manager` agent for complex queries

3. **"I'll add audit logging later"**
   - NO! Audit logging is REQUIRED at implementation time
   - Missing audit = incomplete task

4. **"The old pattern works fine"**
   - NO! Follow auth-service patterns EXACTLY
   - Check `backend/auth-service/` for reference

5. **"I don't need to test in Docker"**
   - NO! Docker verification is MANDATORY
   - Use `task-verifier` agent to ensure all checks pass

6. **"I can skip the agent for this simple task"**
   - NO! Agents are MANDATORY for their domains
   - They ensure compliance and quality

7. **"CUID is basically the same as UUID"**
   - NO! Use UUID with @db.Uuid ONLY
   - Wrong format = migration failures

8. **"I'll test the API after updating the UI"**
   - NO! ALWAYS test API with curl FIRST
   - Backend must work before frontend work begins
   - Prevents wasting time on UI for broken APIs

### ✅ Correct Approach (ALWAYS)

1. **Read memory bank** → Understand context
2. **Use appropriate agent** → Ensure compliance
3. **Test API with curl** → Verify backend works first
4. **Follow auth-service patterns** → Maintain consistency
5. **Implement with rules** → No shortcuts
6. **Run verification protocol** → All steps must pass
7. **Update documentation** → Keep memory bank current

## 11-Role RBAC System

### Role Hierarchy

```
superadmin              # System owner (all permissions)
├── admin              # Platform administrator
├── client             # License holder
│   ├── accounts       # Finance team
│   ├── sales         # Sales team
│   └── support       # Support team
├── customer          # End user
│   ├── customer_account
│   ├── customer_sales
│   └── customer_support
└── affiliate         # Commission partner
```

### Permission Format

```javascript
// {module}:{action}:{scope}
"shipment:create:own"; // Own shipments only
"customer:read:assigned"; // Assigned customers
"wallet:manage:all"; // All in tenant
"*:*:*"; // Superadmin only
```

### RBAC Implementation Checklist

- [ ] Use UUID format: `@db.Uuid` (NOT CUID)
- [ ] Include audit logging model
- [ ] Implement Redis caching (5 min TTL)
- [ ] Invalidate cache on changes
- [ ] Apply scope filtering
- [ ] Test with different roles

## Database Patterns

### Mandatory Schema Fields

```prisma
model AnyModel {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("table_name") // snake_case
}

// REQUIRED in every service
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

  @@index([userId, resource, createdAt])
  @@map("audit_logs")
}
```

## External Integrations

### Partner API

- **URL**: https://calc.websiteduniya.com
- **Auth**: HMAC SHA-256
- **Endpoints**: 75+ courier integrations

### Wallet API

- **URL**: https://wapi.websiteduniya.com/api/v1
- **Auth**: HMAC SHA-256
- **Endpoints**: 14 payment operations

## India-Specific Features

- **GST**: 18% tax with GSTIN validation
- **Couriers**: Delhivery, Blue Dart, DTDC, Ecom Express
- **Pincode**: 6-digit validation with serviceability
- **Currency**: INR only (₹)
- **Phone**: +91 format validation

## Available Scripts & Tools

### Development Scripts

```bash
scripts/
├── setup.sh                    # Initial project setup
├── cleanup.sh                  # Docker cleanup
├── backup-database.sh          # Database backup
├── deploy-production.sh        # Production deployment
├── deploy-server.sh           # Server deployment
├── fix-all-permissions.sh     # Fix file permissions
├── fix-server-modules.sh      # Fix node modules on server
├── init-databases.sql         # Initialize all databases
└── setup-production-env.sh    # Production environment setup
```

### Docker Compose Files

```yaml
docker-compose.yml              # Main development compose
docker-compose.backend.yml      # Backend services only
docker-compose.frontend.yml     # Frontend services only
docker-compose.production.yml   # Production configuration
```

### Claude Code Agents (`.claude/agents/`)

| Agent                   | Purpose              | Usage Example                        |
| ----------------------- | -------------------- | ------------------------------------ |
| backend-service-builder | Create microservices | "Build license service endpoints"    |
| task-verifier           | Verify completion    | "Verify shipment service tasks"      |
| code-reviewer           | Code quality audit   | "Review partner service code"        |
| database-manager        | Schema & migrations  | "Update wallet schema for refunds"   |
| frontend-developer      | React/Next.js        | "Create shipment tracking component" |
| documentation-updater   | Update docs          | "Update memory bank with progress"   |
| integration-tester      | E2E testing          | "Test complete order flow"           |
| api-tester              | curl-test endpoints  | "Test the bulk create endpoint"      |
| docker-orchestrator     | Container vs host    | "Run the auth-service migration"     |
| orchestrator            | Multi-domain tasks   | "Add refunds with UI and docs"       |
| plan-executor           | Execute cursor plans | "Execute .cursor/plans/rbac.md"      |

### Claude Code Skills (`.claude/skills/`)

| Skill            | Purpose                                        | Invocation                                 |
| ---------------- | ---------------------------------------------- | ------------------------------------------ |
| `verify-service` | Run the mandatory Docker verification protocol | either                                     |
| `release`        | Build/push to GHCR and deploy prod or UAT      | **user only** — never invoked by the model |

```bash
.claude/skills/verify-service/scripts/verify.sh shipment   # restart, logs, health, endpoint
```

### Claude Code Hooks (`.claude/settings.json`)

| Hook                     | Event       | Effect                                                                                                                                             |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `block-env-access.py`    | PreToolUse  | **Denies** reading/editing `.env`, `.env.production`, `.env.uat`, `backend/*/.env`. `*.example` files are allowed.                                 |
| `check-route-pattern.py` | PostToolUse | Flags inline `(req, res)` handlers written into `backend/*/routes/*.js` — the controller-pattern rule, enforced structurally rather than by prose. |

`.claude/settings.local.json` is personal and untracked; `.claude/settings.json`
is the shared config and both are merged.

### MCP Servers (`.mcp.json`)

| Server      | Purpose                                                            |
| ----------- | ------------------------------------------------------------------ |
| `logistics` | This repo's own `mcp-server/` — the External Shipment API as tools |
| `context7`  | Version-accurate docs for Prisma 5, Next 14, RTK, Express          |

`logistics` reads `LOGISTICS_CLIENT_ID` / `LOGISTICS_CLIENT_SECRET` from the
shell environment — they are **not** stored in `.mcp.json`, which is tracked in a
public repo. Export them in your shell (see `mcp-server/README.md`).

## Active PRDs

- **[API Gateway & RBAC](./docs/PRD_API_GATEWAY_RBAC.md)**
  - Status: In Development
  - Priority: P0 (Critical)
  - Timeline: 2 weeks
  - Impact: All services

## Common Issues & Solutions

### Never Do

❌ Inline route handlers (use controllers)
❌ Raw SQL (use Prisma ORM)
❌ Skip audit logging (compliance required)
❌ Hardcode secrets (use env vars)
❌ Use CUID (always UUID)
❌ Mark complete without Docker verification

### Always Do

✅ Check auth-service patterns first
✅ Test in Docker before completion
✅ Include error handling
✅ Write tests (80% coverage)
✅ Update memory bank after changes
✅ Invalidate cache after permission updates

## Development Workflow

### 1. Start Session

```
# Read memory bank entries first (Serena memories)
mcp__serena__read_memory("projectbrief")
mcp__serena__read_memory("productContext")
mcp__serena__read_memory("activeContext")
mcp__serena__read_memory("systemPatterns")
mcp__serena__read_memory("techContext")
mcp__serena__read_memory("progress")
```

### 2. Implement Feature

```bash
# Plan first
Review the activeContext memory
Create implementation plan
Ask clarifying questions

# Implement
Follow auth-service patterns
Use controller pattern
Include audit logging
Add input validation

# Verify
Run verification protocol
Test with Docker
Check health endpoints
```

### 3. Update Documentation

```
# Update relevant memory bank entries (mcp__serena__write_memory / edit_memory)
Update the progress memory with changes
Update the activeContext memory with new focus
Update the systemPatterns memory if new patterns
```

## Success Criteria

Task is complete when:

- [ ] Code follows established patterns
- [ ] Docker service restarts without errors
- [ ] Health endpoint returns 200 OK
- [ ] API endpoints work with auth
- [ ] Tests pass with >80% coverage
- [ ] Memory bank is updated
- [ ] No MODULE_NOT_FOUND errors

---

**REMEMBER**:

1. **ALWAYS** read memory bank files at session start
2. **ALWAYS** test APIs with curl BEFORE updating/creating UI
3. **ALWAYS** use available agents in `.claude/agents/` for specialized tasks (they can work in parallel)
4. **NEVER** skip Docker verification protocol - ALL steps must pass
5. **NEVER** bypass any rules or patterns - follow auth-service as reference
6. **ALWAYS** use controller pattern - NO inline route handlers ever
7. **ALWAYS** include audit logging for ALL CRUD operations
8. **ALWAYS** use Prisma ORM - NO raw SQL queries
9. **ALWAYS** validate inputs with Joi schemas
10. **ALWAYS** use UUID format with @db.Uuid
11. Quality > Speed for production system

**Available Agents (USE THEM):**

- `backend-service-builder` - For creating/modifying services
- `task-verifier` - For verifying task completion
- `code-reviewer` - For code quality checks
- `database-manager` - For schema and migration changes
- `frontend-developer` - For React/Next.js components
- `documentation-updater` - For updating memory bank
- `integration-tester` - For E2E testing

**Current Focus**: API Gateway Security & RBAC Implementation (P0)
**Next Priority**: Complete Shipment Service bulk operations
**Reference**: Check `backend/auth-service/` for patterns - NO EXCEPTIONS
