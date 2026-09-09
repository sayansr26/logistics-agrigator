# Tech Context - Logistics Aggregator Portal

> Technologies, tools, and development setup | Last Updated: April 8, 2026

## Technology Stack

### Backend

| Layer      | Technology | Version | Purpose                       |
| ---------- | ---------- | ------- | ----------------------------- |
| Runtime    | Node.js    | 18+     | JavaScript runtime            |
| Framework  | Express.js | 4.x     | Web framework                 |
| ORM        | Prisma     | 5.x     | Type-safe database operations |
| Database   | PostgreSQL | 15+     | Primary data store            |
| Cache      | Redis      | 7+      | Sessions, caching, queues     |
| Auth       | JWT        | -       | Token-based authentication    |
| Validation | Joi        | 17.x    | Input validation              |
| Logging    | Winston    | 3.x     | Structured logging            |

### Frontend

| Layer             | Technology      | Version | Purpose                      |
| ----------------- | --------------- | ------- | ---------------------------- |
| Framework         | Next.js         | 14.x    | React framework (App Router) |
| Language          | TypeScript      | 5.x     | Type safety                  |
| Styling           | Tailwind CSS    | 3.x     | Utility-first CSS            |
| Components        | Radix UI        | -       | Accessible primitives        |
| State             | Zustand         | 4.x     | Client state management      |
| State (migrating) | Redux Toolkit   | 2.x     | Global state + RTK Query     |
| Forms             | React Hook Form | 7.x     | Form handling                |
| Validation        | Zod             | 3.x     | Schema validation            |
| HTTP              | Axios           | 1.x     | API client                   |

### DevOps & Tools

| Tool           | Purpose                    |
| -------------- | -------------------------- |
| Docker         | Containerization           |
| Docker Compose | Service orchestration      |
| yarn           | Package manager (monorepo) |
| Husky          | Git hooks                  |
| Commitlint     | Commit message linting     |
| ESLint         | Code linting               |
| Prettier       | Code formatting            |

## Development Setup

### Prerequisites

```bash
# Required software
- Node.js 18+ (LTS recommended)
- yarn
- Docker Desktop (or Docker Engine + Docker Compose)
- Git

# Install yarn globally
npm install -g yarn
```

### Project Structure

```
logistics-agrigator/
├── backend/
│   ├── api-gateway/       # Port 3001
│   ├── auth-service/      # Port 3002
│   ├── user-service/      # Port 3003
│   ├── shipment-service/  # Port 3004
│   ├── partner-service/   # Port 3005
│   ├── wallet-service/    # Port 3006
│   ├── support-service/   # Port 3007
│   ├── platform-service/  # Port 3008
│   └── license-service/   # Port 3009
├── frontend/              # Port 3000
├── shared/                # Shared utilities
├── scripts/               # Automation scripts
├── docs/                  # Documentation
├── .serena/memories/      # Project intelligence (memory bank)
├── docker-compose.yml     # Main compose file
└── package.json           # Root workspace config
```

### Quick Start Commands

```bash
# Initial setup
yarn run fresh:install          # Complete fresh installation
yarn run setup:dev              # Auto-create .env + dependencies

# Development
yarn run dev                    # Start all services
yarn run dev:frontend           # Frontend only
yarn run dev:backend            # Backend only
yarn run stop                   # Stop all services

# Database
yarn run prisma:studio          # Visual database browser
yarn run prisma:generate        # Generate Prisma clients
yarn run migrate:deploy:all     # Deploy all migrations
yarn run db:init                # Container-aware migration + seed bootstrap

# Logs & Health
yarn run logs                   # All service logs
yarn run logs:backend           # Backend logs only
yarn run health                 # Health check all services
```

## Environment Configuration

### Environment Files

```
.env                           # Root environment
frontend/.env                  # Frontend config
backend/auth-service/.env      # Auth service config
backend/user-service/.env      # User service config
... (per service)
```

### Key Environment Variables

```bash
# Database (per service)
DATABASE_URL="postgresql://user:pass@localhost:5432/logistics_service"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Service URLs
AUTH_SERVICE_URL="http://auth-service:3002"
USER_SERVICE_URL="http://user-service:3003"
PARTNER_SERVICE_URL="http://partner-service:3005"
WALLET_SERVICE_URL="http://wallet-service:3006"

# External APIs
PARTNER_API_URL="https://calc.websiteduniya.com"
WALLET_API_URL="https://wapi.websiteduniya.com/api/v1"
```

