"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const { isAuthenticated, isHydrated, isRole, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Never decide anything before Redux has read localStorage - the
    // pre-hydration state always looks unauthenticated, and acting on it
    // is what used to bounce signed-in users to the login page.
    if (!isHydrated) return;

    if (!isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      const redirect = encodeURIComponent(pathname || "/dashboard");
      // `replace` so Back doesn't return to the page we just rejected.
      router.replace(`/auth/login?redirect=${redirect}`);
    }

    if (isAuthenticated) {
      hasRedirected.current = false;
    }
  }, [isHydrated, isAuthenticated, pathname, router]);

  // Show loading while hydrating - never render children or redirect yet.
  if (!isHydrated) {
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
