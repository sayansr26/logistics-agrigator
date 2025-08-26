"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/ui/form-error";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { FileText } from "lucide-react";

export function DocketInformation() {
  const {
    referenceNo,
    actualWeight,
    pickupAddress,
    productDescription,
    setField,
    errors,
  } = useShipmentFormStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Docket Information</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="referenceNo">Reference No*</Label>
            <Input
              id="referenceNo"
              placeholder="250810021T1582"
              value={referenceNo}
              onChange={(e) => setField("referenceNo", e.target.value)}
              className={errors.referenceNo ? "border-red-500" : ""}
            />
            <FormError message={errors.referenceNo} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualWeight">Actual Weight(Kg)*</Label>
            <Input
              id="actualWeight"
              placeholder="Actual Weight"
              value={actualWeight}
              onChange={(e) => setField("actualWeight", e.target.value)}
              className={errors.actualWeight ? "border-red-500" : ""}
            />
            <FormError message={errors.actualWeight} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pickupAddress">Select Pickup Address*</Label>
          <Select
            value={pickupAddress}
            onValueChange={(value) => setField("pickupAddress", value)}
          >
            <SelectTrigger
              className={errors.pickupAddress ? "border-red-500" : ""}
            >
              <SelectValue placeholder="StartUP-Sample-5005/110032" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="startup-Sample-5005">
                StartUP-Sample-5005/110032
              </SelectItem>
              <SelectItem value="warehouse-mumbai">Warehouse Mumbai</SelectItem>
              <SelectItem value="warehouse-delhi">Warehouse Delhi</SelectItem>
            </SelectContent>
          </Select>
          <FormError message={errors.pickupAddress} />
          <div className="text-xs text-muted-foreground mt-1">
            <div className="font-medium">Warehouse: StartUP-Sample-5005</div>
            <div>Delhi, Delhi, 110032</div>
            <div>110032 | west gorakh park gali no-3 shahdara</div>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <input
              type="checkbox"
              id="rtoAddress"
              className="rounded border-gray-300"
            />
            <Label htmlFor="rtoAddress" className="text-sm">
              RTO address same as pickup address.
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productDescription">Product Description*</Label>
          <Textarea
            id="productDescription"
            placeholder="Enter Product Description"
            value={productDescription}
            onChange={(e) => setField("productDescription", e.target.value)}
            className={errors.productDescription ? "border-red-500" : ""}
            rows={4}
          />
          <FormError message={errors.productDescription} />
        </div>
      </CardContent>
    </Card>
  );
}
