import { baseApi } from "../baseApi";

/**
 * Shipment Management API Endpoints
 *
 * All shipment endpoints route through API Gateway (port 3001)
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface AddressPayload {
  name: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

// ===========================
// Bulk upload types
// ===========================

export type BulkJobStatus =
  "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface BulkJob {
  id: string;
  type: string;
  status: BulkJobStatus;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  fileName: string | null;
  fileSize: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  processingTimeMs: number | null;
  createdById: string;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetBulkJobsParams {
  page?: number;
  limit?: number;
  status?: BulkJobStatus;
  search?: string;
}

export interface BulkJobsResponse {
  status: string;
  data: {
    jobs: BulkJob[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    summary: {
      totalJobs: number;
      successful: number;
      failed: number;
      inProgress: number;
      statusCounts: Record<string, number>;
    };
  };
}

export interface BulkJobDetailResponse {
  status: string;
  data: {
    job: BulkJob;
    liveStatus: {
      status?: string;
      total?: number;
      processed?: number;
      successful?: number;
      failed?: number;
      errors?: unknown[];
    } | null;
  };
}

export interface BulkUploadRowResult {
  index: number;
  orderId: string | null;
  error?: string;
  shipmentId?: string;
  awbNumber?: string;
}

export interface BulkUploadResponse {
  status: string;
  data: {
    jobId: string;
    fileName: string;
    total: number;
    successful: BulkUploadRowResult[];
    failed: BulkUploadRowResult[];
    summary: {
      successCount: number;
      failureCount: number;
      parseErrorCount: number;
      processingTime: number;
    };
  };
}

// ===========================
// NDR types
// ===========================

/** Matches the NDRStatus enum in shipment-service prisma schema */
export type NDRStatusValue =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "REATTEMPT_SCHEDULED"
  | "ADDRESS_UPDATED"
  | "RTO_INITIATED"
  | "RESOLVED"
  | "CLOSED";

export type NDRPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type NDRReasonCode =
  | "ADDRESS_INCORRECT"
  | "CONSIGNEE_UNAVAILABLE"
  | "REFUSED_BY_CONSIGNEE"
  | "DAMAGE_DURING_TRANSIT"
  | "OTHER";

export type NDRActionType =
  "REATTEMPT_DELIVERY" | "RETURN_TO_ORIGIN" | "MARK_RESOLVED";

export interface NDRCase {
  id: string;
  shipmentId: string;
  reason: string;
  description: string | null;
  status: NDRStatusValue;
  priority: NDRPriority;
  deliveryAttemptDate: string;
  customerFeedback: string | null;
  deliveryPersonNotes: string | null;
  reattemptRequested: boolean;
  reattemptDate: string | null;
  preferredReattemptDate: string | null;
  assignedToId: string | null;
  createdById: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  shipment?: {
    id: string;
    orderId: string;
    awbNumber: string | null;
    deliveryName: string;
    deliveryPhone: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryPincode: string;
    partnerName: string | null;
    paymentType: string;
    totalCost: number | null;
  };
}

