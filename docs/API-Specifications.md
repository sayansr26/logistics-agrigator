# Logistics Aggregator Portal - API Specifications

## API Design Standards

### Base URL Structure

```
Production: https://api.logistics.example.com
Staging: https://staging-api.logistics.example.com
Development: http://localhost:8000
```

### Versioning

All APIs follow semantic versioning with URL path versioning:

```
/api/v1/endpoint
/api/v2/endpoint
```

### Authentication

All protected endpoints require Bearer token authentication:

```
Authorization: Bearer <jwt_token>
```

### Standard Response Format

```json
{
  "status": "success|error",
  "data": {...},
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {...}
  }
}
```

### Error Codes

```json
{
  "VALIDATION_ERROR": "Input validation failed",
  "UNAUTHORIZED": "Authentication required",
  "FORBIDDEN": "Insufficient permissions",
  "NOT_FOUND": "Resource not found",
  "RATE_LIMIT_EXCEEDED": "Too many requests",
  "INTERNAL_ERROR": "Internal server error",
  "SERVICE_UNAVAILABLE": "External service unavailable"
}
```

---

## Authentication Service APIs

### Base URL: `/api/v1/auth`

#### POST /auth/register

Register a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "role": "client",
  "clientId": "uuid-optional"
}
```

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "client",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### POST /auth/login

Authenticate user and get access tokens.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "remember": false,
  "twoFactorCode": "123456"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "client",
      "clientId": "uuid",
      "permissions": ["shipment.create", "shipment.view"]
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": 3600
  }
}
```

#### POST /auth/refresh

Refresh access token using refresh token.

**Request:**

```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "accessToken": "new_jwt_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 3600
  }
}
```

#### POST /auth/logout

Invalidate user session.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### POST /auth/forgot-password

Send password reset email.

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "Password reset email sent"
  }
}
```

#### POST /auth/reset-password

Reset password using reset token.

**Request:**

```json
{
  "token": "reset_token",
  "newPassword": "NewSecurePassword123!",
  "confirmPassword": "NewSecurePassword123!"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "Password reset successfully"
  }
}
```

#### POST /auth/enable-2fa

Enable two-factor authentication.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSU...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backupCodes": ["12345678", "23456789"]
  }
}
```

#### POST /auth/verify-2fa

Verify and activate two-factor authentication.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "code": "123456"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "2FA enabled successfully",
    "backupCodes": ["12345678", "23456789"]
  }
}
```

---

## User Service APIs

### Base URL: `/api/v1/users`

#### GET /users/profile

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "isActive": true,
    "twoFactorEnabled": true,
    "client": {
      "id": "uuid",
      "name": "ABC Logistics",
      "domain": "abc-logistics.com",
      "branding": {
        "logoUrl": "https://cdn.example.com/logo.png",
        "primaryColor": "#007bff",
        "secondaryColor": "#6c757d",
        "trackingPageUrl": "https://abc-logistics.com/track"
      },
      "settings": {
        "timezone": "Asia/Kolkata",
        "currency": "INR",
        "language": "en"
      }
    },
    "permissions": ["shipment.create", "shipment.view", "wallet.access"],
    "lastLoginAt": "2024-01-01T00:00:00Z",
    "createdAt": "2023-01-01T00:00:00Z"
  }
}
```

#### PUT /users/profile

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "name": "John Smith",
  "phone": "+91-9876543210",
  "timezone": "Asia/Kolkata"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "name": "John Smith",
    "phone": "+91-9876543210",
    "timezone": "Asia/Kolkata",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /users

