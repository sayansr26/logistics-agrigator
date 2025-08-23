# User Service AGENTS.md

## Service Overview

The User Service manages user profiles, client accounts, multi-tenant client management, and white-label branding configurations. It extends the auth service with comprehensive user management capabilities.

**Status**: ✅ **Production Ready** - 25+ endpoints, multi-tenant client management, white-label branding  
**Pattern**: Follows auth-service patterns exactly.

## Development Commands

```bash
# Start user service only
docker-compose --profile user-service up

# Development with live reload
cd backend/user-service
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

- **Development**: `http://localhost:3003`
- **Health Check**: `http://localhost:3003/health`
- **API Documentation**: `http://localhost:3003/api-docs`

### Database

- **Database**: `logistics_users`
- **ORM**: Prisma
- **Models**: User, Client, ClientSettings, UserInvitation, AuditLog

### Key Features

- ✅ Multi-tenant client management
- ✅ White-label branding configurations
- ✅ User profile management
- ✅ Client invitation system
- ✅ Role-based client access
- ✅ Comprehensive audit logging
- ✅ Rate limiting and security
- ✅ Complete Swagger documentation

## API Endpoints

### User Management

```bash
GET    /api/users                    # List users (admin/operations)
GET    /api/users/:id               # Get user by ID
PUT    /api/users/:id               # Update user profile
DELETE /api/users/:id               # Delete user (admin only)
GET    /api/users/profile           # Get current user profile
PUT    /api/users/profile           # Update current user profile
```

### Client Management

```bash
GET    /api/clients                 # List clients
GET    /api/clients/:id             # Get client details
POST   /api/clients                 # Create client (admin/operations)
PUT    /api/clients/:id             # Update client
DELETE /api/clients/:id             # Delete client (admin only)
GET    /api/clients/:id/users       # Get client users
POST   /api/clients/:id/users       # Add user to client
DELETE /api/clients/:id/users/:userId # Remove user from client
```

### Client Settings & Branding

```bash
GET    /api/clients/:id/settings    # Get client settings
PUT    /api/clients/:id/settings    # Update client settings
GET    /api/clients/:id/branding    # Get branding configuration
PUT    /api/clients/:id/branding    # Update branding configuration
```

### User Invitations

```bash
GET    /api/invitations             # List invitations
POST   /api/invitations             # Send invitation
PUT    /api/invitations/:id/accept  # Accept invitation
PUT    /api/invitations/:id/decline # Decline invitation
DELETE /api/invitations/:id         # Cancel invitation
```

### System Endpoints

```bash
GET    /health                      # Health check
GET    /api-docs                    # Swagger documentation
```

## Code Patterns (Following Auth Service)

### Controller Pattern

```javascript
// controllers/userController.js
class UserController {
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updates = req.body;

      // Business logic
      const user = await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          updatedAt: true,
        },
      });

      // MANDATORY: Audit logging
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "UPDATE",
          resource: "user",
          resourceId: userId,
          changes: updates,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ user }));
    } catch (error) {
      logger.error("Profile update error:", error);
      throw error;
    }
  }
}
```

### Multi-Tenant Client Management

```javascript
// controllers/clientController.js
class ClientController {
  static async createClient(req, res) {
    try {
      const clientData = req.body;

      // Create client with default settings
      const client = await prisma.client.create({
        data: {
          ...clientData,
          settings: {
            create: {
              allowSelfRegistration: false,
              requireApproval: true,
              maxUsers: 100,
            },
          },
        },
        include: {
          settings: true,
          _count: { select: { users: true } },
        },
      });

      // Audit logging
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CLIENT_CREATED",
          resource: "client",
          resourceId: client.id,
          changes: clientData,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.status(201).json(APIResponse.success({ client }));
    } catch (error) {
      logger.error("Client creation error:", error);
      throw error;
    }
  }
}
```

### Shared Library Usage

```javascript
// From server.js (root level)
const logger = require("./shared/lib/logger");

// From controllers/, middleware/, routes/
const APIResponse = require("../shared/lib/response");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const { authMiddleware } = require("../shared/lib/auth");
```

## Database Schema

### User Model

```prisma
model User {
  id        String  @id @default(cuid())
  email     String  @unique
  firstName String
  lastName  String
  role      Role    @default(CLIENT)
  isActive  Boolean @default(true)

  // Client Association
  clientId String?
  client   Client? @relation(fields: [clientId], references: [id])

  // Profile Information
  phone    String?
  avatar   String?
  timezone String?
  language String  @default("en")

  // Metadata
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  sentInvitations     UserInvitation[] @relation("InvitationSender")
  receivedInvitations UserInvitation[] @relation("InvitationReceiver")
  auditLogs           AuditLog[]

  @@map("users")
}
```

