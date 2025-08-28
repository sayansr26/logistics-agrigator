"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/ui/form-error";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { MapPin } from "lucide-react";

export function DeliveryLocation() {
  const {
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
    errors,
  } = useShipmentFormStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5" />
          <span>Delivery Location</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="receiverName">Receiver Name*</Label>
            <Input
              id="receiverName"
              placeholder="Enter receiver name"
              value={receiverName}
              onChange={(e) => setField("receiverName", e.target.value)}
              className={errors.receiverName ? "border-red-500" : ""}
            />
            <FormError message={errors.receiverName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number*</Label>
            <Input
              id="phoneNumber"
              placeholder="Enter phone number"
              value={phoneNumber}
              onChange={(e) => setField("phoneNumber", e.target.value)}
              className={errors.phoneNumber ? "border-red-500" : ""}
            />
            <FormError message={errors.phoneNumber} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="alternatePhone">Alternate Phone</Label>
            <Input
              id="alternatePhone"
              placeholder="Enter alternate phone"
              value={alternatePhone}
              onChange={(e) => setField("alternatePhone", e.target.value)}
              className={errors.alternatePhone ? "border-red-500" : ""}
            />
            <FormError message={errors.alternatePhone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setField("email", e.target.value)}
              className={errors.email ? "border-red-500" : ""}
            />
            <FormError message={errors.email} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address*</Label>
          <Textarea
            id="address"
            placeholder="Enter delivery address"
            value={address}
            onChange={(e) => setField("address", e.target.value)}
            className={errors.address ? "border-red-500" : ""}
            rows={3}
          />
          <FormError message={errors.address} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="landmark">Landmark</Label>
            <Input
              id="landmark"
              placeholder="Enter landmark"
              value={landmark}
              onChange={(e) => setField("landmark", e.target.value)}
              className={errors.landmark ? "border-red-500" : ""}
            />
            <FormError message={errors.landmark} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode*</Label>
            <Input
              id="pincode"
              placeholder="Enter pincode"
              value={pincode}
              onChange={(e) => setField("pincode", e.target.value)}
              className={errors.pincode ? "border-red-500" : ""}
            />
            <FormError message={errors.pincode} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="area">Area</Label>
            <Input
              id="area"
              placeholder="Enter area"
              value={area}
              onChange={(e) => setField("area", e.target.value)}
              className={errors.area ? "border-red-500" : ""}
            />
            <FormError message={errors.area} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City*</Label>
            <Input
              id="city"
              placeholder="Enter city"
              value={city}
              onChange={(e) => setField("city", e.target.value)}
              className={errors.city ? "border-red-500" : ""}
            />
            <FormError message={errors.city} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State*</Label>
            <Input
              id="state"
              placeholder="Enter state"
              value={state}
              onChange={(e) => setField("state", e.target.value)}
              className={errors.state ? "border-red-500" : ""}
            />
            <FormError message={errors.state} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
