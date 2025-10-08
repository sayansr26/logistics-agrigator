import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";

// Types for geographical data
export interface State {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
}

export interface City {
  id: number;
  name: string;
  stateId: number;
  stateName?: string;
  isActive: boolean;
}

export interface Area {
  id: number;
  name: string;
  cityId: number;
  cityName?: string;
  stateId?: number;
  stateName?: string;
  isActive: boolean;
}

export interface Pincode {
  id: number;
  pincode: string;
  areaId: number;
  areaName?: string;
  cityId?: number;
  cityName?: string;
  stateId?: number;
  stateName?: string;
  isActive: boolean;
}

export interface GeographicalListResponse<T> {
  status: "success" | "error";
  data: T[];
  message?: string;
  error?: string;
  meta?: any;
}

export class GeographicalApiService extends BaseApiService {
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
   * Get all states
   */
  async getStates(): Promise<GeographicalListResponse<State>> {
    try {
      const response = await this.get<GeographicalListResponse<State>>(
        API_ENDPOINTS.GEOGRAPHICAL.STATES,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error fetching states:", error);
      throw error;
    }
  }

  /**
   * Get cities by state ID
   */
  async getCitiesByState(
    stateId: number,
  ): Promise<GeographicalListResponse<City>> {
    try {
      const response = await this.get<GeographicalListResponse<City>>(
        `${API_ENDPOINTS.GEOGRAPHICAL.CITIES}?stateIds=${stateId}&limit=100`,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error fetching cities:", error);
      throw error;
    }
  }

  /**
   * Get areas by city ID
   */
  async getAreasByCity(
    cityId: number,
  ): Promise<GeographicalListResponse<Area>> {
    try {
      const response = await this.get<GeographicalListResponse<Area>>(
        `${API_ENDPOINTS.GEOGRAPHICAL.AREAS}?cityIds=${cityId}`,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error fetching areas:", error);
      throw error;
    }
  }

  /**
   * Get pincodes by area ID
   */
  async getPincodesByArea(
    areaId: number,
  ): Promise<GeographicalListResponse<Pincode>> {
    try {
      const response = await this.get<GeographicalListResponse<Pincode>>(
        `${API_ENDPOINTS.GEOGRAPHICAL.PINCODES}?areaId=${areaId}`,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error fetching pincodes:", error);
      throw error;
    }
  }

  /**
   * Search pincodes by query
   */
  async searchPincodes(
    query: string,
    limit: number = 10,
  ): Promise<GeographicalListResponse<Pincode>> {
    try {
      const response = await this.get<GeographicalListResponse<Pincode>>(
        `${API_ENDPOINTS.GEOGRAPHICAL.PINCODES}/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error searching pincodes:", error);
      throw error;
    }
  }
}
