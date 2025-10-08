# Shipment API Integration Guide

This document provides a comprehensive guide for integrating and using the shipment API in the logistics frontend application.

## Overview

The shipment API integration provides complete functionality for:

- ✅ Shipment CRUD operations
- ✅ Pickup management (scheduling, slots, status)
- ✅ NDR (Non-Delivery Report) handling
- ✅ Bulk operations
- ✅ Label generation
- ✅ State management with Zustand
- ✅ TypeScript support

## API Endpoints

All endpoints are configured in `/src/constants/api.ts`:

```typescript
SHIPMENTS: {
  CREATE: ":3004/api/v1/shipments",
  GET_BY_ID: ":3004/api/v1/shipments",
  UPDATE: ":3004/api/v1/shipments",
  CANCEL: ":3004/api/v1/shipments",
  TRACKING: ":3004/api/v1/shipments",
  TRACKING_EVENTS: ":3004/api/v1/shipments",
  NDR: ":3004/api/v1/shipments/ndr",
  BULK: ":3004/api/v1/shipments/bulk",
  LABELS: ":3004/api/v1/shipments/labels",
  PICKUP: ":3004/api/v1/shipments/pickup",
  // ... and many more pickup endpoints
}
```

## Core Components

### 1. API Service (`/src/services/api/shipment-api.ts`)

The main API service class that handles all shipment-related API calls:

```typescript
import { shipmentApiService } from "@/services";

// Create a shipment
const response = await shipmentApiService.createShipment(shipmentData);

// Get shipments with filters
const response = await shipmentApiService.getShipments({
  status: "in-transit",
  page: 1,
  limit: 10,
});

// Create pickup
const response = await shipmentApiService.createPickup(pickupData);

// Generate labels
const response = await shipmentApiService.generateLabels({
  shipmentIds: ["id1", "id2"],
  format: "pdf",
  size: "A4",
});
```

### 2. Zustand Store (`/src/store/shipmentStore.ts`)

Global state management for shipments:

```typescript
import { useShipmentStore } from "@/store/shipmentStore";

const {
  shipments,
  currentShipment,
  loading,
  error,
  createShipment,
  getShipments,
  updateShipment,
  cancelShipment,
} = useShipmentStore();
```

### 3. Custom Hooks (`/src/hooks/useShipments.ts`)

Simplified hooks for different shipment operations:

```typescript
import {
  useShipments,
  usePickups,
  useNDR,
  useBulkOperations,
} from "@/hooks/useShipments";

// Main shipments hook
const shipments = useShipments();

// Pickup management hook
const pickups = usePickups();

// NDR management hook
const ndr = useNDR();

// Bulk operations hook
const bulkOps = useBulkOperations();
```

## Usage Examples

### Basic Shipment Operations

```typescript
import { useShipments } from "@/hooks/useShipments";

function ShipmentComponent() {
  const {
    shipments,
    loading,
    error,
    createShipment,
    getShipments,
    updateShipment,
    cancelShipment
  } = useShipments();

  // Load shipments on mount
  useEffect(() => {
    getShipments();
  }, []);

  // Create new shipment
  const handleCreate = async (data: CreateShipmentRequest) => {
    const success = await createShipment(data);
    if (success) {
      // Refresh the list
      getShipments();
    }
  };

  // Update shipment status
  const handleStatusUpdate = (id: string, status: string) => {
    updateShipmentStatus(id, status);
  };

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      {shipments.map(shipment => (
        <div key={shipment.id}>
          <h3>Order #{shipment.orderId}</h3>
          <p>Status: {shipment.status}</p>
          <p>AWB: {shipment.awbNumber}</p>
        </div>
      ))}
    </div>
  );
}
```

### Pickup Management

```typescript
import { usePickups } from "@/hooks/useShipments";

function PickupComponent() {
  const {
    pickupSchedules,
    pickupLoading,
    createPickup,
    getPickupSchedules,
    getPickupSlots
  } = usePickups();

  // Get available pickup slots
  const handleGetSlots = async (partnerId: string, date: string) => {
    try {
      const slots = await getPickupSlots(partnerId, date);
      console.log("Available slots:", slots);
    } catch (error) {
      console.error("Failed to get slots:", error);
    }
  };

  // Create pickup request
  const handleCreatePickup = async (data: CreatePickupRequest) => {
    const success = await createPickup(data);
    if (success) {
      // Refresh pickup schedules
      getPickupSchedules();
    }
  };

  return (
    <div>
      {pickupLoading && <div>Loading pickups...</div>}
      {pickupSchedules.map(pickup => (
        <div key={pickup.id}>
          <h3>Pickup #{pickup.id}</h3>
          <p>Status: {pickup.status}</p>
          <p>Scheduled: {pickup.scheduledDate}</p>
        </div>
      ))}
    </div>
  );
}
```

