# RBAC-003 Phase 1 - Swagger API Documentation

## Overview

This document provides comprehensive Swagger/OpenAPI documentation for all routes modified or created during the RBAC-003 Phase 1 implementation (Client Registration & License Integration).

---

## Service URLs

- **User Service**: http://localhost:3003/api-docs
- **Auth Service**: http://localhost:3002/api-docs
- **License Service**: http://localhost:3011/api-docs

---

## 1. NEW ENDPOINT: Client Registration with License Generation

### **POST** `/api/clients/register`

**Service**: user-service (Port 3003)
**Access**: Superadmin only
**Authentication**: Bearer JWT token required

#### Description

Creates a new license-based client with complete deployment package. This is the primary endpoint for RBAC-003 Phase 1.

**Workflow**:

1. Creates client record with `clientType=LICENSE_BASED`
2. Creates admin user in auth-service
3. Generates license via license-service
4. Builds secure Docker image (or returns pending status)
5. Returns deployment instructions and credentials

#### Request

**Headers**:

```
Authorization: Bearer {superadmin-jwt-token}
Content-Type: application/json
```

**Body** (application/json):

```json
{
  "name": "Acme Corporation",
  "email": "admin@acme.com",
  "contactPerson": "John Doe",
  "password": "SecureP@ss123!",
  "licenseType": "TRIAL|STANDARD|PROFESSIONAL|ENTERPRISE",
  "plan": "MONTHLY|QUARTERLY|YEARLY|LIFETIME",
  "services": [
    "auth-service",
    "user-service",
    "api-gateway",
    "shipment-service",
    "partner-service",
    "wallet-service"
  ],
  "maxActivations": 1,
  "validityDays": 30,
  "features": {
    "multiTenant": false,
    "whiteLabel": false,
    "apiAccess": true,
    "customDomain": false,
    "ssoEnabled": false,
    "advancedAnalytics": false
  },
  "limits": {
    "maxUsers": 25,
    "maxShipments": 10000,
    "maxCustomers": 100,
    "maxApiCalls": 50000
  },
  "registry": "docker.io/myorg",
  "enableMonitoring": false
}
```

**Required Fields**:

- `name` (string, 1-200 chars): Client company name
- `email` (string, email format): Admin user email

**Optional Fields**:

- `contactPerson` (string): Primary contact name
- `password` (string, min 8 chars, complexity required): Admin password (auto-generated if not provided)
- `licenseType` (enum): TRIAL (default: STANDARD)
- `plan` (enum): Billing plan (default: MONTHLY)
- `services` (array): Services to include (default: all core services)
- `maxActivations` (integer, min 1): Maximum activations (default: 1)
- `validityDays` (integer, min 1): License validity in days (default: 30)
- `features` (object): Feature flags
- `limits` (object): Resource limits
- `registry` (string): Docker registry URL
- `enableMonitoring` (boolean): Enable monitoring (default: false)

#### Response

**Success (201 Created)**:

```json
{
  "status": "success",
  "data": {
    "client": {
      "id": "a2138f27-dd29-41ab-80da-f0d64b4a83b4",
      "name": "Acme Corporation",
      "slug": "acme-corporation",
      "clientType": "LICENSE_BASED",
      "licenseStatus": "ACTIVE"
    },
    "license": {
      "id": "d587d2a4-f40e-4120-87cc-e5f65f758af5",
      "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "type": "TRIAL",
      "validUntil": "2025-10-24T09:55:28.954Z",
      "maxActivations": 1
    },
    "deployment": {
      "imageName": "logistics/secure-{clientId}:pending",
      "registry": "docker.io/logistics-secure",
      "tag": "pending-build",
      "buildStatus": "pending",
      "size": "N/A"
    },
    "credentials": {
      "adminEmail": "admin@acme.com",
      "temporaryPassword": "Temp{random}@123!"
    },
    "instructions": "# Logistics Platform - Secure Deployment\n\n..."
  },
  "meta": {
    "timestamp": "2025-10-10T09:55:28.964Z"
  }
}
```

**Error Responses**:

**400 Bad Request** - Validation error:

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field": "email",
      "message": "must be a valid email"
    }
  },
  "statusCode": 400
}
```

**401 Unauthorized** - Missing or invalid token:

```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  },
  "statusCode": 401
}
```

**403 Forbidden** - Non-superadmin access:

```json
{
  "status": "error",
  "error": {
    "code": "CLIENT_REGISTRATION_DENIED",
    "message": "Access denied. Only super administrators can register new clients."
  },
  "statusCode": 403
}
```

**409 Conflict** - Duplicate client:

```json
{
  "status": "error",
  "error": {
    "code": "CLIENT_SLUG_EXISTS",
    "message": "Client with slug 'acme-corporation' already exists"
  },
  "statusCode": 409
}
```

**500 Internal Server Error** - Registration failed:

```json
{
  "status": "error",
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create admin user in auth service"
  },
  "statusCode": 500
}
```

#### Example cURL Request

```bash
curl -X POST http://localhost:3003/api/clients/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "Acme Logistics Ltd",
    "email": "admin@acmelogistics.com",
    "contactPerson": "Bob Wilson",
    "licenseType": "TRIAL",
    "services": ["auth-service", "user-service", "api-gateway"],
    "maxActivations": 1,
    "validityDays": 14
  }'
