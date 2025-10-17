"use client";

import React from "react";
import {
  usePermission,
  type PermissionModule,
  type PermissionAction,
  type PermissionScope,
} from "@/hooks/usePermission";
import { AccessDenied } from "./AccessDenied";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface PermissionGuardProps {
  /**
   * Module to check permission for
   */
  module: PermissionModule;

  /**
   * Action to check permission for
   */
  action: PermissionAction;

  /**
   * Scope to check permission for (defaults to "own")
   */
  scope?: PermissionScope;

  /**
   * Children to render if permission is granted
   */
  children: React.ReactNode;

  /**
   * Custom fallback component to show when access is denied
   */
  fallback?: React.ReactNode;

  /**
   * Whether to show loading state while checking permissions
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

/**
 * PermissionGuard component
 *
 * Guards content based on user permissions
 * Shows access denied or hides content when permission is not granted
 *
 * @example
 * ```tsx
 * <PermissionGuard module="shipment" action="create" scope="own">
 *   <CreateShipmentButton />
 * </PermissionGuard>
 *
 * <PermissionGuard
 *   module="user"
 *   action="manage"
 *   scope="all"
 *   deniedMessage="You need admin privileges to manage users"
 * >
 *   <UserManagementPanel />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  module,
  action,
  scope = "own",
  children,
  fallback,
  showLoading = true,
  loadingComponent,
  hideOnDenied = false,
  deniedMessage,
}: PermissionGuardProps) {
  const { isLoadingPermissions } = useAuth();
  const { hasPermission, canAccessResource } = usePermission();

  // Show loading state while permissions are being loaded
  if (showLoading && isLoadingPermissions) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check permission with advanced scope checking
  const hasAccess = canAccessResource(module, action, scope);

  // User has permission - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // No permission - handle denial
  if (hideOnDenied) {
    // Hide content completely
    return null;
  }

  if (fallback) {
    // Use custom fallback component
    return <>{fallback}</>;
  }

  // Show access denied component
  return (
    <AccessDenied
      requiredPermission={`${module}:${action}:${scope}`}
      customMessage={deniedMessage}
    />
  );
}

/**
 * MultiPermissionGuard component
 *
 * Guards content based on multiple permissions (OR logic)
 * User needs at least one of the specified permissions
 *
 * @example
 * ```tsx
 * <MultiPermissionGuard
 *   permissions={[
 *     { module: "shipment", action: "create", scope: "own" },
 *     { module: "shipment", action: "manage", scope: "all" }
 *   ]}
 * >
 *   <ShipmentActions />
 * </MultiPermissionGuard>
 * ```
 */
interface MultiPermissionGuardProps {
  permissions: Array<{
    module: PermissionModule;
    action: PermissionAction;
    scope?: PermissionScope;
  }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLoading?: boolean;
  loadingComponent?: React.ReactNode;
  hideOnDenied?: boolean;
  deniedMessage?: string;
  requireAll?: boolean; // If true, requires ALL permissions (AND logic)
}

export function MultiPermissionGuard({
  permissions,
  children,
  fallback,
  showLoading = true,
  loadingComponent,
  hideOnDenied = false,
  deniedMessage,
  requireAll = false,
}: MultiPermissionGuardProps) {
  const { isLoadingPermissions } = useAuth();
  const { canAccessResource } = usePermission();

  // Show loading state while permissions are being loaded
  if (showLoading && isLoadingPermissions) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check permissions
  const permissionChecks = permissions.map((perm) =>
    canAccessResource(perm.module, perm.action, perm.scope || "own"),
  );

  const hasAccess = requireAll
    ? permissionChecks.every((check) => check) // AND logic - all must be true
    : permissionChecks.some((check) => check); // OR logic - at least one must be true

  // User has permission - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // No permission - handle denial
  if (hideOnDenied) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Show access denied with list of required permissions
  const permissionStrings = permissions.map(
    (p) => `${p.module}:${p.action}:${p.scope || "own"}`,
  );

  return (
    <AccessDenied
      requiredPermission={
        requireAll
          ? `All of: ${permissionStrings.join(", ")}`
          : `One of: ${permissionStrings.join(", ")}`
      }
      customMessage={deniedMessage}
    />
  );
}
