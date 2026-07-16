# System Patterns - Logistics Aggregator Portal

> Architecture and design patterns | Last Updated: April 8, 2026

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

### 12. Geography-First Pincode Search Pattern (NEW - February 2026)

**Canonical endpoint for all pincode search/autocomplete use-cases:**

```http
GET /api/v1/geography/pincodes/search
```

**Compatibility rule:**

- Accept both `q` and `code` aliases during migration.

**Deprecation bridge (phase 1):**

- Legacy endpoint `GET /api/v1/pincodes/search` stays temporarily available.
- Legacy endpoint includes:
  - `Deprecation: true`
  - `Sunset: 2026-06-30T00:00:00.000Z`
  - `Link: </api/v1/geography/pincodes/search>; rel="successor-version"`
- API Gateway writes structured warning logs for all deprecated endpoint hits.

**Frontend integration rule:**

- Partner pincode assignment autocomplete must call geography endpoint.
- Response adapters should normalize envelope and unwrapped payloads before component mapping.

### 13. Charges Rule Engine Pattern (NEW - February 2026)

**Flexible charge rule model** replacing the legacy `ChargePackage` system. A single `ChargeRule` model holds conditional fields for multiple base types.

**Enums:**

```prisma
enum ChargeRuleKind {
  PARTNER_CHARGES_TYPE // Linked to partner's ChargesType
  GEOLOGICAL // Linked to PincodeType
  ADDON // Standalone addon charges
}

enum ChargeRuleBase {
  INVOICE_VALUE // From/To amount slabs
  WEIGHT // Min/Max kg slabs
  ZONE_TO_ZONE_WEIGHT // Zone pair + weight slab
  DISTANCE_BASE_WEIGHT // KM range + weight slab
}

enum ChargeCalcType {
  FLAT // Fixed charge (₹)
  PERCENTAGE // Percentage of value
}
```

**Calculation Logic:**

```
1. Fetch all active ChargeRules for a partner
2. Group rules by category: (partnerId + kind + chargesTypeId/pincodeTypeId + base)
3. For each category, evaluate all matching rules against shipment context
4. Within a category: compute all matching slabs, take the HIGHEST charge
5. For GEOLOGICAL kind: compute pickup and delivery sides independently, SUM both
6. Final total = sum of highest charge from each category
7. Return total + detailed breakdown per category
```

**API Routes:**

| Method | Endpoint            | Description    |
| ------ | ------------------- | -------------- |
| POST   | /api/v1/charges     | Create rule    |
| GET    | /api/v1/charges     | List rules     |
| GET    | /api/v1/charges/:id | Get rule by ID |
| PUT    | /api/v1/charges/:id | Update rule    |
| DELETE | /api/v1/charges/:id | Soft-delete    |

**Frontend Pattern:**

- Modal-based CRUD with dynamic form fields based on selected `kind` and `base`
- RTK Query with `transformResponse` to unwrap `{ status, data, meta }` envelope

### 14. RTK Query Response Envelope Pattern (NEW - February 2026)

**All backend APIs return a standard envelope:**

```json
{
  "status": "success",
  "data": {/* actual payload */},
  "meta": { "timestamp": "..." }
}
```

**RTK Query endpoints MUST use `transformResponse` to unwrap the envelope:**

```typescript
// ✅ CORRECT: Unwrap envelope in each endpoint
getItems: builder.query<{ items: Item[] }, void>({
  query: () => "/api/v1/items",
  transformResponse: (response: any) => ({
    items: response?.data?.items || [],
    pagination: response?.data?.pagination || {},
  }),
}),

// ❌ WRONG: Rely on baseApi transformResponse (fetchBaseQuery ignores it)
getItems: builder.query<{ items: Item[] }, void>({
  query: () => "/api/v1/items",
  // No transformResponse — hook returns raw envelope, UI gets blank data
}),
```

**Note:** `fetchBaseQuery` does NOT support `transformResponse` at the `baseQuery` level.
Each endpoint must define its own `transformResponse` to extract data from the envelope.

