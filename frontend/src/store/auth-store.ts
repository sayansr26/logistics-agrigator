import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApiService } from "@/services";
import { User, LoginCredentials, RegisterData } from "@/types/auth";

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApiService.login(credentials);

          if (response.status === "success" && response.data) {
            const { user, accessToken, refreshToken } = response.data;

            // Set token in API service
            authApiService.setAccessToken(accessToken);

            set({
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.error?.message || "Login failed");
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Login failed";
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      register: async (userData: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApiService.register(userData);

          if (response.status === "success" && response.data) {
            const { user, accessToken, refreshToken } = response.data;

            // Set token in API service
            authApiService.setAccessToken(accessToken);

            set({
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.error?.message || "Registration failed");
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Registration failed";
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          // Call logout endpoint if we have tokens
          const { accessToken, refreshToken } = get();
          if (accessToken || refreshToken) {
            await authApiService.logout(
              accessToken || undefined,
              refreshToken || undefined,
            );
          }
        } catch (error) {
          console.error("Logout error:", error);
        } finally {
          // Clear tokens from API service
          authApiService.setAccessToken(null);

          // Clear local state
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        try {
          const response = await authApiService.refreshToken(refreshToken);

          if (response.status === "success" && response.data) {
            const { accessToken, refreshToken: newRefreshToken } =
              response.data;

            // Update tokens
            authApiService.setAccessToken(accessToken);
            set({
              accessToken,
              refreshToken: newRefreshToken,
            });
          } else {
            throw new Error("Token refresh failed");
          }
        } catch (error) {
          // If refresh fails, logout user
          get().logout();
          throw error;
        }
      },

      getCurrentUser: async () => {
        const { accessToken } = get();
        if (!accessToken) return;

        try {
          // Set the access token first
          authApiService.setAccessToken(accessToken);

          const response = await authApiService.getUserProfile();

          if (response.status === "success" && response.data) {
            set({ user: response.data.user });
          }
        } catch (error) {
          console.error("Failed to get current user:", error);
          // Don't logout immediately, just log the error
          // User might still be able to use the app with cached data
          console.warn("Continuing with cached user data");
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Set the access token in the API service when rehydrating from storage
        if (state?.accessToken) {
          authApiService.setAccessToken(state.accessToken);
        }
      },
    },
  ),
);
