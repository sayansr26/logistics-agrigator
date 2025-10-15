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
  name: string;
  phone?: string;
  role?: string;
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

interface AuthResponse {
  status: string;
  message: string;
  data: {
    token: string;
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
      transformResponse: (response: AuthResponse) => {
        // Store tokens in localStorage for persistence
        if (response.data?.token) {
          localStorage.setItem("token", response.data.token);
        }
        if (response.data?.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        return response;
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
      transformResponse: (response: AuthResponse) => {
        // Auto-login after registration
        if (response.data?.token) {
          localStorage.setItem("token", response.data.token);
        }
        if (response.data?.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        return response;
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
      transformResponse: (response: AuthResponse) => {
        // Update stored access token
        if (response.data?.token) {
          localStorage.setItem("token", response.data.token);
        }
        return response;
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