### 15. RTK Query Cache Invalidation Pattern (NEW - March 2026)

**Mutations with `invalidatesTags` automatically trigger refetch of queries that `providesTags` with matching tags. Do NOT call `refetch()` manually after mutations — it causes duplicate API calls.**

```typescript
// ✅ CORRECT: Let tag invalidation handle refetch
const [updatePartner] = useUpdatePartnerMutation();
const handleUpdate = async () => {
  await updatePartner({ partnerId, partnerData }).unwrap();
  // No refetch() needed — updatePartner invalidates { type: "Partner", id: partnerId }
  // and getPartnerById provides { type: "Partner", id } → auto-refetch
};

// ❌ WRONG: Causes double API calls
const { refetch } = useGetPartnerByIdQuery(partnerId);
const handleUpdate = async () => {
  await updatePartner({ partnerId, partnerData }).unwrap();
  refetch(); // ← Redundant! Tag invalidation already triggers refetch
};
```

**Tag ID matching is critical:**

```typescript
// Query provides tag:
getPartnerById: builder.query({
  providesTags: (result, error, id) => [{ type: "Partner", id }],
});

// Mutation must invalidate the SAME tag ID:
updatePartner: builder.mutation({
  invalidatesTags: (result, error, { partnerId }) => [
    { type: "Partner", id: partnerId }, // ✅ Matches query tag
    { type: "Partner", id: "LIST" }, // ✅ Also invalidates list
  ],
});
```

### 16. Extensible Enum Pattern — Prisma String Instead of Enum (NEW - March 2026)

**When a field's allowed values may grow over time (e.g., courier aggregator types), use `String @db.VarChar(N)` instead of a Prisma enum. This avoids requiring `prisma db push` / migration + DB reset every time a new value is added.**

```prisma
// ✅ CORRECT: Extensible — add new aggregators with just a code change
aggregatorType String @default("NONE") @db.VarChar(50)

// ❌ AVOID for growing sets: Requires schema migration for each new value
aggregatorType AggregatorType @default(NONE)
enum AggregatorType { NONE DELHIVERY BLUEDART CUSTOM }
```

**Validation moves to application layer:**

```javascript
const ALLOWED_AGGREGATOR_TYPES = ["DELHIVERY", "BLUEDART"];
aggregatorType: Joi.string()
  .valid(...ALLOWED_AGGREGATOR_TYPES)
  .required();
```

### 17. Inter-Service Communication Pattern (NEW - March 2026)

**Services communicate over Docker network using HTTP with internal auth headers.**

```javascript
// Service-to-service calls MUST include X-Internal-Request header
const httpClient = axios.create({
  baseURL: process.env.WALLET_SERVICE_URL, // e.g., http://wallet-service:3006
  headers: {
    "Content-Type": "application/json",
    "X-Internal-Request":
      process.env.INTERNAL_SECRET || "internal-service-secret",
  },
});
```

**Key rule:** Target services block direct access without this header (returns 403). The `INTERNAL_SECRET` env var must be consistent across all services.

### 18. External Wallet Phone-Based Identity Pattern (NEW - March 2026)

**The external wallet API (`wapi.websiteduniya.com`) uses phone numbers as user identifiers, NOT auth service UUIDs.**

```javascript
// Resolving wallet userId based on user role:
function resolveOutletContext(req) {
  if (role === "outlet") {
    // Outlet's own phone from JWT token
    return { walletUserId: req.user.phone };
  }
  if (["superadmin", "admin"].includes(role)) {
    // Phone passed from frontend via outletUserId field
    return { walletUserId: req.body.outletUserId }; // This is a phone number!
  }
}
```

**Wallet admin endpoints** (`/api/v1/wallet/admin/*`) handle the correct `clientCode` (`LOGISTICS`) and use phone as userId for external API calls. Always call these admin endpoints for shipment payment processing, not direct wallet CRUD endpoints.

### 19. Shipment Payment Flow Pattern (NEW - March 2026)

