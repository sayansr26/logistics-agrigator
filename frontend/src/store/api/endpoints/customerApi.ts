import { baseApi } from "../baseApi";

/**
 * Customer Management API Endpoints
 *
 * All customer endpoints route through API Gateway (port 3001)
 * to user-service for managing DIRECT and OUTLET customers.
 */

// ===========================
// Request/Response Interfaces
// ===========================

export type CustomerType = "DIRECT" | "OUTLET";
export type OutletStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
export type OutletType =
  | "RETAIL"
  | "WHOLESALE"
  | "FRANCHISE"
  | "DISTRIBUTOR"
  | "OTHER";

export interface Customer {
  id: string;
  clientId?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  businessType?: string;
  isActive: boolean;
  customerType: CustomerType;
  // Outlet-specific fields
  outletCode?: string;
  outletName?: string;
  retailerName?: string;
  contactPerson?: string;
  outletStatus?: OutletStatus;
  outletType?: OutletType;
  businessHours?: {
    open?: string;
    close?: string;
    days?: string[];
  };
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
  };
  assignedCouriers?: string[];
  serviceAreas?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  businessType?: string;
  customerType: CustomerType;
  clientId?: string;
  // Outlet-specific fields (required when customerType is OUTLET)
  outletCode?: string;
  outletName?: string;
  retailerName?: string;
  contactPerson?: string;
  outletStatus?: OutletStatus;
  outletType?: OutletType;
  businessHours?: {
    open?: string;
    close?: string;
    days?: string[];
  };
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
  };
  assignedCouriers?: string[];
  serviceAreas?: string[];
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  businessType?: string;
  isActive?: boolean;
  // Outlet-specific fields
  outletCode?: string;
  outletName?: string;
  retailerName?: string;
  contactPerson?: string;
  outletStatus?: OutletStatus;
  outletType?: OutletType;
  businessHours?: {
    open?: string;
    close?: string;
    days?: string[];
  };
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
  };
  assignedCouriers?: string[];
  serviceAreas?: string[];
}

interface CustomerResponse {
  status: string;
  message: string;
  data: {
    customer: Customer;
  };
  meta: {
    timestamp: string;
    service: string;
  };
}

interface CustomersListResponse {
  status: string;
  message: string;
  data: {
    customers: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  meta: {
    timestamp: string;
    service: string;
  };
}

interface GetCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  customerType?: CustomerType;
  isActive?: boolean;
  clientId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ===========================
// RTK Query API Definition
// ===========================

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Create Customer - Create a new customer (admin only)
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
     * Update Customer - Update customer information
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
    // Outlet-Specific Endpoints
    // ===========================

    /**
     * Get Outlets - Fetch list of OUTLET customers only
     */
    getOutlets: builder.query<CustomersListResponse, GetCustomersParams | void>(
      {
        query: (params = {}) => ({
          url: "/api/v1/outlets",
          params,
        }),
        providesTags: (result) =>
          result?.data?.customers
            ? [
                ...result.data.customers.map(({ id }) => ({
                  type: "Customer" as const,
                  id,
                })),
                { type: "Customer", id: "OUTLET_LIST" },
              ]
            : [{ type: "Customer", id: "OUTLET_LIST" }],
      },
    ),

    /**
     * Get Outlet by ID - Fetch single outlet details
     */
    getOutletById: builder.query<CustomerResponse, string>({
      query: (outletId) => `/api/v1/outlets/${outletId}`,
      providesTags: (result, error, id) => [{ type: "Customer", id }],
    }),

    /**
     * Create Outlet - Create a new outlet (admin only)
     */
    createOutlet: builder.mutation<CustomerResponse, CreateCustomerRequest>({
      query: (outletData) => ({
        url: "/api/v1/outlets",
        method: "POST",
        body: { ...outletData, customerType: "OUTLET" },
      }),
      invalidatesTags: ["Customer"],
    }),

    /**
     * Update Outlet - Update outlet information
     */
    updateOutlet: builder.mutation<
      CustomerResponse,
      { id: string; data: UpdateCustomerRequest }
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
} = customerApi;

// ===========================
// Export Types
// ===========================

export type { CustomerResponse, CustomersListResponse, GetCustomersParams };
