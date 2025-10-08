import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { NDRReport, NDRReason, CreateNDRRequest } from "@/types/shipment";
import { shipmentApiService } from "@/services";

interface NDRStats {
  total: number;
  pending: number;
  resolved: number;
  escalated: number;
  byReason: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

interface NDRFilters {
  status?: "pending" | "resolved" | "escalated";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface NDRState {
  // Data
  ndrs: NDRReport[];
  ndrReasons: NDRReason[];
  stats: NDRStats | null;
  currentNDR: NDRReport | null;

  // Loading states
  loading: boolean;
  creating: boolean;
  updating: boolean;
  fetchingStats: boolean;

  // Error states
  error: string | null;

  // Pagination
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Filters
  filters: NDRFilters;

  // Actions
  setAccessToken: (token: string | null) => void;
  fetchNDRs: (filters?: NDRFilters) => Promise<void>;
  fetchShipmentNDRs: (shipmentId: string) => Promise<void>;
  fetchNDRReasons: () => Promise<void>;
  fetchNDRStats: (dateFrom?: string, dateTo?: string) => Promise<void>;
  createNDR: (request: CreateNDRRequest) => Promise<void>;
  updateNDRStatus: (
    ndrId: string,
    status: "resolved" | "escalated",
    resolution?: string,
  ) => Promise<void>;
  setCurrentNDR: (ndr: NDRReport | null) => void;
  setFilters: (filters: Partial<NDRFilters>) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  ndrs: [],
  ndrReasons: [],
  stats: null,
  currentNDR: null,
  loading: false,
  creating: false,
  updating: false,
  fetchingStats: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    page: 1,
    limit: 10,
  },
};

export const useNDRStore = create<NDRState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setAccessToken: (token: string | null) => {
        shipmentApiService.setAccessToken(token);
      },

      fetchNDRs: async (filters?: NDRFilters) => {
        set({ loading: true, error: null });

        try {
          const currentFilters = { ...get().filters, ...filters };
          const response = await shipmentApiService.getNDRs(currentFilters);

          if (response.status === "success" && response.data) {
            set({
              ndrs: response.data.ndrs,
              pagination: response.data.pagination,
              filters: currentFilters,
              loading: false,
            });
          } else {
            set({
              error: response.error?.message || "Failed to fetch NDRs",
              loading: false,
            });
          }
        } catch (error) {
          console.error("Error fetching NDRs:", error);
          set({
            error:
              error instanceof Error ? error.message : "Failed to fetch NDRs",
            loading: false,
          });
        }
      },

      fetchShipmentNDRs: async (shipmentId: string) => {
        set({ loading: true, error: null });

        try {
          const response = await shipmentApiService.getShipmentNDRs(shipmentId);

          if (response.status === "success" && response.data) {
            set({
              ndrs: response.data.ndrs,
              loading: false,
            });
          } else {
            set({
              error: response.error?.message || "Failed to fetch shipment NDRs",
              loading: false,
            });
          }
        } catch (error) {
          console.error("Error fetching shipment NDRs:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch shipment NDRs",
            loading: false,
          });
        }
      },

      fetchNDRReasons: async () => {
        try {
          const response = await shipmentApiService.getNDRReasons();

          if (response.status === "success" && response.data) {
            set({ ndrReasons: response.data.reasons });
          } else {
            console.error(
              "Failed to fetch NDR reasons:",
              response.error?.message,
            );
          }
        } catch (error) {
          console.error("Error fetching NDR reasons:", error);
        }
      },

      fetchNDRStats: async (dateFrom?: string, dateTo?: string) => {
        set({ fetchingStats: true, error: null });

        try {
          const response = await shipmentApiService.getNDRStats(
            dateFrom,
            dateTo,
          );

          if (response.status === "success" && response.data) {
            set({
              stats: response.data,
              fetchingStats: false,
            });
          } else {
            set({
              error: response.error?.message || "Failed to fetch NDR stats",
              fetchingStats: false,
            });
          }
        } catch (error) {
          console.error("Error fetching NDR stats:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to fetch NDR stats",
            fetchingStats: false,
          });
        }
      },

      createNDR: async (request: CreateNDRRequest) => {
        set({ creating: true, error: null });

        try {
          const response = await shipmentApiService.createNDR(request);

          if (response.status === "success" && response.data) {
            // Add the new NDR to the current list
            set((state) => ({
              ndrs: [response.data!.ndr, ...state.ndrs],
              creating: false,
            }));
          } else {
            set({
              error: response.error?.message || "Failed to create NDR",
              creating: false,
            });
          }
        } catch (error) {
          console.error("Error creating NDR:", error);
          set({
            error:
              error instanceof Error ? error.message : "Failed to create NDR",
            creating: false,
          });
        }
      },

      updateNDRStatus: async (
        ndrId: string,
        status: "resolved" | "escalated",
        resolution?: string,
      ) => {
        set({ updating: true, error: null });

        try {
          const response = await shipmentApiService.updateNDRStatus(
            ndrId,
            status,
            resolution,
          );

          if (response.status === "success" && response.data) {
            // Update the NDR in the current list
            set((state) => ({
              ndrs: state.ndrs.map((ndr) =>
                ndr.id === ndrId ? response.data!.ndr : ndr,
              ),
              updating: false,
            }));
          } else {
            set({
              error: response.error?.message || "Failed to update NDR status",
              updating: false,
            });
          }
        } catch (error) {
          console.error("Error updating NDR status:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to update NDR status",
            updating: false,
          });
        }
      },

      setCurrentNDR: (ndr: NDRReport | null) => {
        set({ currentNDR: ndr });
      },

      setFilters: (filters: Partial<NDRFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "ndr-store",
    },
  ),
);

// Selectors for common use cases
export const useNDRSelectors = () => {
  const ndrs = useNDRStore((state) => state.ndrs);
  const ndrReasons = useNDRStore((state) => state.ndrReasons);
  const stats = useNDRStore((state) => state.stats);
  const loading = useNDRStore((state) => state.loading);
  const error = useNDRStore((state) => state.error);
  const pagination = useNDRStore((state) => state.pagination);

  return {
    ndrs,
    ndrReasons,
    stats,
    loading,
    error,
    pagination,
  };
};

// Action selectors
export const useNDRActions = () => {
  const fetchNDRs = useNDRStore((state) => state.fetchNDRs);
  const fetchShipmentNDRs = useNDRStore((state) => state.fetchShipmentNDRs);
  const fetchNDRReasons = useNDRStore((state) => state.fetchNDRReasons);
  const fetchNDRStats = useNDRStore((state) => state.fetchNDRStats);
  const createNDR = useNDRStore((state) => state.createNDR);
  const updateNDRStatus = useNDRStore((state) => state.updateNDRStatus);
  const setCurrentNDR = useNDRStore((state) => state.setCurrentNDR);
  const setFilters = useNDRStore((state) => state.setFilters);
  const clearError = useNDRStore((state) => state.clearError);

  return {
    fetchNDRs,
    fetchShipmentNDRs,
    fetchNDRReasons,
    fetchNDRStats,
    createNDR,
    updateNDRStatus,
    setCurrentNDR,
    setFilters,
    clearError,
  };
};
