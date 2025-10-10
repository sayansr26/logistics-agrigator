# Enhanced Auth Middleware - Quick Reference

## Import

```javascript
const { authUtils, authMiddleware } = require("../shared/lib/auth");
```

---

## Route Protection (Common Patterns)

### Basic Permission Check

```javascript
router.post(
  "/shipments",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("shipment", "create", "own"),
  controller.create,
);
```

### Customer Access Check

```javascript
router.get(
  "/customers/:customerId/data",
  authMiddleware.authenticate,
  authMiddleware.requireCustomerAccess("customerId"),
  controller.getData,
);
```

### Combined Permission + Customer Access

```javascript
router.put(
  "/customers/:customerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "update", "assigned"),
  authMiddleware.requireCustomerAccess("customerId"),
  controller.update,
);
```

### Admin Only

```javascript
router.delete(
  "/customers/:id",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  controller.delete,
);
```

---

## Controller Functions

### Check Permission

```javascript
const canManage = await authUtils.checkPermission(
  req.user,
  "wallet",
  "manage",
  "parent",
);

if (!canManage) {
  return res
    .status(403)
    .json({ status: "error", error: { message: "Forbidden" } });
}
```

### Get All Permissions

```javascript
const permissions = await authUtils.getEffectivePermissions(req.user);
// permissions = [{ module, action, scope, description }, ...]
```

### Check Customer Access

```javascript
const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

if (!hasAccess) {
  return res
    .status(403)
    .json({ status: "error", error: { message: "No access" } });
}
```

### Use Validated Customer ID

```javascript
async function update(req, res) {
  const customerId = req.validatedCustomerId; // From requireCustomerAccess middleware
  // ... proceed safely
}
```

---

## Cache Invalidation (CRITICAL)

### After Role Change

```javascript
await prisma.user.update({ where: { id: userId }, data: { role: "accounts" } });
await authUtils.invalidatePermissionCache(userId); // MUST CALL
```

### After Permission Granted/Revoked

```javascript
await prisma.userPermission.create({
  data: { userId, permissionId, isGranted: true },
});
await authUtils.invalidatePermissionCache(userId); // MUST CALL
```

### After Assigned Customers Change

```javascript
await prisma.user.update({
  where: { id: userId },
  data: { assignedCustomerIds },
});
await authUtils.invalidatePermissionCache(userId); // MUST CALL
```

### After Role Permission Change (ALL users with that role)

```javascript
await prisma.rolePermission.delete({
  where: { role_permissionId: { role, permissionId } },
});

const users = await prisma.user.findMany({
  where: { role },
  select: { id: true },
});
for (const user of users) {
  await authUtils.invalidatePermissionCache(user.id);
}
```

---

## Permission Constants

```javascript
const {
  PERMISSION_MODULES, // { CLIENT: 'client', SHIPMENT: 'shipment', ... }
  PERMISSION_ACTIONS, // { CREATE: 'create', READ: 'read', ... }
  PERMISSION_SCOPES, // { OWN: 'own', PARENT: 'parent', ALL: 'all', ... }
  buildPermission, // Build permission string
  matchesPermission, // Check wildcard matching
} = require("../constants/permissions");

// Build permission
const perm = buildPermission(
  PERMISSION_MODULES.SHIPMENT,
  PERMISSION_ACTIONS.CREATE,
  PERMISSION_SCOPES.OWN,
); // 'shipment:create:own'

// Check match
const matches = matchesPermission("shipment:create:own", "shipment:*:own"); // true
```

---

## Permission Format

```
{module}:{action}:{scope}

Examples:
  shipment:create:own       - Create own shipments
  customer:read:assigned    - Read assigned customers
  wallet:manage:parent      - Full wallet management for parent
  *:*:*                     - All permissions (superadmin only)
```

---

## Access Levels

| Level        | Description                       | Use Case                       |
| ------------ | --------------------------------- | ------------------------------ |
| `FULL`       | Access to all assigned entities   | Team members with broad access |
| `RESTRICTED` | Only explicitly assigned entities | Limited access users           |

---

## Common Permission Patterns

### Shipment Operations

```javascript
// Create shipment
requirePermission("shipment", "create", "own");

// View own shipments
requirePermission("shipment", "read", "own");

// View client's shipments
requirePermission("shipment", "read", "parent");

// View assigned customer shipments
requirePermission("shipment", "read", "assigned");

// Manage all shipments
requirePermission("shipment", "manage", "all");
```

