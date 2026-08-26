import { baseApi } from "../baseApi";
import type { Pagination } from "./walletApi";

/**
 * Payment Gateway (Razorpay) API Endpoints
 *
 * All payment-gateway endpoints route through the wallet service via the
 * API Gateway (port 3001), under /api/v1/wallet/*.
 */

// ===========================
// Shared enums / value types
// ===========================

type PaymentProviderName =
  "razorpay" | "stripe" | "cashfree" | "payu" | "ccavenue" | "ccavenue_upi_qr";

type PaymentMode = "TEST" | "LIVE";

type PaymentOrderStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "CREDITED"
  | "RECONCILE_PENDING"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

type PaymentLinkUiStatus = "PENDING" | "PAID" | "EXPIRED";

type ManualTopupStatus =
  "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CREDITED" | "FAILED";

// ===========================
// Provider configuration
// ===========================

/**
 * Descriptor for a single provider-specific credential field (e.g. CCAvenue's
 * merchantId / accessCode / workingKey). Drives dynamic credential forms -
 * the UI should render one field per descriptor rather than hardcoding
 * per-provider fields.
 */
interface CredentialFieldDescriptor {
  name: string;
  label: string;
  storageClass: "plaintext" | "encrypted";
  requiredForEnable: boolean;
  revealable: boolean;
  placeholder?: string | null;
  hint?: string | null;
}

/** Current stored state of a single dynamic credential field. */
interface CredentialFieldState {
  set: boolean;
  masked: string | null;
  value: string | null;
  /** True when the field is `revealable` but the value could not be decrypted. */
  unreadable?: boolean;
}

interface ProviderCredentialState {
  keyId: string | null;
  keySecretSet: boolean;
  keySecretMasked: string | null;
  webhookSecretSet: boolean;
  /** Dynamic, provider-specific credential fields keyed by field `name`. */
  credentials: Record<string, CredentialFieldState>;
}

interface PaymentProviderConfig {
  provider: PaymentProviderName;
  clientId: null;
  isEnabled: boolean;
  mode: PaymentMode;
  test: ProviderCredentialState;
  live: ProviderCredentialState;
  currency: string;
  minAmount: number;
  maxAmount: number;
  quickAmounts: number[];
  paymentLinkExpiryHours: number;
  webhookUrl: string;
  webhookEvents: string[];
  lastTestedAt?: string;
  lastTestStatus?: string;
  lastTestMessage?: string;
  updatedAt?: string;
  updatedBy?: string;
  /** True for providers scaffolded in the UI but not yet wired up server-side. */
  comingSoon?: boolean;
  /** Provider-specific credential field descriptors, for dynamic forms. */
  credentialFields: CredentialFieldDescriptor[];
  /**
   * How checkout is completed for this provider. Null only for a
   * `comingSoon` provider that has no credential descriptor registered yet.
   */
  returnFlow: "CHECKOUT_MODAL" | "REDIRECT_POST" | null;
  /** True when the provider posts back to a dedicated return endpoint (e.g. CCAvenue). */
  usesReturnEndpoint: boolean;
  returnUrl: string | null;
  /** Present (true) only when a stored encrypted credential failed to decrypt. */
  credentialsUnreadable?: boolean;
}

interface WalletTopupPolicy {
  manualMaxPerTransaction: number;
  manualApprovalThreshold: number;
  manualMaxPerDayPerUser?: number;
  requireReason: boolean;
  requireReference: boolean;
}

/**
 * Provider credential update payload.
 *
 * The `*KeySecret` / `*WebhookSecret` / `*KeyId` fields are present ONLY when
 * the admin actually retyped that value in the form:
 *   - key omitted (undefined)  -> leave the stored secret unchanged
 *   - key present as ""        -> explicitly clear the stored secret
 *   - key present as a value   -> replace the stored secret
 * Never round-trip the masked value the GET endpoint returns back into one
 * of these fields - it is display-only and not a real secret.
 *
 * `credentials.test` / `credentials.live` follow the SAME semantics, applied
 * per-field for dynamic (provider-specific, e.g. CCAvenue) credential fields:
 *   - key omitted            -> leave that field unchanged
 *   - key present as "" | null -> explicitly clear that field
 *   - key present as a value -> replace that field
 * A value containing a "•" character is treated as unchanged by the server
 * (mask guard) - never round-trip a masked display value back in here.
 */
