# Logistics Aggregator Portal

A comprehensive logistics management solution for e-Commerce, B2B, and B2C enterprises in India, built with modern microservices architecture and Prisma ORM.

## 🏗️ Architecture Overview

### Microservices

- **API Gateway** (Port 3001) - Request routing, rate limiting, and authentication
- **Auth Service** (Port 3002) - JWT authentication, RBAC, 2FA with Prisma ORM
- **User Service** (Port 3003) - User and client management with Prisma ORM
- **Shipment Service** (Port 3004) - Order and tracking management with Prisma ORM
- **Support Service** (Port 3005) - Help desk and ticketing with Prisma ORM
- **Platform Service** (Port 3006) - E-commerce platform integrations with Prisma ORM
- **Frontend** (Port 3000) - Next.js 14 with TypeScript

### External Services (Existing)

- **Wallet Service** (Port 3006) - Financial transactions microservice
- **Partner Service** (Port 3007) - Courier charges calculation microservice

## 🚀 Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15+ with **Prisma ORM** (Type-safe database operations)
- **Caching**: Redis 7+ for sessions and performance
- **Authentication**: JWT with Role-Based Access Control (RBAC)
- **Containerization**: Docker with Docker Compose

### Frontend

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for client-side state
- **Form Handling**: React Hook Form with Zod validation
- **HTTP Client**: Axios with interceptors

### Database & ORM

- **Database**: PostgreSQL with separate databases per microservice
- **ORM**: Prisma (Type-safe, migration-based, with Visual Studio)
- **Migrations**: Version-controlled schema changes
- **Type Generation**: Automatic TypeScript type generation

## 📦 Project Structure

```
logistics/
├── backend/                  # Microservices
│   ├── api-gateway/         # Request routing and rate limiting
│   ├── auth-service/        # Authentication with Prisma
│   │   ├── prisma/         # Database schema and migrations
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── controllers/    # Route handlers using Prisma
│   │   ├── middleware/     # Auth, validation, error handling
│   │   └── routes/         # API route definitions
│   ├── user-service/        # User management (Prisma ready)
│   ├── shipment-service/    # Shipment management (Prisma ready)
│   ├── support-service/     # Help desk (Prisma ready)
│   └── platform-service/    # Platform integrations (Prisma ready)
├── frontend/                # Next.js application
│   ├── src/app/            # App Router pages
│   ├── src/components/     # Reusable UI components
│   └── src/lib/           # Utilities and configurations
├── shared/                  # Shared utilities across services
│   └── lib/               # Prisma helpers, validation, auth utils
├── docs/                    # Project documentation
├── .serena/memories/       # Project context and intelligence (memory bank)
├── docker-compose.yml      # Development environment
├── .env.example           # Environment variables template
├── .gitignore             # Comprehensive gitignore
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended for development)
- **Node.js 18+** and **yarn** (for local development)
- **Git** for version control

```bash
# Install yarn globally (if not already installed)
npm install -g yarn
```

### 🛠️ Development Scripts

We provide comprehensive scripts for easy development setup and maintenance:

#### 🧹 Cleanup Scripts

```bash
# Clean all dependencies, build files, and artifacts
yarn run cleanup

# Deep cleanup (includes Docker system prune)
yarn run cleanup:deep
```

#### 🚀 Setup Scripts

```bash
# Full stack setup (auto-creates .env files + installs dependencies)
yarn run setup:dev

# Frontend only setup
yarn run setup:frontend

# Backend only setup
yarn run setup:backend
```

#### 🔄 Fresh Install (Cleanup + Setup)

```bash
# Complete fresh installation
yarn run fresh:install

# Fresh frontend installation
yarn run fresh:frontend

# Fresh backend installation
yarn run fresh:backend
```

**✨ What the setup scripts do:**

- ✅ Auto-create `.env` files for all services
- ✅ Install all dependencies with yarn
- ✅ Generate Prisma clients
- ✅ Configure service-specific databases
- ✅ Set up inter-service communication URLs

### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd logistics

# 🚀 NEW: Use our automated setup script
yarn run setup:dev

# OR manual setup (old way)
# cp .env.example .env
# Edit .env with your specific configurations
# yarn install
```

### 2. Start Development Environment

```bash
# Start all services (includes automatic database setup)
yarn run dev

# Or choose your development focus:
yarn run dev:frontend         # Frontend-only development
yarn run dev:backend          # Backend-only development

# View logs
yarn run logs
```

