import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";

// Types for geographical data
export interface State {
  id: string;
  name: string;
  code: string;
  status: boolean;
  isActive?: boolean;
}

export interface City {
  id: string;
  name: string;
  stateId: string;
  stateName?: string;
  isMetro?: boolean;
  status: boolean;
  isActive?: boolean;
  state?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface Area {
  id: string;
  name: string;
  cityId: string;
  cityName?: string;
  stateId?: string;
  stateName?: string;
  status: boolean;
  isActive?: boolean;
  city?: {
    id: string;
    name: string;
  };
}

export interface Pincode {
  id: string;
  code: string; // Backend uses 'code' not 'pincode'
  pincode?: string; // Alias for compatibility
  areaId?: string;
  areaName?: string;
  cityId?: string;
  cityName?: string;
  stateId?: string;
  stateName?: string;
  status: boolean;
  isActive?: boolean;
  area?: {
    id: string;
    name: string;
    city?: {
      id: string;
      name: string;
    };
  };
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
    stateId: number | string,
  ): Promise<GeographicalListResponse<City>> {
    try {
      const response = await this.get<GeographicalListResponse<City>>(
        `${API_ENDPOINTS.GEOGRAPHICAL.CITIES}?stateId=${stateId}&limit=100`,
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
    cityId: number | string,
  ): Promise<GeographicalListResponse<Area>> {
    try {
      const response = await this.get<GeographicalListResponse<Area>>(
        `${API_ENDPOINTS.GEOGRAPHICAL.AREAS}?cityId=${cityId}`,
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
    areaId: number | string,
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
   * Search pincodes by query (code, city, state)
   */
  async searchPincodes(
    query: string,
    limit: number = 10,
  ): Promise<GeographicalListResponse<Pincode>> {
    try {
      const response = await this.get<GeographicalListResponse<Pincode>>(
        `${API_ENDPOINTS.GEOGRAPHICAL.PINCODES}/search?code=${encodeURIComponent(query)}&limit=${limit}`,
        { headers: this.getHeaders() },
      );
      return response;
    } catch (error) {
      console.error("Error searching pincodes:", error);
      throw error;
    }
  }
}
