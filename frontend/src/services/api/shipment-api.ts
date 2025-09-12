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
