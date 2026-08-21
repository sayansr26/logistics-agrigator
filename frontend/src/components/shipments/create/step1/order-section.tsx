"use client";

import { Package } from "lucide-react";
import { useShipmentForm } from "@/components/shipments/create/form-store-context";

const inputClass =
  "w-full text-xs px-3 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium text-foreground";

export function OrderSection() {
  const store = useShipmentForm();
  const isB2B = store.shipmentType === "B2B";

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Package className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-bold text-foreground">Order Details</h2>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold text-foreground">
          Description*
        </label>
        <input
          placeholder="Enter order description (e.g. Books, Electronics, Industrial Spares)"
          value={store.productDescription}
          onChange={(e) => store.setField("productDescription", e.target.value)}
          className={`${inputClass} ${store.errors.productDescription ? "border-red-400" : ""}`}
        />
        {store.errors.productDescription && (
          <p className="text-[11px] text-red-600">
            {store.errors.productDescription}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            HSN Code
          </label>
          <input
            placeholder="HSN"
            value={store.hsnCode}
            onChange={(e) => store.setField("hsnCode", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            GST (%)
          </label>
          <input
            type="number"
            placeholder="GST %"
            value={store.gstPercentage}
            onChange={(e) => store.setField("gstPercentage", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {isB2B && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-foreground">
              PO Number
            </label>
            <input
              placeholder="Enter Your PO number"
              value={store.poNumber}
              onChange={(e) => store.setField("poNumber", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-foreground">
              PO Expiry Date
            </label>
            <input
              type="date"
              value={store.poExpiryDate}
              onChange={(e) => store.setField("poExpiryDate", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <label className="inline-flex items-center cursor-pointer text-xs text-muted-foreground pt-1">
        <input
          type="checkbox"
          checked={store.isFragile}
          onChange={(e) => store.setField("isFragile", e.target.checked)}
          className="w-3.5 h-3.5 text-blue-600 border-input rounded focus:ring-primary"
        />
        <span className="ml-2">This shipment contains fragile items</span>
      </label>
    </div>
  );
}