interface UpdatePaymentProviderRequest {
  provider: PaymentProviderName;
  isEnabled?: boolean;
  mode?: PaymentMode;
  currency?: string;
  minAmount?: number;
  maxAmount?: number;
  quickAmounts?: number[];
  paymentLinkExpiryHours?: number;
  webhookEvents?: string[];
  testKeyId?: string;
  testKeySecret?: string;
  testWebhookSecret?: string;
  liveKeyId?: string;
  liveKeySecret?: string;
  liveWebhookSecret?: string;
  /** Dynamic, provider-specific credential fields (e.g. CCAvenue). See semantics above. */
  credentials?: {
    test?: Record<string, string | null>;
    live?: Record<string, string | null>;
  };
}

interface TestConnectionResponse {
  ok: boolean;
  mode: PaymentMode;
  message: string;
  accountHint?: string;
  latencyMs?: number;
}

interface ActiveProviderResponse {
  enabled: boolean;
  provider: PaymentProviderName | null;
  mode: PaymentMode;
  keyId: string | null;
  currency: string;
  minAmount: number;
  maxAmount: number;
  quickAmounts: number[];
  /** Only meaningful when `enabled` is true. */
  returnFlow?: "CHECKOUT_MODAL" | "REDIRECT_POST";
  /** Null when the provider's implementation module isn't registered server-side. */
  supports?: {
    orders: boolean;
    paymentLinks: boolean;
    refunds: boolean;
  } | null;
}

/**
 * A single order blocking a provider enable/mode switch because it still
 * has an open (non-terminal) payment in the mode being vacated.
 */
interface BlockingOrderInfo {
  orderId: string;
  walletUserId: string;
  amount: number;
  status: string;
  createdAt: string;
}

/**
 * `error.details` shape for both:
 *   - 409 `PENDING_ORDERS_BLOCK_MODE_SWITCH` (existing TEST->LIVE mode switch guard)
 *   - 409 `PENDING_ORDERS_BLOCK_PROVIDER_SWITCH` (enabling a provider while
 *     another provider has open orders)
 */
interface PendingOrdersBlockDetails {
  total: number;
  blockingOrders: BlockingOrderInfo[];
}

// ===========================
// Self-serve top-up (checkout)
// ===========================

interface InitiatePaymentRequest {
  amount: number;
  currency?: string;
  idempotencyKey: string;
}

/**
 * How the client should complete checkout for this order.
 *   - MODAL: launch the provider's JS checkout modal with `params` (Razorpay).
 *   - REDIRECT_POST: submit a hidden form with `fields` via POST to `url`
 *     (CCAvenue). `url`/`fields` may be null alongside a populated `error`
 *     if order creation succeeded but the redirect payload could not be built.
 */
type InitiatePaymentCheckout =
  | {
      type: "MODAL";
      params: {
        key: string;
        order_id: string;
        /** Integer paise, per the gateway checkout SDK's own contract. */
        amount: number;
        currency: string;
      };
    }
  | {
      type: "REDIRECT_POST";
      url: string | null;
      fields: Record<string, string> | null;
      error?: string;
    };

interface InitiatePaymentResponse {
  orderId: string;
  providerOrderId: string;
  provider: PaymentProviderName;
  mode: PaymentMode;
  keyId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  status: PaymentOrderStatus;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  /** Discriminated on `type` - branch on it to decide modal vs redirect-post. */
  checkout: InitiatePaymentCheckout;
}

