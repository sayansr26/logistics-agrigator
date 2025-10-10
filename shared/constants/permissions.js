/**
 * RBAC Permission Constants
 *
 * This file defines the core permission system for the Logistics Aggregator Portal.
 * All permission checks MUST use these constants - NEVER hardcode permission strings.
 *
 * Permission Format: {module}:{action}:{scope}
 *
 * Examples:
 * - 'shipment:create:own' - Create shipments for own account
 * - 'customer:read:assigned' - Read assigned customers only
 * - 'wallet:manage:parent' - Full wallet management for parent client's data
 * - '*:*:*' - System-wide access (superadmin only)
 *
 * @module constants/permissions
 */

/**
 * Permission Modules (Resources)
 * Defines the resource types that can be accessed in the system
 */
const PERMISSION_MODULES = {
  CLIENT: "client", // Client management (license-based customers)
  LICENSE: "license", // License generation and management
  CUSTOMER: "customer", // End customers (client's customers)
  SHIPMENT: "shipment", // Shipment operations
  WALLET: "wallet", // Wallet and payment operations
  PARTNER: "partner", // Partner/courier management
  USER: "user", // User account management
  BILLING: "billing", // Billing and invoicing
  ANALYTICS: "analytics", // Reports and analytics
  SUPPORT: "support", // Support tickets and disputes
  PLATFORM: "platform", // E-commerce integrations
  SETTINGS: "settings", // System and account settings
  WILDCARD: "*", // All modules (superadmin only)
};

/**
 * Permission Actions
 * Defines the operations that can be performed on resources
 */
const PERMISSION_ACTIONS = {
  CREATE: "create", // Create new resource
  READ: "read", // View single resource
  UPDATE: "update", // Modify existing resource
  DELETE: "delete", // Remove resource
  LIST: "list", // View list of resources
  EXPORT: "export", // Export resource data
  MANAGE: "manage", // Full CRUD operations
  APPROVE: "approve", // Approve/reject operations (e.g., disputes)
  ASSIGN: "assign", // Assign resource to users/customers
  WILDCARD: "*", // All actions (superadmin only)
};

/**
 * Permission Scopes (Data Access Level)
 * Defines the scope of data access for each permission
 */
const PERMISSION_SCOPES = {
  OWN: "own", // User's own data only
  PARENT: "parent", // Parent client's data (for client role and sub-users)
  ASSIGNED: "assigned", // Assigned customers/entities only
  ALL: "all", // All data within tenant/client scope
  WILDCARD: "*", // System-wide access (superadmin only)
};

/**
 * Default Role Permissions
 * Defines the base permissions for each role in the system
 * These are applied during role creation and serve as templates
 */
const DEFAULT_ROLE_PERMISSIONS = {
  superadmin: ["*:*:*"], // Full system access

  admin: [
    // Platform administrator
    "client:*:all",
    "license:*:all",
    "user:*:all",
    "analytics:*:all",
    "settings:*:all",
  ],

  client: [
    // License holder
    "customer:*:parent",
    "user:create:parent",
    "user:read:parent",
    "user:update:parent",
    "shipment:read:parent",
    "wallet:read:parent",
    "analytics:read:parent",
    "settings:read:parent",
    "settings:update:own",
  ],

  accounts: [
    // Client's finance team
    "wallet:*:assigned",
    "billing:*:assigned",
    "shipment:read:assigned",
    "customer:read:assigned",
    "analytics:read:assigned",
  ],

  sales: [
    // Client's sales team
    "customer:*:assigned",
    "shipment:create:assigned",
    "shipment:read:assigned",
    "wallet:read:assigned",
    "analytics:read:assigned",
  ],

  support: [
    // Client's support team
    "support:*:assigned",
    "shipment:read:assigned",
    "shipment:update:assigned",
    "customer:read:assigned",
    "analytics:read:assigned",
  ],

  customer: [
    // End customer
    "shipment:*:own",
    "wallet:read:own",
    "support:create:own",
    "support:read:own",
    "analytics:read:own",
    "settings:read:own",
    "settings:update:own",
  ],

  customer_account: [
    // Customer's finance access
    "wallet:read:parent",
    "billing:read:parent",
    "shipment:read:parent",
    "analytics:read:parent",
  ],

  customer_sales: [
    // Customer's sales access
    "shipment:create:parent",
    "shipment:read:parent",
    "wallet:read:parent",
    "analytics:read:parent",
  ],

  customer_support: [
    // Customer's support access
    "support:*:parent",
    "shipment:read:parent",
    "analytics:read:parent",
  ],

  affiliate: [
    // Referral partner
    "customer:read:assigned",
    "analytics:read:assigned",
  ],
};

/**
 * Permission Descriptions
 * Human-readable descriptions for each permission combination
 * Used for UI display and documentation
 */
const PERMISSION_DESCRIPTIONS = {
  "client:create:all": "Create new clients in the system",
  "client:read:all": "View all client information",
  "client:update:all": "Modify client details and settings",
  "client:delete:all": "Remove clients from the system",

  "customer:create:parent": "Create new customers under your client account",
  "customer:read:assigned": "View assigned customer information",
  "customer:manage:parent": "Full customer management for your client",

  "shipment:create:own": "Create shipments for your own account",
  "shipment:create:assigned": "Create shipments for assigned customers",
  "shipment:read:parent": "View all shipments under your client",
  "shipment:update:assigned": "Modify shipments for assigned customers",

  "wallet:read:own": "View your wallet balance and transactions",
  "wallet:manage:parent": "Full wallet management for your client",

  "license:create:all": "Generate new licenses",
  "license:update:all": "Modify license terms and activation",

  "analytics:read:own": "View your own performance metrics",
  "analytics:read:parent": "View analytics for your client/parent",
  "analytics:export:all": "Export analytics data and reports",

  "support:create:own": "Create support tickets for your issues",
  "support:manage:assigned": "Manage support tickets for assigned customers",

  "settings:update:own": "Modify your personal settings",
  "settings:manage:all": "Manage system-wide settings",
};

/**
 * Helper function to build permission string
 * @param {string} module - Permission module from PERMISSION_MODULES
 * @param {string} action - Permission action from PERMISSION_ACTIONS
 * @param {string} scope - Permission scope from PERMISSION_SCOPES
 * @returns {string} Formatted permission string
 */
function buildPermission(module, action, scope) {
  return `${module}:${action}:${scope}`;
}

/**
 * Helper function to parse permission string
 * @param {string} permission - Permission string in format module:action:scope
 * @returns {Object} Parsed permission object with module, action, scope
 */
function parsePermission(permission) {
  const [module, action, scope] = permission.split(":");
  return { module, action, scope };
}

/**
 * Helper function to check if permission matches pattern (supports wildcards)
 * @param {string} permission - Permission to check (e.g., 'shipment:create:own')
 * @param {string} pattern - Pattern to match against (e.g., 'shipment:*:own' or '*:*:*')
 * @returns {boolean} True if permission matches pattern
 */
function matchesPermission(permission, pattern) {
  const permParts = parsePermission(permission);
  const patternParts = parsePermission(pattern);

  return (
    (patternParts.module === "*" || patternParts.module === permParts.module) &&
    (patternParts.action === "*" || patternParts.action === permParts.action) &&
    (patternParts.scope === "*" || patternParts.scope === permParts.scope)
  );
}

module.exports = {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  buildPermission,
  parsePermission,
  matchesPermission,
};
