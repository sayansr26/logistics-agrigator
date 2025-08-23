# Partner Service AGENTS.md

## Service Overview

The Partner Service manages courier partners and provides rate calculation, serviceability checking, and external API integration for logistics operations.

**Status**: ✅ Production-ready with CRUD operations, rate limiting, audit logging, and Swagger documentation.

## Development Commands

```bash
# Start partner service only
docker-compose --profile partner-service up

# Development with live reload
cd backend/partner-service
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

- **Development**: `http://localhost:3005`
- **Health Check**: `http://localhost:3005/health`
- **API Documentation**: `http://localhost:3005/api-docs`

### Database

- **Database**: `logistics_partners`
- **ORM**: Prisma
- **Models**: Partner, PartnerRate, PartnerShipment, ServiceabilityCache, AuditLog

### Key Features

- ✅ Partner CRUD operations with validation
- ✅ Rate calculation from partner rate cards
- ✅ Serviceability checking with caching (24-hour TTL)
- ✅ Comprehensive audit logging
- ✅ Rate limiting (management: 20/15min, calculations: 60/min)
- ✅ Admin-only access for partner management
- ✅ Complete Swagger documentation

## API Endpoints

### Partner Management (Admin Only)

```bash
GET    /api/partners              # List all partners
GET    /api/partners/:id          # Get partner by ID
POST   /api/partners              # Create partner (admin only)
PUT    /api/partners/:id          # Update partner (admin only)
DELETE /api/partners/:id          # Delete partner (admin only)
```

### Rate Calculation & Serviceability

```bash
POST   /api/partners/calculate        # Calculate shipping rates
POST   /api/partners/serviceability  # Check serviceability
```

### System Endpoints

```bash
GET    /health                    # Health check
GET    /api-docs                  # Swagger documentation
GET    /                          # Service information
```

## Code Patterns (Follow Exactly)

### Controller Pattern

```javascript
// controllers/partnerController.js
class PartnerController {
  static async createPartner(data, req = {}) {
    // 1. Validation (handled by middleware)
    // 2. Business logic
    const partner = await prisma.partner.create({ data });

    // 3. MANDATORY: Audit logging
    await prisma.auditLog.create({
      data: {
        action: "PARTNER_CREATED",
        resourceType: "PARTNER",
        resourceId: partner.id,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get?.("User-Agent"),
        requestData: data,
        responseData: { partnerId: partner.id, success: true },
      },
    });

    return partner;
  }
}
```

### Route Pattern

```javascript
// routes/partners.js - NO business logic here
router.post(
  "/",
  partnerManagementLimiter, // Rate limiting
  authMiddleware.authenticate, // Authentication
  authMiddleware.adminOnly, // Authorization
  validateBody(partnerSchema.create), // Validation
  async (req, res, next) => {
    try {
      const partner = await partnerController.createPartner(req.body, req);
      res.status(201).json(APIResponse.success({ partner }));
    } catch (error) {
      next(error);
    }
  },
);
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

### Partner Model

```prisma
model Partner {
  id          String  @id @default(cuid())
  name        String  @unique // e.g., "DELHIVERY"
  code        String  @unique // e.g., "DELHIVERY"
  displayName String // e.g., "Delhivery"
  isActive    Boolean @default(true)

  // API Configuration
  apiUrl     String
  apiToken   String?
  apiVersion String?

  // Service Configuration
  supportsCOD     Boolean @default(false)
  supportsReverse Boolean @default(false)
  maxWeight       Float?
  maxDimensions   Json?

  // Pricing Configuration
  baseRate         Float?
  perKgRate        Float?
  codChargePercent Float?
  fuelSurcharge    Float?

  // Service Areas
  servicePincodes String[]

  // Relations
  shipments           PartnerShipment[]
  rates               PartnerRate[]
  serviceabilityCache ServiceabilityCache[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("partners")
}
```

## Rate Limiting Configuration

```javascript
// middleware/rateLimiter.js
const partnerManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 operations per window
});

const rateCalculationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 calculations per minute
});

const serviceabilityLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 checks per minute
});
```

## Testing

### Health Check

```bash
curl http://localhost:3005/health
```

### API Testing

```bash
# Get all partners (requires auth token)
curl -H "Authorization: Bearer <token>" http://localhost:3005/api/partners

# Calculate rates
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"fromPincode":"110001","toPincode":"400001","weight":2.5,"serviceType":"SURFACE"}' \
  http://localhost:3005/api/partners/calculate
```

### Swagger Testing

Open `http://localhost:3005/api-docs` for interactive API testing.

## Current Development Status

### ✅ Completed (PARTNER-001)

- Service structure aligned with auth-service patterns
- Complete CRUD operations with proper validation
- Rate limiting and security middleware
- Comprehensive audit logging
- Swagger documentation
- Health monitoring
- Live reload enabled

### 🔄 Next Priority (PARTNER-002)

- External API integration client
- Real-time charge calculation from external services
- Serviceability checking with external APIs
- Replace rate card calculations with live API calls

## External Dependencies (For PARTNER-002)

### Required for Next Phase

- **External Partner Micro Service** (Port 8007)
- **Partner Micro Service API documentation**
- **Authentication credentials** for external service

### Courier API Integrations (Planned)

- **Delhivery API**: Rate calculation and tracking
- **Blue Dart API**: Express delivery services
- **DTDC API**: Domestic courier services
- **Ecom Express API**: E-commerce logistics

## Troubleshooting

### Common Issues

1. **Import path errors**: Use `./shared` from server.js, `../shared` from subdirectories
2. **Rate limiting**: Check if hitting rate limits (headers show remaining requests)
3. **Authentication**: Ensure valid JWT token with proper role
4. **Database**: Verify PostgreSQL connection and migrations

### Debug Commands

```bash
# Check service logs
docker-compose logs -f partner-service

# Access container
docker exec -it logistics-partner-service sh

# Check database
cd backend/partner-service && npx prisma studio
```
