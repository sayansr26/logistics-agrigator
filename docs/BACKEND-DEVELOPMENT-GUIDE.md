# Backend Development Guide

## 🎯 **Quick Start for Backend Developers**

### **Your Responsibilities**
- **Microservices Development**: Build Node.js + Express services with **Prisma ORM** 
- **API Development**: Create RESTful endpoints with proper authentication
- **Database Management**: Design Prisma schemas and manage migrations
- **Service Integration**: Connect with existing Wallet and Partner services
- **Security Implementation**: JWT authentication, RBAC, input validation
- **Documentation**: Maintain API specifications and service documentation

### **What You DON'T Touch**
- ❌ **Frontend Code**: Never modify files in `frontend/` directory
- ❌ **Frontend Dependencies**: No changes to frontend package.json or configurations
- ❌ **UI Components**: React components, pages, or styling
- ❌ **Raw SQL**: NEVER write raw SQL queries - **ALWAYS use Prisma ORM**

---

## 🚨 **CRITICAL: Database Technology Rule**

### **MANDATORY: Always Use Prisma ORM**
```javascript
// ✅ CORRECT: Use Prisma for all database operations
const user = await prisma.user.create({
  data: { email, passwordHash, role },
  select: { id: true, email: true, role: true }
});

// ❌ NEVER: Raw SQL queries are forbidden
const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
```

**Why Prisma?**
- **Type Safety**: Compile-time query validation
- **Migration Management**: Version-controlled schema changes  
- **Developer Experience**: Visual database tools (Prisma Studio)
- **Security**: Built-in SQL injection prevention
- **Performance**: Connection pooling and query optimization

---

## 📂 **Backend Project Structure**

```
backend/
├── api-gateway/               # ✅ COMPLETE - Request routing
│   ├── server.js             # Main gateway server
│   ├── middleware/           # Rate limiting, security
│   └── routes/               # Service routing configuration
├── auth-service/             # ✅ COMPLETE - Your reference implementation
│   ├── prisma/              # 🟢 Database schema & migrations
│   │   ├── schema.prisma    # Data models and relationships
│   │   └── migrations/      # Version-controlled DB changes
│   ├── controllers/         # 🟢 Route handlers with business logic
│   ├── middleware/          # 🟢 Auth, validation, error handling
│   ├── routes/              # 🟢 API route definitions
│   ├── config/              # 🟢 Database and service configuration
│   └── server.js            # Service entry point
├── user-service/            # 🔄 IN PROGRESS - Your primary focus
│   ├── prisma/             # 🟢 WORK HERE - Design user/client schemas
│   ├── controllers/        # 🟢 WORK HERE - User management logic
│   ├── middleware/         # 🟢 WORK HERE - User-specific middleware
│   ├── routes/             # 🟢 WORK HERE - User API endpoints
│   └── server.js           # 🟢 WORK HERE - Service setup
├── shipment-service/       # 📋 NEXT - Core logistics operations
│   ├── prisma/            # 🔄 FUTURE - Shipment schemas
│   ├── controllers/       # 🔄 FUTURE - Shipment CRUD operations
│   └── integrations/      # 🔄 FUTURE - Wallet/Partner service clients
├── platform-service/      # 📋 FUTURE - E-commerce integrations
│   ├── prisma/           # 🔄 FUTURE - Platform integration schemas
│   ├── integrations/     # 🔄 FUTURE - Shopify OAuth & webhooks
│   └── webhooks/         # 🔄 FUTURE - Platform webhook handlers
├── support-service/       # 📋 FUTURE - Help desk and ticketing
│   ├── prisma/           # 🔄 FUTURE - Ticket and KB schemas
│   └── controllers/      # 🔄 FUTURE - Support operations
└── shared/               # 🟢 SHARED UTILITIES - Use these
    └── lib/              # Database helpers, auth, validation
        ├── database.js   # Prisma client utilities
        ├── auth.js       # JWT and authentication helpers
        ├── validation.js # Joi validation middleware
        ├── errors.js     # Custom error classes
        └── logger.js     # Winston logging utilities
```

**Legend:**
- ✅ **Complete**: Production-ready reference implementation
- 🟢 **Work Here**: Your active development areas
- 🔄 **In Progress/Future**: Upcoming development tasks
- 📋 **Planned**: Future phase development

