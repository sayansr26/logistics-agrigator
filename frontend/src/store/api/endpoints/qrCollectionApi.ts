import { baseApi } from "../baseApi";
import type { Pagination } from "./walletApi";
import type { ManualTopupRequestData } from "./paymentApi";

/**
 * Static QR Collection API Endpoints
 *
 * Covers outlet-bound static UPI QR codes and the inbound bank-credit
 * "collections" reconciled against them. All endpoints route through the
 * wallet service via the API Gateway (port 3001), under
 * /api/v1/wallet/topup/qr/*.
 *
 * Shapes below are verified against `wallet-service/services/payments/
 * outletQrService.js` (`serializeQrCode`, `buildListWhere`) and
 * `qrCollectionService.js` (`serializeCollection`, `buildListWhere`), not just
 * the route/Joi layer, so response fields match what actually comes back.
 */

// ===========================
// Shared enums / value types
// ===========================

type QrCollectionStatus =
  | "UNATTRIBUTED"
  | "ASSIGN_PENDING"
  | "ATTRIBUTED"
  | "CREDIT_PENDING"
  | "CREDITED"
  | "REJECTED"
  | "IGNORED";

type QrCollectionSource = "WEBHOOK" | "IMPORT" | "MANUAL" | "POLL";

type QrDedupeStrategy = "UTR" | "CONTENT";

type QrUnattributedReason = "NO_QR_MATCH" | "INACTIVE_QR" | "NO_UTR";

type QrMode = "TEST" | "LIVE";

// ===========================
// Core entities
// ===========================

