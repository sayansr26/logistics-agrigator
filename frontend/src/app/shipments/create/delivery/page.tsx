"use client";

import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { MapPin } from "lucide-react";

export default function DeliveryLocationPage() {
  const {
    currentStep,
    phoneNumber,
    alternatePhone,
    email,
    receiverName,
    address,
    landmark,
    pincode,
    area,
    city,
    state,
    setField,
    setStep,
  } = useShipmentFormStore();

  const handleStepChange = (step: number) => {
    setStep(step);
  };

  return (
    <CreateShipmentLayout
      currentStep={currentStep}
      onStepChange={handleStepChange}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Delivery Location Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number*</Label>
              <Input
                id="phoneNumber"
                placeholder="Phone Number"
                value={phoneNumber}
                onChange={(e) => setField("phoneNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternatePhone">Alternate Phone No</Label>
              <Input
                id="alternatePhone"
                placeholder="Alternate Phone"
                value={alternatePhone}
                onChange={(e) => setField("alternatePhone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiverName">Receiver Name*</Label>
            <Input
              id="receiverName"
              placeholder="Receiver Name"
              value={receiverName}
              onChange={(e) => setField("receiverName", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address*</Label>
              <Textarea
                id="address"
                placeholder="Address"
                value={address}
                onChange={(e) => setField("address", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input
                id="landmark"
                placeholder="Landmark"
                value={landmark}
                onChange={(e) => setField("landmark", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode*</Label>
              <Input
                id="pincode"
                placeholder="Pincode"
                value={pincode}
                onChange={(e) => setField("pincode", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Area*</Label>
              <Input
                id="area"
                placeholder="Area"
                value={area}
                onChange={(e) => setField("area", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City*</Label>
              <Input
                id="city"
                placeholder="City Name"
                value={city}
                onChange={(e) => setField("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State*</Label>
              <Input
                id="state"
                placeholder="State"
                value={state}
                onChange={(e) => setField("state", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </CreateShipmentLayout>
  );
}