---

## 🚀 **Development Workflow**

### **1. Environment Setup**
```bash
# Start all services
docker-compose up

# Your services will be available at:
# API Gateway: http://localhost:8000
# Auth Service: http://localhost:8001 (✅ Complete reference)
# User Service: http://localhost:8002 (🔄 Your focus)
# Other services: ports 8003-8005

# Database access:
docker-compose exec auth-service npx prisma studio  # Visual DB browser
```

### **2. Daily Development Routine**
```bash
# Check all services
docker-compose ps

# Check service health
curl http://localhost:8000/health

# Access specific service for development
docker-compose exec user-service sh

# Inside service container:
npx prisma studio          # Visual database browser
npx prisma migrate dev      # Create new migration
npx prisma generate         # Update Prisma client
npm run dev                # Start development server
```

### **3. Service Development Pattern**
1. **Design Prisma Schema**: Define data models and relationships
2. **Create Migration**: `npx prisma migrate dev --name "description"`
3. **Generate Client**: `npx prisma generate` (automatic with migration)
4. **Build Controllers**: Implement business logic with Prisma
5. **Create Routes**: Define API endpoints
6. **Add Middleware**: Authentication, validation, error handling
7. **Test APIs**: Use Postman or curl for testing
8. **Update Documentation**: API specifications and service docs

---

## 📚 **Essential Documentation to Read**

### **Must Read Before Starting**
1. **Memory Bank Overview**: `/memory-bank/README.md` - Complete project context
2. **Project Intelligence**: `/memory-bank/projectIntelligence.md` - **CRITICAL Prisma patterns**
3. **System Patterns**: `/memory-bank/systemPatterns.md` - Architecture and design patterns
4. **Tech Context**: `/memory-bank/techContext.md` - Technology stack details

### **Reference Documentation**
- **API Specifications**: `/docs/API-Specifications.md` - API contracts and examples
- **Current Progress**: `/memory-bank/progress.md` - What's built and what's next
- **Project Brief**: `/memory-bank/projectbrief.md` - Requirements and user roles

### **Code Reference (Your Best Friend)**
- **Auth Service**: `/backend/auth-service/` - **Complete implementation example**
  - **Prisma Schema**: `prisma/schema.prisma` - Model definitions
  - **Controllers**: `controllers/authController.js` - Prisma usage patterns
  - **Middleware**: `middleware/` - Authentication and validation examples
  - **Routes**: `routes/auth.js` - API endpoint patterns

---

## 🔧 **Prisma Development Patterns**

### **Standard Service Setup**
```javascript
// config/database.js - Standard pattern for all services
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error']
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

module.exports = { prisma };
```

### **Prisma Schema Pattern**
```prisma
// prisma/schema.prisma - Standard model pattern
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique @db.VarChar(255)
  name         String   @db.VarChar(255)
  role         UserRole @default(CLIENT)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  // Always include audit trail
  auditLogs    AuditLog[]
  
  @@map("users")
}

enum UserRole {
  ADMIN
  FINANCE
  OPERATIONS
  CLIENT
  SUPPORT
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  action     String   @db.VarChar(50)
  resource   String   @db.VarChar(50)
  resourceId String?  @map("resource_id") @db.Uuid
  changes    Json?
  ipAddress  String?  @map("ip_address") @db.VarChar(45)
  userAgent  String?  @map("user_agent") @db.Text
  timestamp  DateTime @default(now())
  
  user       User     @relation(fields: [userId], references: [id])
  
  @@map("audit_logs")
}
```

