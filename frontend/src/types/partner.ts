// Partner Types and Interfaces

export interface Partner {
  id: string;
  name: string;
  code: string;
  displayName: string;
  isActive: boolean;
  apiUrl: string;
  apiToken?: string;
  apiVersion?: string;
  supportsCOD: boolean;
  supportsReverse: boolean;
  maxWeight?: number;
  maxDimensions?: {
    length: number;
    width: number;
    height: number;
  };
  baseRate?: number;
  perKgRate?: number;
  codChargePercent?: number;
  fuelSurcharge?: number;
  servicePincodes: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    shipments: number;
    rates: number;
  };
}

export type PartnerType =
  | "courier"
  | "logistics"
  | "express"
  | "freight"
  | "warehouse"
  | "last-mile";

export type PartnerStatus =
  | "active"
  | "inactive"
  | "pending"
  | "suspended"
  | "terminated";

export interface PartnerPricing {
  baseRate: number;
  perKgRate: number;
  fuelSurcharge: number;
  currency: string;
}

export interface PartnerContact {
  email: string;
  phone: string;
  address: string;
  website?: string;
}

export interface CreatePartnerRequest {
  name: string;
  code: string;
  displayName: string;
  apiUrl: string;
  isActive?: boolean;
  baseRate?: number;
  perKgRate?: number;
  fuelSurcharge?: number;
  servicePincodes?: string[];
}

export interface UpdatePartnerRequest extends Partial<CreatePartnerRequest> {
  id: string;
}

export interface PartnerListResponse {
  partners: Partner[];
}

export interface PartnerResponse {
  status: "success" | "error";
  data?: {
    partner: Partner;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

export interface PartnerListApiResponse {
  status: "success" | "error";
  data?: PartnerListResponse;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    service: string;
  };
}

// Form data interface for the add partner form
export interface PartnerFormData {
  name: string;
  partnerCode: string;
  apiUrl: string;
  type: PartnerType | "";
  status: PartnerStatus;
  rating: number;
  deliveryTime: string;
  servicePincodes: string[];
  services: string[];
  baseRate: number;
  perKgRate: number;
  fuelSurcharge: number;
  email: string;
  phone: string;
  address: string;
  website: string;
}

// Validation error interface
export interface PartnerValidationErrors {
  name?: string;
  type?: string;
  deliveryTime?: string;
  coverage?: string;
  services?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: string | undefined;
}
