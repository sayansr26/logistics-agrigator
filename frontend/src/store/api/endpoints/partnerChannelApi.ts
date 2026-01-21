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

export interface ChannelConfig {
  id?: string;
  channelName: string;
  apiUrl: string;
  apiKey?: string;
  isActive: boolean;
  isPrimary: boolean;
  priority: number;
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

export interface SwitchModeRequest {
  mode: "SINGLE" | "MULTI";
  migrateConfig?: boolean;
}

export interface SwitchModeResponse {
  status: "success" | "error";
  data: {
    message?: string;
    partner?: any;
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
      { channelId: string; updates: Partial<ChannelConfig> }
    >({
      query: ({ channelId, updates }) => ({
        url: `/api/v1/channels/${channelId}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (result, error, { channelId }) => [
        { type: "PartnerChannel" as const, id: channelId },
      ],
    }),

    /**
     * Delete a channel
     */
    deleteChannel: builder.mutation<void, string>({
      query: (channelId) => ({
        url: `/api/v1/channels/${channelId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, channelId) => [
        { type: "PartnerChannel" as const, id: channelId },
        { type: "PartnerChannel" as const, id: "LIST" },
      ],
    }),

    /**
     * Switch channel mode for a partner
     * Converts between SINGLE and MULTI channel modes
     */
    switchChannelMode: builder.mutation<
      SwitchModeResponse,
      { partnerId: string; mode: "SINGLE" | "MULTI"; migrateConfig?: boolean }
    >({
      query: ({ partnerId, mode, migrateConfig }) => ({
        url: `/api/v1/partners/${partnerId}/channel-mode`,
        method: "PATCH",
        body: { mode, migrateConfig },
      }),
      invalidatesTags: (result, error, { partnerId }) => [
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
  useDeleteChannelMutation,
  useSwitchChannelModeMutation,
} = partnerChannelApi;
