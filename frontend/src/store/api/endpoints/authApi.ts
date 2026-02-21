import { baseApi } from "../baseApi";

/**
 * Authentication API Endpoints
 *
 * All authentication endpoints route through API Gateway (port 3001)
 * with automatic JWT token management and refresh handling.
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  // Accept either name OR firstName+lastName
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  // Note: role is ignored for public signup - always enforced as 'customer' on backend
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  isActive: boolean;
  clientId?: string;
  parentClientId?: string;
  parentUserId?: string;
  licenseId?: string;
  assignedCustomerIds?: string[];
  accessLevel?: string;
  commissionRate?: number;
  commissionType?: string;
  createdAt: string;
}

interface Permission {
  id: string;
  module: string;
  action: string;
  scope: string;
  description?: string;
}

// Backend response interface (what API actually returns)
interface BackendAuthResponse {
  status: string;
  message?: string;
  data: {
    accessToken: string; // Backend returns accessToken
    refreshToken: string;
    user: User;
    expiresIn?: number;
  };
}

// Frontend interface (normalized format)
interface AuthResponse {
  status: string;
  message: string;
  data: {
    token: string; // We normalize to 'token' for consistency
    refreshToken: string;
    user: User;
  };
}

interface PermissionsResponse {
  status: string;
  message: string;
  data: {
    permissions: Permission[];
  };
}

interface ProfileResponse {
  status: string;
  message: string;
  data: {
    user: User;
  };
}

interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  email?: string;
}

// ===========================
// RTK Query API Definition
// ===========================

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Login - Authenticate user and receive tokens
     */
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/api/v1/auth/login",
        method: "POST",
        body: credentials,
      }),
      transformResponse: (response: BackendAuthResponse) => {
        console.log("[authApi.login] Backend response:", {
          hasAccessToken: !!response.data?.accessToken,
          hasRefreshToken: !!response.data?.refreshToken,
          hasUser: !!response.data?.user,
        });

        // Transform backend response (accessToken) to frontend format (token)
        const normalizedResponse: AuthResponse = {
          status: response.status,
          message: response.message || "Login successful",
          data: {
            token: response.data.accessToken, // Transform accessToken -> token
            refreshToken: response.data.refreshToken,
            user: response.data.user,
          },
        };

        // Store tokens in localStorage for persistence
        if (normalizedResponse.data?.token) {
          console.log("[authApi.login] ✅ Saving token to localStorage");
          localStorage.setItem("token", normalizedResponse.data.token);

          // Also set cookies for middleware authentication
          document.cookie = `token=${normalizedResponse.data.token}; path=/; max-age=86400; SameSite=Lax`;
        }
        if (normalizedResponse.data?.refreshToken) {
          console.log("[authApi.login] ✅ Saving refreshToken to localStorage");
          localStorage.setItem(
            "refreshToken",
            normalizedResponse.data.refreshToken,
          );
        }
        if (normalizedResponse.data?.user) {
          console.log("[authApi.login] ✅ Saving user to localStorage");
          localStorage.setItem(
            "user",
            JSON.stringify(normalizedResponse.data.user),
          );

          // Also set userRole cookie for middleware
          document.cookie = `userRole=${normalizedResponse.data.user.role}; path=/; max-age=86400; SameSite=Lax`;
        }

        return normalizedResponse;
      },
      invalidatesTags: ["Auth", "User"],
    }),

    /**
     * Register - Create new user account
     */
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (userData) => ({
        url: "/api/v1/auth/register",
        method: "POST",
        body: userData,
      }),
      transformResponse: (response: BackendAuthResponse) => {
        console.log("[authApi.register] Backend response:", {
          hasAccessToken: !!response.data?.accessToken,
          hasRefreshToken: !!response.data?.refreshToken,
          hasUser: !!response.data?.user,
        });

        // Transform backend response (accessToken) to frontend format (token)
        const normalizedResponse: AuthResponse = {
          status: response.status,
          message: response.message || "Registration successful",
          data: {
            token: response.data.accessToken, // Transform accessToken -> token
            refreshToken: response.data.refreshToken,
            user: response.data.user,
          },
        };

        // Auto-login after registration - store tokens
        if (normalizedResponse.data?.token) {
          console.log("[authApi.register] ✅ Saving token to localStorage");
          localStorage.setItem("token", normalizedResponse.data.token);

          // Also set cookies for middleware authentication
          document.cookie = `token=${normalizedResponse.data.token}; path=/; max-age=86400; SameSite=Lax`;
        }
        if (normalizedResponse.data?.refreshToken) {
          console.log(
            "[authApi.register] ✅ Saving refreshToken to localStorage",
          );
          localStorage.setItem(
            "refreshToken",
            normalizedResponse.data.refreshToken,
          );
        }
        if (normalizedResponse.data?.user) {
          console.log("[authApi.register] ✅ Saving user to localStorage");
          localStorage.setItem(
            "user",
            JSON.stringify(normalizedResponse.data.user),
          );

          // Also set userRole cookie for middleware
          document.cookie = `userRole=${normalizedResponse.data.user.role}; path=/; max-age=86400; SameSite=Lax`;
        }

        return normalizedResponse;
      },
      invalidatesTags: ["Auth", "User"],
    }),

    /**
     * Logout - End user session and clear tokens
     */
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/api/v1/auth/logout",
        method: "POST",
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          // Clear tokens regardless of API success
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");

          // Clear cookies
          document.cookie =
            "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie =
            "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

          // Reset entire API cache
          dispatch(baseApi.util.resetApiState());
        }
      },
      invalidatesTags: ["Auth", "User", "Permission"],
    }),

    /**
     * Refresh Token - Get new access token using refresh token
     */
    refreshToken: builder.mutation<AuthResponse, void>({
      query: () => {
        const refreshToken = localStorage.getItem("refreshToken");
        return {
          url: "/api/v1/auth/refresh",
          method: "POST",
          body: { refreshToken },
        };
      },
      transformResponse: (response: BackendAuthResponse) => {
        console.log("[authApi.refreshToken] Backend response:", {
          hasAccessToken: !!response.data?.accessToken,
        });

        // Transform backend response (accessToken) to frontend format (token)
        const normalizedResponse: AuthResponse = {
          status: response.status,
          message: response.message || "Token refreshed",
          data: {
            token: response.data.accessToken, // Transform accessToken -> token
            refreshToken: response.data.refreshToken,
            user: response.data.user,
          },
        };

        // Update stored access token
        if (normalizedResponse.data?.token) {
          console.log(
            "[authApi.refreshToken] ✅ Updating token in localStorage",
          );
          localStorage.setItem("token", normalizedResponse.data.token);
        }
        return normalizedResponse;
      },
    }),

    /**
     * Get Current User - Fetch authenticated user profile
     */
    getMe: builder.query<ProfileResponse, void>({
      query: () => "/api/v1/auth/me",
      providesTags: ["Auth", "User"],
    }),

    /**
     * Get User Profile - Fetch detailed user profile
     */
    getProfile: builder.query<ProfileResponse, void>({
      query: () => "/api/v1/auth/profile",
      providesTags: ["User"],
    }),

    /**
     * Update Profile - Update user profile information
     */
    updateProfile: builder.mutation<ProfileResponse, UpdateProfileRequest>({
      query: (updates) => ({
        url: "/api/v1/auth/profile",
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: ["User", "Auth"],
    }),

    /**
     * Get User Permissions - Fetch effective permissions for current user
     */
    getUserPermissions: builder.query<PermissionsResponse, string>({
      query: (userId) => `/api/v1/users/${userId}/permissions`,
      providesTags: ["Permission"],
    }),

    /**
     * Forgot Password - Request password reset email
     */
    forgotPassword: builder.mutation<void, ForgotPasswordRequest>({
      query: (data) => ({
        url: "/api/v1/auth/forgot-password",
        method: "POST",
        body: data,
      }),
    }),

    /**
     * Reset Password - Set new password using reset token
     */
    resetPassword: builder.mutation<void, ResetPasswordRequest>({
      query: (data) => ({
        url: "/api/v1/auth/reset-password",
        method: "POST",
        body: data,
      }),
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetMeQuery,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetUserPermissionsQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;

// ===========================
// Export Types
// ===========================

export type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  User,
  Permission,
  AuthResponse,
  PermissionsResponse,
  ProfileResponse,
  UpdateProfileRequest,
};