```
Shipment Controller
  └─▶ resolveOutletContext(req) → { outletId, clientId, walletUserId (phone) }
  └─▶ paymentProcessingService
        ├─▶ GET /api/v1/wallet/admin/wallet?userId={phone} (balance check)
        ├─▶ POST /api/v1/wallet/admin/debit (payment deduction)
        └─▶ POST /api/v1/wallet/admin/refund (refund on failure)
              ↓
        Wallet Service Admin Controller
              ↓
        External Wallet API (wapi.websiteduniya.com)
        Auth: HMAC SHA-256 with clientCode=LOGISTICS
```

### 20. Quote Snapshot Storage Pattern (NEW - March 2026)

**When a shipment is created, the selected partner quote (including charge breakdown and discount) is stored in the `quoteSnapshot` JSON field on the Shipment model.**

```javascript
// Stored in shipment.quoteSnapshot:
{
  partnerId: "uuid",
  partnerName: "Delhivery",
  totalAmount: 4710,
  chargeBreakdown: [
    { name: "Base Freight", amount: 3500 },
    { name: "Fuel Surcharge", amount: 800 },
    { name: "COD Handling", amount: 410 },
  ],
  discount: {
    packageName: "Gold Discount",
    badge: "GOLD",
    originalTotal: 5200,
    totalDiscount: 490,
    finalTotal: 4710,
  }
}
```

**Frontend** reads `quoteSnapshot` on the detail page to display invoice-style breakdown + discount info.

## Component Relationships

### Inter-Service Communication

```
Shipment Service ──────┬─────▶ Partner Service (rates, booking)
                       │
                       ├─────▶ Wallet Service (balance check, deduction)
                       │       ⚠️ Uses admin endpoints with X-Internal-Request header
                       │       ⚠️ Wallet userId = outlet PHONE number (not UUID)
                       │
                       └─────▶ User Service (customer validation)

User Service ──────────┬─────▶ Auth Service (role validation)
                       │
                       └─────▶ License Service (tenant limits)

Partner Service ───────┬─────▶ User Service (outlet badge lookup via internal endpoint)
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
4. **yarn Workspace**: Monorepo for shared code management
5. **Docker Compose**: Consistent development environment
6. **Winston**: Structured logging with file rotation
7. **Geography endpoint canonicalization**: Pincode search standard is `/api/v1/geography/pincodes/search`; old `/api/v1/pincodes/search` is temporary/deprecated

---

### 21. Dynamic Provider Capability Contract Pattern (NEW - March 2026)

**Every courier adapter declares its capabilities and exposes available actions dynamically based on shipment state.**

```javascript
// BaseCourierAdapter — abstract capability contract
getCapabilities() {
  return {
    track:    { supported: false, requiresAwb: true,  description: "Track shipment" },
    label:    { supported: false, requiresAwb: true,  description: "Download label" },
    cancel:   { supported: false, requiresAwb: true,  description: "Cancel shipment" },
    pickup:   { supported: false, requiresAwb: false, description: "Request pickup" },
    manifest: { supported: false, requiresAwb: true,  description: "Generate manifest" },
    edit:     { supported: false, requiresAwb: true,  description: "Edit shipment" },
    refresh:  { supported: false, requiresAwb: true,  description: "Fetch latest from courier" },
    webhook:  { supported: false, requiresAwb: false, description: "Inbound webhook" },
    // ... more actions
  };
}

// Concrete adapter overrides to declare support
getCapabilities() {
  return {
    ...super.getCapabilities(),
    track:  { supported: true, requiresAwb: true, description: "Track via Delhivery" },
    cancel: { supported: true, requiresAwb: true, allowedStatuses: ["BOOKED", "PENDING_BOOKING"], description: "Cancel via Delhivery" },
    // ...
  };
}

// Dynamic filtering based on shipment context
getAvailableActions(shipmentContext) {
  const caps = this.getCapabilities();
  const available = {};
  for (const [action, config] of Object.entries(caps)) {
    if (!config.supported) continue;
    if (config.allowedStatuses && !config.allowedStatuses.includes(shipmentContext.status)) continue;
    available[action] = config;
  }
  return available;
}
```

**Frontend** renders Quick Actions from the returned `availableActions` object — buttons appear/disappear based on provider support and shipment status.

### 22. Terminal Status Protection Pattern (NEW - March 2026)

**Shipments in terminal states (`CANCELLED`, `DELIVERED`, `RTO`) must never have their status downgraded by provider sync.**

```javascript
const TERMINAL_STATUSES = ["CANCELLED", "DELIVERED", "RTO"];