## Docker Configuration

### Main Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api-gateway:
    build: ./backend/api-gateway
    ports: ["3001:3001"]

  auth-service:
    build: ./backend/auth-service
    ports: ["3002:3002"]

  # ... other services

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
```

### Service Container Names

```
logistics-api-gateway
logistics-auth-service
logistics-user-service
logistics-shipment-service
logistics-partner-service
logistics-wallet-service
logistics-license-service
logistics-support-service
logistics-platform-service
logistics-frontend
logistics-postgres
logistics-redis
```

## Database Schema Pattern

### Prisma Configuration

```prisma
// backend/{service}/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// All IDs must be UUID
model Entity {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("entities")
}
```

### Migration Commands

```bash
# Create migration (inside Docker)
docker exec logistics-auth-service npx prisma migrate dev --name "description"

# Deploy migrations
docker exec logistics-auth-service npx prisma migrate deploy

# Generate client
docker exec logistics-auth-service npx prisma generate

# Reset database (development only!)
docker exec logistics-auth-service npx prisma migrate reset
```

### `db:init` Execution Contract (Updated February 14, 2026)

- Script path: `scripts/init-databases.sh`
- Mode selection:
  - Development: `docker-compose.yml` + `.env`
  - Production (`NODE_ENV=production`): `docker-compose.production.yml` + `.env.production`
- Reliability rules:
  - Uses strict shell mode (`set -euo pipefail`)
  - Waits for database/service readiness via container exec probes
  - Deploys committed Prisma migrations only (`prisma migrate deploy --schema=prisma/schema.prisma`)
  - Verifies `prisma/schema.prisma` and `prisma/migrations` exist per service
  - Fails fast on any migration failure to prevent partial migration states

## External Service Integration

### Partner Service API

```javascript
// HMAC-SHA256 Authentication
const crypto = require('crypto');
const timestamp = Date.now().toString();
const signature = crypto
  .createHmac('sha256', PARTNER_API_SECRET)
  .update(`${timestamp}${PARTNER_API_KEY}`)
  .digest('hex');

// Headers
{
  'X-API-Key': PARTNER_API_KEY,
  'X-Timestamp': timestamp,
  'X-Signature': signature
}
```

### Wallet Service API

```javascript
// Similar HMAC authentication
// Endpoints: balance, credit, debit, transactions, etc.
```

## Testing Framework

### Backend Testing

```bash
# Run service tests
docker exec logistics-auth-service yarn test

# Run with coverage
docker exec logistics-auth-service yarn run test:coverage

# Integration tests
docker exec logistics-auth-service yarn run test:integration
```

### Frontend Testing

```bash
cd frontend
yarn test              # Unit tests
yarn run test:e2e      # End-to-end tests
```

## Code Quality Tools

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: ["next/core-web-vitals"], // Frontend
  // or
  extends: ["eslint:recommended"], // Backend
  rules: {
    "no-console": "warn",
    "no-unused-vars": "error",
  },
};
```

### Prettier Configuration

```javascript
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### Pre-commit Hooks (Husky)

```bash
# .husky/pre-commit
yarn run lint:staged
yarn run commitlint
```

## Debugging Tips

### View Service Logs

```bash
docker logs logistics-auth-service --tail=50 -f
docker-compose logs -f auth-service
```

### Check Service Health

```bash
curl http://localhost:3001/health  # API Gateway
curl http://localhost:3002/health  # Auth Service
curl http://localhost:3003/health  # User Service
```

### Database Access

```bash
# Prisma Studio (visual browser)
yarn run prisma:studio

