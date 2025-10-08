import { create } from "zustand";
import { persist } from "zustand/middleware";
import { shipmentApiService } from "@/services";
import {
  Shipment,
  CreateShipmentRequest,
  ShipmentFilters,
  PickupSchedule,
  CreatePickupRequest,
  NDRReport,
  CreateNDRRequest,
  BulkShipmentRequest,
  LabelRequest,
  ShipmentStatus,
} from "@/types/shipment";

interface ShipmentState {
  // Shipments
  shipments: Shipment[];
  currentShipment: Shipment | null;
  loading: boolean;
  error: string | null;

  // Pickup Management
  pickupSchedules: PickupSchedule[];
  pickupLoading: boolean;
  pickupError: string | null;

  // NDR Management
  ndrReports: NDRReport[];
  ndrLoading: boolean;
  ndrError: string | null;

  // Pagination
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Actions
  // Shipment CRUD
  createShipment: (data: CreateShipmentRequest) => Promise<void>;
  getShipments: (filters?: ShipmentFilters) => Promise<void>;
  getShipmentById: (id: string) => Promise<void>;
  updateShipment: (
    id: string,
    data: Partial<CreateShipmentRequest>,
  ) => Promise<void>;
  cancelShipment: (id: string) => Promise<void>;

  // Pickup Management
  createPickup: (data: CreatePickupRequest) => Promise<void>;
  getPickupSchedules: (filters?: any) => Promise<void>;
  getPickupSlots: (partnerId: string, date: string) => Promise<any>;
  updatePickup: (
    id: string,
    data: Partial<CreatePickupRequest>,
  ) => Promise<void>;
  cancelPickup: (id: string) => Promise<void>;

  // NDR Management
  createNDR: (data: CreateNDRRequest) => Promise<void>;
  getNDRReports: (filters?: any) => Promise<void>;

  // Bulk Operations
  createBulkShipments: (data: BulkShipmentRequest) => Promise<void>;

  // Label Generation
  generateLabels: (data: LabelRequest) => Promise<any>;

  // Utility Actions
  clearError: () => void;
  setCurrentShipment: (shipment: Shipment | null) => void;
  updateShipmentStatus: (id: string, status: ShipmentStatus) => void;
}

