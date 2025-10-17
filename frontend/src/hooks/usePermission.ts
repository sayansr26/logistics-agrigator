import { useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { useAuth } from "./useAuth";

/**
 * Custom hook for permission management
 *
 * Provides utilities for checking permissions with wildcard support,
 * following the format: {module}:{action}:{scope}
 *
 * @example
 * ```tsx
 * const { hasPermission, hasModuleAccess, canPerformAction } = usePermission();
 *
 * if (hasPermission('shipment', 'create', 'own')) {
 *   // User can create their own shipments
 * }
 *
 * if (hasModuleAccess('wallet')) {
 *   // User has some access to wallet module
 * }
 * ```
 */
export function usePermission() {
  const { user, permissions } = useAuth();
  const permissionsFromStore = useAppSelector(
    (state) => state.permission.permissions,
  );

  // Use permissions from auth hook or Redux store
  const effectivePermissions =
    permissions.length > 0 ? permissions : permissionsFromStore;

  /**
   * Check if user has a specific permission
   * @param module - Module name (e.g., 'shipment', 'wallet', '*')
   * @param action - Action name (e.g., 'create', 'read', '*')
   * @param scope - Scope name (e.g., 'own', 'parent', 'all', '*')
   */
  const hasPermission = useCallback(
    (module: string, action: string, scope: string = "own"): boolean => {
      // Superadmin has all permissions
      if (user?.role === "superadmin") return true;

      if (!effectivePermissions || effectivePermissions.length === 0)
        return false;

      const requiredPermission = `${module}:${action}:${scope}`;

      return effectivePermissions.some((permission: any) => {
        const permString =
          typeof permission === "string"
            ? permission
            : `${permission.module}:${permission.action}:${permission.scope}`;

        return matchesPermission(requiredPermission, permString);
      });
    },
    [user, effectivePermissions],
  );

  /**
   * Check if user has any access to a module
   * @param module - Module name to check
   */
  const hasModuleAccess = useCallback(
    (module: string): boolean => {
      // Superadmin has all permissions
      if (user?.role === "superadmin") return true;

      if (!effectivePermissions || effectivePermissions.length === 0)
        return false;

      return effectivePermissions.some((permission: any) => {
        const permString =
          typeof permission === "string"
            ? permission
            : `${permission.module}:${permission.action}:${permission.scope}`;

        const [permModule] = permString.split(":");
        return permModule === "*" || permModule === module;
      });
    },
    [user, effectivePermissions],
  );

  /**
   * Check if user can perform an action on any scope
   * @param module - Module name
   * @param action - Action to check
   */
  const canPerformAction = useCallback(
    (module: string, action: string): boolean => {
      // Superadmin has all permissions
      if (user?.role === "superadmin") return true;

      if (!effectivePermissions || effectivePermissions.length === 0)
        return false;

      return effectivePermissions.some((permission: any) => {
        const permString =
          typeof permission === "string"
            ? permission
            : `${permission.module}:${permission.action}:${permission.scope}`;

        const [permModule, permAction] = permString.split(":");

        const moduleMatches = permModule === "*" || permModule === module;
        const actionMatches = permAction === "*" || permAction === action;

        return moduleMatches && actionMatches;
      });
    },
    [user, effectivePermissions],
  );

  /**
   * Get all permissions for a specific module
   * @param module - Module name
   */
  const getModulePermissions = useCallback(
    (module: string): string[] => {
      if (!effectivePermissions) return [];

      return effectivePermissions
        .filter((permission: any) => {
          const permString =
            typeof permission === "string"
              ? permission
              : `${permission.module}:${permission.action}:${permission.scope}`;

          const [permModule] = permString.split(":");
          return permModule === "*" || permModule === module;
        })
        .map((permission: any) =>
          typeof permission === "string"
            ? permission
            : `${permission.module}:${permission.action}:${permission.scope}`,
        );
    },
    [effectivePermissions],
  );

  /**
   * Check scope hierarchy (own < assigned < parent < all)
   * @param requiredScope - Required scope
   * @param userScope - User's scope
   */
  const hasSufficientScope = useCallback(
    (requiredScope: string, userScope: string): boolean => {
      const scopeHierarchy: Record<string, number> = {
        own: 1,
        assigned: 2,
        parent: 3,
        all: 4,
        "*": 5, // Wildcard is highest
      };

      const requiredLevel = scopeHierarchy[requiredScope] || 0;
      const userLevel = scopeHierarchy[userScope] || 0;

      return userLevel >= requiredLevel;
    },
    [],
  );

  /**
   * Check if user can access resource with advanced scope checking
   * @param module - Module name
   * @param action - Action name
   * @param scope - Required scope
   */
  const canAccessResource = useCallback(
    (module: string, action: string, scope: string = "own"): boolean => {
      // Superadmin has all permissions
      if (user?.role === "superadmin") return true;

      if (!effectivePermissions || effectivePermissions.length === 0)
        return false;

      return effectivePermissions.some((permission: any) => {
        const permString =
          typeof permission === "string"
            ? permission
            : `${permission.module}:${permission.action}:${permission.scope}`;

        const [permModule, permAction, permScope] = permString.split(":");

        const moduleMatches = permModule === "*" || permModule === module;
        const actionMatches = permAction === "*" || permAction === action;
        const scopeMatches =
          permScope === "*" || hasSufficientScope(scope, permScope);

        return moduleMatches && actionMatches && scopeMatches;
      });
    },
    [user, effectivePermissions, hasSufficientScope],
  );

  /**
   * Get user's highest scope for a module:action combination
   * @param module - Module name
   * @param action - Action name
   */
  const getHighestScope = useCallback(
    (module: string, action: string): string | null => {
      if (user?.role === "superadmin") return "*";

      if (!effectivePermissions || effectivePermissions.length === 0)
        return null;

      const scopeHierarchy: Record<string, number> = {
        own: 1,
        assigned: 2,
        parent: 3,
        all: 4,
        "*": 5,
      };

      let highestScope: string | null = null;
      let highestLevel = 0;

      effectivePermissions.forEach((permission: any) => {
        const permString =
          typeof permission === "string"
            ? permission
            : `${permission.module}:${permission.action}:${permission.scope}`;

        const [permModule, permAction, permScope] = permString.split(":");

        const moduleMatches = permModule === "*" || permModule === module;
        const actionMatches = permAction === "*" || permAction === action;

        if (moduleMatches && actionMatches) {
          const level = scopeHierarchy[permScope] || 0;
          if (level > highestLevel) {
            highestLevel = level;
            highestScope = permScope;
          }
        }
      });

      return highestScope;
    },
    [user, effectivePermissions],
  );

  return {
    hasPermission,
    hasModuleAccess,
    canPerformAction,
    getModulePermissions,
    hasSufficientScope,
    canAccessResource,
    getHighestScope,
    permissions: effectivePermissions,
    user,
  };
}

/**
 * Helper function to match permissions with wildcard support
 * @param required - Required permission string
 * @param userPermission - User's permission string
 */
function matchesPermission(required: string, userPermission: string): boolean {
  const [reqModule, reqAction, reqScope] = required.split(":");
  const [userModule, userAction, userScope] = userPermission.split(":");

  // Check module match (wildcard or exact)
  if (userModule !== "*" && userModule !== reqModule) return false;

  // Check action match (wildcard or exact)
  if (userAction !== "*" && userAction !== reqAction) return false;

  // Check scope match (wildcard or exact)
  if (userScope !== "*" && userScope !== reqScope) return false;

  return true;
}

// Export types
export type PermissionModule =
  | "client"
  | "license"
  | "customer"
  | "shipment"
  | "wallet"
  | "partner"
  | "user"
  | "billing"
  | "analytics"
  | "support"
  | "platform"
  | "settings"
  | "*";

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "list"
  | "export"
  | "manage"
  | "approve"
  | "assign"
  | "*";

export type PermissionScope = "own" | "parent" | "assigned" | "all" | "*";