```

#### Notes

- **Rollback**: If any step fails, the client record is automatically deleted
- **Password Complexity**: Auto-generated passwords meet all security requirements (uppercase, lowercase, numbers, special chars)
- **License Keys**: Generated keys are 500-800 characters (JWT-style tokens)
- **Docker Build**: Phase 1 returns "pending" status if builder is unavailable
- **Audit Logging**: Complete audit trail is automatically created
- **Temporary Credentials**: Admin should change password on first login

---

## 2. MODIFIED ENDPOINTS: Superadmin Role Support

### Auth Service Changes

The following auth-service endpoints now accept **superadmin** role in addition to **admin**:

#### **POST** `/auth/register`

- Now accepts `role: "superadmin"` in request body
- Superadmin users have all permissions across the platform
- Requires admin or superadmin authentication to create superadmin users

#### **POST** `/auth/login`

- Returns superadmin role in response for superadmin users
- JWT token includes `"role": "superadmin"`
- Full permission set included in token

#### Swagger Documentation Location

- URL: http://localhost:3002/api-docs
- All existing auth endpoints automatically support superadmin role
- No breaking changes to API contracts

### License Service Changes

#### **POST** `/api/v1/licenses/generate`

**Before**: Required `admin` role only
**Now**: Accepts `admin` OR `superadmin` role

**Updated Authorization Check**:

```javascript
// adminOnly middleware now checks:
if (decoded.role !== "admin" && decoded.role !== "superadmin") {
  throw new APIError("Admin access required", 403);
}
```

**Request** (unchanged):

```json
{
  "clientId": "uuid",
  "type": "TRIAL|STANDARD|PROFESSIONAL|ENTERPRISE",
  "plan": "MONTHLY|QUARTERLY|YEARLY|LIFETIME",
  "allowedServices": ["service1", "service2"],
  "maxActivations": 1,
  "validityDays": 30,
  "features": {},
  "limits": {}
}
```

**Response** (unchanged):

```json
{
  "status": "success",
  "data": {
    "license": {
      "id": "uuid",
      "key": "long-jwt-style-license-key",
      "type": "TRIAL",
      "plan": "MONTHLY",
      "validFrom": "2025-10-10T00:00:00Z",
      "validUntil": "2025-10-24T00:00:00Z",
      "maxActivations": 1,
      "allowedServices": ["auth-service", "user-service"],
      "status": "INACTIVE"
    }
  }
}
```

#### Other License Service Endpoints

All protected license-service endpoints now support superadmin:

- **GET** `/api/v1/licenses/:id` - Get license details
- **PUT** `/api/v1/licenses/:id/extend` - Extend license validity
- **POST** `/api/v1/licenses/:id/revoke` - Revoke license
- **GET** `/api/v1/licenses` - List all licenses

#### Swagger Documentation Location

- URL: http://localhost:3011/api-docs
- Superadmin support documented in security requirements

---

## 3. EXISTING ENDPOINTS: User Service Client Routes

These endpoints remain unchanged but are documented for completeness:

### **POST** `/api/clients`

Create a standard client (non-license-based)

- **Access**: Admin only
- **Documentation**: Lines 264-330 in routes/clients.js

### **GET** `/api/clients`

List all clients with pagination

- **Access**: Admin, support, operations
- **Documentation**: Lines 332-421

### **GET** `/api/clients/:id`

Get client by ID

- **Access**: Admin, support, or own client
- **Documentation**: Lines 423-473

### **PUT** `/api/clients/:id`

Update client information

- **Access**: Admin or own client
- **Documentation**: Lines 473-551

### **DELETE** `/api/clients/:id`

Soft delete (deactivate) client

- **Access**: Admin only
- **Documentation**: Lines 553-609

### **PUT** `/api/clients/:id/activate`

Activate or deactivate client

- **Access**: Admin only
- **Documentation**: Lines 611-681

### **GET** `/api/clients/stats`

Get client statistics

- **Access**: Admin, support
- **Documentation**: Lines 683-749

---

## 4. Validation Schema Documentation

### Client Registration Validation

**Location**: `backend/user-service/middleware/validate.js`

```javascript
registerClient: Joi.object({
  name: Joi.string().min(1).max(200).required(),
  email: Joi.string().email().required(),
  contactPerson: Joi.string().min(2).max(100).optional(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .optional()
    .messages({
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character",
    }),
  licenseType: Joi.string()
    .valid("TRIAL", "STANDARD", "PROFESSIONAL", "ENTERPRISE")
    .default("STANDARD"),
  plan: Joi.string()
    .valid("MONTHLY", "QUARTERLY", "YEARLY", "LIFETIME")
    .default("MONTHLY"),
  services: Joi.array()
    .items(
      Joi.string().valid(
        "auth-service",
        "user-service",
        "api-gateway",
        "shipment-service",
        "partner-service",
        "wallet-service",
        "platform-service",
        "support-service",
      ),
    )
    .default([
      "auth-service",
      "user-service",
      "api-gateway",
      "shipment-service",
      "partner-service",
      "wallet-service",
    ]),
  maxActivations: Joi.number().integer().min(1).default(1),
  validityDays: Joi.number().integer().min(1).default(30),
  features: Joi.object({
    multiTenant: Joi.boolean().default(false),
    whiteLabel: Joi.boolean().default(false),
    apiAccess: Joi.boolean().default(true),
    customDomain: Joi.boolean().default(false),
    ssoEnabled: Joi.boolean().default(false),
    advancedAnalytics: Joi.boolean().default(false),
  }).optional(),
  limits: Joi.object({
    maxUsers: Joi.number().integer().min(1).optional(),
    maxShipments: Joi.number().integer().min(1).optional(),
    maxCustomers: Joi.number().integer().min(1).optional(),
    maxApiCalls: Joi.number().integer().min(1).optional(),
  }).optional(),
  registry: Joi.string().optional(),
  enableMonitoring: Joi.boolean().default(false),
});
```

---

## 5. Security & Authentication

### Bearer Token Authentication

All protected endpoints require JWT Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### JWT Token Structure

```json
{
  "userId": "uuid",
  "clientId": "uuid|null",
  "role": "superadmin|admin|client|...",
  "permissions": [],
  "iat": 1760089686,
  "exp": 1760118486
}
```

### Role Hierarchy

1. **superadmin** - System owner (all permissions)
2. **admin** - Platform administrator
3. **client** - License-based customer
4. **accounts/sales/support** - Client team members
5. **customer** - Client's customer
6. **customer_account/customer_sales/customer_support** - Customer sub-users
7. **affiliate** - Commission-based partner

### Permission Format

Format: `{module}:{action}:{scope}`

Examples:

- `client:create:all` - Create clients (all scope)
- `license:generate:all` - Generate licenses
- `shipment:read:own` - Read own shipments only

---

## 6. Testing with Swagger UI

### Access Swagger UI

1. **User Service**: http://localhost:3003/api-docs
2. **Auth Service**: http://localhost:3002/api-docs
3. **License Service**: http://localhost:3011/api-docs

### Testing the Registration Endpoint

1. **Get Superadmin Token**:

   ```bash
   curl -X POST http://localhost:3002/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@logistics.com",
       "password": "SuperAdmin@123"
     }'
   ```

2. **Open Swagger UI**: http://localhost:3003/api-docs

3. **Click "Authorize"** button (top right)

4. **Enter token**: `Bearer {your-token-here}`

5. **Navigate to**: POST `/api/clients/register`

6. **Click "Try it out"**

7. **Fill in request body** and click "Execute"

8. **View response** below the request form

---

## 7. Error Codes Reference

| Code                         | HTTP Status | Description                       |
| ---------------------------- | ----------- | --------------------------------- |
| `SUCCESS`                    | 200-201     | Request successful                |
| `VALIDATION_ERROR`           | 400         | Invalid request data              |
| `UNAUTHORIZED`               | 401         | Missing or invalid authentication |
| `CLIENT_REGISTRATION_DENIED` | 403         | Insufficient permissions          |
| `CLIENT_SLUG_EXISTS`         | 409         | Duplicate client slug             |
| `ADMIN_USER_CREATION_FAILED` | 500         | Auth service error                |
| `INTERNAL_ERROR`             | 500         | Unexpected server error           |

---

## 8. Rate Limiting

License service endpoints have rate limiting:

- `/api/v1/licenses/generate`: 10 requests per minute
- `/api/v1/licenses/validate`: 50 requests per 5 minutes
- Other endpoints: 100 requests per hour

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-10-10T10:00:00Z
```

---

## 9. Changelog

### Phase 1 (2025-10-10)

**Added**:

- POST `/api/clients/register` - Complete client registration with license generation
- Superadmin role support across all services
- Comprehensive Swagger documentation for new endpoint

**Modified**:

- License service `adminOnly` middleware - Now accepts superadmin role
- Auth service authentication - Superadmin role recognition
- User service validation - Added `registerClient` schema

**Database Changes**:

- Increased `clients.activation_code` from VARCHAR(255) to VARCHAR(1000)

---

## 10. Support & Resources

- **API Documentation**: Service-specific Swagger UIs
- **RBAC Guide**: `/docs/RBAC-IMPLEMENTATION-GUIDE.md`
- **Project Overview**: `/CLAUDE.md`
- **Backend Standards**: `/.cursor/rules/backend.mdc`

---

**Document Version**: 1.0
**Last Updated**: January 10, 2025
**Implementation Phase**: RBAC-003 Phase 1 Complete
