import { baseApi } from "../baseApi";

/**
 * Customer Management API Endpoints
 *
 * All customer endpoints route through API Gateway (port 3001)
 * to user-service for managing B2C and B2B customers.
 * 
 * CustomerType:
 * - B2C: Direct customers (no outlet association)
 * - B2B: Customers linked to an outlet (requires outletId)
 */

// ===========================
// Request/Response Interfaces
// ===========================

export type CustomerType = "B2C" | "B2B";
export type OutletStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
export type OutletType =
  | "RETAIL"
  | "WHOLESALE"
  | "FRANCHISE"
  | "DISTRIBUTOR"
  | "DIRECT"
  | "WAREHOUSE"
  | "OTHER";

export interface Customer {
  id: string;
  clientId?: string;
  name: string;
  email: string;
  phone?: string;
  // Address fields
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  // Customer type and outlet association
  customerType: CustomerType;
  outletId?: string;
  // Linked outlet (for B2B customers)
  outlet?: {
    id: string;
    name: string;
    code?: string;
  };
  // Status and feature access
  isActive: boolean;
  monthlyShipmentLimit?: number;
  enabledModules?: string[];
  // Linked users
  customerUsers?: Array<{
    id: string;
    userId: string;
    role: string;
    isActive: boolean;
  }>;
  userProfiles?: Array<{
    id: string;
    userId: string;
    firstName?: string;
    lastName?: string;
  }>;
  _count?: {
    userProfiles: number;
    customerUsers: number;
  };
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  // Required fields
  name: string;
  email: string;
  password: string; // Required for creating login account
  // Customer type
  customerType: CustomerType;
  outletId?: string; // Required when customerType is B2B
  // Optional contact
  phone?: string;
  // Address fields
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  // Optional associations
  clientId?: string;
  // Feature access
  monthlyShipmentLimit?: number;
  enabledModules?: string[];
  isActive?: boolean;
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phone?: string;
  // Customer type change
  customerType?: CustomerType;
  outletId?: string | null;
  // Address fields
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  // Password reset (optional - leave blank to keep existing)
  password?: string;
  // Status and feature access
  isActive?: boolean;
  clientId?: string;
  monthlyShipmentLimit?: number;
  enabledModules?: string[];
}

