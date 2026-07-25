import { baseApi } from "../baseApi";

/**
 * Partner Channel Management API Endpoints
 *
 * All partner channel endpoints route through API Gateway (port 3001)
 * Supports single/multi-channel API configurations for partners
 */

// ===========================
// Request/Response Interfaces
// ===========================

export type AggregatorType = string;

export interface DelhiveryConfig {
  clientName?: string;
  [key: string]: any;
}

export interface BlueDartConfig {
  licenseKey?: string;
  loginId?: string;
  customerCode?: string;
}

export interface DelhiveryB2BConfig {
  username?: string;
  password?: string;
  clientId?: string;
  ltlApiUrl?: string;
  [key: string]: any;
}

export type AggregatorConfig =
  DelhiveryConfig | BlueDartConfig | DelhiveryB2BConfig | Record<string, any>;

export interface ChannelConfig {
  id?: string;
  channelName: string;
  apiUrl: string;
  apiKey?: string;
  isActive: boolean;
  isPrimary: boolean;
  priority: number;
  aggregatorType?: AggregatorType;
  aggregatorConfig?: AggregatorConfig;
  webhookSecret?: string;
  /**
   * Volumetric formula override: ((boxes * L*W*H) / divisor) * factor.
   * null on either field means "use the system default" (27000 / 6).
   */
  volumetricDivisor?: number | null;
  volumetricFactor?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChannelsListResponse {
  status: "success" | "error";
  data: {
    channels: ChannelConfig[];
    total: number;
  };
}

export interface ChannelResponse {
  status: "success" | "error";
  data: ChannelConfig;
}

export interface ActiveChannelResponse {
  status: "success" | "error";
  data: ChannelConfig & { mode?: "SINGLE" | "MULTI" };
}

export interface TestChannelRequest {
  aggregatorType: AggregatorType;
  apiUrl?: string;
  apiKey?: string;
  aggregatorConfig?: AggregatorConfig;
}

export interface TestChannelResponse {
  status: "success" | "error";
  data: {
    success: boolean;
    message: string;
    aggregatorType: string;
  };
}

// ===========================
// API Endpoints
// ===========================

export const partnerChannelApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get active channel for a partner
     * Used by other services to determine which API endpoint to use
     */
    getActiveChannel: builder.query<ActiveChannelResponse, string>({
      query: (partnerId) => ({
        url: `/api/v1/partners/${partnerId}/channels/active`,
      }),
      providesTags: (result, error, id) =>
        result ? [{ type: "PartnerChannel" as const, id: `active-${id}` }] : [],
    }),

    /**
     * List all channels for a partner
     */
    listPartnerChannels: builder.query<ChannelsListResponse, string>({
      query: (partnerId) => ({
        url: `/api/v1/partners/${partnerId}/channels`,
      }),
      providesTags: (result, error, id) =>
        result
          ? [
              { type: "PartnerChannel" as const, id: `LIST-${id}` },
              ...result.data.channels.map((c) => ({
                type: "PartnerChannel" as const,
                id: c.id,
              })),
            ]
          : [],
    }),

    /**
     * Create channels for a partner
     * Supports bulk creation of multiple channels
     */
    createChannels: builder.mutation<
      ChannelsListResponse,
      { partnerId: string; channels: ChannelConfig[] }
    >({
      query: ({ partnerId, channels }) => ({
        url: `/api/v1/partners/${partnerId}/channels`,
        method: "POST",
        body: { channels },
      }),
      invalidatesTags: (result, error, { partnerId }) => [
        { type: "PartnerChannel" as const, id: `LIST-${partnerId}` },
        { type: "PartnerChannel" as const, id: `active-${partnerId}` },
        { type: "Partner" as const, id: partnerId },
      ],
    }),

    /**
     * Update a channel
     */
    updateChannel: builder.mutation<
      ChannelResponse,
      { partnerId: string; channelId: string; updates: Partial<ChannelConfig> }
    >({
      query: ({ channelId, updates }) => ({
        url: `/api/v1/channels/${channelId}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (result, error, { partnerId, channelId }) => [
        { type: "PartnerChannel" as const, id: channelId },
        { type: "PartnerChannel" as const, id: `LIST-${partnerId}` },
        { type: "PartnerChannel" as const, id: `active-${partnerId}` },
      ],
    }),

    /**
     * Test unsaved channel credentials against the live courier API.
     * No cache tags — nothing is persisted.
     */
    testChannel: builder.mutation<TestChannelResponse, TestChannelRequest>({
      query: (body) => ({
        url: `/api/v1/channels/test`,
        method: "POST",
        body,
      }),
    }),

    /**
     * Delete a channel
     */
    deleteChannel: builder.mutation<
      void,
      { partnerId: string; channelId: string }
    >({
      query: ({ channelId }) => ({
        url: `/api/v1/channels/${channelId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { partnerId, channelId }) => [
        { type: "PartnerChannel" as const, id: channelId },
        { type: "PartnerChannel" as const, id: `LIST-${partnerId}` },
        { type: "PartnerChannel" as const, id: `active-${partnerId}` },
        { type: "Partner" as const, id: partnerId },
      ],
    }),
  }),
});

// Export hooks for use in components
export const {
  useGetActiveChannelQuery,
  useListPartnerChannelsQuery,
  useCreateChannelsMutation,
  useUpdateChannelMutation,
  useTestChannelMutation,
  useDeleteChannelMutation,
} = partnerChannelApi;
