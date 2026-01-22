# 🚀 Quick Start - Testing License Service

## ⚡ Quick Generation (Fastest Way)

**Just run the automated script:**

```bash
cd backend/license-service
./test-license-api.sh
```

**First time setup? Follow the 3-step process below.**

---

## 🎯 3-Step Quick Setup

### Step 1: Create Admin User (One-time setup)

```bash
# Generate bcrypt hash for password "Admin@123456"
docker exec logistics-auth-service node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('Admin@123456', 12).then(hash => console.log(hash));"

# Copy the hash output, then insert admin user
docker exec -it logistics-postgres psql -U logistics -d logistics_auth -c "
INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@logistics.com',
  '<PASTE_HASH_HERE>',
  'Admin User',
  'admin',
  true,
  NOW(),
  NOW()
);"
```

### Step 2: Login & Get Token

```bash
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@logistics.com","password": "Admin@123456"}'
```

**Copy the `accessToken` from response.**

### Step 3: Generate License

```bash
# Replace YOUR_TOKEN with the token from Step 2
curl -X POST http://localhost:3011/api/v1/licenses/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "STANDARD",
    "plan": "MONTHLY",
    "allowedServices": ["auth-service", "user-service", "api-gateway", "shipment-service"],
    "maxActivations": 2,
    "validityDays": 30
  }'
```

**✅ Done! Save the license key from the response.**

---

## 🔧 Alternative Methods

### Method A: One-Line Setup (Pre-hashed Password)

If you want to skip hash generation, use this pre-generated hash for password `Admin@123456`:

```bash
docker exec -it logistics-postgres psql -U logistics -d logistics_auth -c "
INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@logistics.com',
  '\$2a\$12\$hbuF46L1/Oq39QA//sHsC.IgQwP67KLjsH2lEIj.6BMfepjHE7Ikq',
  'Admin User',
  'admin',
  true,
  NOW(),
  NOW()
);"
```

Then proceed to Step 2 and 3 above.

---

## ❓ Common Issues

### Problem: "Invalid token" Error

The license service `/api/v1/licenses/generate` endpoint requires admin authentication.

```json
{
  "status": "error",
  "error": { "code": "INTERNAL_ERROR", "message": "Invalid token" }
}
```

This happens because:

1. You need a valid JWT token with `role: 'admin'`
2. The token comes from the auth-service
3. You need an admin user in the database first

**Solution**: Follow the 3-Step Quick Setup above

### Problem: "Invalid email or password"

Your admin user might not exist or the password hash is incorrect.

**Solution**: Use Method A (One-Line Setup) with the pre-hashed password

### Problem: Services not running

```bash
curl: (7) Failed to connect to localhost
```

**Solution**: Start the services first

```bash
# Start all services
pnpm run dev

# Check health
curl http://localhost:3002/health  # Auth service
curl http://localhost:3011/health  # License service
```

---

## 🚀 Complete Automated Flow (Copy-Paste Ready)

**For users who already have services running:**

```bash
# 1. Create admin user (one-time)
docker exec -it logistics-postgres psql -U logistics -d logistics_auth -c "
INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@logistics.com',
  '\$2a\$12\$hbuF46L1/Oq39QA//sHsC.IgQwP67KLjsH2lEIj.6BMfepjHE7Ikq',
  'Admin User',
  'admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;"

# 2. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@logistics.com","password":"Admin@123456"}' \
  | jq -r '.data.accessToken')

echo "Token: $TOKEN"

# 3. Generate license
curl -X POST http://localhost:3011/api/v1/licenses/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "STANDARD",
    "plan": "MONTHLY",
    "allowedServices": ["auth-service", "user-service", "api-gateway", "shipment-service"],
    "maxActivations": 2,
    "validityDays": 30
  }' | jq '.'
```

**That's it! The license key will be in the response under `.data.license.key`**

---

## 📋 Quick Command Reference

```bash
# 1. Check services are running
curl http://localhost:3002/health  # Auth service
curl http://localhost:3011/health  # License service

# 2. Login (after creating admin user)
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@logistics.com","password":"Admin@123456"}'

# 3. Generate license (replace TOKEN)
curl -X POST http://localhost:3011/api/v1/licenses/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"550e8400-e29b-41d4-a716-446655440000","type":"STANDARD","plan":"MONTHLY","allowedServices":["auth-service","user-service"],"maxActivations":2,"validityDays":30}'

# 4. Validate license (no auth required)
curl -X POST http://localhost:3011/api/v1/licenses/validate \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"YOUR_LICENSE_KEY_HERE"}'
```

## Understanding the Auth Flow

```
┌──────────────┐
│   Admin      │
│   Creates    │
│   Account    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ Auth Service │ ← POST /auth/login
│  Port 3002   │ → Returns JWT token
└──────┬───────┘
       │
       ↓ (JWT token with role: 'admin')
       │
┌──────────────┐
│License Service│ ← POST /api/v1/licenses/generate
│  Port 3011   │   Authorization: Bearer {token}
└──────┬───────┘
       │
       ↓
┌──────────────┐
│License Generated│
│  & Returned  │
└──────────────┘
```

## Error Messages Explained

| Error                         | Meaning                       | Solution                 |
| ----------------------------- | ----------------------------- | ------------------------ |
| `"Invalid token"`             | No token or invalid JWT       | Login to get fresh token |
| `"Token expired"`             | JWT token too old             | Login again              |
| `"Admin access required"`     | Token doesn't have admin role | Use admin account        |
| `"Invalid email or password"` | Wrong credentials             | Check admin user exists  |
| `"Too many requests"`         | Rate limit hit                | Wait and retry           |

## Next Steps

Once you have a license key:

1. Save it securely
2. Use it with the secure-docker-builder
3. Distribute to clients

See [SECURE-DEPLOYMENT-GUIDE.md](./SECURE-DEPLOYMENT-GUIDE.md) for complete deployment workflow.