// In refreshFromProvider:
const isCurrentTerminal = TERMINAL_STATUSES.includes(shipment.status);
const isNewTerminal = TERMINAL_STATUSES.includes(newStatus);

if (!isCurrentTerminal || isNewTerminal) {
  updateData.status = newStatus; // Allow update
} else {
  // Skip — would downgrade CANCELLED → BOOKED
  updateData.providerStatus = newStatus; // Still track what provider says
}
```

### 23. Global Webhook Ingestion Pattern (NEW - March 2026)

**A single public endpoint handles webhook pushes from all courier partners.**

```
POST /api/v1/shipments/webhook/:provider
```

- **Public** — no JWT auth required (exempted in API Gateway `authValidator.js` publicPaths)
- **AWB extraction** varies by provider (e.g., Delhivery sends `Awb`, BlueDart sends `AWBNo`)
- **Event normalization** maps provider-specific fields to internal `{ status, message, location, timestamp }`
- **Idempotent** — duplicate webhook events with same status are logged but don't create duplicate TrackingEvents
- **Creates**: `TrackingEvent` (source: `WEBHOOK`) + `AuditLog` (action: `WEBHOOK_STATUS_UPDATE`)

### 24. Provider-First Cancellation Pattern (NEW - March 2026)

**Cancellations must succeed at the provider before internal status changes.**

```
Frontend "Cancel with Provider" button
  └─▶ POST /api/v1/shipments/:id/cancel-with-provider
        ├─▶ partnerIntegrationService.cancelWithCourierFirst(partnerId, awbNumber, reason)
        │     └─▶ Partner Service → DelhiveryAdapter.cancelOrder()
        │           └─▶ Delhivery API (cancellation: "true")  ← MUST be string
        │
        ├─▶ On success: Update Shipment status → CANCELLED, bookingStatus → CANCELLED
        ├─▶ Create TrackingEvent (source: USER, message: "Cancelled via provider")
        └─▶ Create AuditLog
```

**Key Delhivery quirk**: `cancellation` parameter must be the **string** `"true"`, not boolean `true`. Delhivery silently ignores boolean values.

### 25. Semantic Type Normalization Pattern (NEW - March 2026)

**PincodeType and ChargesType names are normalized to canonical uppercase form for consistent matching across the system.**

```javascript
// backend/partner-service/utils/typeNameNormalizer.js
const CANONICAL_MAP = {
  cod: "COD",
  prepaid: "PREPAID",
  fragile: "FRAGILE",
  frgile: "FRAGILE",
  insurance: "INSURANCE",
  reverse: "REVERSE",
  rto: "RTO",
  freight: "FREIGHT",
  handling: "HANDLING",
  fuel: "FUEL",
  oda: "ODA",
};

function canonicalTypeName(name) {
  const lower = name.trim().toLowerCase();
  return CANONICAL_MAP[lower] || name.trim().toUpperCase();
}

function matchesSemantic(name, semantic) {
  return canonicalTypeName(name) === semantic;
}
```

**Applied at two layers:**

1. **Write time** (create/update): Duplicate detection uses canonical names — `COD`, `cod`, `Cod` are recognized as the same type
2. **Runtime** (charge calculation): `shouldIncludeRule()` uses `matchesSemantic()` to gate conditional charges — COD charges only for COD payment type, FRAGILE charges only for fragile shipments

### 26. Shipment Rerate / Revalue Pattern (NEW - March 2026)

**Existing shipments can be re-rated with updated weight/dimensions by admin/superadmin without re-validating pincode serviceability.**

```
Admin clicks "Revalue Charges" on shipment detail
  └─▶ POST /api/v1/shipments/:id/rerate
        ├─▶ Fetch shipment (including quoteSnapshot, value, fragile, paymentType)
        ├─▶ Calculate new volumetric/chargeable weight
        ├─▶ Call partner service with skipServiceabilityCheck: true
        │     └─▶ quoteCalculationService: bypasses pincode/zone checks
        │     └─▶ chargesRuleCalculationService: evaluates all rules with full context
        ├─▶ Compare newCost vs oldCost
        ├─▶ If PREPAID: debit extra from wallet or refund savings
        ├─▶ If COD: admin chooses DEDUCT_WALLET or UPDATE_COD
        ├─▶ Update shipment: totalCost, disputedWeight, chargeableWeight, quoteSnapshot.chargeBreakdown
        └─▶ Create tracking event with current status + rerate details in metadata
