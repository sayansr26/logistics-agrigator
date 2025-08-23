# Auth Service AGENTS.md

## Service Overview

The Auth Service is the **reference implementation** for all other services in the logistics platform. It handles authentication, authorization, JWT token management, 2FA, and role-based access control (RBAC).

**Status**: ✅ **Production Ready** - 10 endpoints, complete documentation, health monitoring  
**Reference Pattern**: ALL other services MUST follow this service's patterns exactly.

## Development Commands

```bash
# Start auth service only
docker-compose --profile auth-service up

# Development with live reload
cd backend/auth-service
pnpm install
pnpm run dev

# Database operations
npx prisma generate
npx prisma migrate deploy
npx prisma studio

# Testing
pnpm test
```

## Service Architecture

### Port Configuration

- **Development**: `http://localhost:3002`
- **Health Check**: `http://localhost:3002/health`
- **API Documentation**: `http://localhost:3002/api-docs`

### Database

- **Database**: `logistics_auth`
- **ORM**: Prisma
- **Models**: User, Session, AuditLog, TwoFactorAuth

### Key Features

- ✅ JWT authentication with refresh tokens
- ✅ Role-based access control (admin, operations, client, finance)
- ✅ Two-factor authentication (2FA) with TOTP
- ✅ Session management with Redis
- ✅ Comprehensive audit logging
- ✅ Rate limiting per endpoint type
- ✅ Password security with bcrypt (12+ rounds)
- ✅ Complete Swagger documentation

## API Endpoints

### Authentication

```bash
POST   /auth/register           # User registration
POST   /auth/login              # User login
POST   /auth/logout             # User logout
POST   /auth/refresh            # Refresh JWT token
POST   /auth/forgot-password    # Password reset request
POST   /auth/reset-password     # Password reset confirmation
```

### Two-Factor Authentication

```bash
POST   /auth/2fa/setup          # Setup 2FA
POST   /auth/2fa/verify         # Verify 2FA token
POST   /auth/2fa/disable        # Disable 2FA
```

### User Management

```bash
GET    /auth/me                 # Get current user info
PUT    /auth/profile            # Update user profile
```

### System Endpoints

```bash
GET    /health                  # Health check
GET    /api-docs                # Swagger documentation
```

## REFERENCE PATTERNS (Copy These Exactly)

### 1. Controller Pattern

```javascript
// controllers/authController.js
class AuthController {
  static async register(req, res) {
    try {
      // 1. Input validation (handled by middleware)
      const { email, password, firstName, lastName } = req.body;

      // 2. Business logic
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, firstName, lastName },
        select: { id: true, email: true, role: true, createdAt: true },
      });

      // 3. MANDATORY: Audit logging
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          resource: "user",
          resourceId: user.id,
          changes: { email: user.email, role: user.role },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // 4. Standard response
      res.status(201).json(APIResponse.success({ user }));
    } catch (error) {
      logger.error("Registration error:", error);
      throw error;
    }
  }
}
```

### 2. Route Pattern

```javascript
// routes/auth.js - NO business logic here
router.post(
  "/register",
  registrationLimiter, // Rate limiting
  validateBody(authSchemas.register), // Input validation
  AuthController.register, // Controller method only
);
```

### 3. Middleware Pattern

```javascript
// middleware/auth.js - Service wrapper for shared middleware
const { authMiddleware } = require("../shared/lib/auth");

module.exports = {
  authenticate: authMiddleware.authenticate,
  authorize: authMiddleware.authorize,
  requireRole: authMiddleware.requireRole,
  adminOnly: authMiddleware.adminOnly,
  clientOrHigher: authMiddleware.clientOrHigher,
  operationsOrHigher: authMiddleware.operationsOrHigher,
  financeOrAdmin: authMiddleware.financeOrAdmin,
};
```

### 4. Shared Library Usage

