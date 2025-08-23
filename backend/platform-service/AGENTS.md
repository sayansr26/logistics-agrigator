# Platform Service AGENTS.md

## Service Overview

The Platform Service manages e-commerce platform integrations, starting with Shopify OAuth integration, order synchronization, webhook management, and order-to-shipment conversion workflows.

**Status**: 📋 **Planned** - E-commerce platform integrations  
**Pattern**: Will follow auth-service patterns exactly.

## Development Commands

```bash
# Start platform service only
docker-compose --profile platform-service up

# Development with live reload
cd backend/platform-service
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

- **Development**: `http://localhost:3007`
- **Health Check**: `http://localhost:3007/health`
- **API Documentation**: `http://localhost:3007/api-docs`

### Database

- **Database**: `logistics_platforms`
- **ORM**: Prisma
- **Models**: Platform, PlatformConnection, Order, OrderItem, Webhook, AuditLog

### Key Features (Planned)

- 📋 Shopify OAuth 2.0 authentication flow
- 📋 Multi-platform integration support
- 📋 Order synchronization workflows
- 📋 Webhook management system
- 📋 Order-to-shipment conversion logic
- 📋 Bulk order processing capabilities
- 📋 Platform-specific settings storage
- 📋 Real-time order event handling

## API Endpoints (Planned)

### Platform Management

```bash
GET    /api/platforms                   # List supported platforms
GET    /api/platforms/:id               # Get platform details
POST   /api/platforms/:id/connect       # Connect to platform
DELETE /api/platforms/:id/disconnect    # Disconnect from platform
GET    /api/platforms/:id/status        # Get connection status
```

### Shopify Integration

```bash
GET    /api/shopify/auth                # Initiate Shopify OAuth
GET    /api/shopify/callback            # OAuth callback handler
POST   /api/shopify/webhook             # Webhook endpoint
GET    /api/shopify/orders              # Sync orders from Shopify
POST   /api/shopify/orders/sync         # Manual order sync
```

### Order Management

```bash
GET    /api/orders                      # List platform orders
GET    /api/orders/:id                  # Get order details
POST   /api/orders/:id/convert          # Convert order to shipment
PUT    /api/orders/:id/status           # Update order status
POST   /api/orders/bulk-convert         # Bulk order conversion
```

### Webhook Management

```bash
GET    /api/webhooks                    # List webhooks
POST   /api/webhooks                    # Create webhook
PUT    /api/webhooks/:id                # Update webhook
DELETE /api/webhooks/:id               # Delete webhook
GET    /api/webhooks/:id/logs           # Get webhook logs
```

### System Endpoints

```bash
GET    /health                          # Health check
GET    /api-docs                        # Swagger documentation
```

## Code Patterns (Following Auth Service)

### Controller Pattern

```javascript
// controllers/shopifyController.js
class ShopifyController {
  static async initiateAuth(req, res) {
    try {
      const { shop } = req.query;
      const userId = req.user.id;

      // Generate OAuth URL
      const authUrl = shopifyService.generateAuthUrl(shop, {
        scopes: ["read_orders", "write_orders", "read_products"],
        redirectUri: `${process.env.APP_URL}/api/shopify/callback`,
        state: userId, // Pass user ID for callback
      });

      // Store pending connection
      await prisma.platformConnection.create({
        data: {
          userId,
          platform: "SHOPIFY",
          shopDomain: shop,
          status: "PENDING",
          authUrl,
        },
      });

      // MANDATORY: Audit logging
      await prisma.auditLog.create({
        data: {
          userId,
          action: "SHOPIFY_AUTH_INITIATED",
          resource: "platform_connection",
          changes: { shop, platform: "SHOPIFY" },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ authUrl }));
    } catch (error) {
      logger.error("Shopify auth initiation error:", error);
      throw error;
    }
  }

  static async handleCallback(req, res) {
    try {
      const { code, shop, state: userId } = req.query;

      // Exchange code for access token
      const tokenData = await shopifyService.exchangeCodeForToken(code, shop);

      // Store connection
      const connection = await prisma.platformConnection.update({
        where: {
          userId_platform: {
            userId,
            platform: "SHOPIFY",
          },
        },
        data: {
          status: "CONNECTED",
          accessToken: encrypt(tokenData.access_token),
          tokenScope: tokenData.scope,
          connectedAt: new Date(),
        },
      });

      // Set up webhooks
      await shopifyService.createWebhooks(shop, tokenData.access_token, [
        "orders/create",
        "orders/updated",
        "orders/cancelled",
      ]);

      // Audit logging
      await prisma.auditLog.create({
        data: {
          userId,
          action: "SHOPIFY_CONNECTED",
          resource: "platform_connection",
          resourceId: connection.id,
          changes: { shop, scope: tokenData.scope },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.redirect(`${process.env.FRONTEND_URL}/integrations?success=shopify`);
    } catch (error) {
      logger.error("Shopify callback error:", error);
      res.redirect(`${process.env.FRONTEND_URL}/integrations?error=shopify`);
    }
  }
}
```

