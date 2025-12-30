/**
 * Route Permission Configuration
 *
 * Defines access control for all routes in the application
 * Used by middleware and navigation components to determine access
 */

export interface RoutePermission {
  /**
   * Route path or pattern
   */
  path: string;

  /**
   * Whether the route is public (no auth required)
   */
  public: boolean;

  /**
   * Allowed roles (if empty, any authenticated user can access)
   */
  roles?: string[];

  /**
   * Required permission in format module:action:scope
   */
  permission?: string;

  /**
   * Redirect path if access is denied
   */
  redirectTo?: string;

  /**
   * Display name for the route
   */
  title: string;

  /**
   * Description of what this route is for
   */
  description?: string;
}

/**
 * Complete route permission configuration
 *
 * Note: Routes are matched in order, more specific routes should come first
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // ==================== PUBLIC ROUTES ====================
  {
    path: "/",
    public: true,
    title: "Home",
    description: "Public landing page",
  },
  {
    path: "/auth/login",
    public: true,
    title: "Login",
    description: "User authentication",
  },
  {
    path: "/auth/register",
    public: true,
    title: "Register",
    description: "New user registration",
  },
  {
    path: "/auth/forgot-password",
    public: true,
    title: "Forgot Password",
    description: "Password recovery",
  },
  {
    path: "/auth/reset-password",
    public: true,
    title: "Reset Password",
    description: "Password reset",
  },
  {
    path: "/about",
    public: true,
    title: "About Us",
    description: "Company information",
  },
  {
    path: "/contact",
    public: true,
    title: "Contact",
    description: "Contact information",
  },
  {
    path: "/privacy",
    public: true,
    title: "Privacy Policy",
    description: "Privacy and data protection",
  },
  {
    path: "/terms",
    public: true,
    title: "Terms of Service",
    description: "Terms and conditions",
  },

  // ==================== AUTHENTICATED ROUTES (All Roles) ====================
  {
    path: "/dashboard",
    public: false,
    title: "Dashboard",
    description: "Main dashboard",
  },
  {
    path: "/profile",
    public: false,
    title: "Profile",
    description: "User profile",
  },
  {
    path: "/settings",
    public: false,
    title: "Settings",
    description: "Personal settings",
  },
  {
    path: "/notifications",
    public: false,
    title: "Notifications",
    description: "User notifications",
  },

  // ==================== USER MANAGEMENT ====================
  {
    path: "/users/add",
    public: false,
    roles: ["superadmin"],
    permission: "user:create:all",
    title: "Add User",
    description: "Create new user account",
    redirectTo: "/users",
  },
  {
    path: "/users/:id/edit",
    public: false,
    roles: ["superadmin", "admin"],
    permission: "user:update:all",
    title: "Edit User",
    description: "Modify user details",
    redirectTo: "/users",
  },
  {
    path: "/users/:id/permissions",
    public: false,
    roles: ["superadmin"],
    permission: "user:manage:all",
    title: "User Permissions",
    description: "Manage user permissions",
    redirectTo: "/users",
  },
  {
    path: "/users/:id",
    public: false,
    roles: ["superadmin", "admin"],
    permission: "user:read:all",
    title: "User Details",
    description: "View user information",
  },
  {
    path: "/users",
    public: false,
    roles: ["superadmin", "admin"],
    permission: "user:list:all",
    title: "User Management",
    description: "Manage all users",
  },

  // ==================== CLIENT MANAGEMENT ====================
  {
    path: "/clients",
    public: false,
    roles: ["superadmin"],
    permission: "client:list:all",
    title: "Client Management",
    description: "Manage license holders",
  },

  // ==================== SHIPMENT MANAGEMENT ====================
  {
    path: "/shipments/create",
    public: false,
    roles: ["superadmin", "admin", "client", "sales"],
    permission: "shipment:create:*",
    title: "Create Shipment",
    description: "Create new shipment",
  },
  {
    path: "/shipments/bulk",
    public: false,
    roles: ["superadmin", "admin", "client", "sales"],
    permission: "shipment:create:parent",
    title: "Bulk Shipments",
    description: "Create multiple shipments",
  },
  {
    path: "/shipments/track",
    public: false,
    permission: "shipment:read:*",
    title: "Track Shipment",
    description: "Track shipment status",
  },
  {
    path: "/shipments/ndr",
    public: false,
    roles: ["superadmin", "admin", "client", "support"],
    permission: "shipment:update:*",
    title: "NDR Management",
    description: "Non-delivery reports",
  },
  {
    path: "/shipments/:id/edit",
    public: false,
    permission: "shipment:update:*",
    title: "Edit Shipment",
    description: "Modify shipment details",
  },
  {
    path: "/shipments/:id",
    public: false,
    permission: "shipment:read:*",
    title: "Shipment Details",
    description: "View shipment information",
  },
  {
    path: "/shipments",
    public: false,
    permission: "shipment:list:*",
    title: "Shipments",
    description: "Manage shipments",
  },

  // ==================== PARTNER MANAGEMENT ====================
  {
    path: "/partners/add",
    public: false,
    roles: ["superadmin", "admin"],
    permission: "partner:create:all",
    title: "Add Partner",
    description: "Add new courier partner",
  },
  {
    path: "/partners/:id/edit",
    public: false,
    roles: ["superadmin", "admin"],
    permission: "partner:update:all",
    title: "Edit Partner",
    description: "Modify partner details",
  },
  {
    path: "/partners/:id",
    public: false,
    roles: ["superadmin", "admin", "client"],
    permission: "partner:read:*",
    title: "Partner Details",
    description: "View partner information",
  },
  {
    path: "/partners",
    public: false,
    roles: ["superadmin", "admin", "client"],
    permission: "partner:list:*",
    title: "Courier Partners",
    description: "Manage courier partners",
  },

  // ==================== WALLET & BILLING ====================
  {
    path: "/wallet/transactions/:id",
    public: false,
    permission: "wallet:read:*",
    title: "Transaction Details",
    description: "View transaction details",
  },
  {
    path: "/wallet/invoices/:id",
    public: false,
    permission: "billing:read:*",
    title: "Invoice Details",
    description: "View invoice details",
  },
  {
    path: "/wallet",
    public: false,
    permission: "wallet:read:*",
    title: "Wallet & Billing",
    description: "Manage wallet and billing",
  },
  {
    path: "/remittance",
    public: false,
    roles: ["superadmin", "admin", "accounts"],
    permission: "billing:manage:*",
    title: "Remittance",
    description: "Remittance management",
  },
  {
    path: "/charges/create",
    public: false,
    roles: ["superadmin", "admin", "accounts"],
    permission: "billing:create:all",
    title: "Create Charge",
    description: "Add new charge",
  },
  {
    path: "/charges",
    public: false,
    roles: ["superadmin", "admin", "accounts"],
    permission: "billing:list:*",
    title: "Charges",
    description: "View charges",
  },

  // ==================== ZONES ====================
  {
    path: "/zones/create",
    public: false,
    roles: ["superadmin", "admin"],
    permission: "partner:manage:all",
    title: "Create Zone",
    description: "Add new zone",
  },
  {
    path: "/zones/:id/edit",
    public: false,
    roles: ["superadmin", "admin"],
    permission: "partner:update:all",
    title: "Edit Zone",
    description: "Modify zone details",
  },
  {
    path: "/zones",
    public: false,
    permission: "partner:read:*",
    title: "Zones",
    description: "Service zones",
  },

  // ==================== SUPPORT ====================
  {
    path: "/support/new-ticket",
    public: false,
    permission: "support:create:own",
    title: "New Ticket",
    description: "Create support ticket",
  },
  {
    path: "/support/disputes/:id",
    public: false,
    permission: "support:read:*",
    title: "Dispute Details",
    description: "View dispute details",
  },
  {
    path: "/support/disputes",
    public: false,
    permission: "support:list:*",
    title: "Disputes",
    description: "Manage disputes",
  },
  {
    path: "/support",
    public: false,
    permission: "support:list:*",
    title: "Support",
    description: "Support tickets",
  },

  // ==================== REPORTS & ANALYTICS ====================
  {
    path: "/reports",
    public: false,
    permission: "analytics:read:*",
    title: "Reports",
    description: "View reports",
  },
  {
    path: "/analytics",
    public: false,
    permission: "analytics:read:*",
    title: "Analytics",
    description: "View analytics",
  },

  // ==================== PLATFORM INTEGRATIONS ====================
  {
    path: "/platforms",
    public: false,
    permission: "platform:read:*",
    title: "Platform Integrations",
    description: "E-commerce integrations",
  },

  // ==================== ORDERS ====================
  {
    path: "/orders",
    public: false,
    permission: "shipment:list:*",
    title: "Orders",
    description: "Order management",
  },

  // ==================== NDR ====================
  {
    path: "/ndr",
    public: false,
    roles: ["superadmin", "admin", "client", "support"],
    permission: "shipment:update:*",
    title: "NDR",
    description: "Non-delivery reports",
  },

  // ==================== DEMO PAGES (Development Only) ====================
  {
    path: "/demo/forms",
    public: true,
    title: "Demo Forms",
    description: "Form components demo",
  },
  {
    path: "/demo/tables",
    public: true,
    title: "Demo Tables",
    description: "Table components demo",
  },
  {
    path: "/demo/navigation",
    public: true,
    title: "Demo Navigation",
    description: "Navigation demo",
  },

  // ==================== ACCESS DENIED ====================
  {
    path: "/access-denied",
    public: false,
    title: "Access Denied",
    description: "Insufficient permissions",
  },
];

/**
 * Get permission configuration for a specific route
 * @param path - Route path to check
 */
export function getRoutePermission(path: string): RoutePermission | undefined {
  // First try exact match
  const exactMatch = ROUTE_PERMISSIONS.find((route) => route.path === path);
  if (exactMatch) return exactMatch;

  // Then try pattern matching (for dynamic routes)
  return ROUTE_PERMISSIONS.find((route) => {
    // Replace :param with regex pattern
    const pattern = route.path.replace(/:[^/]+/g, "[^/]+");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });
}

/**
 * Check if a route is public
 * @param path - Route path to check
 */
export function isPublicRoute(path: string): boolean {
  const routePermission = getRoutePermission(path);
  return routePermission?.public ?? false;
}

/**
 * Get required roles for a route
 * @param path - Route path to check
 */
export function getRequiredRoles(path: string): string[] {
  const routePermission = getRoutePermission(path);
  return routePermission?.roles ?? [];
}

/**
 * Get required permission for a route
 * @param path - Route path to check
 */
export function getRequiredPermission(path: string): string | undefined {
  const routePermission = getRoutePermission(path);
  return routePermission?.permission;
}
