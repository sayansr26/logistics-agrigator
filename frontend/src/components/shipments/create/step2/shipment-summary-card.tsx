"use client";

import { useRouter } from "next/navigation";
import { ClipboardCheck, Pencil } from "lucide-react";
import { useShipmentForm } from "@/components/shipments/create/form-store-context";
import type { OutletAddress } from "@/store/api/endpoints/outletApi";

interface ShipmentSummaryCardProps {
  pickupAddr?: OutletAddress;
  rtoAddr?: OutletAddress;
}

export function ShipmentSummaryCard({
  pickupAddr,
  rtoAddr,
}: ShipmentSummaryCardProps) {
  const router = useRouter();
  const store = useShipmentForm();

  const totalInvoiceAmount = store.invoices.reduce(
    (sum, inv) => sum + (parseFloat(inv.invoiceAmt) || 0),
    0,
  );

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-foreground">
            Filled Shipment Details Preview
          </h2>
        </div>
        <button
          type="button"
          onClick={() => router.push("/shipments/create/details")}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" /> Edit Details
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-muted/40 rounded-xl p-3.5 border border-border space-y-1.5">
          <p className="font-bold text-foreground border-b border-border pb-1 mb-2">
            Docket &amp; Order Info
          </p>
          <Row label="Ref No" value={store.referenceNo} mono />
          <Row label="Actual Weight" value={`${store.actualWeight || 0} Kg`} />
          <Row label="Shipment Type" value={store.shipmentType} />
          <Row label="Direction" value={store.shipmentDirection} />
          <Row
            label="Service Type"
            value={
              store.serviceType === "ALL"
                ? "All service types"
                : store.serviceType
            }
          />
          {store.poNumber && <Row label="PO Number" value={store.poNumber} />}
        </div>

        <div className="bg-muted/40 rounded-xl p-3.5 border border-border space-y-1.5">
          <p className="font-bold text-foreground border-b border-border pb-1 mb-2">
            Address Route
          </p>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Pickup
            </span>
            <p className="font-medium text-foreground line-clamp-1">
              {pickupAddr ? `${pickupAddr.city}, ${pickupAddr.pincode}` : "—"}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              RTO / Return
            </span>
            <p className="font-medium text-foreground line-clamp-1">
              {store.rtoSameAsPickup
                ? "Same as Pickup"
                : rtoAddr
                  ? `${rtoAddr.city}, ${rtoAddr.pincode}`
                  : "—"}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Delivery
            </span>
            <p className="font-medium text-foreground line-clamp-1">
              {store.city ? `${store.city}, ${store.pincode}` : "—"}
            </p>
          </div>
        </div>

        <div className="bg-muted/40 rounded-xl p-3.5 border border-border space-y-1.5">
          <p className="font-bold text-foreground border-b border-border pb-1 mb-2">
            Financials
          </p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Mode:</span>
            <span
              className={`font-bold ${store.paymentType === "PREPAID" ? "text-emerald-600" : "text-amber-600"}`}
            >
              {store.paymentType}
            </span>
          </div>
          {store.paymentType === "COD" && (
            <Row label="COD Amount" value={`₹${store.codAmount || 0}`} />
          )}
          <Row
            label="Total Inv. Value"
            value={`₹${totalInvoiceAmount.toFixed(2)}`}
          />
          <Row label="Total Boxes" value={`${store.numberOfBoxes}`} />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span
        className={`font-medium text-foreground ${mono ? "font-mono" : ""}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}
