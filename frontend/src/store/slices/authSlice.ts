import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

// Define user interface based on backend auth service response
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId?: string;
  parentClientId?: string;
  parentUserId?: string;
  licenseId?: string;
  assignedCustomerIds?: string[];
  accessLevel?: string;
  commissionRate?: number;
  commissionType?: string;
  isActive: boolean;
  createdAt?: string;
  outletId?: string;
  outletRole?: string;
}

// Define the auth state interface
interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Initial state (will be hydrated from localStorage on client-side)
const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Create the auth slice
export const authSlice = createSlice({
  name: "auth",
  initialState,

  reducers: {
    // Hydrate auth state from localStorage (client-side only)
    hydrate: (state) => {
      if (typeof window === "undefined") {
        console.log("[authSlice.hydrate] Skipping - running on server");
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const refreshToken = localStorage.getItem("refreshToken");
        const userStr = localStorage.getItem("user");

        console.log(
          "[authSlice.hydrate] Token from localStorage:",
          token ? "EXISTS" : "NULL",
        );
        console.log(
          "[authSlice.hydrate] User from localStorage:",
          userStr ? "EXISTS" : "NULL",
        );

        if (token && userStr) {
          const user = JSON.parse(userStr);
          state.token = token;
          state.refreshToken = refreshToken;
          state.user = user;
          state.isAuthenticated = true;
          console.log("[authSlice.hydrate] ✅ State hydrated successfully", {
            userId: user.id,
            role: user.role,
            isAuthenticated: true,
          });
        } else {
          console.log(
            "[authSlice.hydrate] ❌ No token or user in localStorage",
          );
        }
      } catch (error) {
        console.error(
          "[authSlice.hydrate] Error loading auth from localStorage:",
          error,
        );
      }
    },

    // Set credentials after successful login
    setCredentials: (
      state,
      action: PayloadAction<{
        token: string;
        refreshToken: string;
        user: User;
      }>,
    ) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;

      // Persist to localStorage (client-side only)
      if (typeof window !== "undefined") {
        console.log("[authSlice.setCredentials] Saving to localStorage", {
          userId: action.payload.user.id,
          role: action.payload.user.role,
          hasToken: !!action.payload.token,
        });
        localStorage.setItem("token", action.payload.token);
        localStorage.setItem("refreshToken", action.payload.refreshToken);
        localStorage.setItem("user", JSON.stringify(action.payload.user));
        console.log(
          "[authSlice.setCredentials] ✅ Saved to localStorage successfully",
        );
      }
    },

    // Update access token after refresh
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;

      // Persist to localStorage (client-side only)
      if (typeof window !== "undefined") {
        localStorage.setItem("token", action.payload);
      }
    },

    // Update user information
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;

      // Persist to localStorage (client-side only)
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(action.payload));
      }
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Logout - clear all auth state
    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;

      // Clear localStorage (client-side only)
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      }
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
});

// Export actions
export const {
  hydrate,
  setCredentials,
  setToken,
  setUser,
  setLoading,
  setError,
  logout,
  clearError,
} = authSlice.actions;

// Export selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectToken = (state: RootState) => state.auth.token;
export const selectIsAuthenticated = (state: RootState) =>
  state.auth.isAuthenticated;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;

// Export reducer
export default authSlice.reducer;
