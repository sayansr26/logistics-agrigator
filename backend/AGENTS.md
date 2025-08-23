# Backend Services AGENTS.md

## Backend-Specific Development

### Service Architecture

All backend services MUST follow the **auth-service pattern** exactly. Reference: `backend/auth-service/`

### Critical Development Rules

#### NEVER DO (Will break the system)

- ❌ Use inline functions in routes (ALL logic in controllers)
- ❌ Write raw SQL queries (use Prisma only)
- ❌ Skip audit logging for CRUD operations
- ❌ Use incorrect shared library paths
- ❌ Create endpoints without authentication
- ❌ Skip input validation with Joi

#### ALWAYS DO (Required patterns)

- ✅ Follow auth-service patterns exactly
- ✅ Use controller methods for all business logic
- ✅ Include audit logging in all CRUD operations
- ✅ Use shared libraries from `../shared/lib/` (subdirs) or `./shared/lib/` (root)
- ✅ Validate all inputs with Joi schemas
- ✅ Use standard APIResponse format

### Service Development Commands

```bash
# Start individual services
docker-compose --profile auth-service up
docker-compose --profile user-service up
docker-compose --profile partner-service up
docker-compose --profile shipment-service up

# Backend-only development
pnpm run dev:backend

# Service-specific operations
cd backend/service-name
pnpm install
npx prisma generate
npx prisma migrate deploy
pnpm test
```

### Shared Library Usage (CRITICAL)

**Import Path Rules:**

```javascript
// From server.js (service root)
const logger = require("./shared/lib/logger");

// From controllers/, middleware/, routes/, config/
const APIResponse = require("../shared/lib/response");
const { authMiddleware } = require("../shared/lib/auth");
const { walletService } = require("../shared");
```

### Service Structure Template

When creating new services, copy this exact structure from auth-service:

```
backend/new-service/
├── controllers/           # Business logic only (NO inline functions)
│   └── entityController.js
├── middleware/           # Service-specific middleware wrappers
│   ├── auth.js          # Wrapper for shared auth middleware
│   ├── errorHandler.js  # Uses shared error utilities
│   ├── rateLimiter.js   # Service-specific rate limits
│   └── validate.js      # Joi validation middleware
├── routes/              # Route definitions only (NO business logic)
│   └── entities.js
├── config/              # Configuration modules
│   ├── database.js      # Prisma client setup
│   ├── redis.js         # Redis client setup
│   └── swagger.js       # OpenAPI documentation
├── validation/          # Joi schemas
│   └── entitySchemas.js
├── prisma/             # Database schema and migrations
│   ├── schema.prisma
│   └── migrations/
├── Dockerfile          # Container configuration
├── package.json        # Dependencies and scripts
└── server.js          # Express app entry point
```

### Database Per Service Pattern

Each service MUST have its own database:

- `logistics_auth` - Auth Service
- `logistics_users` - User Service
- `logistics_partners` - Partner Service
- `logistics_shipments` - Shipment Service
- `logistics_support` - Support Service
- `logistics_platforms` - Platform Service

### Mandatory Service Features

Every service MUST implement:

1. **Health check endpoint** (`/health`)
2. **Swagger documentation** (`/api-docs`)
3. **Audit logging** for all CRUD operations
4. **JWT authentication** middleware
5. **Rate limiting** per endpoint type
6. **Input validation** with Joi
7. **Error handling** middleware
8. **Standard response format**

### Service Testing

```bash
# Test service health
curl http://localhost:PORT/health

# Test API documentation
open http://localhost:PORT/api-docs

# Run service tests
cd backend/service-name && pnpm test

# Check service logs
docker-compose logs -f service-name
```

### Current Service Status

- ✅ **auth-service** (Port 3002): Production-ready, 10 endpoints
- ✅ **user-service** (Port 3003): Production-ready, 25+ endpoints
- ✅ **partner-service** (Port 3005): Production-ready, CRUD + rate limiting
- 🔄 **shipment-service** (Port 3004): Integration with partner/wallet services
- 📋 **platform-service** (Port 3007): Shopify integration planned
- 📋 **support-service** (Port 3006): Ticket system planned

### Task Management Reference

See `backend/BACKEND_TASK.md` for:

- Detailed task tracking and status
- Implementation requirements per service
- Dependencies between services
- Completion criteria and success metrics
