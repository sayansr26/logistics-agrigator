# AGENTS.md

## Project Overview

This is a **Logistics Aggregator Portal** - a comprehensive microservices-based platform for managing logistics operations, courier integrations, and shipment processing. The system follows a monorepo structure with separate frontend and backend services.

**Architecture**: Microservices with shared libraries, Docker containerization, PostgreSQL databases per service, Redis caching, and Next.js frontend.

## Setup Commands

### Initial Setup

```bash
# Clone and setup the entire project
git clone <repository-url>
cd logistics-main
pnpm install

# One-command complete setup (recommended)
pnpm run setup:dev
```

### Development Commands

```bash
# Full-stack development (all services)
pnpm run dev

# Focused development
pnpm run dev:frontend          # Frontend-only development
pnpm run dev:backend           # Backend-only development

# Individual service development
docker-compose --profile partner-service up
docker-compose --profile user-service up
docker-compose --profile all-services up
```

### Database Management

```bash
# Initialize all databases
docker-compose up postgres redis

# Run migrations for specific service
cd backend/auth-service && npx prisma migrate deploy
cd backend/user-service && npx prisma migrate deploy
cd backend/partner-service && npx prisma migrate deploy
```

## Code Style & Architecture Standards

### Backend Services (CRITICAL PATTERNS)

**MANDATORY: Follow auth-service patterns exactly**

- Reference implementation: `backend/auth-service/`
- **NEVER use inline functions in routes** - ALL business logic MUST be in controller methods
- **ALWAYS use Prisma ORM** - NO raw SQL queries
- **MANDATORY audit logging** for all CRUD operations
- **Required shared library usage** from `../shared/lib/` or `./shared/lib/`

### Import Path Rules (CRITICAL)

```javascript
// From server.js (root level)
const logger = require("./shared/lib/logger");

// From subdirectories (controllers/, middleware/, config/, routes/)
const APIResponse = require("../shared/lib/response");
const { authMiddleware } = require("../shared/lib/auth");
```

### Controller Pattern (MANDATORY)

```javascript
// ✅ CORRECT: Controller methods only
class EntityController {
  static async create(req, res) {
    // Business logic here
    // MANDATORY: Add audit logging
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: "CREATE",
        resource: "Entity",
        resourceId: entity.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });
  }
}

// ❌ FORBIDDEN: Inline functions in routes
router.get("/entities", async (req, res) => {
  // Business logic here - WRONG!
});
```

### Service Structure (MANDATORY)

```
backend/service-name/
├── controllers/        # Business logic (NEVER inline in routes)
├── middleware/         # Service-specific middleware wrappers
├── routes/            # API route definitions only
├── config/            # Database, Redis, Swagger configs
├── validation/        # Joi validation schemas
├── prisma/           # Database schema and migrations
├── Dockerfile        # Container configuration
├── package.json      # Dependencies and scripts
└── server.js         # Express app entry point
```

### Frontend Standards

- **Next.js 14** with App Router
- **TypeScript strict mode**
- **Tailwind CSS** for styling
- **Shadcn/ui components**
- **Zustand** for state management

## Testing Instructions

### Backend Testing

```bash
# Run all backend tests
pnpm run test:backend

# Test specific service
cd backend/auth-service && pnpm test
cd backend/partner-service && pnpm test

# Test with coverage
pnpm run test:coverage
```

### Frontend Testing

```bash
# Run frontend tests
cd frontend && pnpm test

# Run with watch mode
cd frontend && pnpm test:watch
```

### Integration Testing

```bash
# Health checks for all services
curl http://localhost:3002/health  # Auth Service
curl http://localhost:3003/health  # User Service
curl http://localhost:3005/health  # Partner Service

# API documentation
open http://localhost:3002/api-docs  # Auth Service Swagger
open http://localhost:3005/api-docs  # Partner Service Swagger
```

## Development Environment Tips

### Docker & Services

- **Always use PNPM** - never npm or yarn in this monorepo
- **Check Docker logs**: `docker-compose logs service-name`
- **Service ports**: Auth(3002), User(3003), Shipment(3004), Partner(3005), Support(3006), Platform(3007)
- **Database per service**: Each microservice has its own PostgreSQL database

