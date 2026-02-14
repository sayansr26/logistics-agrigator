import { baseApi } from "../baseApi";

/**
 * Charges Rule Management API Endpoints
 *
 * Replaces legacy chargePackagesApi.
 * All charge rule endpoints route through API Gateway (port 3001).
 */

// ===========================
// Enums and Types
// ===========================

export type ChargeRuleKind = "PARTNER_CHARGES_TYPE" | "GEOLOGICAL" | "ADDON";

export type ChargeRuleBase =
  | "INVOICE_VALUE"
  | "WEIGHT"
  | "ZONE_TO_ZONE_WEIGHT"
  | "DISTANCE_BASE_WEIGHT";

export type ChargeCalcType = "FLAT" | "PERCENTAGE";

// ===========================
// Interfaces
// ===========================

interface Partner {
  id: string;
  name: string;
  displayName: string;
}

interface ChargesType {
  id: string;
  name: string;
}

interface PincodeType {
  id: string;
  name: string;
  type: string;
}

export interface ChargeRule {
  id: string;
  partnerId: string;
  kind: ChargeRuleKind;
  base: ChargeRuleBase;
  chargesTypeId?: string | null;
  pincodeTypeId?: string | null;
  // INVOICE_VALUE fields
  fromAmount?: number | null;
  toAmount?: number | null;
  // Shared charge + calcType
  charge?: number | null;
  calcType?: ChargeCalcType | null;
  // WEIGHT fields
  minKg?: number | null;
  maxKg?: number | null;
  // ZONE_TO_ZONE_WEIGHT fields
  fromZoneId?: string | null;
  toZoneId?: string | null;
  // Shared weight slab fields
  minWeightKg?: number | null;
  addonWeightKg?: number | null;
  weightCharge?: number | null;
  addonCharge?: number | null;
  // DISTANCE_BASE_WEIGHT fields
  division?: string | null;
  fromKm?: number | null;
  toKm?: number | null;
  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  partner?: Partner;
  chargesType?: ChargesType | null;
  pincodeType?: PincodeType | null;
}

export interface CreateChargeRuleRequest {
  partnerId: string;
  kind: ChargeRuleKind;
  base: ChargeRuleBase;
  chargesTypeId?: string | null;
  pincodeTypeId?: string | null;
  fromAmount?: number | null;
  toAmount?: number | null;
  charge?: number | null;
  calcType?: ChargeCalcType | null;
  minKg?: number | null;
  maxKg?: number | null;
  fromZoneId?: string | null;
  toZoneId?: string | null;
  minWeightKg?: number | null;
  addonWeightKg?: number | null;
  weightCharge?: number | null;
  addonCharge?: number | null;
  division?: string | null;
  fromKm?: number | null;
  toKm?: number | null;
  isActive?: boolean;
}

export interface UpdateChargeRuleRequest {
  kind?: ChargeRuleKind;
  base?: ChargeRuleBase;
  chargesTypeId?: string | null;
  pincodeTypeId?: string | null;
  fromAmount?: number | null;
  toAmount?: number | null;
  charge?: number | null;
  calcType?: ChargeCalcType | null;
  minKg?: number | null;
  maxKg?: number | null;
  fromZoneId?: string | null;
  toZoneId?: string | null;
  minWeightKg?: number | null;
  addonWeightKg?: number | null;
  weightCharge?: number | null;
  addonCharge?: number | null;
  division?: string | null;
  fromKm?: number | null;
  toKm?: number | null;
  isActive?: boolean;
}

export interface GetChargeRulesParams {
  page?: number;
  limit?: number;
  partnerId?: string;
  kind?: ChargeRuleKind;
  chargesTypeId?: string;
  base?: ChargeRuleBase;
  isActive?: boolean;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "kind" | "base";
  sortOrder?: "asc" | "desc";
}

// ===========================
// API Slice
// ===========================

export const chargesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChargeRules: builder.query<
      {
        chargeRules: ChargeRule[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      },
      GetChargeRulesParams | void
    >({
      query: (params) => ({
        url: "/api/v1/charges",
        method: "GET",
        params: params || {},
      }),
      // Backend returns: { status, data: { chargeRules: [...], pagination: {...} }, meta }
      transformResponse: (response: any) => ({
        chargeRules: response?.data?.chargeRules || [],
        pagination: response?.data?.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      }),
      providesTags: (result) =>
        result?.chargeRules
          ? [
              ...result.chargeRules.map(({ id }) => ({
                type: "ChargeRule" as const,
                id,
              })),
              { type: "ChargeRule", id: "LIST" },
            ]
          : [{ type: "ChargeRule", id: "LIST" }],
    }),

    getChargeRuleById: builder.query<{ chargeRule: ChargeRule }, string>({
      query: (id) => ({
        url: `/api/v1/charges/${id}`,
        method: "GET",
      }),
      // Backend returns: { status, data: { chargeRule: {...} }, meta }
      transformResponse: (response: any) => ({
        chargeRule: response?.data?.chargeRule || null,
      }),
      providesTags: (_, __, id) => [{ type: "ChargeRule", id }],
    }),

    createChargeRule: builder.mutation<
      { chargeRule: ChargeRule },
      CreateChargeRuleRequest
    >({
      query: (data) => ({
        url: "/api/v1/charges",
        method: "POST",
        body: data,
      }),
      transformResponse: (response: any) => ({
        chargeRule: response?.data?.chargeRule || null,
      }),
      invalidatesTags: [{ type: "ChargeRule", id: "LIST" }],
    }),

    updateChargeRule: builder.mutation<
      { chargeRule: ChargeRule },
      { id: string; data: UpdateChargeRuleRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/charges/${id}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: (response: any) => ({
        chargeRule: response?.data?.chargeRule || null,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "ChargeRule", id },
        { type: "ChargeRule", id: "LIST" },
      ],
    }),

    deleteChargeRule: builder.mutation<{ chargeRule: ChargeRule }, string>({
      query: (id) => ({
        url: `/api/v1/charges/${id}`,
        method: "DELETE",
      }),
      transformResponse: (response: any) => ({
        chargeRule: response?.data?.chargeRule || null,
      }),
      invalidatesTags: (_, __, id) => [
        { type: "ChargeRule", id },
        { type: "ChargeRule", id: "LIST" },
      ],
    }),

    toggleChargeRuleStatus: builder.mutation<
      { chargeRule: ChargeRule },
      { id: string; isActive: boolean }
    >({
      query: ({ id, isActive }) => ({
        url: `/api/v1/charges/${id}`,
        method: "PUT",
        body: { isActive },
      }),
      transformResponse: (response: any) => ({
        chargeRule: response?.data?.chargeRule || null,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: "ChargeRule", id },
        { type: "ChargeRule", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetChargeRulesQuery,
  useGetChargeRuleByIdQuery,
  useCreateChargeRuleMutation,
  useUpdateChargeRuleMutation,
  useDeleteChargeRuleMutation,
  useToggleChargeRuleStatusMutation,
} = chargesApi;