### **Controller Pattern with Prisma**
```javascript
// controllers/userController.js - Standard controller pattern
const { prisma } = require('../config/database');
const { successResponse, errorResponse } = require('@logistics/shared').response;
const { handlePrismaError } = require('@logistics/shared').errors;
const logger = require('@logistics/shared').logger;

class UserController {
  static async createUser(req, res) {
    try {
      const { email, name, role } = req.body;
      
      // Create user with Prisma
      const user = await prisma.user.create({
        data: { email, name, role },
        select: { 
          id: true, 
          email: true, 
          name: true, 
          role: true,
          createdAt: true 
        }
      });
      
      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          resource: 'user',
          resourceId: user.id,
          changes: { email, name, role },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      res.status(201).json(successResponse('User created successfully', user));
      
    } catch (error) {
      logger.error('Error creating user:', error);
      
      // Handle Prisma errors
      if (error.code?.startsWith('P')) {
        const apiError = handlePrismaError(error);
        return res.status(apiError.statusCode).json(errorResponse(apiError.message));
      }
      
      res.status(500).json(errorResponse('Failed to create user'));
    }
  }
  
  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      if (!user) {
        return res.status(404).json(errorResponse('User not found'));
      }
      
      res.json(successResponse('User retrieved successfully', user));
      
    } catch (error) {
      logger.error('Error fetching user:', error);
      res.status(500).json(errorResponse('Failed to fetch user'));
    }
  }
  
  // Always include update with audit logging
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Use transaction for update + audit
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: updateData,
          select: { id: true, email: true, name: true, role: true }
        });
        
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'UPDATE',
            resource: 'user',
            resourceId: id,
            changes: updateData,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });
        
        return user;
      });
      
      res.json(successResponse('User updated successfully', result));
      
    } catch (error) {
      logger.error('Error updating user:', error);
      
      if (error.code?.startsWith('P')) {
        const apiError = handlePrismaError(error);
        return res.status(apiError.statusCode).json(errorResponse(apiError.message));
      }
      
      res.status(500).json(errorResponse('Failed to update user'));
    }
  }
}

module.exports = UserController;
```

---

## 🎯 **Week 2 Tasks: User Service Development**

### **Priority 1: Prisma Schema Design**
```bash
# Your first task: Design user and client schemas
cd backend/user-service/

# Create Prisma schema
# File: prisma/schema.prisma
```

**Schema Requirements:**
- **Client Model**: Multi-tenant client accounts with branding settings
- **UserProfile Model**: Extended user information beyond auth service
- **UserInvitation Model**: User invitation system with expiration
- **ClientSettings Model**: Client-specific configurations (timezone, currency, branding)

### **Priority 2: User Management APIs**
**Endpoints to implement:**
```javascript
// User profile management
GET    /api/v1/users/profile      // Get current user profile
PUT    /api/v1/users/profile      // Update user profile
DELETE /api/v1/users/profile      // Deactivate user account

// Client management (Admin/Finance only)
GET    /api/v1/clients            // List all clients
POST   /api/v1/clients            // Create new client
GET    /api/v1/clients/:id        // Get client details
PUT    /api/v1/clients/:id        // Update client settings
DELETE /api/v1/clients/:id        // Deactivate client

// User invitation system
POST   /api/v1/users/invite       // Send user invitation
GET    /api/v1/users/invitations  // List pending invitations
POST   /api/v1/users/accept       // Accept invitation
DELETE /api/v1/users/invitations/:id // Cancel invitation
```

### **Priority 3: Integration with Auth Service**
```javascript
// Middleware to verify JWT tokens from Auth Service
const verifyAuthServiceToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json(errorResponse('Access denied'));
    }
    
    // Verify token with Auth Service or shared JWT secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json(errorResponse('Invalid token'));
  }
};
```

### **Current Status Tracking**
- [ ] **Prisma Schema**: Design user, client, invitation models
- [ ] **Database Migration**: Create initial migration
- [ ] **User Controllers**: Profile management CRUD operations
- [ ] **Client Controllers**: Multi-tenant client management
- [ ] **API Routes**: Complete REST endpoint implementation
- [ ] **Middleware**: Auth verification and role-based access
- [ ] **Integration Testing**: Test with Auth Service
- [ ] **API Documentation**: Update API specifications

---

## 🔌 **Service Integration Patterns**

### **Integration with Existing Services**

#### **Wallet Service Integration**
```javascript
// External service client pattern
class WalletServiceClient {
  constructor() {
    this.baseURL = process.env.WALLET_SERVICE_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Add retry interceptor
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status >= 500 && error.config?.retryCount < 3) {
          error.config.retryCount = (error.config.retryCount || 0) + 1;
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.client(error.config);
        }
        return Promise.reject(error);
      }
    );
  }
  
  async getBalance(userId) {
    try {
      const response = await this.client.get(`/wallet/balance/${userId}`);
      return response.data;
    } catch (error) {
      logger.error(`Wallet service error: ${error.message}`);
      throw new APIError('Wallet service unavailable', 503);
    }
  }
  
  async debitAmount(userId, amount, reference) {
    try {
      const response = await this.client.post('/wallet/debit', {
        userId,
        amount,
        reference,
        timestamp: new Date().toISOString()
      });
      return response.data;
    } catch (error) {
      logger.error(`Wallet debit error: ${error.message}`);
      throw new APIError('Wallet transaction failed', 500);
    }
  }
}
```