interface CustomerResponse {
  status: string;
  message?: string;
  data: {
    customer: Customer;
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

interface CustomersListResponse {
  status: string;
  message?: string;
  data: {
    customers: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore?: boolean;
      hasPrevious?: boolean;
    };
    filters?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

interface GetCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  customerType?: CustomerType;
  outletId?: string;
  isActive?: boolean;
  clientId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ===========================
// Outlet-specific interfaces
// ===========================

// Outlet entity (different from Customer)
export interface Outlet {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  type: OutletType;
  status: OutletStatus;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OutletsApiResponse {
  status: string;
  data: {
    outlets: Outlet[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore?: boolean;
      hasPrevious?: boolean;
    };
    filters?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

interface OutletsListResponse {
  status: string;
  data: {
    customers: Outlet[];  // Alias for consistency
    outlets: Outlet[];    // Original from backend
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore?: boolean;
      hasPrevious?: boolean;
    };
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

interface OutletApiResponse {
  status: string;
  data: {
    outlet: Outlet | null;
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

interface OutletResponse {
  status: string;
  data: {
    outlet: Outlet | null;
    customer: Outlet | null; // Alias for consistency
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

export interface CreateOutletRequest {
  name: string;
  email: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  type?: OutletType;
  status?: OutletStatus;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };
  isActive?: boolean;
  // Admin credentials for outlet admin user
  adminCredentials: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

export interface UpdateOutletRequest {
  name?: string;
  email?: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  type?: OutletType;
  status?: OutletStatus;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };
  isActive?: boolean;
}

export interface OutletUser {
  id: string;
  userId: string;
  outletId: string;
  role: string;
  enabledModules: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  email?: string; // From auth-service enrichment
  profile?: {
    id: string;
    userId: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    email?: string;
  };
}

interface OutletUsersResponse {
  status: string;
  data: {
    users: OutletUser[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

// ===========================
// RTK Query API Definition
// ===========================

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Create Customer - Create a new customer with login account
     */
    createCustomer: builder.mutation<CustomerResponse, CreateCustomerRequest>({
      query: (customerData) => ({
        url: "/api/v1/customers",
        method: "POST",
        body: customerData,
      }),
      invalidatesTags: ["Customer"],
    }),

    /**
     * Get Customers - Fetch list of customers with pagination and filters
     */
    getCustomers: builder.query<
      CustomersListResponse,
      GetCustomersParams | void
    >({
      query: (params = {}) => ({
        url: "/api/v1/customers",
        params,
      }),
      providesTags: (result) =>
        result?.data?.customers
          ? [
              ...result.data.customers.map(({ id }) => ({
                type: "Customer" as const,
                id,
              })),
              { type: "Customer", id: "LIST" },
            ]
          : [{ type: "Customer", id: "LIST" }],
    }),

    /**
     * Get Customer by ID - Fetch single customer details
     */
    getCustomerById: builder.query<CustomerResponse, string>({
      query: (customerId) => `/api/v1/customers/${customerId}`,
      providesTags: (result, error, id) => [{ type: "Customer", id }],
    }),

    /**
     * Update Customer - Update customer information (with optional password reset)
     */
    updateCustomer: builder.mutation<
      CustomerResponse,
      { id: string; data: UpdateCustomerRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/customers/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),

    /**
     * Delete Customer - Soft delete a customer
     */
    deleteCustomer: builder.mutation<void, string>({
      query: (customerId) => ({
        url: `/api/v1/customers/${customerId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
      ],
    }),

    // ===========================
    // Outlet Entity Endpoints
    // ===========================

    /**
     * Get Outlets - Fetch list of outlets
     */
    getOutlets: builder.query<OutletsListResponse, GetCustomersParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/outlets",
        params,
      }),
      transformResponse: (response: OutletsApiResponse): OutletsListResponse => {
        return {
          ...response,
          data: {
            customers: response.data?.outlets || [],
            outlets: response.data?.outlets || [],
            pagination: response.data?.pagination || {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
          },
        };
      },
      providesTags: (result) =>
        result?.data?.outlets
          ? [
              ...result.data.outlets.map(({ id }) => ({
                type: "Customer" as const,
                id,
              })),
              { type: "Customer", id: "OUTLET_LIST" },
            ]
          : [{ type: "Customer", id: "OUTLET_LIST" }],
    }),

    /**
     * Get Outlet by ID - Fetch single outlet details
     */
    getOutletById: builder.query<OutletResponse, string>({
      query: (outletId) => `/api/v1/outlets/${outletId}`,
      transformResponse: (response: OutletApiResponse): OutletResponse => {
        return {
          ...response,
          data: {
            outlet: response.data?.outlet || null,
            customer: response.data?.outlet || null,
          },
        };
      },
      providesTags: (result, error, id) => [{ type: "Customer", id }],
    }),

    /**
     * Create Outlet - Create a new outlet with admin user
     */
    createOutlet: builder.mutation<OutletResponse, CreateOutletRequest>({
      query: (outletData) => ({
        url: "/api/v1/outlets",
        method: "POST",
        body: outletData,
      }),
      invalidatesTags: ["Customer"],
    }),

    /**
     * Update Outlet - Update outlet information
     */
    updateOutlet: builder.mutation<
      OutletResponse,
      { id: string; data: UpdateOutletRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/outlets/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
        { type: "Customer", id: "OUTLET_LIST" },
      ],
    }),

    /**
     * Delete Outlet - Soft delete an outlet
     */
    deleteOutlet: builder.mutation<void, string>({
      query: (outletId) => ({
        url: `/api/v1/outlets/${outletId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Customer", id },
        { type: "Customer", id: "LIST" },
        { type: "Customer", id: "OUTLET_LIST" },
      ],
    }),

    /**
     * Get Outlet Users - Fetch list of users for an outlet
     */
    getOutletUsers: builder.query<OutletUsersResponse, { outletId: string; page?: number; limit?: number }>({
      query: ({ outletId, page = 1, limit = 20 }) => ({
        url: `/api/v1/outlets/${outletId}/users`,
        params: { page, limit },
      }),
      providesTags: (result, error, { outletId }) => [
        { type: "Customer", id: `${outletId}_USERS` },
      ],
    }),

    /**
     * Create Outlet User - Add a new user to an outlet
     */
    createOutletUser: builder.mutation<
      { status: string; data: { user: OutletUser; message: string } },
      { outletId: string; data: { firstName: string; lastName?: string; email: string; password: string; phoneNumber?: string; role: string } }
    >({
      query: ({ outletId, data }) => ({
        url: `/api/v1/outlets/${outletId}/users`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { outletId }) => [
        { type: "Customer", id: `${outletId}_USERS` },
      ],
    }),

    /**
     * Update Outlet User - Update an existing outlet user
     */
    updateOutletUser: builder.mutation<
      { status: string; data: { user: OutletUser; message: string } },
      { outletId: string; userId: string; data: { firstName?: string; lastName?: string; phoneNumber?: string; role?: string; isActive?: boolean } }
    >({
      query: ({ outletId, userId, data }) => ({
        url: `/api/v1/outlets/${outletId}/users/${userId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { outletId }) => [
        { type: "Customer", id: `${outletId}_USERS` },
      ],
    }),

    /**
     * Remove Outlet User - Remove/deactivate a user from an outlet
     */
    removeOutletUser: builder.mutation<
      { status: string; message: string },
      { outletId: string; userId: string }
    >({
      query: ({ outletId, userId }) => ({
        url: `/api/v1/outlets/${outletId}/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { outletId }) => [
        { type: "Customer", id: `${outletId}_USERS` },
      ],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useCreateCustomerMutation,
  useGetCustomersQuery,
  useGetCustomerByIdQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useGetOutletsQuery,
  useGetOutletByIdQuery,
  useCreateOutletMutation,
  useUpdateOutletMutation,
  useDeleteOutletMutation,
  useGetOutletUsersQuery,
  useCreateOutletUserMutation,
  useUpdateOutletUserMutation,
  useRemoveOutletUserMutation,
} = customerApi;

// ===========================
// Export Types
// ===========================

export type {
  CustomerResponse,
  CustomersListResponse,
  GetCustomersParams,
  OutletsListResponse,
  OutletResponse,
};