```javascript
// From server.js (root level)
const logger = require("./shared/lib/logger");

// From controllers/, middleware/, routes/
const APIResponse = require("../shared/lib/response");
const { ConflictError, ValidationError } = require("../shared/lib/errors");
const { authMiddleware } = require("../shared/lib/auth");
```

### 5. Server Configuration

```javascript
// server.js - Standard pattern
require("dotenv").config();
process.env.SERVICE_NAME = "auth-service";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const logger = require("./shared/lib/logger");

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Logging
app.use(logger.httpLogger);

// Routes
app.use("/auth", authRoutes);

// Health check (MANDATORY)
app.get("/health", async (req, res) => {
  // Health check implementation
});

// Swagger docs (MANDATORY)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Error handling (MANDATORY)
app.use(errorHandler);
```

## Database Schema

### User Model

```prisma
model User {
  id        String  @id @default(cuid())
  email     String  @unique
  password  String
  firstName String
  lastName  String
  role      Role    @default(CLIENT)
  isActive  Boolean @default(true)

  // 2FA Configuration
  twoFactorEnabled Boolean @default(false)
  twoFactorSecret  String?

  // Metadata
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  sessions  Session[]
  auditLogs AuditLog[]

  @@map("users")
}

enum Role {
  ADMIN
  OPERATIONS
  FINANCE
  CLIENT
}
```

## Rate Limiting Configuration

```javascript
// middleware/rateLimiter.js
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts
});

const sensitiveOperationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
});
```

## Security Implementation

### JWT Configuration

```javascript
// JWT token generation
const token = jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || "3600s" },
);

const refreshToken = jwt.sign(
  { userId: user.id, type: "refresh" },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" },
);
```

### Password Security

```javascript
// Password hashing (12+ rounds)
const hashedPassword = await bcrypt.hash(password, 12);

// Password verification
const isValid = await bcrypt.compare(password, user.password);
```

## Testing

### Health Check

```bash
curl http://localhost:3002/health
```

### Authentication Flow

```bash
# Register user
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","firstName":"Test","lastName":"User"}' \
  http://localhost:3002/auth/register

# Login
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}' \
  http://localhost:3002/auth/login

# Access protected endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:3002/auth/me
```

### Swagger Testing

Open `http://localhost:3002/api-docs` for interactive API testing.

## Role-Based Access Control

### Role Hierarchy

```
ADMIN > OPERATIONS > FINANCE > CLIENT
```

### Permission Matrix

- **ADMIN**: Full system access, user management
- **OPERATIONS**: Shipment management, partner operations
- **FINANCE**: Financial operations, wallet management
- **CLIENT**: Own data access, shipment creation

## Current Status

### ✅ Production Ready Features

- Complete authentication system with JWT
- Role-based access control (RBAC)
- Two-factor authentication (2FA)
- Session management with Redis
- Comprehensive audit logging
- Rate limiting and security
- Complete Swagger documentation
- Health monitoring

### 📊 Performance Metrics

- **Response Time**: <200ms for auth operations
- **Security**: bcrypt 12+ rounds, JWT rotation
- **Reliability**: 99.9% uptime target
- **Rate Limits**: Configurable per endpoint type

## Integration with Other Services

### Service Dependencies

- **Redis**: Session storage and caching
- **PostgreSQL**: User data and audit logs
- **Shared Libraries**: Authentication middleware for other services

### Used By

- **All Services**: Authentication and authorization
- **API Gateway**: Request routing and validation
- **Frontend**: User authentication flows

## Troubleshooting

### Common Issues

1. **JWT token expired**: Use refresh token endpoint
2. **Rate limiting**: Check rate limit headers
3. **2FA issues**: Verify TOTP time sync
4. **Database connection**: Check PostgreSQL status

### Debug Commands

```bash
# Check service logs
docker-compose logs -f auth-service

# Access container
docker exec -it logistics-auth-service sh

# Check database
cd backend/auth-service && npx prisma studio
```

---

**CRITICAL**: This service serves as the **reference implementation** for all other services. When creating or modifying other services, ALWAYS follow the patterns established in this auth service.
