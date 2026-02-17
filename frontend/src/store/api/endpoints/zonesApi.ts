import { baseApi } from "../baseApi";

/**
 * Zone Management API Endpoints
 *
 * All zone endpoints route through API Gateway (port 3001)
 *
 * Zone System v2:
 * - DISTANCE zones: Based on distance milestones (km ranges)
 * - GEOLOGICAL zones: Based on geographical coverage (coming soon)
 */

// ===========================
// Request/Response Interfaces
// ===========================

type ZoneType = "DISTANCE" | "GEOLOGICAL";

interface ZoneMilestone {
  id: string;
  zoneId: string;
  minKm: number;
  maxKm: number;
  suffix: string;
  sortOrder: number;
  createdAt: string;
}

interface Zone {
  id: string;
  name: string;
  description?: string;
  partnerId: string;
  zoneType: ZoneType;
  status: boolean;
  milestones?: ZoneMilestone[];
  createdAt: string;
  updatedAt: string;
}

interface CreateZoneRequest {
  name: string;
  description?: string;
  zoneType: ZoneType;
  status?: boolean;
  // For DISTANCE zones
  partnerIds?: string[];
  milestones?: { minKm: number; maxKm: number }[];
  // For GEOLOGICAL zones (coming soon)
  partnerId?: string;
  geographical?: {
    states?: string[];
    cities?: string[];
    areas?: string[];
    pincodes?: string[];
  };
}

interface UpdateZoneRequest {
  name?: string;
  description?: string;
  status?: boolean;
}

interface ZoneResponse {
  status: string;
  message?: string;
  data: {
    zone?: Zone;
    zones?: Zone[];
    summary?: {
      zonesCreated: number;
      partnersAffected: number;
      milestonesPerZone: number;
    };
  };
}

interface ZonesListResponse {
  status: string;
  message?: string;
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
  zoneType?: ZoneType;
  partnerId?: string;
  status?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Note: ServiceType model has been removed from backend.
// Use /api/v1/pincode-types for pincode type management instead.

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
      query: (params) => ({
        url: "/api/v1/zones",
        params: params || {},
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
     * Note: Backend returns zone directly in data, not data.zone
     */
    getZoneById: builder.query<
      { status: string; data: Zone; meta?: any },
      string
    >({
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

    // Note: getServiceTypes has been removed.
    // Use pincodeTypeApi for pincode type management.

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
  useGetPartnerZonesQuery,
  useValidateCoverageMutation,
} = zonesApi;

// ===========================
// Export Types
// ===========================

export type {
  Zone,
  ZoneType,
  ZoneMilestone,
  CreateZoneRequest,
  UpdateZoneRequest,
  ZoneResponse,
  ZonesListResponse,
  GetZonesParams,
  PartnerZone,
  PartnerZonesResponse,
  ValidateCoverageRequest,
  ValidateCoverageResponse,
};