### Customer Operations

```javascript
// Create customer
requirePermission("customer", "create", "parent");

// View assigned customers
requirePermission("customer", "read", "assigned");

// Update customer
requirePermission("customer", "update", "assigned");

// Delete customer (admin only)
requirePermission("customer", "delete", "all");
```

### Wallet Operations

```javascript
// View own wallet
requirePermission("wallet", "read", "own");

// View customer wallets
requirePermission("wallet", "read", "assigned");

// Manage client wallet
requirePermission("wallet", "manage", "parent");
```

---

## Error Responses

### 401 Unauthorized (No Authentication)

```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden (Permission Denied)

```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions. Required: shipment:create:own"
  }
}
```

### 403 Forbidden (No Customer Access)

```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this customer"
  }
}
```

---

## Environment Variables

```bash
AUTH_DATABASE_URL="postgresql://user:pass@host:5432/logistics_auth"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="8h"
```

---

## Testing

### Check Route Protection

```bash
# Without token (expect 401)
curl http://localhost:3003/api/v1/customers

# With invalid token (expect 401)
curl -H "Authorization: Bearer invalid" http://localhost:3003/api/v1/customers

# With valid token but no permission (expect 403)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/api/v1/admin/settings
```

### Check Permission in Controller

```javascript
// Use superadmin for testing (bypasses all checks)
const testUser = { id: "uuid", role: "superadmin", email: "admin@test.com" };
const canDo = await authUtils.checkPermission(
  testUser,
  "shipment",
  "create",
  "own",
);
console.log(canDo); // true
```

---

## Debugging

### Check User Permissions

```javascript
const permissions = await authUtils.getEffectivePermissions(req.user);
console.log("User permissions:", permissions);
```

### Check Cache

```bash
# Redis CLI
redis-cli

# View all permission caches
KEYS perm:*

# View specific user cache
GET perms:123e4567-e89b-12d3-a456-426614174000

# Clear user cache
DEL perms:123e4567-e89b-12d3-a456-426614174000
KEYS perm:123e4567-*
# Then DEL each key
```

### Check Database

```bash
# Prisma Studio
npx prisma studio

# Check role permissions
SELECT * FROM role_permissions WHERE role = 'client';

# Check user permissions
SELECT * FROM user_permissions WHERE user_id = 'uuid';

# Check all permissions
SELECT * FROM permissions WHERE is_active = true;
```

---

## Common Issues

### ❌ Permission always denied

**Check**: User role, seeded permissions, Redis connection

### ❌ Cache not invalidating

**Fix**: Call `invalidatePermissionCache(userId)` after changes

### ❌ Customer access denied

**Check**: `assignedCustomerIds` array, `accessLevel` field

### ❌ Middleware not called

**Check**: Route order, `authenticate` before `requirePermission`

---

## Best Practices

✅ **Always authenticate first**

```javascript
router.post('/', authMiddleware.authenticate, authMiddleware.requirePermission(...), ...)
```

✅ **Use requireCustomerAccess for customer-scoped routes**

```javascript
router.get('/:customerId', authMiddleware.requireCustomerAccess('customerId'), ...)
```

✅ **Invalidate cache immediately after permission changes**

```javascript
await updatePermissions();
await authUtils.invalidatePermissionCache(userId);
```

✅ **Use constants for permission strings**

```javascript
const { PERMISSION_MODULES } = require("../constants/permissions");
requirePermission(PERMISSION_MODULES.SHIPMENT, "create", "own");
```

✅ **Add audit logging for permission denials**

```javascript
// Already handled by middleware
```

---

## Legacy vs New API

### Legacy (Deprecated)

```javascript
authMiddleware.requireRole(["client", "admin"]);
authMiddleware.authorize(["shipment_access"]);
authUtils.getRolePermissions("client");
```

### New (Recommended)

```javascript
authMiddleware.requirePermission("shipment", "create", "own");
await authUtils.checkPermission(user, "shipment", "create", "own");
await authUtils.getEffectivePermissions(user);
```

---

## Further Reading

- Full Guide: `/shared/lib/AUTH_USAGE_GUIDE.md`
- Implementation: `/docs/RBAC-004-IMPLEMENTATION-SUMMARY.md`
- Permission Constants: `/shared/constants/permissions.js`
- Auth Schema: `/backend/auth-service/prisma/schema.prisma`

---

**Last Updated**: 2025-10-10
**Version**: 1.0.0 (RBAC-004)