Get list of users (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `role`: Filter by role
- `status`: Filter by status (active/inactive)
- `search`: Search by name or email

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user1@example.com",
        "name": "User One",
        "role": "client",
        "isActive": true,
        "lastLoginAt": "2024-01-01T00:00:00Z",
        "createdAt": "2023-01-01T00:00:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### POST /users

Create new user (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "role": "operations",
  "clientId": "uuid",
  "sendInvite": true
}
```

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "name": "New User",
    "role": "operations",
    "isActive": true,
    "inviteSent": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /users/:id

Get specific user details.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "client",
    "isActive": true,
    "permissions": ["shipment.create", "shipment.view"],
    "client": {...},
    "createdAt": "2023-01-01T00:00:00Z"
  }
}
```

#### PUT /users/:id

Update user details (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "name": "Updated Name",
  "role": "admin",
  "isActive": true,
  "permissions": ["all"]
}
```

#### DELETE /users/:id

Deactivate user (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "User deactivated successfully"
  }
}
```

---

## Shipment Service APIs

### Base URL: `/api/v1/shipments`

#### POST /shipments

Create new shipment.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "type": "single",
  "order": {
    "orderId": "ORD-12345",
    "platformOrderId": "SHOP-98765",
    "platformType": "shopify",
    "customerDetails": {
      "name": "John Doe",
      "phone": "+91-9876543210",
      "email": "john@example.com",
      "alternatePhone": "+91-9876543211"
    },
    "pickupAddress": {
      "name": "Warehouse 1",
      "company": "ABC Company",
      "address": "123 Industrial Area, Near Metro Station",
      "address2": "Building B, Floor 2",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India",
      "phone": "+91-9876543210",
      "email": "warehouse@example.com"
    },
    "deliveryAddress": {
      "name": "John Doe",
      "company": "Customer Company",
      "address": "456 Residential Area, Sector 15",
      "address2": "Apartment 304",
      "city": "Delhi",
      "state": "Delhi",
      "pincode": "110001",
      "country": "India",
      "phone": "+91-9876543210",
      "alternatePhone": "+91-9876543211"
    },
    "packageDetails": {
      "weight": 1.5,
      "dimensions": {
        "length": 20,
        "width": 15,
        "height": 10
      },
      "declaredValue": 2500,
      "items": [
        {
          "name": "Product 1",
          "category": "Electronics",
          "quantity": 2,
          "unitValue": 1250,
          "weight": 0.75,
          "hsn": "8517"
        }
      ],
      "fragile": false,
      "dangerous": false
    },
    "paymentDetails": {
      "type": "COD",
      "codAmount": 2500,
      "collectionType": "cash"
    },
    "serviceDetails": {
      "courierPreference": "cost",
      "preferredCourier": "delhivery",
      "serviceType": "standard",
      "pickupTime": "morning",
      "deliveryType": "door-to-door"
    },
    "instructions": {
      "pickup": "Call before pickup",
      "delivery": "Leave at security if not available",
      "special": "Handle with care"
    }
  }
}
```

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "shipmentId": "uuid",
    "orderId": "ORD-12345",
    "awbNumber": "AWB123456789",
    "courierPartner": {
      "id": "uuid",
      "name": "Delhivery",
      "trackingUrl": "https://delhivery.com/track/{awb}"
    },
    "status": "created",
    "expectedDelivery": "2024-01-15",
    "charges": {
      "baseCharge": 45.0,
      "fuelSurcharge": 5.0,
      "handlingCharge": 2.0,
      "gst": 9.36,
      "total": 61.36
    },
    "documents": {
      "labelUrl": "https://cdn.example.com/labels/AWB123456789.pdf",
      "invoiceUrl": "https://cdn.example.com/invoices/INV-123456.pdf",
      "manifestUrl": null
    },
    "trackingDetails": {
      "trackingUrl": "https://track.logistics.com/AWB123456789",
      "brandedTrackingUrl": "https://abc-logistics.com/track/AWB123456789"
    },
    "createdAt": "2024-01-10T10:00:00Z"
  }
}
```

#### POST /shipments/bulk

Create multiple shipments from file upload.

**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request:**

```
file: <excel_or_csv_file>
courierPreference: cost|time|specific
preferredCourier: delhivery|bluedart (optional)
```

**Response (202):**

