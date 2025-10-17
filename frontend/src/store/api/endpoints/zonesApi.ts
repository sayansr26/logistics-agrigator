import { baseApi } from "../baseApi";

/**
 * Zone Management API Endpoints
 *
 * All zone endpoints route through API Gateway (port 3001)
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface Zone {
  id: string;
  name: string;
  type: "city" | "state" | "region" | "pincode";
  parentZoneId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateZoneRequest {
  name: string;
  type: "city" | "state" | "region" | "pincode";
  parentZoneId?: string;
  isActive?: boolean;
}

interface UpdateZoneRequest {
  name?: string;
  type?: "city" | "state" | "region" | "pincode";
  parentZoneId?: string;
  isActive?: boolean;
}

interface ZoneResponse {
  status: string;
  message: string;
  data: {
    zone: Zone;
  };
}

interface ZonesListResponse {
  status: string;
  message: string;
  data: {
    zones: Zone[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface GetZonesParams {
  page?: number;
  limit?: number;
  type?: "city" | "state" | "region" | "pincode";
  parentZoneId?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ServiceType {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

interface ServiceTypesResponse {
  status: string;
  message: string;
  data: {
    serviceTypes: ServiceType[];
  };
}

interface PartnerZone {
  id: string;
  partnerId: string;
  zoneId: string;
  serviceTypeId: string;
  rate: number;
  estimatedDays?: number;
  isActive: boolean;
}

interface PartnerZonesResponse {
  status: string;
  message: string;
  data: {
    partnerZones: PartnerZone[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface ValidateCoverageRequest {
  originPincode: string;
  destinationPincode: string;
  partnerId?: string;
}

interface ValidateCoverageResponse {
  status: string;
  message: string;
  data: {
    covered: boolean;
    originZone?: Zone;
    destinationZone?: Zone;
    availablePartners?: string[];
  };
}

// ===========================
// RTK Query API Definition
// ===========================

export const zonesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Create Zone - Create a new zone
     */
    createZone: builder.mutation<ZoneResponse, CreateZoneRequest>({
      query: (zoneData) => ({
        url: "/api/v1/zones",
        method: "POST",
        body: zoneData,
      }),
      invalidatesTags: [{ type: "Zone", id: "LIST" }],
    }),

    /**
     * Get Zones - Fetch list of zones with pagination and filters
     */
    getZones: builder.query<ZonesListResponse, GetZonesParams | void>({
      query: (params = {}) => ({
        url: "/api/v1/zones",
        params,
      }),
      providesTags: (result) =>
        result?.data?.zones
          ? [
              ...result.data.zones.map(({ id }) => ({
                type: "Zone" as const,
                id,
              })),
              { type: "Zone", id: "LIST" },
            ]
          : [{ type: "Zone", id: "LIST" }],
    }),

    /**
     * Get Zone by ID - Fetch single zone details
     */
    getZoneById: builder.query<ZoneResponse, string>({
      query: (zoneId) => `/api/v1/zones/${zoneId}`,
      providesTags: (result, error, id) => [{ type: "Zone", id }],
    }),

    /**
     * Update Zone - Update zone information
     */
    updateZone: builder.mutation<
      ZoneResponse,
      { id: string; data: UpdateZoneRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/zones/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Zone", id },
        { type: "Zone", id: "LIST" },
      ],
    }),

    /**
     * Delete Zone - Delete a zone
     */
    deleteZone: builder.mutation<void, string>({
      query: (zoneId) => ({
        url: `/api/v1/zones/${zoneId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Zone", id },
        { type: "Zone", id: "LIST" },
      ],
    }),

    /**
     * Get Service Types - Fetch available service types
     */
    getServiceTypes: builder.query<ServiceTypesResponse, void>({
      query: () => "/api/v1/service-types",
      providesTags: ["Zone"],
    }),

    /**
     * Get Partner Zones - Fetch partner-zone mappings
     */
    getPartnerZones: builder.query<
      PartnerZonesResponse,
      { partnerId?: string; zoneId?: string; page?: number; limit?: number }
    >({
      query: (params) => ({
        url: "/api/v1/partner-zones",
        params,
      }),
      providesTags: ["Zone", "Partner"],
    }),

    /**
     * Validate Coverage - Check if a route is covered
     */
    validateCoverage: builder.mutation<
      ValidateCoverageResponse,
      ValidateCoverageRequest
    >({
      query: (coverageData) => ({
        url: "/api/v1/zones/coverage/validate",
        method: "POST",
        body: coverageData,
      }),
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useCreateZoneMutation,
  useGetZonesQuery,
  useGetZoneByIdQuery,
  useUpdateZoneMutation,
  useDeleteZoneMutation,
  useGetServiceTypesQuery,
  useGetPartnerZonesQuery,
  useValidateCoverageMutation,
} = zonesApi;

// ===========================
// Export Types
// ===========================

export type {
  Zone,
  CreateZoneRequest,
  UpdateZoneRequest,
  ZoneResponse,
  ZonesListResponse,
  GetZonesParams,
  ServiceType,
  ServiceTypesResponse,
  PartnerZone,
  PartnerZonesResponse,
  ValidateCoverageRequest,
  ValidateCoverageResponse,
};
