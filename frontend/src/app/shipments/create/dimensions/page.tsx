"use client";

import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { Package, Plus, Trash2 } from "lucide-react";

export default function DimensionsPage() {
  const { boxes, addBox, removeBox, updateBox } = useShipmentFormStore();

  return (
    <CreateShipmentLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Dimensions</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addBox}
              className="flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>Add Box</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>No. of Boxes: {boxes.length}</Label>
            <div className="text-sm text-muted-foreground">
              Total boxes in this shipment
            </div>
          </div>

          {boxes.map((box, index) => (
            <div key={box.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Box {index + 1}</h4>
                {boxes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBox(box.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`length-${box.id}`}>Length(Cm)*</Label>
                  <Input
                    id={`length-${box.id}`}
                    placeholder="10"
                    value={box.length}
                    onChange={(e) =>
                      updateBox(box.id, "length", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`height-${box.id}`}>Height(Cm)*</Label>
                  <Input
                    id={`height-${box.id}`}
                    placeholder="9"
                    value={box.height}
                    onChange={(e) =>
                      updateBox(box.id, "height", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`width-${box.id}`}>Width(Cm)*</Label>
                  <Input
                    id={`width-${box.id}`}
                    placeholder="10"
                    value={box.width}
                    onChange={(e) => updateBox(box.id, "width", e.target.value)}
                  />
                </div>
              </div>

              {box.length && box.height && box.width && (
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <span className="font-medium">Volume: </span>
                  <span>
                    {(
                      parseFloat(box.length) *
                      parseFloat(box.height) *
                      parseFloat(box.width)
                    ).toFixed(2)}{" "}
                    cm³
                  </span>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </CreateShipmentLayout>
  );
}