interface VerifyPaymentRequest {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface VerifyPaymentResponse {
  orderId: string;
  status: PaymentOrderStatus;
  verified: boolean;
  credited: boolean;
  balanceAfter?: number;
}

interface PaymentOrderStatusResponse {
  orderId: string;
  status: PaymentOrderStatus;
  amount: number;
  currency: string;
  isTest: boolean;
  externalTransactionId?: string;
  creditedAt?: string;
  reconcileError?: string;
  updatedAt: string;
}

interface GetMyTopupOrdersParams {
  page?: number;
  size?: number;
}

interface MyTopupOrdersResponse {
  pagination: Pagination;
  data: PaymentOrderStatusResponse[];
  success: boolean;
}

// ===========================
// Admin-generated payment links
// ===========================

interface CreatePaymentLinkRequest {
  walletUserId: string;
  clientCode?: string;
  subjectUserId?: string;
  amount: number;
  currency?: string;
  description?: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  expiryHours?: number;
  notes?: Record<string, unknown>;
}

interface PaymentLinkData {
  orderId: string;
  kind: string;
  provider: PaymentProviderName;
  mode: PaymentMode;
  providerLinkId: string;
  shortUrl: string;
  walletUserId: string;
  clientCode: string;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  uiStatus: PaymentLinkUiStatus;
  needsAttention?: boolean;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
  paidAt?: string;
}

interface GetPaymentLinksParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
  status?: string;
  clientCode?: string;
  walletUserId?: string;
}

interface PaymentLinksListResponse {
  pagination: Pagination;
  data: PaymentLinkData[];
  success: boolean;
  filters: Record<string, string>;
}

// ===========================
// Manual (offline) top-ups
// ===========================

interface CreateManualTopupRequest {
  /**
   * The EXTERNAL wallet identity (a phone number for outlets), not a portal
   * user UUID. Must be named `walletUserId`: the backend Joi schema
   * (validation/paymentSchema.js manualTopupSchema) runs with
   * stripUnknown:true, so a `userId` key is silently dropped and the request
   * then fails as "walletUserId is required".
   */
  walletUserId: string;
  clientCode?: string;
  /** Portal user UUID, when known. Audit linkage only. */
  subjectUserId?: string;
  amount: number;
  currency?: string;
  /** Mandatory safeguard, min 10 chars. */
  reason: string;
  /** Mandatory safeguard: bank UTR / cheque no / receipt no. Min 3 chars. */
  externalReference: string;
}

interface ManualTopupRequestData {
  id: string;
  walletUserId: string;
  clientCode: string;
  amount: number;
  currency: string;
  reason: string;
  externalReference: string;
  status: ManualTopupStatus;
  thresholdAtRequest: number;
  capAtRequest: number;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  creditedAt?: string;
}

interface GetManualTopupsParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
  status?: string;
  clientCode?: string;
  userId?: string;
}

interface ManualTopupsListResponse {
  pagination: Pagination;
  data: ManualTopupRequestData[];
  success: boolean;
  filters: Record<string, string>;
}

interface PendingApprovalsResponse {
  pagination: Pagination;
  data: ManualTopupRequestData[];
  success: boolean;
}

interface ReviewManualTopupRequest {
  id: string;
  /**
   * Approve: optional. Reject: REQUIRED, min 10 chars.
   * Must be named `reviewRemarks` — the backend Joi schemas
   * (validation/paymentSchema.js) run with stripUnknown:true, so any other
   * key is silently dropped and a reject then fails as "remarks required".
   */
  reviewRemarks?: string;
}

// ===========================
// Reconciliation
// ===========================

interface GetReconcileQueueParams {
  page?: number;
  size?: number;
}

interface ReconcileQueueResponse {
  pagination: Pagination;
  data: PaymentOrderStatusResponse[];
  success: boolean;
}