### Order Synchronization

```javascript
// services/shopifyService.js
class ShopifyService {
  async syncOrders(connectionId) {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.status !== "CONNECTED") {
      throw new Error("Invalid or disconnected platform connection");
    }

    const accessToken = decrypt(connection.accessToken);
    const shopifyClient = new ShopifyClient(connection.shopDomain, accessToken);

    // Fetch orders from Shopify
    const orders = await shopifyClient.getOrders({
      status: "any",
      limit: 250,
      created_at_min: connection.lastSyncAt || connection.connectedAt,
    });

    // Process and store orders
    const processedOrders = [];
    for (const shopifyOrder of orders) {
      const order = await this.processShopifyOrder(shopifyOrder, connection);
      processedOrders.push(order);
    }

    // Update last sync time
    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });

    return processedOrders;
  }

  async processShopifyOrder(shopifyOrder, connection) {
    return prisma.order.upsert({
      where: {
        platformOrderId: shopifyOrder.id.toString(),
      },
      update: {
        status: this.mapShopifyStatus(shopifyOrder.fulfillment_status),
        updatedAt: new Date(),
      },
      create: {
        platformConnectionId: connection.id,
        platformOrderId: shopifyOrder.id.toString(),
        orderNumber: shopifyOrder.order_number,
        customerEmail: shopifyOrder.email,
        totalAmount: parseFloat(shopifyOrder.total_price),
        currency: shopifyOrder.currency,
        status: this.mapShopifyStatus(shopifyOrder.fulfillment_status),
        shippingAddress: shopifyOrder.shipping_address,
        billingAddress: shopifyOrder.billing_address,
        orderData: shopifyOrder, // Store full order data
        items: {
          create: shopifyOrder.line_items.map((item) => ({
            platformItemId: item.id.toString(),
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price),
            sku: item.sku,
            weight: item.grams ? item.grams / 1000 : null, // Convert to kg
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }
}
```

### Webhook Handler

```javascript
// controllers/webhookController.js
class WebhookController {
  static async handleShopifyWebhook(req, res) {
    try {
      const signature = req.get("X-Shopify-Hmac-Sha256");
      const body = req.body;
      const topic = req.get("X-Shopify-Topic");

      // Verify webhook signature
      if (!shopifyService.verifyWebhook(body, signature)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Process webhook based on topic
      switch (topic) {
        case "orders/create":
          await this.handleOrderCreated(body);
          break;
        case "orders/updated":
          await this.handleOrderUpdated(body);
          break;
        case "orders/cancelled":
          await this.handleOrderCancelled(body);
          break;
        default:
          logger.warn(`Unhandled webhook topic: ${topic}`);
      }

      // Log webhook
      await prisma.webhook.create({
        data: {
          platform: "SHOPIFY",
          topic,
          payload: body,
          processed: true,
          processedAt: new Date(),
        },
      });

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Webhook processing error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
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

## Database Schema (Planned)

### Platform Connection Model

```prisma
model PlatformConnection {
  id       String   @id @default(cuid())
  userId   String
  platform Platform

  // Connection Details
  shopDomain   String? // For Shopify
  accessToken  String // Encrypted
  refreshToken String? // Encrypted
  tokenScope   String?

  // Status
  status      ConnectionStatus @default(PENDING)
  connectedAt DateTime?
  lastSyncAt  DateTime?

  // Settings
  autoSync     Boolean @default(true)
  syncInterval Int     @default(300) // seconds

  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  orders   Order[]
  webhooks Webhook[]

  @@unique([userId, platform])
  @@map("platform_connections")
}

enum Platform {
  SHOPIFY
  WOOCOMMERCE
  MAGENTO
  AMAZON
  FLIPKART
}

