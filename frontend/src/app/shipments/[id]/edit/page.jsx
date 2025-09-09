"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mockShipments,
  getStatusColor,
  getPaymentModeColor,
} from "@/lib/mock-data";
import { Package, Truck, AlertTriangle, Upload, Plus } from "lucide-react";

const STATUS_OPTIONS = [
  "pending",
  "in_transit",
  "delivered",
  "cancelled",
  "delayed",
];

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const PAYMENT_OPTIONS = ["prepaid", "cod", "credit", "wallet"];

const COURIER_OPTIONS = ["DHL Express", "FedEx", "UPS", "Aramex"];

export default function EditShipmentPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id || "";

  const shipment = useMemo(
    () => mockShipments.find((s) => s.id === idParam),
    [idParam],
  );

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (shipment) {
      const {
        trackingNumber,
        referenceNumber,
        senderName,
        receiverName,
        origin,
        originState,
        originPinCode,
        destination,
        destinationState,
        destinationPinCode,
        status,
        priority,
        weight,
        value,
        courierPartner,
        paymentMode,
        manifestDate,
        manifestTime,
      } = shipment;
      setForm({
        trackingNumber,
        referenceNumber,
        senderName,
        receiverName,
        origin,
        originState,
        originPinCode,
        destination,
        destinationState,
        destinationPinCode,
        status,
        priority,
        weight,
        value,
        courierPartner,
        paymentMode,
        manifestDate,
        manifestTime,
      });
    }
  }, [shipment]);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: shipment ? shipment.trackingNumber : "Not found" },
    { title: "Edit" },
  ];

  if (!shipment) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-5xl mx-auto space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold">Shipment not found</h1>
                  <p className="text-muted-foreground mt-1">
                    The shipment you are looking for does not exist.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/shipments">Go back</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const handleChange = (key, value) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    // In real app, call API to update. Here we just navigate back to detail.
    router.push(`/shipments/${idParam}`);
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header - match Shipments UI actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-8 w-8 text-logistics-600" />
              <span>Edit Shipment</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Update details for this shipment
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments/track">
                <Truck className="h-3.5 w-3.5 mr-1.5" />
                Track
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments/ndr">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                NDR
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments/bulk">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Bulk
              </Link>
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/shipments/create">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Shipment
              </Link>
            </Button>
          </div>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  Tracking Number
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="text-2xl font-bold tracking-tight">
                    {shipment.trackingNumber}
                  </div>
                  <Badge className={getStatusColor(shipment.status)}>
                    {shipment.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Reference: {shipment.referenceNumber}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-3 text-sm">
                <div className="px-3 py-2 rounded-md border">
                  Courier: {shipment.courierPartner}
                </div>
                <div className="px-3 py-2 rounded-md border">
                  Payment:
                  <Badge
                    className={`ml-2 ${getPaymentModeColor(shipment.paymentMode)}`}
                  >
                    {shipment.paymentMode.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Sections */}
        <Card>
          <CardHeader>
            <CardTitle>Identifiers</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                value={form?.referenceNumber ?? ""}
                onChange={(e) =>
                  handleChange("referenceNumber", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                value={form?.trackingNumber ?? ""}
                onChange={(e) => handleChange("trackingNumber", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parties & Route</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senderName">Sender Name</Label>
              <Input
                id="senderName"
                value={form?.senderName ?? ""}
                onChange={(e) => handleChange("senderName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiverName">Receiver Name</Label>
              <Input
                id="receiverName"
                value={form?.receiverName ?? ""}
                onChange={(e) => handleChange("receiverName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="origin">Origin</Label>
              <Input
                id="origin"
                value={form?.origin ?? ""}
                onChange={(e) => handleChange("origin", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="originState">Origin State</Label>
              <Input
                id="originState"
                value={form?.originState ?? ""}
                onChange={(e) => handleChange("originState", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="originPinCode">Origin Pincode</Label>
              <Input
                id="originPinCode"
                value={form?.originPinCode ?? ""}
                onChange={(e) => handleChange("originPinCode", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                value={form?.destination ?? ""}
                onChange={(e) => handleChange("destination", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationState">Destination State</Label>
              <Input
                id="destinationState"
                value={form?.destinationState ?? ""}
                onChange={(e) =>
                  handleChange("destinationState", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationPinCode">Destination Pincode</Label>
              <Input
                id="destinationPinCode"
                value={form?.destinationPinCode ?? ""}
                onChange={(e) =>
                  handleChange("destinationPinCode", e.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipment Specs</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                value={form?.weight ?? 0}
                onChange={(e) => handleChange("weight", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Declared Value (INR)</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={form?.value ?? 0}
                onChange={(e) => handleChange("value", Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status & Priority</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form?.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form?.priority}
                onValueChange={(v) => handleChange("priority", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Courier & Payment</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Courier Partner</Label>
              <Select
                value={form?.courierPartner}
                onValueChange={(v) => handleChange("courierPartner", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent>
                  {COURIER_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select
                value={form?.paymentMode}
                onValueChange={(v) => handleChange("paymentMode", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment mode" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((pm) => (
                    <SelectItem key={pm} value={pm} className="uppercase">
                      {pm.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manifest</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manifestDate">Manifest Date</Label>
              <Input
                id="manifestDate"
                type="date"
                value={form?.manifestDate ?? ""}
                onChange={(e) => handleChange("manifestDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manifestTime">Manifest Time</Label>
              <Input
                id="manifestTime"
                type="time"
                value={form?.manifestTime ?? ""}
                onChange={(e) => handleChange("manifestTime", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/shipments/${idParam}`)}
          >
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
