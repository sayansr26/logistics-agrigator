/**
 * Permission Seed Data
 *
 * This file contains comprehensive permission definitions for all 12 modules
 * in the Logistics Aggregator Portal. Each permission follows the format:
 * module:action:scope
 *
 * Total Permissions: 120+
 * Modules: client, license, customer, shipment, wallet, partner, user, billing, analytics, support, platform, settings
 *
 * @module seeds/permissions
 */

const {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_SCOPES,
} = require("../../shared/constants/permissions");

/**
 * All permissions in the system
 * Each permission MUST have: module, action, scope, description
 */
const permissions = [
  // ===========================
  // CLIENT MODULE (8 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Create new clients in the system",
  },
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View all client information and details",
  },
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Modify client details and settings",
  },
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Remove clients from the system",
  },
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ALL,
    description: "View list of all clients",
  },
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.ALL,
    description: "Export client data and reports",
  },
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Full client management including CRUD operations",
  },
  {
    module: PERMISSION_MODULES.CLIENT,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All client operations",
  },

  // ===========================
  // LICENSE MODULE (9 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Generate new licenses for clients",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View license details and status",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Modify license terms, activation, and expiry",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Revoke or remove licenses",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ALL,
    description: "View list of all licenses",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.ALL,
    description: "Export license data and usage reports",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Full license management",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.APPROVE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Approve license activation requests",
  },
  {
    module: PERMISSION_MODULES.LICENSE,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All license operations",
  },

  // ===========================
  // CUSTOMER MODULE (15 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Create new customers under parent client account",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View all customers under parent client",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "View only assigned customer information",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Modify customer details under parent client",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Update assigned customer information",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Remove customers under parent client",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List all customers under parent client",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "List only assigned customers",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Export customer data for parent client",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Full customer management for parent client",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.ASSIGN,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Assign customers to team members",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All customer operations for parent client",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "All operations on assigned customers",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All customer operations across all clients (admin only)",
  },
  {
    module: PERMISSION_MODULES.CUSTOMER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View all customers system-wide",
  },

  // ===========================
  // SHIPMENT MODULE (18 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.OWN,
    description: "Create shipments for own account",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Create shipments for parent client",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Create shipments for assigned customers",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.OWN,
    description: "View own shipments",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View all shipments under parent client",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "View shipments for assigned customers",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.OWN,
    description: "Modify own shipments",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Update shipments for assigned customers",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.OWN,
    description: "Cancel or delete own shipments",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.OWN,
    description: "List own shipments",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List all shipments under parent client",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "List shipments for assigned customers",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.OWN,
    description: "Export own shipment data",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Export shipment data for parent client",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Full shipment management for parent client",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.OWN,
    description: "All operations on own shipments",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All shipment operations for parent client",
  },
  {
    module: PERMISSION_MODULES.SHIPMENT,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "All operations on assigned shipments",
  },

  // ===========================
  // WALLET MODULE (15 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Create wallet entries for parent client",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.OWN,
    description: "View own wallet balance and transactions",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View wallet details for parent client",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "View wallet information for assigned customers",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Modify wallet settings for parent client",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List all wallet transactions for parent client",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "List wallet transactions for assigned customers",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Export wallet transaction data",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Full wallet management for parent client",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.APPROVE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Approve wallet recharge requests",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All wallet operations for parent client",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "All wallet operations for assigned customers",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View all wallet data system-wide",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ALL,
    description: "List all wallet transactions system-wide",
  },
  {
    module: PERMISSION_MODULES.WALLET,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Full wallet management system-wide (admin only)",
  },

  // ===========================
  // PARTNER MODULE (12 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Add new partner/courier integrations",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View partner/courier information",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "View assigned partner information",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Modify partner/courier settings",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Remove partner integrations",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ALL,
    description: "List all partners and couriers",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "List assigned partners",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.ALL,
    description: "Export partner data and reports",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Full partner management",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.ASSIGN,
    scope: PERMISSION_SCOPES.ALL,
    description: "Assign partners to clients",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All partner operations",
  },
  {
    module: PERMISSION_MODULES.PARTNER,
    action: PERMISSION_ACTIONS.APPROVE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Approve partner integration requests",
  },

  // ===========================
  // USER MODULE (16 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Create new users under parent client",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Create users system-wide",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.OWN,
    description: "View own user profile",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View users under parent client",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View all users system-wide",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.OWN,
    description: "Update own user profile",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Modify users under parent client",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Modify any user system-wide",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Remove users under parent client",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Remove any user system-wide",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List users under parent client",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ALL,
    description: "List all users system-wide",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.ALL,
    description: "Export user data",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Full user management system-wide",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All user operations for parent client",
  },
  {
    module: PERMISSION_MODULES.USER,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All user operations system-wide",
  },

  // ===========================
  // BILLING MODULE (12 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Create billing entries for assigned customers",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.OWN,
    description: "View own billing information",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View billing for parent client",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "View billing for assigned customers",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Update billing entries for assigned customers",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List all billing records for parent client",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "List billing records for assigned customers",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Export billing data for parent client",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Full billing management system-wide",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.APPROVE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Approve billing entries",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "All billing operations for assigned customers",
  },
  {
    module: PERMISSION_MODULES.BILLING,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All billing operations system-wide",
  },

  // ===========================
  // ANALYTICS MODULE (12 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.OWN,
    description: "View own performance metrics and analytics",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View analytics for parent client",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "View analytics for assigned customers",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View all analytics system-wide",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List analytics reports for parent client",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "List analytics reports for assigned customers",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ALL,
    description: "List all analytics reports system-wide",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Export analytics data for parent client",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Export analytics data for assigned customers",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.ALL,
    description: "Export all analytics data system-wide",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All analytics operations system-wide",
  },
  {
    module: PERMISSION_MODULES.ANALYTICS,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All analytics operations for parent client",
  },

  // ===========================
  // SUPPORT MODULE (15 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.OWN,
    description: "Create support tickets for own issues",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Create support tickets for assigned customers",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.OWN,
    description: "View own support tickets",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View support tickets for parent client",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "View assigned support tickets",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Update assigned support tickets",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List all support tickets for parent client",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "List assigned support tickets",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.EXPORT,
    scope: PERMISSION_SCOPES.ALL,
    description: "Export support ticket data",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Full support ticket management for assigned customers",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.APPROVE,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "Approve or resolve support tickets",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.ASSIGN,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Assign support tickets to team members",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.OWN,
    description: "All operations on own support tickets",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All support operations for parent client",
  },
  {
    module: PERMISSION_MODULES.SUPPORT,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ASSIGNED,
    description: "All operations on assigned support tickets",
  },

  // ===========================
  // PLATFORM MODULE (10 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.CREATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Create platform integrations (e.g., Shopify, WooCommerce)",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View platform integration details",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View all platform integrations system-wide",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Modify platform integration settings",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.DELETE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Remove platform integrations",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.PARENT,
    description: "List platform integrations for parent client",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.LIST,
    scope: PERMISSION_SCOPES.ALL,
    description: "List all platform integrations system-wide",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Full platform integration management",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All platform operations for parent client",
  },
  {
    module: PERMISSION_MODULES.PLATFORM,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All platform operations system-wide",
  },

  // ===========================
  // SETTINGS MODULE (10 permissions)
  // ===========================
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.OWN,
    description: "View own account settings",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.PARENT,
    description: "View settings for parent client",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.READ,
    scope: PERMISSION_SCOPES.ALL,
    description: "View all system settings",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.OWN,
    description: "Modify own account settings",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Modify settings for parent client",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.UPDATE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Modify system-wide settings",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.PARENT,
    description: "Full settings management for parent client",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.MANAGE,
    scope: PERMISSION_SCOPES.ALL,
    description: "Full system settings management",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.PARENT,
    description: "All settings operations for parent client",
  },
  {
    module: PERMISSION_MODULES.SETTINGS,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.ALL,
    description: "All settings operations system-wide",
  },

  // ===========================
  // WILDCARD MODULE (1 permission)
  // ===========================
  {
    module: PERMISSION_MODULES.WILDCARD,
    action: PERMISSION_ACTIONS.WILDCARD,
    scope: PERMISSION_SCOPES.WILDCARD,
    description: "Full system access - all permissions (superadmin only)",
  },
];

module.exports = { permissions };
