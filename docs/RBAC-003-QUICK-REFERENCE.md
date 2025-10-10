# RBAC-003 Quick Reference Card

## Client Registration Endpoint

### Endpoint

```
POST http://localhost:3003/api/clients/register
```

### Headers

```
Authorization: Bearer {superadmin-jwt-token}
Content-Type: application/json
```

### Minimal Request

```json
{
  "name": "Company Name",
  "email": "admin@company.com"
}
```

### Full Request Example

```json
{
  "name": "Acme Logistics Ltd",
  "email": "admin@acmelogistics.com",
  "contactPerson": "John Doe",
  "licenseType": "TRIAL",
  "plan": "MONTHLY",
  "services": ["auth-service", "user-service", "api-gateway"],
  "maxActivations": 1,
  "validityDays": 30,
  "features": {
    "apiAccess": true,
    "whiteLabel": false
  },
  "limits": {
    "maxUsers": 25,
    "maxShipments": 10000
  }
}
```

### cURL Command

```bash
curl -X POST http://localhost:3003/api/clients/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN" \
  -d '{
    "name": "Acme Logistics Ltd",
    "email": "admin@acmelogistics.com",
    "contactPerson": "John Doe",
    "licenseType": "TRIAL",
    "services": ["auth-service", "user-service", "api-gateway"],
    "validityDays": 14
  }'
```

### Success Response (201)

```json
{
  "status": "success",
  "data": {
    "client": {
      "id": "uuid",
      "name": "Acme Logistics Ltd",
      "slug": "acme-logistics-ltd",
      "clientType": "LICENSE_BASED",
      "licenseStatus": "ACTIVE"
    },
    "license": {
      "id": "uuid",
      "key": "eyJhbGc...",
      "type": "TRIAL",
      "validUntil": "2025-10-24T09:55:28.954Z",
      "maxActivations": 1
    },
    "credentials": {
      "adminEmail": "admin@acmelogistics.com",
      "temporaryPassword": "Temp{random}@123!"
    },
    "deployment": {
      "imageName": "logistics/secure-{clientId}:pending",
      "buildStatus": "pending"
    },
    "instructions": "# Deployment instructions markdown..."
  }
}
```

## License Types

| Type             | Description          | Default Validity | Max Activations |
| ---------------- | -------------------- | ---------------- | --------------- |
| **TRIAL**        | Trial license        | 14 days          | 1               |
| **STANDARD**     | Standard license     | 365 days         | 1               |
| **PROFESSIONAL** | Professional license | 365 days         | 3               |
| **ENTERPRISE**   | Enterprise license   | 365 days         | 5               |

## Billing Plans

- **MONTHLY** - Monthly subscription
- **QUARTERLY** - Quarterly subscription
- **YEARLY** - Annual subscription
- **LIFETIME** - One-time purchase

## Available Services

- `auth-service` - Authentication & authorization
- `user-service` - User & client management
- `api-gateway` - API routing & security
- `shipment-service` - Shipment tracking
- `partner-service` - Courier partner integration
- `wallet-service` - Payment & wallet management
- `platform-service` - E-commerce integrations
- `support-service` - Support ticket system

## Common Error Codes

| Code                         | Status | Solution                   |
| ---------------------------- | ------ | -------------------------- |
| `VALIDATION_ERROR`           | 400    | Check request format       |
| `UNAUTHORIZED`               | 401    | Add valid Bearer token     |
| `CLIENT_REGISTRATION_DENIED` | 403    | Use superadmin token       |
| `CLIENT_SLUG_EXISTS`         | 409    | Use different company name |
| `INTERNAL_ERROR`             | 500    | Check service logs         |

## Testing Steps

1. **Get superadmin token**:

   ```bash
   curl -X POST http://localhost:3002/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@logistics.com","password":"SuperAdmin@123"}'
   ```

2. **Save token** from response: `data.accessToken`

3. **Register client** using token

4. **Save credentials** from response for client login

5. **Client can login** using:
   - Email: From response `credentials.adminEmail`
   - Password: From response `credentials.temporaryPassword`

## Swagger UI Access

- **User Service**: http://localhost:3003/api-docs
- **Auth Service**: http://localhost:3002/api-docs
- **License Service**: http://localhost:3011/api-docs

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  POST /api/clients/register (Superadmin)                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │ 1. Create Client   │
    │    Record          │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ 2. Create Admin    │
    │    User in Auth    │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ 3. Generate        │
    │    License         │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ 4. Update Client   │
    │    with License    │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ 5. Docker Build    │
    │    (or pending)    │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ 6. Return Package  │
    │    with Credentials│
    └────────────────────┘
```

## Rollback Behavior

If ANY step fails:

- Client record is automatically deleted
- No orphaned records left behind
- Error details returned in response

## Important Notes

1. **Password Security**: Auto-generated passwords meet all complexity requirements
2. **License Keys**: ~500-800 characters (JWT-style tokens)
3. **Docker Build**: Returns "pending" status in Phase 1 (builder not yet configured)
4. **Temporary Password**: Client admin should change on first login
5. **Audit Trail**: All operations logged automatically
6. **Unique Slugs**: Generated from company name, must be unique

---

**Quick Help**:

- Full documentation: `/docs/RBAC-003-SWAGGER-DOCUMENTATION.md`
- Troubleshooting: Check service logs with `docker logs logistics-user-service`
- Support: Refer to `/CLAUDE.md` for project overview
