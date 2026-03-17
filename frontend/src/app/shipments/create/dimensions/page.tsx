"use client";

import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { Package, Plus, Trash2 } from "lucide-react";

export default function DimensionsPage() {
  const { shipmentType, boxes, addBox, removeBox, updateBox } =
    useShipmentFormStore();

  const isB2B = shipmentType === "B2B";

  return (
    <CreateShipmentLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Dimensions</span>
            </div>
            {isB2B && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBox}
                className="gap-1 text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
              >
                <Plus className="h-4 w-4" />
                Add Box
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header labels */}
          <div className="hidden md:grid md:grid-cols-[80px_1fr_1fr_1fr_40px] gap-3 text-xs font-medium text-muted-foreground">
            <span>Box*</span>
            <span>Length (cm)*</span>
            <span>Height (cm)*</span>
            <span>Width (cm)*</span>
            <span />
          </div>

          {boxes.map((box, index) => {
            const vol =
              (parseFloat(box.length) || 0) *
              (parseFloat(box.height) || 0) *
              (parseFloat(box.width) || 0);
            return (
              <div key={box.id} className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_1fr_1fr_40px] gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="md:hidden text-xs">Box*</Label>
                    <Input
                      type="number"
                      min={1}
                      value={index + 1}
                      disabled
                      className="text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden text-xs">Length (cm)*</Label>
                    <Input
                      type="number"
                      placeholder="68"
                      min={1}
                      value={box.length}
                      onChange={(e) =>
                        updateBox(box.id, "length", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden text-xs">Height (cm)*</Label>
                    <Input
                      type="number"
                      placeholder="42"
                      min={1}
                      value={box.height}
                      onChange={(e) =>
                        updateBox(box.id, "height", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden text-xs">Width (cm)*</Label>
                    <Input
                      type="number"
                      placeholder="56"
                      min={1}
                      value={box.width}
                      onChange={(e) =>
                        updateBox(box.id, "width", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    {isB2B && boxes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBox(box.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {vol > 0 && (
                  <div className="text-xs text-muted-foreground pl-1">
                    Volume: {vol.toFixed(2)} cm³
                  </div>
                )}
              </div>
            );
          })}

          {boxes.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No boxes added. Click &quot;Add Box&quot; to start.
            </div>
          )}
        </CardContent>
      </Card>
    </CreateShipmentLayout>
  );
}
