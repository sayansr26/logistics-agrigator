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
// Booking Questions (dynamic VAS form catalog)
// ===========================

export type BookingQuestionType = "boolean" | "select" | "datetime" | "number";

export interface BookingQuestionOption {
  value: string | number;
  label: string;
}

export interface BookingQuestionFollowUp {
  key: string;
  type: BookingQuestionType;
  when: unknown;
  label: string;
  options?: BookingQuestionOption[];
}

export interface BookingQuestionSpec {
  key: string;
  type: BookingQuestionType;
  label: string;
  default?: unknown;
  options?: BookingQuestionOption[];
  followUp?: BookingQuestionFollowUp[];
}

export interface BookingQuestion {
  chargeCode: string;
  name: string;
  description?: string | null;
  category?: string | null;
  question: BookingQuestionSpec;
}

export interface BookingQuestionsResponse {
  status: string;
  data: {
    questions: BookingQuestion[];
  };
}

// ===========================
// Charge Definitions (charges-engine v3 catalog)
// ===========================

export type ChargeApplyStage = "QUOTE" | "BOOKING_OPTION" | "EVENT";

export interface ChargeDefinitionComputation {
  method: string;
  basis?: string;
  paramsSchema?: unknown;
  [key: string]: unknown;
}

export interface ChargeDefinition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  applyStage: ChargeApplyStage;
  phase: number;
  computation: ChargeDefinitionComputation;
  bookingQuestion?: unknown;
  conditions?: unknown;
  aggregation?: unknown;
  flags?: Record<string, unknown> | null;
  isSystem: boolean;
  isActive: boolean;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GetChargeDefinitionsParams {
  page?: number;
  limit?: number;
  category?: string;
  applyStage?: ChargeApplyStage;
  isActive?: boolean;
  search?: string;
}

