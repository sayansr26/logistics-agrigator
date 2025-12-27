"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const {
    isAuthenticated,
    isLoading,
    user,
    isRole,
    hasPermission,
    requireAuth,
  } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      requireAuth();
    }
  }, [isLoading, isAuthenticated, requireAuth]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  // Check role requirement
  if (requiredRole && !isRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Required role: {requiredRole}
          </p>
        </div>
      </div>
    );
  }

  // Check permission requirement
  // requiredPermission format: "module:action:scope" (e.g., "user:read:all")
  if (requiredPermission) {
    const [module, action, scope = "own"] = requiredPermission.split(":");
    if (!hasPermission(module, action, scope)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">
              Access Denied
            </h1>
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Required permission: {requiredPermission}
            </p>
          </div>
        </div>
      );
    }
  }

  // User is authenticated and has required permissions
  return <>{children}</>;
}
