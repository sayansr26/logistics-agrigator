# System Patterns - Logistics Aggregator Portal

> Architecture and design patterns | Last Updated: January 24, 2026

## Architecture Overview

### Microservices Architecture

```
                                    ┌─────────────────┐
                                    │   Frontend      │
                                    │   (Next.js 14)  │
                                    │   Port: 3000    │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   API Gateway   │
                                    │   Port: 3001    │
                                    │   (Express.js)  │
                                    └────────┬────────┘
                                             │
          ┌──────────────┬──────────────┬────┴────┬──────────────┬──────────────┐
          ▼              ▼              ▼         ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │   Auth   │  │   User   │  │ Shipment │  │ Partner  │  │  Wallet  │  │ License  │
    │  :3002   │  │  :3003   │  │  :3004   │  │  :3005   │  │  :3006   │  │  :3009   │
    └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
         │              │              │              │              │              │
    ┌────▼─────────────▼──────────────▼──────────────▼──────────────▼──────────────▼────┐
    │                              PostgreSQL Databases                                   │
    │    logistics_auth | logistics_users | logistics_shipments | logistics_wallet | ... │
    └───────────────────────────────────────────────────────────────────────────────────┘
                                             │
                              ┌──────────────┴──────────────┐
                              │           Redis              │
                              │    Sessions | Cache | Queue  │
                              └──────────────────────────────┘
```

### Service Responsibilities

| Service          | Port | Database            | Primary Functions                         |
| ---------------- | ---- | ------------------- | ----------------------------------------- |
| API Gateway      | 3001 | -                   | Routing, rate limiting, auth verification |
| Auth Service     | 3002 | logistics_auth      | JWT auth, RBAC, sessions                  |
| User Service     | 3003 | logistics_users     | Users, customers, KYC                     |
| Shipment Service | 3004 | logistics_shipments | Orders, tracking, NDR                     |
| Partner Service  | 3005 | logistics_partners  | Courier integration, rates                |
| Wallet Service   | 3006 | logistics_wallet    | Transactions, balance                     |
| License Service  | 3009 | logistics_license   | License management                        |
| Support Service  | 3007 | logistics_support   | Tickets, disputes                         |
| Platform Service | 3008 | logistics_platform  | E-commerce integrations                   |

## Design Patterns

### 1. Controller Pattern (MANDATORY)

**All business logic MUST be in controller classes. No inline functions in routes.**

```javascript
// ✅ CORRECT: Controller handles business logic
// routes/users.js
router.post('/users',
  authMiddleware.authenticate,
  validate(userSchema),
  UserController.create
);

// controllers/userController.js
class UserController {
  static async create(req, res) {
    // All business logic here
    const user = await prisma.user.create({...});
    await prisma.auditLog.create({...});
    res.json(APIResponse.success(user));
  }
}

// ❌ FORBIDDEN: Inline handlers
router.post('/users', async (req, res) => {
  // NEVER put logic here
});
```

### 2. Database-Per-Service Pattern

Each microservice has its own PostgreSQL database:

```
PostgreSQL Server
├── logistics_auth        # Auth service only
├── logistics_users       # User service only
├── logistics_shipments   # Shipment service only
├── logistics_partners    # Partner service only
├── logistics_wallet      # Wallet service only
└── logistics_license     # License service only
```

### 3. Shared Library Pattern

Common utilities centralized in `/shared/`:

```
shared/
├── lib/
│   ├── auth.js        # JWT & permission middleware
│   ├── response.js    # Standard API response format
│   ├── logger.js      # Winston structured logging
│   ├── redis.js       # Redis client configuration
│   ├── database.js    # Prisma helpers
│   ├── errors.js      # Custom error classes
│   └── validation.js  # Joi validation helpers
├── constants/
│   └── permissions.js # RBAC permission definitions
└── index.js           # Module exports
```

**Import Pattern:**

```javascript
// From controllers/routes/middleware:
const logger = require("../shared/lib/logger");

// From server.js (root):
const logger = require("./shared/lib/logger");
```

### 4. API Response Pattern

All endpoints use standardized response format:

```javascript
// Success Response
{
  "status": "success",
  "data": { /* response payload */ },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "service": "user-service",
    "requestId": "uuid"
  }
}

// Error Response
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [...]
  },
  "meta": { ... }
}
```

### 5. Audit Logging Pattern

**MANDATORY for all CRUD operations:**

```javascript
await prisma.auditLog.create({
  data: {
    userId: req.user.id,
    action: "CREATE", // CREATE, UPDATE, DELETE, VIEW, LIST, etc.
    resource: "shipment", // Table/entity name
    resourceId: newEntity.id, // ID of affected record
    changes: diffData, // What changed (JSON)
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  },
});
```

