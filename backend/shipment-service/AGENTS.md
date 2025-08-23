# Shipment Service AGENTS.md

## Service Overview

The Shipment Service is the core logistics service that manages shipment creation, tracking, partner selection, payment processing, and end-to-end logistics workflows. It integrates with Partner Service for rate calculation and Wallet Service for payment processing.

**Status**: 🔄 **In Development** - Integration with partner and wallet services  
**Pattern**: Follows auth-service patterns exactly.

## Development Commands

```bash
# Start shipment service only
docker-compose --profile shipment-service up

# Development with live reload
cd backend/shipment-service
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

- **Development**: `http://localhost:3004`
- **Health Check**: `http://localhost:3004/health`
- **API Documentation**: `http://localhost:3004/api-docs`

### Database

- **Database**: `logistics_shipments`
- **ORM**: Prisma
- **Models**: Shipment, ShipmentItem, ShipmentTracking, ShipmentDocument, AuditLog

### Key Features

- 🔄 End-to-end shipment creation workflow
- 🔄 Partner service integration for rate calculation
- ✅ Wallet service integration for payment processing
- 🔄 Real-time tracking and status updates
- 🔄 Label and manifest generation
- 🔄 Pickup scheduling functionality
- 🔄 NDR (Non-Delivery Report) management
- 🔄 Bulk shipment processing

## API Endpoints (Planned)

### Shipment Management

```bash
GET    /api/shipments                    # List shipments
GET    /api/shipments/:id               # Get shipment details
POST   /api/shipments                   # Create shipment
PUT    /api/shipments/:id               # Update shipment
DELETE /api/shipments/:id               # Cancel shipment
```

### Shipment Operations

```bash
POST   /api/shipments/bulk              # Bulk shipment creation
GET    /api/shipments/:id/tracking      # Get tracking information
PUT    /api/shipments/:id/status        # Update shipment status
POST   /api/shipments/:id/pickup        # Schedule pickup
```

### Rate Calculation (Partner Service Integration)

```bash
POST   /api/shipments/calculate-rates   # Calculate shipping rates
POST   /api/shipments/select-partner    # Select partner for shipment
```

### Documents & Labels

```bash
GET    /api/shipments/:id/label         # Generate shipping label
GET    /api/shipments/:id/manifest      # Generate manifest
GET    /api/shipments/:id/documents     # Get shipment documents
POST   /api/shipments/:id/documents     # Upload documents
```

### Tracking & Updates

```bash
GET    /api/shipments/:id/track         # Track shipment
POST   /api/shipments/:id/events        # Add tracking event
GET    /api/shipments/track/:awb        # Track by AWB number
```

### System Endpoints

```bash
GET    /health                          # Health check
GET    /api-docs                        # Swagger documentation
```

## Code Patterns (Following Auth Service)

### Controller Pattern

```javascript
// controllers/shipmentController.js
class ShipmentController {
  static async createShipment(req, res) {
    try {
      const shipmentData = req.body;
      const userId = req.user.id;

      // 1. Calculate rates from Partner Service
      const rateResponse = await partnerServiceClient.calculateRates({
        fromPincode: shipmentData.fromAddress.pincode,
        toPincode: shipmentData.toAddress.pincode,
        weight: shipmentData.weight,
        serviceType: shipmentData.serviceType,
        codAmount: shipmentData.codAmount,
      });

      // 2. Select best partner
      const selectedPartner = rateResponse.cheapestRate;

      // 3. Reserve payment amount (Wallet Service)
      if (shipmentData.codAmount) {
        await walletService.reserveAmount({
          userId,
          amount: selectedPartner.totalAmount,
          reference: `shipment_${Date.now()}`,
        });
      }

      // 4. Create shipment
      const shipment = await prisma.shipment.create({
        data: {
          ...shipmentData,
          userId,
          partnerId: selectedPartner.partnerId,
          calculatedRate: selectedPartner.totalAmount,
          status: "CREATED",
        },
        include: {
          items: true,
          tracking: true,
        },
      });

      // 5. MANDATORY: Audit logging
      await prisma.auditLog.create({
        data: {
          userId,
          action: "SHIPMENT_CREATED",
          resource: "shipment",
          resourceId: shipment.id,
          changes: {
            partnerId: selectedPartner.partnerId,
            rate: selectedPartner.totalAmount,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.status(201).json(APIResponse.success({ shipment }));
    } catch (error) {
      logger.error("Shipment creation error:", error);
      throw error;
    }
  }
}
```

### Partner Service Integration

```javascript
// services/partnerServiceClient.js
class PartnerServiceClient {
  constructor() {
    this.baseURL =
      process.env.PARTNER_SERVICE_URL || "http://partner-service:3005";
  }

  async calculateRates(params) {
    try {
      const response = await fetch(`${this.baseURL}/api/partners/calculate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getServiceToken()}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Partner service error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("Partner service calculation error:", error);
      throw new Error("Rate calculation failed");
    }
  }

  async checkServiceability(params) {
    // Implementation for serviceability checking
  }
}
```

### Wallet Service Integration

```javascript
// Use shared wallet service
const { walletService } = require("../shared");

// In controller
const walletClient = walletService.getWalletServiceClient();

// Reserve amount for COD shipments
await walletClient.reserveAmount({
  userId: req.user.id,
  amount: shipmentData.codAmount,
  reference: `shipment_${shipment.id}`,
  description: "COD amount reservation for shipment",
});
```

### Shared Library Usage

```javascript
// From server.js (root level)
const logger = require("./shared/lib/logger");

