import { baseApi } from "../baseApi";

/**
 * Shipment Management API Endpoints
 *
 * All shipment endpoints route through API Gateway (port 3001)
 */

// ===========================
// Request/Response Interfaces
// ===========================

interface CreateShipmentRequest {
  clientId: string;
  customerId?: string;
  originPincode: string;
  destinationPincode: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  paymentMode: "prepaid" | "cod";
  codAmount?: number;
  shipmentValue: number;
  partnerId?: string;
  packageType?: string;
  description?: string;
  isFragile?: boolean;
  sender?: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    pincode: string;
    city: string;
    state: string;
  };
  receiver?: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    pincode: string;
    city: string;
    state: string;
  };
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
}

interface Shipment {
  id: string;
  awbNumber: string;
  clientId: string;
  customerId?: string;
  partnerId: string;
  status: string;
  originPincode: string;
  destinationPincode: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  paymentMode: string;
  codAmount?: number;
  shipmentValue: number;
  packageType?: string;
  description?: string;
  isFragile?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ShipmentResponse {
  status: string;
  message: string;
  data: {
    shipment: Shipment;
  };
}

interface ShipmentsListResponse {
  status: string;
  message: string;
  data: {
    shipments: Shipment[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface TrackingEvent {
  id: string;
  shipmentId: string;
  status: string;
  location?: string;
  description: string;
  timestamp: string;
}

interface TrackingResponse {
  status: string;
  message: string;
  data: {
    shipment: Shipment;
    events: TrackingEvent[];
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
  customerId?: string;
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
    createShipment: builder.mutation<ShipmentResponse, CreateShipmentRequest>({
      query: (shipmentData) => ({
        url: "/api/v1/shipments",
        method: "POST",
        body: shipmentData,
      }),
      invalidatesTags: ["Shipment"],
    }),

    /**
     * Get Shipments - Fetch list of shipments with pagination and filters
     */
    getShipments: builder.query<
      ShipmentsListResponse,
      GetShipmentsParams | void
    >({
      query: (params = {}) => ({
        url: "/api/v1/shipments",
        params,
      }),
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
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useCreateShipmentMutation,
  useGetShipmentsQuery,
  useGetShipmentByIdQuery,
  useUpdateShipmentMutation,
  useCancelShipmentMutation,
  useTrackShipmentQuery,
  useBulkCreateShipmentsMutation,
  useSchedulePickupMutation,
  useGetPickupSlotsQuery,
  useDownloadLabelMutation,
} = shipmentApi;

// ===========================
// Export Types
// ===========================

export type {
  CreateShipmentRequest,
  UpdateShipmentRequest,
  Shipment,
  ShipmentResponse,
  ShipmentsListResponse,
  TrackingEvent,
  TrackingResponse,
  BulkShipmentRequest,
  BulkShipmentResponse,
  PickupRequest,
  PickupResponse,
  GetShipmentsParams,
};
