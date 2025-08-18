# Project Intelligence - Logistics Aggregator Portal

## CRITICAL: Database Technology Decision

**WE ALWAYS USE PRISMA ORM - NEVER RAW SQL QUERIES**

This is a fundamental architectural decision that affects all services and development patterns.

## Critical Implementation Paths

### Database & ORM Patterns (MANDATORY)
```javascript
// Standard Prisma service setup
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error']
});

// Standard CRUD operations
const user = await prisma.user.create({
  data: { email, passwordHash, role },
  select: { id: true, email: true, role: true }
});

// Always use transactions for complex operations
await prisma.$transaction(async (tx) => {
  const shipment = await tx.shipment.create({ data: shipmentData });
  const auditLog = await tx.auditLog.create({ data: auditData });
});
```

### Prisma Schema Patterns
```prisma
// Standard model pattern for all services
model User {
  id                   String   @id @default(uuid()) @db.Uuid
  email                String   @unique @db.VarChar(255)
  passwordHash         String   @map("password_hash") @db.VarChar(255)
  role                 Role
  isActive             Boolean  @default(true) @map("is_active")
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  // Always include audit trail
  auditLogs            AuditLog[]
  
  @@map("users")
}
```

### Error Handling with Prisma
```javascript
// Use shared Prisma error helpers
const { prismaHelpers } = require('@logistics/shared');

try {
  const result = await prisma.user.create({ data });
} catch (error) {
  const formattedError = prismaHelpers.handlePrismaError(error);
  return res.status(400).json({
    status: 'error',
    error: formattedError
  });
}
```

## Development Workflow Intelligence

### Prisma Development Workflow
```bash
# ALWAYS follow this workflow for database changes
1. Edit prisma/schema.prisma
2. npx prisma migrate dev --name description  
3. npx prisma generate
4. Update code to use new schema
5. Test with npx prisma studio
```

### Migration Patterns
- **Development**: `npx prisma migrate dev`
- **Production**: `npx prisma migrate deploy`
- **Never**: Direct database schema modifications
- **Always**: Version controlled migration files

### Service Structure with Prisma
```javascript
// Standard service architecture
// controllers/userController.js
const { prisma } = require('../config/database');

class UserController {
  static async createUser(req, res) {
    try {
      const user = await prisma.user.create({
        data: req.body,
        select: { id: true, email: true, role: true }
      });
      
      res.json({ status: 'success', data: { user } });
    } catch (error) {
      const formattedError = prismaHelpers.handlePrismaError(error);
      res.status(400).json({ status: 'error', error: formattedError });
    }
  }
}
```

## Critical Patterns Summary

### ALWAYS DO:
- ✅ Use Prisma for all database operations
- ✅ Create migrations for schema changes
- ✅ Use Prisma's type-safe operations
- ✅ Handle Prisma errors with shared utilities
- ✅ Use transactions for complex operations
- ✅ Use `select` and `include` for performance
- ✅ Generate Prisma client after schema changes

### NEVER DO:  
- ❌ Write raw SQL queries
- ❌ Direct database schema modifications
- ❌ Skip migration files
- ❌ Ignore Prisma error codes
- ❌ Use unsafe database operations
- ❌ Modify database without updating schema.prisma

## Integration Patterns

### Existing Services Integration
- **Wallet Service**: API client with Axios (existing service)
- **Partner Service**: API client with Axios (existing service) 
- **Internal Services**: Prisma for all new microservices

### Docker Integration
```dockerfile
# Standard Dockerfile pattern for Prisma services
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate  # Always generate client
COPY . .
CMD ["node", "server.js"]
```

```yaml
# Docker compose pattern
auth-service:
  # ... other config
  command: sh -c "npx prisma migrate deploy && npm run dev"
```

## Security & Compliance

### Prisma Security Benefits
- **SQL Injection Prevention**: Built-in protection
- **Type Safety**: Compile-time query validation
- **Connection Management**: Secure connection pooling
- **Query Logging**: Development debugging capabilities

### Audit Patterns with Prisma
```javascript
// Standard audit logging
await prisma.auditLog.create({
  data: {
    userId: req.user.id,
    action: 'CREATE',
    resource: 'user',
    resourceId: user.id,
    changes: { email: user.email, role: user.role },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  }
});
```

---

**Key Takeaway**: Prisma ORM is mandatory for all database operations in this project. It provides type safety, migration management, and excellent developer experience while maintaining security and performance.

**Last Updated**: January 2024 - Prisma adoption completed