#### **Partner Service Integration**
```javascript
// Courier charge calculation client
class PartnerServiceClient {
  constructor() {
    this.baseURL = process.env.PARTNER_SERVICE_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000  // Longer timeout for calculations
    });
  }
  
  async calculateShippingCharges(shipmentData) {
    try {
      const response = await this.client.post('/calculate-charges', {
        pickup: shipmentData.pickupAddress,
        delivery: shipmentData.deliveryAddress,
        weight: shipmentData.weight,
        dimensions: shipmentData.dimensions,
        declaredValue: shipmentData.declaredValue
      });
      
      return response.data.charges;
    } catch (error) {
      logger.error(`Partner service error: ${error.message}`);
      throw new APIError('Charge calculation failed', 500);
    }
  }
}
```

### **Inter-Service Communication**
```javascript
// Service-to-service communication pattern
const callAuthService = async (endpoint, method = 'GET', data = null) => {
  try {
    const config = {
      method,
      url: `${process.env.AUTH_SERVICE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.INTER_SERVICE_KEY
      }
    };
    
    if (data && method !== 'GET') {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
    
  } catch (error) {
    logger.error(`Auth service communication error: ${error.message}`);
    throw new APIError('Internal service communication failed', 500);
  }
};

// Usage in controller
const getUserAuthData = async (userId) => {
  return await callAuthService(`/internal/users/${userId}`);
};
```

---

## 🔒 **Security Implementation**

### **Authentication Middleware**
```javascript
// middleware/auth.js - JWT verification
const jwt = require('jsonwebtoken');
const { errorResponse } = require('@logistics/shared').response;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json(errorResponse('Access token required'));
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json(errorResponse('Invalid or expired token'));
    }
    
    req.user = user;
    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(errorResponse('Authentication required'));
    }
    
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasPermission = roles.some(role => userRoles.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json(errorResponse('Insufficient permissions'));
    }
    
    next();
  };
};

module.exports = { authenticateToken, requireRole };
```

### **Input Validation**
```javascript
// middleware/validation.js - Joi validation patterns
const Joi = require('joi');
const { errorResponse } = require('@logistics/shared').response;

// Standard validation schemas
const userValidation = {
  createUser: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(100).required(),
    role: Joi.string().valid('ADMIN', 'FINANCE', 'OPERATIONS', 'CLIENT', 'SUPPORT').default('CLIENT')
  }),
  
  updateUser: Joi.object({
    name: Joi.string().min(2).max(100),
    email: Joi.string().email(),
    role: Joi.string().valid('ADMIN', 'FINANCE', 'OPERATIONS', 'CLIENT', 'SUPPORT')
  }).min(1)
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json(errorResponse('Validation failed', details));
    }
    
    req.body = value;
    next();
  };
};

module.exports = { userValidation, validate };
```

### **Rate Limiting and Security Headers**
```javascript
// middleware/security.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true
});

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
});

module.exports = { apiLimiter, authLimiter, securityHeaders };
```

---

## 🧪 **Testing Your Services**

### **API Testing with Curl**
```bash
# Test user creation
curl -X POST http://localhost:8002/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "user@example.com",
    "name": "Test User",
    "role": "CLIENT"
  }'

# Test user profile retrieval
curl -X GET http://localhost:8002/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test client creation (Admin only)
curl -X POST http://localhost:8002/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Acme Corporation",
    "domain": "acme.com",
    "settings": {
      "timezone": "Asia/Kolkata",
      "currency": "INR",
      "branding": {
        "logo": "https://example.com/logo.png",
        "primaryColor": "#007bff"
      }
    }
  }'
```

### **Database Testing with Prisma Studio**
```bash
# Open visual database browser
docker-compose exec user-service npx prisma studio

