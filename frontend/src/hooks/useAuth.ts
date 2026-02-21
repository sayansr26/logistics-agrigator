import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
  useGetUserPermissionsQuery,
  type LoginRequest,
  type RegisterRequest,
  type User,
} from "@/store/api/endpoints/authApi";
import {
  setCredentials,
  logout as clearCredentials,
} from "@/store/slices/authSlice";
import { setPermissions } from "@/store/slices/permissionSlice";

/**
 * Custom authentication hook
 *
 * Provides a unified interface for all authentication operations
 * with automatic Redux state management and API Gateway integration.
 *
 * Features:
 * - Login/Register/Logout with automatic token management
 * - User profile and permission fetching
 * - Authentication state management
 * - Automatic redirect on logout
 * - Error handling and loading states
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, login, logout, isLoading } = useAuth();
 *
 * const handleLogin = async () => {
 *   try {
 *     await login({ email, password });
 *     router.push('/dashboard');
 *   } catch (error) {
 *     console.error('Login failed:', error);
 *   }
 * };
 * ```
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  // Redux state selectors
  const { user, token, isAuthenticated } = useAppSelector(
    (state) => state.auth,
  );

  // RTK Query mutations
  const [loginMutation, { isLoading: isLoggingIn }] = useLoginMutation();
  const [registerMutation, { isLoading: isRegistering }] =
    useRegisterMutation();
  const [logoutMutation, { isLoading: isLoggingOut }] = useLogoutMutation();

  // RTK Query queries (only fetch if authenticated AND have token)
  // NOTE: We skip /me query because user data is already in Redux state from login
  // This prevents unnecessary API calls and 500 errors on page load
  const { data: meData, isLoading: isLoadingUser } = useGetMeQuery(undefined, {
    skip: true, // Always skip - we have user data from login/localStorage
  });

  // NOTE: Permissions query disabled - permissions come from JWT token in user object
  // Backend doesn't have /users/:id/permissions endpoint yet
  // Permissions are available in user.permissions from the JWT token
  const { data: permissionsData, isLoading: isLoadingPermissions } =
    useGetUserPermissionsQuery(user?.id || "", {
      skip: true, // Always skip - permissions come from JWT token
    });

  /**
   * Login user with email and password
   */
  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        const response = await loginMutation(credentials).unwrap();

        // Update Redux store with user data and token
        dispatch(
          setCredentials({
            user: response.data.user,
            token: response.data.token,
            refreshToken: response.data.refreshToken,
          }),
        );

        // Store permissions from login response into Redux permission slice
        if (response.data.user.permissions) {
          dispatch(setPermissions(response.data.user.permissions));
        }

        return response;
      } catch (error: any) {
        console.error("Login error:", error);
        throw error;
      }
    },
    [loginMutation, dispatch],
  );

  /**
   * Register new user account
   */
  const register = useCallback(
    async (userData: RegisterRequest) => {
      try {
        const response = await registerMutation(userData).unwrap();

        // Auto-login after successful registration
        dispatch(
          setCredentials({
            user: response.data.user,
            token: response.data.token,
            refreshToken: response.data.refreshToken,
          }),
        );

        return response;
      } catch (error: any) {
        console.error("Registration error:", error);
        throw error;
      }
    },
    [registerMutation, dispatch],
  );

  /**
   * Logout user and clear all authentication data
   */
  const logout = useCallback(async () => {
    try {
      // Call logout API endpoint
      await logoutMutation().unwrap();
    } catch (error) {
      console.error("Logout API error:", error);
      // Continue with logout even if API fails
    } finally {
      // Clear Redux state
      dispatch(clearCredentials());

      // Redirect to login page
      router.push("/auth/login");
    }
  }, [logoutMutation, dispatch, router]);

  /**
   * Check if user has specific permission
   */
  const hasPermission = useCallback(
    (module: string, action: string, scope: string = "own"): boolean => {
      if (!permissionsData?.data?.permissions) return false;

      const permissionString = `${module}:${action}:${scope}`;
      const permissions = permissionsData.data.permissions;

      return permissions.some((p) => {
        const pString = `${p.module}:${p.action}:${p.scope}`;
        return matchesPermission(permissionString, pString);
      });
    },
    [permissionsData],
  );

  /**
   * Check if user has specific role
   */
  const hasRole = useCallback(
    (role: string | string[]): boolean => {
      if (!user?.role) return false;

      if (Array.isArray(role)) {
        return role.includes(user.role);
      }

      return user.role === role;
    },
    [user],
  );

  /**
   * Check if user is superadmin
   */
  const isSuperAdmin = useCallback((): boolean => {
    return user?.role === "superadmin";
  }, [user]);

  /**
   * Check if user can access specific resource
   */
  const canAccess = useCallback(
    (resource: string): boolean => {
      if (!user?.role) return false;

      const accessMap: Record<string, string[]> = {
        dashboard: ["superadmin", "admin", "client", "outlet"],
        users: ["superadmin", "admin"],
        clients: ["superadmin", "admin"],
        billing: ["superadmin", "admin", "accounts"],
        shipments: ["superadmin", "admin", "client", "sales", "outlet"],
        partners: ["superadmin", "admin"],
        wallet: ["superadmin", "admin", "client", "accounts"],
        support: ["superadmin", "admin", "support"],
        analytics: ["superadmin", "admin", "client", "accounts"],
        settings: ["superadmin", "admin", "client"],
        addresses: ["outlet"],
      };

      return accessMap[resource]?.includes(user.role) || false;
    },
    [user],
  );

  /**
   * Redirect to login if not authenticated
   */
  const requireAuth = useCallback(() => {
    if (!isAuthenticated && !isLoggingIn) {
      router.push("/auth/login");
      return false;
    }
    return true;
  }, [isAuthenticated, isLoggingIn, router]);

  /**
   * Redirect to dashboard if already authenticated
   */
  const redirectIfAuthenticated = useCallback(() => {
    if (isAuthenticated && !isLoggingIn) {
      router.push("/dashboard");
      return true;
    }
    return false;
  }, [isAuthenticated, isLoggingIn, router]);

  /**
   * Check if user is admin
   */
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  /**
   * Check if user can manage operations
   */
  const canManageOperations =
    user?.role === "admin" ||
    user?.role === "superadmin" ||
    user?.role === "sales";

  /**
   * Check if user can access finance
   */
  const canAccessFinance =
    user?.role === "admin" ||
    user?.role === "superadmin" ||
    user?.role === "accounts";

  /**
   * Legacy method support - check if user is specific role
   */
  const isRole = useCallback(
    (role: string) => {
      return user?.role === role;
    },
    [user],
  );

  /**
   * Get current user profile
   */
  const getCurrentUser = useCallback(async () => {
    // Data fetched automatically by useGetMeQuery
    return meData?.data?.user || null;
  }, [meData]);

  // Update Redux permission slice when permissions are loaded
  if (permissionsData?.data?.permissions && !isLoadingPermissions) {
    // Convert Permission objects to permission strings (module:action:scope)
    const permissionStrings = permissionsData.data.permissions.map(
      (p) => `${p.module}:${p.action}:${p.scope}`,
    );
    dispatch(setPermissions(permissionStrings));
  }

  return {
    // User data
    user,
    token,
    accessToken: token, // Alias for backward compatibility
    isAuthenticated,

    // Authentication actions
    login,
    register,
    logout,
    getCurrentUser,

    // Permission checks
    hasPermission,
    hasRole,
    isSuperAdmin,
    canAccess,
    isRole,
    isAdmin,
    canManageOperations,
    canAccessFinance,

    // Navigation helpers
    requireAuth,
    redirectIfAuthenticated,

    // Loading states
    isLoading: isLoggingIn || isRegistering || isLoggingOut || isLoadingUser,
    isLoggingIn,
    isRegistering,
    isLoggingOut,
    isLoadingUser,
    isLoadingPermissions,

    // Permissions data
    permissions: permissionsData?.data?.permissions || [],

    // Error state (for compatibility)
    error: null,
    clearError: () => {}, // No-op for compatibility
  };
}

/**
 * Helper function to check if permission matches with wildcard support
 */
function matchesPermission(required: string, userPermission: string): boolean {
  const [reqModule, reqAction, reqScope] = required.split(":");
  const [userModule, userAction, userScope] = userPermission.split(":");

  // Check module match (wildcard support)
  if (userModule !== "*" && userModule !== reqModule) return false;

  // Check action match (wildcard support)
  if (userAction !== "*" && userAction !== reqAction) return false;

  // Check scope match (wildcard support)
  if (userScope !== "*" && userScope !== reqScope) return false;

  return true;
}

/**
 * Export types for convenience
 */
export type { User, LoginRequest, RegisterRequest };
