"use client";

import React from "react";
import { useRole, type SystemRole } from "@/hooks/useRole";
import { AccessDenied } from "./AccessDenied";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface RoleGuardProps {
  /**
   * Single role or array of roles that are allowed
   */
  roles: SystemRole | SystemRole[] | string | string[];

  /**
   * Children to render if role check passes
   */
  children: React.ReactNode;

  /**
   * Custom fallback component to show when access is denied
   */
  fallback?: React.ReactNode;

  /**
   * Whether to show loading state while checking roles
   */
  showLoading?: boolean;

  /**
   * Custom loading component
   */
  loadingComponent?: React.ReactNode;

  /**
   * Whether to hide content instead of showing access denied
   */
  hideOnDenied?: boolean;

  /**
   * Additional message to show when access is denied
   */
  deniedMessage?: string;

  /**
   * Whether to require all roles (AND logic) instead of any role (OR logic)
   */
  requireAll?: boolean;
}

/**
 * RoleGuard component
 *
 * Guards content based on user roles
 * Shows access denied or hides content when role check fails
 *
 * @example
 * ```tsx
 * // Single role
 * <RoleGuard roles={SystemRole.ADMIN}>
 *   <AdminPanel />
 * </RoleGuard>
 *
 * // Multiple roles (OR logic - user needs any of these)
 * <RoleGuard roles={[SystemRole.ADMIN, SystemRole.SUPERADMIN]}>
 *   <ManagementDashboard />
 * </RoleGuard>
 *
 * // Multiple roles (AND logic - user needs all of these)
 * <RoleGuard roles={["admin", "verified"]} requireAll>
 *   <VerifiedAdminContent />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  roles,
  children,
  fallback,
  showLoading = true,
  loadingComponent,
  hideOnDenied = false,
  deniedMessage,
  requireAll = false,
}: RoleGuardProps) {
  const { isLoading } = useAuth();
  const { hasRole, isRole } = useRole();

  // Show loading state while auth is loading
  if (showLoading && isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Normalize roles to array
  const roleArray = Array.isArray(roles) ? roles : [roles];

  // Check role access
  let hasAccess: boolean;

  if (requireAll) {
    // AND logic - user must have all specified roles
    hasAccess = roleArray.every((role) => isRole(role));
  } else {
    // OR logic - user needs at least one of the specified roles
    hasAccess = hasRole(roleArray);
  }

  // User has required role(s) - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // No required role(s) - handle denial
  if (hideOnDenied) {
    // Hide content completely
    return null;
  }

  if (fallback) {
    // Use custom fallback component
    return <>{fallback}</>;
  }

  // Show access denied component
  const roleDisplay = requireAll
    ? `All of: ${roleArray.join(", ")}`
    : roleArray.length === 1
      ? roleArray[0]
      : `One of: ${roleArray.join(", ")}`;

  return (
    <AccessDenied requiredRole={roleDisplay} customMessage={deniedMessage} />
  );
}

/**
 * RoleGroupGuard component
 *
 * Guards content based on role groups (e.g., "management", "finance")
 *
 * @example
 * ```tsx
 * <RoleGroupGuard group="management">
 *   <ManagementTools />
 * </RoleGroupGuard>
 *
 * <RoleGroupGuard group="finance">
 *   <FinancialReports />
 * </RoleGroupGuard>
 * ```
 */
interface RoleGroupGuardProps {
  /**
   * Role group to check
   */
  group:
    | "system"
    | "client_level"
    | "customer_level"
    | "finance"
    | "sales_team"
    | "support_team"
    | "management";

  /**
   * Children to render if role group check passes
   */
  children: React.ReactNode;

  /**
   * Custom fallback component to show when access is denied
   */
  fallback?: React.ReactNode;

  /**
   * Whether to show loading state while checking roles
   */
  showLoading?: boolean;

  /**
   * Custom loading component
   */
  loadingComponent?: React.ReactNode;

  /**
   * Whether to hide content instead of showing access denied
   */
  hideOnDenied?: boolean;

  /**
   * Additional message to show when access is denied
   */
  deniedMessage?: string;
}

export function RoleGroupGuard({
  group,
  children,
  fallback,
  showLoading = true,
  loadingComponent,
  hideOnDenied = false,
  deniedMessage,
}: RoleGroupGuardProps) {
  const { isLoading } = useAuth();
  const { isInGroup } = useRole();

  // Show loading state while auth is loading
  if (showLoading && isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check role group access
  const hasAccess = isInGroup(group);

  // User is in the required group - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // Not in required group - handle denial
  if (hideOnDenied) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Show access denied component
  const groupDisplayNames: Record<typeof group, string> = {
    system: "System Administrators",
    client_level: "Client Team Members",
    customer_level: "Customer Team Members",
    finance: "Finance Team",
    sales_team: "Sales Team",
    support_team: "Support Team",
    management: "Management",
  };

  return (
    <AccessDenied
      requiredRole={`${groupDisplayNames[group]} group`}
      customMessage={deniedMessage}
    />
  );
}

/**
 * HierarchyGuard component
 *
 * Guards content based on role hierarchy level
 *
 * @example
 * ```tsx
 * // User must have higher role than "customer"
 * <HierarchyGuard minimumRole="customer" comparison="higher">
 *   <TeamManagement />
 * </HierarchyGuard>
 *
 * // User must have admin or higher
 * <HierarchyGuard minimumRole="admin" comparison="equalOrHigher">
 *   <AdminFeatures />
 * </HierarchyGuard>
 * ```
 */
interface HierarchyGuardProps {
  /**
   * Minimum role to compare against
   */
  minimumRole: SystemRole | string;

  /**
   * Comparison type
   */
  comparison: "higher" | "equalOrHigher";

  /**
   * Children to render if hierarchy check passes
   */
  children: React.ReactNode;

  /**
   * Custom fallback component to show when access is denied
   */
  fallback?: React.ReactNode;

  /**
   * Whether to show loading state while checking roles
   */
  showLoading?: boolean;

  /**
   * Custom loading component
   */
  loadingComponent?: React.ReactNode;

  /**
   * Whether to hide content instead of showing access denied
   */
  hideOnDenied?: boolean;

  /**
   * Additional message to show when access is denied
   */
  deniedMessage?: string;
}

export function HierarchyGuard({
  minimumRole,
  comparison,
  children,
  fallback,
  showLoading = true,
  loadingComponent,
  hideOnDenied = false,
  deniedMessage,
}: HierarchyGuardProps) {
  const { isLoading } = useAuth();
  const { hasHigherRole, hasEqualOrHigherRole } = useRole();

  // Show loading state while auth is loading
  if (showLoading && isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check role hierarchy
  const hasAccess =
    comparison === "higher"
      ? hasHigherRole(minimumRole)
      : hasEqualOrHigherRole(minimumRole);

  // User meets hierarchy requirement - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // Doesn't meet hierarchy requirement - handle denial
  if (hideOnDenied) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Show access denied component
  const requirementText =
    comparison === "higher"
      ? `Role higher than ${minimumRole}`
      : `Role of ${minimumRole} or higher`;

  return (
    <AccessDenied
      requiredRole={requirementText}
      customMessage={deniedMessage}
    />
  );
}
