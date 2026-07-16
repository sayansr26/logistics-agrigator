// Authentication Types

// Real system roles from the 11-role RBAC hierarchy. Kept as a union for
// autocomplete/documentation, but widened with `(string & {})` so values that
// flow in as a plain `string` (e.g. from the Redux auth store / JWT payload)
// remain assignable without a cast.
export type UserRole =
  | "superadmin"
  | "admin"
  | "client"
  | "accounts"
  | "sales"
  | "support"
  | "customer"
  | "customer_account"
  | "customer_sales"
  | "customer_support"
  | "affiliate"
  // Legacy/aggregate role labels still referenced in parts of the UI
  | "finance"
  | "operations"
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string;
  permissions?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  clientId?: string;
}

export interface AuthResponse {
  status: "success" | "error";
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface UserProfileResponse {
  status: "success" | "error";
  data?: {
    user: User & {
      isAdmin: boolean;
      canAccessAll: boolean;
      capabilities: {
        canManageUsers: boolean;
        canViewReports: boolean;
        canManageShipments: boolean;
        canAccessWallet: boolean;
        canProvideSupport: boolean;
      };
      requestTimestamp: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface LogoutResponse {
  status: "success" | "error";
  data?: {
    message: string;
    details: {
      sessionDeleted: boolean;
      tokenBlacklisted: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}
