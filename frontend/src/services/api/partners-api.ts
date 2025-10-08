import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";
import {
  Partner,
  CreatePartnerRequest,
  UpdatePartnerRequest,
  PartnerResponse,
  PartnerListApiResponse,
  PartnerListResponse,
} from "@/types/partner";

export class PartnersApiService extends BaseApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Create a new partner
   */
  async createPartner(
    partnerData: CreatePartnerRequest,
  ): Promise<PartnerResponse> {
    try {
      const response = await this.post<PartnerResponse>(
        API_ENDPOINTS.PARTNERS.CREATE,
        partnerData,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error creating partner:", error);
      throw error;
    }
  }

  /**
   * Get all partners with optional filters
   */
  async getPartners(params?: {
    isActive?: boolean;
    supportsCOD?: boolean;
    supportsReverse?: boolean;
  }): Promise<PartnerListApiResponse> {
    try {
      const response = await this.get<PartnerListApiResponse>(
        API_ENDPOINTS.PARTNERS.LIST,
        {
          params,
          headers: this.getHeaders(),
        },
      );
      return response;
    } catch (error) {
      console.error("Error fetching partners:", error);
      throw error;
    }
  }

  /**
   * Get a specific partner by ID
   */
  async getPartnerById(partnerId: string): Promise<PartnerResponse> {
    try {
      const response = await this.get<PartnerResponse>(
        `${API_ENDPOINTS.PARTNERS.GET}/${partnerId}`,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error fetching partner:", error);
      throw error;
    }
  }

  /**
   * Update an existing partner
   */
  async updatePartner(
    partnerId: string,
    partnerData: UpdatePartnerRequest,
  ): Promise<PartnerResponse> {
    try {
      const response = await this.put<PartnerResponse>(
        `${API_ENDPOINTS.PARTNERS.UPDATE}/${partnerId}`,
        partnerData,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error updating partner:", error);
      throw error;
    }
  }

  /**
   * Delete a partner
   */
  async deletePartner(
    partnerId: string,
  ): Promise<{ status: "success" | "error"; message?: string }> {
    try {
      const response = await this.delete<{
        status: "success" | "error";
        message?: string;
      }>(`${API_ENDPOINTS.PARTNERS.DELETE}/${partnerId}`, {
        headers: this.getHeaders(),
      });
      return response;
    } catch (error) {
      console.error("Error deleting partner:", error);
      throw error;
    }
  }

  /**
   * Deactivate a partner (soft delete)
   */
  async deactivatePartner(partnerId: string): Promise<PartnerResponse> {
    try {
      const response = await this.put<PartnerResponse>(
        `${API_ENDPOINTS.PARTNERS.UPDATE}/${partnerId}`,
        { isActive: false },
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error deactivating partner:", error);
      throw error;
    }
  }

  /**
   * Activate a partner
   */
  async activatePartner(partnerId: string): Promise<PartnerResponse> {
    try {
      const response = await this.put<PartnerResponse>(
        `${API_ENDPOINTS.PARTNERS.UPDATE}/${partnerId}`,
        { isActive: true },
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error activating partner:", error);
      throw error;
    }
  }

  /**
   * Get partner rates
   */
  async getPartnerRates(partnerId: string): Promise<any> {
    try {
      const response = await this.get<any>(
        `${API_ENDPOINTS.PARTNERS.RATES}/${partnerId}`,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error fetching partner rates:", error);
      throw error;
    }
  }

  /**
   * Check serviceability for a partner
   */
  async checkServiceability(
    partnerId: string,
    params: {
      pickupPincode: string;
      deliveryPincode: string;
      weight?: number;
    },
  ): Promise<any> {
    try {
      const response = await this.get<any>(
        `${API_ENDPOINTS.PARTNERS.SERVICEABILITY}/${partnerId}`,
        {
          params,
          headers: this.getHeaders(),
        },
      );
      return response;
    } catch (error) {
      console.error("Error checking serviceability:", error);
      throw error;
    }
  }

  /**
   * Calculate shipping cost
   */
  async calculateShippingCost(
    partnerId: string,
    params: {
      pickupPincode: string;
      deliveryPincode: string;
      weight: number;
      dimensions?: {
        length: number;
        width: number;
        height: number;
      };
    },
  ): Promise<any> {
    try {
      const response = await this.get<any>(
        `${API_ENDPOINTS.PARTNERS.CALCULATE}/${partnerId}`,
        {
          params,
          headers: this.getHeaders(),
        },
      );
      return response;
    } catch (error) {
      console.error("Error calculating shipping cost:", error);
      throw error;
    }
  }
}