export interface GetNDRCasesParams {
  page?: number;
  limit?: number;
  status?: NDRStatusValue;
  priority?: NDRPriority;
  reason?: string;
  shipmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface NDRCasesResponse {
  status: string;
  data: {
    ndrCases: NDRCase[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    summary: {
      statusDistribution: { status: NDRStatusValue; count: number }[];
      reasonDistribution: { reason: string; count: number }[];
      priorityDistribution: { priority: NDRPriority; count: number }[];
    };
  };
}

export interface NDRActionRequest {
  action: NDRActionType;
  notes?: string;
  preferredDate?: string;
}

export interface CreateNDRCaseRequest {
  reason: NDRReasonCode;
  description?: string;
  priority?: NDRPriority;
}

interface InvoicePayload {
  eWayBillNo?: string;
  invoiceNo: string;
  invoiceAmt: number;
  invoiceDate: string;
  attachmentUrl?: string;
}

interface BoxPayload {
  boxNumber: number;
  length: number;
  width: number;
  height: number;
}

type ShipmentBookingStatus =
  "UNASSIGNED" | "PENDING" | "PENDING_BOOKING" | "BOOKED" | string;

interface CreateShipmentRequest {
  orderId: string;
  shipmentType?: "B2B" | "B2C";
  shipmentDirection?: "FORWARD" | "REVERSE";
  outletId?: string;
  outletUserId?: string;
  pickupAddressId?: string;
  pickupLocation?: string;
  pickupAddress: AddressPayload;
  deliveryAddress: AddressPayload;
  rtoSameAsPickup?: boolean;
  rtoAddress?: AddressPayload;
  productDescription?: string;
  hsnCode?: string;
  gstPercentage?: number;
  packageDetails: {
    weight: number;
    dimensions: { length: number; width: number; height: number };
    description?: string;
    value?: number;
    fragile?: boolean;
  };
  numberOfBoxes?: number;
  boxes?: BoxPayload[];
  invoices?: InvoicePayload[];
  paymentType?: "PREPAID" | "COD";
  codAmount?: number;
  serviceType?: "STANDARD" | "EXPRESS" | "ECONOMY";
  specialInstructions?: string;
  selectedPartnerId?: string;
  quoteSnapshot?: PartnerQuote;
}

interface ShipmentQuoteRequest {
  fromPincode: string;
  toPincode: string;
  weight: number;
  numberOfBoxes?: number;
  dimensions: { length: number; width: number; height: number };
  serviceType?: "STANDARD" | "EXPRESS" | "ECONOMY";
  paymentType?: "PREPAID" | "COD";
  codAmount?: number;
  shipmentType?: "B2B" | "B2C";
  declaredValue?: number;
  isFragile?: boolean;
  outletId?: string;
  sortBy?: "cheapest" | "highest";
}

interface PartnerQuote {
  partnerId: string;
  partnerName: string;
  totalAmount: number;
  deliveryDays: number | null;
  chargeBreakdown?: Array<{
    name: string;
    amount: number;
    type?: string | null;
    calculation?: string | null;
  }>;
  discount?: {
    packageId: string;
    packageName: string;
    badge: string;
    originalTotal: number;
    totalDiscount: number;
    finalTotal: number;
  } | null;
  volumetricDivisor: number;
  volumetricWeight: number;
  chargeableWeight: number;
  actualWeight: number;
  serviceable: boolean;
}

interface ShipmentQuotesResponse {
  status: string;
  message: string;
  data: {
    quotes: PartnerQuote[];
    recommended: PartnerQuote | null;
    params: ShipmentQuoteRequest;
  };
}

interface RerateShipmentRequest {
  disputedWeight?: number;
  disputedLength?: number;
  disputedWidth?: number;
  disputedHeight?: number;
  reason: string;
  codAction?: "DEDUCT_WALLET" | "UPDATE_COD";
}

interface UpdateShipmentRequest {
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  paymentMode?: "prepaid" | "cod";
  codAmount?: number;
  shipmentValue?: number;
  description?: string;
  isFragile?: boolean;
  status?: string;
  specialInstructions?: string;
  estimatedDelivery?: string;
}

interface RetryCourierBookingRequest {
  id: string;
  pickupLocation?: string;
}

interface AssignPartnerRequest {
  id: string;
  partnerId: string;
  quoteSnapshot: PartnerQuote;
  pickupLocation?: string;
}

interface RetryCourierBookingResponse {
  status: string;
  data: {
    shipmentId: string;
    orderId: string;
    awbNumber: string;
    trackingUrl?: string;
    courierBooking: unknown;
  };
  meta?: Record<string, unknown>;
  statusCode?: number;
}

interface ProviderAction {
  action: string;
  description: string;
  enabled: boolean;
  reason?: string | null;
}

interface ProviderCapabilities {
  success: boolean;
  providerName: string;
  aggregatorType: string;
  capabilities: Record<
    string,
    {
      supported: boolean;
      requiresAwb: boolean;
      description: string;
      allowedStatuses?: string[];
    }
  >;
  availableActions: ProviderAction[];
}

interface ShipmentDocument {
  id: string;
  type: string;
  name: string;
  url?: string | null;
  format?: string | null;
  source: string;
  fetchedAt?: string | null;
  createdAt: string;
}

interface Shipment {
  id: string;
  orderId: string;
  outletId?: string;
  shipmentType?: string;
  awbNumber?: string;
  clientId?: string;
  partnerId?: string;
  partnerName?: string;
  status: string;
  bookingStatus?: ShipmentBookingStatus;
  paymentType?: string;
  paymentStatus?: string;
  codAmount?: number;
  totalCost: number;
  currency?: string;
  serviceType?: string;
  weight?: number;
  chargeableWeight?: number;
  volumetricWeight?: number;
  estimatedDelivery?: string;
  actualDelivery?: string;
  disputeStatus?: string;
  holdReason?: string;
  createdAt: string;
  updatedAt?: string;

  // Pickup address (list + detail)
  pickupName?: string;
  pickupPhone?: string;
  pickupEmail?: string;
  pickupLine1?: string;
  pickupLine2?: string;
  pickupLandmark?: string;
  pickupCity?: string;
  pickupState?: string;
  pickupPincode?: string;
  pickupCountry?: string;
  pickupAddressId?: string;

  // Delivery address (list + detail)
  deliveryName?: string;
  deliveryPhone?: string;
  deliveryEmail?: string;
  deliveryLine1?: string;
  deliveryLine2?: string;
  deliveryLandmark?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPincode?: string;
  deliveryCountry?: string;

  // Package (detail only)
  numberOfBoxes?: number;
  length?: number;
  width?: number;
  height?: number;
  description?: string;
  value?: number;
  fragile?: boolean;
  specialInstructions?: string;

  // Partner (detail only)
  partnerShipmentId?: string;
  trackingUrl?: string;
  quoteSnapshot?: Record<string, unknown>;

  // Wallet (detail only)
  walletTransactionId?: string;
  paymentReference?: string;
  refundTransactionId?: string;
  refundAmount?: number;

  // Dispute (detail only)
  disputedWeight?: number;
  disputedLength?: number;
  disputedWidth?: number;
  disputedHeight?: number;
  disputedCost?: number;

  // Dates (detail only)
  estimatedPickup?: string;
  actualPickup?: string;
  cancelledAt?: string;
  cancellationReason?: string;

  // Relations (detail only)
  trackingEvents?: TrackingEvent[];
  documents?: ShipmentDocument[];

  // Provider lifecycle fields
  providerStatus?: string | null;
  providerLastSyncAt?: string | null;
  courierLabelUrl?: string | null;
  courierLabelFormat?: string | null;
  pickupRequestId?: string | null;
  pickupRequestedAt?: string | null;
}

interface ShipmentResponse {
  status: string;
  message: string;
  data: {
    shipment: Shipment;
    providerCapabilities?: ProviderCapabilities | null;
  };
}

interface ShipmentMutationResponse {
  status: string;
  message: string;
  data: {
    shipment: Shipment;
    courierBooking?: {
      awbNumber?: string;
      trackingUrl?: string | null;
      booked: boolean;
      message?: string;
    };
  };
}

interface RefreshFromProviderResponse {
  status: string;
  data: {
    shipmentId: string;
    awbNumber: string;
    previousStatus: string;
    currentStatus: string;
    syncedAt: string;
    trackingData: unknown;
  };
  meta?: Record<string, unknown>;
}

interface FetchCourierLabelResponse {
  status: string;
  data: {
    shipmentId: string;
    awbNumber: string;
    label: {
      data: string | null;
      format: string;
    };
  };
  meta?: Record<string, unknown>;
}

interface CancelWithProviderResponse {
  status: string;
  data: {
    shipmentId: string;
    orderId: string;
    status: string;
    providerCancelled: boolean;
    providerCancelResult: unknown;
  };
  meta?: Record<string, unknown>;
}

interface ShipmentsListResponse {
  status: string;
  message: string;
  data: {
    shipments: Shipment[];
    pagination?: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

interface TrackingEvent {
  id: string;
  shipmentId?: string;
  status: string;
  location?: string;
  message?: string;
  description?: string;
  source?: string;
  timestamp: string;
}

interface TrackingResponse {
  status: string;
  message: string;
  data: {
    shipment: Shipment & { trackingEvents: TrackingEvent[] };
  };
}

interface BulkShipmentRequest {
  shipments: CreateShipmentRequest[];
}

interface BulkShipmentResponse {
  status: string;
  message: string;
  data: {
    success: Shipment[];
    failed: Array<{
      index: number;
      error: string;
      data: CreateShipmentRequest;
    }>;
  };
}

interface PickupRequest {
  shipmentIds: string[];
  pickupDate: string;
  pickupTimeSlot: string;
  pickupAddress?: {
    name: string;
    phone: string;
    address: string;
    pincode: string;
    city: string;
    state: string;
  };
}

interface PickupResponse {
  status: string;
  message: string;
  data: {
    pickupId: string;
    pickupDate: string;
    pickupTimeSlot: string;
    shipmentIds: string[];
  };
}

interface GetShipmentsParams {
  page?: number;
  limit?: number;
  status?: string;
  partnerId?: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ===========================
// RTK Query API Definition
// ===========================

export const shipmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Create Shipment - Create a new shipment
     */
    createShipment: builder.mutation<
      ShipmentMutationResponse,
      CreateShipmentRequest
    >({
      query: (shipmentData) => ({
        url: "/api/v1/shipments",
        method: "POST",
        body: shipmentData,
      }),
      invalidatesTags: ["Shipment"],
    }),

    assignPartner: builder.mutation<
      ShipmentMutationResponse,
      AssignPartnerRequest
    >({
      query: ({ id, ...data }) => ({
        url: `/api/v1/shipments/${id}/assign-partner`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Shipment", id },
        { type: "Shipment", id: "LIST" },
      ],
    }),

    /**
     * Get Shipments - Fetch list of shipments with pagination and filters
     */
    getShipments: builder.query<
      ShipmentsListResponse,
      GetShipmentsParams | void
    >({
      query: (arg) => {
        const params: GetShipmentsParams = arg || {};
        return {
          url: "/api/v1/shipments",
          params,
        };
      },
      providesTags: (result) =>
        result?.data?.shipments
          ? [
              ...result.data.shipments.map(({ id }) => ({
                type: "Shipment" as const,
                id,
              })),
              { type: "Shipment", id: "LIST" },
            ]
          : [{ type: "Shipment", id: "LIST" }],
    }),

    /**
     * Get Shipment by ID - Fetch single shipment details
     */
    getShipmentById: builder.query<ShipmentResponse, string>({
      query: (shipmentId) => `/api/v1/shipments/${shipmentId}`,
      providesTags: (result, error, id) => [{ type: "Shipment", id }],
    }),

    /**
     * Update Shipment - Update shipment information
     */
    updateShipment: builder.mutation<
      ShipmentResponse,
      { id: string; data: UpdateShipmentRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/shipments/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Shipment", id },
        { type: "Shipment", id: "LIST" },
      ],
    }),

    /**
     * Cancel Shipment - Cancel a shipment
     */
    cancelShipment: builder.mutation<ShipmentResponse, string>({
      query: (shipmentId) => ({
        url: `/api/v1/shipments/${shipmentId}/cancel`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Shipment", id },
        { type: "Shipment", id: "LIST" },
      ],
    }),

    /**
     * Retry Courier Booking - Re-attempt booking for shipments pending AWB
     */
    retryCourierBooking: builder.mutation<
      RetryCourierBookingResponse,
      RetryCourierBookingRequest
    >({
      query: ({ id, pickupLocation }) => ({
        url: `/api/v1/shipments/${id}/retry-booking`,
        method: "POST",
        body: pickupLocation ? { pickupLocation } : {},
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Shipment", id },
        { type: "Shipment", id: "LIST" },
      ],
    }),

    /**
     * Track Shipment - Get tracking information for a shipment
     */
    trackShipment: builder.query<TrackingResponse, string>({
      query: (shipmentId) => `/api/v1/shipments/${shipmentId}/tracking`,
      providesTags: (result, error, id) => [{ type: "Shipment", id }],
    }),

    /**
     * Bulk Create Shipments - Create multiple shipments at once
     */
    bulkCreateShipments: builder.mutation<
      BulkShipmentResponse,
      BulkShipmentRequest
    >({
      query: (bulkData) => ({
        url: "/api/v1/shipments/bulk",
        method: "POST",
        body: bulkData,
      }),
      invalidatesTags: [{ type: "Shipment", id: "LIST" }],
    }),

    /**
     * Schedule Pickup - Schedule pickup for shipments
     */
    schedulePickup: builder.mutation<PickupResponse, PickupRequest>({
      query: (pickupData) => ({
        url: "/api/v1/shipments/pickup",
        method: "POST",
        body: pickupData,
      }),
      invalidatesTags: (result, error, { shipmentIds }) =>
        shipmentIds.map((id) => ({ type: "Shipment" as const, id })),
    }),

    /**
     * Get Pickup Slots - Get available pickup time slots
     */
    getPickupSlots: builder.query<
      { status: string; data: { slots: string[] } },
      { pincode: string; date: string }
    >({
      query: ({ pincode, date }) => ({
        url: "/api/v1/shipments/pickup/slots",
        params: { pincode, date },
      }),
    }),

    /**
     * Download Label - Download shipping label for a shipment
     */
    downloadLabel: builder.mutation<Blob, string>({
      query: (shipmentId) => ({
        url: `/api/v1/shipments/${shipmentId}/label`,
        method: "GET",
        responseHandler: (response) => response.blob(),
      }),
    }),

    /**
     * Get Shipment Quotes - Fetch partner quotes for staged creation flow
     */
    getShipmentQuotes: builder.mutation<
      ShipmentQuotesResponse,
      ShipmentQuoteRequest
    >({
      query: (quoteData) => ({
        url: "/api/v1/shipments/quotes",
        method: "POST",
        body: quoteData,
      }),
    }),

    /**
     * Rerate Shipment - Dispute re-rate with courier-validated dimensions
     */
    rerateShipment: builder.mutation<
      ShipmentResponse,
      { id: string; data: RerateShipmentRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/v1/shipments/${id}/rerate`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Shipment", id },
        { type: "Shipment", id: "LIST" },
      ],
    }),

    /**
     * Refresh From Provider - Fetch latest status from courier
     */
    refreshFromProvider: builder.mutation<RefreshFromProviderResponse, string>({
      query: (shipmentId) => ({
        url: `/api/v1/shipments/${shipmentId}/refresh`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [{ type: "Shipment", id }],
    }),

    /**
     * Fetch Courier Label - Get label from courier provider
     */
    fetchCourierLabel: builder.mutation<
      FetchCourierLabelResponse,
      { id: string; format?: string }
    >({
      query: ({ id, format = "pdf" }) => ({
        url: `/api/v1/shipments/${id}/courier-label`,
        method: "POST",
        body: { format },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Shipment", id }],
    }),

    /**
     * Cancel With Provider - Cancel via courier first, then internally
     */
    cancelWithProvider: builder.mutation<
      CancelWithProviderResponse,
      { id: string; reason?: string }
    >({
      query: ({ id, reason }) => ({
        url: `/api/v1/shipments/${id}/cancel-with-provider`,
        method: "POST",
        body: reason ? { reason } : {},
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Shipment", id },
        { type: "Shipment", id: "LIST" },
      ],
    }),

    /**
     * Get Shipment Documents
     */
    getShipmentDocuments: builder.query<
      { status: string; data: { documents: ShipmentDocument[] } },
      string
    >({
      query: (shipmentId) => `/api/v1/shipments/${shipmentId}/documents`,
      providesTags: (result, error, id) => [{ type: "Shipment", id }],
    }),

    // ===========================
    // Bulk Upload (jobs & history)
    // ===========================

    /**
     * List bulk upload jobs (upload history) with summary counts
     */
    getBulkJobs: builder.query<BulkJobsResponse, GetBulkJobsParams | void>({
      query: (params) => {
        const search = new URLSearchParams();
        if (params?.page) search.append("page", String(params.page));
        if (params?.limit) search.append("limit", String(params.limit));
        if (params?.status) search.append("status", params.status);
        if (params?.search) search.append("search", params.search);

        const qs = search.toString();
        return `/api/v1/shipments/bulk/jobs${qs ? `?${qs}` : ""}`;
      },
      providesTags: [{ type: "BulkJob", id: "LIST" }],
    }),

    /**
     * Get a single bulk job, including live progress when still cached
     */
    getBulkJob: builder.query<BulkJobDetailResponse, string>({
      query: (jobId) => `/api/v1/shipments/bulk/jobs/${jobId}`,
      providesTags: (result, error, id) => [{ type: "BulkJob", id }],
    }),

    /**
     * Upload a CSV/Excel file to create shipments in bulk.
     *
     * Sends FormData - the x-multipart marker tells baseApi's prepareHeaders
     * to drop the JSON Content-Type so the browser sets the boundary.
     */
    uploadBulkShipments: builder.mutation<BulkUploadResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);

        return {
          url: "/api/v1/shipments/bulk/upload",
          method: "POST",
          body: formData,
          headers: { "x-multipart": "true" },
        };
      },
      invalidatesTags: [
        { type: "BulkJob", id: "LIST" },
        { type: "Shipment", id: "LIST" },
      ],
    }),

    // ===========================
    // NDR (Non-Delivery Reports)
    // ===========================

    /**
     * List NDR cases with filtering, pagination and summary distributions
     */
    getNDRCases: builder.query<NDRCasesResponse, GetNDRCasesParams | void>({
      query: (params) => {
        const search = new URLSearchParams();
        if (params?.page) search.append("page", String(params.page));
        if (params?.limit) search.append("limit", String(params.limit));
        if (params?.status) search.append("status", params.status);
        if (params?.priority) search.append("priority", params.priority);
        if (params?.reason) search.append("reason", params.reason);
        if (params?.shipmentId) search.append("shipmentId", params.shipmentId);
        if (params?.dateFrom) search.append("dateFrom", params.dateFrom);
        if (params?.dateTo) search.append("dateTo", params.dateTo);
        if (params?.sortBy) search.append("sortBy", params.sortBy);
        if (params?.sortOrder) search.append("sortOrder", params.sortOrder);

        const qs = search.toString();
        return `/api/v1/shipments/ndr${qs ? `?${qs}` : ""}`;
      },
      providesTags: [{ type: "NDR", id: "LIST" }],
    }),

    /**
     * Take an action on an NDR case (reattempt / RTO / resolve)
     */
    takeNDRAction: builder.mutation<
      { status: string; data: NDRCase },
      { ndrCaseId: string } & NDRActionRequest
    >({
      query: ({ ndrCaseId, ...body }) => ({
        url: `/api/v1/shipments/ndr/${ndrCaseId}/action`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "NDR", id: "LIST" }],
    }),

    /**
     * Create an NDR case against a shipment
     */
    createNDRCase: builder.mutation<
      { status: string; data: NDRCase },
      { shipmentId: string } & CreateNDRCaseRequest
    >({
      query: ({ shipmentId, ...body }) => ({
        url: `/api/v1/shipments/${shipmentId}/ndr`,
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "NDR", id: "LIST" }],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useCreateShipmentMutation,
  useAssignPartnerMutation,
  useGetShipmentsQuery,
  useGetShipmentByIdQuery,
  useUpdateShipmentMutation,
  useCancelShipmentMutation,
  useRetryCourierBookingMutation,
  useTrackShipmentQuery,
  useBulkCreateShipmentsMutation,
  useSchedulePickupMutation,
  useGetPickupSlotsQuery,
  useDownloadLabelMutation,
  useGetShipmentQuotesMutation,
  useRerateShipmentMutation,
  useRefreshFromProviderMutation,
  useFetchCourierLabelMutation,
  useCancelWithProviderMutation,
  useGetShipmentDocumentsQuery,
  // Bulk upload
  useGetBulkJobsQuery,
  useGetBulkJobQuery,
  useUploadBulkShipmentsMutation,
  // NDR
  useGetNDRCasesQuery,
  useTakeNDRActionMutation,
  useCreateNDRCaseMutation,
} = shipmentApi;

// ===========================
// Export Types
// ===========================

export type {
  CreateShipmentRequest,
  AssignPartnerRequest,
  UpdateShipmentRequest,
  RetryCourierBookingRequest,
  RetryCourierBookingResponse,
  Shipment,
  ShipmentResponse,
  ShipmentMutationResponse,
  ShipmentsListResponse,
  TrackingEvent,
  TrackingResponse,
  BulkShipmentRequest,
  BulkShipmentResponse,
  PickupRequest,
  PickupResponse,
  GetShipmentsParams,
  ShipmentQuoteRequest,
  ShipmentQuotesResponse,
  PartnerQuote,
  RerateShipmentRequest,
  AddressPayload,
  InvoicePayload,
  BoxPayload,
  ProviderAction,
  ProviderCapabilities,
  ShipmentDocument,
  RefreshFromProviderResponse,
  FetchCourierLabelResponse,
  CancelWithProviderResponse,
  ShipmentBookingStatus,
};