### 3. Access Applications

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **Prisma Studio**: `yarn run prisma:studio` (Port 5555)

## 🗄️ Database Management with Prisma

### Development Workflow

```bash
# Visual database browser
yarn run prisma:studio

# Generate Prisma clients for all services
yarn run prisma:generate

# Create new migration (per service)
docker-compose exec auth-service npx prisma migrate dev --name "description"
docker-compose exec user-service npx prisma migrate dev --name "description"

# Reset database (development only)
docker-compose exec auth-service npx prisma migrate reset
```

### Schema Management

```prisma
// Example: backend/auth-service/prisma/schema.prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique @db.VarChar(255)
  role      Role
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions  Session[]
  auditLogs AuditLog[]

  @@map("users")
}
```

### Type-Safe Database Operations

```javascript
// Prisma provides full type safety
const user = await prisma.user.create({
  data: { email, passwordHash, role },
  select: { id: true, email: true, role: true },
});

// Complex queries with relations
const userWithSessions = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    sessions: { take: 10 },
    auditLogs: { orderBy: { createdAt: "desc" } },
  },
});
```

## 🔌 API Documentation

### Authentication Endpoints

| Method | Endpoint                | Description          |
| ------ | ----------------------- | -------------------- |
| POST   | `/api/v1/auth/register` | User registration    |
| POST   | `/api/v1/auth/login`    | User authentication  |
| POST   | `/api/v1/auth/refresh`  | Token refresh        |
| POST   | `/api/v1/auth/logout`   | User logout          |
| GET    | `/api/v1/auth/me`       | Current user profile |

### Example API Usage

```bash
# Register new user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!","role":"client"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!"}'
```

## 👥 User Roles & Permissions

| Role           | Permissions                           |
| -------------- | ------------------------------------- |
| **Admin**      | All system access                     |
| **Finance**    | Wallet, billing, reports              |
| **Operations** | Shipments, tracking, partners         |
| **Client**     | Own shipments, tracking, wallet view  |
| **Support**    | Tickets, user support, knowledge base |

## 🔄 Development Status

### ✅ Completed (Phase 1 - Week 1)

- [x] Complete project structure with Prisma ORM
- [x] Docker development environment with all services
- [x] PostgreSQL databases with automated schema management
- [x] API Gateway with intelligent service routing
- [x] Auth Service with JWT, RBAC, and comprehensive Prisma integration
- [x] Frontend foundation with Next.js 14 and Tailwind CSS
- [x] Shared utilities with Prisma helpers and error handling
- [x] Comprehensive .gitignore and project documentation

### 🚧 In Progress (Phase 1 - Week 2)

- [ ] User Service development with Prisma schema
- [ ] Frontend authentication forms and flows
- [ ] Service integration testing
- [ ] Dashboard UI components

### 📋 Upcoming (Phase 1 - Weeks 3-8)

- [ ] Shipment Service with CRUD operations
- [ ] Platform Service (Shopify OAuth integration)
- [ ] Integration with existing Wallet and Partner services
- [ ] Bulk shipment processing
- [ ] Real-time tracking and notifications

## 🛠️ Development Commands

### Service Management

#### **Full Stack Development**

```bash
# Complete development environment (frontend + backend + databases)
yarn run dev                    # Start all services
yarn run dev:detached          # Start all in background
yarn run stop                   # Stop all services
yarn run clean                  # Clean environment & rebuild
```

#### **Focused Development**

```bash
# Frontend developers (UI/React/Next.js focus)
yarn run setup:frontend        # One-command frontend setup
yarn run dev:frontend          # Start frontend-only
yarn run stop:frontend         # Stop frontend services

# Backend developers (API/Database/Prisma focus)
yarn run setup:backend         # One-command backend setup
yarn run dev:backend           # Start backend services + databases
yarn run stop:backend          # Stop backend services

# Include future services (Shipment, Support, Platform)
yarn run dev:backend:full      # Start all backend services
```

#### **Service Monitoring**

```bash
# View logs by category
yarn run logs                   # All services
yarn run logs:frontend         # Frontend only
yarn run logs:backend          # Backend only

# View logs by service
yarn run logs:auth             # Auth service
yarn run logs:user             # User service
yarn run logs:api              # API Gateway
```

### Database Operations