```json
{
  "status": "success",
  "data": {
    "batchId": "uuid",
    "totalRows": 1000,
    "status": "processing",
    "processedRows": 0,
    "successfulRows": 0,
    "failedRows": 0,
    "estimatedTime": "5-10 minutes",
    "statusUrl": "/api/v1/shipments/bulk/uuid/status"
  }
}
```

#### GET /shipments/bulk/:batchId/status

Get bulk upload processing status.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "batchId": "uuid",
    "status": "completed",
    "totalRows": 1000,
    "processedRows": 1000,
    "successfulRows": 950,
    "failedRows": 50,
    "errors": [
      {
        "row": 15,
        "orderId": "ORD-123",
        "error": "Invalid pincode",
        "details": "Pincode 000000 is not serviceable"
      }
    ],
    "completedAt": "2024-01-10T10:30:00Z",
    "downloadUrls": {
      "successful": "https://cdn.example.com/bulk/successful-uuid.csv",
      "failed": "https://cdn.example.com/bulk/failed-uuid.csv"
    }
  }
}
```

#### GET /shipments

Get shipment list with filtering and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by status
- `courier`: Filter by courier partner
- `dateFrom`: Start date (YYYY-MM-DD)
- `dateTo`: End date (YYYY-MM-DD)
- `search`: Search in order ID, AWB, customer name
- `platform`: Filter by platform type
- `sortBy`: Sort field (createdAt, expectedDelivery)
- `sortOrder`: Sort order (asc, desc)

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "shipments": [
      {
        "id": "uuid",
        "orderId": "ORD-12345",
        "awbNumber": "AWB123456789",
        "customerName": "John Doe",
        "deliveryCity": "Delhi",
        "courierPartner": "Delhivery",
        "status": "in-transit",
        "paymentType": "COD",
        "codAmount": 2500,
        "totalCharge": 61.36,
        "expectedDelivery": "2024-01-15",
        "createdAt": "2024-01-10T10:00:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5000,
      "totalPages": 250
    },
    "summary": {
      "totalShipments": 5000,
      "totalValue": 12500000,
      "statusBreakdown": {
        "created": 100,
        "picked": 200,
        "in-transit": 4500,
        "delivered": 150,
        "rto": 50
      }
    }
  }
}
```

#### GET /shipments/:id

Get specific shipment details.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "orderId": "ORD-12345",
    "platformOrderId": "SHOP-98765",
    "awbNumber": "AWB123456789",
    "status": "in-transit",
    "customerDetails": {
      "name": "John Doe",
      "phone": "+91-9876543210",
      "email": "john@example.com"
    },
    "addresses": {
      "pickup": {...},
      "delivery": {...}
    },
    "packageDetails": {...},
    "courierPartner": {
      "id": "uuid",
      "name": "Delhivery",
      "awbNumber": "AWB123456789",
      "trackingUrl": "https://delhivery.com/track/AWB123456789"
    },
    "timeline": [
      {
        "status": "created",
        "timestamp": "2024-01-10T10:00:00Z",
        "location": "Mumbai",
        "description": "Shipment created"
      },
      {
        "status": "picked",
        "timestamp": "2024-01-11T09:00:00Z",
        "location": "Mumbai Hub",
        "description": "Package picked up from sender"
      },
      {
        "status": "in-transit",
        "timestamp": "2024-01-11T14:00:00Z",
        "location": "Delhi Hub",
        "description": "Package in transit to destination"
      }
    ],
    "charges": {
      "breakdown": {
        "baseCharge": 45.00,
        "fuelSurcharge": 5.00,
        "handlingCharge": 2.00,
        "gst": 9.36
      },
      "total": 61.36,
      "currency": "INR"
    },
    "documents": {
      "labelUrl": "https://cdn.example.com/labels/AWB123456789.pdf",
      "invoiceUrl": "https://cdn.example.com/invoices/INV-123456.pdf",
      "podUrl": "https://cdn.example.com/pod/POD123456789.pdf"
    },
    "tracking": {
      "publicUrl": "https://track.logistics.com/AWB123456789",
      "brandedUrl": "https://abc-logistics.com/track/AWB123456789",
      "lastUpdated": "2024-01-11T14:00:00Z"
    },
    "expectedDelivery": "2024-01-15",
    "actualDelivery": null,
    "createdAt": "2024-01-10T10:00:00Z",
    "updatedAt": "2024-01-11T14:00:00Z"
  }
}
```

#### PUT /shipments/:id

Update shipment details.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "customerDetails": {
    "phone": "+91-9876543211"
  },
  "deliveryAddress": {
    "address": "Updated address",
    "pincode": "110002"
  },
  "instructions": {
    "delivery": "Updated delivery instructions"
  }
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "updatedFields": [
      "customerDetails.phone",
      "deliveryAddress",
      "instructions.delivery"
    ],
    "updatedAt": "2024-01-11T15:00:00Z"
  }
}
```