**Action Naming Standard (UPPERCASE_WITH_UNDERSCORES):**

All audit actions must follow the `UPPERCASE_WITH_UNDERSCORES` format and use centralized constants:

```javascript
// ✅ CORRECT - Use constants from shared/constants/auditActions.js
const {
  CREATE,
  UPDATE,
  DELETE,
  VIEW_PROFILE,
  VERIFY_PROFILE,
} = require("../../shared/constants/auditActions");

await prisma.auditLog.create({
  data: {
    action: CREATE_PROFILE, // "CREATE_PROFILE"
    resource: "UserProfile",
    // ...
  },
});

// ❌ WRONG - Do not use lowercase or past tense
await prisma.auditLog.create({
  data: {
    action: "create_profile", // ❌ Lowercase
    action: "PROFILE_CREATED", // ❌ Past tense
    // ...
  },
});
```

**Available Action Categories:**

| Category | Example Actions                                             |
| -------- | ----------------------------------------------------------- |
| CRUD     | CREATE, UPDATE, DELETE, VIEW, LIST, GET                     |
| AUTH     | LOGIN, LOGOUT, TOKEN_REFRESH, LOGOUT_ALL_DEVICES            |
| USER     | CREATE_USER, UPDATE_USER, DELETE_USER, ACTIVATE_USER        |
| PROFILE  | CREATE_PROFILE, UPDATE_PROFILE, VERIFY_PROFILE, GET_PROFILE |
| CLIENT   | CREATE_CLIENT, UPDATE_CLIENT, GET_CLIENT_STATS              |
| OUTLET   | CREATE_OUTLET, UPDATE_OUTLET, RESET_OUTLET_PASSWORD         |
| SHIPMENT | CREATE, CANCEL, TRACK, CALCULATE_RATES, SCHEDULE_PICKUP     |
| PARTNER  | CREATE_PARTNER, UPDATE_PARTNER, DELETE_PARTNER              |
| WALLET   | DEBIT_WALLET, CREDIT_WALLET, REQUEST_PAYOUT                 |
| LICENSE  | GENERATE_LICENSE, REVOKE_LICENSE, VALIDATE_LICENSE          |

**Full Reference:** `shared/constants/auditActions.js`

### 6. Authentication Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │────▶│ API Gateway │────▶│ Auth Service│────▶│   Redis     │
└─────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                      │                    │
                      │              ┌─────▼─────┐
                      │              │ Validate  │
                      │              │   JWT     │
                      │              └─────┬─────┘
                      │                    │
                      │              ┌─────▼─────┐
                      │              │   Load    │
                      │              │Permissions│
                      │              └─────┬─────┘
                      │                    │
                ┌─────▼────────────────────▼─────┐
                │     Forward to Target Service   │
                └─────────────────────────────────┘
```

### 7. 12-Role RBAC System

**Role Hierarchy:**

```
superadmin (all permissions)
├── admin (platform management)
├── client (license holder)
│   ├── accounts (finance team)
│   ├── sales (sales team)
│   ├── support (support team)
│   └── outlet (customer portal user) ← NEW
├── customer (end user)
│   ├── customer_account
│   ├── customer_sales
│   └── customer_support
└── affiliate (commission partner)
```

**Permission Format:** `{module}:{action}:{scope}`

```javascript
"shipment:create:own"; // Own shipments only
"customer:read:assigned"; // Assigned customers
"wallet:manage:all"; // All in tenant
"user:address:manage:own"; // Own addresses (outlet)
"*:*:*"; // Superadmin only
```

**Outlet Role Permissions:**

```javascript
outlet: [
  "shipment:create:own",
  "shipment:read:own",
  "shipment:update:own",
  "shipment:cancel:own",
  "user:address:create:own",
  "user:address:read:own",
  "user:address:update:own",
  "user:address:delete:own",
  "user:profile:read:own",
  "user:profile:update:own",
];
```

### 8. Prisma Schema Pattern

**Mandatory fields for all models:**

```prisma
model AnyEntity {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ... entity fields

  @@map("table_name") // snake_case table name
}

// REQUIRED: Audit log model in every service
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

### 9. Input Validation Pattern

**All endpoints use Joi validation:**

```javascript
// validation/userSchemas.js
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string()
    .pattern(/^\+91[0-9]{10}$/)
    .required(),
});

// routes/users.js
router.post(
  "/users",
  authMiddleware.authenticate,
  validate(createUserSchema), // Validates req.body
  UserController.create,
);
```

