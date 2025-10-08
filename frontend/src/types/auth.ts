// Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "finance" | "operations" | "client" | "support";
  clientId?: string;
  permissions: string[];
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
  role?: "admin" | "finance" | "operations" | "client" | "support";
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
