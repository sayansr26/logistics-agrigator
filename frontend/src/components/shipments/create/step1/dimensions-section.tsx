"use client";

import { useMemo } from "react";
import { Boxes } from "lucide-react";
import { useShipmentFormStore } from "@/store/shipment-form-store";

const inputClass =
  "w-full text-xs p-2 rounded-lg border border-input bg-background focus:outline-none focus:border-primary text-center font-medium text-foreground";

export function DimensionsSection() {
  const store = useShipmentFormStore();

  const totalWeight = store.actualWeight || "0";

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-foreground">
            Weights &amp; Dimensions
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Unit
          </span>
          <select
            value={store.dimensionUnit}
            onChange={(e) =>
              store.setField("dimensionUnit", e.target.value as "CM" | "INCH")
            }
            className="text-xs px-2 py-1 rounded-lg border border-input bg-background focus:outline-none focus:border-primary font-semibold text-foreground cursor-pointer"
          >
            <option value="CM">Cm</option>
            <option value="INCH">Inch</option>
          </select>
        </div>
      </div>

      {/* Rows render 1:1 from boxes[] — count is driven by "Number of boxes"
          in the Docket Information card, not an Add/Remove button here. */}
      <div className="grid grid-cols-[70px_1fr_1fr_1fr] gap-2 text-[11px] font-bold text-muted-foreground px-1">
        <span>Box</span>
        <span>Length ({store.dimensionUnit === "CM" ? "cm" : "in"})</span>
        <span>Width ({store.dimensionUnit === "CM" ? "cm" : "in"})</span>
        <span>Height ({store.dimensionUnit === "CM" ? "cm" : "in"})</span>
      </div>

      {store.boxes.map((box, index) => (
        <div
          key={box.id}
          className="grid grid-cols-[70px_1fr_1fr_1fr] gap-2 items-center"
        >
          <input
            type="number"
            value={index + 1}
            disabled
            className={inputClass}
          />
          <input
            type="number"
            placeholder="68"
            min={1}
            value={box.length}
            onChange={(e) => store.updateBox(box.id, "length", e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="56"
            min={1}
            value={box.width}
            onChange={(e) => store.updateBox(box.id, "width", e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="42"
            min={1}
            value={box.height}
            onChange={(e) => store.updateBox(box.id, "height", e.target.value)}
            className={inputClass}
          />
        </div>
      ))}

      <div className="pt-3 border-t border-border space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">
            Total shipment weight
          </span>
          <span className="font-bold text-foreground">{totalWeight} Kg</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">
            Total no. of boxes
          </span>
          <span className="font-bold text-foreground">
            {store.numberOfBoxes}
          </span>
        </div>
      </div>
    </div>
  );
}

export function useTotalBoxDims() {
  const store = useShipmentFormStore();
  return useMemo(() => {
    const first = store.boxes[0];
    return {
      length: parseFloat(first?.length || "10") || 10,
      width: parseFloat(first?.width || "10") || 10,
      height: parseFloat(first?.height || "10") || 10,
    };
  }, [store.boxes]);
}

/** cm-per-unit multiplier for the store's current dimensionUnit. */
export function unitToCmFactor(unit: "CM" | "INCH"): number {
  return unit === "INCH" ? 2.54 : 1;
}