### 10. Error Handling Pattern

```javascript
// Custom error classes
class NotFoundError extends Error {
  constructor(resource, id) {
    super(`${resource} with ID ${id} not found`);
    this.statusCode = 404;
    this.code = "NOT_FOUND";
  }
}

// Controller usage
if (!shipment) {
  throw new NotFoundError("Shipment", shipmentId);
}

// Global error handler catches and formats
app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json(
    APIResponse.error({
      code: error.code || "INTERNAL_ERROR",
      message: error.message,
    }),
  );
});
```

### 11. Outlet Module Pattern (NEW)

**Database Schema (user-service):**

```prisma
model Outlet {
  id              String          @id @default(uuid()) @db.Uuid
  userId          String          @unique @db.Uuid // Auth user reference
  createdByUserId String          @db.Uuid
  clientId        String?         @db.Uuid // Optional client linkage
  name            String
  email           String          @unique
  phone           String          @unique
  companyName     String?
  category        String?
  tanPan          String?
  gst             String?
  companyAddress  Json?
  isActive        Boolean         @default(true)
  addresses       OutletAddress[]

  @@map("outlets")
}

model OutletAddress {
  id              String  @id @default(uuid()) @db.Uuid
  outletId        String  @db.Uuid
  label           String // "Main Office", "Warehouse"
  addressType     String  @default("HOME") // HOME, WORK, OTHER
  name            String // Contact name
  phone           String
  addressLine1    String
  city            String
  state           String
  pincode         String
  isDefaultPickup Boolean @default(false) // Single default
  Outlet          Outlet  @relation(fields: [outletId], references: [id])

  @@map("outlet_addresses")
}
```

**API Routes:**

| Method | Endpoint                              | Description          |
| ------ | ------------------------------------- | -------------------- |
| POST   | /api/outlets                          | Create outlet        |
| GET    | /api/outlets                          | List outlets         |
| GET    | /api/outlets/:id                      | Get outlet by ID     |
| PUT    | /api/outlets/:id                      | Update outlet        |
| DELETE | /api/outlets/:id                      | Delete (soft) outlet |
| PATCH  | /api/outlets/:id/status               | Toggle active status |
| POST   | /api/outlets/:id/reset-password       | Reset password       |
| GET    | /api/outlets/:id/addresses            | Get outlet addresses |
| POST   | /api/outlets/:id/addresses            | Create address       |
| PUT    | /api/outlets/:id/addresses/:addressId | Update address       |
| DELETE | /api/outlets/:id/addresses/:addressId | Delete address       |

**Geo-Autocomplete Pattern:**

```typescript
// Frontend hooks usage
const { data: statesData } = useGetStatesQuery();
const { data: citiesData } = useGetCitiesQuery({ stateId }, { skip: !stateId });
const { data: pincodeDetails } = useGetPincodeDetailsQuery(pincode, {
  skip: pincode.length !== 6,
});

// Auto-fill on pincode entry
useEffect(() => {
  if (pincodeDetails?.data) {
    const { hierarchy } = pincodeDetails.data;
    setFormData((prev) => ({
      ...prev,
      state: hierarchy?.state?.name,
      city: hierarchy?.city?.name,
    }));
  }
}, [pincodeDetails]);
```

## Component Relationships

### Inter-Service Communication

```
Shipment Service ──────┬─────▶ Partner Service (rates, booking)
                       │
                       ├─────▶ Wallet Service (balance check, deduction)
                       │
                       └─────▶ User Service (customer validation)

User Service ──────────┬─────▶ Auth Service (role validation)
                       │
                       └─────▶ License Service (tenant limits)
```

### Caching Strategy

```
Redis Cache Structure:
├── session:{sessionId}           # User sessions (TTL: 24h)
├── permissions:{userId}          # User permissions (TTL: 5min)
├── rates:{origin}:{dest}         # Courier rates (TTL: 1h)
├── serviceability:{pincode}      # Pincode data (TTL: 24h)
└── api:response:{hash}           # API response cache (TTL: varies)
```

## Key Technical Decisions

1. **Prisma ORM**: Type-safe database operations, migration management
2. **JWT + Redis**: Scalable auth with session management
3. **UUID**: Database IDs for security and distribution
4. **PNPM Workspace**: Monorepo for shared code management
5. **Docker Compose**: Consistent development environment
6. **Winston**: Structured logging with file rotation

---

**Architecture Status**: Stable
**Last Pattern Review**: January 24, 2026
**Recent Additions**: Outlet Module Pattern, Audit Action Standardization
