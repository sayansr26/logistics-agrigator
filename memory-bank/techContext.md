# Technical Context: Technology Stack & Development Environment

## Technology Stack Overview

### Backend Technologies

**Runtime Environment**

- **Node.js 18+**: Modern JavaScript runtime with excellent npm ecosystem
- **PNPM 8.15.1**: Fast, disk-space efficient package manager for monorepo
- **Express.js**: Lightweight, flexible web application framework

**Database & ORM**

- **PostgreSQL 15+**: Primary database for all microservices
- **Prisma ORM**: Type-safe database client with migration management
- **Redis 7+**: Caching, session management, and rate limiting

**Authentication & Security**

- **JWT (jsonwebtoken)**: Access and refresh token authentication
- **bcrypt**: Password hashing with configurable rounds
- **TOTP (speakeasy)**: Two-factor authentication support
- **Joi**: Request validation and sanitization

### Frontend Technologies

**Framework & Languages**

- **Next.js 14**: React framework with App Router and server-side rendering
- **TypeScript**: Type safety throughout the application
- **Tailwind CSS**: Utility-first CSS framework with custom design system

**State & Form Management**

- **Zustand**: Lightweight state management for client-side state
- **React Hook Form**: Performant forms with validation
- **Zod**: TypeScript-first schema validation

**HTTP & API Integration**

- **Axios**: HTTP client with interceptors and request/response handling
- **SWR**: Data fetching with caching, revalidation, and error recovery

## Development Environment

### Containerization & Orchestration

**Docker Configuration**

```dockerfile
FROM node:18-alpine
WORKDIR /app
RUN npm install -g pnpm@8.15.1
COPY package*.json ./
RUN pnpm install --prod --frozen-lockfile
COPY . .
EXPOSE 8001
CMD ["node", "server.js"]
```

**Docker Compose Structure**

```yaml
services:
  auth-service: # Port 8001 - ✅ COMPLETED
  user-service: # Port 8002 - ✅ COMPLETED
  partner-service: # Port 3005 - ✅ 95% COMPLETED
  shipment-service: # Port 8003 - 🔄 READY FOR INTEGRATION
  support-service: # Port 8004 - ❌ NOT STARTED
  platform-service: # Port 8005 - ❌ NOT STARTED
  api-gateway: # Port 8000 - ✅ OPERATIONAL
  frontend: # Port 3000 - ✅ FOUNDATION READY
  postgres: # Port 5432 - ✅ OPERATIONAL
  redis: # Port 6379 - ✅ OPERATIONAL
```

### Database Architecture

**Service-Specific Databases**

```sql
-- Each service has its own PostgreSQL database
CREATE DATABASE auth_service;        -- ✅ OPERATIONAL
CREATE DATABASE user_service;        -- ✅ OPERATIONAL
CREATE DATABASE partner_service;     -- ✅ OPERATIONAL
CREATE DATABASE shipment_service;    -- 🔄 READY
CREATE DATABASE platform_service;    -- ❌ NOT CREATED
CREATE DATABASE support_service;     -- ❌ NOT CREATED
```

**Prisma Schema Pattern**

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Type-safe model definitions with relationships
model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique @db.VarChar(255)
  role      Role     @default(client)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

### Development Tools

**Code Quality & Formatting**

- **ESLint**: Linting with custom rules for Node.js and React
- **Prettier**: Code formatting with consistent style across team
- **Husky**: Git hooks for pre-commit quality checks
- **lint-staged**: Run linters only on changed files
- **commitlint**: Conventional commit message enforcement

**Development Utilities**

- **Prisma Studio**: Visual database browser and editor (Port 5555)
- **Swagger/OpenAPI**: API documentation generation and testing
- **Winston**: Structured logging with multiple transports
- **Morgan**: HTTP request logging middleware

## Monorepo Structure

### Package Management

```json
{
  "name": "logistics-portal",
  "workspaces": ["backend/*", "frontend", "shared"],
  "packageManager": "pnpm@8.15.1"
}
```

### Shared Libraries Architecture

