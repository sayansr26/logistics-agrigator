import { baseApi } from "../baseApi";

/**
 * User Management API Endpoints
 *
 * All user management endpoints route through API Gateway (port 3001)
 * with automatic JWT token management.
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: string;
  clientId?: string;
  parentClientId?: string;
  parentUserId?: string;
  licenseId?: string;
  accessLevel?: "FULL" | "RESTRICTED";
  assignedCustomerIds?: string[];
  commissionRate?: number;
  commissionType?: "FLAT" | "PERCENTAGE";
  isActive?: boolean;
}

interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  clientId?: string;
  parentClientId?: string;
  parentUserId?: string;
  licenseId?: string;
  accessLevel?: "FULL" | "RESTRICTED";
  assignedCustomerIds?: string[];
  commissionRate?: number;
  commissionType?: "FLAT" | "PERCENTAGE";
  isActive?: boolean;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  clientId?: string;
  parentClientId?: string;
  parentUserId?: string;
  licenseId?: string;
  isLicenseActive?: boolean;
  licenseValidUntil?: string;
  accessLevel?: string;
  commissionRate?: number;
  commissionType?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserResponse {
  status: string;
  message: string;
  data: {
    user: User;
  };
}

interface UsersListResponse {
  status: string;
  message: string;
  data: {
    users: User[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface GetUsersParams {
  page?: number;
  limit?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface UserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  companyName?: string;
  designation?: string;
  department?: string;
  address?:
    | string
    | {
        street: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  preferences?: any;
  timezone?: string;
  language?: string;
  isActive: boolean;
  isVerified: boolean;
  profileComplete: boolean;
  clientId?: string;
  client?: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    subscriptionTier?: string;
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

interface UserProfileResponse {
  status: string;
  data: {
    profile: UserProfile | null;
    hasProfile: boolean;
  };
  meta: {
    timestamp: string;
    service: string;
    action: string;
  };
}

// ===========================
// RTK Query API Definition
// ===========================

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Create User - Create a new user (superadmin only)
     */
    createUser: builder.mutation<UserResponse, CreateUserRequest>({
      query: (userData) => ({
        url: "/api/v1/users",
        method: "POST",
        body: userData,
      }),
      invalidatesTags: ["User"],
    }),

    /**
     * Get Users - Fetch list of users with pagination and filters
     */
    getUsers: builder.query<UsersListResponse, GetUsersParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/users",
        params,
      }),
      providesTags: (result) =>
        result?.data?.users
          ? [
              ...result.data.users.map(({ id }) => ({
                type: "User" as const,
                id,
              })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    /**
     * Get User by ID - Fetch single user details
     */
    getUserById: builder.query<UserResponse, string>({
      query: (userId) => `/api/v1/users/${userId}`,
      providesTags: (result, error, id) => [{ type: "User", id }],
    }),

    /**
     * Update User - Update user information
     */
    updateUser: builder.mutation<
      UserResponse,
      { id: string; data: UpdateUserRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/users/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Delete User - Soft delete a user
     */
    deleteUser: builder.mutation<void, string>({
      query: (userId) => ({
        url: `/api/v1/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Activate User - Reactivate a disabled user
     */
    activateUser: builder.mutation<UserResponse, string>({
      query: (userId) => ({
        url: `/api/v1/users/${userId}/activate`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Deactivate User - Disable a user account
     */
    deactivateUser: builder.mutation<UserResponse, string>({
      query: (userId) => ({
        url: `/api/v1/users/${userId}/deactivate`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Get User Profile by UserId - Fetch user profile from user-service
     */
    getUserProfileByUserId: builder.query<UserProfileResponse, string>({
      query: (userId) => `/api/v1/user/profiles/user/${userId}`,
      providesTags: (result, error, userId) => [
        { type: "User", id: `profile-${userId}` },
      ],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useCreateUserMutation,
  useGetUsersQuery,
  useGetUserByIdQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useActivateUserMutation,
  useDeactivateUserMutation,
  useGetUserProfileByUserIdQuery,
} = userApi;

// ===========================
// Export Types
// ===========================

export type {
  CreateUserRequest,
  UpdateUserRequest,
  User,
  UserResponse,
  UsersListResponse,
  GetUsersParams,
  UserProfile,
  UserProfileResponse,
};
