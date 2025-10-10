# RBAC Permission Constants

This directory contains the core permission system constants for the Logistics Aggregator Portal's RBAC implementation.

## Files

- `permissions.js` - Core permission constants, role definitions, and helper functions
- `index.js` - Convenience exports for easier imports

## Usage

### Import Methods

```javascript
// Method 1: Direct import (recommended for specific needs)
const {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
} = require("../shared/constants/permissions");

// Method 2: Index import (recommended for general use)
const { PERMISSION_MODULES, buildPermission } = require("../shared/constants");
```

### Permission Format

All permissions follow the pattern: `{module}:{action}:{scope}`

**Examples:**

- `shipment:create:own` - Create shipments for own account
- `customer:read:assigned` - Read assigned customers only
- `wallet:manage:parent` - Full wallet management for parent client's data
- `*:*:*` - System-wide access (superadmin only)

### Building Permissions

```javascript
const {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
  buildPermission,
} = require("../shared/constants");

// Build a permission string
const permission = buildPermission(
  PERMISSION_MODULES.SHIPMENT,
  PERMISSION_ACTIONS.CREATE,
  PERMISSION_SCOPES.OWN,
);
// Result: "shipment:create:own"
```

### Parsing Permissions

```javascript
const { parsePermission } = require("../shared/constants");

const parsed = parsePermission("wallet:manage:parent");
// Result: { module: 'wallet', action: 'manage', scope: 'parent' }
```

### Matching Permissions (with Wildcards)

```javascript
const { matchesPermission } = require("../shared/constants");

// Check if a permission matches a pattern
matchesPermission("shipment:create:own", "shipment:*:own"); // true
matchesPermission("shipment:create:own", "*:*:*"); // true
matchesPermission("wallet:read:parent", "wallet:read:*"); // true
matchesPermission("customer:delete:all", "customer:read:all"); // false
```

## Permission Components

### Modules (Resources)

Available via `PERMISSION_MODULES`:

- `CLIENT` - Client management (license-based customers)
- `LICENSE` - License generation and management
- `CUSTOMER` - End customers (client's customers)
- `SHIPMENT` - Shipment operations
- `WALLET` - Wallet and payment operations
- `PARTNER` - Partner/courier management
- `USER` - User account management
- `BILLING` - Billing and invoicing
- `ANALYTICS` - Reports and analytics
- `SUPPORT` - Support tickets and disputes
- `PLATFORM` - E-commerce integrations
- `SETTINGS` - System and account settings
- `WILDCARD` - All modules (superadmin only)

### Actions (Operations)

Available via `PERMISSION_ACTIONS`:

- `CREATE` - Create new resource
- `READ` - View single resource
- `UPDATE` - Modify existing resource
- `DELETE` - Remove resource
- `LIST` - View list of resources
- `EXPORT` - Export resource data
- `MANAGE` - Full CRUD operations
- `APPROVE` - Approve/reject operations
- `ASSIGN` - Assign resource to users/customers
- `WILDCARD` - All actions (superadmin only)

### Scopes (Data Access Level)

Available via `PERMISSION_SCOPES`:

- `OWN` - User's own data only
- `PARENT` - Parent client's data (for client role and sub-users)
- `ASSIGNED` - Assigned customers/entities only
- `ALL` - All data within tenant/client scope
- `WILDCARD` - System-wide access (superadmin only)

## Role Permissions

Default permissions for each role are defined in `DEFAULT_ROLE_PERMISSIONS`:

### 11-Role Hierarchy

1. **superadmin** - System owner (all permissions)
2. **admin** - Platform administrator (manage clients, licenses)
3. **client** - License holder (manage customers, view operations)
4. **accounts** - Client's finance team (wallet, billing)
5. **sales** - Client's sales team (customers, shipments)
6. **support** - Client's support team (tickets, disputes)
7. **customer** - End customer (create/manage own shipments)
8. **customer_account** - Customer's finance access (view billing)
9. **customer_sales** - Customer's sales access (create shipments)
10. **customer_support** - Customer's support access (tickets)
11. **affiliate** - Referral partner (view assigned customers, analytics)

### Example Role Permissions

```javascript
const { DEFAULT_ROLE_PERMISSIONS } = require("../shared/constants");

// Get default permissions for a role
const clientPermissions = DEFAULT_ROLE_PERMISSIONS.client;
// Result: ['customer:*:parent', 'user:create:parent', 'user:read:parent', ...]

// Check if role has a specific permission pattern
const hasPermission = clientPermissions.some((perm) =>
  matchesPermission("customer:create:parent", perm),
);
```

## Integration Examples

### In Controllers

```javascript
const {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
} = require("../shared/constants");
const { checkPermission } = require("../shared/lib/auth");

async function createShipment(req, res) {
  const { user } = req;

  // Check permission using constants
  const hasPermission = await checkPermission(
    user,
    PERMISSION_MODULES.SHIPMENT,
    PERMISSION_ACTIONS.CREATE,
    PERMISSION_SCOPES.OWN,
  );

  if (!hasPermission) {
    throw new APIError("Insufficient permissions", 403);
  }

  // Proceed with shipment creation
  // ...
}
```

### In Middleware

```javascript
const {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
} = require("../shared/constants");
const { requirePermission } = require("../shared/middleware/requirePermission");

// Apply permission middleware to routes
router.post(
  "/shipments",
  authMiddleware,
  requirePermission(
    PERMISSION_MODULES.SHIPMENT,
    PERMISSION_ACTIONS.CREATE,
    PERMISSION_SCOPES.OWN,
  ),
  ShipmentController.createShipment,
);
```

### In Tests

```javascript
const {
  buildPermission,
  matchesPermission,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
} = require("../shared/constants");

describe("Permission System", () => {
  test("should build correct permission string", () => {
    const perm = buildPermission(
      PERMISSION_MODULES.SHIPMENT,
      PERMISSION_ACTIONS.CREATE,
      PERMISSION_SCOPES.OWN,
    );
    expect(perm).toBe("shipment:create:own");
  });

  test("should match wildcard permissions", () => {
    expect(matchesPermission("shipment:create:own", "shipment:*:own")).toBe(
      true,
    );
  });
});
```

## IMPORTANT: Never Hardcode Permission Strings

**WRONG:**

```javascript
// ❌ DON'T DO THIS
await checkPermission(user, "shipment", "create", "own");
```

**CORRECT:**

```javascript
// ✅ ALWAYS USE CONSTANTS
const {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
} = require("../shared/constants");

await checkPermission(
  user,
  PERMISSION_MODULES.SHIPMENT,
  PERMISSION_ACTIONS.CREATE,
  PERMISSION_SCOPES.OWN,
);
```

## Validation

Run the validation script to ensure all constants are working correctly:

```bash
node -e "const perms = require('./shared/constants/permissions'); console.log('✅ Import successful');"
```

## Related Files

- `/shared/lib/auth.js` - Permission checking functions
- `/shared/middleware/requirePermission.js` - Permission middleware
- `/shared/utils/scopeFilter.js` - Scope filtering utilities
- `/backend/auth-service/prisma/schema.prisma` - Permission database models

## Next Steps for RBAC Implementation

1. **RBAC-001**: Update auth-service schema with permission models
2. **RBAC-002**: Implement permission checking functions in `shared/lib/auth.js`
3. **RBAC-003**: Create permission middleware in `shared/middleware/requirePermission.js`
4. **RBAC-004**: Implement scope filtering utilities
5. **RBAC-005**: Integrate with all microservices
6. **RBAC-006**: Add comprehensive tests
7. **RBAC-007**: Update documentation

---

**Last Updated**: October 2025
**Status**: ✅ Foundation Complete - Ready for RBAC Implementation