// From controllers/, middleware/, routes/
const APIResponse = require("../shared/lib/response");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const { walletService, walletMiddleware } = require("../shared");
```

## Database Schema

### Shipment Model

```prisma
model Shipment {
  id String @id @default(cuid())

  // User & Client Information
  userId   String
  clientId String?

  // Partner Information
  partnerId    String?
  partnerAwbNo String? @unique

  // Addresses
  fromAddress Json
  toAddress   Json

  // Package Information
  weight      Float
  dimensions  Json?
  serviceType String // SURFACE, AIR, EXPRESS

  // Pricing
  calculatedRate Float?
  actualRate     Float?
  codAmount      Float?

  // Status & Tracking
  status           String // CREATED, BOOKED, PICKED, IN_TRANSIT, DELIVERED, RTO, CANCELLED
  trackingNumber   String?   @unique
  expectedDelivery DateTime?
  actualDelivery   DateTime?

  // Pickup Information
  pickupDate     DateTime?
  pickupTimeSlot String?

  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  items     ShipmentItem[]
  tracking  ShipmentTracking[]
  documents ShipmentDocument[]

  @@map("shipments")
}
```

### Shipment Item Model

```prisma
model ShipmentItem {
  id         String   @id @default(cuid())
  shipmentId String
  shipment   Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

  name        String
  description String?
  quantity    Int
  value       Float
  weight      Float?
  hsn         String?

  createdAt DateTime @default(now())

  @@map("shipment_items")
}
```

### Shipment Tracking Model

```prisma
model ShipmentTracking {
  id         String   @id @default(cuid())
  shipmentId String
  shipment   Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

  status      String
  location    String?
  description String?
  timestamp   DateTime

  // Partner tracking information
  partnerStatus String?
  partnerData   Json?

  createdAt DateTime @default(now())

  @@map("shipment_tracking")
}
```

## Integration Points

### Partner Service Integration

```javascript
// Rate calculation workflow
const calculateShippingRates = async (shipmentData) => {
  const partnerClient = new PartnerServiceClient();

  const rates = await partnerClient.calculateRates({
    fromPincode: shipmentData.fromAddress.pincode,
    toPincode: shipmentData.toAddress.pincode,
    weight: shipmentData.weight,
    serviceType: shipmentData.serviceType,
    codAmount: shipmentData.codAmount,
  });

  return rates;
};
```

### Wallet Service Integration

```javascript
// Payment processing workflow
const processShipmentPayment = async (shipment, userId) => {
  const walletClient = walletService.getWalletServiceClient();

  if (shipment.codAmount > 0) {
    // Reserve COD amount
    await walletClient.reserveAmount({
      userId,
      amount: shipment.codAmount,
      reference: `shipment_${shipment.id}`,
    });
  }

  // Debit shipping charges
  await walletClient.debitAmount({
    userId,
    amount: shipment.calculatedRate,
    reference: `shipping_${shipment.id}`,
    description: "Shipping charges",
  });
};
```

## Rate Limiting Configuration

```javascript
// middleware/rateLimiter.js
const shipmentCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 shipments per window
});

const bulkOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 bulk operations per hour
});

const trackingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 tracking requests per minute
});
```

## Current Development Status

### 🔄 In Progress (SHIP-001)

- Partner Service integration for rate calculation
- Wallet Service integration for payment processing
- End-to-end shipment creation workflow
- Tracking and status update system

### 📋 Planned Features

- Label and manifest generation
- Pickup scheduling functionality
- NDR (Non-Delivery Report) management
- Bulk shipment processing
- Real-time tracking updates
- Document management system

### ✅ Completed

- Basic service structure following auth-service patterns
- Wallet service integration via shared library
- Database schema design
- Docker configuration

## Testing

### Health Check

```bash
curl http://localhost:3004/health
```

### Shipment Operations (When Implemented)

```bash
# Create shipment (requires auth token)
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"fromAddress":{"pincode":"110001"},"toAddress":{"pincode":"400001"},"weight":2.5}' \
  http://localhost:3004/api/shipments

# Track shipment
curl -H "Authorization: Bearer <token>" \
  http://localhost:3004/api/shipments/:id/track
```

### Integration Testing

```bash
# Test partner service integration
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"fromPincode":"110001","toPincode":"400001","weight":2.5}' \
  http://localhost:3004/api/shipments/calculate-rates
```

## Dependencies

### Required Services

- **Partner Service** (Port 3005): Rate calculation and partner selection
- **Wallet Service** (Port 8006): Payment processing and COD management
- **Auth Service** (Port 3002): User authentication and authorization
- **User Service** (Port 3003): User and client information

### External Dependencies

- **Courier APIs**: For real-time tracking and status updates
- **Label Generation**: PDF generation for shipping labels
- **Notification Service**: SMS/Email notifications for tracking updates

## Troubleshooting

### Common Issues

1. **Partner service connection**: Verify partner service is running on port 3005
2. **Wallet service errors**: Check wallet service integration and balance
3. **Rate calculation failures**: Verify partner service API responses
4. **Database connection**: Check PostgreSQL status and migrations

### Debug Commands

```bash
# Check service logs
docker-compose logs -f shipment-service

# Access container
docker exec -it logistics-shipment-service sh

# Check database
cd backend/shipment-service && npx prisma studio

# Test partner service connection
curl http://localhost:3005/health
```

---

**Note**: This service is currently in development and follows auth-service patterns. It integrates with Partner Service for logistics operations and Wallet Service for payment processing.
