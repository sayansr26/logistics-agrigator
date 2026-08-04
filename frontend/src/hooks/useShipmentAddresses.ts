import { useMemo } from "react";
import {
  useGetMyAddressesQuery,
  useGetOutletAddressesQuery,
} from "@/store/api/endpoints/outletApi";
import type { OutletAddress } from "@/store/api/endpoints/outletApi";

interface UseShipmentAddressesOptions {
  /** Outlet role — fetches its own addresses via /me/addresses. */
  isOutlet: boolean;
  /** Admin/superadmin (or any role acting on behalf of an outlet) — fetches /outlets/:id/addresses. */
  isAdminLike: boolean;
  outletId: string;
}

/**
 * Shared dual-fetch (my-vs-outlet) address book access for the booking
 * wizard. Replaces the triplicated `useGetMyAddressesQuery` /
 * `useGetOutletAddressesQuery` + `find()` logic that used to live in
 * address-section.tsx, confirm/page.tsx, and partners/page.tsx.
 */
export function useShipmentAddresses({
  isOutlet,
  isAdminLike,
  outletId,
}: UseShipmentAddressesOptions) {
  const shouldFetchOutletAddrs = isAdminLike && !!outletId;

  const {
    data: outletAddrsData,
    isLoading: outletLoading,
    isFetching: outletFetching,
    isError: outletError,
    refetch: refetchOutlet,
  } = useGetOutletAddressesQuery(outletId, { skip: !shouldFetchOutletAddrs });

  const {
    data: myAddrsData,
    isLoading: myLoading,
    isFetching: myFetching,
    isError: myError,
    refetch: refetchMy,
  } = useGetMyAddressesQuery(undefined, { skip: !isOutlet });

  const addresses: OutletAddress[] = useMemo(() => {
    if (isOutlet) return myAddrsData?.data?.addresses || [];
    if (isAdminLike && outletId) return outletAddrsData?.data?.addresses || [];
    return [];
  }, [isOutlet, isAdminLike, outletId, myAddrsData, outletAddrsData]);

  const activeAddresses = useMemo(
    () => addresses.filter((a) => a.isActive),
    [addresses],
  );

  const isLoading = isOutlet ? myLoading : outletLoading;
  const isFetching = isOutlet ? myFetching : outletFetching;
  const isError = isOutlet ? myError : outletError;
  const refetch = isOutlet ? refetchMy : refetchOutlet;
  const needsOutletFirst = isAdminLike && !outletId;

  function find(id: string | null | undefined): OutletAddress | undefined {
    if (!id) return undefined;
    return addresses.find((a) => a.id === id);
  }

  /** Active addresses whose addressType is in `types` (case-sensitive, matches backend enum). */
  function byType(types: string[]): OutletAddress[] {
    return activeAddresses.filter((a) => types.includes(a.addressType));
  }

  return {
    addresses,
    activeAddresses,
    isLoading,
    isFetching,
    isError,
    refetch,
    find,
    byType,
    needsOutletFirst,
  };
}