### NDR Management

```typescript
import { useNDR } from "@/hooks/useShipments";

function NDRComponent() {
  const {
    ndrReports,
    ndrLoading,
    createNDR,
    getNDRReports
  } = useNDR();

  // Create NDR report
  const handleCreateNDR = async (data: CreateNDRRequest) => {
    const success = await createNDR(data);
    if (success) {
      // Refresh NDR reports
      getNDRReports();
    }
  };

  return (
    <div>
      {ndrLoading && <div>Loading NDR reports...</div>}
      {ndrReports.map(ndr => (
        <div key={ndr.id}>
          <h3>NDR #{ndr.id}</h3>
          <p>Reason: {ndr.reason}</p>
          <p>Status: {ndr.status}</p>
        </div>
      ))}
    </div>
  );
}
```

### Bulk Operations

```typescript
import { useBulkOperations } from "@/hooks/useShipments";

function BulkComponent() {
  const { createBulkShipments, generateLabels } = useBulkOperations();

  // Create multiple shipments
  const handleBulkCreate = async (shipments: CreateShipmentRequest[]) => {
    const success = await createBulkShipments({ shipments });
    if (success) {
      console.log("Bulk shipments created successfully");
    }
  };

  // Generate labels for multiple shipments
  const handleGenerateLabels = async (shipmentIds: string[]) => {
    try {
      const response = await generateLabels({
        shipmentIds,
        format: "pdf",
        size: "A4"
      });

      if (response.status === "success" && response.data?.downloadUrl) {
        window.open(response.data.downloadUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to generate labels:", error);
    }
  };

  return (
    <div>
      <button onClick={() => handleBulkCreate(shipmentData)}>
        Create Bulk Shipments
      </button>
      <button onClick={() => handleGenerateLabels(["id1", "id2"])}>
        Generate Labels
      </button>
    </div>
  );
}
```

## TypeScript Types

All types are defined in `/src/types/shipment.ts`:

```typescript
// Basic shipment types
interface Shipment {
  id: string;
  orderId: string;
  awbNumber: string;
  status: ShipmentStatus;
  pickupAddress: Address;
  deliveryAddress: Address;
  packageDetails: PackageDetails;
  // ... more fields
}

// Pickup management types
interface PickupSchedule {
  id: string;
  shipmentId: string;
  partnerId: string;
  scheduledDate: string;
  timeSlot: string;
  status: "scheduled" | "picked" | "failed" | "cancelled";
  // ... more fields
}

// NDR types
interface NDRReport {
  id: string;
  shipmentId: string;
  reason: string;
  reasonCode: string;
  status: "pending" | "resolved" | "escalated";
  // ... more fields
}
```

## Error Handling

The API service includes comprehensive error handling:

```typescript
try {
  const response = await shipmentApiService.createShipment(data);
  if (response.status === "success") {
    // Handle success
    console.log("Shipment created:", response.data);
  } else {
    // Handle API error
    console.error("API Error:", response.error);
  }
} catch (error) {
  // Handle network/other errors
  console.error("Request failed:", error);
}
```

## State Management

The Zustand store provides:

- **Automatic persistence** - State is saved to localStorage
- **Optimistic updates** - UI updates immediately
- **Error handling** - Centralized error state
- **Loading states** - Track async operations
- **Pagination** - Built-in pagination support

## Authentication

The API service automatically includes authentication headers:

```typescript
// Set token for all services
import { setTokenForAllServices } from "@/services";

setTokenForAllServices(userToken);

// Or set token for specific service
shipmentApiService.setAccessToken(userToken);
```

## Best Practices

1. **Always use the hooks** instead of direct API calls
2. **Handle loading and error states** in your components
3. **Use TypeScript types** for better development experience
4. **Implement proper error boundaries** for complex operations
5. **Use the store for global state** and local state for component-specific data

## Example Component

See `/src/components/shipments/ShipmentManager.tsx` for a complete example of how to use all the shipment API features in a React component.

## API Response Format

All API responses follow this format:

```typescript
interface ApiResponse<T> {
  status: "success" | "error";
  data?: T;
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
```

## Testing

The API service can be easily mocked for testing:

```typescript
// Mock the API service
jest.mock("@/services", () => ({
  shipmentApiService: {
    createShipment: jest.fn(),
    getShipments: jest.fn(),
    // ... other methods
  },
}));
```

This comprehensive integration provides everything you need to manage shipments, pickups, NDRs, and bulk operations in your logistics application.