#### DELETE /shipments/:id

Cancel shipment (if allowed).

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "reason": "Customer requested cancellation",
  "refundWallet": true
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "status": "cancelled",
    "cancellationReason": "Customer requested cancellation",
    "refundAmount": 61.36,
    "refundStatus": "processed",
    "cancelledAt": "2024-01-11T16:00:00Z"
  }
}
```

#### GET /shipments/:id/tracking

Get detailed tracking information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "shipmentId": "uuid",
    "awbNumber": "AWB123456789",
    "currentStatus": "in-transit",
    "currentLocation": "Delhi Hub",
    "expectedDelivery": "2024-01-15",
    "deliveredAt": null,
    "events": [
      {
        "status": "manifested",
        "statusCode": "IT",
        "timestamp": "2024-01-10T10:30:00Z",
        "location": "Mumbai",
        "description": "Shipment manifested",
        "courierStatus": "Manifested"
      },
      {
        "status": "picked",
        "statusCode": "PP",
        "timestamp": "2024-01-11T09:00:00Z",
        "location": "Mumbai Hub",
        "description": "Package picked up from sender",
        "courierStatus": "Picked Up"
      }
    ],
    "deliveryAttempts": 0,
    "ndrEvents": [],
    "trackingUrls": {
      "courier": "https://delhivery.com/track/AWB123456789",
      "public": "https://track.logistics.com/AWB123456789",
      "branded": "https://abc-logistics.com/track/AWB123456789"
    }
  }
}
```

#### POST /shipments/:id/reattempt

Request delivery reattempt.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "reason": "Customer not available",
  "preferredDate": "2024-01-16",
  "timeSlot": "morning",
  "alternateAddress": {
    "address": "Office address",
    "contact": "+91-9876543210"
  }
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "reattemptId": "uuid",
    "scheduledDate": "2024-01-16",
    "timeSlot": "morning",
    "status": "scheduled",
    "requestedAt": "2024-01-11T17:00:00Z"
  }
}
```

---

## Platform Service APIs

### Base URL: `/api/v1/platforms`

#### GET /platforms

Get list of supported platforms.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "platforms": [
      {
        "type": "shopify",
        "name": "Shopify",
        "description": "Shopify e-commerce platform",
        "features": ["order_sync", "webhook_support", "real_time"],
        "authType": "oauth",
        "status": "active"
      },
      {
        "type": "woocommerce",
        "name": "WooCommerce",
        "description": "WooCommerce for WordPress",
        "features": ["order_sync", "webhook_support"],
        "authType": "api_key",
        "status": "coming_soon"
      }
    ]
  }
}
```

#### GET /platforms/integrations