enum ConnectionStatus {
  PENDING
  CONNECTED
  DISCONNECTED
  ERROR
}
```

### Order Model

```prisma
model Order {
  id                   String             @id @default(cuid())
  platformConnectionId String
  connection           PlatformConnection @relation(fields: [platformConnectionId], references: [id])

  // Platform Order Details
  platformOrderId String @unique
  orderNumber     String

  // Customer Information
  customerEmail String?
  customerPhone String?

  // Order Details
  totalAmount Float
  currency    String      @default("INR")
  status      OrderStatus

  // Addresses
  shippingAddress Json
  billingAddress  Json?

  // Conversion
  convertedToShipment Boolean @default(false)
  shipmentId          String?

  // Raw Data
  orderData Json // Store complete platform order data

  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  items OrderItem[]

  @@map("orders")
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}
```

### Order Item Model

```prisma
model OrderItem {
  id      String @id @default(cuid())
  orderId String
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  platformItemId String
  name           String
  description    String?
  quantity       Int
  price          Float
  sku            String?
  weight         Float?

  createdAt DateTime @default(now())

  @@map("order_items")
}
```

## Integration Points

### Shipment Service Integration

```javascript
// Convert order to shipment
const convertOrderToShipment = async (orderId, userId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, connection: true },
  });

  // Create shipment via Shipment Service
  const shipmentData = {
    fromAddress: order.connection.warehouseAddress,
    toAddress: order.shippingAddress,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      weight: item.weight,
      value: item.price,
    })),
    serviceType: "SURFACE",
    codAmount: order.totalAmount,
  };

  const shipmentResponse =
    await shipmentServiceClient.createShipment(shipmentData);

  // Update order
  await prisma.order.update({
    where: { id: orderId },
    data: {
      convertedToShipment: true,
      shipmentId: shipmentResponse.data.shipment.id,
    },
  });

  return shipmentResponse.data.shipment;
};
```

## Environment Configuration

```bash
# Shopify Configuration
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Platform Service URLs
SHIPMENT_SERVICE_URL=http://shipment-service:3004
USER_SERVICE_URL=http://user-service:3003

# Encryption
ENCRYPTION_KEY=your_encryption_key_for_tokens
```

## Rate Limiting Configuration

```javascript
// middleware/rateLimiter.js
const platformConnectionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 connection attempts per hour
});

const orderSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 sync operations per window
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 webhook calls per minute
});
```

## Current Development Status

### 📋 Planned (PLAT-001)

- Service foundation following auth-service patterns
- Shopify OAuth 2.0 integration
- Order synchronization workflows
- Webhook management system
- Order-to-shipment conversion logic
- Bulk order processing capabilities

### 🔄 Dependencies Required

- **Shopify App Credentials**: Client ID, Client Secret, Webhook Secret
- **Shipment Service**: For order-to-shipment conversion
- **User Service**: For user context and client information

### ✅ Prerequisites Met

- Auth Service operational (authentication patterns)
- User Service operational (user context)
- Infrastructure ready (Docker, PostgreSQL, Redis)

## Testing (When Implemented)

### Health Check

```bash
curl http://localhost:3007/health
```

### Shopify Integration

```bash
# Initiate Shopify OAuth
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3007/api/shopify/auth?shop=test-shop.myshopify.com"

# Sync orders
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3007/api/shopify/orders/sync

# Convert order to shipment
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3007/api/orders/:id/convert
```

### Webhook Testing

```bash
# Test webhook endpoint (simulate Shopify webhook)
curl -X POST -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Hmac-Sha256: <signature>" \
  -d '{"id":123,"order_number":"#1001"}' \
  http://localhost:3007/api/shopify/webhook
```

## Security Considerations

### Token Security

- **Encrypt access tokens** before storing in database
- **Rotate tokens** periodically for security
- **Validate webhook signatures** to prevent unauthorized access
- **Use HTTPS** for all OAuth redirects and webhooks

### Data Privacy

- **Store minimal customer data** required for operations
- **Implement data retention policies**
- **Comply with platform terms of service**
- **Audit all data access** and modifications

## Troubleshooting

### Common Issues (When Implemented)

1. **OAuth failures**: Check client credentials and redirect URIs
2. **Webhook signature validation**: Verify webhook secret configuration
3. **Order sync issues**: Check API rate limits and token validity
4. **Conversion failures**: Verify shipment service integration

### Debug Commands

```bash
# Check service logs
docker-compose logs -f platform-service

# Access container
docker exec -it logistics-platform-service sh

# Check database
cd backend/platform-service && npx prisma studio
```

---

**Note**: This service is planned for implementation and will follow auth-service patterns exactly. It focuses on e-commerce platform integrations starting with Shopify OAuth and order management workflows.
