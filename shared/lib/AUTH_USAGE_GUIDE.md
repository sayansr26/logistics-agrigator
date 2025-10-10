# Enhanced Auth Middleware Usage Guide

## Overview

The enhanced `shared/lib/auth.js` provides comprehensive RBAC (Role-Based Access Control) functionality with:

- Redis-cached permission checking
- Role-based and user-specific permission overrides
- Customer access validation
- Permission cache invalidation

## New Functions

### authUtils Functions

#### 1. `checkPermission(user, module, action, scope = 'all')`

Check if a user has a specific permission with Redis caching.

```javascript
const { authUtils } = require("../shared/lib/auth");

// Check if user can create shipments for their own account
const canCreate = await authUtils.checkPermission(
  user,
  "shipment",
  "create",
  "own",
);

// Check if user can read all customers under their client
const canReadCustomers = await authUtils.checkPermission(
  user,
  "customer",
  "read",
  "parent",
);

// Check if user can manage wallet
const canManageWallet = await authUtils.checkPermission(
  user,
  "wallet",
  "manage",
  "all",
);
```

**Parameters:**

- `user` - User object from JWT (must have `id` and `role`)
- `module` - Permission module from `PERMISSION_MODULES` (e.g., 'shipment', 'customer')
- `action` - Permission action from `PERMISSION_ACTIONS` (e.g., 'create', 'read', 'manage')
- `scope` - Permission scope from `PERMISSION_SCOPES` (e.g., 'own', 'parent', 'assigned', 'all')

**Returns:** `Promise<boolean>` - True if user has permission

**Caching:** Results cached for 5 minutes in Redis

---

#### 2. `getEffectivePermissions(user)`

Get all effective permissions for a user (role-based + user-specific overrides).

```javascript
// Get all permissions for current user
const permissions = await authUtils.getEffectivePermissions(req.user);

// permissions = [
//   { id: '...', module: 'shipment', action: 'create', scope: 'own', description: '...' },
//   { id: '...', module: 'customer', action: 'read', scope: 'assigned', description: '...' },
//   ...
// ]

// Check if user has any wildcard permissions
const hasWildcard = permissions.some(
  (p) => p.module === "*" || p.action === "*",
);
```

**Parameters:**

- `user` - User object with `id` and `role`

**Returns:** `Promise<Array<Permission>>` - Array of permission objects

**Caching:** Results cached for 5 minutes in Redis

---

#### 3. `checkCustomerAccess(user, customerId)`

Check if a user can access a specific customer.

```javascript
// In a controller
async function getCustomerShipments(req, res) {
  const { customerId } = req.params;

  // Verify user has access to this customer
  const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

  if (!hasAccess) {
    return res.status(403).json({
      status: "error",
      error: { code: "FORBIDDEN", message: "No access to this customer" },
    });
  }

  // Proceed with fetching shipments
  const shipments = await prisma.shipment.findMany({
    where: { customerId },
  });

  res.json({ status: "success", data: { shipments } });
}
```

**Logic:**

- `superadmin` and `admin` → access to all customers
- `client` → access to all their customers (parent scope)
- `RESTRICTED` access level → only assigned customers
- `FULL` access level → check 'customer:read:assigned' permission

**Parameters:**

- `user` - User object
- `customerId` - Customer ID to check access for

**Returns:** `Promise<boolean>` - True if user has access

---

#### 4. `invalidatePermissionCache(userId)`

Invalidate permission cache for a user. **MUST** be called when:

- User role changes
- User permissions are modified
- User's assigned customers change

```javascript
// After updating user role
await prisma.user.update({
  where: { id: userId },
  data: { role: "accounts" },
});

// CRITICAL: Invalidate cache
await authUtils.invalidatePermissionCache(userId);

// After adding user permission
await prisma.userPermission.create({
  data: { userId, permissionId, isGranted: true },
});

// CRITICAL: Invalidate cache
await authUtils.invalidatePermissionCache(userId);
```

**Parameters:**

- `userId` - User ID (UUID string)

**Returns:** `Promise<void>`

---

### authMiddleware Functions

#### 1. `requirePermission(module, action, scope = 'all')`

Express middleware to require a specific permission.

