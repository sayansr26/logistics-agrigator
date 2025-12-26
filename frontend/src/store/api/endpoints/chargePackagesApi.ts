import { baseApi } from "../baseApi";

/**
 * Charge Package Management API Endpoints
 *
 * All charge package endpoints route through API Gateway (port 3001)
 *
 * Charge Package Types:
 * - WEIGHT: Charges based on package weight (kg)
 * - DISTANCE: Charges based on shipping distance (km)
 * - GENERIC: Flat charges (COD, Prepaid, etc.)
 */

// ===========================
// Enums and Types
// ===========================

type ChargePackageType = "WEIGHT" | "DISTANCE" | "GENERIC";
type ChargePackageCalcType =
  | "FLAT"
  | "PERCENTAGE_OF_COD"
  | "PERCENTAGE_OF_DECLARED_VALUE";
type ChargePackageAppliesTo = "ANY" | "COD" | "PREPAID";

// ===========================
// Request/Response Interfaces
// ===========================

interface Partner {
  id: string;
  name: string;
  displayName: string;
}

interface ChargePackage {
  id: string;
  partnerId: string;
  name: string;
  type: ChargePackageType;
  baseCharge: number;
  baseUnit?: number | null;
  addonUnit?: number | null;
  addonCharge?: number | null;
  appliesTo: ChargePackageAppliesTo;
  calcType: ChargePackageCalcType;
  metadata?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  partner?: Partner;
}

interface CreateChargePackageRequest {
  partnerIds: string[];
  name: string;
  type: ChargePackageType;
  baseCharge: number;
  // Required for WEIGHT/DISTANCE types
  baseUnit?: number;
  addonUnit?: number;
  addonCharge?: number;
  // For GENERIC type only
  appliesTo?: ChargePackageAppliesTo;
  calcType?: ChargePackageCalcType;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

interface UpdateChargePackageRequest {
  name?: string;
  baseCharge?: number;
  baseUnit?: number;
  addonUnit?: number;
  addonCharge?: number;
  appliesTo?: ChargePackageAppliesTo;
  calcType?: ChargePackageCalcType;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

interface ChargePackageResponse {
  status: string;
  message?: string;
  data: {
    package?: ChargePackage;
    packages?: ChargePackage[];
    summary?: {
      total: number;
      partnerIds: string[];
      packageName: string;
      type: ChargePackageType;
    };
  };
}

interface ChargePackagesListResponse {
  status: string;
  message?: string;
  data: {
    packages: ChargePackage[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface GroupedPackagesResponse {
  status: string;
  message?: string;
  data: {
    packages: {
      WEIGHT: ChargePackage[];
      DISTANCE: ChargePackage[];
      GENERIC: ChargePackage[];
    };
    counts: {
      WEIGHT: number;
      DISTANCE: number;
      GENERIC: number;
      total: number;
    };
  };
}

interface GetChargePackagesParams {
  page?: number;
  limit?: number;
  partnerId?: string;
  type?: ChargePackageType;
  isActive?: boolean;
  search?: string;
  sortBy?: "name" | "type" | "baseCharge" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

interface GetPackagesByPartnerParams {
  partnerId: string;
  type?: ChargePackageType;
  isActive?: boolean;
}

// ===========================
// API Slice
// ===========================

export const chargePackagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all charge packages with filtering and pagination
    getChargePackages: builder.query<
      ChargePackagesListResponse,
      GetChargePackagesParams | void
    >({
      query: (params) => ({
        url: "/api/v1/charge-packages",
        method: "GET",
        params: params || {},
      }),
      providesTags: (result) =>
        result?.data?.packages
          ? [
              ...result.data.packages.map(({ id }) => ({
                type: "ChargePackage" as const,
                id,
              })),
              { type: "ChargePackage", id: "LIST" },
            ]
          : [{ type: "ChargePackage", id: "LIST" }],
    }),

    // Get charge package by ID
    getChargePackageById: builder.query<ChargePackageResponse, string>({
      query: (id) => ({
        url: `/api/v1/charge-packages/${id}`,
        method: "GET",
      }),
      providesTags: (_, __, id) => [{ type: "ChargePackage", id }],
    }),

    // Get packages by partner
    getPackagesByPartner: builder.query<
      ChargePackagesListResponse,
      GetPackagesByPartnerParams
    >({
      query: ({ partnerId, ...params }) => ({
        url: `/api/v1/charge-packages/partner/${partnerId}`,
        method: "GET",
        params,
      }),
      providesTags: (result, _, { partnerId }) =>
        result?.data?.packages
          ? [
              ...result.data.packages.map(({ id }) => ({
                type: "ChargePackage" as const,
                id,
              })),
              { type: "ChargePackage", id: `PARTNER_${partnerId}` },
            ]
          : [{ type: "ChargePackage", id: `PARTNER_${partnerId}` }],
    }),

    // Get packages by partner grouped by type
    getPackagesByPartnerGrouped: builder.query<
      GroupedPackagesResponse,
      { partnerId: string; activeOnly?: boolean }
    >({
      query: ({ partnerId, activeOnly }) => ({
        url: `/api/v1/charge-packages/partner/${partnerId}/grouped`,
        method: "GET",
        params: { activeOnly },
      }),
      providesTags: (_, __, { partnerId }) => [
        { type: "ChargePackage", id: `PARTNER_GROUPED_${partnerId}` },
      ],
    }),

    // Create charge package(s) for one or more partners
    createChargePackage: builder.mutation<
      ChargePackageResponse,
      CreateChargePackageRequest
    >({
      query: (data) => ({
        url: "/api/v1/charge-packages",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [{ type: "ChargePackage", id: "LIST" }],
    }),

    // Update charge package
    updateChargePackage: builder.mutation<
      ChargePackageResponse,
      { id: string; data: UpdateChargePackageRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/charge-packages/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "ChargePackage", id },
        { type: "ChargePackage", id: "LIST" },
      ],
    }),

    // Delete (disable) charge package
    deleteChargePackage: builder.mutation<ChargePackageResponse, string>({
      query: (id) => ({
        url: `/api/v1/charge-packages/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_, __, id) => [
        { type: "ChargePackage", id },
        { type: "ChargePackage", id: "LIST" },
      ],
    }),

    // Toggle charge package active status
    toggleChargePackageStatus: builder.mutation<
      ChargePackageResponse,
      { id: string; isActive: boolean }
    >({
      query: ({ id, isActive }) => ({
        url: `/api/v1/charge-packages/${id}`,
        method: "PUT",
        body: { isActive },
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "ChargePackage", id },
        { type: "ChargePackage", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

// ===========================
// Export Hooks
// ===========================

export const {
  useGetChargePackagesQuery,
  useGetChargePackageByIdQuery,
  useGetPackagesByPartnerQuery,
  useGetPackagesByPartnerGroupedQuery,
  useCreateChargePackageMutation,
  useUpdateChargePackageMutation,
  useDeleteChargePackageMutation,
  useToggleChargePackageStatusMutation,
} = chargePackagesApi;

// ===========================
// Export Types
// ===========================

export type {
  ChargePackage,
  ChargePackageType,
  ChargePackageCalcType,
  ChargePackageAppliesTo,
  CreateChargePackageRequest,
  UpdateChargePackageRequest,
  ChargePackageResponse,
  ChargePackagesListResponse,
  GroupedPackagesResponse,
  GetChargePackagesParams,
  GetPackagesByPartnerParams,
};
