"use client";

import Link from "next/link";
import { Wallet, Plus } from "lucide-react";
import { useGetMyWalletInfoQuery } from "@/store/api/endpoints/walletApi";

interface WalletCardProps {
  /** System charge of the currently-selected quote, if any - drives the sufficiency badge. */
  requiredAmount?: number;
}

export function WalletCard({ requiredAmount }: WalletCardProps) {
  const { data: walletInfo } = useGetMyWalletInfoQuery();
  const wallet =
    (walletInfo as { data?: { wallet?: { balance?: number } } } | undefined)
      ?.data?.wallet ||
    (walletInfo as { wallet?: { balance?: number } } | undefined)?.wallet;
  const balance: number = Number(wallet?.balance ?? 0);
  const sufficient = requiredAmount == null || balance >= requiredAmount;

  return (
    <div className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl shrink-0">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium">
            Available Wallet Balance
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl font-black text-foreground tracking-tight">
              ₹
              {balance.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                sufficient
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
              }`}
            >
              {sufficient ? "Sufficient" : "Insufficient"}
            </span>
          </div>
        </div>
      </div>
      <Link
        href="/wallet"
        className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        <Plus className="h-3 w-3" /> Topup Wallet
      </Link>
    </div>
  );
}
