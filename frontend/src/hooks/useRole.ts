import { useCallback } from "react";
import { useAuth } from "./useAuth";

/**
 * System Roles with hierarchy
 */
export enum SystemRole {
  // System Level
  SUPERADMIN = "superadmin",
  ADMIN = "admin",

  // Client Level (License Holders)
  CLIENT = "client",
  ACCOUNTS = "accounts",
  SALES = "sales",
  SUPPORT = "support",

  // Partner Level
  AFFILIATE = "affiliate",
}

/**
 * Role hierarchy levels
 * Higher number means higher privileges
 */
const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 100,
  admin: 90,
  client: 70,
  accounts: 60,
  sales: 60,
  support: 60,
  affiliate: 20,
};

/**
 * Role groups for easier checking
 */
const ROLE_GROUPS = {
  system: ["superadmin", "admin"],
  client_level: ["client", "accounts", "sales", "support"],
  finance: ["accounts"],
  sales_team: ["sales"],
  support_team: ["support"],
  management: ["superadmin", "admin", "client"],
};

/**
 * Custom hook for role management
 *
 * Provides utilities for checking roles, role hierarchy, and role groups
 *
 * @example
 * ```tsx
 * const { isRole, hasRole, isInGroup, hasHigherRole } = useRole();
 *
 * if (isRole('admin')) {
 *   // User is exactly admin
 * }
 *
 * if (hasRole(['admin', 'superadmin'])) {
 *   // User is admin or superadmin
 * }
 *
 * if (isInGroup('management')) {
 *   // User is in management group
 * }
 * ```
 */
export function useRole() {
  const { user } = useAuth();
  const currentRole = user?.role || null;

  /**
   * Check if user has exactly this role
   * @param role - Role to check
   */
  const isRole = useCallback(
    (role: string | SystemRole): boolean => {
      return currentRole === role;
    },
    [currentRole],
  );

  /**
   * Check if user has any of the specified roles
   * @param roles - Array of roles to check
   */
  const hasRole = useCallback(
    (roles: string[] | SystemRole[]): boolean => {
      if (!currentRole) return false;
      return roles.includes(currentRole);
    },
    [currentRole],
  );

  /**
   * Check if user is in a specific role group
   * @param group - Group name from ROLE_GROUPS
   */
  const isInGroup = useCallback(
    (group: keyof typeof ROLE_GROUPS): boolean => {
      if (!currentRole) return false;
      return ROLE_GROUPS[group].includes(currentRole);
    },
    [currentRole],
  );

  /**
   * Check if user has a higher role than specified
   * @param role - Role to compare against
   */
  const hasHigherRole = useCallback(
    (role: string | SystemRole): boolean => {
      if (!currentRole) return false;
      const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
      const compareLevel = ROLE_HIERARCHY[role] || 0;
      return currentLevel > compareLevel;
    },
    [currentRole],
  );

  /**
   * Check if user has same or higher role
   * @param role - Role to compare against
   */
  const hasEqualOrHigherRole = useCallback(
    (role: string | SystemRole): boolean => {
      if (!currentRole) return false;
      const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
      const compareLevel = ROLE_HIERARCHY[role] || 0;
      return currentLevel >= compareLevel;
    },
    [currentRole],
  );

  /**
   * Get role hierarchy level
   * @param role - Role to get level for (defaults to current user role)
   */
  const getRoleLevel = useCallback(
    (role?: string | SystemRole): number => {
      const checkRole = role || currentRole;
      if (!checkRole) return 0;
      return ROLE_HIERARCHY[checkRole] || 0;
    },
    [currentRole],
  );

  /**
   * Check if user is a system administrator
   */
  const isSystemAdmin = useCallback((): boolean => {
    return currentRole === "superadmin" || currentRole === "admin";
  }, [currentRole]);

  /**
   * Check if user is a client-level user
   */
  const isClientLevel = useCallback((): boolean => {
    return isInGroup("client_level");
  }, [isInGroup]);

  /**
   * Check if user can manage other users
   */
  const canManageUsers = useCallback((): boolean => {
    return hasRole(["superadmin", "admin", "client"]);
  }, [hasRole]);

  /**
   * Check if user can access financial features
   */
  const canAccessFinance = useCallback((): boolean => {
    return isInGroup("finance") || isSystemAdmin();
  }, [isInGroup, isSystemAdmin]);

  /**
   * Check if user can access sales features
   */
  const canAccessSales = useCallback((): boolean => {
    return (
      isInGroup("sales_team") || isSystemAdmin() || currentRole === "client"
    );
  }, [isInGroup, isSystemAdmin, currentRole]);

  /**
   * Check if user can access support features
   */
  const canAccessSupport = useCallback((): boolean => {
    return (
      isInGroup("support_team") || isSystemAdmin() || currentRole === "client"
    );
  }, [isInGroup, isSystemAdmin, currentRole]);

  /**
   * Get display name for role
   * @param role - Role to get display name for
   */
  const getRoleDisplayName = useCallback(
    (role?: string | SystemRole): string => {
      const checkRole = role || currentRole;
      if (!checkRole) return "Unknown";

      const displayNames: Record<string, string> = {
        superadmin: "Super Admin",
        admin: "Administrator",
        client: "Client",
        accounts: "Accounts Team",
        sales: "Sales Team",
        support: "Support Team",
        affiliate: "Affiliate Partner",
      };

      return displayNames[checkRole] || checkRole;
    },
    [currentRole],
  );

  /**
   * Get role badge color for UI
   * @param role - Role to get color for
   */
  const getRoleBadgeColor = useCallback(
    (role?: string | SystemRole): string => {
      const checkRole = role || currentRole;
      if (!checkRole) return "bg-gray-100 text-gray-800";

      const colors: Record<string, string> = {
        superadmin: "bg-purple-100 text-purple-800",
        admin: "bg-blue-100 text-blue-800",
        client: "bg-green-100 text-green-800",
        accounts: "bg-yellow-100 text-yellow-800",
        sales: "bg-orange-100 text-orange-800",
        support: "bg-indigo-100 text-indigo-800",
        affiliate: "bg-pink-100 text-pink-800",
      };

      return colors[checkRole] || "bg-gray-100 text-gray-800";
    },
    [currentRole],
  );

  /**
   * Get allowed subordinate roles that this user can create
   */
  const getAllowedSubordinateRoles = useCallback((): string[] => {
    if (!currentRole) return [];

    const subordinateRoles: Record<string, string[]> = {
      superadmin: [
        "admin",
        "client",
        "accounts",
        "sales",
        "support",
        "affiliate",
      ],
      admin: ["client", "accounts", "sales", "support", "affiliate"],
      client: ["accounts", "sales", "support"],
      // Other roles cannot create users
    };

    return subordinateRoles[currentRole] || [];
  }, [currentRole]);

  return {
    // Core functions
    isRole,
    hasRole,
    isInGroup,
    hasHigherRole,
    hasEqualOrHigherRole,
    getRoleLevel,

    // Convenience functions
    isSystemAdmin,
    isClientLevel,
    canManageUsers,
    canAccessFinance,
    canAccessSales,
    canAccessSupport,

    // UI helpers
    getRoleDisplayName,
    getRoleBadgeColor,
    getAllowedSubordinateRoles,

    // Current user data
    currentRole,
    user,
  };
}

// Export types
export type Role = keyof typeof SystemRole;
export type RoleGroup = keyof typeof ROLE_GROUPS;
