import { BaseApiService } from "./base-api";
import { API_ENDPOINTS } from "@/constants/api";

export interface RerateBulkRow {
  awbNumber: string;
  newWeight?: number;
  newLength?: number;
  newWidth?: number;
  newHeight?: number;
  courierCharge?: number;
  codAction?: "DEDUCT_WALLET" | "UPDATE_COD";
}

export interface BulkRerateReport {
  total: number;
  successCount: number;
  failureCount: number;
  successful: Array<{
    awbNumber: string;
    orderId?: string;
    oldCost?: number;
    newCost?: number;
    difference?: number;
    courierCost?: number | null;
    profitMargin?: number | null;
    holdApplied?: boolean;
  }>;
  failed: Array<{ awbNumber: string; error: string }>;
}

export interface ReratePreview {
  before: {
    weight: number;
    volumetricWeight: number | null;
    chargeableWeight: number | null;
    sellingCharge: number;
    courierCost: number | null;
  };
  after: {
    weight: number;
    volumetricWeight: number;
    chargeableWeight: number;
    sellingCharge: number;
    courierCost: number | null;
    profitMargin: number | null;
    courierCostSource: string | null;
  };
  difference: number;
  paymentType: string;
  expectedWalletImpact: { refund: number; charge: number; net: number } | null;
}

interface Wrapped<T> {
  status: string;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Shipment re-rate (weight modification) API client.
 */
export class ShipmentRerateApiService extends BaseApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private authHeaders(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  /** Dry-run preview of a single-shipment re-rate (no wallet/DB side effects). */
  async preview(
    shipmentId: string,
    body: {
      disputedWeight?: number;
      disputedLength?: number;
      disputedWidth?: number;
      disputedHeight?: number;
      courierCharge?: number;
    },
  ): Promise<Wrapped<ReratePreview>> {
    return this.post<Wrapped<ReratePreview>>(
      `${API_ENDPOINTS.SHIPMENTS.RERATE_PREVIEW}/${shipmentId}/rerate/preview`,
      body,
      { headers: this.authHeaders() },
    );
  }

  /** Bulk re-rate by AWB. */
  async bulkRerate(reason: string, rows: RerateBulkRow[]): Promise<Wrapped<BulkRerateReport>> {
    return this.post<Wrapped<BulkRerateReport>>(
      API_ENDPOINTS.SHIPMENTS.BULK_RERATE,
      { reason, rows },
      { headers: this.authHeaders() },
    );
  }
}

export const shipmentRerateApi = new ShipmentRerateApiService();
