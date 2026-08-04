"use client";

import { useEffect, useMemo } from "react";
import { Receipt, Upload } from "lucide-react";
import { useShipmentFormStore } from "@/store/shipment-form-store";

const inputClass =
  "w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-background focus:outline-none focus:border-primary text-foreground font-medium";

export function InvoicePaymentSection() {
  const store = useShipmentFormStore();
  const isB2B = store.shipmentType === "B2B";

  // B2C: always exactly one invoice row. B2B: rows are count-driven by
  // numberOfBoxes (set via the Docket Information card / setNumberOfBoxes),
  // this just reconciles the initial/rehydrated state if it ever drifts
  // (e.g. an old draft, or switching shipment type without touching the box
  // count). Waits for draft rehydration so it never races the persisted
  // state (the cause of duplicated blank rows).
  useEffect(() => {
    if (!store.hasHydrated) return;
    if (isB2B) {
      if (store.invoices.length !== store.numberOfBoxes) {
        store.setNumberOfBoxes(store.numberOfBoxes);
      }
      return;
    }
    if (store.invoices.length === 0) {
      store.addInvoice();
    } else if (store.invoices.length > 1) {
      store.invoices.slice(1).forEach((inv) => store.removeInvoice(inv.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isB2B, store.invoices.length, store.numberOfBoxes, store.hasHydrated]);

  const totalInvoiceAmount = useMemo(
    () =>
      store.invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.invoiceAmt) || 0),
        0,
      ),
    [store.invoices],
  );

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-foreground">Invoice Details</h2>
        </div>
      </div>

      {/* Payment mode */}
      <div className="space-y-2 bg-muted/40 p-3 rounded-xl border border-border">
        <label className="block text-xs font-semibold text-foreground">
          Payment Mode
        </label>
        <div className="flex items-center gap-6 text-xs">
          <label className="inline-flex items-center cursor-pointer text-foreground font-medium">
            <input
              type="radio"
              name="paymentMode"
              checked={store.paymentType === "PREPAID"}
              onChange={() => store.setField("paymentType", "PREPAID")}
              className="w-4 h-4 text-blue-600 border-input focus:ring-primary"
            />
            <span className="ml-2">Prepaid</span>
          </label>
          <label className="inline-flex items-center cursor-pointer text-foreground font-medium">
            <input
              type="radio"
              name="paymentMode"
              checked={store.paymentType === "COD"}
              onChange={() => store.setField("paymentType", "COD")}
              className="w-4 h-4 text-blue-600 border-input focus:ring-primary"
            />
            <span className="ml-2">COD (Cash on Delivery)</span>
          </label>
        </div>

        {store.paymentType === "COD" && (
          <div className="pt-2 mt-2 border-t border-border space-y-1">
            <label className="block text-xs font-semibold text-amber-800 dark:text-amber-400">
              COD Collectable Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                ₹
              </span>
              <input
                type="number"
                placeholder="Enter collectable cash amount..."
                value={store.codAmount}
                onChange={(e) => store.setField("codAmount", e.target.value)}
                className={`${inputClass} pl-7 border-amber-300 dark:border-amber-700 ${
                  store.errors.codAmount ? "border-red-400" : ""
                }`}
              />
            </div>
            {store.errors.codAmount && (
              <p className="text-[11px] text-red-600">
                {store.errors.codAmount}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Invoice rows */}
      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-muted-foreground px-1">
          <div className="col-span-4">E-Way Bill Number</div>
          <div className="col-span-3">Invoice Number*</div>
          <div className="col-span-2">Amount (₹)*</div>
          <div className="col-span-2">Date*</div>
          <div className="col-span-1 text-center">Attach</div>
        </div>

        <div className="space-y-2">
          {store.invoices.map((inv) => (
            <div key={inv.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <input
                  placeholder="E-Way Bill number"
                  value={inv.eWayBillNo}
                  onChange={(e) =>
                    store.updateInvoice(inv.id, "eWayBillNo", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
              <div className="col-span-3">
                <input
                  placeholder="Invoice number"
                  value={inv.invoiceNo}
                  onChange={(e) =>
                    store.updateInvoice(inv.id, "invoiceNo", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  placeholder="0.00"
                  value={inv.invoiceAmt}
                  onChange={(e) =>
                    store.updateInvoice(inv.id, "invoiceAmt", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <input
                  type="date"
                  value={inv.invoiceDate}
                  onChange={(e) =>
                    store.updateInvoice(inv.id, "invoiceDate", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <label
                  className="cursor-pointer text-muted-foreground hover:text-blue-600 p-1"
                  title="Attach file"
                >
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) =>
                      store.updateInvoice(
                        inv.id,
                        "attachment",
                        e.target.files?.[0] || null,
                      )
                    }
                  />
                  <Upload className="h-3.5 w-3.5" />
                </label>
              </div>
            </div>
          ))}
        </div>

        {isB2B && (
          <p className="text-[11px] text-muted-foreground">
            Invoice rows match the &quot;Number of boxes&quot; count set in
            Docket Information — change it there to add or remove rows.
          </p>
        )}
      </div>

      {/* E-way not required */}
      <div className="pt-2 border-t border-border">
        <label className="inline-flex items-center cursor-pointer text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={store.ewayNotRequired}
            onChange={(e) =>
              store.setField("ewayNotRequired", e.target.checked)
            }
            className="w-3.5 h-3.5 text-blue-600 border-input rounded focus:ring-primary"
          />
          <span className="ml-2">
            I will add E-Way Bill later / E-Way Bill not required for this
            shipment
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
        <span className="font-bold text-foreground">Total Invoice Amount</span>
        <span className="font-bold text-foreground text-sm">
          ₹{totalInvoiceAmount.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
