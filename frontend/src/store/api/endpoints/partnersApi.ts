import { baseApi } from "../baseApi";

/**
 * Partner Management API Endpoints
 *
 * All partner endpoints route through API Gateway (port 3001)
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface Partner {
  id: string;
  name: string;
  code: string;
  apiEndpoint?: string;
  isActive: boolean;
  supportedServices: string[];
  minWeight?: number;
  maxWeight?: number;
  createdAt: string;
  updatedAt: string;
}

interface PartnersListResponse {
  status: string;
  message: string;
  data: {
    partners: Partner[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface PartnerResponse {
  status: string;
  message: string;
  data: {
    partner: Partner;
  };
}

interface GetPartnersParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ServiceabilityRequest {
  originPincode: string;
  destinationPincode: string;
  weight: number;
  paymentMode: "prepaid" | "cod";
  partnerId?: string;
}

interface ServiceabilityResponse {
  status: string;
  message: string;
  data: {
    serviceable: boolean;
    partners: Array<{
      partnerId: string;
      partnerName: string;
      serviceable: boolean;
      estimatedDays?: number;
      rate?: number;
    }>;
  };
}

interface RateCalculationRequest {
  originPincode: string;
  destinationPincode: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  paymentMode: "prepaid" | "cod";
  codAmount?: number;
  shipmentValue: number;
  partnerId?: string;
}

interface RateCalculationResponse {
  status: string;
  message: string;
  data: {
    rates: Array<{
      partnerId: string;
      partnerName: string;
      baseRate: number;
      codCharges?: number;
      fuelSurcharge?: number;
      gst?: number;
      totalRate: number;
      estimatedDays?: number;
      serviceable: boolean;
    }>;
  };
}

interface PartnerRateResponse {
  status: string;
  message: string;
  data: {
    rate: {
      partnerId: string;
      partnerName: string;
      baseRate: number;
      codCharges?: number;
      fuelSurcharge?: number;
      gst?: number;
      totalRate: number;
      estimatedDays?: number;
      serviceable: boolean;
    };
  };
}

interface CreatePartnerRequest {
  name: string;
  displayName: string;
  code: string;
  apiEndpoint?: string;
  apiKey?: string;
  supportsCOD?: boolean;
  supportsReverse?: boolean;
  isActive?: boolean;
  baseRate?: number;
  perKgRate?: number;
  minWeight?: number;
  maxWeight?: number;
}

interface UpdatePartnerRequest {
  name?: string;
  displayName?: string;
  code?: string;
  apiEndpoint?: string;
  apiKey?: string;
  supportsCOD?: boolean;
  supportsReverse?: boolean;
  isActive?: boolean;
  baseRate?: number;
  perKgRate?: number;
  minWeight?: number;
  maxWeight?: number;
}

interface DeletePartnerResponse {
  status: string;
  message: string;
}

// ===========================
// RTK Query API Definition
// ===========================

export const partnersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get Partners - Fetch list of courier partners
     */
    getPartners: builder.query<PartnersListResponse, GetPartnersParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/partners",
        params,
      }),
      providesTags: (result) =>
        result?.data?.partners
          ? [
              ...result.data.partners.map(({ id }) => ({
                type: "Partner" as const,
                id,
              })),
              { type: "Partner", id: "LIST" },
            ]
          : [{ type: "Partner", id: "LIST" }],
    }),

    /**
     * Get Partner by ID - Fetch single partner details
     */
    getPartnerById: builder.query<PartnerResponse, string>({
      query: (partnerId) => `/api/v1/partners/${partnerId}`,
      providesTags: (result, error, id) => [{ type: "Partner", id }],
    }),

    /**
     * Check Serviceability - Check if partners can service a route
     */
    checkServiceability: builder.mutation<
      ServiceabilityResponse,
      ServiceabilityRequest
    >({
      query: (serviceabilityData) => ({
        url: "/api/v1/partners/serviceability",
        method: "POST",
        body: serviceabilityData,
      }),
    }),

    /**
     * Calculate Rates - Get shipping rates from partners
     */
    calculateRates: builder.mutation<
      RateCalculationResponse,
      RateCalculationRequest
    >({
      query: (rateData) => ({
        url: "/api/v1/partners/calculate",
        method: "POST",
        body: rateData,
      }),
    }),

    /**
     * Get Partner Rate - Get rate for a specific partner
     */
    getPartnerRate: builder.query<
      PartnerRateResponse,
      { partnerId: string; rateData: RateCalculationRequest }
    >({
      query: ({ partnerId, rateData }) => ({
        url: `/api/v1/partners/${partnerId}/rates`,
        method: "POST",
        body: rateData,
      }),
    }),

    /**
     * Create Partner - Add a new courier partner
     */
    createPartner: builder.mutation<PartnerResponse, CreatePartnerRequest>({
      query: (partnerData) => ({
        url: "/api/v1/partners",
        method: "POST",
        body: partnerData,
      }),
      invalidatesTags: [{ type: "Partner", id: "LIST" }],
    }),

    /**
     * Update Partner - Update an existing partner
     */
    updatePartner: builder.mutation<
      PartnerResponse,
      { partnerId: string; partnerData: UpdatePartnerRequest }
    >({
      query: ({ partnerId, partnerData }) => ({
        url: `/api/v1/partners/${partnerId}`,
        method: "PUT",
        body: partnerData,
      }),
      invalidatesTags: (result, error, { partnerId }) => [
        { type: "Partner", id: partnerId },
        { type: "Partner", id: "LIST" },
      ],
    }),

    /**
     * Delete Partner - Remove a courier partner
     */
    deletePartner: builder.mutation<DeletePartnerResponse, string>({
      query: (partnerId) => ({
        url: `/api/v1/partners/${partnerId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Partner", id: "LIST" }],
    }),

    /**
     * Update Partner Status - Activate or deactivate a partner
     */
    updatePartnerStatus: builder.mutation<
      PartnerResponse,
      { partnerId: string; isActive: boolean }
    >({
      query: ({ partnerId, isActive }) => ({
        url: `/api/v1/partners/${partnerId}`,
        method: "PUT",
        body: { isActive },
      }),
      invalidatesTags: (result, error, { partnerId }) => [
        { type: "Partner", id: partnerId },
        { type: "Partner", id: "LIST" },
      ],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useGetPartnersQuery,
  useGetPartnerByIdQuery,
  useCheckServiceabilityMutation,
  useCalculateRatesMutation,
  useGetPartnerRateQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
  useUpdatePartnerStatusMutation,
} = partnersApi;

// ===========================
// Export Types
// ===========================

export type {
  Partner,
  PartnersListResponse,
  PartnerResponse,
  GetPartnersParams,
  ServiceabilityRequest,
  ServiceabilityResponse,
  RateCalculationRequest,
  RateCalculationResponse,
  PartnerRateResponse,
  CreatePartnerRequest,
  UpdatePartnerRequest,
  DeletePartnerResponse,
};
