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
  displayName?: string;
  apiEndpoint?: string;
  apiUrl?: string;
  apiToken?: string;
  apiVersion?: string;
  isActive: boolean;

  // Channel Mode
  channelMode?: string;

  // Service Configuration
  supportsCOD?: boolean;
  supportsReverse?: boolean;
  supportedServices?: string[];
  minWeight?: number;
  maxWeight?: number;
  maxDimensions?: {
    length: number;
    width: number;
    height: number;
  };

  // Pricing Configuration
  baseRate?: number;
  perKgRate?: number;
  codChargePercent?: number;
  fuelSurcharge?: number;

  // Delivery Configuration
  defaultDeliveryDays?: number;

  // Service Areas
  servicePincodes?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Relations count
  _count?: {
    shipments?: number;
    rates?: number;
    pincodeAssigns?: number;
    chargeRules?: number;
    channelConfigs?: number;
    chargesTypes?: number;
  };
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

// ===========================
// Serviceability Types (Zone v2)
// ===========================

interface ServiceabilityRequest {
  originPincode?: string;
  destinationPincode?: string;
  fromPincode?: string;
  toPincode?: string;
  weight?: number;
  paymentMode?: "prepaid" | "cod";
  partnerId?: string;
  serviceType?: string;
}

interface ServiceabilityPartner {
  partnerId: string;
  partnerName: string;
  isServiceable: boolean;
  serviceable: boolean;
  distanceKm?: number;
  zoneSuffix?: string;
  zoneId?: string;
  zoneName?: string;
  estimatedDays?: number;
  deliveryDays?: number | Record<string, string>;
  serviceTypes?: string[];
  cod?: boolean;
  prepaid?: boolean;
  error?: string;
}

interface ServiceabilitySummary {
  fromPincode: string;
  toPincode: string;
  serviceableCount: number;
  totalPartners: number;
}

interface ServiceabilityResponse {
  status: string;
  message: string;
  data: {
    serviceability: ServiceabilityPartner[];
    summary?: ServiceabilitySummary;
    // Legacy format support
    serviceable?: boolean;
    partners?: Array<{
      partnerId: string;
      partnerName: string;
      serviceable: boolean;
      estimatedDays?: number;
      rate?: number;
    }>;
  };
}

// ===========================
// Rate Calculation Types (Quote Engine v2)
// ===========================

interface RateCalculationRequest {
  originPincode?: string;
  destinationPincode?: string;
  fromPincode?: string;
  toPincode?: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  paymentMode?: "prepaid" | "cod";
  paymentType?: "PREPAID" | "COD";
  codAmount?: number;
  shipmentValue?: number;
  declaredValue?: number;
  partnerId?: string;
  serviceType?: string;
  sortBy?: "cheapest" | "fastest";
}

interface ChargeBreakdownItem {
  name: string;
  type: "WEIGHT" | "DISTANCE" | "GENERIC" | "PINCODE_TYPE";
  amount: number;
  description?: string;
  baseCharge?: number;
  addonCharge?: number;
  units?: number;
}

interface RatePartner {
  partnerId: string;
  partnerName: string;
  serviceable: boolean;
  isServiceable?: boolean;
  rate?: number;
  baseRate?: number;
  totalRate: number;
  totalAmount?: number;
  distanceKm?: number;
  zoneSuffix?: string;
  zoneName?: string;
  estimatedDays?: number;
  deliveryDays?: number;
  breakdown?: ChargeBreakdownItem[];
  // Legacy fields
  codCharges?: number;
  codCharge?: number;
  fuelSurcharge?: number;
  gst?: number;
  serviceType?: string;
}

interface RateSummary {
  partnerId: string;
  partnerName: string;
  totalRate: number;
  estimatedDays?: number;
}

interface QuoteSummary {
  fromPincode: string;
  toPincode: string;
  distanceKm: number;
  paymentType: string;
  weight: number;
  ratesCount: number;
}

interface RateCalculationResponse {
  status: string;
  message: string;
  data: {
    rates: RatePartner[];
    cheapestRate?: RateSummary;
    fastestRate?: RateSummary;
    summary?: QuoteSummary;
  };
}

interface PartnerRateResponse {
  status: string;
  message: string;
  data: {
    rate: RatePartner;
  };
}

// ===========================
// Partner CRUD Types
// ===========================

interface CreatePartnerRequest {
  name: string;
  displayName: string;
  code: string;
  apiEndpoint?: string;
  apiUrl?: string;
  apiKey?: string;
  supportsCOD?: boolean;
  supportsReverse?: boolean;
  isActive?: boolean;
  baseRate?: number;
  perKgRate?: number;
  minWeight?: number;
  maxWeight?: number;
  defaultDeliveryDays?: number;
}

interface UpdatePartnerRequest {
  name?: string;
  displayName?: string;
  code?: string;
  apiEndpoint?: string;
  apiUrl?: string;
  apiKey?: string;
  supportsCOD?: boolean;
  supportsReverse?: boolean;
  isActive?: boolean;
  baseRate?: number;
  perKgRate?: number;
  minWeight?: number;
  maxWeight?: number;
  defaultDeliveryDays?: number;
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
     * Uses Zone System v2 with distance zones
     */
    checkServiceability: builder.mutation<
      ServiceabilityResponse,
      ServiceabilityRequest
    >({
      query: (serviceabilityData) => {
        // Normalize field names for backend compatibility
        const payload = {
          fromPincode:
            serviceabilityData.fromPincode || serviceabilityData.originPincode,
          toPincode:
            serviceabilityData.toPincode ||
            serviceabilityData.destinationPincode,
          partnerId: serviceabilityData.partnerId,
          serviceType: serviceabilityData.serviceType,
        };
        return {
          url: "/api/v1/partners/serviceability",
          method: "POST",
          body: payload,
        };
      },
    }),

    /**
     * Calculate Rates - Get shipping rates from partners
     * Uses Quote Engine v2 with charge packages
     */
    calculateRates: builder.mutation<
      RateCalculationResponse,
      RateCalculationRequest
    >({
      query: (rateData) => {
        // Normalize field names for backend compatibility
        const payload = {
          fromPincode: rateData.fromPincode || rateData.originPincode,
          toPincode: rateData.toPincode || rateData.destinationPincode,
          weight: rateData.weight,
          dimensions: rateData.dimensions,
          paymentMode: rateData.paymentMode,
          paymentType: rateData.paymentType,
          codAmount: rateData.codAmount,
          shipmentValue: rateData.shipmentValue || rateData.declaredValue,
          partnerId: rateData.partnerId,
          serviceType: rateData.serviceType,
          sortBy: rateData.sortBy,
        };
        return {
          url: "/api/v1/partners/calculate",
          method: "POST",
          body: payload,
        };
      },
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
  ServiceabilityPartner,
  ServiceabilitySummary,
  RateCalculationRequest,
  RateCalculationResponse,
  RatePartner,
  RateSummary,
  QuoteSummary,
  ChargeBreakdownItem,
  PartnerRateResponse,
  CreatePartnerRequest,
  UpdatePartnerRequest,
  DeletePartnerResponse,
};
