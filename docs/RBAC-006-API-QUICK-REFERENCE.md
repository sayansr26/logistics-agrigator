# RBAC-006: Customer Management APIs - Quick Reference

## Authentication

All endpoints require JWT Bearer token:

```bash
Authorization: Bearer <your-jwt-token>
```

---

## Customer Management APIs

### 1. Create Customer

**Endpoint**: `POST /api/v1/customers`
**Permission**: `customer:create:parent`
**Who Can Use**: client role

```bash
curl -X POST http://localhost:3003/api/v1/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "email": "contact@acme.com",
    "phone": "+919876543210",
    "monthlyShipmentLimit": 1000,
    "enabledModules": ["shipment", "billing", "wallet", "analytics"],
    "isActive": true
  }'
```

**Response** (201 Created):

```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "uuid",
      "clientId": "uuid",
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "enabledModules": ["shipment", "billing", "wallet", "analytics"],
      "isActive": true,
      "createdAt": "2025-10-10T12:00:00Z"
    },
    "message": "Customer created successfully"
  }
}
```

---

### 2. List Customers

**Endpoint**: `GET /api/v1/customers`
**Permission**: `customer:read:assigned`
**Who Can Use**: client, accounts, sales, support (scope-filtered)

```bash
curl -X GET "http://localhost:3003/api/v1/customers?page=1&limit=10&search=acme&isActive=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters**:

- `page` (integer, default: 1)
- `limit` (integer, default: 10, max: 100)
- `search` (string) - Search by name or email
- `isActive` (boolean)
- `sortBy` (string, default: createdAt)
- `sortOrder` (asc|desc, default: desc)

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "customers": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasMore": true,
      "hasPrevious": false
    },
    "filters": {
      "search": "acme",
      "isActive": true
    }
  }
}
```

---

### 3. Get Customer Details

**Endpoint**: `GET /api/v1/customers/:customerId`
**Permission**: `customer:read:assigned`

```bash
curl -X GET http://localhost:3003/api/v1/customers/{customerId} \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "uuid",
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "enabledModules": ["shipment", "billing"],
      "client": {
        "id": "uuid",
        "name": "Client Name",
        "slug": "client-slug"
      },
      "userProfiles": [...],
      "customerUsers": [...]
    }
  }
}
```

---

### 4. Update Customer

**Endpoint**: `PUT /api/v1/customers/:customerId`
**Permission**: `customer:update:assigned`

```bash
curl -X PUT http://localhost:3003/api/v1/customers/{customerId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyShipmentLimit": 2000,
    "enabledModules": ["shipment", "billing", "wallet"]
  }'
```

---

### 5. Deactivate Customer

**Endpoint**: `DELETE /api/v1/customers/:customerId`
**Permission**: `customer:delete:assigned`

```bash
curl -X DELETE http://localhost:3003/api/v1/customers/{customerId} \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "message": "Customer deactivated successfully",
    "customer": {
      "id": "uuid",
      "name": "Acme Corporation",
      "isActive": false
    },
    "impact": {
      "userProfilesDeactivated": 5,
      "customerUsersDeactivated": 3
    }
  }
}
```

---

## Customer Sub-User Management

### 6. Add Customer Sub-User

**Endpoint**: `POST /api/v1/customers/:customerId/users`
**Permission**: `customer:manage:parent`

```bash
curl -X POST http://localhost:3003/api/v1/customers/{customerId}/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "role": "customer_account",
    "enabledModules": ["shipment", "billing"]
  }'
```

**Roles Available**:

- `customer` - Full customer access
- `customer_account` - Finance/billing access
- `customer_sales` - Sales operations
- `customer_support` - Support access

---

### 7. List Customer Sub-Users

**Endpoint**: `GET /api/v1/customers/:customerId/users`
**Permission**: `customer:read:assigned`

```bash
curl -X GET http://localhost:3003/api/v1/customers/{customerId}/users \
  -H "Authorization: Bearer $TOKEN"
```

---

### 8. Update Customer Sub-User

**Endpoint**: `PUT /api/v1/customers/:customerId/users/:userId`
**Permission**: `customer:update:assigned`

```bash
curl -X PUT http://localhost:3003/api/v1/customers/{customerId}/users/{userId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "customer_sales",
    "enabledModules": ["shipment", "analytics"]
  }'
```

---

### 9. Remove Customer Sub-User

**Endpoint**: `DELETE /api/v1/customers/:customerId/users/:userId`
**Permission**: `customer:delete:assigned`

```bash
curl -X DELETE http://localhost:3003/api/v1/customers/{customerId}/users/{userId} \
  -H "Authorization: Bearer $TOKEN"
```

---

## Team Assignment APIs

### 10. Assign Customers to Team Member

**Endpoint**: `POST /api/v1/assignments/customers`
**Permission**: `user:assign:parent`
**Who Can Use**: client role

```bash
curl -X POST http://localhost:3003/api/v1/assignments/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "team-member-uuid",
    "customerIds": ["customer-uuid-1", "customer-uuid-2"],
    "accessLevel": "RESTRICTED"
  }'
```

**Access Levels**:

- `FULL` - Access to all customers under parent client
- `RESTRICTED` - Access only to assigned customers

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "clientUser": {
      "id": "uuid",
      "userId": "team-member-uuid",
      "assignedCustomerIds": ["customer-uuid-1", "customer-uuid-2"],
      "accessLevel": "RESTRICTED"
    },
    "message": "2 customer(s) assigned successfully",
    "assignedCount": 2
  }
}
```

---

### 11. Unassign Customers from Team Member

**Endpoint**: `DELETE /api/v1/assignments/customers`
**Permission**: `user:assign:parent`

```bash
curl -X DELETE http://localhost:3003/api/v1/assignments/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "team-member-uuid",
    "customerIds": ["customer-uuid-1"]
  }'
