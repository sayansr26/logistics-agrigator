"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  ClipboardList,
} from "lucide-react";
import { useUpdateShipmentMutation } from "@/store/api/endpoints/shipmentApi";

const STATUS_OPTIONS = [
  "CREATED",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RTO",
  "HOLD",
] as const;

function formatStatus(s: string) {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

interface LimitedEditFormShipment {
  id: string;
  status: string;
  specialInstructions?: string | null;
}

/**
 * The status / handling-instructions patch, which every shipment accepts
 * regardless of how far along it is. Shown in place of the full wizard once a
 * shipment is past the point where its details can be restructured.
 */
export function LimitedEditForm({
  shipment,
}: {
  shipment: LimitedEditFormShipment;
}) {
  const [updateShipment, { isLoading: saving, isSuccess, error: saveError }] =
    useUpdateShipmentMutation();

  const [status, setStatus] = useState(shipment.status);
  const [specialInstructions, setSpecialInstructions] = useState(
    shipment.specialInstructions || "",
  );

  useEffect(() => {
    setStatus(shipment.status);
    setSpecialInstructions(shipment.specialInstructions || "");
  }, [shipment.status, shipment.specialInstructions]);

  const hasChanges =
    status !== shipment.status ||
    specialInstructions !== (shipment.specialInstructions || "");

  async function handleSave() {
    if (!hasChanges) return;
    try {
      await updateShipment({
        id: shipment.id,
        data: {
          ...(status !== shipment.status ? { status } : {}),
          ...(specialInstructions !== (shipment.specialInstructions || "")
            ? { specialInstructions }
            : {}),
        },
      }).unwrap();
    } catch {
      // Surfaced through saveError below
    }
  }

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <ClipboardList className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-bold text-foreground">Update Shipment</h2>
      </div>

      {isSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Shipment updated successfully.
        </div>
      )}
      {saveError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-xl p-3 flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> Failed to update shipment. Please
          try again.
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-muted-foreground">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full text-xs p-2.5 rounded-lg border border-input bg-background focus:outline-none focus:border-primary font-medium text-foreground"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {formatStatus(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-muted-foreground">
          Special Instructions
        </label>
        <textarea
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          placeholder="Add handling instructions, delivery notes, etc."
          rows={4}
          maxLength={500}
          className="w-full text-xs p-2.5 rounded-lg border border-input bg-background focus:outline-none focus:border-primary text-foreground resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <Link
          href={`/shipments/${shipment.id}`}
          className="px-5 py-2 rounded-xl text-xs font-semibold text-muted-foreground border border-border hover:bg-accent transition-colors"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="px-6 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Save Changes
        </button>
      </div>
    </div>
  );
}
