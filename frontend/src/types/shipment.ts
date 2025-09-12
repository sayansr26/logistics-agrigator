// Shipment Types
export interface Address {
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
}

export interface PackageDetails {
  weight: number;
  dimensions: PackageDimensions;
  description: string;
  value: number;
  fragile: boolean;
}

export type PaymentType = "PREPAID" | "COD" | "POSTPAID";
export type ServiceType = "STANDARD" | "EXPRESS" | "OVERNIGHT" | "SAME_DAY";
export type ShipmentStatus =
  | "created"
  | "picked"
  | "in-transit"
  | "out-for-delivery"
  | "delivered"
  | "rto"
  | "cancelled";

export interface CreateShipmentRequest {
  orderId: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  packageDetails: PackageDetails;
  paymentType: PaymentType;
  serviceType: ServiceType;
  specialInstructions?: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  awbNumber: string;
  status: ShipmentStatus;
  pickupAddress: Address;
  deliveryAddress: Address;
  packageDetails: PackageDetails;
  paymentType: PaymentType;
  serviceType: ServiceType;
  specialInstructions?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  trackingEvents?: TrackingEvent[];
}

export interface TrackingEvent {
  id: string;
  status: ShipmentStatus;
  description: string;
  location?: string;
  timestamp: string;
  updatedBy?: string;
}

export interface CreateShipmentResponse {
  status: "success" | "error";
  data?: {
    shipment: Shipment;
    message: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface GetShipmentsResponse {
  status: "success" | "error";
  data?: {
    shipments: Shipment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface GetShipmentResponse {
  status: "success" | "error";
  data?: {
    shipment: Shipment;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface UpdateShipmentRequest {
  status?: ShipmentStatus;
  specialInstructions?: string;
  estimatedDelivery?: string;
}

export interface UpdateShipmentResponse {
  status: "success" | "error";
  data?: {
    shipment: Shipment;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface CancelShipmentResponse {
  status: "success" | "error";
  data?: {
    shipment: Shipment;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface GetTrackingResponse {
  status: "success" | "error";
  data?: {
    shipment: Shipment;
    trackingEvents: TrackingEvent[];
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface AddTrackingEventRequest {
  status: ShipmentStatus;
  description: string;
  location?: string;
}

export interface AddTrackingEventResponse {
  status: "success" | "error";
  data?: {
    trackingEvent: TrackingEvent;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Form validation types
export interface ShipmentFormData {
  orderId: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  packageDetails: PackageDetails;
  paymentType: PaymentType;
  serviceType: ServiceType;
  specialInstructions?: string;
}

// Filter and search types
export interface ShipmentFilters {
  status?: ShipmentStatus;
  paymentType?: PaymentType;
  serviceType?: ServiceType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}
