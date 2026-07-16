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
  | "draft"
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

// Pickup Management Types
export interface PickupSchedule {
  id: string;
  shipmentId: string;
  partnerId: string;
  scheduledDate: string;
  timeSlot: string;
  status: "scheduled" | "picked" | "failed" | "cancelled";
  pickupAddress: Address;
  contactPerson: string;
  contactPhone: string;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PickupSlot {
  id: string;
  partnerId: string;
  date: string;
  timeSlot: string;
  available: boolean;
  maxCapacity: number;
  currentBookings: number;
}

export interface CreatePickupRequest {
  shipmentId: string;
  partnerId: string;
  scheduledDate: string;
  timeSlot: string;
  pickupAddress: Address;
  contactPerson: string;
  contactPhone: string;
  instructions?: string;
}

export interface PickupResponse {
  status: "success" | "error";
  data?: {
    pickup: PickupSchedule;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface PickupSlotsResponse {
  status: "success" | "error";
  data?: {
    slots: PickupSlot[];
    date: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// NDR (Non-Delivery Report) Types
export interface NDRReason {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
}

export interface NDRFilters {
  status?: "pending" | "resolved" | "escalated";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface NDRReport {
  id: string;
  shipmentId: string;
  reason: string;
  reasonCode: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
  status: "pending" | "resolved" | "escalated";
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface CreateNDRRequest {
  shipmentId: string;
  reason: string;
  reasonCode: string;
  description: string;
}

export interface NDRResponse {
  status: "success" | "error";
  data?: {
    ndr: NDRReport;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Bulk Operations Types
export interface BulkShipmentRequest {
  shipments: CreateShipmentRequest[];
}

export interface BulkShipmentResponse {
  status: "success" | "error";
  data?: {
    shipments: Shipment[];
    failed: Array<{
      index: number;
      error: string;
      data: CreateShipmentRequest;
    }>;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Label Generation Types
export interface LabelRequest {
  shipmentIds: string[];
  format?: "pdf" | "png" | "jpg";
  size?: "A4" | "A5" | "thermal";
}

export interface LabelResponse {
  status: "success" | "error";
  data?: {
    labels: Array<{
      shipmentId: string;
      labelUrl: string;
      format: string;
    }>;
    downloadUrl: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