### Debugging

```bash
# Check service status
docker-compose ps

# View logs for specific service
docker-compose logs -f auth-service
docker-compose logs -f partner-service

# Access service containers
docker exec -it logistics-auth-service sh
docker exec -it logistics-partner-service sh
```

### Database Operations

```bash
# Access Prisma Studio for specific service
cd backend/auth-service && npx prisma studio
cd backend/partner-service && npx prisma studio

# Reset database (development only)
cd backend/service-name && npx prisma migrate reset
```

## Security Considerations

### Authentication & Authorization

- **JWT tokens** with refresh token rotation
- **Role-based access control** (RBAC): admin, operations, client, finance
- **Rate limiting** implemented per service and endpoint type
- **Input validation** with Joi schemas for ALL endpoints
- **Audit logging** for ALL CRUD operations (mandatory)

### Environment Variables

```bash
# NEVER commit these to git
JWT_SECRET=your-super-secret-jwt-key-change-in-production
DATABASE_URL=postgresql://logistics:logistics123@localhost:5432/logistics_service
REDIS_URL=redis://localhost:6379
```

## Task Management

### Current Development Status

- ✅ **Auth Service**: Production-ready (10 endpoints, JWT, RBAC, audit logging)
- ✅ **User Service**: Production-ready (25+ endpoints, multi-tenant, white-label)
- ✅ **Partner Service**: Production-ready (CRUD, rate limiting, audit logging)
- ✅ **Wallet Integration**: Shared library with payment processing
- 🔄 **Next Priority**: PARTNER-002 - External API Integration Client

### Task Tracking

- **Reference**: `backend/BACKEND_TASK.md` for detailed task management
- **Follow auth-service patterns** for all new services
- **Use shared libraries** from `shared/lib/` consistently
- **Implement audit logging** for all CRUD operations

## Commit & PR Guidelines

### Commit Message Format

```bash
# Use conventional commits (enforced by commitlint)
feat(auth): add 2FA support
fix(partner): resolve rate calculation issue
docs(readme): update setup instructions
refactor(user): optimize client query performance
```

### Pre-commit Hooks (Husky)

- **Automatic linting** with lint-staged
- **TypeScript validation** for frontend
- **Prettier formatting** on commit
- **Conventional commit** message validation

### PR Requirements

- **All tests must pass** (enforced by pre-push hooks)
- **Follow established patterns** (especially auth-service)
- **Include audit logging** for CRUD operations
- **Update Swagger documentation** for API changes
- **No inline functions in routes** (use controllers)

## Deployment

### Development Deployment

```bash
# Start all services
pnpm run dev

# Start specific service profiles
docker-compose --profile partner-service up
docker-compose --profile all-services up
```

### Production Considerations

- **Environment-specific configs** in docker-compose files
- **Database migrations** run automatically via startup scripts
- **Health checks** implemented for all services
- **Monitoring** via comprehensive health endpoints

## Troubleshooting

### Common Issues

1. **Module not found errors**: Check import paths (`./shared` vs `../shared`)
2. **Port conflicts**: Ensure no other services running on ports 3001-3007
3. **Database connection**: Verify PostgreSQL is running and accessible
4. **Redis connection**: Check Redis service status
5. **Live reload not working**: Verify volumes are uncommented in docker-compose.yml

### Service-Specific Debugging

```bash
# Check service health
curl http://localhost:PORT/health

# View service logs
docker-compose logs -f service-name

# Access service container
docker exec -it logistics-service-name sh
```

## External Dependencies

### Required External Services

- **Partner Micro Service** (Port 8007): Required for real-time courier calculations
- **Wallet Service** (Port 8006): Payment processing integration
- **Shopify App Credentials**: For platform integrations

### API Integrations

- **Courier APIs**: Delhivery, Blue Dart, DTDC, Ecom Express
- **Payment Gateway**: Wallet service integration
- **E-commerce Platforms**: Shopify OAuth integration

---

**Note**: This project follows the [AGENTS.md standard](https://agents.md/) for AI coding agent guidance. Always reference `backend/auth-service/` as the pattern implementation for new services.