```bash
# Access Prisma Studio (Visual Database Browser)
yarn run prisma:studio

# Generate Prisma clients for all services
yarn run prisma:generate

# Create and apply migrations (service-specific)
docker-compose exec auth-service npx prisma migrate dev
docker-compose exec user-service npx prisma migrate dev

# Deploy migrations (production)
docker-compose exec auth-service npx prisma migrate deploy
docker-compose exec user-service npx prisma migrate deploy
```

### Testing

```bash
# Run all workspace tests
yarn run test

# Run service-specific tests
docker-compose exec auth-service yarn test
docker-compose exec user-service yarn test
docker-compose exec frontend yarn test

# Run integration tests
docker-compose exec auth-service yarn run test:integration

# Run tests with coverage
yarn run test:coverage          # All workspaces
docker-compose exec auth-service yarn run test:coverage
```

## 🔒 Security Features

- **JWT Authentication**: Access and refresh token pattern
- **Role-Based Access Control**: 5 distinct user roles
- **2FA Support**: TOTP-based two-factor authentication
- **Password Security**: bcrypt hashing with 12 rounds
- **SQL Injection Prevention**: Prisma ORM built-in protection
- **Rate Limiting**: API throttling and DDoS protection
- **Audit Logging**: Complete action trail with Prisma models
- **Input Validation**: Joi-based validation with error handling

## 🌍 India-Specific Features

- **GST Compliance**: 18% tax calculations and reporting
- **Local Courier Integration**: Delhivery, Blue Dart, DTDC support
- **Regional Language Support**: Hindi and English (extensible)
- **Pincode Validation**: 6-digit Indian postal code validation
- **Currency**: INR-focused financial calculations

## 📊 Monitoring & Health Checks

### Service Health

```bash
# yarn health check commands
yarn run health                 # Backend API health
yarn run health:frontend       # Frontend health

# Direct curl commands
curl http://localhost:3001/health   # API Gateway
curl http://localhost:8002/health   # Auth Service
curl http://localhost:8003/health   # User Service
curl http://localhost:3000/api/health  # Frontend
```

### Database Health

- **Prisma Connection**: Included in service health checks
- **Query Performance**: Development query logging
- **Migration Status**: Automatic validation

## 🚀 Deployment

### Production Deployment

- **VPS Deployment**: Docker Compose on dedicated server
- **Database Migrations**: `npx prisma migrate deploy`
- **SSL Certificates**: Manual certificate management
- **Monitoring**: Health checks and structured logging
- **Backup Strategy**: Automated PostgreSQL backups

### Environment Configuration

- **Development**: Hot reload with Prisma Studio access
- **Production**: Optimized builds with connection pooling
- **Security**: Environment-based secrets management

## 📚 Documentation

- **API Specs**: See `docs/API-Specifications.md`
- **Architecture**: See `docs/SystemArchitecture.md`
- **Development Roadmap**: See `docs/DevelopmentRoadmap.md`
- **Memory Bank**: See `.serena/memories/` for project intelligence (Serena memories)

## 🤝 Contributing

### Development Standards

- **Prisma ORM**: Mandatory for all database operations
- **TypeScript**: Encouraged for type safety
- **ESLint + Prettier**: Code formatting and linting (automated via Husky)
- **Conventional Commits**: Structured commit messages (enforced via commitlint)
- **Migration-First**: Schema changes via Prisma migrations
- **Pre-commit Hooks**: Automated linting and formatting on commit
- **Smart Linting**: Only lint changed files (lint-staged)

### Code Review Checklist

- [ ] Prisma schema properly defined
- [ ] Database migrations included
- [ ] Error handling implemented
- [ ] Tests written and passing
- [ ] API documentation updated
- [ ] Pre-commit hooks pass (linting, formatting)
- [ ] Commit messages follow conventional format
- [ ] Type checking passes (for TypeScript)

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure ports 3000, 5432, 6379, 8000-8007 are available
2. **Prisma Client**: Run `npx prisma generate` after schema changes
3. **Database Connection**: Verify PostgreSQL and Redis services
4. **Migration Issues**: Use `npx prisma migrate resolve` for conflicts

### Prisma-Specific Issues

- **Schema Changes**: Always create migrations, never modify DB directly
- **Client Generation**: Required after schema updates
- **Migration Conflicts**: Use Prisma's resolution tools
- **Performance**: Use `select` and `include` strategically

---

**Project Status**: ✅ Phase 1 Week 1 Complete - Prisma Architecture Ready  
**Last Updated**: January 2024  
**Next Milestone**: User Service Development (Week 2)  
**Team**: Logistics Development Team
