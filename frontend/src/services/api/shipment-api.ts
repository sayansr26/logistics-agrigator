import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";
import {
  CreateShipmentRequest,
  CreateShipmentResponse,
  GetShipmentsResponse,
  GetShipmentResponse,
  UpdateShipmentRequest,
  UpdateShipmentResponse,
  CancelShipmentResponse,
  GetTrackingResponse,
  AddTrackingEventRequest,
  AddTrackingEventResponse,
  ShipmentFilters,
  // Pickup Management
  CreatePickupRequest,
  PickupResponse,
  PickupSlotsResponse,
  // NDR Management
  CreateNDRRequest,
  NDRResponse,
  NDRReport,
  NDRReason,
  // Bulk Operations
  BulkShipmentRequest,
  BulkShipmentResponse,
  // Label Generation
  LabelRequest,
  LabelResponse,
} from "@/types/shipment";

export class ShipmentApiService extends BaseApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Save a shipment as draft
   */
  async saveDraft(
    data: CreateShipmentRequest,
  ): Promise<CreateShipmentResponse> {
    try {
      const response = await this.post<CreateShipmentResponse>(
        API_ENDPOINTS.SHIPMENTS.CREATE,
        { ...data, status: "draft" },
      );
      return response;
    } catch (error) {
      console.error("Failed to save draft:", error);
      throw error;
    }
  }

  /**
   * Create a new shipment
   */
  async createShipment(
    shipmentData: CreateShipmentRequest,
  ): Promise<CreateShipmentResponse> {
    return this.post<CreateShipmentResponse>(
      API_ENDPOINTS.SHIPMENTS.CREATE,
      shipmentData,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get shipments with filtering and pagination
   */
  async getShipments(filters?: ShipmentFilters): Promise<GetShipmentsResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    const endpoint = queryString
      ? `${API_ENDPOINTS.SHIPMENTS.CREATE}?${queryString}`
      : API_ENDPOINTS.SHIPMENTS.CREATE;

    return this.get<GetShipmentsResponse>(endpoint, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string): Promise<GetShipmentResponse> {
    return this.get<GetShipmentResponse>(
      `${API_ENDPOINTS.SHIPMENTS.GET_BY_ID}/${shipmentId}`,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Update shipment
   */
  async updateShipment(
    shipmentId: string,
    updateData: UpdateShipmentRequest,
  ): Promise<UpdateShipmentResponse> {
    return this.put<UpdateShipmentResponse>(
      `${API_ENDPOINTS.SHIPMENTS.UPDATE}/${shipmentId}/update`,
      updateData,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Cancel shipment
   */
  async cancelShipment(shipmentId: string): Promise<CancelShipmentResponse> {
    return this.post<CancelShipmentResponse>(
      `${API_ENDPOINTS.SHIPMENTS.CANCEL}/${shipmentId}/cancel/shipment`,
      {},
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get shipment tracking information
   */
  async getShipmentTracking(shipmentId: string): Promise<GetTrackingResponse> {
    return this.get<GetTrackingResponse>(
      `${API_ENDPOINTS.SHIPMENTS.TRACKING}/${shipmentId}/tracking/shipment`,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Add tracking event to shipment
   */
  async addTrackingEvent(
    shipmentId: string,
    eventData: AddTrackingEventRequest,
  ): Promise<AddTrackingEventResponse> {
    return this.post<AddTrackingEventResponse>(
      `${API_ENDPOINTS.SHIPMENTS.TRACKING_EVENTS}/${shipmentId}/tracking/events/shipment event`,
      eventData,
      { headers: this.getAuthHeaders() },
    );
  }

  // ==================== PICKUP MANAGEMENT ====================

  /**
   * Create pickup request
   */
  async createPickup(pickupData: CreatePickupRequest): Promise<PickupResponse> {
    return this.post<PickupResponse>(
      API_ENDPOINTS.SHIPMENTS.PICKUP_CREATE,
      pickupData,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get pickup schedules
   */
  async getPickupSchedules(filters?: {
    partnerId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<PickupResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    const endpoint = queryString
      ? `${API_ENDPOINTS.SHIPMENTS.PICKUP_SCHEDULES}?${queryString}`
      : API_ENDPOINTS.SHIPMENTS.PICKUP_SCHEDULES;

    return this.get<PickupResponse>(endpoint, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Get pickup slots for a specific date and partner
   */
  async getPickupSlots(
    partnerId: string,
    date: string,
  ): Promise<PickupSlotsResponse> {
    return this.get<PickupSlotsResponse>(
      `${API_ENDPOINTS.SHIPMENTS.PICKUP_SLOTS}?partnerId=${partnerId}&date=${date}`,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get pickup status
   */
  async getPickupStatus(pickupId: string): Promise<PickupResponse> {
    return this.get<PickupResponse>(
      `${API_ENDPOINTS.SHIPMENTS.PICKUP_STATUS}/${pickupId}`,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Update pickup request
   */
  async updatePickup(
    pickupId: string,
    updateData: Partial<CreatePickupRequest>,
  ): Promise<PickupResponse> {
    return this.put<PickupResponse>(
      `${API_ENDPOINTS.SHIPMENTS.PICKUP_UPDATE}/${pickupId}`,
      updateData,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Cancel pickup request
   */
  async cancelPickup(pickupId: string): Promise<PickupResponse> {
    return this.post<PickupResponse>(
      `${API_ENDPOINTS.SHIPMENTS.PICKUP_CANCEL}/${pickupId}`,
      {},
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get pickup by ID
   */
  async getPickupById(pickupId: string): Promise<PickupResponse> {
    return this.get<PickupResponse>(
      `${API_ENDPOINTS.SHIPMENTS.PICKUP_GET_BY_ID}/${pickupId}`,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get pickup by shipment ID
   */
  async getPickupByShipmentId(shipmentId: string): Promise<PickupResponse> {
    return this.get<PickupResponse>(
      `${API_ENDPOINTS.SHIPMENTS.PICKUP_GET_BY_SHIPMENT_ID}/${shipmentId}`,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get all pickups by partner ID
   */
  async getPickupsByPartnerId(
    partnerId: string,
    filters?: { status?: string; dateFrom?: string; dateTo?: string },
  ): Promise<PickupResponse> {
    const params = new URLSearchParams({ partnerId });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });
    }

    return this.get<PickupResponse>(
      `${API_ENDPOINTS.SHIPMENTS.PICKUP_GET_BY_PARTNER_ID}?${params.toString()}`,
      { headers: this.getAuthHeaders() },
    );
  }

  // ==================== NDR MANAGEMENT ====================

  // ==================== BULK OPERATIONS ====================

  /**
   * Create multiple shipments in bulk
   */
  async createBulkShipments(
    bulkData: BulkShipmentRequest,
  ): Promise<BulkShipmentResponse> {
    return this.post<BulkShipmentResponse>(
      API_ENDPOINTS.SHIPMENTS.BULK,
      bulkData,
      { headers: this.getAuthHeaders() },
    );
  }

  // ==================== LABEL GENERATION ====================

  /**
   * Generate shipping labels
   */
  async generateLabels(labelData: LabelRequest): Promise<LabelResponse> {
    return this.post<LabelResponse>(API_ENDPOINTS.SHIPMENTS.LABELS, labelData, {
      headers: this.getAuthHeaders(),
    });
  }

  // NDR (Non-Delivery Report) Management Methods

  /**
   * Create a new NDR report
   */
  async createNDR(request: CreateNDRRequest): Promise<NDRResponse> {
    return this.post<NDRResponse>(API_ENDPOINTS.SHIPMENTS.NDR, request, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Get NDR reports for a shipment
   */
  async getShipmentNDRs(shipmentId: string): Promise<{
    status: "success" | "error";
    data?: {
      ndrs: NDRReport[];
    };
    error?: {
      code: string;
      message: string;
    };
  }> {
    return this.get<{
      status: "success" | "error";
      data?: {
        ndrs: NDRReport[];
      };
      error?: {
        code: string;
        message: string;
      };
    }>(`${API_ENDPOINTS.SHIPMENTS.NDR}/${shipmentId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Get all NDR reports with filters
   */
  async getNDRs(filters?: {
    status?: "pending" | "resolved" | "escalated";
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    status: "success" | "error";
    data?: {
      ndrs: NDRReport[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
    error?: {
      code: string;
      message: string;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (filters?.status) queryParams.append("status", filters.status);
    if (filters?.dateFrom) queryParams.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) queryParams.append("dateTo", filters.dateTo);
    if (filters?.page) queryParams.append("page", filters.page.toString());
    if (filters?.limit) queryParams.append("limit", filters.limit.toString());

    const queryString = queryParams.toString();
    const url = queryString
      ? `${API_ENDPOINTS.SHIPMENTS.NDR}?${queryString}`
      : API_ENDPOINTS.SHIPMENTS.NDR;

    return this.get<{
      status: "success" | "error";
      data?: {
        ndrs: NDRReport[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
      error?: {
        code: string;
        message: string;
      };
    }>(url, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Update NDR status (resolve/escalate)
   */
  async updateNDRStatus(
    ndrId: string,
    status: "resolved" | "escalated",
    resolution?: string,
  ): Promise<NDRResponse> {
    return this.put<NDRResponse>(
      `${API_ENDPOINTS.SHIPMENTS.NDR}/${ndrId}/status`,
      { status, resolution },
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * Get NDR reason codes
   */
  async getNDRReasons(): Promise<{
    status: "success" | "error";
    data?: {
      reasons: NDRReason[];
    };
    error?: {
      code: string;
      message: string;
    };
  }> {
    return this.get<{
      status: "success" | "error";
      data?: {
        reasons: NDRReason[];
      };
      error?: {
        code: string;
        message: string;
      };
    }>(`${API_ENDPOINTS.SHIPMENTS.NDR}/reasons`, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Get NDR statistics
   */
  async getNDRStats(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    status: "success" | "error";
    data?: {
      total: number;
      pending: number;
      resolved: number;
      escalated: number;
      byReason: Array<{
        reason: string;
        count: number;
        percentage: number;
      }>;
    };
    error?: {
      code: string;
      message: string;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (dateFrom) queryParams.append("dateFrom", dateFrom);
    if (dateTo) queryParams.append("dateTo", dateTo);

    const queryString = queryParams.toString();
    const url = queryString
      ? `${API_ENDPOINTS.SHIPMENTS.NDR}/stats?${queryString}`
      : `${API_ENDPOINTS.SHIPMENTS.NDR}/stats`;

    return this.get<{
      status: "success" | "error";
      data?: {
        total: number;
        pending: number;
        resolved: number;
        escalated: number;
        byReason: Array<{
          reason: string;
          count: number;
          percentage: number;
        }>;
      };
      error?: {
        code: string;
        message: string;
      };
    }>(url, {
      headers: this.getAuthHeaders(),
    });
  }

  // Override the request method to include auth headers
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const authHeaders = this.getAuthHeaders();

    return super.request<T>(endpoint, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    });
  }
}