Get user's platform integrations.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "integrations": [
      {
        "id": "uuid",
        "platform": "shopify",
        "shopDomain": "mystore.myshopify.com",
        "shopName": "My Store",
        "status": "active",
        "lastSync": "2024-01-11T14:00:00Z",
        "settings": {
          "autoSync": true,
          "syncFrequency": "real-time",
          "orderStatuses": ["paid", "fulfilled"],
          "syncNewOrders": true,
          "updateExistingOrders": false
        },
        "stats": {
          "totalOrders": 1250,
          "syncedOrders": 1200,
          "failedOrders": 50,
          "lastWeekOrders": 85
        },
        "connectedAt": "2024-01-01T10:00:00Z"
      }
    ]
  }
}
```

#### POST /platforms/shopify/connect

Connect Shopify store.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "shopDomain": "mystore.myshopify.com",
  "authCode": "authorization_code_from_shopify"
}
```

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "integrationId": "uuid",
    "platform": "shopify",
    "shopDomain": "mystore.myshopify.com",
    "shopDetails": {
      "id": 12345,
      "name": "My Store",
      "email": "store@example.com",
      "domain": "mystore.myshopify.com",
      "country": "India",
      "currency": "INR",
      "timezone": "Asia/Kolkata"
    },
    "status": "connected",
    "permissions": [
      "read_orders",
      "write_orders",
      "read_products",
      "read_customers"
    ],
    "webhooks": {
      "orders_create": "registered",
      "orders_updated": "registered",
      "orders_paid": "registered"
    },
    "connectedAt": "2024-01-11T15:00:00Z"
  }
}
```

#### PUT /platforms/integrations/:id/settings

Update integration settings.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "autoSync": true,
  "syncFrequency": "hourly",
  "orderStatuses": ["paid", "fulfilled", "partially_fulfilled"],
  "syncNewOrders": true,
  "updateExistingOrders": true,
  "defaultCourierPreference": "cost",
  "defaultService": "standard",
  "notifications": {
    "syncErrors": true,
    "orderUpdates": false
  }
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "integrationId": "uuid",
    "settings": {
      "autoSync": true,
      "syncFrequency": "hourly",
      "orderStatuses": ["paid", "fulfilled", "partially_fulfilled"],
      "syncNewOrders": true,
      "updateExistingOrders": true,
      "defaultCourierPreference": "cost"
    },
    "updatedAt": "2024-01-11T16:00:00Z"
  }
}
```

#### POST /platforms/integrations/:id/sync

Manually trigger order sync.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-11",
  "orderStatuses": ["paid", "fulfilled"],
  "forceSync": false
}
```

**Response (202):**

```json
{
  "status": "success",
  "data": {
    "syncId": "uuid",
    "status": "started",
    "estimatedOrders": 150,
    "startedAt": "2024-01-11T17:00:00Z",
    "statusUrl": "/api/v1/platforms/sync/uuid/status"
  }
}
```

#### GET /platforms/sync/:syncId/status

Get sync operation status.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "syncId": "uuid",
    "status": "completed",
    "progress": {
      "totalOrders": 150,
      "processedOrders": 150,
      "successfulOrders": 145,
      "failedOrders": 5,
      "skippedOrders": 0
    },
    "startedAt": "2024-01-11T17:00:00Z",
    "completedAt": "2024-01-11T17:15:00Z",
    "errors": [
      {
        "orderId": "SHOP-123",
        "error": "Invalid delivery address",
        "details": "Pincode not serviceable"
      }
    ]
  }
}
```

#### DELETE /platforms/integrations/:id

Disconnect platform integration.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "reason": "No longer needed",
  "removeWebhooks": true
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "integrationId": "uuid",
    "status": "disconnected",
    "webhooksRemoved": true,
    "disconnectedAt": "2024-01-11T18:00:00Z"
  }
}
```

---

## Wallet Service Integration APIs

### Base URL: `/api/v1/wallet`

#### GET /wallet/balance

Get current wallet balance.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "userId": "uuid",
    "clientId": "uuid",
    "currentBalance": 15000.5,
    "currency": "INR",
    "frozenBalance": 500.0,
    "availableBalance": 14500.5,
    "lastUpdated": "2024-01-11T15:30:00Z",
    "autoRecharge": {
      "enabled": true,
      "threshold": 1000,
      "amount": 5000,
      "nextRecharge": null
    }
  }
}
```

