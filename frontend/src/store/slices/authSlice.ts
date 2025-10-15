import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

// Define user interface based on backend auth service response
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId?: string;
  parentUserId?: string;
  accessLevel?: "FULL" | "RESTRICTED";
  isActive: boolean;
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

// Initial state
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
    },

    // Update access token after refresh
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },

    // Update user information
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
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
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
});

// Export actions
export const {
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
