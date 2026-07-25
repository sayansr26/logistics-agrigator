import { baseApi } from "../baseApi";

/**
 * Service Channel (Routing Channel) API Endpoints
 *
 * Rule-based channels per courier partner: each channel carries routing rules
 * (business type B2B/B2C, weight slab, order-amount range, payment modes,
 * service mode, priority) plus a link to a credential account
 * (PartnerChannelConfig). The booking/rating flow selects the matching channel
 * per shipment profile.
 *
 * Backend routes (partner-service via API Gateway):
 * - GET    /api/v1/partners/:partnerId/carrier-accounts
 * - POST   /api/v1/partners/:partnerId/carrier-accounts   { accounts: [...] }
 * - PUT    /api/v1/carrier-accounts/:accountId
 * - DELETE /api/v1/carrier-accounts/:accountId
 * - GET    /api/v1/partners/:partnerId/carrier-accounts/select
 */

// ===========================
// Types
// ===========================

export type ChannelServiceType = "SURFACE" | "AIR" | "EXPRESS";
export type ChannelBusinessType = "B2B" | "B2C" | "BOTH";
export type ChannelPaymentMode = "COD" | "PREPAID";

export interface ServiceChannel {
  id: string;
  partnerId: string;
  channelConfigId: string | null;
  channelName: string;
  accountRef: string;
  serviceType: ChannelServiceType;
  businessType: ChannelBusinessType;
  minWeight: string | number;
  maxWeight: string | number | null;
  minOrderAmount: string | number | null;
  maxOrderAmount: string | number | null;
  paymentModes: ChannelPaymentMode[];
  isActive: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
  channelConfig?: {
    volumetricDivisor?: number | null;
    volumetricFactor?: number | null;
  } | null;
}

export interface ServiceChannelInput {
  channelName: string;
  accountRef: string;
  serviceType: ChannelServiceType;
  businessType: ChannelBusinessType;
  minWeight: number;
  maxWeight?: number | null;
  minOrderAmount?: number | null;
  maxOrderAmount?: number | null;
  paymentModes?: ChannelPaymentMode[];
  channelConfigId?: string | null;
  credentials?: Record<string, unknown> | null;
  isActive: boolean;
  priority: number;
}

export interface ServiceChannelsListResponse {
  status: "success" | "error";
  data: {
    accounts: ServiceChannel[];
    total: number;
  };
}

export interface ServiceChannelResponse {
  status: "success" | "error";
  data: ServiceChannel;
}

export interface ChannelSelectionResponse {
  status: "success" | "error";
  data: {
    mode: "LEGACY" | "MATCHED" | "NO_MATCH";
    channel: ServiceChannel | null;
  };
}

export interface SelectChannelParams {
  partnerId: string;
  weight: number;
  businessType?: "B2B" | "B2C";
  orderAmount?: number;
  paymentType?: ChannelPaymentMode;
  serviceType?: ChannelServiceType;
}

// ===========================
// API Endpoints
// ===========================

export const serviceChannelApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * List routing channels for a partner
     */
    listServiceChannels: builder.query<ServiceChannelsListResponse, string>({
      query: (partnerId) => ({
        url: `/api/v1/partners/${partnerId}/carrier-accounts`,
      }),
      providesTags: (result, error, id) =>
        result
          ? [
              { type: "ServiceChannel" as const, id: `LIST-${id}` },
              ...result.data.accounts.map((a) => ({
                type: "ServiceChannel" as const,
                id: a.id,
              })),
            ]
          : [],
    }),

    /**
     * Preview which channel matches a shipment profile
     */
    selectServiceChannel: builder.query<
      ChannelSelectionResponse,
      SelectChannelParams
    >({
      query: ({ partnerId, ...params }) => ({
        url: `/api/v1/partners/${partnerId}/carrier-accounts/select`,
        params,
      }),
    }),

    /**
     * Create routing channel(s) for a partner (bulk-capable)
     */
    createServiceChannels: builder.mutation<
      ServiceChannelsListResponse,
      { partnerId: string; accounts: ServiceChannelInput[] }
    >({
      query: ({ partnerId, accounts }) => ({
        url: `/api/v1/partners/${partnerId}/carrier-accounts`,
        method: "POST",
        body: { accounts },
      }),
      invalidatesTags: (result, error, { partnerId }) => [
        { type: "ServiceChannel" as const, id: `LIST-${partnerId}` },
      ],
    }),

    /**
     * Update a routing channel
     */
    updateServiceChannel: builder.mutation<
      ServiceChannelResponse,
      {
        partnerId: string;
        channelId: string;
        updates: Partial<ServiceChannelInput>;
      }
    >({
      query: ({ channelId, updates }) => ({
        url: `/api/v1/carrier-accounts/${channelId}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (result, error, { partnerId, channelId }) => [
        { type: "ServiceChannel" as const, id: channelId },
        { type: "ServiceChannel" as const, id: `LIST-${partnerId}` },
      ],
    }),

    /**
     * Delete a routing channel
     */
    deleteServiceChannel: builder.mutation<
      void,
      { partnerId: string; channelId: string }
    >({
      query: ({ channelId }) => ({
        url: `/api/v1/carrier-accounts/${channelId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { partnerId, channelId }) => [
        { type: "ServiceChannel" as const, id: channelId },
        { type: "ServiceChannel" as const, id: `LIST-${partnerId}` },
      ],
    }),
  }),
});

export const {
  useListServiceChannelsQuery,
  useLazySelectServiceChannelQuery,
  useCreateServiceChannelsMutation,
  useUpdateServiceChannelMutation,
  useDeleteServiceChannelMutation,
} = serviceChannelApi;