#### POST /wallet/topup

Add money to wallet.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "amount": 5000,
  "paymentMethod": "razorpay",
  "currency": "INR"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "transactionId": "uuid",
    "amount": 5000,
    "currency": "INR",
    "paymentGateway": "razorpay",
    "gatewayOrderId": "order_razorpay_123",
    "paymentUrl": "https://api.razorpay.com/v1/checkout/...",
    "status": "pending",
    "expiresAt": "2024-01-11T18:00:00Z"
  }
}
```

#### POST /wallet/debit

Debit amount from wallet (Internal API).

**Headers:** `Authorization: Bearer <service_token>`

**Request:**

```json
{
  "userId": "uuid",
  "amount": 61.36,
  "reference": "SHIP-uuid",
  "description": "Shipment charge for AWB123456789",
  "metadata": {
    "shipmentId": "uuid",
    "awbNumber": "AWB123456789",
    "courierPartner": "Delhivery"
  }
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "transactionId": "uuid",
    "amount": 61.36,
    "previousBalance": 15000.5,
    "newBalance": 14939.14,
    "reference": "SHIP-uuid",
    "status": "completed",
    "processedAt": "2024-01-11T16:00:00Z"
  }
}
```

#### POST /wallet/credit

Credit amount to wallet (Internal API).

**Headers:** `Authorization: Bearer <service_token>`

**Request:**

```json
{
  "userId": "uuid",
  "amount": 61.36,
  "reference": "REFUND-uuid",
  "description": "Refund for cancelled shipment AWB123456789",
  "metadata": {
    "originalTransactionId": "uuid",
    "refundReason": "Shipment cancelled"
  }
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "transactionId": "uuid",
    "amount": 61.36,
    "previousBalance": 14939.14,
    "newBalance": 15000.5,
    "reference": "REFUND-uuid",
    "status": "completed",
    "processedAt": "2024-01-11T17:00:00Z"
  }
}
```

#### GET /wallet/transactions

Get wallet transaction history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `page`: Page number
- `limit`: Items per page
- `type`: Transaction type (debit/credit)
- `dateFrom`: Start date
- `dateTo`: End date
- `reference`: Filter by reference

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "debit",
        "amount": 61.36,
        "balance": 14939.14,
        "reference": "SHIP-uuid",
        "description": "Shipment charge for AWB123456789",
        "status": "completed",
        "metadata": {
          "shipmentId": "uuid",
          "awbNumber": "AWB123456789"
        },
        "createdAt": "2024-01-11T16:00:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 500,
      "totalPages": 25
    },
    "summary": {
      "totalDebits": 50000,
      "totalCredits": 60000,
      "netBalance": 10000
    }
  }
}
```

---

## Support Service APIs

### Base URL: `/api/v1/support`

#### POST /support/tickets

Create support ticket.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "type": "dispute",
  "priority": "high",
  "subject": "Package delivered damaged",
  "description": "The package was delivered in damaged condition. Photos attached.",
  "category": "delivery_issue",
  "shipmentId": "uuid",
  "attachments": [
    "https://cdn.example.com/evidence/photo1.jpg",
    "https://cdn.example.com/evidence/photo2.jpg"
  ],
  "metadata": {
    "awbNumber": "AWB123456789",
    "deliveryDate": "2024-01-11"
  }
}
```

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "ticketId": "uuid",
    "ticketNumber": "TICKET-12345",
    "type": "dispute",
    "priority": "high",
    "status": "open",
    "subject": "Package delivered damaged",
    "category": "delivery_issue",
    "assignedTo": null,
    "sla": {
      "responseTime": 4,
      "resolutionTime": 24,
      "responseDeadline": "2024-01-11T20:00:00Z",
      "resolutionDeadline": "2024-01-12T16:00:00Z"
    },
    "createdAt": "2024-01-11T16:00:00Z"
  }
}
```

