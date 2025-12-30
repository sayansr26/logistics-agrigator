# Tech Context - Logistics Aggregator Portal

> Technologies, tools, and development setup | Last Updated: December 2024

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
| PNPM           | Package manager (monorepo) |
| Husky          | Git hooks                  |
| Commitlint     | Commit message linting     |
| ESLint         | Code linting               |
| Prettier       | Code formatting            |

## Development Setup

### Prerequisites

```bash
# Required software
- Node.js 18+ (LTS recommended)
- PNPM 8.15.1+
- Docker Desktop (or Docker Engine + Docker Compose)
- Git

# Install PNPM globally
npm install -g pnpm@8.15.1
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
├── memory-bank/           # Project intelligence
├── docker-compose.yml     # Main compose file
└── package.json           # Root workspace config
```

### Quick Start Commands

```bash
# Initial setup
pnpm run fresh:install          # Complete fresh installation
pnpm run setup:dev              # Auto-create .env + dependencies

# Development
pnpm run dev                    # Start all services
pnpm run dev:frontend           # Frontend only
pnpm run dev:backend            # Backend only
pnpm run stop                   # Stop all services

# Database
pnpm run prisma:studio          # Visual database browser
pnpm run prisma:generate        # Generate Prisma clients
pnpm run migrate:deploy:all     # Deploy all migrations

# Logs & Health
pnpm run logs                   # All service logs
pnpm run logs:backend           # Backend logs only
pnpm run health                 # Health check all services
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
docker exec logistics-auth-service pnpm test

# Run with coverage
docker exec logistics-auth-service pnpm run test:coverage

# Integration tests
docker exec logistics-auth-service pnpm run test:integration
```

### Frontend Testing

```bash
cd frontend
pnpm test              # Unit tests
pnpm run test:e2e      # End-to-end tests
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
pnpm run lint:staged
pnpm run commitlint
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
pnpm run prisma:studio

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

---

**Environment**: Development  
**Node Version**: 18.x LTS  
**Package Manager**: PNPM 8.15.1
