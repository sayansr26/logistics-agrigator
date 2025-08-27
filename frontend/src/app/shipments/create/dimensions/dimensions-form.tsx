"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { Box, Plus, Trash2 } from "lucide-react";

export function DimensionsForm() {
  const { boxes, addBox, removeBox, updateBox, errors } =
    useShipmentFormStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Box className="h-5 w-5" />
          <span>Package Dimensions</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Add package dimensions for accurate shipping calculations
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBox}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Box</span>
          </Button>
        </div>

        {boxes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Box className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No packages added yet</p>
            <p className="text-sm">Click &quot;Add Box&quot; to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {boxes.map((box, index) => (
              <div
                key={box.id}
                className="p-4 border border-gray-200 rounded-lg space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Package {index + 1}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeBox(box.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`length-${box.id}`}>Length (cm)*</Label>
                    <Input
                      id={`length-${box.id}`}
                      type="number"
                      placeholder="Length"
                      value={box.length}
                      onChange={(e) =>
                        updateBox(box.id, "length", e.target.value)
                      }
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`width-${box.id}`}>Width (cm)*</Label>
                    <Input
                      id={`width-${box.id}`}
                      type="number"
                      placeholder="Width"
                      value={box.width}
                      onChange={(e) =>
                        updateBox(box.id, "width", e.target.value)
                      }
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`height-${box.id}`}>Height (cm)*</Label>
                    <Input
                      id={`height-${box.id}`}
                      type="number"
                      placeholder="Height"
                      value={box.height}
                      onChange={(e) =>
                        updateBox(box.id, "height", e.target.value)
                      }
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Volume: {calculateVolume(box)} cm³
                </div>
              </div>
            ))}
          </div>
        )}

        {errors.boxes && <FormError message={errors.boxes} />}
      </CardContent>
    </Card>
  );
}

function calculateVolume(box: {
  length: string;
  width: string;
  height: string;
}): string {
  const l = parseFloat(box.length) || 0;
  const w = parseFloat(box.width) || 0;
  const h = parseFloat(box.height) || 0;

  if (l === 0 || w === 0 || h === 0) return "0";

  return (l * w * h).toFixed(2);
}
