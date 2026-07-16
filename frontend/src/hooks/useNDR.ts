import { useEffect, useCallback } from "react";
import { useNDRStore, useNDRSelectors, useNDRActions } from "@/store/ndrStore";
import { useAppSelector } from "@/store/hooks";
import { CreateNDRRequest, NDRFilters } from "@/types/shipment";

/**
 * Hook for NDR data and actions
 */
export function useNDR() {
  const accessToken = useAppSelector((s) => s.auth.token);
  const selectors = useNDRSelectors();
  const actions = useNDRActions();

  // Additional store fields not exposed by the selector/action hooks
  const setAccessToken = useNDRStore((state) => state.setAccessToken);
  const creating = useNDRStore((state) => state.creating);
  const updating = useNDRStore((state) => state.updating);
  const fetchingStats = useNDRStore((state) => state.fetchingStats);
  const currentNDR = useNDRStore((state) => state.currentNDR);

  // Set access token when it changes
  useEffect(() => {
    if (accessToken) {
      setAccessToken(accessToken);
    }
  }, [accessToken, setAccessToken]);

  return {
    ...selectors,
    ...actions,
    setAccessToken,
    creating,
    updating,
    fetchingStats,
    currentNDR,
  };
}

/**
 * Hook for fetching NDRs with automatic loading
 */
export function useNDRs(filters?: NDRFilters, autoFetch = true) {
  const { ndrs, loading, error, pagination, fetchNDRs, setFilters } = useNDR();

  // Serialize filters so effect/callback deps are stable across renders
  // (callers pass an inline object literal recreated every render).
  const filtersKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    if (autoFetch) {
      fetchNDRs(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, filtersKey, fetchNDRs]);

  const refetch = useCallback(() => {
    fetchNDRs(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchNDRs, filtersKey]);

  const updateFilters = useCallback(
    (newFilters: Partial<NDRFilters>) => {
      setFilters(newFilters);
    },
    [setFilters],
  );

  return {
    ndrs,
    loading,
    error,
    pagination,
    refetch,
    updateFilters,
  };
}

/**
 * Hook for fetching NDRs for a specific shipment
 */
export function useShipmentNDRs(shipmentId: string, autoFetch = true) {
  const { ndrs, loading, error, fetchShipmentNDRs } = useNDR();

  useEffect(() => {
    if (autoFetch && shipmentId) {
      fetchShipmentNDRs(shipmentId);
    }
  }, [autoFetch, shipmentId, fetchShipmentNDRs]);

  const refetch = useCallback(() => {
    if (shipmentId) {
      fetchShipmentNDRs(shipmentId);
    }
  }, [fetchShipmentNDRs, shipmentId]);

  return {
    ndrs,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for NDR creation
 */
export function useCreateNDR() {
  const { creating, error, createNDR, clearError } = useNDR();

  const handleCreateNDR = useCallback(
    async (request: CreateNDRRequest) => {
      try {
        await createNDR(request);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create NDR",
        };
      }
    },
    [createNDR],
  );

  return {
    creating,
    error,
    createNDR: handleCreateNDR,
    clearError,
  };
}

/**
 * Hook for updating NDR status
 */
export function useUpdateNDRStatus() {
  const { updating, error, updateNDRStatus, clearError } = useNDR();

  const handleUpdateStatus = useCallback(
    async (
      ndrId: string,
      status: "resolved" | "escalated",
      resolution?: string,
    ) => {
      try {
        await updateNDRStatus(ndrId, status, resolution);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update NDR status",
        };
      }
    },
    [updateNDRStatus],
  );

  return {
    updating,
    error,
    updateStatus: handleUpdateStatus,
    clearError,
  };
}

/**
 * Hook for NDR statistics
 */
export function useNDRStats(
  dateFrom?: string,
  dateTo?: string,
  autoFetch = true,
) {
  const { stats, fetchingStats, error, fetchNDRStats } = useNDR();

  useEffect(() => {
    if (autoFetch) {
      fetchNDRStats(dateFrom, dateTo);
    }
  }, [autoFetch, dateFrom, dateTo, fetchNDRStats]);

  const refetch = useCallback(() => {
    fetchNDRStats(dateFrom, dateTo);
  }, [fetchNDRStats, dateFrom, dateTo]);

  return {
    stats,
    loading: fetchingStats,
    error,
    refetch,
  };
}

/**
 * Hook for NDR reasons
 */
export function useNDRReasons(autoFetch = true) {
  const { ndrReasons, loading, error, fetchNDRReasons } = useNDR();

  useEffect(() => {
    if (autoFetch) {
      fetchNDRReasons();
    }
  }, [autoFetch, fetchNDRReasons]);

  const refetch = useCallback(() => {
    fetchNDRReasons();
  }, [fetchNDRReasons]);

  return {
    ndrReasons,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for NDR management with all features
 */
export function useNDRManagement() {
  const ndr = useNDR();
  const ndrs = useNDRs();
  const createNDR = useCreateNDR();
  const updateStatus = useUpdateNDRStatus();
  const stats = useNDRStats();
  const reasons = useNDRReasons();

  return {
    // Data
    ndrs: ndr.ndrs,
    ndrReasons: ndr.ndrReasons,
    stats: ndr.stats,
    currentNDR: ndr.currentNDR,

    // Loading states
    loading: ndr.loading,
    creating: ndr.creating,
    updating: ndr.updating,
    fetchingStats: ndr.fetchingStats,

    // Error states
    error: ndr.error,

    // Pagination
    pagination: ndr.pagination,

    // Actions
    fetchNDRs: ndr.fetchNDRs,
    fetchShipmentNDRs: ndr.fetchShipmentNDRs,
    fetchNDRStats: ndr.fetchNDRStats,
    createNDR: createNDR.createNDR,
    updateNDRStatus: updateStatus.updateStatus,
    setCurrentNDR: ndr.setCurrentNDR,
    setFilters: ndr.setFilters,
    clearError: ndr.clearError,

    // Computed values
    pendingCount: ndr.stats?.pending || 0,
    resolvedCount: ndr.stats?.resolved || 0,
    escalatedCount: ndr.stats?.escalated || 0,
    totalCount: ndr.stats?.total || 0,
  };
}