#### GET /support/tickets

Get ticket list.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `status`: Filter by status
- `type`: Filter by type
- `priority`: Filter by priority
- `assignedTo`: Filter by assigned agent
- `dateFrom`: Start date
- `dateTo`: End date

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "tickets": [
      {
        "id": "uuid",
        "ticketNumber": "TICKET-12345",
        "type": "dispute",
        "priority": "high",
        "status": "in-progress",
        "subject": "Package delivered damaged",
        "category": "delivery_issue",
        "assignedTo": {
          "id": "uuid",
          "name": "Support Agent",
          "email": "agent@example.com"
        },
        "lastUpdated": "2024-01-11T18:00:00Z",
        "createdAt": "2024-01-11T16:00:00Z"
      }
    ]
  }
}
```

#### GET /support/tickets/:id

Get ticket details.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "ticketNumber": "TICKET-12345",
    "type": "dispute",
    "priority": "high",
    "status": "in-progress",
    "subject": "Package delivered damaged",
    "description": "The package was delivered in damaged condition. Photos attached.",
    "category": "delivery_issue",
    "shipment": {
      "id": "uuid",
      "orderId": "ORD-12345",
      "awbNumber": "AWB123456789"
    },
    "assignedTo": {
      "id": "uuid",
      "name": "Support Agent",
      "email": "agent@example.com"
    },
    "sla": {
      "responseTime": 4,
      "resolutionTime": 24,
      "responseDeadline": "2024-01-11T20:00:00Z",
      "resolutionDeadline": "2024-01-12T16:00:00Z",
      "breached": false
    },
    "timeline": [
      {
        "action": "created",
        "timestamp": "2024-01-11T16:00:00Z",
        "user": "John Doe",
        "description": "Ticket created"
      },
      {
        "action": "assigned",
        "timestamp": "2024-01-11T17:00:00Z",
        "user": "System",
        "description": "Assigned to Support Agent"
      },
      {
        "action": "comment",
        "timestamp": "2024-01-11T18:00:00Z",
        "user": "Support Agent",
        "description": "Investigating the issue with courier partner"
      }
    ],
    "attachments": [
      {
        "id": "uuid",
        "filename": "damage_photo1.jpg",
        "url": "https://cdn.example.com/evidence/photo1.jpg",
        "uploadedAt": "2024-01-11T16:00:00Z"
      }
    ],
    "createdAt": "2024-01-11T16:00:00Z",
    "updatedAt": "2024-01-11T18:00:00Z"
  }
}
```

#### POST /support/tickets/:id/comments

Add comment to ticket.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "comment": "We have contacted the courier partner and they are investigating the issue.",
  "internal": false,
  "attachments": ["https://cdn.example.com/evidence/courier_response.pdf"]
}
```

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "commentId": "uuid",
    "comment": "We have contacted the courier partner and they are investigating the issue.",
    "internal": false,
    "author": {
      "id": "uuid",
      "name": "Support Agent"
    },
    "attachments": [
      {
        "filename": "courier_response.pdf",
        "url": "https://cdn.example.com/evidence/courier_response.pdf"
      }
    ],
    "createdAt": "2024-01-11T19:00:00Z"
  }
}
```

#### PUT /support/tickets/:id/status

Update ticket status.

**Headers:** `Authorization: Bearer <token>`

**Request:**

```json
{
  "status": "resolved",
  "resolution": "Compensation of ₹500 credited to wallet for damaged package",
  "compensationAmount": 500,
  "internal_notes": "Customer satisfied with resolution"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "ticketId": "uuid",
    "status": "resolved",
    "resolution": "Compensation of ₹500 credited to wallet for damaged package",
    "resolvedBy": {
      "id": "uuid",
      "name": "Support Agent"
    },
    "resolvedAt": "2024-01-11T20:00:00Z"
  }
}
```

---

## Partner Service Integration APIs

### Base URL: `/api/v1/partners`

#### POST /partners/calculate

Calculate shipping charges.