```javascript
const { authMiddleware } = require("../shared/lib/auth");

// Protect routes with specific permissions
router.post(
  "/shipments",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("shipment", "create", "own"),
  shipmentController.create,
);

router.get(
  "/customers",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "list", "parent"),
  customerController.list,
);

router.delete(
  "/customers/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "delete", "all"),
  customerController.delete,
);
```

**Parameters:**

- `module` - Permission module
- `action` - Permission action
- `scope` - Permission scope (default: 'all')

**Returns:** Express middleware function

**Response on Failure:** 403 Forbidden with error details

---

#### 2. `requireCustomerAccess(customerIdField = 'customerId')`

Express middleware to verify customer access.

```javascript
// Customer ID in route params
router.get(
  "/customers/:customerId/shipments",
  authMiddleware.authenticate,
  authMiddleware.requireCustomerAccess("customerId"), // checks req.params.customerId
  shipmentController.getByCustomer,
);

// Customer ID in request body
router.post(
  "/shipments",
  authMiddleware.authenticate,
  authMiddleware.requireCustomerAccess("customerId"), // checks req.body.customerId
  shipmentController.create,
);

// In controller, use req.validatedCustomerId
async function getByCustomer(req, res) {
  const customerId = req.validatedCustomerId; // Already validated by middleware

  const shipments = await prisma.shipment.findMany({
    where: { customerId },
  });

  res.json({ status: "success", data: { shipments } });
}
```

**Parameters:**

- `customerIdField` - Field name in `req.params` or `req.body` (default: 'customerId')

**Returns:** Express middleware function

**Side Effect:** Adds `req.validatedCustomerId` for use in controller

**Response on Failure:** 403 Forbidden if no access

---

## Complete Route Example

```javascript
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const customerController = require("../controllers/customerController");

// List customers (with permission check)
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "list", "parent"),
  customerController.list,
);

// Get specific customer (with customer access check)
router.get(
  "/:customerId",
  authMiddleware.authenticate,
  authMiddleware.requireCustomerAccess("customerId"),
  customerController.getById,
);

// Create customer (with permission check)
router.post(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "create", "parent"),
  customerController.create,
);

// Update customer (with both permission and customer access)
router.put(
  "/:customerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "update", "assigned"),
  authMiddleware.requireCustomerAccess("customerId"),
  customerController.update,
);

// Delete customer (admin only)
router.delete(
  "/:customerId",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("customer", "delete", "all"),
  customerController.delete,
);

module.exports = router;
```

---

## Controller Example with Permission Checks

```javascript
const { authUtils } = require("../shared/lib/auth");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function listCustomers(req, res) {
  try {
    const user = req.user;

    // Build query based on user's scope
    let whereClause = {};

    if (user.role === "superadmin" || user.role === "admin") {
      // No restriction for admins
    } else if (user.role === "client") {
      // Client sees their own customers
      whereClause.clientId = user.id;
    } else if (user.accessLevel === "RESTRICTED") {
      // Restricted users see only assigned customers
      whereClause.id = { in: user.assignedCustomerIds || [] };
    } else if (user.accessLevel === "FULL") {
      // Full access users see parent client's customers
      whereClause.clientId = user.parentClientId;
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
      },
    });

    res.json({
      status: "success",
      data: { customers },
      meta: {
        count: customers.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error listing customers:", error);
    res.status(500).json({
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch customers",
      },
    });
  }
}

async function updateCustomer(req, res) {
  try {
    const customerId = req.validatedCustomerId; // From requireCustomerAccess middleware
    const { name, phone, isActive } = req.body;

    // Additional permission check for specific field
    if (isActive !== undefined) {
      const canToggleActive = await authUtils.checkPermission(
        req.user,
        "customer",
        "manage",
        "parent",
      );

      if (!canToggleActive) {
        return res.status(403).json({
          status: "error",
          error: {
            code: "FORBIDDEN",
            message: "You cannot change customer active status",
          },
        });
      }
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { name, phone, isActive },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "UPDATE",
        resource: "Customer",
        resourceId: customerId,
        changes: req.body,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json({
      status: "success",
      data: { customer },
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update customer",
      },
    });
  }
}

module.exports = {
  listCustomers,
  updateCustomer,
};
```

---

## Permission Constants Reference

Always use constants from `shared/constants/permissions.js`:

