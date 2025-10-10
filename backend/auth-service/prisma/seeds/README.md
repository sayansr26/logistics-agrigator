# Permission Seed Data

This directory contains seed scripts for the RBAC permission system in the Auth Service.

## Overview

The seed scripts populate the database with:

- **153 Permissions** across 12 modules
- **263 Role-Permission mappings** for 11 roles
- Complete RBAC configuration for the entire system

## Files

### 1. `permissions.js`

Defines all 153 permissions in the system following the `module:action:scope` pattern.

**Modules Covered:**

- `client` (8 permissions) - Client management
- `license` (9 permissions) - License generation and management
- `customer` (15 permissions) - End customer management
- `shipment` (18 permissions) - Shipment operations
- `wallet` (15 permissions) - Wallet and payment operations
- `partner` (12 permissions) - Partner/courier management
- `user` (16 permissions) - User account management
- `billing` (12 permissions) - Billing and invoicing
- `analytics` (12 permissions) - Reports and analytics
- `support` (15 permissions) - Support tickets and disputes
- `platform` (10 permissions) - E-commerce integrations
- `settings` (10 permissions) - System and account settings
- `*` (1 permission) - Wildcard (superadmin only)

**Permission Structure:**

```javascript
{
  module: 'shipment',
  action: 'create',
  scope: 'own',
  description: 'Create shipments for own account'
}
```

### 2. `rolePermissions.js`

Maps permissions to roles based on `DEFAULT_ROLE_PERMISSIONS` from `shared/constants/permissions.js`.

**Roles Configured:**

1. **superadmin** (153 permissions) - Full system access
2. **admin** (33 permissions) - Platform administrator
3. **client** (17 permissions) - License holder
4. **accounts** (12 permissions) - Client's finance team
5. **sales** (8 permissions) - Client's sales team
6. **support** (11 permissions) - Client's support team
7. **customer** (13 permissions) - End customer
8. **customer_account** (4 permissions) - Customer's finance access
9. **customer_sales** (4 permissions) - Customer's sales access
10. **customer_support** (6 permissions) - Customer's support access
11. **affiliate** (2 permissions) - Referral partner

**Functions:**

- `seedRolePermissions(prisma, permissions)` - Create role-permission mappings
- `getRolePermissionSummary(prisma)` - Get summary for verification
- `expandWildcardPattern(pattern, permissions)` - Expand wildcard patterns

### 3. `seed.js` (Main Script)

Orchestrates the seeding process in the correct order.

**Process:**

1. Clear existing data (development only)
2. Seed all 153 permissions
3. Create role-permission mappings
4. Display summary and verification

## Usage

### Run Seeds

```bash
# Method 1: Using npm script
cd backend/auth-service
npm run db:seed

# Method 2: Using Prisma directly
npx prisma db seed

# Method 3: Direct execution
node prisma/seed.js

# Method 4: Inside Docker container
docker exec logistics-auth-service npm run db:seed
```

### Run Seeds with Migrations

```bash
# Seeds run automatically after migration
npx prisma migrate dev --name "add_permissions"

# Or reset database and reseed
npx prisma migrate reset
```

### Environment Variables

- `NODE_ENV=production` - Skips data deletion, uses upsert
- `DATABASE_URL` - PostgreSQL connection string

## Output Example

```
🌱 Starting database seeding...

Environment: development
Database: postgres:5432/logistics_auth

🧹 Clearing existing permission data...
  ✓ Deleted 0 user permissions
  ✓ Deleted 0 role permissions
  ✓ Deleted 0 permissions

📝 Seeding permissions...
✅ Created 153 permissions

📊 Permissions by module:
  shipment       : 18 permissions
  user           : 16 permissions
  customer       : 15 permissions
  wallet         : 15 permissions
  support        : 15 permissions
  ...

📋 Seeding role-permission mappings...
  Processing role: superadmin
    ✓ Created 153 permissions for superadmin
  Processing role: admin
    ✓ Created 33 permissions for admin
  ...

✅ Total role-permission mappings created: 263

📊 Final Statistics:
   Total Permissions: 153
   Total Role Mappings: 263
   Roles Configured: 11
   Modules Covered: 13
```

