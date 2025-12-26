import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";

export type ZoneType = "DISTANCE" | "GEOLOGICAL";

export interface ZoneGeographical {
  states: string[];
  cities: string[];
  areas: string[];
  pincodes: string[];
}

export interface ZoneMilestone {
  id?: string;
  minKm: number;
  maxKm: number;
  suffix: string;
  sortOrder: number;
}

export interface Zone {
  id?: string;
  name: string;
  description?: string;
  partnerId: string;
  isActive: boolean;
  zoneType: ZoneType;
  geographical?: ZoneGeographical;
  milestones?: ZoneMilestone[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateZoneData {
  name: string;
  description?: string;
  partnerId: string;
  isActive?: boolean;
  zoneType: ZoneType;
  geographical?: ZoneGeographical;
  milestones?: Omit<ZoneMilestone, "id">[];
}

export interface ZoneResponse {
  success: boolean;
  message?: string;
  data?: Zone;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ZonesListResponse {
  success: boolean;
  message?: string;
  data?: Zone[];
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters?: Record<string, any>;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Note: ServiceType model has been removed from backend.
// Use pincodeTypeApi for pincode type management instead.

export class ZonesApiService extends BaseApiService {
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

  // Zone CRUD Operations
  async getZones(
    filters: Record<string, any> = {},
  ): Promise<ZonesListResponse> {
    return this.get<ZonesListResponse>(API_ENDPOINTS.ZONES.LIST, {
      params: filters,
      headers: this.getAuthHeaders(),
    });
  }

  async getZoneById(id: number): Promise<ZoneResponse> {
    return this.get<ZoneResponse>(`${API_ENDPOINTS.ZONES.GET}/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async createZone(zoneData: CreateZoneData): Promise<ZoneResponse> {
    return this.post<ZoneResponse>(API_ENDPOINTS.ZONES.CREATE, zoneData, {
      headers: this.getAuthHeaders(),
    });
  }

  async updateZone(
    id: number,
    zoneData: Partial<CreateZoneData>,
  ): Promise<ZoneResponse> {
    return this.put<ZoneResponse>(
      `${API_ENDPOINTS.ZONES.EDIT}/${id}`,
      zoneData,
    );
  }

  async deleteZone(id: number): Promise<ZoneResponse> {
    return this.delete<ZoneResponse>(`${API_ENDPOINTS.ZONES.DELETE}/${id}`);
  }

  // Note: getServiceTypes has been removed.
  // Use pincodeTypeApi for pincode type management.

  // Zone Coverage Validation
  async validateZoneCoverage(
    pincodes: string[],
    partnerId?: string,
  ): Promise<{
    success: boolean;
    data?: {
      totalPincodes: number;
      coveredPincodes: string[];
      uncoveredPincodes: string[];
      coveragePercentage: number;
      coverageByZone: Record<string, any>;
    };
    error?: {
      code: string;
      message: string;
    };
  }> {
    return this.post(
      `${API_ENDPOINTS.ZONES.VALIDATE_COVERAGE}`,
      {
        pincodes,
        partnerId,
      },
      {
        headers: this.getAuthHeaders(),
      },
    );
  }

  // Partner-specific zones
  async getPartnerZones(partnerId: string): Promise<ZonesListResponse> {
    return this.get<ZonesListResponse>(
      `${API_ENDPOINTS.ZONES.PARTNER_ZONES}/${partnerId}`,
      {
        headers: this.getAuthHeaders(),
      },
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

// Export singleton instance
export const zonesApiService = new ZonesApiService();
