"use client";

import { useCallback } from "react";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/ui/form-error";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { sanitizeIndianPhone } from "@/lib/utils/phone";
import { usePincodeAutoFill } from "@/hooks/usePincodeAutoFill";
import { Loader2, MapPin } from "lucide-react";

export default function DeliveryLocationPage() {
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

  const onFill = useCallback(
    (patch: Partial<{ city: string; state: string; area: string }>) => {
      if (patch.city !== undefined) setField("city", patch.city);
      if (patch.state !== undefined) setField("state", patch.state);
      if (patch.area !== undefined) setField("area", patch.area);
    },
    [setField],
  );

  const { isFetching: pinLoading, notFound: pinNotFound } = usePincodeAutoFill({
    pincode,
    current: { city, state, area },
    onFill,
  });

  return (
    <CreateShipmentLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-red-500" />
            <span>Delivery Location Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Phone, Alternate Phone, Email */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number*</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                  +91
                </span>
                <Input
                  id="phoneNumber"
                  placeholder="9918380916"
                  inputMode="numeric"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) =>
                    setField("phoneNumber", sanitizeIndianPhone(e.target.value))
                  }
                  className={`rounded-l-none ${errors.phoneNumber ? "border-red-500" : ""}`}
                />
              </div>
              <FormError message={errors.phoneNumber} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternatePhone">Alternate Phone No</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                  +91
                </span>
                <Input
                  id="alternatePhone"
                  placeholder="Alternate Phone"
                  inputMode="numeric"
                  maxLength={10}
                  value={alternatePhone}
                  onChange={(e) =>
                    setField(
                      "alternatePhone",
                      sanitizeIndianPhone(e.target.value),
                    )
                  }
                  className={`rounded-l-none ${errors.alternatePhone ? "border-red-500" : ""}`}
                />
              </div>
              <FormError message={errors.alternatePhone} />
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

          {/* Row 2: Receiver Name (full width) */}
          <div className="space-y-2">
            <Label htmlFor="receiverName">Receiver Name*</Label>
            <Input
              id="receiverName"
              placeholder="Receiver Name"
              value={receiverName}
              onChange={(e) => setField("receiverName", e.target.value)}
              className={errors.receiverName ? "border-red-500" : ""}
            />
            <FormError message={errors.receiverName} />
          </div>

          {/* Row 3: Address, Landmark */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address*</Label>
              <Textarea
                id="address"
                placeholder="Full delivery address"
                value={address}
                onChange={(e) => setField("address", e.target.value)}
                className={errors.address ? "border-red-500" : ""}
                rows={2}
              />
              <FormError message={errors.address} />
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

          {/* Row 4: Pincode, Area, City, State */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode*</Label>
              <div className="relative">
                <Input
                  id="pincode"
                  placeholder="110001"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) =>
                    setField(
                      "pincode",
                      e.target.value.replace(/\D+/g, "").slice(0, 6),
                    )
                  }
                  className={errors.pincode ? "border-red-500" : ""}
                />
                {pinLoading && (
                  <Loader2 className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {pinNotFound ? (
                <p className="text-xs text-muted-foreground">
                  Pincode not found — fill manually
                </p>
              ) : (
                <FormError message={errors.pincode} />
              )}
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
                placeholder="City"
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
                placeholder="State"
                value={state}
                onChange={(e) => setField("state", e.target.value)}
                className={errors.state ? "border-red-500" : ""}
              />
              <FormError message={errors.state} />
            </div>
          </div>
        </CardContent>
      </Card>
    </CreateShipmentLayout>
  );
}
