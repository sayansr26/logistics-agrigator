import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import {
  clearStoredAuth,
  isTokenValid,
  setAuthCookies,
} from "@/lib/auth/token";

// Define user interface based on backend auth service response
interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  clientId?: string;
  parentClientId?: string;
  parentUserId?: string;
  licenseId?: string;
  accessLevel?: string;
  commissionRate?: number;
  commissionType?: string;
  permissions?: string[];
  isActive: boolean;
  createdAt?: string;
}

// Define the auth state interface
interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  /**
   * False until `hydrate` has run on the client.
   *
   * Route guards MUST wait for this before deciding to redirect - otherwise
   * they read the pre-hydration `isAuthenticated: false` and bounce an
   * authenticated user to the login page.
   */
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Initial state (will be hydrated from localStorage on client-side)
const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,
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
        // Never mark hydrated on the server - the client effect owns this.
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const refreshToken = localStorage.getItem("refreshToken");
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;

        // A session is usable when we still know who the user is AND at
        // least one token is alive. An expired access token with a live
        // refresh token is still a valid session - baseQueryWithReauth
        // will swap it out transparently on the next request.
        const sessionUsable =
          !!user && (isTokenValid(token) || isTokenValid(refreshToken));

        if (sessionUsable) {
          state.token = token;
          state.refreshToken = refreshToken;
          state.user = user;
          state.isAuthenticated = true;

          // Keep the edge-middleware cookies in step with localStorage.
          setAuthCookies(token, user.role, refreshToken);
        } else {
          state.token = null;
          state.refreshToken = null;
          state.user = null;
          state.isAuthenticated = false;

          // Purge the dead session so the edge middleware and Redux agree.
          clearStoredAuth();
        }
      } catch (error) {
        console.error("[authSlice.hydrate] Failed to read stored auth:", error);
        state.token = null;
        state.refreshToken = null;
        state.user = null;
        state.isAuthenticated = false;
        clearStoredAuth();
      } finally {
        state.isHydrated = true;
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
      state.isHydrated = true;
      state.error = null;

      // Persist to localStorage + cookies (client-side only).
      // This is the ONLY place login/register persistence happens - the API
      // transformResponse must not write these too, or the two drift apart.
      if (typeof window !== "undefined") {
        localStorage.setItem("token", action.payload.token);
        localStorage.setItem("refreshToken", action.payload.refreshToken);
        localStorage.setItem("user", JSON.stringify(action.payload.user));
        setAuthCookies(
          action.payload.token,
          action.payload.user.role,
          action.payload.refreshToken,
        );
      }
    },

    // Update access token after refresh
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;

      // Persist to localStorage (client-side only)
      if (typeof window !== "undefined") {
        localStorage.setItem("token", action.payload);
        setAuthCookies(action.payload, state.user?.role, state.refreshToken);
      }
    },

    /**
     * Replace both tokens after a successful refresh.
     *
     * The backend rotates the refresh token on every refresh, so we must
     * persist the new one or the next refresh will fail against the session row.
     */
    setTokens: (
      state,
      action: PayloadAction<{ token: string; refreshToken?: string | null }>,
    ) => {
      state.token = action.payload.token;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
      state.isAuthenticated = true;

      if (typeof window !== "undefined") {
        localStorage.setItem("token", action.payload.token);
        if (action.payload.refreshToken) {
          localStorage.setItem("refreshToken", action.payload.refreshToken);
        }
        setAuthCookies(
          action.payload.token,
          state.user?.role,
          state.refreshToken,
        );
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
      // Stay hydrated - we know the answer now, guards must not re-suspend.
      state.isHydrated = true;

      // Clear localStorage AND cookies, so the edge middleware and Redux
      // cannot disagree about whether a session exists.
      clearStoredAuth();
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
  setTokens,
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
export const selectIsHydrated = (state: RootState) => state.auth.isHydrated;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;

// Export reducer
export default authSlice.reducer;
