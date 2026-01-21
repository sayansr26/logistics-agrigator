import { baseApi } from "../baseApi";

// Types for Pincode Type Service Charges
export interface PincodeTypeForCharge {
  id: string;
  name: string;
  description?: string;
}

export interface PartnerForCharge {
  id: string;
  name: string;
  code: string;
  displayName: string;
}

export interface PincodeTypeServiceCharge {
  id: string;
  pincodeType: PincodeTypeForCharge;
  partner: PartnerForCharge;
  baseCharge: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetChargesParams {
  page?: number;
  limit?: number;
  pincodeTypeId?: string;
  partnerId?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

// Create charge input - supports bulk creation
export interface CreateChargeInput {
  pincodeTypeIds: string[];
  partnerIds: string[];
  baseCharge: number;
  isActive?: boolean;
}

// Create charge response
export interface CreateChargeResult {
  createdCount: number;
  totalCombinations: number;
  skippedExisting: number;
  charges: Array<{
    pincodeTypeId: string;
    partnerId: string;
    baseCharge: string;
  }>;
  summary: {
    validPincodeTypes: number;
    validPartners: number;
    missingPincodeTypes: string[];
    missingPartners: string[];
  };
}

export interface UpdateChargeInput {
  baseCharge?: number;
  isActive?: boolean;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API endpoints for Pincode Type Service Charges
// Through API gateway: /api/v1/pincode-type-service-charges routes to partner-service

export const pincodeTypeServiceChargeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get service charges list
    getCharges: builder.query<
      {
        data: PincodeTypeServiceCharge[];
        meta?: { pagination?: PaginationMeta };
      },
      GetChargesParams | void
    >({
      query: (params) => ({
        url: "/api/v1/pincode-type-service-charges",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: any) => {
        // Backend returns: { status, data: { charges: [...], pagination: {...} } }
        return {
          data: response.data?.charges || [],
          meta: { pagination: response.data?.pagination },
        };
      },
      providesTags: ["PincodeTypeServiceCharge"],
    }),

    // Get charge by ID
    getChargeById: builder.query<{ data: PincodeTypeServiceCharge }, string>({
      query: (id) => ({
        url: `/api/v1/pincode-type-service-charges/${id}`,
        method: "GET",
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      providesTags: (result, error, id) => [
        { type: "PincodeTypeServiceCharge", id },
      ],
    }),

    // Get charges by pincode type
    getChargesByPincodeType: builder.query<
      {
        data: {
          pincodeType: PincodeTypeForCharge;
          charges: Omit<PincodeTypeServiceCharge, "pincodeType">[];
        };
      },
      { pincodeTypeId: string; isActive?: boolean }
    >({
      query: ({ pincodeTypeId, ...params }) => ({
        url: `/api/v1/pincode-type-service-charges/type/${pincodeTypeId}`,
        method: "GET",
        params,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      providesTags: (result, error, { pincodeTypeId }) => [
        { type: "PincodeTypeServiceCharge", id: `type-${pincodeTypeId}` },
      ],
    }),

    // Get charges by partner
    getChargesByPartner: builder.query<
      {
        data: {
          partner: PartnerForCharge;
          charges: Omit<PincodeTypeServiceCharge, "partner">[];
        };
      },
      { partnerId: string; isActive?: boolean }
    >({
      query: ({ partnerId, ...params }) => ({
        url: `/api/v1/pincode-type-service-charges/partner/${partnerId}`,
        method: "GET",
        params,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      providesTags: (result, error, { partnerId }) => [
        { type: "PincodeTypeServiceCharge", id: `partner-${partnerId}` },
      ],
    }),

    // Create charge(s) - supports bulk creation
    createCharge: builder.mutation<
      { data: CreateChargeResult },
      CreateChargeInput
    >({
      query: (data) => ({
        url: "/api/v1/pincode-type-service-charges",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: ["PincodeTypeServiceCharge"],
    }),

    // Update charge
    updateCharge: builder.mutation<
      { data: PincodeTypeServiceCharge },
      { id: string; data: UpdateChargeInput }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/pincode-type-service-charges/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "PincodeTypeServiceCharge",
        { type: "PincodeTypeServiceCharge", id },
      ],
    }),

    // Delete (soft delete) charge
    deleteCharge: builder.mutation<{ data: { success: boolean } }, string>({
      query: (id) => ({
        url: `/api/v1/pincode-type-service-charges/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PincodeTypeServiceCharge"],
    }),
  }),
  overrideExisting: false,
});

// Export hooks
export const {
  useGetChargesQuery,
  useGetChargeByIdQuery,
  useGetChargesByPincodeTypeQuery,
  useGetChargesByPartnerQuery,
  useCreateChargeMutation,
  useUpdateChargeMutation,
  useDeleteChargeMutation,
} = pincodeTypeServiceChargeApi;
