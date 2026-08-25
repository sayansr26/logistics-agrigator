"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentProvider } from "@/hooks/usePaymentProvider";
import { RechargeModal } from "@/components/wallet/recharge-modal";
import { cn } from "@/lib/utils";

export interface AddMoneyButtonProps {
  suggestedAmount?: number;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  /** default "Add Money" */
  label?: string;
  onSuccess?: (amount: number) => void;
}

const SIZE_HEIGHT: Record<NonNullable<AddMoneyButtonProps["size"]>, string> = {
  sm: "h-9",
  default: "h-10",
  lg: "h-11",
};

/**
 * The single "Add Money" trigger, everywhere in the app.
 *
 * Returns `null` when the payment provider is disabled/unconfigured
 * (`!isAvailable`) - this one line is how "provider disabled => no Add
 * Money button anywhere" is enforced, so no caller has to remember to gate
 * it themselves.
 */
export function AddMoneyButton({
  suggestedAmount,
  variant = "default",
  size = "default",
  className,
  label = "Add Money",
  onSuccess,
}: AddMoneyButtonProps) {
  const [open, setOpen] = useState(false);
  const { isAvailable, isLoading } = usePaymentProvider();

  if (isLoading) {
    return (
      <Skeleton
        className={cn(SIZE_HEIGHT[size], "w-32 rounded-md", className)}
      />
    );
  }

  if (!isAvailable) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      {/* Mounted only while open, so the Razorpay checkout-script-loading
          effect in useRazorpayTopup never runs unless the user has actually
          opened the modal. */}
      {open && (
        <RechargeModal
          open={open}
          onClose={() => setOpen(false)}
          suggestedAmount={suggestedAmount}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}