```javascript
const {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
  buildPermission,
  matchesPermission,
} = require("../constants/permissions");

// Build permission string
const perm = buildPermission(
  PERMISSION_MODULES.SHIPMENT,
  PERMISSION_ACTIONS.CREATE,
  PERMISSION_SCOPES.OWN,
);
// Result: 'shipment:create:own'

// Check permission match with wildcards
const matches = matchesPermission("shipment:create:own", "shipment:*:own");
// Result: true
```

---

## Cache Invalidation Strategy

**ALWAYS invalidate cache when:**

1. **User role changes**

```javascript
await prisma.user.update({ where: { id: userId }, data: { role: "accounts" } });
await authUtils.invalidatePermissionCache(userId);
```

2. **User permissions modified**

```javascript
await prisma.userPermission.create({
  data: { userId, permissionId, isGranted: true },
});
await authUtils.invalidatePermissionCache(userId);
```

3. **Role permissions change (invalidate ALL users with that role)**

```javascript
await prisma.rolePermission.create({ data: { role: "client", permissionId } });

// Invalidate all users with this role
const users = await prisma.user.findMany({
  where: { role: "client" },
  select: { id: true },
});
for (const user of users) {
  await authUtils.invalidatePermissionCache(user.id);
}
```

4. **Assigned customers change**

```javascript
await prisma.user.update({
  where: { id: userId },
  data: { assignedCustomerIds: [...newCustomerIds] },
});
await authUtils.invalidatePermissionCache(userId);
```

---

## Environment Variables Required

```bash
# Auth database connection
AUTH_DATABASE_URL="postgresql://user:pass@host:5432/logistics_auth"

# Or fallback to generic DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:5432/logistics_auth"

# Redis connection (required for caching)
REDIS_URL="redis://localhost:6379"

# JWT secret
JWT_SECRET="your-super-secret-jwt-key"
```

---

## Testing Checklist

- [ ] All routes have `authenticate` middleware
- [ ] Protected routes have `requirePermission` or `requireRole`
- [ ] Customer-specific routes use `requireCustomerAccess`
- [ ] Controllers use `req.validatedCustomerId` instead of raw params
- [ ] Permission cache invalidated after role/permission changes
- [ ] Error handling for permission checks
- [ ] Audit logging for sensitive operations

---

## Migration from Legacy Functions

### Before (Legacy)

```javascript
router.get(
  "/shipments",
  authMiddleware.authenticate,
  authMiddleware.requireRole(["client", "admin"]), // Role-based only
  shipmentController.list,
);
```

### After (RBAC)

```javascript
router.get(
  "/shipments",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("shipment", "list", "own"), // Permission-based
  shipmentController.list,
);
```

---

## Performance Notes

- **Caching**: All permission checks cached for 5 minutes in Redis
- **Database Queries**: Prisma connects per-check but disconnects immediately
- **Superadmin Bypass**: No database queries for superadmin role
- **Wildcard Matching**: Efficient string matching with early returns

---

## Security Best Practices

1. **Always fail secure**: Return `false` on errors
2. **Validate customer access**: Use `requireCustomerAccess` for customer-scoped endpoints
3. **Audit sensitive operations**: Log all permission-denied attempts
4. **Invalidate cache immediately**: Don't wait for TTL expiry after permission changes
5. **Never skip authentication**: All protected routes must have `authenticate` middleware first

---

## Troubleshooting

### Permission check always returns false

- Verify permissions seeded in database
- Check user role matches seeded role permissions
- Verify Redis is running and accessible
- Check `AUTH_DATABASE_URL` is correct

### Cache not invalidating

- Ensure `invalidatePermissionCache` is called after changes
- Verify Redis keys with `redis-cli KEYS perm:*`
- Check for Redis connection errors in logs

### Customer access check fails

- Verify `assignedCustomerIds` array in user object
- Check `accessLevel` field (FULL vs RESTRICTED)
- Ensure customer belongs to correct client

---

## Support

For issues or questions:

1. Check logs: `docker logs logistics-auth-service --tail=50`
2. Verify Redis: `redis-cli KEYS perm:*`
3. Check database: `npx prisma studio`
4. Review this guide: `/shared/lib/AUTH_USAGE_GUIDE.md`