export interface ChargeDefinitionsResponse {
  status: string;
  data: {
    definitions: ChargeDefinition[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface UpdateChargeDefinitionStatusRequest {
  id: string;
  isActive: boolean;
}

// ===========================
// Charge Configs (per-partner)
// ===========================

export interface ChargeConfigDefinitionRef {
  id: string;
  code: string;
  name: string;
  category: string;
  applyStage: ChargeApplyStage;
  phase?: number;
  computation?: ChargeDefinitionComputation;
}

export interface ChargeConfig {
  id: string;
  partnerId: string;
  channelId?: string | null;
  chargeDefinitionId: string;
  config: Record<string, unknown>;
  conditions?: unknown;
  priority: number;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  version?: number;
  createdAt: string;
  updatedAt: string;
  partner?: { id: string; name: string; displayName: string };
  channel?: { id: string; name?: string } | null;
  chargeDefinition?: ChargeConfigDefinitionRef;
}

export interface GetChargeConfigsParams {
  partnerId?: string;
  channelId?: string;
  chargeDefinitionId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ChargeConfigsResponse {
  status: string;
  data: {
    configs: ChargeConfig[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CreateChargeConfigRequest {
  partnerId: string;
  chargeDefinitionId: string;
  channelId?: string;
  config: Record<string, unknown>;
  conditions?: unknown;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateChargeConfigRequest {
  config?: Record<string, unknown>;
  conditions?: unknown;
  isActive?: boolean;
  priority?: number;
}

// ===========================
// AI Assist (draft-from-text / anomaly scan / suggestion inbox)
// ===========================

export type AiSuggestionKind = "CONFIG_FROM_NL" | "LEGACY_IMPORT" | "ANOMALY";
export type AiSuggestionStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";

export interface AiSuggestedConfig {
  chargeDefinitionCode: string;
  partnerId?: string;
  config: Record<string, unknown>;
  conditions?: unknown;
}

export interface AiSuggestionPayload {
  understanding?: string;
  definitions?: unknown[];
  configs?: AiSuggestedConfig[];
  warnings?: string[];
  findings?: AnomalyFinding[];
}

export interface AiSuggestion {
  id: string;
  kind: AiSuggestionKind;
  status: AiSuggestionStatus;
  inputContext?: Record<string, unknown>;
  suggestion: AiSuggestionPayload;
  validation?: { applyErrors?: string[] } | null;
  modelUsed?: string;
  createdById?: string;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface DraftChargeConfigFromTextRequest {
  description: string;
  partnerId?: string;
}

export interface DraftChargeConfigFromTextResponse {
  status: string;
  data: {
    suggestion: AiSuggestion;
    validationProblems: string[];
  };
}

export interface ApplySuggestionResult {
  definitions: Array<{ id: string; code: string }>;
  configs: Array<{ id: string; code: string }>;
  errors: string[];
}

export interface ApproveAiSuggestionResponse {
  status: string;
  data: {
    suggestion: AiSuggestion;
    results: ApplySuggestionResult;
  };
}

export interface RejectAiSuggestionResponse {
  status: string;
  data: {
    suggestion: AiSuggestion;
  };
}

export interface GetAiSuggestionsParams {
  status?: AiSuggestionStatus;
  kind?: AiSuggestionKind;
  page?: number;
  limit?: number;
}

export interface AiSuggestionsResponse {
  status: string;
  data: {
    suggestions: AiSuggestion[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface AnomalyFinding {
  severity: "LOW" | "MEDIUM" | "HIGH" | string;
  chargeCode: string;
  partnerId?: string;
  issue: string;
  suggestion: string;
}

export interface RunAnomalyScanRequest {
  partnerId: string;
}

export interface RunAnomalyScanResponse {
  status: string;
  data: {
    findings: AnomalyFinding[];
    scannedConfigs: number;
    suggestionId?: string;
  };
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

    /**
     * Dynamic VAS booking-question catalog for the shipment wizard.
     * Omit partnerId to get every configured question (used pre-quote,
     * Step 1); pass partnerId to get only the questions priced for that
     * partner (used post-quote via `requiredQuestions` on the quote itself).
     */
    getBookingQuestions: builder.query<
      BookingQuestionsResponse,
      { partnerId?: string } | void
    >({
      query: (params) => {
        const partnerId = params ? params.partnerId : undefined;
        return {
          url: "/api/v1/charge-definitions/booking-questions",
          method: "GET",
          params: partnerId ? { partnerId } : undefined,
        };
      },
      providesTags: ["ChargeCatalog"],
    }),

    // ===========================
    // Charge Definitions (catalog)
    // ===========================

    getChargeDefinitions: builder.query<
      ChargeDefinitionsResponse,
      GetChargeDefinitionsParams | void
    >({
      query: (params) => ({
        url: "/api/v1/charge-definitions",
        method: "GET",
        params: params || {},
      }),
      providesTags: (result) =>
        result?.data?.definitions
          ? [
              ...result.data.definitions.map(({ id }) => ({
                type: "ChargeDefinition" as const,
                id,
              })),
              { type: "ChargeDefinition", id: "LIST" },
            ]
          : [{ type: "ChargeDefinition", id: "LIST" }],
    }),

    updateChargeDefinitionStatus: builder.mutation<
      { status: string; data: { definition: ChargeDefinition } },
      UpdateChargeDefinitionStatusRequest
    >({
      query: ({ id, isActive }) => ({
        url: `/api/v1/charge-definitions/${id}`,
        method: "PUT",
        body: { isActive },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ChargeDefinition", id },
        { type: "ChargeDefinition", id: "LIST" },
        "ChargeCatalog",
      ],
    }),

    deleteChargeDefinition: builder.mutation<
      { status: string; data: { definition: ChargeDefinition } },
      string
    >({
      query: (id) => ({
        url: `/api/v1/charge-definitions/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "ChargeDefinition", id },
        { type: "ChargeDefinition", id: "LIST" },
        { type: "ChargeConfig", id: "LIST" },
        "ChargeCatalog",
      ],
    }),

    // ===========================
    // Charge Configs (per-partner)
    // ===========================

    getChargeConfigs: builder.query<
      ChargeConfigsResponse,
      GetChargeConfigsParams | void
    >({
      query: (params) => ({
        url: "/api/v1/charge-configs",
        method: "GET",
        params: params || {},
      }),
      providesTags: (result) =>
        result?.data?.configs
          ? [
              ...result.data.configs.map(({ id }) => ({
                type: "ChargeConfig" as const,
                id,
              })),
              { type: "ChargeConfig", id: "LIST" },
            ]
          : [{ type: "ChargeConfig", id: "LIST" }],
    }),

    createChargeConfig: builder.mutation<
      { status: string; data: { config: ChargeConfig } },
      CreateChargeConfigRequest
    >({
      query: (body) => ({
        url: "/api/v1/charge-configs",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "ChargeConfig", id: "LIST" }],
    }),

    updateChargeConfig: builder.mutation<
      { status: string; data: { config: ChargeConfig } },
      { id: string; data: UpdateChargeConfigRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/charge-configs/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ChargeConfig", id },
        { type: "ChargeConfig", id: "LIST" },
      ],
    }),

    deleteChargeConfig: builder.mutation<
      { status: string; data: { config: ChargeConfig } },
      string
    >({
      query: (id) => ({
        url: `/api/v1/charge-configs/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "ChargeConfig", id },
        { type: "ChargeConfig", id: "LIST" },
      ],
    }),

    // ===========================
    // AI Assist
    // ===========================

    draftChargeConfigFromText: builder.mutation<
      DraftChargeConfigFromTextResponse,
      DraftChargeConfigFromTextRequest
    >({
      query: (body) => ({
        url: "/api/v1/charge-configs/ai/draft-from-text",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "AiSuggestion", id: "LIST" }],
    }),

    getAiSuggestions: builder.query<
      AiSuggestionsResponse,
      GetAiSuggestionsParams | void
    >({
      query: (params) => ({
        url: "/api/v1/charge-configs/ai/suggestions",
        method: "GET",
        params: params || {},
      }),
      providesTags: (result) =>
        result?.data?.suggestions
          ? [
              ...result.data.suggestions.map(({ id }) => ({
                type: "AiSuggestion" as const,
                id,
              })),
              { type: "AiSuggestion", id: "LIST" },
            ]
          : [{ type: "AiSuggestion", id: "LIST" }],
    }),

    approveAiSuggestion: builder.mutation<ApproveAiSuggestionResponse, string>({
      query: (id) => ({
        url: `/api/v1/charge-configs/ai/suggestions/${id}/approve`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "AiSuggestion", id },
        { type: "AiSuggestion", id: "LIST" },
        { type: "ChargeConfig", id: "LIST" },
        { type: "ChargeDefinition", id: "LIST" },
      ],
    }),

    rejectAiSuggestion: builder.mutation<
      RejectAiSuggestionResponse,
      { id: string; reason?: string }
    >({
      query: ({ id, reason }) => ({
        url: `/api/v1/charge-configs/ai/suggestions/${id}/reject`,
        method: "POST",
        body: reason ? { reason } : {},
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "AiSuggestion", id },
        { type: "AiSuggestion", id: "LIST" },
      ],
    }),

    runAnomalyScan: builder.mutation<
      RunAnomalyScanResponse,
      RunAnomalyScanRequest
    >({
      query: (body) => ({
        url: "/api/v1/charge-configs/ai/anomaly-scan",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "AiSuggestion", id: "LIST" }],
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
  useGetBookingQuestionsQuery,
  // Charge Definitions catalog
  useGetChargeDefinitionsQuery,
  useUpdateChargeDefinitionStatusMutation,
  useDeleteChargeDefinitionMutation,
  // Charge Configs (per-partner)
  useGetChargeConfigsQuery,
  useCreateChargeConfigMutation,
  useUpdateChargeConfigMutation,
  useDeleteChargeConfigMutation,
  // AI Assist
  useDraftChargeConfigFromTextMutation,
  useGetAiSuggestionsQuery,
  useApproveAiSuggestionMutation,
  useRejectAiSuggestionMutation,
  useRunAnomalyScanMutation,
} = chargesApi;