# Access at: http://localhost:5555
# View tables: users, clients, user_profiles, audit_logs
# Test data manipulation visually
```

### **Service Health Checks**
```bash
# Check service health
curl http://localhost:8002/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "user-service",
  "version": "1.0.0",
  "database": "connected",
  "memory": "45MB",
  "uptime": "2h 15m"
}
```

---

## ⚠️ **Common Pitfalls & Solutions**

### **Prisma Common Issues**
```javascript
// Problem: Prisma client not generated after schema changes
// Solution: Always run after schema modifications
npx prisma generate

// Problem: Migration conflicts
// Solution: Reset database in development
npx prisma migrate reset

// Problem: Connection pool exhausted
// Solution: Properly close connections
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit();
});
```

### **Authentication Issues**
```javascript
// Problem: Token verification fails between services
// Solution: Use shared JWT secret and proper token validation
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    }
    throw new AuthenticationError('Token verification failed');
  }
};
```

### **Database Transaction Issues**
```javascript
// Problem: Race conditions in concurrent operations
// Solution: Use Prisma transactions for atomic operations
const updateUserWithAudit = async (userId, updateData, req) => {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: updateData
    });
    
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE',
        resource: 'user',
        resourceId: userId,
        changes: updateData,
        ipAddress: req.ip
      }
    });
    
    return user;
  });
};
```

---

## 📋 **Week 2 Success Criteria**

### **Must Complete (High Priority)**
- [ ] **User Service Prisma Schema**: Complete user, client, invitation models
- [ ] **User Profile APIs**: CRUD operations for user profile management
- [ ] **Client Management APIs**: Multi-tenant client administration
- [ ] **Auth Integration**: JWT verification and role-based access control
- [ ] **Database Migrations**: Working migration with seed data

### **Should Complete (Medium Priority)**
- [ ] **User Invitation System**: Send, accept, cancel invitations
- [ ] **Client Settings**: Branding and configuration management
- [ ] **Audit Logging**: Complete action trail for all operations
- [ ] **Error Handling**: Comprehensive Prisma error handling
- [ ] **API Documentation**: Updated specifications with examples

### **Nice to Have (Low Priority)**
- [ ] **Advanced Queries**: Complex filtering and search operations
- [ ] **Caching Layer**: Redis caching for frequent queries
- [ ] **Integration Testing**: Automated API testing suite
- [ ] **Performance Monitoring**: Query performance logging

---

## 🤝 **Working with Frontend Team**

### **API Contract Compliance**
```javascript
// Always use standard response format
const successResponse = (message, data = null) => ({
  status: 'success',
  message,
  data,
  timestamp: new Date().toISOString()
});

const errorResponse = (message, details = null) => ({
  status: 'error',
  error: {
    message,
    details
  },
  timestamp: new Date().toISOString()
});
```

### **CORS Configuration**
```javascript
// Enable CORS for frontend development
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
```

### **Communication Protocol**
1. **API Changes**: Update `/docs/API-Specifications.md` immediately
2. **Breaking Changes**: Notify frontend team before deployment
3. **New Endpoints**: Provide curl examples and response samples
4. **Error Codes**: Document all error codes and expected responses

---

## 📞 **Getting Help**

### **When You're Stuck**
1. **Check Auth Service**: Use as complete implementation reference
2. **Review Memory Bank**: Project patterns and architectural decisions
3. **Test with Prisma Studio**: Visual database inspection and testing
4. **Use Shared Utilities**: Pre-built error handling and validation

### **Escalation Process**
1. **Self-Debug**: Use service logs and Prisma Studio
2. **Reference Implementation**: Check Auth Service patterns
3. **Team Discussion**: Bring specific technical questions
4. **Code Review**: Submit PR for architectural guidance

### **Resources**
- **Prisma Docs**: https://www.prisma.io/docs
- **Express.js Docs**: https://expressjs.com
- **Node.js Docs**: https://nodejs.org/docs
- **JWT Guide**: https://jwt.io/introduction

---

**Backend Development Status**: ✅ **Ready for Week 2 Development**  
**Primary Focus**: User Service with Prisma ORM Implementation  
**Success Target**: Complete user and client management APIs with Auth Service integration  
**Critical Rule**: **ALWAYS use Prisma ORM - NEVER write raw SQL queries**