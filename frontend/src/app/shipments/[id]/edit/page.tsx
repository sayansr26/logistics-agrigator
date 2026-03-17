"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetShipmentByIdQuery,
  useUpdateShipmentMutation,
} from "@/store/api/endpoints/shipmentApi";
import {
  Package,
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

const STATUS_OPTIONS = [
  "CREATED",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RTO",
  "NDR",
  "HOLD",
];

const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-800",
  BOOKED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-indigo-100 text-indigo-800",
  IN_TRANSIT: "bg-yellow-100 text-yellow-800",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RTO: "bg-pink-100 text-pink-800",
  NDR: "bg-purple-100 text-purple-800",
  HOLD: "bg-amber-100 text-amber-800",
};

function formatStatus(s: string) {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatCurrency(n?: number | null) {
  if (n == null) return "₹0";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EditShipmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error, refetch } = useGetShipmentByIdQuery(id, {
    skip: !id,
  });
  const [updateShipment, { isLoading: saving, isSuccess, error: saveError }] =
    useUpdateShipmentMutation();

  const shipment = data?.data?.shipment;

  const [status, setStatus] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    if (shipment) {
      setStatus(shipment.status);
      setSpecialInstructions(shipment.specialInstructions || "");
    }
  }, [shipment]);

  const hasChanges =
    shipment &&
    (status !== shipment.status ||
      specialInstructions !== (shipment.specialInstructions || ""));

  const handleSave = async () => {
    if (!hasChanges) return;
    try {
      await updateShipment({
        id,
        data: {
          ...(status !== shipment!.status ? { status } : {}),
          ...(specialInstructions !== (shipment!.specialInstructions || "")
            ? { specialInstructions }
            : {}),
        },
      }).unwrap();
    } catch {
      // RTK handles error
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !shipment) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">
                {error ? "Failed to load shipment" : "Shipment Not Found"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {error
                  ? "Check your connection and try again."
                  : "The shipment doesn't exist."}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => router.back()}>
                  Go Back
                </Button>
                {error && (
                  <Button onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Retry
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    {
      title: `#${shipment.awbNumber || shipment.orderId}`,
      href: `/shipments/${id}`,
    },
    { title: "Edit" },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/shipments/${id}`}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-blue-600" />
                Edit Shipment
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                AWB: {shipment.awbNumber || "Pending"} · Order:{" "}
                {shipment.orderId}
              </p>
            </div>
          </div>
          <Badge className={STATUS_COLORS[shipment.status]}>
            {formatStatus(shipment.status)}
          </Badge>
        </div>

        {/* Success / Error banners */}
        {isSuccess && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800 dark:text-green-300">
              Shipment updated successfully.
            </p>
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to update shipment. Please try again.
            </p>
          </div>
        )}

        {/* Read-only summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">
                  {shipment.shipmentType || "B2C"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Service</dt>
                <dd className="font-medium">{shipment.serviceType || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Partner</dt>
                <dd className="font-medium">
                  {shipment.partnerName || "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total Cost</dt>
                <dd className="font-medium">
                  {formatCurrency(shipment.totalCost)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payment</dt>
                <dd className="font-medium">
                  {shipment.paymentType} ({shipment.paymentStatus || "—"})
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Weight</dt>
                <dd className="font-medium">{shipment.weight ?? "—"} kg</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pickup</dt>
                <dd className="font-medium">
                  {shipment.pickupCity}, {shipment.pickupState} -{" "}
                  {shipment.pickupPincode}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="font-medium">
                  {shipment.deliveryCity}, {shipment.deliveryState} -{" "}
                  {shipment.deliveryPincode}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Editable fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update Shipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        <Badge className={`${STATUS_COLORS[s]} text-xs`}>
                          {formatStatus(s)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Special Instructions
              </label>
              <Textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Add handling instructions, delivery notes, etc."
                rows={4}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" asChild>
                <Link href={`/shipments/${id}`}>Cancel</Link>
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