**Headers:** `Authorization: Bearer <service_token>`

**Request:**

```json
{
  "origin": {
    "pincode": "400001",
    "city": "Mumbai",
    "state": "Maharashtra"
  },
  "destination": {
    "pincode": "110001",
    "city": "Delhi",
    "state": "Delhi"
  },
  "package": {
    "weight": 1.5,
    "dimensions": {
      "length": 20,
      "width": 15,
      "height": 10
    },
    "declaredValue": 2500
  },
  "serviceType": "standard",
  "paymentType": "COD",
  "codAmount": 2500,
  "preferences": {
    "courierPartner": "any",
    "priority": "cost"
  }
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "calculations": [
      {
        "partnerId": "uuid",
        "partnerName": "Delhivery",
        "serviceType": "standard",
        "charges": {
          "baseCharge": 45.0,
          "weightCharge": 0.0,
          "codCharge": 15.0,
          "fuelSurcharge": 5.0,
          "handlingCharge": 2.0,
          "gst": 12.06,
          "total": 79.06
        },
        "transitTime": {
          "min": 2,
          "max": 3,
          "unit": "days"
        },
        "serviceable": true,
        "cutoffTime": "18:00",
        "features": ["tracking", "cod", "insurance"]
      },
      {
        "partnerId": "uuid",
        "partnerName": "Blue Dart",
        "serviceType": "express",
        "charges": {
          "baseCharge": 85.0,
          "weightCharge": 10.0,
          "codCharge": 20.0,
          "fuelSurcharge": 8.0,
          "handlingCharge": 5.0,
          "gst": 23.04,
          "total": 151.04
        },
        "transitTime": {
          "min": 1,
          "max": 2,
          "unit": "days"
        },
        "serviceable": true,
        "cutoffTime": "16:00",
        "features": ["tracking", "cod", "insurance", "priority"]
      }
    ],
    "recommended": {
      "cost": "delhivery",
      "time": "bluedart",
      "balanced": "delhivery"
    }
  }
}
```

#### GET /partners/serviceability

Check serviceability for a location.

**Headers:** `Authorization: Bearer <service_token>`

**Query Parameters:**

- `pincode`: Destination pincode
- `origin`: Origin pincode (optional)
- `serviceType`: Service type (optional)

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "pincode": "110001",
    "city": "Delhi",
    "state": "Delhi",
    "serviceable": true,
    "partners": [
      {
        "partnerId": "uuid",
        "partnerName": "Delhivery",
        "services": ["standard", "express"],
        "codAvailable": true,
        "maxCodAmount": 50000,
        "transitTime": "2-3 days"
      },
      {
        "partnerId": "uuid",
        "partnerName": "Blue Dart",
        "services": ["express", "priority"],
        "codAvailable": true,
        "maxCodAmount": 25000,
        "transitTime": "1-2 days"
      }
    ],
    "restrictions": {
      "maxWeight": 50,
      "maxValue": 100000,
      "restrictedItems": ["batteries", "liquids"]
    }
  }
}
```

#### GET /partners

Get list of available partners.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "partners": [
      {
        "id": "uuid",
        "name": "Delhivery",
        "code": "DELHIVERY",
        "logo": "https://cdn.example.com/logos/delhivery.png",
        "services": ["Surface", "Express"],
        "coverage": {
          "pincodes": 25000,
          "cities": 2500,
          "states": 29
        },
        "features": [
          "Real-time tracking",
          "COD available",
          "API integration",
          "Bulk processing"
        ],
        "performanceMetrics": {
          "onTimeDelivery": 92.5,
          "averageTransitTime": 2.8,
          "rtoPercentage": 8.5
        },
        "status": "active"
      }
    ]
  }
}
```

---

This comprehensive API specification provides detailed endpoints for all services in the Logistics Aggregator Portal, including request/response formats, authentication requirements, and error handling. The APIs are designed to be RESTful, consistent, and developer-friendly while maintaining security and performance standards.
