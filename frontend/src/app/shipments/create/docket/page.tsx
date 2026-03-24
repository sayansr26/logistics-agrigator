"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/ui/form-error";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { useRole } from "@/hooks/useRole";
import {
  useListOutletsQuery,
  useGetMyAddressesQuery,
  useGetOutletAddressesQuery,
} from "@/store/api/endpoints/outletApi";
import type { Outlet, OutletAddress } from "@/store/api/endpoints/outletApi";
import {
  FileText,
  MapPin,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Upload,
  Package,
  ArrowRight,
  RefreshCcw,
} from "lucide-react";

export default function ShipmentDetailsPage() {
  const router = useRouter();
  const { isSystemAdmin, isRole } = useRole();
  const isOutlet = isRole("outlet");
  const isAdminLike = isSystemAdmin();

  const store = useShipmentFormStore();

  // Outlets (admin/superadmin only)
  const {
    data: outletsData,
    isLoading: outletsLoading,
    error: outletsError,
  } = useListOutletsQuery(
    { isActive: true, limit: 100 },
    { skip: !isAdminLike },
  );
  const outlets: Outlet[] = outletsData?.data?.outlets || [];

  // Addresses
  const shouldFetchOutletAddrs = isAdminLike && !!store.outletId;
  const { data: outletAddrsData, isLoading: outletAddrsLoading } =
    useGetOutletAddressesQuery(store.outletId, {
      skip: !shouldFetchOutletAddrs,
    });
  const { data: myAddrsData, isLoading: myAddrsLoading } =
    useGetMyAddressesQuery(undefined, { skip: !isOutlet });

  const addressesLoading = isOutlet ? myAddrsLoading : outletAddrsLoading;

  const addresses: OutletAddress[] = useMemo(() => {
    if (isOutlet) return myAddrsData?.data?.addresses || [];
    if (isAdminLike && store.outletId)
      return outletAddrsData?.data?.addresses || [];
    return [];
  }, [isOutlet, isAdminLike, store.outletId, myAddrsData, outletAddrsData]);

  const pickupAddresses = useMemo(
    () => addresses.filter((a) => a.isActive),
    [addresses],
  );
  const selectedAddr = pickupAddresses.find(
    (a) => a.id === store.pickupAddressId,
  );
  const selectedRtoAddr = pickupAddresses.find(
    (a) => a.id === store.rtoAddressId,
  );
  const needsOutletFirst = isAdminLike && !store.outletId;
  const isB2B = store.shipmentType === "B2B";

  function handleSelectPickupAddress(addrId: string) {
    store.setField("pickupAddressId", addrId);
    store.setField("pickupAddress", addrId);
  }

  function handleSelectRtoAddress(addrId: string) {
    store.setField("rtoAddressId", addrId);
  }

  function handleNext() {
    store.clearAllErrors();
    if (!store.validateDocket() || !store.validateDelivery()) return;
    router.push("/shipments/create/review");
  }

  return (
    <CreateShipmentLayout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== LEFT COLUMN ===== */}
        <div className="space-y-6">
          {/* Docket Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Docket Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Reference No*</Label>
                  <div className="relative">
                    <Input
                      placeholder="Auto-generated"
                      value={store.referenceNo}
                      readOnly
                      className={[
                        "pr-10",
                        store.errors.referenceNo ? "border-destructive" : "",
                      ].join(" ")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => store.regenerateReferenceNo()}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      aria-label="Regenerate reference number"
                      title="Regenerate reference number"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormError message={store.errors.referenceNo} />
                </div>
                <div className="space-y-1">
                  <Label>Actual Weight (Kg)*</Label>
                  <Input
                    type="number"
                    placeholder="0.5"
                    step="0.1"
                    min="0.1"
                    value={store.actualWeight}
                    onChange={(e) =>
                      store.setField("actualWeight", e.target.value)
                    }
                    className={
                      store.errors.actualWeight ? "border-destructive" : ""
                    }
                  />
                  <FormError message={store.errors.actualWeight} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Shipment Type*</Label>
                  <Select
                    value={store.shipmentType}
                    onValueChange={(v) => store.setField("shipmentType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2C">B2C</SelectItem>
                      <SelectItem value="B2B">B2B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Shipment Direction*</Label>
                  <Select
                    value={store.shipmentDirection}
                    onValueChange={(v) =>
                      store.setField("shipmentDirection", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FORWARD">Forward</SelectItem>
                      <SelectItem value="REVERSE">Reverse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAdminLike && (
                <div className="space-y-1">
                  <Label>Select Outlet*</Label>
                  {outletsLoading ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      outlets...
                    </div>
                  ) : outletsError ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" /> Failed to load
                      outlets.
                    </div>
                  ) : outlets.length === 0 ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground border rounded-md">
                      <AlertCircle className="h-4 w-4" /> No active outlets
                      found.
                    </div>
                  ) : (
                    <Select
                      value={store.outletId}
                      onValueChange={(v) => {
                        store.setField("outletId", v);
                        const selected = outlets.find((o) => o.id === v);
                        store.setField("outletUserId", selected?.phone || "");
                        store.setField("pickupAddress", "");
                        store.setField("pickupAddressId", "");
                        store.setField("rtoSameAsPickup", true);
                        store.setField("rtoAddressId", "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name} ({o.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormError message={store.errors.outletId} />
                </div>
              )}

              <div className="flex items-center gap-6">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={store.paymentType === "PREPAID"}
                    onChange={() => store.setField("paymentType", "PREPAID")}
                    className="accent-primary"
                  />
                  Prepaid
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={store.paymentType === "COD"}
                    onChange={() => store.setField("paymentType", "COD")}
                    className="accent-primary"
                  />
                  COD
                </Label>
                {store.paymentType === "COD" && (
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="COD Amount"
                      value={store.codAmount}
                      onChange={(e) =>
                        store.setField("codAmount", e.target.value)
                      }
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Service Type</Label>
                <Select
                  value={store.serviceType}
                  onValueChange={(v) => store.setField("serviceType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="EXPRESS">Express</SelectItem>
                    <SelectItem value="ECONOMY">Economy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Select Pickup Address */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-green-600" />
                <span>Select Pickup Address*</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {needsOutletFirst ? (
                <div className="flex items-center gap-2 p-3 text-sm text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Please select an outlet first to load pickup addresses.
                </div>
              ) : addressesLoading ? (
                <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading
                  addresses...
                </div>
              ) : pickupAddresses.length === 0 ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground border rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  No addresses found. Add an address in the Outlets section
                  first.
                </div>
              ) : (
                <Select
                  value={store.pickupAddressId}
                  onValueChange={handleSelectPickupAddress}
                >
                  <SelectTrigger
                    className={
                      store.errors.pickupAddress ? "border-destructive" : ""
                    }
                  >
                    <SelectValue placeholder="Select a pickup address" />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupAddresses.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label || a.name} - {a.city}, {a.pincode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormError message={store.errors.pickupAddress} />

              {selectedAddr && (
                <div className="text-xs text-muted-foreground p-3 rounded-lg border bg-muted/50 space-y-0.5">
                  <div className="font-semibold text-foreground">
                    Warehouse: {selectedAddr.label || selectedAddr.name}
                  </div>
                  <div>
                    {selectedAddr.city}, {selectedAddr.state},{" "}
                    {selectedAddr.pincode}
                  </div>
                  <div>{selectedAddr.addressLine1}</div>
                  {selectedAddr.addressLine2 && (
                    <div>{selectedAddr.addressLine2}</div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rtoSameAsPickup"
                  checked={store.rtoSameAsPickup}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    store.setField("rtoSameAsPickup", checked);
                    store.setField("rtoAddressId", "");
                  }}
                  className="rounded accent-green-600"
                />
                <Label
                  htmlFor="rtoSameAsPickup"
                  className="text-sm cursor-pointer"
                >
                  RTO address same as pickup address.
                </Label>
              </div>

              {!store.rtoSameAsPickup && (
                <div className="space-y-2 pt-2">
                  <Label>RTO Address*</Label>
                  {needsOutletFirst ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      Please select an outlet first to load RTO addresses.
                    </div>
                  ) : addressesLoading ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      addresses...
                    </div>
                  ) : pickupAddresses.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground border rounded-lg">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      No addresses found. Add an address in the Outlets section
                      first.
                    </div>
                  ) : (
                    <Select
                      value={store.rtoAddressId}
                      onValueChange={handleSelectRtoAddress}
                    >
                      <SelectTrigger
                        className={
                          store.errors.rtoAddressId ? "border-destructive" : ""
                        }
                      >
                        <SelectValue placeholder="Select an RTO address" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickupAddresses.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label || a.name} - {a.city}, {a.pincode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormError message={store.errors.rtoAddressId} />

                  {selectedRtoAddr && (
                    <div className="text-xs text-muted-foreground p-3 rounded-lg border bg-muted/50 space-y-0.5">
                      <div className="font-semibold text-foreground">
                        Warehouse:{" "}
                        {selectedRtoAddr.label || selectedRtoAddr.name}
                      </div>
                      <div>
                        {selectedRtoAddr.city}, {selectedRtoAddr.state},{" "}
                        {selectedRtoAddr.pincode}
                      </div>
                      <div>{selectedRtoAddr.addressLine1}</div>
                      {selectedRtoAddr.addressLine2 && (
                        <div>{selectedRtoAddr.addressLine2}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Description */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Product Description*</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Enter Product Description"
                value={store.productDescription}
                onChange={(e) =>
                  store.setField("productDescription", e.target.value)
                }
                className={
                  store.errors.productDescription ? "border-destructive" : ""
                }
                rows={3}
              />
              <FormError message={store.errors.productDescription} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>HSN</Label>
                  <Input
                    placeholder="HSN"
                    value={store.hsnCode}
                    onChange={(e) => store.setField("hsnCode", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>GST (%)</Label>
                  <Input
                    type="number"
                    placeholder="GST(%)"
                    value={store.gstPercentage}
                    onChange={(e) =>
                      store.setField("gstPercentage", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="isFragile"
                  checked={store.isFragile}
                  onCheckedChange={(checked) =>
                    store.setField("isFragile", checked === true)
                  }
                />
                <Label
                  htmlFor="isFragile"
                  className="cursor-pointer text-sm font-medium leading-none"
                >
                  This shipment contains fragile items
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="space-y-6">
          {/* Delivery Location Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-red-500" />
                <span>Delivery Location Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Phone Number*</Label>
                  <Input
                    placeholder="9918380916"
                    value={store.phoneNumber}
                    onChange={(e) =>
                      store.setField("phoneNumber", e.target.value)
                    }
                    className={
                      store.errors.phoneNumber ? "border-destructive" : ""
                    }
                  />
                  <FormError message={store.errors.phoneNumber} />
                </div>
                <div className="space-y-1">
                  <Label>Alternate Phone No</Label>
                  <Input
                    placeholder="Alternate Phone"
                    value={store.alternatePhone}
                    onChange={(e) =>
                      store.setField("alternatePhone", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={store.email}
                    onChange={(e) => store.setField("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Receiver Name*</Label>
                <Input
                  placeholder="Receiver Name"
                  value={store.receiverName}
                  onChange={(e) =>
                    store.setField("receiverName", e.target.value)
                  }
                  className={
                    store.errors.receiverName ? "border-destructive" : ""
                  }
                />
                <FormError message={store.errors.receiverName} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Address*</Label>
                  <Input
                    placeholder="Full delivery address"
                    value={store.address}
                    onChange={(e) => store.setField("address", e.target.value)}
                    className={store.errors.address ? "border-destructive" : ""}
                  />
                  <FormError message={store.errors.address} />
                </div>
                <div className="space-y-1">
                  <Label>Landmark</Label>
                  <Input
                    placeholder="Landmark"
                    value={store.landmark}
                    onChange={(e) => store.setField("landmark", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label>Pincode*</Label>
                  <Input
                    placeholder="110001"
                    maxLength={6}
                    value={store.pincode}
                    onChange={(e) => store.setField("pincode", e.target.value)}
                    className={store.errors.pincode ? "border-destructive" : ""}
                  />
                  <FormError message={store.errors.pincode} />
                </div>
                <div className="space-y-1">
                  <Label>Area*</Label>
                  <Input
                    placeholder="Area"
                    value={store.area}
                    onChange={(e) => store.setField("area", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>City*</Label>
                  <Input
                    placeholder="City"
                    value={store.city}
                    onChange={(e) => store.setField("city", e.target.value)}
                    className={store.errors.city ? "border-destructive" : ""}
                  />
                  <FormError message={store.errors.city} />
                </div>
                <div className="space-y-1">
                  <Label>State*</Label>
                  <Input
                    placeholder="State"
                    value={store.state}
                    onChange={(e) => store.setField("state", e.target.value)}
                    className={store.errors.state ? "border-destructive" : ""}
                  />
                  <FormError message={store.errors.state} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoices */}
          <InvoicesSection isB2B={isB2B} store={store} />

          {/* Dimensions */}
          <DimensionsSection isB2B={isB2B} store={store} />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-6 mt-6 border-t">
        <Button variant="outline" onClick={() => router.push("/shipments")}>
          Cancel
        </Button>
        <Button onClick={handleNext} className="gap-2">
          Next: Select Partner
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </CreateShipmentLayout>
  );
}

/* ---- Invoices Section ---- */
function InvoicesSection({
  isB2B,
  store,
}: {
  isB2B: boolean;
  store: ReturnType<typeof useShipmentFormStore>;
}) {
  // B2C: always exactly 1 row, auto-init if empty
  if (!isB2B) {
    if (store.invoices.length === 0) store.addInvoice();
    const inv = store.invoices[0];
    if (!inv) return null;
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Invoices:</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
            <span>E-Way bill no.</span>
            <span>Invoice No.*</span>
            <span>Invoice Amt*</span>
            <span>Invoice Date*</span>
            <span>Attachment</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-2 items-end">
            <Input
              placeholder="E-Way bill no."
              value={inv.eWayBillNo}
              onChange={(e) =>
                store.updateInvoice(inv.id, "eWayBillNo", e.target.value)
              }
            />
            <Input
              placeholder="SBKD/25-26/55"
              value={inv.invoiceNo}
              onChange={(e) =>
                store.updateInvoice(inv.id, "invoiceNo", e.target.value)
              }
            />
            <Input
              type="number"
              placeholder="18360"
              value={inv.invoiceAmt}
              onChange={(e) =>
                store.updateInvoice(inv.id, "invoiceAmt", e.target.value)
              }
            />
            <Input
              type="date"
              value={inv.invoiceDate}
              onChange={(e) =>
                store.updateInvoice(inv.id, "invoiceDate", e.target.value)
              }
            />
            <div className="flex items-center">
              <input
                type="file"
                id={`file-${inv.id}`}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs w-full"
                onClick={() =>
                  document.getElementById(`file-${inv.id}`)?.click()
                }
              >
                <Upload className="h-3 w-3 mr-1" />
                {inv.attachment
                  ? (inv.attachment as File).name.substring(0, 10) + "..."
                  : "Choose File"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // B2B: multiple rows with add/remove
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>Invoices:</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={store.addInvoice}
            className="gap-1 text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_1fr_1fr_36px] gap-2 text-xs font-medium text-muted-foreground">
          <span>E-Way bill no.</span>
          <span>Invoice No.*</span>
          <span>Invoice Amt*</span>
          <span>Invoice Date*</span>
          <span>Attachment</span>
          <span />
        </div>
        {store.invoices.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Click <span className="text-green-600 font-bold">+</span> to add an
            invoice row.
          </div>
        )}
        {store.invoices.map((inv) => (
          <div
            key={inv.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_36px] gap-2 items-end"
          >
            <Input
              placeholder="E-Way bill no."
              value={inv.eWayBillNo}
              onChange={(e) =>
                store.updateInvoice(inv.id, "eWayBillNo", e.target.value)
              }
            />
            <Input
              placeholder="SBKD/25-26/55"
              value={inv.invoiceNo}
              onChange={(e) =>
                store.updateInvoice(inv.id, "invoiceNo", e.target.value)
              }
            />
            <Input
              type="number"
              placeholder="18360"
              value={inv.invoiceAmt}
              onChange={(e) =>
                store.updateInvoice(inv.id, "invoiceAmt", e.target.value)
              }
            />
            <Input
              type="date"
              value={inv.invoiceDate}
              onChange={(e) =>
                store.updateInvoice(inv.id, "invoiceDate", e.target.value)
              }
            />
            <div className="flex items-center">
              <input
                type="file"
                id={`file-${inv.id}`}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs w-full"
                onClick={() =>
                  document.getElementById(`file-${inv.id}`)?.click()
                }
              >
                <Upload className="h-3 w-3 mr-1" />
                {inv.attachment
                  ? (inv.attachment as File).name.substring(0, 10) + "..."
                  : "Choose File"}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => store.removeInvoice(inv.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 p-1 h-9"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---- Dimensions Section ---- */
function DimensionsSection({
  isB2B,
  store,
}: {
  isB2B: boolean;
  store: ReturnType<typeof useShipmentFormStore>;
}) {
  // B2C: single fixed row, no add/remove
  if (!isB2B) {
    const box = store.boxes[0];
    if (!box) return null;
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Dimensions:</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden md:grid md:grid-cols-[70px_1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
            <span>Box*</span>
            <span>Length(cm)*</span>
            <span>Height(cm)*</span>
            <span>Width(cm)*</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[70px_1fr_1fr_1fr] gap-2 items-end">
            <Input type="number" value={1} disabled className="text-center" />
            <Input
              type="number"
              placeholder="68"
              min={1}
              value={box.length}
              onChange={(e) =>
                store.updateBox(box.id, "length", e.target.value)
              }
            />
            <Input
              type="number"
              placeholder="42"
              min={1}
              value={box.height}
              onChange={(e) =>
                store.updateBox(box.id, "height", e.target.value)
              }
            />
            <Input
              type="number"
              placeholder="56"
              min={1}
              value={box.width}
              onChange={(e) => store.updateBox(box.id, "width", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // B2B: multiple rows with add/remove
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>Dimensions:</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={store.addBox}
            className="gap-1 text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="hidden md:grid md:grid-cols-[70px_1fr_1fr_1fr_36px] gap-2 text-xs font-medium text-muted-foreground">
          <span>Box*</span>
          <span>Length(cm)*</span>
          <span>Height(cm)*</span>
          <span>Width(cm)*</span>
          <span />
        </div>
        {store.boxes.map((box, index) => (
          <div
            key={box.id}
            className="grid grid-cols-1 md:grid-cols-[70px_1fr_1fr_1fr_36px] gap-2 items-end"
          >
            <Input
              type="number"
              value={index + 1}
              disabled
              className="text-center"
            />
            <Input
              type="number"
              placeholder="68"
              min={1}
              value={box.length}
              onChange={(e) =>
                store.updateBox(box.id, "length", e.target.value)
              }
            />
            <Input
              type="number"
              placeholder="42"
              min={1}
              value={box.height}
              onChange={(e) =>
                store.updateBox(box.id, "height", e.target.value)
              }
            />
            <Input
              type="number"
              placeholder="56"
              min={1}
              value={box.width}
              onChange={(e) => store.updateBox(box.id, "width", e.target.value)}
            />
            {store.boxes.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => store.removeBox(box.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 p-1 h-9"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