### Client Model

```prisma
model Client {
  id          String  @id @default(cuid())
  name        String
  code        String  @unique
  description String?
  isActive    Boolean @default(true)

  // Contact Information
  contactEmail String?
  contactPhone String?
  address      Json?

  // Subscription Information
  subscriptionTier String @default("basic")
  maxUsers         Int    @default(10)

  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  users    User[]
  settings ClientSettings?

  @@map("clients")
}
```

### Client Settings Model

```prisma
model ClientSettings {
  id       String @id @default(cuid())
  clientId String @unique
  client   Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  // Authentication Settings
  allowSelfRegistration Boolean @default(false)
  requireApproval       Boolean @default(true)
  passwordPolicy        Json?

  // Branding Settings
  logoUrl        String?
  primaryColor   String?
  secondaryColor String?
  customDomain   String?

  // Feature Flags
  enabledFeatures String[]

  // Notification Settings
  emailNotifications Boolean @default(true)
  smsNotifications   Boolean @default(false)

  // API Settings
  apiRateLimit Int     @default(1000)
  webhookUrl   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("client_settings")
}
```

## Multi-Tenant Features

### Client Isolation

```javascript
// Middleware for client-scoped queries
const clientScopeMiddleware = (req, res, next) => {
  if (req.user.role === "CLIENT" && req.user.clientId) {
    req.clientScope = { clientId: req.user.clientId };
  }
  next();
};

// Usage in controllers
const users = await prisma.user.findMany({
  where: {
    ...req.clientScope, // Automatically scopes to client
    isActive: true,
  },
});
```

### White-Label Branding

```javascript
// Get client branding
const getBranding = async (clientId) => {
  const settings = await prisma.clientSettings.findUnique({
    where: { clientId },
    select: {
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      customDomain: true,
    },
  });

  return {
    logo: settings?.logoUrl || "/default-logo.png",
    colors: {
      primary: settings?.primaryColor || "#3B82F6",
      secondary: settings?.secondaryColor || "#64748B",
    },
    domain: settings?.customDomain,
  };
};
```

## Rate Limiting Configuration

```javascript
// middleware/rateLimiter.js
const userManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 operations per window
});

const clientManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 operations per window (admin only)
});

const invitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 invitations per hour
});
```

## Testing

### Health Check

```bash
curl http://localhost:3003/health
```

### User Management

```bash
# Get user profile (requires auth token)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3003/api/users/profile

# Update profile
curl -X PUT -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"firstName":"Updated","lastName":"Name"}' \
  http://localhost:3003/api/users/profile
```

### Client Management

```bash
# Create client (admin only)
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"name":"Test Client","code":"TEST_CLIENT"}' \
  http://localhost:3003/api/clients

# Get client settings
curl -H "Authorization: Bearer <token>" \
  http://localhost:3003/api/clients/:id/settings
```

### Swagger Testing

Open `http://localhost:3003/api-docs` for interactive API testing.

## Current Status

### ✅ Production Ready Features

- Multi-tenant client management system
- White-label branding configurations
- User profile management with role-based access
- Client invitation system with approval workflow
- Comprehensive audit logging
- Rate limiting and security
- Complete Swagger documentation
- Health monitoring

### 📊 Performance Metrics

- **25+ API endpoints** fully documented
- **Multi-tenant architecture** with client isolation
- **White-label support** with custom branding
- **Role-based access control** integration

## Integration Points

### Dependencies

- **Auth Service**: User authentication and JWT validation
- **Redis**: Caching and session management
- **PostgreSQL**: User and client data storage

### Used By

- **Frontend**: User profile and client management UI
- **Other Services**: User context and client information
- **API Gateway**: User routing and client-specific configurations

## Troubleshooting

### Common Issues

1. **Client scope errors**: Verify user has proper clientId association
2. **Permission denied**: Check role-based access permissions
3. **Invitation issues**: Verify email configuration and templates
4. **Branding not loading**: Check asset URLs and CORS settings

### Debug Commands

```bash
# Check service logs
docker-compose logs -f user-service

# Access container
docker exec -it logistics-user-service sh

# Check database
cd backend/user-service && npx prisma studio
```

---

**Note**: This service follows auth-service patterns exactly and extends them with multi-tenant capabilities. Always maintain consistency with the auth service reference implementation.
