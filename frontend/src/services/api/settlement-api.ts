import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";

export type SettlementStatus =
  | "DRAFT"
  | "FINANCE_VERIFICATION"
  | "APPROVED"
  | "RELEASED"
  | "REJECTED"
  | "HOLD"
  | "CANCELLED";

export type SettlementAction =
  | "verify"
  | "approve"
  | "release"
  | "reject"
  | "hold"
  | "cancel"
  | "reprocess";

export interface Settlement {
  id: string;
  settlementNo: string;
  userId: string;
  clientCode: string;
  totalCod: string;
  totalAdjustments: string;
  netPayable: string;
  status: SettlementStatus;
  paymentMode?: string | null;
  cycle?: string | null;
  payoutReference?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: Array<{ id: string; awbNumber: string; amount: string }>;
  adjustments?: Array<{ id: string; type: string; amount: string; reason: string }>;
}

interface Paginated<T> {
  status: string;
  data: T[];
  meta?: { pagination?: { page: number; limit: number; total: number; pages: number } };
}

interface Wrapped<T> {
  status: string;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * COD / Settlement API client. Auth is handled by the Next.js proxy layer
 * (same as the other api services). A token can be attached via setAccessToken.
 */
export class SettlementApiService extends BaseApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private authHeaders(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  // ---- Settlements ----
  async listSettlements(params?: {
    status?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Settlement>> {
    return this.get<Paginated<Settlement>>(API_ENDPOINTS.SETTLEMENT.LIST, {
      params: params as Record<string, any>,
      headers: this.authHeaders(),
    });
  }

  async listMySettlements(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Settlement>> {
    return this.get<Paginated<Settlement>>(API_ENDPOINTS.SETTLEMENT.MY, {
      params: params as Record<string, any>,
      headers: this.authHeaders(),
    });
  }

  async getSettlement(id: string): Promise<Wrapped<Settlement>> {
    return this.get<Wrapped<Settlement>>(`${API_ENDPOINTS.SETTLEMENT.BASE}/${id}`, {
      headers: this.authHeaders(),
    });
  }

  async generateSettlement(data: {
    userId: string;
    clientCode?: string;
    codShipmentIds?: string[];
    cycle?: string;
    paymentMode?: string;
    remarks?: string;
  }): Promise<Wrapped<Settlement>> {
    return this.post<Wrapped<Settlement>>(
      API_ENDPOINTS.SETTLEMENT.GENERATE,
      data,
      { headers: this.authHeaders() },
    );
  }

  async addAdjustment(
    id: string,
    data: { type: string; amount: number; reason: string; referenceAwb?: string },
  ): Promise<Wrapped<unknown>> {
    return this.post<Wrapped<unknown>>(
      `${API_ENDPOINTS.SETTLEMENT.BASE}/${id}/adjustments`,
      data,
      { headers: this.authHeaders() },
    );
  }

  async actOnSettlement(
    id: string,
    data: {
      action: SettlementAction;
      paymentMode?: string;
      payoutReference?: string;
      reason?: string;
    },
  ): Promise<Wrapped<Settlement>> {
    return this.post<Wrapped<Settlement>>(
      `${API_ENDPOINTS.SETTLEMENT.BASE}/${id}/actions`,
      data,
      { headers: this.authHeaders() },
    );
  }

  // ---- COD ----
  async listCodShipments(params?: Record<string, any>): Promise<Paginated<unknown>> {
    return this.get<Paginated<unknown>>(API_ENDPOINTS.COD.SHIPMENTS, {
      params,
      headers: this.authHeaders(),
    });
  }

  async autoReconcile(data?: {
    userId?: string;
    clientCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Wrapped<unknown>> {
    return this.post<Wrapped<unknown>>(
      API_ENDPOINTS.COD.RECONCILE_AUTO,
      data || {},
      { headers: this.authHeaders() },
    );
  }

  /** Import a courier COD report from CSV text. */
  async importCollectionsCsv(csv: string): Promise<
    Wrapped<{
      total: number;
      successCount: number;
      failureCount: number;
      parseErrors?: Array<{ line: number; error: string }>;
    }>
  > {
    return this.post<
      Wrapped<{
        total: number;
        successCount: number;
        failureCount: number;
        parseErrors?: Array<{ line: number; error: string }>;
      }>
    >(API_ENDPOINTS.COD.COLLECTIONS_IMPORT_CSV, { csv, source: "IMPORT" }, {
      headers: this.authHeaders(),
    });
  }

  async getReport(type: string, params?: Record<string, any>): Promise<Wrapped<{ type: string; report: unknown }>> {
    return this.get<Wrapped<{ type: string; report: unknown }>>(
      `${API_ENDPOINTS.COD.REPORTS}/${type}`,
      { params, headers: this.authHeaders() },
    );
  }
}

export const settlementApi = new SettlementApiService();
