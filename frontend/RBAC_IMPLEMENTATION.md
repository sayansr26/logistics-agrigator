# Frontend RBAC Implementation Guide

## ✅ Implementation Status: COMPLETE

This document provides a comprehensive guide to the Role-Based Access Control (RBAC) system implemented in the frontend application.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Implementation Components](#implementation-components)
3. [Usage Examples](#usage-examples)
4. [Role Hierarchy](#role-hierarchy)
5. [Permission Format](#permission-format)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Overview

The RBAC system provides granular access control throughout the application with:

- 11 distinct user roles
- Module-based permissions with action and scope
- Wildcard support for flexible permission assignment
- Component-level and route-level protection
- Dynamic UI adaptation based on permissions

## Implementation Components

### 1. Permission Hooks (`/src/hooks/usePermission.ts`)

Core permission checking functionality:

```typescript
const { hasPermission, canAccessResource, hasModuleAccess } = usePermission();

// Check specific permission
if (hasPermission("shipment", "create", "own")) {
  // User can create their own shipments
}

// Check resource access
if (canAccessResource("user", "update", "all")) {
  // User can update all users
}
```

### 2. Role Hooks (`/src/hooks/useRole.ts`)

Role management utilities:

```typescript
const { hasRole, isSystemAdmin, getRoleDisplayName } = useRole();

// Check single role
if (hasRole("admin")) {
  // User is an admin
}

// Check multiple roles
if (hasRole(["admin", "superadmin"])) {
  // User is admin or superadmin
}

// System admin check
if (isSystemAdmin()) {
  // User is superadmin
}
```

### 3. Guard Components

#### PermissionGuard (`/src/components/guards/PermissionGuard.tsx`)

```jsx
<PermissionGuard
  module="shipment"
  action="create"
  scope="own"
  fallback={<AccessDenied />}
>
  <CreateShipmentButton />
</PermissionGuard>
```

#### RoleGuard (`/src/components/guards/RoleGuard.tsx`)

```jsx
<RoleGuard roles={["admin", "superadmin"]} requireAll={false}>
  <AdminPanel />
</RoleGuard>
```

### 4. Route Protection (`/src/middleware.ts`)

Automatic route protection via Next.js middleware:

```typescript
// Configured in routePermissions.ts
{
  path: "/users",
  public: false,
  roles: ["superadmin", "admin"],
  permission: "user:list:all",
  title: "User Management"
}
```

### 5. Access Denied Component (`/src/components/guards/AccessDenied.tsx`)

Beautiful access denied UI with:

- Clear permission requirements display
- Current user role information
- Support contact options
- Navigation back to allowed pages

## Usage Examples

### Protecting a Button

```jsx
import { PermissionGuard } from "@/components/guards/PermissionGuard";

function ShipmentActions() {
  return (
    <div>
      <PermissionGuard module="shipment" action="create">
        <Button>Create Shipment</Button>
      </PermissionGuard>

      <PermissionGuard module="shipment" action="delete" scope="all">
        <Button variant="destructive">Delete All</Button>
      </PermissionGuard>
    </div>
  );
}
```

### Dynamic Menu Items

```jsx
import { usePermission } from "@/hooks/usePermission";

function NavigationMenu() {
  const { canAccessResource } = usePermission();

  const menuItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      show: true,
    },
    {
      label: "Users",
      href: "/users",
      show: canAccessResource("user", "list", "all"),
    },
    {
      label: "Billing",
      href: "/billing",
      show: canAccessResource("billing", "read", "own"),
    },
  ].filter((item) => item.show);

  return (
    <nav>
      {menuItems.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

### Conditional Rendering

```jsx
import { useRole } from "@/hooks/useRole";
import { usePermission } from "@/hooks/usePermission";

function UserProfile() {
  const { isSystemAdmin } = useRole();
  const { hasPermission } = usePermission();

  return (
    <div>
      <h1>User Profile</h1>

      {/* Only superadmin sees this */}
      {isSystemAdmin() && <AdminControls />}

      {/* Permission-based visibility */}
      {hasPermission("user", "update", "own") && <EditProfileButton />}
    </div>
  );
}
```

## Role Hierarchy

```
superadmin (100)        # Full system access
├── admin (90)         # Platform administration
├── client (70)        # License holders
│   ├── accounts (60)  # Financial management
│   ├── sales (60)     # Sales operations
│   └── support (60)   # Customer support
├── customer (50)      # End users
│   ├── customer_account (40)
│   ├── customer_sales (40)
│   └── customer_support (40)
└── affiliate (30)     # Commission partners
```

## Permission Format

Permissions follow the pattern: `module:action:scope`

### Modules

- `user` - User management
- `shipment` - Shipment operations
- `wallet` - Financial transactions
- `billing` - Billing and invoicing
- `partner` - Courier partners
- `analytics` - Reports and analytics
- `support` - Support tickets
- `platform` - E-commerce integrations

### Actions

- `create` - Create new resources
- `read` - View resources
- `update` - Modify resources
- `delete` - Remove resources
- `list` - View resource lists
- `manage` - Full CRUD access

### Scopes

- `own` - User's own resources
- `assigned` - Resources assigned to user
- `parent` - Parent entity's resources
- `all` - All resources in tenant

### Wildcards

- `*:*:*` - Full access (superadmin)
- `shipment:*:own` - All shipment actions on own resources
- `*:read:*` - Read any module with any scope

## Testing

### Run Test Suite

```bash
# Run RBAC permission tests
node test-rbac-permissions.js
```

### Manual Testing Checklist

1. **Login with different roles**
   - Test each of the 11 roles
   - Verify correct menu items appear
   - Check route access restrictions

2. **Permission boundaries**
   - Try accessing restricted routes directly
   - Verify access denied page appears
   - Test back navigation

3. **UI element visibility**
   - Confirm buttons/forms show correctly
   - Test permission-based sections
   - Verify fallback content

4. **Scope testing**
   - Create resources as different users
   - Verify scope restrictions work
   - Test parent/child relationships

## Troubleshooting

### Common Issues

1. **User sees "Access Denied" incorrectly**
   - Check user's permissions in Redux store
   - Verify permission string format
   - Check scope hierarchy

2. **Menu items not showing**
   - Verify permission configuration in sidebar
   - Check role assignments
   - Clear browser cache

3. **Middleware not redirecting**
   - Check middleware.ts matcher configuration
   - Verify routePermissions.ts entries
   - Check authentication status

### Debug Commands

```javascript
// In browser console
// Check current user
console.log(store.getState().auth.user);

// Check permissions
console.log(store.getState().auth.permissions);

// Test permission check
const hasAccess = store.getState().auth.permissions.includes("user:list:all");
console.log("Has user list access:", hasAccess);
```

## Security Considerations

1. **Frontend permissions are for UX only**
   - Always validate on backend
   - Don't rely solely on frontend checks
   - Consider frontend permissions as hints

2. **Token security**
   - Permissions stored in JWT
   - Refresh on role changes
   - Clear on logout

3. **Route protection**
   - Middleware runs on edge runtime
   - Checks before page load
   - Redirects unauthorized access

## Migration Notes

For existing components:

1. Replace manual permission checks with hooks
2. Wrap restricted UI in guard components
3. Update navigation to use dynamic filtering
4. Add route entries to routePermissions.ts

## Support

For issues or questions:

- Check test results: `node test-rbac-permissions.js`
- Review this documentation
- Check memory-bank/systemPatterns.md for patterns
- Contact development team for complex scenarios