interface OutletPaymentQr {
  id: string;
  provider: string;
  walletUserId: string;
  clientCode: string;
  subjectUserId?: string | null;
  outletId?: string | null;
  outletName?: string | null;
  qrIdentifier?: string | null;
  vpa?: string | null;
  qrPayload?: string | null;
  qrImageUrl?: string | null;
  mode: QrMode;
  isActive: boolean;
  label?: string | null;
  maxPerCreditAmount?: number | null;
  maxPerDayAmount?: number | null;
  maxPerDayCount?: number | null;
  provisionedAt?: string | null;
  provisionedBy?: string | null;
  deactivatedAt?: string | null;
  deactivatedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QrCollection {
  id: string;
  provider: string;
  source: QrCollectionSource;
  status: QrCollectionStatus;
  utr?: string | null;
  /** `sha256(provider|utr)`, or a content hash when there is no UTR. */
  dedupeKey?: string;
  /**
   * DB column exists (`QrCollection.dedupeStrategy`), but the current
   * `serializeCollection()` projection does not include it in the API
   * response - treat as not-yet-wired-up rather than absent-on-this-row.
   */
  dedupeStrategy?: QrDedupeStrategy;
  /**
   * Same caveat as `dedupeStrategy`: the column exists (populated only while
   * `status === "UNATTRIBUTED"`) but is not currently serialized by the API.
   */
  unattributedReason?: QrUnattributedReason | null;
  /** Same caveat: DB-only for now, not in the current API projection. */
  deliveryCount?: number;
  providerTxnId?: string | null;
  qrIdentifier?: string | null;
  payerVpa?: string | null;
  payerName?: string | null;
  /** Rupees. */
  amount: number;
  amountPaise: number;
  currency: string;
  txnAt?: string | null;
  receivedAt: string;
  /** Non-null once matched to a registered outlet QR. */
  outletPaymentQrId?: string | null;
  /** `true` iff `outletPaymentQrId` is set. */
  matched?: boolean;
  walletUserId?: string | null;
  clientCode?: string | null;
  subjectUserId?: string | null;
  mode?: QrMode | null;
  paymentOrderId?: string | null;
  manualTopupRequestId?: string | null;
  externalReferenceId?: string | null;
  attributedBy?: string | null;
  attributedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  remarks?: string | null;
  lastError?: string | null;
  needsManualAction: boolean;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * List envelope every list endpoint returns INSIDE `data`. `pagination` uses
 * a 0-based `current_page`; query params are `page` (0-based, default 0) and
 * `size` (default 20, max 100).
 */
interface QrListEnvelope<T> {
  data: T[];
  pagination: Pagination;
  success: boolean;
  filters: Record<string, unknown>;
}

// ===========================
// Outlet QR - request/response shapes
// ===========================

interface CreateOutletQrRequest {
  walletUserId: string;
  clientCode?: string;
  subjectUserId?: string;
  outletId?: string;
  outletName?: string;
  provider?: string;
  /** At least one of `qrIdentifier` / `vpa` is required. */
  qrIdentifier?: string;
  vpa?: string;
  qrPayload?: string;
  qrImageUrl?: string;
  mode?: QrMode;
  label?: string;
  maxPerCreditAmount?: number;
  maxPerDayAmount?: number;
  maxPerDayCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Mutable subset only. `walletUserId` / `clientCode` / `subjectUserId` are
 * deliberately absent - the server rejects them with 409/400
 * `QR_REPOINT_FORBIDDEN`, so they must never be sent on update. At least one
 * field is required (server enforces `.min(1)`).
 */
interface UpdateOutletQrRequest {
  id: string;
  outletName?: string;
  qrPayload?: string;
  qrImageUrl?: string;
  mode?: QrMode;
  label?: string;
  maxPerCreditAmount?: number;
  maxPerDayAmount?: number;
  maxPerDayCount?: number;
}

interface GetOutletQrCodesParams {
  page?: number;
  size?: number;
  provider?: string;
  walletUserId?: string;
  clientCode?: string;
  outletId?: string;
  qrIdentifier?: string;
  vpa?: string;
  mode?: QrMode;
  isActive?: boolean;
  sortDir?: "asc" | "desc";
}

type OutletQrListResponse = QrListEnvelope<OutletPaymentQr>;

// ===========================
// QR Collections - request/response shapes
// ===========================

/**
 * Shared by GET /collections, /collections/unattributed, /collections/mine
 * (all three validate against the same query schema).
 *   - /unattributed forces `status = UNATTRIBUTED` server-side - any `status`
 *     sent here is ignored.
 *   - /mine forces `walletUserId` to the caller's own identity server-side -
 *     any `walletUserId` sent here is ignored.
 */
interface GetQrCollectionsParams {
  page?: number;
  size?: number;
  status?: QrCollectionStatus;
  source?: QrCollectionSource;
  provider?: string;
  qrIdentifier?: string;
  walletUserId?: string;
  utr?: string;
  needsManualAction?: boolean;
  startDate?: string;
  endDate?: string;
  sortDir?: "asc" | "desc";
}

type GetUnattributedQrCollectionsParams = Omit<
  GetQrCollectionsParams,
  "status"
>;
type GetMyQrCollectionsParams = Omit<GetQrCollectionsParams, "walletUserId">;

type QrCollectionListResponse = QrListEnvelope<QrCollection>;

/**
 * Manual collection entry.
 * `amount` is in RUPEES (not paise), max 2 decimals - a 3rd decimal is a 400
 * `INVALID_AMOUNT`. Exactly one of `qrIdentifier` / `walletUserId` must be
 * given (server resolves the outlet's active QR from `walletUserId` when
 * `qrIdentifier` is omitted). `remarks` min 5 chars.
 */
interface CreateManualQrCollectionRequest {
  utr: string;
  amount: number;
  qrIdentifier?: string;
  walletUserId?: string;
  payerVpa?: string;
  payerName?: string;
  txnAt?: string;
  providerTxnId?: string;
  provider?: string;
  remarks: string;
}

/**
 * 201 when newly recorded, 200 when `duplicate: true` (same UTR re-entered -
 * a no-op, never a second credit).
 */
interface CreateManualQrCollectionResponse {
  collection: QrCollection;
  duplicate: boolean;
  matched: boolean;
  status: QrCollectionStatus;
}

/** One already-parsed settlement row, in `ingestCollection` shape. */
interface QrImportRow {
  utr?: string | null;
  /** INTEGER PAISE - the caller has already done rupee-to-paise conversion. */
  amountPaise: number;
  qrIdentifier?: string | null;
  payerVpa?: string | null;
  payerName?: string | null;
  txnAt?: string | null;
  providerTxnId?: string | null;
}

interface ImportQrCollectionsRequest {
  rows: QrImportRow[];
  provider?: string;
  /** Resolves + dedupe-checks every row and WRITES NOTHING. */
  dryRun?: boolean;
}

interface ImportSuccessRow {
  utr: string | null;
  matched: boolean;
  status: QrCollectionStatus;
}

interface ImportDuplicateRow {
  utr: string | null;
  existingId: string | null;
}

interface ImportFailedRow {
  index: number;
  utr: string | null;
  error: string;
}

interface ImportQrCollectionsResponse {
  total: number;
  successCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  failureCount: number;
  successful: ImportSuccessRow[];
  duplicates: ImportDuplicateRow[];
  failed: ImportFailedRow[];
  dryRun: boolean;
}

interface ImportQrCollectionsCsvRequest {
  /** Raw CSV text, max 5MB. */
  csv: string;
  provider?: string;
  dryRun?: boolean;
}

interface QrCsvParseError {
  line: number;
  error: string;
}

/**
 * `errors` merges parse-time and import-time failures - branch on `scope`
 * ("PARSE" | "IMPORT") to route each entry to the right place in the UI.
 * `failureCount`/`total` still refer only to rows that reached the importer
 * (i.e. after parsing) - `parseErrorCount`/`parsedRows` are the parse-side
 * counters.
 */
interface ImportQrCollectionsCsvResponse extends ImportQrCollectionsResponse {
  parsedRows: number;
  parseErrorCount: number;
  parseErrors: QrCsvParseError[];
  errors: Array<
    | { scope: "PARSE"; line: number; error: string }
    | { scope: "IMPORT"; index: number; utr: string | null; error: string }
  >;
}

/**
 * `reason` (min 10 chars) is mandatory. Amount comes from the collection row
 * itself, never from this payload. `outletPaymentQrId` only records which QR
 * this payment is read as - it never creates or repoints an OutletPaymentQr
 * row.
 */
interface AssignQrCollectionRequest {
  id: string;
  walletUserId: string;
  clientCode?: string;
  subjectUserId?: string;
  outletPaymentQrId?: string;
  reason: string;
}

/**
 * 200 -> `credited: true`, collection moved to CREDITED immediately.
 * 202 -> `requiresApproval: true`, `manualTopupRequest` holds the parked
 * PENDING_APPROVAL request; collection stays ASSIGN_PENDING until reviewed.
 * Branch on `requiresApproval` (or the HTTP status) to tell the two apart.
 */
interface AssignQrCollectionResponse {
  collection: QrCollection;
  /** Non-null only when `requiresApproval` is true. */
  manualTopupRequest: ManualTopupRequestData | null;
  credited: boolean;
  requiresApproval: boolean;
  status: QrCollectionStatus;
  requestId: string;
  threshold: number | null;
}

/** `remarks` (min 10 chars) is mandatory. Never credits - superadmin only. */
interface RejectQrCollectionRequest {
  id: string;
  remarks: string;
}

interface RejectQrCollectionResponse {
  collection: QrCollection;
  status: "REJECTED";
  remarks: string;
}

// ===========================
// RTK Query API Definition
// ===========================

/**
 * Notable error codes to branch UI behaviour on:
 *   - 409 QR_COLLECTION_NOT_ASSIGNABLE       - collection isn't UNATTRIBUTED any more
 *   - 409 QR_COLLECTION_ALREADY_ASSIGNED     - already linked to a request
 *   - 409 QR_COLLECTION_HAS_PENDING_REQUEST  - reject the linked manual-topup request first
 *   - 422 MANUAL_TOPUP_CAP_EXCEEDED / MANUAL_TOPUP_DAILY_CAP_EXCEEDED / ASSIGN_REASON_REQUIRED
 *   - 403 SUPERADMIN_REQUIRED                - reject is superadmin-only (wallet:approve:all)
 *   - 409 QR_IDENTIFIER_ALREADY_ACTIVE       - another active QR already owns this identifier/VPA
 *   - 400 QR_REPOINT_FORBIDDEN               - attempted to change walletUserId/clientCode/subjectUserId on update
 *   - 400 QR_UNRESOLVED                      - manual collection has no qrIdentifier and the outlet has no ACTIVE QR
 *   - 400 INVALID_AMOUNT                     - manual collection amount isn't a clean <=2dp rupee value
 *   - 400 CSV_NO_ROWS                        - import-csv payload had no parseable rows
 *   - 422 REJECT_REMARKS_REQUIRED            - reject remarks missing/too short
 */
export const qrCollectionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ---------------------------
    // Outlet QR codes
    // ---------------------------

    createOutletQr: builder.mutation<OutletPaymentQr, CreateOutletQrRequest>({
      query: (body) => ({
        url: "/api/v1/wallet/topup/qr/codes",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [{ type: "OutletQr", id: "LIST" }],
    }),

    getOutletQrCodes: builder.query<
      OutletQrListResponse,
      GetOutletQrCodesParams | void
    >({
      query: (arg) => {
        const params: GetOutletQrCodesParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/qr/codes",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "OutletQr", id: "LIST" }],
    }),

    /** The caller's own ACTIVE QR (identity from the JWT). 404 if none provisioned. */
    getMyOutletQr: builder.query<OutletPaymentQr, void>({
      query: () => "/api/v1/wallet/topup/qr/codes/mine",
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "OutletQr", id: "MINE" }],
    }),

    updateOutletQr: builder.mutation<OutletPaymentQr, UpdateOutletQrRequest>({
      query: ({ id, ...body }) => ({
        url: `/api/v1/wallet/topup/qr/codes/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "OutletQr", id: "LIST" },
        { type: "OutletQr", id: "MINE" },
      ],
    }),

    /** Idempotent - deactivating an already-inactive QR just returns it unchanged. */
    deactivateOutletQr: builder.mutation<OutletPaymentQr, string>({
      query: (id) => ({
        url: `/api/v1/wallet/topup/qr/codes/${id}/deactivate`,
        method: "POST",
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "OutletQr", id: "LIST" },
        { type: "OutletQr", id: "MINE" },
      ],
    }),

    // ---------------------------
    // QR collections
    // ---------------------------

    getQrCollections: builder.query<
      QrCollectionListResponse,
      GetQrCollectionsParams | void
    >({
      query: (arg) => {
        const params: GetQrCollectionsParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/qr/collections",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "QrCollection", id: "LIST" }],
    }),

    /** The ops queue - always `status = UNATTRIBUTED`, regardless of `status` passed in. */
    getUnattributedQrCollections: builder.query<
      QrCollectionListResponse,
      GetUnattributedQrCollectionsParams | void
    >({
      query: (arg) => {
        const params: GetUnattributedQrCollectionsParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/qr/collections/unattributed",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "QrCollection", id: "UNATTRIBUTED" }],
    }),

    /** Same as getQrCollections, scoped to the caller's own wallet identity. */
    getMyQrCollections: builder.query<
      QrCollectionListResponse,
      GetMyQrCollectionsParams | void
    >({
      query: (arg) => {
        const params: GetMyQrCollectionsParams = arg || {};
        return {
          url: "/api/v1/wallet/topup/qr/collections/mine",
          params,
        };
      },
      transformResponse: (response: any) => response.data ?? response,
      providesTags: [{ type: "QrCollection", id: "MINE" }],
    }),

    createManualQrCollection: builder.mutation<
      CreateManualQrCollectionResponse,
      CreateManualQrCollectionRequest
    >({
      query: (body) => ({
        url: "/api/v1/wallet/topup/qr/collections/manual",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "QrCollection", id: "LIST" },
        { type: "QrCollection", id: "UNATTRIBUTED" },
      ],
    }),

    /** Bulk ingest of already-parsed rows (`amountPaise` integer paise). */
    importQrCollections: builder.mutation<
      ImportQrCollectionsResponse,
      ImportQrCollectionsRequest
    >({
      query: (body) => ({
        url: "/api/v1/wallet/topup/qr/collections/import",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: (result, error, { dryRun }) =>
        dryRun
          ? []
          : [
              { type: "QrCollection", id: "LIST" },
              { type: "QrCollection", id: "UNATTRIBUTED" },
            ],
    }),

    importQrCollectionsCsv: builder.mutation<
      ImportQrCollectionsCsvResponse,
      ImportQrCollectionsCsvRequest
    >({
      query: (body) => ({
        url: "/api/v1/wallet/topup/qr/collections/import-csv",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      // Dry runs never write anything - don't bust the cache for them.
      invalidatesTags: (result, error, { dryRun }) =>
        dryRun
          ? []
          : [
              { type: "QrCollection", id: "LIST" },
              { type: "QrCollection", id: "UNATTRIBUTED" },
            ],
    }),

    assignQrCollection: builder.mutation<
      AssignQrCollectionResponse,
      AssignQrCollectionRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/api/v1/wallet/topup/qr/collections/${id}/assign`,
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "QrCollection", id: "LIST" },
        { type: "QrCollection", id: "UNATTRIBUTED" },
        { type: "TopupApproval", id: "LIST" },
        { type: "Wallet", id: "LIST" },
      ],
    }),

    rejectQrCollection: builder.mutation<
      RejectQrCollectionResponse,
      RejectQrCollectionRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/api/v1/wallet/topup/qr/collections/${id}/reject`,
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data ?? response,
      invalidatesTags: [
        { type: "QrCollection", id: "LIST" },
        { type: "QrCollection", id: "UNATTRIBUTED" },
      ],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useCreateOutletQrMutation,
  useGetOutletQrCodesQuery,
  useGetMyOutletQrQuery,
  useUpdateOutletQrMutation,
  useDeactivateOutletQrMutation,
  useGetQrCollectionsQuery,
  useGetUnattributedQrCollectionsQuery,
  useGetMyQrCollectionsQuery,
  useCreateManualQrCollectionMutation,
  useImportQrCollectionsMutation,
  useImportQrCollectionsCsvMutation,
  useAssignQrCollectionMutation,
  useRejectQrCollectionMutation,
} = qrCollectionApi;

// ===========================
// Export Types
// ===========================

export type {
  // Shared enums / value types
  QrCollectionStatus,
  QrCollectionSource,
  QrDedupeStrategy,
  QrUnattributedReason,
  QrMode,
  // Core entities
  OutletPaymentQr,
  QrCollection,
  QrListEnvelope,
  // Outlet QR
  CreateOutletQrRequest,
  UpdateOutletQrRequest,
  GetOutletQrCodesParams,
  OutletQrListResponse,
  // QR collections
  GetQrCollectionsParams,
  GetUnattributedQrCollectionsParams,
  GetMyQrCollectionsParams,
  QrCollectionListResponse,
  CreateManualQrCollectionRequest,
  CreateManualQrCollectionResponse,
  QrImportRow,
  ImportSuccessRow,
  ImportDuplicateRow,
  ImportFailedRow,
  ImportQrCollectionsRequest,
  ImportQrCollectionsResponse,
  ImportQrCollectionsCsvRequest,
  QrCsvParseError,
  ImportQrCollectionsCsvResponse,
  AssignQrCollectionRequest,
  AssignQrCollectionResponse,
  RejectQrCollectionRequest,
  RejectQrCollectionResponse,
};