```javascript
// /shared/lib/ contains utilities used across all services
├── auth.js        // JWT utilities, role checking
├── database.js    // Prisma client configuration
├── errors.js      // Custom error classes
├── logger.js      // Winston logger configuration
├── redis.js       // Redis client and utilities
├── response.js    // Standardized API responses
├── validation.js  // Common Joi schemas
// REMOVED (moved to backup-incorrect-wallet-implementation/):
// ├── walletMiddleware.js  // INCORRECT: Was shared library client
// └── walletService.js     // INCORRECT: Was shared library client
```

### Import Patterns

```javascript
// Consistent import pattern across all services
const {
  database,
  redis,
  auth,
  errors,
  logger,
  response,
} = require("../../shared");

// Service-specific imports
const prisma = require("./config/database");
const { verifyToken, authorize } = require("./middleware/auth");
```

## Environment Configuration

### Development Setup Scripts

```bash
# Automated development setup
pnpm run setup:dev          # Full stack setup
pnpm run setup:backend      # Backend services only
pnpm run setup:frontend     # Frontend only

# Development execution
pnpm run dev                # All services
pnpm run dev:backend        # Backend services + databases
pnpm run dev:frontend       # Frontend only

# Database operations
pnpm run prisma:studio      # Visual database browser
pnpm run prisma:generate    # Generate Prisma clients
```

### Environment Variables Pattern

```bash
# Service-specific environment files
backend/auth-service/.env
backend/user-service/.env
backend/shipment-service/.env
frontend/.env.local

# Common environment variables
DATABASE_URL=postgresql://user:pass@localhost:5432/service_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
```

## Security Implementation

### Authentication Flow

```javascript
// JWT Token Generation
const accessToken = jwt.sign(
  {
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    permissions: user.permissions,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "15m",
    issuer: "logistics-portal",
    audience: "logistics-api",
  },
);
```

### Security Middleware Stack

```javascript
// Applied to all services
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // CORS configuration
app.use(rateLimiter); // Rate limiting via Redis
app.use(express.json({ limit: "10mb" })); // Request size limiting
app.use(requestLogger); // Request/response logging
```

### Input Validation Strategy

```javascript
// Joi schemas for consistent validation
const userSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  role: Joi.string().valid(
    "admin",
    "finance",
    "operations",
    "client",
    "support",
  ),
  clientId: Joi.string().uuid().optional(),
});
```

## Deployment & Infrastructure

### Production Deployment Stack

```yaml
# VPS deployment configuration
Server: Ubuntu 20.04 LTS
Reverse Proxy: Nginx with SSL termination
Container Runtime: Docker Compose
Database: Managed PostgreSQL with backups
Cache: Redis with persistence
Monitoring: Health checks + structured logging
```

### SSL & Domain Configuration

```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name api.logistics.com;

    ssl_certificate /etc/ssl/certs/logistics.crt;
    ssl_certificate_key /etc/ssl/private/logistics.key;

    location /api/ {
        proxy_pass http://api-gateway:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Development Workflows

### Git Workflow

```bash
# Feature development workflow
git checkout -b feature/partner-service-integration
# Make changes
git add .
git commit -m "feat: add external API integration to partner service"
# Husky runs pre-commit hooks: lint, format, test
git push origin feature/partner-service-integration
# Create PR for review
```

### Testing Strategy

```javascript
// Service-level testing
describe("Auth Service", () => {
  it("should authenticate valid user credentials", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@example.com", password: "ValidPass123!" })
      .expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.data.accessToken).toBeDefined();
  });
});

// Integration testing
describe("End-to-End Shipment Creation", () => {
  it("should create shipment with partner charges and wallet payment", async () => {
    // Multi-service integration test
  });
});
```

### Performance Monitoring

**Database Performance**

```javascript
// Prisma query logging
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
  errorFormat: "pretty",
});

// Query performance tracking
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();

  logger.info(
    `Query ${params.model}.${params.action} took ${after - before}ms`,
  );
  return result;
});
```

**Application Metrics**

```javascript
// Health check with service dependencies
app.get("/health", async (req, res) => {
  const checks = {
    database: await testDatabaseConnection(),
    redis: await testRedisConnection(),
    externalServices: await testExternalAPIs(),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  };

  const healthy = Object.values(checks).every((check) =>
    typeof check === "object" ? check.status === "ok" : check === "ok",
  );

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "error",
    timestamp: new Date().toISOString(),
    checks,
  });
});
```

---

This technical context provides the foundation for consistent development practices and ensures all team members understand the technology decisions and architectural patterns used throughout the project.