```

---

### 12. Bulk Assignment

**Endpoint**: `POST /api/v1/assignments/bulk`
**Permission**: `user:assign:parent`

```bash
curl -X POST http://localhost:3003/api/v1/assignments/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignments": [
      {
        "userId": "sales-user-1",
        "customerIds": ["customer-1", "customer-2"],
        "accessLevel": "RESTRICTED"
      },
      {
        "userId": "sales-user-2",
        "customerIds": ["customer-3", "customer-4"],
        "accessLevel": "RESTRICTED"
      }
    ]
  }'
```

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "message": "Bulk assignment completed",
    "totalRequested": 2,
    "successful": 2,
    "failed": 0,
    "updatedUsers": [...]
  }
}
```

---

### 13. Update Access Level

**Endpoint**: `PUT /api/v1/users/:userId/access-level`
**Permission**: `user:update:parent`

```bash
curl -X PUT http://localhost:3003/api/v1/users/{userId}/access-level \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accessLevel": "FULL"
  }'
```

---

## Dashboard APIs

### 14. Client Dashboard

**Endpoint**: `GET /api/v1/dashboard/client`
**Permission**: `analytics:read:parent`
**Who Can Use**: client role

```bash
curl -X GET http://localhost:3003/api/v1/dashboard/client \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "client": {
      "id": "uuid",
      "name": "Client Name",
      "licenseStatus": "ACTIVE",
      "licenseDaysRemaining": 365
    },
    "customers": {
      "total": 50,
      "active": 45,
      "inactive": 5
    },
    "users": {
      "total": 20,
      "active": 18,
      "roleDistribution": {
        "accounts": 3,
        "sales": 10,
        "support": 5
      }
    },
    "summary": {
      "totalCustomers": 50,
      "activeCustomers": 45,
      "totalUsers": 20,
      "licenseStatus": "ACTIVE"
    }
  }
}
```

---

### 15. Customer Dashboard

**Endpoint**: `GET /api/v1/dashboard/customer`
**Permission**: `analytics:read:own`
**Who Can Use**: customer role

```bash
curl -X GET http://localhost:3003/api/v1/dashboard/customer \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "uuid",
      "name": "Acme Corporation",
      "enabledModules": ["shipment", "billing"],
      "client": {
        "name": "Client Name"
      }
    },
    "team": {
      "total": 5,
      "roleDistribution": {
        "customer": 1,
        "customer_account": 2,
        "customer_sales": 2
      }
    },
    "shipmentUsage": {
      "limit": 1000,
      "used": 0,
      "remaining": 1000,
      "percentage": 0
    }
  }
}
```

---

### 16. Team Member Dashboard

**Endpoint**: `GET /api/v1/dashboard/team`
**Permission**: `analytics:read:assigned`
**Who Can Use**: accounts, sales, support roles

```bash
curl -X GET http://localhost:3003/api/v1/dashboard/team \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "role": "sales",
      "accessLevel": "RESTRICTED"
    },
    "assignedCustomers": {
      "customers": [
        {
          "id": "uuid",
          "name": "Customer 1",
          "email": "customer1@example.com",
          "enabledModules": ["shipment", "billing"]
        }
      ],
      "count": 1
    },
    "summary": {
      "role": "sales",
      "accessLevel": "RESTRICTED",
      "assignedCustomerCount": 1
    }
  }
}
```

---

## Error Responses

### 400 Bad Request (Validation Error)

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### 401 Unauthorized

```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Access denied. No token provided."
  }
}
```

### 403 Forbidden

```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions. Required: customer:create:parent"
  }
}
```

### 404 Not Found

```json
{
  "status": "error",
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer with ID 'uuid' not found"
  }
}
```

### 409 Conflict

```json
{
  "status": "error",
  "error": {
    "code": "CUSTOMER_EMAIL_EXISTS",
    "message": "Customer with email 'contact@acme.com' already exists for this client"
  }
}
```

---

## Scope Filtering Behavior

### Client Role

- Can see: All customers under their account
- Scope: `parent`

### Accounts/Sales/Support with FULL Access

- Can see: All customers under parent client
- Scope: `parent`

### Accounts/Sales/Support with RESTRICTED Access

- Can see: Only assigned customers
- Scope: `assigned`

### Customer Role

- Can see: Own customer data only
- Scope: `own`

---

## Validation Rules

### Customer

- `name`: 2-200 characters, required
- `email`: Valid email format, required
- `phone`: E.164 format (e.g., +919876543210), optional
- `monthlyShipmentLimit`: Integer >= 0, optional
- `enabledModules`: Array of valid modules, optional

### Valid Modules

- `shipment`
- `billing`
- `wallet`
- `analytics`
- `support`

### Customer User Roles

- `customer`
- `customer_account`
- `customer_sales`
- `customer_support`

### Access Levels

- `FULL` - Access to all parent client's customers
- `RESTRICTED` - Access only to assigned customers

---

## Testing with curl

### Get JWT Token First

```bash
# Login to get token
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@example.com","password":"password"}' \
  | jq -r '.data.accessToken')

# Use token in requests
curl -X GET http://localhost:3003/api/v1/customers \
  -H "Authorization: Bearer $TOKEN"
```

---

## Swagger Documentation

Access interactive API documentation:

```
http://localhost:3003/api-docs
```

All endpoints are fully documented with:

- Request/response examples
- Parameter descriptions
- Authentication requirements
- Error responses

---

**Last Updated**: October 10, 2025
**Service**: user-service
**Port**: 3003
**Base URL**: `/api/v1`
