"use client";

import {
  useGetMyWalletInfoQuery,
  useGetOrCreateWalletQuery,
} from "@/store/api/endpoints/walletApi";
import { useRole } from "@/hooks/useRole";
import { useShipmentFormSelector } from "@/components/shipments/create/form-store-context";

type WalletLike = { balance?: number | string };
type Envelope = {
  balance?: number | string;
  wallet?: WalletLike;
  data?: {
    balance?: number | string;
    wallet?: WalletLike;
    data?: { balance?: number | string; wallet?: WalletLike };
  };
};

/**
 * The wallet endpoints wrap the balance differently:
 *   /wallet/my/wallet-info → { wallet: { balance } }
 *   /wallet/admin/wallet   → { wallet_id, user_id, balance, ... }
 * and either may still sit inside a `data` envelope depending on whether the
 * endpoint's transformResponse already unwrapped it. Probe the known shapes
 * instead of assuming one.
 */
export function readWalletBalance(payload: unknown): number | null {
  const p = payload as Envelope | undefined;
  const candidates = [
    p?.wallet?.balance,
    p?.balance,
    p?.data?.wallet?.balance,
    p?.data?.balance,
    p?.data?.data?.wallet?.balance,
    p?.data?.data?.balance,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const balance = Number(candidate);
    if (Number.isFinite(balance)) return balance;
  }

  return null;
}

export interface BookingWallet {
  /** Balance of the wallet this booking will actually debit. */
  balance: number;
  /** False while the balance is still in flight — don't judge sufficiency yet. */
  isKnown: boolean;
  /** True when an admin is spending an outlet's wallet rather than their own. */
  bookingForOutlet: boolean;
  /** Outlet name for labels, when booking on an outlet's behalf. */
  outletName: string;
}

/**
 * The wallet a shipment booking will debit — the single source of truth for
 * every balance shown in the create-shipment flow.
 *
 * Which wallet that is comes from resolveOutletContext in shipmentController:
 * superadmin/admin debit the OUTLET's wallet (keyed by the outlet's phone, sent
 * as outletUserId); every other role — outlet included — debits their own. Any
 * screen that reads a different wallet than the debit will hit shows a balance
 * the user cannot reconcile, and gates the booking on the wrong number.
 */
export function useBookingWallet(): BookingWallet {
  const { isSystemAdmin } = useRole();
  const outletUserId = useShipmentFormSelector((s) => s.outletUserId);
  const outletName = useShipmentFormSelector((s) => s.outletName);

  const bookingForOutlet = isSystemAdmin() && Boolean(outletUserId);

  const { data: myWalletInfo, isFetching: myWalletLoading } =
    useGetMyWalletInfoQuery(undefined, { skip: bookingForOutlet });
  const { data: outletWalletInfo, isFetching: outletWalletLoading } =
    useGetOrCreateWalletQuery(
      { userId: outletUserId },
      { skip: !bookingForOutlet },
    );

  const balance = readWalletBalance(
    bookingForOutlet ? outletWalletInfo : myWalletInfo,
  );
  const isLoading = bookingForOutlet ? outletWalletLoading : myWalletLoading;

  return {
    balance: balance ?? 0,
    isKnown: !isLoading && balance !== null,
    bookingForOutlet,
    outletName,
  };
}
