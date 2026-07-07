import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";

export type CarrierServiceType = "SURFACE" | "AIR" | "EXPRESS";

export interface CarrierAccount {
  id: string;
  partnerId: string;
  channelName: string;
  accountRef: string;
  serviceType: CarrierServiceType;
  minWeight: string;
  maxWeight: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CarrierAccountInput {
  channelName: string;
  accountRef: string;
  serviceType?: CarrierServiceType;
  minWeight?: number;
  maxWeight?: number | null;
  priority?: number;
  isActive?: boolean;
}

interface Wrapped<T> {
  status: string;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Carrier account (weight-slab shipping channel) API client. `credentials`
 * are never returned by the backend, so they are absent from these types.
 */
export class CarrierAccountsApiService extends BaseApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private authHeaders(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  async list(partnerId: string): Promise<Wrapped<{ accounts: CarrierAccount[]; total: number }>> {
    return this.get<Wrapped<{ accounts: CarrierAccount[]; total: number }>>(
      `${API_ENDPOINTS.CARRIER_ACCOUNTS.FOR_PARTNER}/${partnerId}/carrier-accounts`,
      { headers: this.authHeaders() },
    );
  }

  async create(
    partnerId: string,
    accounts: CarrierAccountInput[],
  ): Promise<Wrapped<{ accounts: CarrierAccount[]; total: number }>> {
    return this.post<Wrapped<{ accounts: CarrierAccount[]; total: number }>>(
      `${API_ENDPOINTS.CARRIER_ACCOUNTS.FOR_PARTNER}/${partnerId}/carrier-accounts`,
      { accounts },
      { headers: this.authHeaders() },
    );
  }

  async update(accountId: string, updates: Partial<CarrierAccountInput>): Promise<Wrapped<CarrierAccount>> {
    return this.put<Wrapped<CarrierAccount>>(
      `${API_ENDPOINTS.CARRIER_ACCOUNTS.BASE}/${accountId}`,
      updates,
      { headers: this.authHeaders() },
    );
  }

  async remove(accountId: string): Promise<Wrapped<{ message: string }>> {
    return this.delete<Wrapped<{ message: string }>>(
      `${API_ENDPOINTS.CARRIER_ACCOUNTS.BASE}/${accountId}`,
      { headers: this.authHeaders() },
    );
  }
}

export const carrierAccountsApi = new CarrierAccountsApiService();
