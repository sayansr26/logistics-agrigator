import { baseApi } from "../baseApi";

// ===========================
// Enums and Types
// ===========================

export type BadgeTier =
  | "BASIC"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND";

export type DiscountType = "FLAT" | "PERCENTAGE";

// ===========================
// Interfaces
// ===========================

interface Partner {
  id: string;
  name: string;
  displayName: string;
}

interface ChargeRuleRef {
  id: string;
  base: string;
  minValue?: number | null;
  percentageValue?: number | null;
  perKg?: number | null;
  perKgCharge?: number | null;
  isActive: boolean;
  partner?: Partner;
  chargesType?: { id: string; name: string } | null;
  pincodeType?: { id: string; name: string; type: string } | null;
  zoneMilestone?: {
    id: string;
    minKm: number;
    maxKm: number;
    suffix: string;
  } | null;
}

export interface ChargeDiscountPackageItem {
  id: string;
  packageId: string;
  chargeRuleId: string;
  discountType: DiscountType;
  discountValue: number;
  chargeRule?: ChargeRuleRef;
}

export interface ChargeDiscountPackage {
  id: string;
  partnerId: string;
  badge: BadgeTier;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  partner?: Partner;
  items?: ChargeDiscountPackageItem[];
}

export interface CreatePackageItemRequest {
  chargeRuleId: string;
  discountType: DiscountType;
  discountValue: number;
}

export interface CreatePackageRequest {
  partnerId: string;
  badge: BadgeTier;
  name: string;
  description?: string;
  isActive?: boolean;
  items: CreatePackageItemRequest[];
}

export interface UpdatePackageRequest {
  badge?: BadgeTier;
  name?: string;
  description?: string;
  isActive?: boolean;
  items?: CreatePackageItemRequest[];
}

export interface GetPackagesParams {
  page?: number;
  limit?: number;
  partnerId?: string;
  badge?: BadgeTier;
  isActive?: boolean;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "name" | "badge";
  sortOrder?: "asc" | "desc";
}

// ===========================
// API Slice
// ===========================

export const chargeDiscountPackagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChargeDiscountPackages: builder.query<
      {
        packages: ChargeDiscountPackage[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      },
      GetPackagesParams | void
    >({
      query: (params) => ({
        url: "/api/v1/charge-discount-packages",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: any) => ({
        packages: response?.data?.packages || [],
        pagination: response?.data?.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      }),
      providesTags: (result) =>
        result?.packages
          ? [
              ...result.packages.map(({ id }) => ({
                type: "ChargeDiscountPackage" as const,
                id,
              })),
              { type: "ChargeDiscountPackage", id: "LIST" },
            ]
          : [{ type: "ChargeDiscountPackage", id: "LIST" }],
    }),

    getChargeDiscountPackageById: builder.query<
      { package: ChargeDiscountPackage },
      string
    >({
      query: (id) => ({
        url: `/api/v1/charge-discount-packages/${id}`,
        method: "GET",
      }),
      transformResponse: (response: any) => ({
        package: response?.data?.package || null,
      }),
      providesTags: (_, __, id) => [{ type: "ChargeDiscountPackage", id }],
    }),

    createChargeDiscountPackage: builder.mutation<
      { package: ChargeDiscountPackage },
      CreatePackageRequest
    >({
      query: (data) => ({
        url: "/api/v1/charge-discount-packages",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: any) => ({
        package: response?.data?.package || null,
      }),
      invalidatesTags: [{ type: "ChargeDiscountPackage", id: "LIST" }],
    }),

    updateChargeDiscountPackage: builder.mutation<
      { package: ChargeDiscountPackage },
      { id: string; data: UpdatePackageRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/charge-discount-packages/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: any) => ({
        package: response?.data?.package || null,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "ChargeDiscountPackage", id },
        { type: "ChargeDiscountPackage", id: "LIST" },
      ],
    }),

    deleteChargeDiscountPackage: builder.mutation<
      { package: ChargeDiscountPackage },
      string
    >({
      query: (id) => ({
        url: `/api/v1/charge-discount-packages/${id}`,
        method: "DELETE",
      }),
      transformResponse: (response: any) => ({
        package: response?.data?.package || null,
      }),
      invalidatesTags: (_, __, id) => [
        { type: "ChargeDiscountPackage", id },
        { type: "ChargeDiscountPackage", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetChargeDiscountPackagesQuery,
  useGetChargeDiscountPackageByIdQuery,
  useCreateChargeDiscountPackageMutation,
  useUpdateChargeDiscountPackageMutation,
  useDeleteChargeDiscountPackageMutation,
} = chargeDiscountPackagesApi;