```

**Key design decisions:**

- `skipServiceabilityCheck: true` — existing shipments don't re-validate pincode/zone (partner was valid at booking time)
- `quoteSnapshot.chargeBreakdown` is overwritten so the frontend Charges Summary always shows current charges
- Tracking events use the shipment's current status to avoid invalid status transitions
- Auth token must be explicitly forwarded to partner service (not automatically inherited)

### 27. Strict Partner Eligibility Pattern (March 2026, refined April 2026)

**Partners only appear in rate quotes when they have active `PartnerPincodeAssign` for BOTH pickup and delivery pincodes AND each side passes zone coverage validation.**

Pincode assignment is enforced in `quoteCalculationService.js` via `hasPincodeAssignment()`.

**Zone coverage** is delegated to `zoneCoverageValidationService.validatePincodeServiceability()`:

1. **Primary**: geographical coverage — any active zone with a `zone_pincodes` row linking that pincode.
2. **DISTANCE fallback (April 2026)**: if no geo link exists but the partner has an active **DISTANCE** zone with **at least one milestone**, treat the pincode as covered. Many partners only maintain distance slabs + pincode assignment lists, not per-pincode `zone_pincodes` rows; without this fallback, quotes return empty despite valid charge rules.

**Redis for zone coverage validation**: cache key includes `serviceable:v2` prefix; **only positive (`serviceable: true`) results are cached** — caching negative results caused hour-long “no quotes” after config fixes.

**Bypassed during rerate** via `skipServiceabilityCheck: true` flag.

### 28. Shipment Quote API & Rate Cache Pattern (April 2026)

**`POST /api/v1/shipments/quotes`** (`getShipmentQuotes` in shipment-service) calls `partnerIntegrationService.calculateRates` only — the partner quote engine already applies eligibility; a second serviceability pass was removed to avoid stricter/divergent filtering.

**Shipment-service Redis (`partnerIntegrationService.calculateRates`)**:

- On **read**: if cached payload has `rates.length === 0`, **delete the key** and refetch (empty lists were previously cached for 5 minutes).
- On **write**: **do not cache** responses whose `rates` array is empty — avoids sticky empties after partner-side fixes.

**Partner `quoteCalculationService`**: if no distance-zone milestone matches, the engine still runs non-distance charge rules (e.g. WEIGHT / INVOICE_VALUE); only rejects when unmatched distance **and** no priced breakdown (see codebase).

---

**Architecture Status**: Stable
**Last Pattern Review**: April 8, 2026
**Recent Additions**: Semantic Type Normalization Pattern, Shipment Rerate/Revalue Pattern, Strict Partner Eligibility Pattern (DISTANCE fallback April 2026), Shipment Quote API & Rate Cache Pattern, Dynamic Provider Capability Contract Pattern, Terminal Status Protection Pattern, Global Webhook Ingestion Pattern, Provider-First Cancellation Pattern, Inter-Service Communication Pattern, External Wallet Phone-Based Identity Pattern, Shipment Payment Flow Pattern, Quote Snapshot Storage Pattern, RTK Query Cache Invalidation Pattern, Extensible Enum Pattern, Charges Rule Engine Pattern, RTK Query Response Envelope Pattern, Outlet Module Pattern, Audit Action Standardization, Geography-First Pincode Search Pattern