export const useShipmentStore = create<ShipmentState>()(
  persist(
    (set, get) => ({
      // Initial State
      shipments: [],
      currentShipment: null,
      loading: false,
      error: null,

      pickupSchedules: [],
      pickupLoading: false,
      pickupError: null,

      ndrReports: [],
      ndrLoading: false,
      ndrError: null,

      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },

      // Shipment CRUD Actions
      createShipment: async (data: CreateShipmentRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await shipmentApiService.createShipment(data);
          if (response.status === "success" && response.data?.shipment) {
            set((state) => ({
              shipments: [response.data!.shipment, ...state.shipments],
              loading: false,
            }));
          } else {
            throw new Error(
              response.error?.message || "Failed to create shipment",
            );
          }
        } catch (error) {
          set({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to create shipment",
          });
          throw error;
        }
      },

      getShipments: async (filters?: ShipmentFilters) => {
        set({ loading: true, error: null });
        try {
          const response = await shipmentApiService.getShipments(filters);
          if (response.status === "success" && response.data) {
            set({
              shipments: response.data.shipments,
              pagination: response.data.pagination,
              loading: false,
            });
          } else {
            throw new Error(
              response.error?.message || "Failed to fetch shipments",
            );
          }
        } catch (error) {
          set({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch shipments",
          });
          throw error;
        }
      },

      getShipmentById: async (id: string) => {
        set({ loading: true, error: null });
        try {
          const response = await shipmentApiService.getShipmentById(id);
          if (response.status === "success" && response.data?.shipment) {
            set({
              currentShipment: response.data.shipment,
              loading: false,
            });
          } else {
            throw new Error(
              response.error?.message || "Failed to fetch shipment",
            );
          }
        } catch (error) {
          set({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch shipment",
          });
          throw error;
        }
      },

      updateShipment: async (
        id: string,
        data: Partial<CreateShipmentRequest>,
      ) => {
        set({ loading: true, error: null });
        try {
          const response = await shipmentApiService.updateShipment(id, data);
          if (response.status === "success" && response.data?.shipment) {
            set((state) => ({
              shipments: state.shipments.map((shipment) =>
                shipment.id === id ? response.data!.shipment : shipment,
              ),
              currentShipment:
                state.currentShipment?.id === id
                  ? response.data!.shipment
                  : state.currentShipment,
              loading: false,
            }));
          } else {
            throw new Error(
              response.error?.message || "Failed to update shipment",
            );
          }
        } catch (error) {
          set({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to update shipment",
          });
          throw error;
        }
      },

      cancelShipment: async (id: string) => {
        set({ loading: true, error: null });
        try {
          const response = await shipmentApiService.cancelShipment(id);
          if (response.status === "success" && response.data?.shipment) {
            set((state) => ({
              shipments: state.shipments.map((shipment) =>
                shipment.id === id ? response.data!.shipment : shipment,
              ),
              currentShipment:
                state.currentShipment?.id === id
                  ? response.data!.shipment
                  : state.currentShipment,
              loading: false,
            }));
          } else {
            throw new Error(
              response.error?.message || "Failed to cancel shipment",
            );
          }
        } catch (error) {
          set({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to cancel shipment",
          });
          throw error;
        }
      },

      // Pickup Management Actions
      createPickup: async (data: CreatePickupRequest) => {
        set({ pickupLoading: true, pickupError: null });
        try {
          const response = await shipmentApiService.createPickup(data);
          if (response.status === "success" && response.data?.pickup) {
            set((state) => ({
              pickupSchedules: [
                response.data!.pickup,
                ...state.pickupSchedules,
              ],
              pickupLoading: false,
            }));
          } else {
            throw new Error(
              response.error?.message || "Failed to create pickup",
            );
          }
        } catch (error) {
          set({
            pickupLoading: false,
            pickupError:
              error instanceof Error
                ? error.message
                : "Failed to create pickup",
          });
          throw error;
        }
      },

      getPickupSchedules: async (filters?: any) => {
        set({ pickupLoading: true, pickupError: null });
        try {
          const response = await shipmentApiService.getPickupSchedules(filters);
          if (response.status === "success" && response.data?.pickup) {
            set({
              pickupSchedules: Array.isArray(response.data.pickup)
                ? response.data.pickup
                : [response.data.pickup],
              pickupLoading: false,
            });
          } else {
            throw new Error(
              response.error?.message || "Failed to fetch pickup schedules",
            );
          }
        } catch (error) {
          set({
            pickupLoading: false,
            pickupError:
              error instanceof Error
                ? error.message
                : "Failed to fetch pickup schedules",
          });
          throw error;
        }
      },

      getPickupSlots: async (partnerId: string, date: string) => {
        try {
          const response = await shipmentApiService.getPickupSlots(
            partnerId,
            date,
          );
          return response;
        } catch (error) {
          throw error;
        }
      },

      updatePickup: async (id: string, data: Partial<CreatePickupRequest>) => {
        set({ pickupLoading: true, pickupError: null });
        try {
          const response = await shipmentApiService.updatePickup(id, data);
          if (response.status === "success" && response.data?.pickup) {
            set((state) => ({
              pickupSchedules: state.pickupSchedules.map((pickup) =>
                pickup.id === id ? response.data!.pickup : pickup,
              ),
              pickupLoading: false,
            }));
          } else {
            throw new Error(
              response.error?.message || "Failed to update pickup",
            );
          }
        } catch (error) {
          set({
            pickupLoading: false,
            pickupError:
              error instanceof Error
                ? error.message
                : "Failed to update pickup",
          });
          throw error;
        }
      },

      cancelPickup: async (id: string) => {
        set({ pickupLoading: true, pickupError: null });
        try {
          const response = await shipmentApiService.cancelPickup(id);
          if (response.status === "success" && response.data?.pickup) {
            set((state) => ({
              pickupSchedules: state.pickupSchedules.map((pickup) =>
                pickup.id === id ? response.data!.pickup : pickup,
              ),
              pickupLoading: false,
            }));
          } else {
            throw new Error(
              response.error?.message || "Failed to cancel pickup",
            );
          }
        } catch (error) {
          set({
            pickupLoading: false,
            pickupError:
              error instanceof Error
                ? error.message
                : "Failed to cancel pickup",
          });
          throw error;
        }
      },

      // NDR Management Actions
      createNDR: async (data: CreateNDRRequest) => {
        set({ ndrLoading: true, ndrError: null });
        try {
          const response = await shipmentApiService.createNDR(data);
          if (response.status === "success" && response.data?.ndr) {
            set((state) => ({
              ndrReports: [response.data!.ndr, ...state.ndrReports],
              ndrLoading: false,
            }));
          } else {
            throw new Error(response.error?.message || "Failed to create NDR");
          }
        } catch (error) {
          set({
            ndrLoading: false,
            ndrError:
              error instanceof Error ? error.message : "Failed to create NDR",
          });
          throw error;
        }
      },

      getNDRReports: async (filters?: any) => {
        set({ ndrLoading: true, ndrError: null });
        try {
          const response = await shipmentApiService.getNDRs(filters);
          if (response.status === "success" && response.data?.ndrs) {
            set({
              ndrReports: response.data.ndrs,
              ndrLoading: false,
            });
          } else {
            throw new Error(
              response.error?.message || "Failed to fetch NDR reports",
            );
          }
        } catch (error) {
          set({
            ndrLoading: false,
            ndrError:
              error instanceof Error
                ? error.message
                : "Failed to fetch NDR reports",
          });
          throw error;
        }
      },

      // Bulk Operations
      createBulkShipments: async (data: BulkShipmentRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await shipmentApiService.createBulkShipments(data);
          if (response.status === "success" && response.data?.shipments) {
            set((state) => ({
              shipments: [...response.data!.shipments, ...state.shipments],
              loading: false,
            }));
          } else {
            throw new Error(
              response.error?.message || "Failed to create bulk shipments",
            );
          }
        } catch (error) {
          set({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to create bulk shipments",
          });
          throw error;
        }
      },

      // Label Generation
      generateLabels: async (data: LabelRequest) => {
        try {
          const response = await shipmentApiService.generateLabels(data);
          return response;
        } catch (error) {
          throw error;
        }
      },

      // Utility Actions
      clearError: () => {
        set({ error: null, pickupError: null, ndrError: null });
      },

      setCurrentShipment: (shipment: Shipment | null) => {
        set({ currentShipment: shipment });
      },

      updateShipmentStatus: (id: string, status: ShipmentStatus) => {
        set((state) => ({
          shipments: state.shipments.map((shipment) =>
            shipment.id === id ? { ...shipment, status } : shipment,
          ),
          currentShipment:
            state.currentShipment?.id === id
              ? { ...state.currentShipment, status }
              : state.currentShipment,
        }));
      },
    }),
    {
      name: "shipment-storage",
      partialize: (state) => ({
        shipments: state.shipments,
        currentShipment: state.currentShipment,
        pickupSchedules: state.pickupSchedules,
        ndrReports: state.ndrReports,
        pagination: state.pagination,
      }),
    },
  ),
);
