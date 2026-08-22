"use client";

/**
 * AWB allocation mode.
 *
 * Most clients let the courier allocate the waybill when we book. Clients who
 * hold pre-printed courier stationery need to book against the number already
 * on the label instead — booking through the courier would allocate a second
 * number and the parcel would travel under a label we never recorded. Choosing
 * Manual therefore records the number and skips the courier booking call.
 */

import { Barcode } from "lucide-react";
import { useShipmentForm } from "@/components/shipments/create/form-store-context";

const inputClass =
  "w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

export function AwbSection() {
  const store = useShipmentForm();
  const isManual = store.awbMode === "MANUAL";

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Barcode className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-bold text-foreground">AWB Number</h2>
      </div>

      <fieldset className="space-y-2.5">
        <legend className="sr-only">How the AWB is allocated</legend>

        <label
          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
            !isManual
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <input
            type="radio"
            name="awbMode"
            className="mt-0.5 h-4 w-4"
            checked={!isManual}
            onChange={() => store.setField("awbMode", "AUTO")}
          />
          <span>
            <span className="block text-xs font-semibold text-foreground">
              Automatic AWB
            </span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              The courier allocates the number when the shipment is booked.
            </span>
          </span>
        </label>

        <label
          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
            isManual
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <input
            type="radio"
            name="awbMode"
            className="mt-0.5 h-4 w-4"
            checked={isManual}
            onChange={() => store.setField("awbMode", "MANUAL")}
          />
          <span>
            <span className="block text-xs font-semibold text-foreground">
              Manual AWB
            </span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              Use a number from your own pre-printed courier stationery.
            </span>
          </span>
        </label>
      </fieldset>

      {isManual && (
        <div className="space-y-1.5">
          <label
            htmlFor="manualAwbNumber"
            className="block text-xs font-semibold text-foreground"
          >
            AWB number
          </label>
          <input
            id="manualAwbNumber"
            value={store.manualAwbNumber}
            onChange={(e) => store.setField("manualAwbNumber", e.target.value)}
            placeholder="Enter the number printed on the label"
            className={`${inputClass} font-mono`}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            6–30 characters: letters, digits and hyphens. The courier will not
            be asked to allocate a number, so this must match the physical label
            exactly.
          </p>
          {store.errors.manualAwbNumber && (
            <p className="text-[11px] text-red-600">
              {store.errors.manualAwbNumber}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
