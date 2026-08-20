"use client";

import { useMemo } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
import {
  assignedBoxCount,
  boxCount,
  useShipmentFormStore,
} from "@/store/shipment-form-store";

const inputClass =
  "w-full text-xs p-2 rounded-lg border border-input bg-background focus:outline-none focus:border-primary text-center font-medium text-foreground";

export function DimensionsSection() {
  const store = useShipmentFormStore();

  const totalWeight = store.actualWeight || "0";

  // Rows are groups, not individual boxes: one row of 5 is five identical
  // boxes, rows of 2 and 3 are two different shapes. A new group can only be
  // added while boxes are still unassigned.
  const assigned = assignedBoxCount(store.boxes);
  const canAddGroup = assigned < store.numberOfBoxes;

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

      <div className="grid grid-cols-[70px_1fr_1fr_1fr_32px] gap-2 text-[11px] font-bold text-muted-foreground px-1">
        <span>Qty</span>
        <span>Length ({store.dimensionUnit === "CM" ? "cm" : "in"})</span>
        <span>Width ({store.dimensionUnit === "CM" ? "cm" : "in"})</span>
        <span>Height ({store.dimensionUnit === "CM" ? "cm" : "in"})</span>
        <span />
      </div>

      {store.boxes.map((box) => (
        <div
          key={box.id}
          className="grid grid-cols-[70px_1fr_1fr_1fr_32px] gap-2 items-center"
        >
          <input
            type="number"
            min={1}
            max={store.numberOfBoxes}
            value={boxCount(box)}
            onChange={(e) =>
              store.setBoxCount(box.id, parseInt(e.target.value, 10))
            }
            className={inputClass}
            title="How many boxes share these dimensions"
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
          <button
            type="button"
            onClick={() => store.removeBox(box.id)}
            disabled={store.boxes.length <= 1}
            title="Remove this group"
            className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={store.addBox}
          disabled={!canAddGroup}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:hover:text-blue-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Add box size
        </button>
        <span className="text-[11px] font-medium text-muted-foreground">
          {assigned} of {store.numberOfBoxes} boxes sized
        </span>
      </div>

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