// ===========================
// RTK Query API Definition
// ===========================

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ---------------------------
    // Provider configuration
    // ---------------------------

    getPaymentProviders: builder.query<PaymentProviderConfig[], void>({
      query: () => "/api/v1/wallet/payment-providers",
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "PaymentProvider", id: "LIST" }],
    }),

    getPaymentProvider: builder.query<
      PaymentProviderConfig,
      PaymentProviderName
    >({
      query: (provider) => `/api/v1/wallet/payment-providers/${provider}`,
      transformResponse: (response: any) => response.data ?? response,
      providesTags: (result, error, provider) => [
        { type: "PaymentProvider", id: provider },
      ],
    }),

    updatePaymentProvider: builder.mutation<
      PaymentProviderConfig,
      UpdatePaymentProviderRequest
    >({
      query: ({ provider, ...body }) => ({
        url: `/api/v1/wallet/payment-providers/${provider}`,
        method: "PUT",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: (result, error, { provider }) => [
        { type: "PaymentProvider", id: "LIST" },
        { type: "PaymentProvider", id: provider },
        { type: "PaymentProvider", id: "ACTIVE" },
      ],
    }),

    testPaymentProvider: builder.mutation<
      TestConnectionResponse,
      PaymentProviderName
    >({
      query: (provider) => ({
        url: `/api/v1/wallet/payment-providers/${provider}/test-connection`,
        method: "POST",
      }),
      transformResponse: (response: any) => response.data ?? response,
      // Pure probe - it never mutates saved config, so nothing to invalidate.
    }),

    getTopupPolicy: builder.query<WalletTopupPolicy, void>({
      query: () => "/api/v1/wallet/payment-providers/policy",
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "PaymentProvider", id: "POLICY" }],
    }),

    updateTopupPolicy: builder.mutation<
      WalletTopupPolicy,
      Partial<WalletTopupPolicy>
    >({
      query: (body) => ({
        url: "/api/v1/wallet/payment-providers/policy",
        method: "PUT",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [{ type: "PaymentProvider", id: "POLICY" }],
    }),

    getActivePaymentProvider: builder.query<ActiveProviderResponse, void>({
      query: () => "/api/v1/wallet/payment-providers/active",
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "PaymentProvider", id: "ACTIVE" }],
    }),

    // ---------------------------
    // Self-serve top-up (checkout)
    // ---------------------------

    initiatePayment: builder.mutation<
      InitiatePaymentResponse,
      InitiatePaymentRequest
    >({
      query: (body) => ({
        url: "/api/v1/wallet/topup/self/initiate",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      // No cache to invalidate yet - the wallet only changes once verify succeeds.
    }),

    verifyPayment: builder.mutation<
      VerifyPaymentResponse,
      VerifyPaymentRequest
    >({
      query: (body) => ({
        url: "/api/v1/wallet/topup/self/verify",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "Wallet", id: "MY_WALLET" },
        { type: "Wallet", id: "MY_TRANSACTIONS" },
        { type: "Wallet", id: "MY_STATS" },
        { type: "Wallet", id: "LIST" },
        { type: "Wallet", id: "TRANSACTIONS" },
      ],
    }),

    getPaymentOrderStatus: builder.query<PaymentOrderStatusResponse, string>({
      query: (orderId) => `/api/v1/wallet/topup/orders/${orderId}`,
      transformResponse: (response: any) => response.data ?? response,
      providesTags: (result, error, orderId) => [
        { type: "PaymentGateway", id: orderId },
      ],
    }),

    getMyTopupOrders: builder.query<
      MyTopupOrdersResponse,
      GetMyTopupOrdersParams | void
    >({
      query: (arg) => {
        const params: GetMyTopupOrdersParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/self/orders",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "PaymentGateway", id: "MY_ORDERS" }],
    }),

    // ---------------------------
    // Admin-generated payment links
    // ---------------------------

    createPaymentLink: builder.mutation<
      PaymentLinkData,
      CreatePaymentLinkRequest
    >({
      query: (body) => ({
        url: "/api/v1/wallet/topup/admin/payment-links",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [{ type: "PaymentLink", id: "LIST" }],
    }),

    getPaymentLinks: builder.query<
      PaymentLinksListResponse,
      GetPaymentLinksParams | void
    >({
      query: (arg) => {
        const params: GetPaymentLinksParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/admin/payment-links",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "PaymentLink", id: "LIST" }],
    }),

    refreshPaymentLink: builder.mutation<PaymentLinkData, string>({
      query: (orderId) => ({
        url: `/api/v1/wallet/topup/admin/payment-links/${orderId}/refresh`,
        method: "POST",
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [{ type: "PaymentLink", id: "LIST" }],
    }),

    cancelPaymentLink: builder.mutation<PaymentLinkData, string>({
      query: (orderId) => ({
        url: `/api/v1/wallet/topup/admin/payment-links/${orderId}/cancel`,
        method: "POST",
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [{ type: "PaymentLink", id: "LIST" }],
    }),

    // ---------------------------
    // Manual (offline) top-ups
    // ---------------------------

    createManualTopup: builder.mutation<
      ManualTopupRequestData,
      CreateManualTopupRequest
    >({
      query: (body) => ({
        url: "/api/v1/wallet/topup/manual",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "TopupApproval", id: "LIST" },
        { type: "Wallet", id: "LIST" },
        { type: "Wallet", id: "TRANSACTIONS" },
      ],
    }),

    getManualTopups: builder.query<
      ManualTopupsListResponse,
      GetManualTopupsParams | void
    >({
      query: (arg) => {
        const params: GetManualTopupsParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/manual",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "TopupApproval", id: "LIST" }],
    }),

    getPendingApprovals: builder.query<PendingApprovalsResponse, void>({
      query: () => "/api/v1/wallet/topup/manual/pending",
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "TopupApproval", id: "PENDING" }],
    }),

    approveManualTopup: builder.mutation<
      ManualTopupRequestData,
      ReviewManualTopupRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/api/v1/wallet/topup/manual/${id}/approve`,
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "TopupApproval", id: "LIST" },
        { type: "TopupApproval", id: "PENDING" },
        { type: "Wallet", id: "LIST" },
        { type: "Wallet", id: "TRANSACTIONS" },
      ],
    }),

    rejectManualTopup: builder.mutation<
      ManualTopupRequestData,
      ReviewManualTopupRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/api/v1/wallet/topup/manual/${id}/reject`,
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "TopupApproval", id: "LIST" },
        { type: "TopupApproval", id: "PENDING" },
      ],
    }),

    // ---------------------------
    // Reconciliation
    // ---------------------------

    getReconcileQueue: builder.query<
      ReconcileQueueResponse,
      GetReconcileQueueParams | void
    >({
      query: (arg) => {
        const params: GetReconcileQueueParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/admin/reconcile-queue",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "PaymentGateway", id: "RECONCILE" }],
    }),

    retryReconcile: builder.mutation<PaymentOrderStatusResponse, string>({
      query: (orderId) => ({
        url: `/api/v1/wallet/topup/admin/orders/${orderId}/reconcile`,
        method: "POST",
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [{ type: "PaymentGateway", id: "RECONCILE" }],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useGetPaymentProvidersQuery,
  useGetPaymentProviderQuery,
  useUpdatePaymentProviderMutation,
  useTestPaymentProviderMutation,
  useGetTopupPolicyQuery,
  useUpdateTopupPolicyMutation,
  useGetActivePaymentProviderQuery,
  useInitiatePaymentMutation,
  useVerifyPaymentMutation,
  useGetPaymentOrderStatusQuery,
  useLazyGetPaymentOrderStatusQuery,
  useGetMyTopupOrdersQuery,
  useCreatePaymentLinkMutation,
  useGetPaymentLinksQuery,
  useRefreshPaymentLinkMutation,
  useCancelPaymentLinkMutation,
  useCreateManualTopupMutation,
  useGetManualTopupsQuery,
  useGetPendingApprovalsQuery,
  useApproveManualTopupMutation,
  useRejectManualTopupMutation,
  useGetReconcileQueueQuery,
  useRetryReconcileMutation,
} = paymentApi;

// ===========================
// Export Types
// ===========================

export type {
  Pagination,
  // Shared enums / value types
  PaymentProviderName,
  PaymentMode,
  PaymentOrderStatus,
  PaymentLinkUiStatus,
  ManualTopupStatus,
  // Provider configuration
  CredentialFieldDescriptor,
  CredentialFieldState,
  ProviderCredentialState,
  PaymentProviderConfig,
  WalletTopupPolicy,
  UpdatePaymentProviderRequest,
  TestConnectionResponse,
  ActiveProviderResponse,
  BlockingOrderInfo,
  PendingOrdersBlockDetails,
  // Self-serve top-up (checkout)
  InitiatePaymentCheckout,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  PaymentOrderStatusResponse,
  GetMyTopupOrdersParams,
  MyTopupOrdersResponse,
  // Admin-generated payment links
  CreatePaymentLinkRequest,
  PaymentLinkData,
  GetPaymentLinksParams,
  PaymentLinksListResponse,
  // Manual (offline) top-ups
  CreateManualTopupRequest,
  ManualTopupRequestData,
  GetManualTopupsParams,
  ManualTopupsListResponse,
  PendingApprovalsResponse,
  ReviewManualTopupRequest,
  // Reconciliation
  GetReconcileQueueParams,
  ReconcileQueueResponse,
};
