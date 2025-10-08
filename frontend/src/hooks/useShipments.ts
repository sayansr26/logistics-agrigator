import { useCallback } from "react";
import { useShipmentStore } from "@/store/shipmentStore";
import {
  CreateShipmentRequest,
  ShipmentFilters,
  CreatePickupRequest,
  CreateNDRRequest,
  BulkShipmentRequest,
  LabelRequest,
  ShipmentStatus,
} from "@/types/shipment";

// Main shipment hook
export function useShipments() {
  const {
    shipments,
    currentShipment,
    loading,
    error,
    pagination,
    createShipment,
    getShipments,
    getShipmentById,
    updateShipment,
    cancelShipment,
    clearError,
    setCurrentShipment,
    updateShipmentStatus,
  } = useShipmentStore();

  const handleCreateShipment = useCallback(
    async (data: CreateShipmentRequest) => {
      try {
        await createShipment(data);
        return true;
      } catch (error) {
        console.error("Failed to create shipment:", error);
        return false;
      }
    },
    [createShipment],
  );

  const handleGetShipments = useCallback(
    async (filters?: ShipmentFilters) => {
      try {
        await getShipments(filters);
        return true;
      } catch (error) {
        console.error("Failed to fetch shipments:", error);
        return false;
      }
    },
    [getShipments],
  );

  const handleGetShipmentById = useCallback(
    async (id: string) => {
      try {
        await getShipmentById(id);
        return true;
      } catch (error) {
        console.error("Failed to fetch shipment:", error);
        return false;
      }
    },
    [getShipmentById],
  );

  const handleUpdateShipment = useCallback(
    async (id: string, data: Partial<CreateShipmentRequest>) => {
      try {
        await updateShipment(id, data);
        return true;
      } catch (error) {
        console.error("Failed to update shipment:", error);
        return false;
      }
    },
    [updateShipment],
  );

  const handleCancelShipment = useCallback(
    async (id: string) => {
      try {
        await cancelShipment(id);
        return true;
      } catch (error) {
        console.error("Failed to cancel shipment:", error);
        return false;
      }
    },
    [cancelShipment],
  );

  const handleStatusUpdate = useCallback(
    (id: string, status: ShipmentStatus) => {
      updateShipmentStatus(id, status);
    },
    [updateShipmentStatus],
  );

  return {
    // State
    shipments,
    currentShipment,
    loading,
    error,
    pagination,

    // Actions
    createShipment: handleCreateShipment,
    getShipments: handleGetShipments,
    getShipmentById: handleGetShipmentById,
    updateShipment: handleUpdateShipment,
    cancelShipment: handleCancelShipment,
    updateShipmentStatus: handleStatusUpdate,
    clearError,
    setCurrentShipment,

    // Computed values
    totalShipments: pagination.total,
    hasShipments: shipments.length > 0,
    isLoading: loading,
    hasError: !!error,
  };
}

// Pickup management hook
export function usePickups() {
  const {
    pickupSchedules,
    pickupLoading,
    pickupError,
    createPickup,
    getPickupSchedules,
    getPickupSlots,
    updatePickup,
    cancelPickup,
    clearError,
  } = useShipmentStore();

  const handleCreatePickup = useCallback(
    async (data: CreatePickupRequest) => {
      try {
        await createPickup(data);
        return true;
      } catch (error) {
        console.error("Failed to create pickup:", error);
        return false;
      }
    },
    [createPickup],
  );

  const handleGetPickupSchedules = useCallback(
    async (filters?: any) => {
      try {
        await getPickupSchedules(filters);
        return true;
      } catch (error) {
        console.error("Failed to fetch pickup schedules:", error);
        return false;
      }
    },
    [getPickupSchedules],
  );

  const handleGetPickupSlots = useCallback(
    async (partnerId: string, date: string) => {
      try {
        const response = await getPickupSlots(partnerId, date);
        return response;
      } catch (error) {
        console.error("Failed to fetch pickup slots:", error);
        throw error;
      }
    },
    [getPickupSlots],
  );

  const handleUpdatePickup = useCallback(
    async (id: string, data: Partial<CreatePickupRequest>) => {
      try {
        await updatePickup(id, data);
        return true;
      } catch (error) {
        console.error("Failed to update pickup:", error);
        return false;
      }
    },
    [updatePickup],
  );

  const handleCancelPickup = useCallback(
    async (id: string) => {
      try {
        await cancelPickup(id);
        return true;
      } catch (error) {
        console.error("Failed to cancel pickup:", error);
        return false;
      }
    },
    [cancelPickup],
  );

  return {
    // State
    pickupSchedules,
    pickupLoading,
    pickupError,

    // Actions
    createPickup: handleCreatePickup,
    getPickupSchedules: handleGetPickupSchedules,
    getPickupSlots: handleGetPickupSlots,
    updatePickup: handleUpdatePickup,
    cancelPickup: handleCancelPickup,
    clearError,

    // Computed values
    hasPickups: pickupSchedules.length > 0,
    isPickupLoading: pickupLoading,
    hasPickupError: !!pickupError,
  };
}

// NDR management hook
export function useNDR() {
  const {
    ndrReports,
    ndrLoading,
    ndrError,
    createNDR,
    getNDRReports,
    clearError,
  } = useShipmentStore();

  const handleCreateNDR = useCallback(
    async (data: CreateNDRRequest) => {
      try {
        await createNDR(data);
        return true;
      } catch (error) {
        console.error("Failed to create NDR:", error);
        return false;
      }
    },
    [createNDR],
  );

  const handleGetNDRReports = useCallback(
    async (filters?: any) => {
      try {
        await getNDRReports(filters);
        return true;
      } catch (error) {
        console.error("Failed to fetch NDR reports:", error);
        return false;
      }
    },
    [getNDRReports],
  );

  return {
    // State
    ndrReports,
    ndrLoading,
    ndrError,

    // Actions
    createNDR: handleCreateNDR,
    getNDRReports: handleGetNDRReports,
    clearError,

    // Computed values
    hasNDRReports: ndrReports.length > 0,
    isNDRLoading: ndrLoading,
    hasNDRError: !!ndrError,
  };
}

// Bulk operations hook
export function useBulkOperations() {
  const { createBulkShipments, generateLabels, loading, error } =
    useShipmentStore();

  const handleCreateBulkShipments = useCallback(
    async (data: BulkShipmentRequest) => {
      try {
        await createBulkShipments(data);
        return true;
      } catch (error) {
        console.error("Failed to create bulk shipments:", error);
        return false;
      }
    },
    [createBulkShipments],
  );

  const handleGenerateLabels = useCallback(
    async (data: LabelRequest) => {
      try {
        const response = await generateLabels(data);
        return response;
      } catch (error) {
        console.error("Failed to generate labels:", error);
        throw error;
      }
    },
    [generateLabels],
  );

  return {
    // State
    loading,
    error,

    // Actions
    createBulkShipments: handleCreateBulkShipments,
    generateLabels: handleGenerateLabels,

    // Computed values
    isLoading: loading,
    hasError: !!error,
  };
}

// Combined hook for all shipment operations
export function useShipmentOperations() {
  const shipments = useShipments();
  const pickups = usePickups();
  const ndr = useNDR();
  const bulkOps = useBulkOperations();

  return {
    shipments,
    pickups,
    ndr,
    bulkOps,
  };
}
