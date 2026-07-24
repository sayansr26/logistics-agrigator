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

  // ─────────────────────────────────────────────────────────────
  // Bulk (batch) fetchers — one request per chunk instead of one
  // request per parent id. Fixes rate-limit (429) storms and is far
  // faster when many parents are selected (e.g. "Select All").
  //
  // Backend bulk endpoints return a grouped map:
  //   { status, data: { data: { [parentId]: Child[] }, summary, ... } }
  // These helpers POST the ids in chunks (respecting server max) and
  // return a single FLAT, de-duplicated array of children.
  // ─────────────────────────────────────────────────────────────

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private async fetchGroupedInChunks<Child>(
    endpoint: string,
    bodyKey: string,
    ids: (string | number)[],
    chunkSize: number,
  ): Promise<Child[]> {
    const uniqueIds = Array.from(new Set(ids.map((id) => String(id))));
    if (uniqueIds.length === 0) return [];

    const chunks = this.chunk(uniqueIds, chunkSize);
    const results = await Promise.all(
      chunks.map((chunk) =>
        this.post<any>(
          endpoint,
          { [bodyKey]: chunk },
          { headers: this.getHeaders() },
        ),
      ),
    );

    // Flatten every group ({ parentId: Child[] }) from every chunk into one
    // array, de-duplicating by child id (a pincode can repeat across areas).
    const seen = new Set<string>();
    const flat: Child[] = [];
    for (const res of results) {
      const grouped = res?.data?.data || {};
      for (const parentId of Object.keys(grouped)) {
        for (const child of grouped[parentId] as any[]) {
          const key = String(child?.id ?? JSON.stringify(child));
          if (seen.has(key)) continue;
          seen.add(key);
          flat.push(child);
        }
      }
    }
    return flat;
  }

  /**
   * Bulk: get all cities for many states in one path (chunked, max 50/req).
   */
  async getCitiesByStates(stateIds: (string | number)[]): Promise<City[]> {
    try {
      return await this.fetchGroupedInChunks<City>(
        `${API_ENDPOINTS.GEOGRAPHICAL.CITIES}/by-states`,
        "stateIds",
        stateIds,
        50,
      );
    } catch (error) {
      console.error("Error bulk fetching cities:", error);
      throw error;
    }
  }

  /**
   * Bulk: get all areas for many cities in one path (chunked, max 100/req).
   */
  async getAreasByCities(cityIds: (string | number)[]): Promise<Area[]> {
    try {
      return await this.fetchGroupedInChunks<Area>(
        `${API_ENDPOINTS.GEOGRAPHICAL.AREAS}/by-cities`,
        "cityIds",
        cityIds,
        100,
      );
    } catch (error) {
      console.error("Error bulk fetching areas:", error);
      throw error;
    }
  }

  /**
   * Bulk: get all pincodes for many areas in one path (chunked, max 100/req).
   */
  async getPincodesByAreas(areaIds: (string | number)[]): Promise<Pincode[]> {
    try {
      return await this.fetchGroupedInChunks<Pincode>(
        `${API_ENDPOINTS.GEOGRAPHICAL.PINCODES}/by-areas`,
        "areaIds",
        areaIds,
        100,
      );
    } catch (error) {
      console.error("Error bulk fetching pincodes:", error);
      throw error;
    }
  }
}
