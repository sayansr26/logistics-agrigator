import { baseApi } from "../baseApi";

/**
 * Outlet Management API Endpoints
 *
 * All outlet management endpoints route through API Gateway (port 3001)
 * with automatic JWT token management.
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface CreateOutletRequest {
  name: string;
  email: string;
  phone: string;
  companyName?: string;
  category?: string;
  tanPan?: string;
  gst?: string;
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  addresses?: CreateAddressRequest[];
}

interface UpdateOutletRequest {
  name?: string;
  phone?: string;
  companyName?: string;
  category?: string;
  tanPan?: string;
  gst?: string;
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  isActive?: boolean;
}

interface CreateAddressRequest {
  label: string;
  addressType?: "GENERAL" | "PICKUP" | "RETURN" | "HOME" | "WORK" | "OTHER";
  name: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefaultPickup?: boolean;
  isDefaultReturn?: boolean;
  isDefault?: boolean;
}

interface UpdateAddressRequest {
  label?: string;
  addressType?: "GENERAL" | "PICKUP" | "RETURN" | "HOME" | "WORK" | "OTHER";
  name?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  isDefaultPickup?: boolean;
  isDefaultReturn?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
}

interface Outlet {
  id: string;
  userId: string;
  clientId: string;
  createdByUserId: string;
  name: string;
  email: string;
  phone: string;
  companyName?: string;
  category?: string;
  tanPan?: string;
  gst?: string;
  companyAddress?: object;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    addresses: number;
  };
}

interface OutletAddress {
  id: string;
  outletId: string;
  label: string;
  addressType: string;
  name: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefaultPickup: boolean;
  isDefaultReturn: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OutletResponse {
  status: string;
  data: {
    outlet: Outlet;
    temporaryPassword?: string;
    message?: string;
  };
}

interface OutletsListResponse {
  status: string;
  data: {
    outlets: Outlet[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
}

interface AddressesResponse {
  status: string;
  data: {
    addresses: OutletAddress[];
  };
}

interface AddressResponse {
  status: string;
  data: {
    address: OutletAddress;
    message?: string;
  };
}

interface GetOutletsParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ===========================
// API Endpoints
// ===========================

export const outletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== OUTLET MANAGEMENT ====================

    /**
     * Create a new outlet (Client/Admin only)
     * POST /api/v1/outlets
     */
    createOutlet: builder.mutation<OutletResponse, CreateOutletRequest>({
      query: (data) => ({
        url: "/api/v1/outlets",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["User"],
    }),

    /**
     * List outlets for a client (Client/Admin only)
     * GET /api/v1/outlets
     */
    listOutlets: builder.query<OutletsListResponse, GetOutletsParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.append("page", params.page.toString());
        if (params?.limit) searchParams.append("limit", params.limit.toString());
        if (params?.search) searchParams.append("search", params.search);
        if (params?.isActive !== undefined)
          searchParams.append("isActive", params.isActive.toString());
        if (params?.sortBy) searchParams.append("sortBy", params.sortBy);
        if (params?.sortOrder) searchParams.append("sortOrder", params.sortOrder);

        return {
          url: `/api/v1/outlets?${searchParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.outlets.map(({ id }) => ({
                type: "User" as const,
                id,
              })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    /**
     * Get own outlet info (Outlet role only)
     * GET /api/v1/outlets/me
     */
    getMyOutlet: builder.query<OutletResponse, void>({
      query: () => ({
        url: "/api/v1/outlets/me",
        method: "GET",
      }),
      providesTags: [{ type: "User", id: "ME" }],
    }),

    /**
     * Get outlet by ID
     * GET /api/v1/outlets/:id
     */
    getOutlet: builder.query<OutletResponse, string>({
      query: (id) => ({
        url: `/api/v1/outlets/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "User", id }],
    }),

    /**
     * Update outlet
     * PUT /api/v1/outlets/:id
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
        { type: "User", id },
        { type: "User", id: "ME" },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Delete outlet (soft delete)
     * DELETE /api/v1/outlets/:id
     */
    deleteOutlet: builder.mutation<
      { status: string; data: { message: string } },
      string
    >({
      query: (id) => ({
        url: `/api/v1/outlets/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Toggle outlet status (activate/deactivate)
     * PATCH /api/v1/outlets/:id/status
     */
    toggleOutletStatus: builder.mutation<
      OutletResponse,
      { id: string; isActive: boolean }
    >({
      query: ({ id, isActive }) => ({
        url: `/api/v1/outlets/${id}/status`,
        method: "PATCH",
        body: { isActive },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Reset outlet password
     * POST /api/v1/outlets/:id/reset-password
     */
    resetOutletPassword: builder.mutation<
      { status: string; data: { temporaryPassword: string; message: string } },
      string
    >({
      query: (id) => ({
        url: `/api/v1/outlets/${id}/reset-password`,
        method: "POST",
      }),
    }),

    // ==================== ADDRESS MANAGEMENT ====================

    /**
     * Get own addresses (Outlet role only)
     * GET /api/v1/outlets/me/addresses
     */
    getMyAddresses: builder.query<AddressesResponse, void>({
      query: () => ({
        url: "/api/v1/outlets/me/addresses",
        method: "GET",
      }),
      providesTags: [{ type: "User", id: "MY_ADDRESSES" }],
    }),

    /**
     * Get addresses for a specific outlet (Client/Admin only)
     * GET /api/v1/outlets/:outletId/addresses
     */
    getOutletAddresses: builder.query<AddressesResponse, string>({
      query: (outletId) => ({
        url: `/api/v1/outlets/${outletId}/addresses`,
        method: "GET",
      }),
      providesTags: (result, error, outletId) => [
        { type: "User", id: `OUTLET_${outletId}_ADDRESSES` },
      ],
    }),

    /**
     * Create address for own outlet (Outlet role only)
     * POST /api/v1/outlets/me/addresses
     */
    createMyAddress: builder.mutation<AddressResponse, CreateAddressRequest>({
      query: (data) => ({
        url: "/api/v1/outlets/me/addresses",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [{ type: "User", id: "MY_ADDRESSES" }],
    }),

    /**
     * Create address for a specific outlet (Client/Admin or Outlet itself)
     * POST /api/v1/outlets/:outletId/addresses
     */
    createOutletAddress: builder.mutation<
      AddressResponse,
      { outletId: string; data: CreateAddressRequest }
    >({
      query: ({ outletId, data }) => ({
        url: `/api/v1/outlets/${outletId}/addresses`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { outletId }) => [
        { type: "User", id: `OUTLET_${outletId}_ADDRESSES` },
        { type: "User", id: "MY_ADDRESSES" },
      ],
    }),

    /**
     * Update own address (Outlet role only)
     * PUT /api/v1/outlets/me/addresses/:addressId
     */
    updateMyAddress: builder.mutation<
      AddressResponse,
      { addressId: string; data: UpdateAddressRequest }
    >({
      query: ({ addressId, data }) => ({
        url: `/api/v1/outlets/me/addresses/${addressId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: [{ type: "User", id: "MY_ADDRESSES" }],
    }),

    /**
     * Update address for a specific outlet (Client/Admin or Outlet itself)
     * PUT /api/v1/outlets/:outletId/addresses/:addressId
     */
    updateOutletAddress: builder.mutation<
      AddressResponse,
      { outletId: string; addressId: string; data: UpdateAddressRequest }
    >({
      query: ({ outletId, addressId, data }) => ({
        url: `/api/v1/outlets/${outletId}/addresses/${addressId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { outletId }) => [
        { type: "User", id: `OUTLET_${outletId}_ADDRESSES` },
        { type: "User", id: "MY_ADDRESSES" },
      ],
    }),

    /**
     * Delete own address (Outlet role only)
     * DELETE /api/v1/outlets/me/addresses/:addressId
     */
    deleteMyAddress: builder.mutation<
      { status: string; data: { message: string } },
      string
    >({
      query: (addressId) => ({
        url: `/api/v1/outlets/me/addresses/${addressId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "User", id: "MY_ADDRESSES" }],
    }),

    /**
     * Delete address for a specific outlet (Client/Admin or Outlet itself)
     * DELETE /api/v1/outlets/:outletId/addresses/:addressId
     */
    deleteOutletAddress: builder.mutation<
      { status: string; data: { message: string } },
      { outletId: string; addressId: string }
    >({
      query: ({ outletId, addressId }) => ({
        url: `/api/v1/outlets/${outletId}/addresses/${addressId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { outletId }) => [
        { type: "User", id: `OUTLET_${outletId}_ADDRESSES` },
        { type: "User", id: "MY_ADDRESSES" },
      ],
    }),
  }),
  overrideExisting: false,
});

// Export hooks for usage in functional components
export const {
  // Outlet management
  useCreateOutletMutation,
  useListOutletsQuery,
  useLazyListOutletsQuery,
  useGetMyOutletQuery,
  useLazyGetMyOutletQuery,
  useGetOutletQuery,
  useLazyGetOutletQuery,
  useUpdateOutletMutation,
  useDeleteOutletMutation,
  useToggleOutletStatusMutation,
  useResetOutletPasswordMutation,

  // Address management
  useGetMyAddressesQuery,
  useLazyGetMyAddressesQuery,
  useGetOutletAddressesQuery,
  useLazyGetOutletAddressesQuery,
  useCreateMyAddressMutation,
  useCreateOutletAddressMutation,
  useUpdateMyAddressMutation,
  useUpdateOutletAddressMutation,
  useDeleteMyAddressMutation,
  useDeleteOutletAddressMutation,
} = outletApi;

// Export type definitions
export type {
  CreateOutletRequest,
  UpdateOutletRequest,
  CreateAddressRequest,
  UpdateAddressRequest,
  Outlet,
  OutletAddress,
  OutletResponse,
  OutletsListResponse,
  AddressesResponse,
  AddressResponse,
  GetOutletsParams,
};

