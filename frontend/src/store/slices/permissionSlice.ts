import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

// Define the permission state interface
interface PermissionState {
  permissions: string[]; // Array of permission strings (e.g., "shipment:create:own")
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

// Initial state
const initialState: PermissionState = {
  permissions: [],
  isLoading: false,
  error: null,
  lastFetched: null,
};

// Helper function to check if user has a specific permission
const hasPermission = (
  permissions: string[],
  requiredPermission: string,
): boolean => {
  // Check for exact match
  if (permissions.includes(requiredPermission)) {
    return true;
  }

  // Check for wildcard permissions
  const [module, action, scope] = requiredPermission.split(":");

  // Check module:action:* (any scope)
  if (permissions.includes(`${module}:${action}:*`)) {
    return true;
  }

  // Check module:*:scope (any action)
  if (permissions.includes(`${module}:*:${scope}`)) {
    return true;
  }

  // Check module:*:* (any action, any scope)
  if (permissions.includes(`${module}:*:*`)) {
    return true;
  }

  // Check *:*:* (superadmin - all permissions)
  if (permissions.includes("*:*:*")) {
    return true;
  }

  return false;
};

// Create the permission slice
export const permissionSlice = createSlice({
  name: "permission",
  initialState,

  reducers: {
    // Set permissions after fetching from backend
    setPermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
      state.lastFetched = Date.now();
      state.error = null;
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Clear permissions (on logout)
    clearPermissions: (state) => {
      state.permissions = [];
      state.error = null;
      state.lastFetched = null;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
});

// Export actions
export const {
  setPermissions,
  setLoading,
  setError,
  clearPermissions,
  clearError,
} = permissionSlice.actions;

// Export selectors
export const selectPermissions = (state: RootState) =>
  state.permission.permissions;
export const selectPermissionLoading = (state: RootState) =>
  state.permission.isLoading;
export const selectPermissionError = (state: RootState) =>
  state.permission.error;
export const selectLastFetched = (state: RootState) =>
  state.permission.lastFetched;

// Selector to check if user has a specific permission
export const selectHasPermission = (permission: string) => (state: RootState) =>
  hasPermission(state.permission.permissions, permission);

// Selector to check if user has any of the given permissions
export const selectHasAnyPermission =
  (permissions: string[]) => (state: RootState) =>
    permissions.some((permission) =>
      hasPermission(state.permission.permissions, permission),
    );

// Selector to check if user has all of the given permissions
export const selectHasAllPermissions =
  (permissions: string[]) => (state: RootState) =>
    permissions.every((permission) =>
      hasPermission(state.permission.permissions, permission),
    );

// Export reducer
export default permissionSlice.reducer;
