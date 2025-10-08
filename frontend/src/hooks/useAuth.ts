import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { LoginCredentials, RegisterData } from "@/types/auth";

export function useAuth() {
  const router = useRouter();
  const {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    getCurrentUser,
    clearError,
  } = useAuthStore();

  // Check if user has specific role
  const isRole = (role: string) => user?.role === role;

  // Check if user has specific permission
  const hasPermission = (permission: string) => {
    if (!user) return false;
    return (
      user.permissions.includes(permission) ||
      user.permissions.includes("all_permissions")
    );
  };

  // Check if user can access admin features
  const isAdmin = user?.role === "admin";

  // Check if user can access operations features
  const canManageOperations = ["admin", "operations"].includes(
    user?.role || "",
  );

  // Check if user can access finance features
  const canAccessFinance = ["admin", "finance"].includes(user?.role || "");

  // Auto-refresh user data on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken && !user) {
      getCurrentUser();
    }
  }, [isAuthenticated, accessToken, user, getCurrentUser]);

  // Redirect to login if not authenticated
  const requireAuth = () => {
    if (!isAuthenticated && !isLoading) {
      router.push("/auth/login");
      return false;
    }
    return true;
  };

  // Redirect to dashboard if already authenticated
  const redirectIfAuthenticated = () => {
    if (isAuthenticated && !isLoading) {
      router.push("/dashboard");
      return true;
    }
    return false;
  };

  // Wrapper functions for better type safety
  const loginUser = async (
    email: string,
    password: string,
    remember?: boolean,
  ) => {
    const credentials: LoginCredentials = { email, password, remember };
    return login(credentials);
  };

  const registerUser = async (userData: RegisterData) => {
    return register(userData);
  };

  return {
    // State
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    error,

    // Actions
    login: loginUser,
    register: registerUser,
    logout,
    getCurrentUser,
    clearError,

    // Role and permission checks
    isRole,
    hasPermission,
    isAdmin,
    canManageOperations,
    canAccessFinance,

    // Navigation helpers
    requireAuth,
    redirectIfAuthenticated,
  };
}