# Direct psql access
docker exec -it logistics-postgres psql -U logistics -d logistics_auth
```

### Redis Access

```bash
docker exec -it logistics-redis redis-cli
> KEYS *
> GET session:xxx
```

## Technical Constraints

1. **No Raw SQL**: All database operations via Prisma ORM
2. **No Inline Handlers**: All route logic in controllers
3. **UUID Format**: All IDs use `@db.Uuid` annotation
4. **Audit Required**: All CRUD operations must log
5. **Validation Required**: All inputs validated with Joi
6. **Auth Required**: All endpoints authenticated (except public)
7. **Confirmation Dialogs**: All destructive actions require user confirmation
8. **Redis v4 API**: Use `setEx()` (camelCase), NOT `setex()` (lowercase). Redis v4+ broke backward compat
9. **Inter-Service Auth**: Services calling other services must include `X-Internal-Request` header with `INTERNAL_SECRET`
10. **External Wallet Identity**: External wallet API (`wapi.websiteduniya.com`) uses **phone number** as user ID, never auth UUID
11. **Semantic Type Normalization**: PincodeType/ChargesType names are canonicalized via `typeNameNormalizer.js` — `COD`/`cod`/`Cod` → `COD`, `FRGILE` → `FRAGILE`. Applied at write (duplicate detection) and runtime (charge matching)
12. **Case-Sensitive Filenames**: Git tracks filenames case-sensitively even on macOS. Always verify import paths match exact filename case — mismatches break Linux production builds
13. **Joi stripUnknown**: Partner service validation uses `stripUnknown: true` — any field not explicitly in the Joi schema is silently removed from `req.body`. New fields (e.g., `skipServiceabilityCheck`) MUST be added to the schema
14. **Quote-related Redis (April 2026)**: Partner-service zone serviceability cache uses a `v2` key prefix and caches **only** positive results. Shipment-service partner rate cache must **not** store empty `rates` arrays; if an empty payload is read from cache, invalidate and refetch

## Frontend Patterns (Updated January 2026)

### RTK Query Endpoint Pattern

```typescript
// store/api/endpoints/outletApi.ts
export const outletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listOutlets: builder.query<OutletsResponse, Params>({
      query: (params) => ({ url: `/api/v1/outlets`, params }),
      providesTags: [{ type: "User", id: "LIST" }],
    }),
    createOutlet: builder.mutation<Response, Request>({
      query: (data) => ({ url: `/api/v1/outlets`, method: "POST", body: data }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
  }),
});

export const { useListOutletsQuery, useCreateOutletMutation } = outletApi;
```

### RTK Query transformResponse Pattern (IMPORTANT)

**All backend APIs return a `{ status, data, meta }` envelope.** The `transformResponse` on `fetchBaseQuery` (in `baseApi.ts`) is NOT supported by RTK Query and is silently ignored. Each endpoint MUST define its own `transformResponse`:

```typescript
// ✅ CORRECT: Unwrap envelope per endpoint
getItems: builder.query<{ items: Item[] }, void>({
  query: () => "/api/v1/items",
  transformResponse: (response: any) => ({
    items: response?.data?.items || [],
    pagination: response?.data?.pagination || {},
  }),
}),

// ❌ WRONG: No transformResponse — UI gets raw { status, data: {...}, meta } envelope
```

**Existing APIs and their transform status:**

- `chargesApi.ts` — ✅ Has transformResponse (unwraps correctly)
- `chargesTypeApi.ts` — ✅ Has transformResponse (returns `{ data: [...], meta }`)
- `pincodeTypeApi.ts` — ✅ Has transformResponse (returns `{ data: [...], meta }`)
- `authApi.ts` — ✅ Has transformResponse
- `partnersApi.ts` — ⚠️ No transformResponse (access via `data?.data?.partners`)
- `zonesApi.ts` — ⚠️ No transformResponse (access via `data?.data?.zones`)

### Geo-Autocomplete Pattern

```typescript
// Uses existing geoApi endpoints
import {
  useGetStatesQuery,
  useGetCitiesQuery,
  useGetPincodeDetailsQuery,
} from "@/store/api/endpoints/geoApi";

// Pincode entry auto-fills city and state
const { data: pincodeDetails } = useGetPincodeDetailsQuery(pincode, {
  skip: pincode.length !== 6,
});

useEffect(() => {
  if (pincodeDetails?.data?.hierarchy) {
    setForm({ city: hierarchy.city.name, state: hierarchy.state.name });
  }
}, [pincodeDetails]);
```

### Modal-Based CRUD Pattern

```typescript
// State for modals
const [showViewDialog, setShowViewDialog] = useState(false);
const [showEditDialog, setShowEditDialog] = useState(false);
const [showDeleteDialog, setShowDeleteDialog] = useState(false);

// Handlers open modals, don't navigate
const handleView = (id) => {
  setSelectedId(id);
  setShowViewDialog(true);
};
const handleEdit = (id) => {
  setSelectedId(id);
  setShowEditDialog(true);
};
const handleDelete = (item) => {
  setItemToDelete(item);
  setShowDeleteDialog(true);
};
```

---

**Environment**: Development  
**Node Version**: 18.x LTS  
**Package Manager**: yarn  
**Last Updated**: March 28, 2026
