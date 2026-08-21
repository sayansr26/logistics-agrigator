import { baseApi } from "../baseApi";

/**
 * External API credentials.
 *
 * Served by auth-service at /api/v1/api-credentials (NOT under /api/v1/external,
 * which the gateway reserves for external-api audience tokens and where a portal
 * session token is rejected).
 */

export interface ApiCredential {
  id: string;
  /** Public identifier, e.g. "lgk_live_9f2a…" */
  clientId: string;
  /** Last 4 characters of the secret — the secret itself is never returned. */
  secretLast4: string;
  name: string;
  actingUserId: string;
  outletId: string | null;
  role: string;
  scopes: string[];
  environment: "live" | "test";
  ipAllowlist: string[];
  rateLimitPerMin: number;
  pinnedVersion: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Returned only by create and rotate — the plaintext secret is shown once. */
export interface ApiCredentialWithSecret extends ApiCredential {
  clientSecret: string;
}

export interface CreateApiCredentialInput {
  name: string;
  outletId?: string | null;
  scopes?: string[];
  environment?: "live" | "test";
  ipAllowlist?: string[];
  rateLimitPerMin?: number;
  expiresAt?: string | null;
}

export interface UpdateApiCredentialInput {
  name?: string;
  scopes?: string[];
  ipAllowlist?: string[];
  rateLimitPerMin?: number;
  expiresAt?: string | null;
}

export interface ListApiCredentialsParams {
  page?: number;
  limit?: number;
  includeRevoked?: boolean;
}

/** Scopes a credential can be granted, grouped for the picker UI. */
export const AVAILABLE_SCOPES: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  {
    value: "shipment:create:own",
    label: "Book shipments",
    description: "Create shipments and fetch rate quotes",
  },
  {
    value: "shipment:read:own",
    label: "Read shipments",
    description: "View shipment details, tracking, labels and documents",
  },
  {
    value: "shipment:list:own",
    label: "List shipments",
    description: "List and filter shipments",
  },
  {
    value: "shipment:update:own",
    label: "Edit shipments",
    description: "Update shipments before carrier handover",
  },
  {
    value: "shipment:delete:own",
    label: "Cancel shipments",
    description: "Cancel shipments and trigger refunds",
  },
  {
    value: "partner:read:own",
    label: "Read partner rates",
    description: "Required for quoting — booking will fail without it",
  },
];

export const apiCredentialsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getApiCredentials: builder.query<
      { data: ApiCredential[]; meta?: any },
      ListApiCredentialsParams | void
    >({
      query: (params) => ({
        url: "/api/v1/api-credentials",
        method: "GET",
        params: params ? { ...params } : {},
      }),
      transformResponse: (response: any) => ({
        data: response.data || [],
        meta: response.meta,
      }),
      providesTags: ["ApiCredential"],
    }),

    createApiCredential: builder.mutation<
      { data: ApiCredentialWithSecret },
      CreateApiCredentialInput
    >({
      query: (body) => ({
        url: "/api/v1/api-credentials",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ApiCredential"],
    }),

    updateApiCredential: builder.mutation<
      { data: ApiCredential },
      { id: string; body: UpdateApiCredentialInput }
    >({
      query: ({ id, body }) => ({
        url: `/api/v1/api-credentials/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["ApiCredential"],
    }),

    rotateApiCredential: builder.mutation<
      { data: ApiCredentialWithSecret },
      string
    >({
      query: (id) => ({
        url: `/api/v1/api-credentials/${id}/rotate`,
        method: "POST",
      }),
      invalidatesTags: ["ApiCredential"],
    }),

    revokeApiCredential: builder.mutation<{ data: ApiCredential }, string>({
      query: (id) => ({
        url: `/api/v1/api-credentials/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ApiCredential"],
    }),
  }),
});

export const {
  useGetApiCredentialsQuery,
  useCreateApiCredentialMutation,
  useUpdateApiCredentialMutation,
  useRotateApiCredentialMutation,
  useRevokeApiCredentialMutation,
} = apiCredentialsApi;
