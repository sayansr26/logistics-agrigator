import { baseApi } from "../baseApi";

/**
 * Wallet Management API Endpoints
 *
 * All wallet endpoints route through API Gateway (port 3001)
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface GetClientWalletsParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
  userId?: string;
  minBalance?: number;
  maxBalance?: number;
  status?: string;
  clientCode?: string;
}

interface GetClientTransactionsParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
  type?: string;
  status?: string;
  userId?: string;
  clientCode?: string;
}

interface WalletData {
  id: number;
  user_id: string;
  client_code: string;
  balance: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TransactionData {
  id: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  referenceId: string;
  clientCode: string;
  description: string;
  metadata: string | null;
  remarks: string;
  status: string;
  createdAt: string;
  wallet_id: number;
  walletId: number;
  remarksAsMap: Record<string, unknown>;
  userId: string;
}

interface WalletStats {
  total_balance: number;
  active_balance: number;
  min_balance: number;
  max_balance: number;
  closed_wallets: number;
  suspended_wallets: number;
  total_wallets: number;
  blocked_wallets: number;
  active_wallets: number;
  average_balance: number;
}

interface TransactionStats {
  total_completed_amount: number;
  reversed_transactions: number;
  total_transactions: number;
  completed_transactions: number;
  total_debit_amount: number;
  cancelled_transactions: number;
  failed_transactions: number;
  total_refund_amount: number;
  pending_transactions: number;
  total_topup_amount: number;
}

interface Pagination {
  total_elements: number;
  has_previous: boolean;
  has_next: boolean;
  total_pages: number;
  current_page: number;
  page_size: number;
}

interface ClientWalletsResponse {
  pagination: Pagination;
  data: WalletData[];
  stats: WalletStats;
  success: boolean;
  filters: Record<string, string>;
}

interface ClientTransactionsResponse {
  pagination: Pagination;
  data: TransactionData[];
  stats: TransactionStats;
  success: boolean;
  filters: Record<string, string>;
}

interface WalletTransactionRequest {
  userId: string;
  clientCode?: string;
  amount: number;
  currency?: string;
  reference_id: string;
  description?: string;
  metadata?: string;
  remarks?: Record<string, unknown>;
  transaction_id?: number; // for refund only
}

interface GetWalletParams {
  userId: string;
  clientCode?: string;
}

interface UpdateUserStatusRequest {
  userId: string;
  status: string;
  clientCode?: string;
}

// ===========================
// Outlet (My) Wallet Interfaces
// ===========================

interface GetMyTransactionsParams {
  page?: number;
  size?: number;
}

interface MyWalletInfoResponse {
  success: boolean;
  data: {
    createdAt: string;
    wallet: {
      updatedAt: string;
      createdAt: string;
      currency: string;
      balance: number;
      id: number;
      status: string;
    };
    clientName: string;
    clientCode: string;
    id: number;
    userId: string;
    status: string;
    updatedAt: string;
  };
}

interface TypeStat {
  total_amount: number;
  percentage: number;
  count: number;
}

interface Last30Days {
  period_end: string;
  period_start: string;
  total_amount: number;
  breakdown_by_type: Record<string, { total_amount: number; count: number }>;
  generated_at: string;
  total_transactions: number;
}

// ===========================
// Dashboard types
// ===========================

export interface WalletDashboardParams {
  days?: number;
}

export interface WalletDashboardLowBalanceRow {
  id: string;
  userId: string;
  clientCode: string;
  balance: number;
  status: string;
}

export interface WalletDashboardSummaryResponse {
  status: string;
  data: {
    range: { days: number; since: string };
    wallets: {
      count: number;
      totalBalance: number;
      byStatus: Record<string, number>;
    };
    transactions: {
      topUpSum: number;
      debitSum: number;
      topUpTypes: string[];
      debitTypes: string[];
      countsByType: Record<string, number>;
      countsByStatus: Record<string, number>;
    };
    lowBalance: {
      threshold: number;
      count: number;
      wallets: WalletDashboardLowBalanceRow[];
    };
  };
}

export interface WalletDashboardTrendResponse {
  status: string;
  data: {
    range: { days: number; since: string };
    topUpTypes: string[];
    debitTypes: string[];
    series: Array<{ date: string; topUp: number; debit: number }>;
  };
}

interface MyStatisticsData {
  user_id: string;
  success: boolean;
  statistics: {
    fee_stats: TypeStat;
    generated_at: string;
    total_transactions: number;
    last_30_days: Last30Days;
    transfer_out_stats: TypeStat;
    debit_stats: TypeStat;
    top_up_stats: TypeStat;
    transfer_in_stats: TypeStat;
    refund_stats: TypeStat;
  };
}

interface MyTransactionsResponse {
  pagination: Pagination;
  data: TransactionData[];
  success: boolean;
  filters: Record<string, string>;
}

interface SyncWalletsRequest {
  userIds: string[];
  clientCode?: string;
}

interface SyncWalletsResponse {
  total: number;
  created: number;
  existing: number;
  failed: number;
  details: {
    created: string[];
    existing: string[];
    failed: { userId: string; error: string }[];
  };
}

// ===========================
// RTK Query API Definition
// ===========================

export const walletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get Client Wallets - Fetch list of wallets with pagination, filters, and stats
     */
    getClientWallets: builder.query<
      ClientWalletsResponse,
      GetClientWalletsParams | void
    >({
      query: (arg) => {
        const params: GetClientWalletsParams = arg || {};
        return {
          url: "/api/v1/wallet/admin/client-wallets",
          params,
        };
      },
      transformResponse: (response: any) => response.data || response,
      providesTags: [{ type: "Wallet", id: "LIST" }],
    }),

    /**
     * Get Client Transactions - Fetch list of transactions with pagination, filters, and stats
     */
    getClientTransactions: builder.query<
      ClientTransactionsResponse,
      GetClientTransactionsParams | void
    >({
      query: (arg) => {
        const params: GetClientTransactionsParams = arg || {};
        return {
          url: "/api/v1/wallet/admin/client-transactions",
          params,
        };
      },
      transformResponse: (response: any) => response.data || response,
      providesTags: [{ type: "Wallet", id: "TRANSACTIONS" }],
    }),

    /**
     * Get or Create Wallet - Fetch or create a wallet for a specific user
     */
    getOrCreateWallet: builder.query<any, GetWalletParams>({
      query: (params) => ({
        url: "/api/v1/wallet/admin/wallet",
        params,
      }),
      transformResponse: (response: any) => response.data || response,
      providesTags: (result, error, arg) => [
        { type: "Wallet", id: arg.userId },
      ],
    }),

    /**
     * Topup Wallet - Add funds to a user's wallet
     */
    topupWallet: builder.mutation<any, WalletTransactionRequest>({
      query: (body) => ({
        url: "/api/v1/wallet/admin/topup",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data || response,
      invalidatesTags: [
        { type: "Wallet", id: "LIST" },
        { type: "Wallet", id: "TRANSACTIONS" },
      ],
    }),

    /**
     * Debit Wallet - Deduct funds from a user's wallet
     */
    debitWallet: builder.mutation<any, WalletTransactionRequest>({
      query: (body) => ({
        url: "/api/v1/wallet/admin/debit",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data || response,
      invalidatesTags: [
        { type: "Wallet", id: "LIST" },
        { type: "Wallet", id: "TRANSACTIONS" },
      ],
    }),

    /**
     * Refund Wallet - Refund a transaction to a user's wallet
     */
    refundWallet: builder.mutation<any, WalletTransactionRequest>({
      query: (body) => ({
        url: "/api/v1/wallet/admin/refund",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data || response,
      invalidatesTags: [
        { type: "Wallet", id: "LIST" },
        { type: "Wallet", id: "TRANSACTIONS" },
      ],
    }),

    /**
     * Update Wallet User Status - Change the status of a user's wallet
     */
    updateWalletUserStatus: builder.mutation<any, UpdateUserStatusRequest>({
      query: (body) => ({
        url: "/api/v1/wallet/admin/user-status",
        method: "PATCH",
        body,
      }),
      transformResponse: (response: any) => response.data || response,
      invalidatesTags: [{ type: "Wallet", id: "LIST" }],
    }),

    /**
     * Sync Wallets - Batch create wallets for multiple users
     */
    syncWallets: builder.mutation<SyncWalletsResponse, SyncWalletsRequest>({
      query: (body) => ({
        url: "/api/v1/wallet/admin/sync-wallets",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data || response,
      invalidatesTags: [{ type: "Wallet", id: "LIST" }],
    }),

    // ===========================
    // Outlet (My) Wallet Endpoints
    // ===========================

    /**
     * Get My Wallet Info - Outlet user's own wallet info
     */
    getMyWalletInfo: builder.query<MyWalletInfoResponse, void>({
      query: () => "/api/v1/wallet/my/wallet-info",
      transformResponse: (response: any) => response.data || response,
      providesTags: [{ type: "Wallet", id: "MY_WALLET" }],
    }),

    /**
     * Get My Transactions - Outlet user's own transaction history
     */
    getMyTransactions: builder.query<
      MyTransactionsResponse,
      GetMyTransactionsParams | void
    >({
      query: (arg) => {
        const params: GetMyTransactionsParams = arg || {};
        return {
          url: "/api/v1/wallet/my/transactions",
          params,
        };
      },
      transformResponse: (response: any) => response.data || response,
      providesTags: [{ type: "Wallet", id: "MY_TRANSACTIONS" }],
    }),

    /**
     * Get My Statistics - Outlet user's own transaction statistics
     */
    getMyStatistics: builder.query<MyStatisticsData, void>({
      query: () => "/api/v1/wallet/my/statistics",
      transformResponse: (response: any) => response.data || response,
      providesTags: [{ type: "Wallet", id: "MY_STATS" }],
    }),

    // ===========================
    // Operations Dashboard
    // ===========================

    /** Wallet totals, top-up/debit sums, and low-balance list (scoped server-side). */
    getWalletDashboardSummary: builder.query<
      WalletDashboardSummaryResponse,
      WalletDashboardParams | void
    >({
      query: (arg) => {
        const days = arg ? arg.days : undefined;
        return {
          url: "/api/v1/wallet/dashboard/summary",
          params: days ? { days } : {},
        };
      },
      providesTags: [{ type: "Wallet", id: "DASHBOARD_SUMMARY" }],
    }),

    /** Daily top-up vs debit series for the wallet trend chart. */
    getWalletDashboardTrend: builder.query<
      WalletDashboardTrendResponse,
      WalletDashboardParams | void
    >({
      query: (arg) => {
        const days = arg ? arg.days : undefined;
        return {
          url: "/api/v1/wallet/dashboard/trend",
          params: days ? { days } : {},
        };
      },
      providesTags: [{ type: "Wallet", id: "DASHBOARD_TREND" }],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useGetClientWalletsQuery,
  useGetClientTransactionsQuery,
  useGetOrCreateWalletQuery,
  useTopupWalletMutation,
  useDebitWalletMutation,
  useRefundWalletMutation,
  useUpdateWalletUserStatusMutation,
  useSyncWalletsMutation,
  useLazyGetOrCreateWalletQuery,
  // Outlet (My) wallet hooks
  useGetMyWalletInfoQuery,
  useGetMyTransactionsQuery,
  useGetMyStatisticsQuery,
  // Dashboard
  useGetWalletDashboardSummaryQuery,
  useGetWalletDashboardTrendQuery,
} = walletApi;

// ===========================
// Export Types
// ===========================

export type {
  GetClientWalletsParams,
  GetClientTransactionsParams,
  WalletData,
  TransactionData,
  WalletStats,
  TransactionStats,
  Pagination,
  ClientWalletsResponse,
  ClientTransactionsResponse,
  WalletTransactionRequest,
  GetWalletParams,
  UpdateUserStatusRequest,
  SyncWalletsRequest,
  SyncWalletsResponse,
  // Outlet (My) wallet types
  GetMyTransactionsParams,
  MyWalletInfoResponse,
  MyStatisticsData,
  MyTransactionsResponse,
  TypeStat,
  Last30Days,
};
