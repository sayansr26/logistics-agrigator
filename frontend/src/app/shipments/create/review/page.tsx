"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { useRole } from "@/hooks/useRole";
import {
  useGetShipmentQuotesMutation,
  useCreateShipmentMutation,
} from "@/store/api/endpoints/shipmentApi";
import type {
  PartnerQuote,
  CreateShipmentRequest,
} from "@/store/api/endpoints/shipmentApi";
import {
  useGetMyAddressesQuery,
  useGetOutletAddressesQuery,
} from "@/store/api/endpoints/outletApi";
import type { OutletAddress } from "@/store/api/endpoints/outletApi";
import {
  Package,
  MapPin,
  FileText,
  Box,
  CheckCircle,
  Truck,
  Star,
  Building,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

type ReviewStage = "review" | "quotes" | "confirm";

export default function ReviewPage() {
  const router = useRouter();
  const { currentRole, isSystemAdmin, isRole } = useRole();
  const role = currentRole || "";
  const isOutlet = isRole("outlet");

  const store = useShipmentFormStore();
  const [stage, setStage] = useState<ReviewStage>("review");
  const [selectedQuote, setSelectedQuote] = useState<PartnerQuote | null>(null);

  const [
    getQuotes,
    { data: quotesData, isLoading: quotesLoading, error: quotesError },
  ] = useGetShipmentQuotesMutation();
  const [createShipment, { isLoading: creating }] = useCreateShipmentMutation();

  const isAdminLike = ["superadmin", "admin"].includes(role);
  const shouldFetchOutletAddrs = isAdminLike && !!store.outletId;
  const { data: myAddrsData } = useGetMyAddressesQuery(undefined, {
    skip: !isOutlet,
  });
  const { data: outletAddrsData } = useGetOutletAddressesQuery(store.outletId, {
    skip: !shouldFetchOutletAddrs,
  });

  const addresses: OutletAddress[] = useMemo(() => {
    if (isOutlet) return myAddrsData?.data?.addresses || [];
    if (isAdminLike && store.outletId)
      return outletAddrsData?.data?.addresses || [];
    return [];
  }, [isOutlet, isAdminLike, store.outletId, myAddrsData, outletAddrsData]);

  const selectedAddr = addresses.find((a) => a.id === store.pickupAddressId);
  const selectedRtoAddr = addresses.find((a) => a.id === store.rtoAddressId);

  const quotes = quotesData?.data?.quotes || [];
  const recommended = quotesData?.data?.recommended || null;

  const firstBox = store.boxes[0];
  const dims = {
    length: parseFloat(firstBox?.length || "10") || 10,
    width: parseFloat(firstBox?.width || "10") || 10,
    height: parseFloat(firstBox?.height || "10") || 10,
  };

  async function handleGetQuotes() {
    if (!selectedAddr) return;
    try {
      const totalDeclaredValue = store.invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.invoiceAmt) || 0),
        0,
      );

      await getQuotes({
        fromPincode: selectedAddr.pincode,
        toPincode: store.pincode,
        weight: parseFloat(store.actualWeight) || 0.5,
        numberOfBoxes: store.boxes.length,
        dimensions: dims,
        serviceType: store.serviceType as "STANDARD" | "EXPRESS" | "ECONOMY",
        paymentType: store.paymentType as "PREPAID" | "COD",
        codAmount:
          store.paymentType === "COD" ? parseFloat(store.codAmount) : undefined,
        shipmentType: store.shipmentType as "B2B" | "B2C",
        declaredValue: totalDeclaredValue > 0 ? totalDeclaredValue : undefined,
        isFragile: store.isFragile || undefined,
        outletId: store.outletId || undefined,
      }).unwrap();
      setStage("quotes");
    } catch {
      // RTK handles error
    }
  }

  function selectQuoteAndProceed(quote: PartnerQuote) {
    setSelectedQuote(quote);
    setStage("confirm");
  }

  async function handleConfirm() {
    if (!selectedQuote || !selectedAddr) return;
    if (!store.rtoSameAsPickup && !selectedRtoAddr) return;
    try {
      const normalizePhone = (phone?: string) => {
        const raw = (phone || "").trim();
        if (!raw) return raw;
        return raw.startsWith("+91") ? raw : `+91${raw}`;
      };

      const pickupAddress = {
        name: selectedAddr.name,
        phone: normalizePhone(selectedAddr.phone),
        email: selectedAddr.email,
        addressLine1: selectedAddr.addressLine1,
        addressLine2: selectedAddr.addressLine2,
        landmark: selectedAddr.landmark,
        city: selectedAddr.city,
        state: selectedAddr.state,
        pincode: selectedAddr.pincode,
        country: selectedAddr.country || "India",
      };

      const deliveryAddress = {
        name: store.receiverName,
        phone: store.phoneNumber.startsWith("+91")
          ? store.phoneNumber
          : `+91${store.phoneNumber}`,
        email: store.email,
        addressLine1: store.address,
        addressLine2: "",
        landmark: store.landmark,
        city: store.city,
        state: store.state,
        pincode: store.pincode,
        country: "India",
      };

      const rtoAddress =
        store.rtoSameAsPickup || !selectedRtoAddr
          ? undefined
          : {
              name: selectedRtoAddr.name,
              phone: normalizePhone(selectedRtoAddr.phone),
              addressLine1: selectedRtoAddr.addressLine1,
              addressLine2: selectedRtoAddr.addressLine2,
              landmark: selectedRtoAddr.landmark,
              city: selectedRtoAddr.city,
              state: selectedRtoAddr.state,
              pincode: selectedRtoAddr.pincode,
              country: selectedRtoAddr.country || "India",
            };

      const payload: CreateShipmentRequest = {
        orderId: store.referenceNo,
        shipmentType: store.shipmentType,
        shipmentDirection: store.shipmentDirection,
        outletId: isOutlet ? undefined : store.outletId || undefined,
        outletUserId: isOutlet ? undefined : store.outletUserId || undefined,
        pickupAddressId: store.pickupAddressId || undefined,
        pickupLocation: selectedAddr.label || selectedAddr.name,
        pickupAddress,
        deliveryAddress,
        rtoSameAsPickup: store.rtoSameAsPickup,
        rtoAddress,
        productDescription: store.productDescription || undefined,
        hsnCode: store.hsnCode || undefined,
        gstPercentage: store.gstPercentage
          ? parseFloat(store.gstPercentage)
          : undefined,
        packageDetails: {
          weight: parseFloat(store.actualWeight) || 0.5,
          dimensions: dims,
          description: store.productDescription || undefined,
          value: undefined,
          fragile: store.isFragile,
        },
        numberOfBoxes: store.boxes.length,
        boxes:
          store.shipmentType === "B2B"
            ? store.boxes.map((b, i) => ({
                boxNumber: i + 1,
                length: parseFloat(b.length) || 0,
                width: parseFloat(b.width) || 0,
                height: parseFloat(b.height) || 0,
              }))
            : undefined,
        invoices:
          store.shipmentType === "B2B" && store.invoices.length > 0
            ? store.invoices
                .filter((inv) => inv.invoiceNo)
                .map((inv) => ({
                  eWayBillNo: inv.eWayBillNo || undefined,
                  invoiceNo: inv.invoiceNo,
                  invoiceAmt: parseFloat(inv.invoiceAmt) || 0,
                  invoiceDate: inv.invoiceDate,
                }))
            : undefined,
        paymentType: store.paymentType,
        codAmount:
          store.paymentType === "COD" ? parseFloat(store.codAmount) : undefined,
        serviceType: store.serviceType,
        selectedPartnerId: selectedQuote.partnerId,
        quoteSnapshot: selectedQuote,
      };

      await createShipment(payload).unwrap();
      store.resetForm();
      router.push("/shipments");
    } catch {
      // RTK handles error
    }
  }

  return (
    <CreateShipmentLayout>
      <div className="space-y-6">
        {/* Review summary - always visible */}
        {stage === "review" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Docket Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <Package className="h-4 w-4" />
                    <span>Docket Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Reference No" value={store.referenceNo} />
                  <Row label="Weight" value={`${store.actualWeight} kg`} />
                  <Row label="Shipment Type" value={store.shipmentType} />
                  <Row label="Direction" value={store.shipmentDirection} />
                  <Row label="Payment" value={store.paymentType} />
                  {store.paymentType === "COD" && (
                    <Row label="COD Amount" value={`₹${store.codAmount}`} />
                  )}
                  <Row label="Service" value={store.serviceType} />
                  {store.productDescription && (
                    <Row label="Product" value={store.productDescription} />
                  )}
                  {store.hsnCode && <Row label="HSN" value={store.hsnCode} />}
                </CardContent>
              </Card>

              {/* Pickup Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span>Pickup Address</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {selectedAddr ? (
                    <div className="space-y-1">
                      <p className="font-medium">{selectedAddr.name}</p>
                      <p className="text-muted-foreground">
                        {selectedAddr.addressLine1}
                      </p>
                      <p className="text-muted-foreground">
                        {selectedAddr.city}, {selectedAddr.state} -{" "}
                        {selectedAddr.pincode}
                      </p>
                      <p className="text-muted-foreground">
                        {selectedAddr.phone}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No pickup address selected
                    </p>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">
                    RTO same as pickup:{" "}
                    <Badge variant="secondary" className="text-xs">
                      {store.rtoSameAsPickup ? "Yes" : "No"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <MapPin className="h-4 w-4 text-red-500" />
                    <span>Delivery Location</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium">{store.receiverName || "—"}</p>
                  <p className="text-muted-foreground">
                    {store.address || "—"}
                  </p>
                  <p className="text-muted-foreground">
                    {store.city}, {store.state} - {store.pincode}
                  </p>
                  <p className="text-muted-foreground">{store.phoneNumber}</p>
                </CardContent>
              </Card>

              {/* Dimensions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <Box className="h-4 w-4" />
                    <span>
                      Dimensions ({store.boxes.length} box
                      {store.boxes.length !== 1 ? "es" : ""})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {store.boxes.map((box, idx) => (
                    <div
                      key={box.id}
                      className="flex justify-between p-2 rounded bg-muted/50"
                    >
                      <span>Box {idx + 1}</span>
                      <span className="text-muted-foreground">
                        {box.length} × {box.width} × {box.height} cm
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Invoices (B2B) */}
            {store.shipmentType === "B2B" && store.invoices.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <FileText className="h-4 w-4" />
                    <span>Invoices ({store.invoices.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {store.invoices.map((inv, idx) => (
                      <div
                        key={inv.id}
                        className="flex justify-between p-2 rounded bg-muted/50"
                      >
                        <span>
                          #{idx + 1}: {inv.invoiceNo || "—"}
                        </span>
                        <span className="text-muted-foreground">
                          ₹{inv.invoiceAmt || "0"} · {inv.invoiceDate || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {quotesError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  Failed to fetch quotes. Please check your inputs and try
                  again.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleGetQuotes}
                disabled={quotesLoading || !selectedAddr}
                className="gap-2"
              >
                {quotesLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Get Partner Quotes
              </Button>
            </div>
          </>
        )}

        {/* Quotes selection */}
        {stage === "quotes" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" /> Select Courier Partner
                </CardTitle>
                <CardDescription>
                  Choose the best partner for your shipment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>No partner quotes available for this route.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quotes.map((q) => {
                      const isRec = recommended?.partnerId === q.partnerId;
                      const isSel = selectedQuote?.partnerId === q.partnerId;
                      return (
                        <div
                          key={q.partnerId}
                          className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-sm ${
                            isSel
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-muted-foreground/50"
                          }`}
                          onClick={() => setSelectedQuote(q)}
                        >
                          {/* Partner header */}
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <Building className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">
                                    {q.partnerName}
                                  </span>
                                  {isRec && (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs gap-1">
                                      <Star className="w-3 h-3" /> Best Value
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {q.deliveryDays
                                    ? `${q.deliveryDays} day${q.deliveryDays !== 1 ? "s" : ""}`
                                    : "Est. delivery TBD"}{" "}
                                  · Chargeable: {q.chargeableWeight} kg
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">
                                ₹
                                {q.totalAmount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Total Charges
                              </p>
                            </div>
                          </div>

                          {/* Charge breakdown */}
                          {q.chargeBreakdown &&
                            q.chargeBreakdown.length > 0 && (
                              <div className="border-t border-border bg-muted/30 px-4 py-3">
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                  Charge Breakdown
                                </p>
                                <div className="space-y-1.5">
                                  {q.chargeBreakdown.map((cb, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-muted-foreground">
                                        {cb.name}
                                      </span>
                                      <span className="font-medium tabular-nums">
                                        ₹
                                        {cb.amount.toLocaleString("en-IN", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </div>
                                  ))}

                                  {q.discount && (
                                    <div className="flex items-center justify-between text-sm text-green-600 pt-1 mt-1 border-t border-dashed border-border">
                                      <span className="flex items-center gap-1">
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 border-green-300 text-green-600"
                                        >
                                          {q.discount.badge}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">
                                          {q.discount.packageName}
                                        </span>
                                      </span>
                                      <span className="font-medium tabular-nums">
                                        -₹
                                        {q.discount.totalDiscount.toLocaleString(
                                          "en-IN",
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          },
                                        )}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between text-sm font-semibold pt-1.5 mt-1.5 border-t border-border">
                                    <span>Total</span>
                                    <span className="tabular-nums">
                                      ₹
                                      {q.totalAmount.toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                  {q.discount && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Original: ₹
                                      {q.discount.originalTotal.toLocaleString(
                                        "en-IN",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        },
                                      )}{" "}
                                      • You save ₹
                                      {q.discount.totalDiscount.toLocaleString(
                                        "en-IN",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        },
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStage("review")}>
                Back to Review
              </Button>
              <Button
                onClick={() =>
                  selectedQuote && selectQuoteAndProceed(selectedQuote)
                }
                disabled={!selectedQuote}
              >
                Proceed to Confirm
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Confirm & Book */}
        {stage === "confirm" && selectedQuote && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" /> Confirm
                  Shipment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-primary/5 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">
                        {selectedQuote.partnerName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Est. {selectedQuote.deliveryDays} day
                        {selectedQuote.deliveryDays !== 1 ? "s" : ""} ·
                        Chargeable: {selectedQuote.chargeableWeight} kg
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        ₹{selectedQuote.totalAmount.toFixed(2)}
                      </p>
                      {store.paymentType === "PREPAID" && (
                        <p className="text-xs text-muted-foreground">
                          Will be debited from wallet
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <Row label="Order/Ref" value={store.referenceNo} />
                  <Row
                    label="Type"
                    value={`${store.shipmentType} · ${store.shipmentDirection}`}
                  />
                  <Row
                    label="Pickup"
                    value={
                      selectedAddr
                        ? `${selectedAddr.city} - ${selectedAddr.pincode}`
                        : "—"
                    }
                  />
                  <Row
                    label="Delivery"
                    value={`${store.city} - ${store.pincode}`}
                  />
                  <Row label="Weight" value={`${store.actualWeight} kg`} />
                  <Row label="Payment" value={store.paymentType} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStage("quotes")}>
                Change Partner
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={creating}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Confirm & Book Shipment
              </Button>
            </div>
          </div>
        )}
      </div>
    </CreateShipmentLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
