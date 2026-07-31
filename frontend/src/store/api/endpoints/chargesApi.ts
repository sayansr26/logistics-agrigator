import { baseApi } from "../baseApi";

/**
 * Charges Rule Management API Endpoints (redesigned)
 *
 * No kind field. New field set per base:
 * - INVOICE_VALUE:        minValue, percentageValue, + chargesTypeId|pincodeTypeId
 * - COD_VALUE:            minValue, percentageValue, + chargesTypeId|pincodeTypeId
 *                         (same shape as INVOICE_VALUE; the backend applies the
 *                          percentage to the COD amount, and only on COD shipments)
 * - WEIGHT:               minValue, perKg, perKgCharge, + chargesTypeId|pincodeTypeId
 * - ZONE_TO_ZONE_WEIGHT:  minValue, perKg, perKgCharge, fromZoneId, toZoneId
 * - DISTANCE_BASE_WEIGHT: minValue, perKg, perKgCharge, zoneMilestoneId
 */

// ===========================
// Enums and Types
// ===========================

export type ChargeRuleBase =
  | "INVOICE_VALUE"
  | "COD_VALUE"
  | "WEIGHT"
  | "ZONE_TO_ZONE_WEIGHT"
  | "DISTANCE_BASE_WEIGHT";

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

interface ZoneMilestoneRef {
  id: string;
  minKm: number;
  maxKm: number;
  suffix: string;
  zoneId: string;
}

export interface ChargeRule {
  id: string;
  partnerId: string;
  base: ChargeRuleBase;
  // Type link (Invoice/COD/Weight only – exactly one)
  chargesTypeId?: string | null;
  pincodeTypeId?: string | null;
  // Shared min value
  minValue?: number | null;
  // INVOICE_VALUE / COD_VALUE
  percentageValue?: number | null;
  // WEIGHT / ZONE_TO_ZONE_WEIGHT / DISTANCE_BASE_WEIGHT
  perKg?: number | null;
  perKgCharge?: number | null;
  // ZONE_TO_ZONE_WEIGHT
  fromZoneId?: string | null;
  toZoneId?: string | null;
  // DISTANCE_BASE_WEIGHT
  zoneMilestoneId?: string | null;
  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  partner?: Partner;
  chargesType?: ChargesType | null;
  pincodeType?: PincodeType | null;
  zoneMilestone?: ZoneMilestoneRef | null;
}

export interface CreateChargeRuleRequest {
  partnerId: string;
  base: ChargeRuleBase;
  chargesTypeId?: string | null;
  pincodeTypeId?: string | null;
  minValue: number;
  percentageValue?: number | null;
  perKg?: number | null;
  perKgCharge?: number | null;
  fromZoneId?: string | null;
  toZoneId?: string | null;
  zoneMilestoneId?: string | null;
  isActive?: boolean;
}

export interface UpdateChargeRuleRequest {
  base?: ChargeRuleBase;
  chargesTypeId?: string | null;
  pincodeTypeId?: string | null;
  minValue?: number | null;
  percentageValue?: number | null;
  perKg?: number | null;
  perKgCharge?: number | null;
  fromZoneId?: string | null;
  toZoneId?: string | null;
  zoneMilestoneId?: string | null;
  isActive?: boolean;
}

export interface GetChargeRulesParams {
  page?: number;
  limit?: number;
  partnerId?: string;
  chargesTypeId?: string;
  pincodeTypeId?: string;
  base?: ChargeRuleBase;
  isActive?: boolean;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "base";
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