## Verification

### Check Permission Count

```bash
# Using Prisma Studio
npx prisma studio

# Using Node.js
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { console.log('Permissions:', await prisma.permission.count()); console.log('Role Permissions:', await prisma.rolePermission.count()); await prisma.\$disconnect(); })()"
```

### View Specific Role Permissions

```bash
# Inside Docker
docker exec logistics-auth-service node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const perms = await prisma.rolePermission.findMany({ where: { role: 'client' }, include: { permission: true } }); console.log(JSON.stringify(perms, null, 2)); await prisma.\$disconnect(); })()" | jq
```

## Idempotency

Seeds are **idempotent** - they can be run multiple times safely:

- Uses `upsert` for permissions (unique constraint on module:action:scope)
- Uses `upsert` for role permissions (unique constraint on role:permissionId)
- In development, clears existing data first for clean state
- In production, preserves existing data and updates only

## Maintenance

### Adding New Permissions

1. Add permission to `permissions.js`:

```javascript
{
  module: PERMISSION_MODULES.SHIPMENT,
  action: PERMISSION_ACTIONS.TRACK,
  scope: PERMISSION_SCOPES.OWN,
  description: 'Track own shipments in real-time'
}
```

2. Update role mappings in `shared/constants/permissions.js`:

```javascript
customer: [
  "shipment:*:own", // This will include the new permission
  // ...
];
```

3. Run seeds:

```bash
npm run db:seed
```

### Adding New Roles

1. Add role to `backend/auth-service/prisma/schema.prisma`:

```prisma
enum Role {
  // existing roles...
  new_role
}
```

2. Run migration:

```bash
npx prisma migrate dev --name "add_new_role"
```

3. Add role permissions to `shared/constants/permissions.js`:

```javascript
new_role: [
  "module:action:scope",
  // ...
];
```

4. Run seeds:

```bash
npm run db:seed
```

## Troubleshooting

### "Cannot find module" Error

**Problem:** Module path incorrect inside Docker container

**Solution:** Ensure imports use relative paths from `/app/` directory:

```javascript
// Correct for Docker environment
require("../../shared/constants/permissions");
```

### No Permissions Created

**Problem:** Migration not applied or wrong database

**Solution:**

```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Duplicate Key Error

**Problem:** Trying to create duplicate permissions

**Solution:** This shouldn't happen with upsert, but if it does:

```bash
# Clear and reseed
NODE_ENV=development npm run db:seed
```

### Permission Cache Issues

**Problem:** Permissions updated but not reflected in API

**Solution:** Clear Redis cache:

```bash
docker exec logistics-redis redis-cli FLUSHDB
```

## Integration with RBAC System

These seeds work with:

- `shared/lib/auth.js` - Permission checking functions
- `shared/middleware/requirePermission.js` - Permission middleware
- `shared/utils/scopeFilter.js` - Scope-based filtering

**Example Usage in Routes:**

```javascript
const { requirePermission } = require("../shared/middleware/requirePermission");

router.post(
  "/shipments",
  requirePermission("shipment", "create", "own"),
  shipmentController.create,
);
```

## Related Files

- `shared/constants/permissions.js` - Permission constants and role mappings
- `backend/auth-service/prisma/schema.prisma` - Database schema
- `shared/lib/auth.js` - Permission checking logic
- `shared/middleware/requirePermission.js` - Permission middleware

## Support

For issues or questions:

1. Check logs: `docker logs logistics-auth-service`
2. Verify database: `npx prisma studio`
3. Review RBAC documentation in `CLAUDE.md`

---

Last Updated: October 2025
RBAC System Version: 1.0
