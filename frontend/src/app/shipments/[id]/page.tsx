"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useGetShipmentByIdQuery,
  useCancelShipmentMutation,
  useDownloadLabelMutation,
  useRetryCourierBookingMutation,
  useRefreshFromProviderMutation,
  useFetchCourierLabelMutation,
  useCancelWithProviderMutation,
  useRerateShipmentMutation,
} from "@/store/api/endpoints/shipmentApi";
import type {
  TrackingEvent,
  ProviderAction,
} from "@/store/api/endpoints/shipmentApi";
import { useRole } from "@/hooks/useRole";
import {
  useGetMyAddressesQuery,
  useGetOutletAddressesQuery,
} from "@/store/api/endpoints/outletApi";
import type { OutletAddress } from "@/store/api/endpoints/outletApi";
import {
  Package,
  Truck,
  MapPin,
  Clock,
  IndianRupee,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Download,
  MessageSquare,
  Phone,
  Mail,
  ChevronRight,
  Info,
  Shield,
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Scale,
} from "lucide-react";
import Link from "next/link";

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

const TRACKING_STEPS = [
  { key: "CREATED", label: "Created", icon: Package },
  { key: "BOOKED", label: "Booked", icon: Package },
  { key: "PICKED_UP", label: "Picked Up", icon: Truck },
  { key: "IN_TRANSIT", label: "In Transit", icon: Truck },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle },
];

const STATUS_INDEX: Record<string, number> = {
  CREATED: 0,
  BOOKED: 1,
  PICKED_UP: 2,
  IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
  CANCELLED: 0,
  RTO: 3,
  NDR: 4,
  HOLD: 3,
};

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(n?: number | null) {
  if (n == null) return "₹0";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatStatus(s: string) {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { isSystemAdmin, isRole } = useRole();
  const isOutlet = isRole("outlet");
  const isAdminLike = isSystemAdmin();

  const { data, isLoading, error, refetch } = useGetShipmentByIdQuery(id, {
    skip: !id,
  });
  const [cancelShipment, { isLoading: cancelling }] =
    useCancelShipmentMutation();
  const [downloadLabel, { isLoading: downloading }] =
    useDownloadLabelMutation();
  const [retryCourierBooking, { isLoading: retrying }] =
    useRetryCourierBookingMutation();
  const [refreshFromProvider, { isLoading: refreshing }] =
    useRefreshFromProviderMutation();
  const [fetchCourierLabel, { isLoading: fetchingLabel }] =
    useFetchCourierLabelMutation();
  const [cancelWithProvider, { isLoading: cancellingProvider }] =
    useCancelWithProviderMutation();
  const [rerateShipment, { isLoading: rerating }] = useRerateShipmentMutation();

  const shipment = data?.data?.shipment;
  const providerCapabilities = data?.data?.providerCapabilities;
  const availableActions: ProviderAction[] =
    providerCapabilities?.availableActions || [];

  const shouldFetchOutletAddrs = isAdminLike && !!shipment?.outletId;
  const { data: outletAddrsData } = useGetOutletAddressesQuery(
    shipment?.outletId || "",
    { skip: !shouldFetchOutletAddrs },
  );
  const { data: myAddrsData } = useGetMyAddressesQuery(undefined, {
    skip: !isOutlet,
  });

  const resolvedAddresses: OutletAddress[] = isOutlet
    ? myAddrsData?.data?.addresses || []
    : outletAddrsData?.data?.addresses || [];

  const resolvedPickupLocation =
    resolvedAddresses.find((a) => a.id === shipment?.pickupAddressId)?.label ||
    resolvedAddresses.find((a) => a.id === shipment?.pickupAddressId)?.name ||
    "";

  const [retryOpen, setRetryOpen] = useState(false);
  const [retryPickupLocation, setRetryPickupLocation] = useState("");
  const [retryError, setRetryError] = useState<string | null>(null);

  const [revalueOpen, setRevalueOpen] = useState(false);
  const [revalueWeight, setRevalueWeight] = useState("");
  const [revalueLength, setRevalueLength] = useState("");
  const [revalueWidth, setRevalueWidth] = useState("");
  const [revalueHeight, setRevalueHeight] = useState("");
  const [revalueReason, setRevalueReason] = useState("");
  const [revalueCodAction, setRevalueCodAction] = useState<
    "DEDUCT_WALLET" | "UPDATE_COD"
  >("UPDATE_COD");
  const [revalueError, setRevalueError] = useState<string | null>(null);
  const [revalueSuccess, setRevalueSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!shipment) return;
    if (retryOpen) return;
    // Prefer the outlet-address label/name (warehouse) over pickup contact name.
    setRetryPickupLocation(resolvedPickupLocation || "");
  }, [shipment?.id, resolvedPickupLocation, retryOpen]);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this shipment?")) return;
    try {
      await cancelShipment(id).unwrap();
    } catch {
      // handled by RTK
    }
  };

  const handleRetryBooking = async (pickupLocationOverride?: string) => {
    setRetryError(null);
    try {
      const pickupLocation =
        typeof pickupLocationOverride === "string"
          ? pickupLocationOverride
          : retryPickupLocation;

      await retryCourierBooking({
        id,
        pickupLocation: pickupLocation.trim() || undefined,
      }).unwrap();
      setRetryOpen(false);
      await refetch();
    } catch (e) {
      const err = e as {
        data?: { error?: { message?: string } };
        error?: { message?: string };
        message?: string;
      };
      setRetryError(
        err?.data?.error?.message ||
          err?.error?.message ||
          err?.message ||
          "Failed to retry courier booking",
      );
    }
  };

  const handleDownloadLabel = async () => {
    try {
      const blob = await downloadLabel(id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `label-${shipment?.awbNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // handled by RTK
    }
  };

  const handleRefreshFromProvider = async () => {
    try {
      await refreshFromProvider(id).unwrap();
      await refetch();
    } catch {
      // handled by RTK
    }
  };

  const handleFetchCourierLabel = async () => {
    try {
      const result = await fetchCourierLabel({ id }).unwrap();
      if (result?.data?.label?.data) {
        const byteCharacters = atob(result.data.label.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `courier-label-${shipment?.awbNumber || id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // handled by RTK
    }
  };

  const handleCancelWithProvider = async () => {
    if (
      !confirm(
        "Cancel this shipment? This will cancel with the courier first, then update internally.",
      )
    )
      return;
    try {
      await cancelWithProvider({
        id,
        reason: "User requested cancellation",
      }).unwrap();
      await refetch();
    } catch {
      // handled by RTK
    }
  };

  const handleRevalueCharges = async () => {
    setRevalueError(null);
    setRevalueSuccess(null);

    if (!revalueReason.trim() || revalueReason.trim().length < 5) {
      setRevalueError("Reason must be at least 5 characters");
      return;
    }

    const hasAtLeastOneField =
      revalueWeight || revalueLength || revalueWidth || revalueHeight;
    if (!hasAtLeastOneField) {
      setRevalueError(
        "At least one disputed dimension or weight must be provided",
      );
      return;
    }

    try {
      const payload: {
        disputedWeight?: number;
        disputedLength?: number;
        disputedWidth?: number;
        disputedHeight?: number;
        reason: string;
        codAction?: "DEDUCT_WALLET" | "UPDATE_COD";
      } = {
        reason: revalueReason.trim(),
      };

      if (revalueWeight) payload.disputedWeight = parseFloat(revalueWeight);
      if (revalueLength) payload.disputedLength = parseFloat(revalueLength);
      if (revalueWidth) payload.disputedWidth = parseFloat(revalueWidth);
      if (revalueHeight) payload.disputedHeight = parseFloat(revalueHeight);

      if (shipment?.paymentType === "COD") {
        payload.codAction = revalueCodAction;
      }

      const result = await rerateShipment({ id, data: payload }).unwrap();
      const msg =
        result?.message ||
        result?.data?.message ||
        "Charges revalued successfully";
      setRevalueSuccess(msg);
      await refetch();
      setTimeout(() => {
        setRevalueOpen(false);
        setRevalueSuccess(null);
        setRevalueWeight("");
        setRevalueLength("");
        setRevalueWidth("");
        setRevalueHeight("");
        setRevalueReason("");
        setRevalueCodAction("UPDATE_COD");
      }, 2000);
    } catch (e) {
      const err = e as {
        data?: { error?: { message?: string }; message?: string };
        error?: { message?: string };
        message?: string;
      };
      setRevalueError(
        err?.data?.error?.message ||
          err?.data?.message ||
          err?.error?.message ||
          err?.message ||
          "Failed to revalue charges",
      );
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-6 p-6">
          <Skeleton className="h-12 w-96" />
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="h-64 col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !shipment) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {error ? "Failed to load shipment" : "Shipment Not Found"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {error
                  ? "Check your connection and try again."
                  : "The shipment you're looking for doesn't exist."}
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

  const currentIndex = STATUS_INDEX[shipment.status] ?? 0;
  const isCancelledOrSpecial = ["CANCELLED", "RTO", "NDR", "HOLD"].includes(
    shipment.status,
  );
  const progressPercentage = isCancelledOrSpecial
    ? 0
    : ((currentIndex + 1) / TRACKING_STEPS.length) * 100;

  const trackingEvents: TrackingEvent[] = shipment.trackingEvents || [];
  const qs = shipment.quoteSnapshot as {
    chargeBreakdown?: Array<{ name: string; amount: number }>;
    discount?: {
      packageName: string;
      badge: string;
      originalTotal: number;
      totalDiscount: number;
      finalTotal: number;
    } | null;
  } | null;
  const chargeBreakdown = qs?.chargeBreakdown;
  const quoteDiscount = qs?.discount;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: `#${shipment.awbNumber || shipment.orderId}` },
  ];

  const canRetryBooking =
    !shipment.awbNumber && shipment.bookingStatus === "PENDING_BOOKING";

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Shipment Details
              </h1>
              <p className="text-muted-foreground mt-1">
                AWB:{" "}
                <span className="font-mono font-medium">
                  {shipment.awbNumber || "Pending"}
                </span>
                {shipment.trackingUrl && (
                  <a
                    href={shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Track <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Order: {shipment.orderId} · Type:{" "}
                {shipment.shipmentType || "B2C"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className={`${STATUS_COLORS[shipment.status] || ""} text-sm px-4 py-2`}
            >
              {formatStatus(shipment.status)}
            </Badge>
          </div>
        </div>

        {/* Top Summary */}
        <Card className="border-0 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Tracking Number
                    </div>
                    <div className="text-2xl font-bold tracking-tight font-mono">
                      {shipment.awbNumber || "Pending"}
                    </div>
                  </div>
                </div>
                {!isCancelledOrSpecial && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Delivery Progress
                      </span>
                      <span className="font-medium">
                        {Math.round(progressPercentage)}%
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {currentIndex + 1} of {TRACKING_STEPS.length} steps
                      completed
                    </div>
                  </div>
                )}
                {isCancelledOrSpecial && (
                  <div className="mt-2">
                    <Badge className={STATUS_COLORS[shipment.status]}>
                      {formatStatus(shipment.status)}
                    </Badge>
                    {shipment.holdReason && (
                      <p className="text-sm text-amber-700 mt-1">
                        Hold: {shipment.holdReason}
                      </p>
                    )}
                    {shipment.cancellationReason && (
                      <p className="text-sm text-red-700 mt-1">
                        Reason: {shipment.cancellationReason}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-4 rounded-lg border bg-white/80 dark:bg-white/5 flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-xs text-muted-foreground">Route</div>
                    <div className="font-medium text-xs">
                      {shipment.pickupCity} → {shipment.deliveryCity}
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-white/80 dark:bg-white/5 flex items-center gap-3">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-xs text-muted-foreground">Created</div>
                    <div className="text-xs font-medium">
                      {formatDateTime(shipment.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-white/80 dark:bg-white/5 flex items-center gap-3">
                  <IndianRupee className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Total Cost
                    </div>
                    <div className="text-xs font-bold">
                      {formatCurrency(shipment.totalCost)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Tracking Progress */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" /> Tracking Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {TRACKING_STEPS.map((step, idx) => {
                    const isCompleted =
                      !isCancelledOrSpecial && idx <= currentIndex;
                    const isCurrent =
                      !isCancelledOrSpecial && idx === currentIndex;
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex items-start gap-4">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                              isCompleted
                                ? "bg-gradient-to-br from-green-500 to-green-600 text-white"
                                : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                            } ${isCurrent ? "ring-4 ring-blue-200 ring-offset-2" : ""}`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          {idx < TRACKING_STEPS.length - 1 && (
                            <div
                              className={`absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-12 ${
                                isCompleted
                                  ? "bg-green-500"
                                  : "bg-gray-200 dark:bg-gray-700"
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <div
                            className={`font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {step.label}
                          </div>
                          {isCurrent && (
                            <div className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs dark:bg-blue-950 dark:text-blue-300">
                              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />{" "}
                              Current
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Route & Parties */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-600" /> Route &amp;
                  Parties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                    <div className="flex items-center gap-3 mb-3">
                      <Package className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Pickup
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="font-semibold">{shipment.pickupName}</div>
                      <div className="text-sm text-muted-foreground">
                        {shipment.pickupLine1}
                      </div>
                      {shipment.pickupLine2 && (
                        <div className="text-sm text-muted-foreground">
                          {shipment.pickupLine2}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {shipment.pickupCity}, {shipment.pickupState} -{" "}
                        {shipment.pickupPincode}
                      </div>
                      {shipment.pickupPhone && (
                        <div className="text-xs text-muted-foreground">
                          {shipment.pickupPhone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-5 rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        Delivery
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="font-semibold">
                        {shipment.deliveryName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {shipment.deliveryLine1}
                      </div>
                      {shipment.deliveryLine2 && (
                        <div className="text-sm text-muted-foreground">
                          {shipment.deliveryLine2}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {shipment.deliveryCity}, {shipment.deliveryState} -{" "}
                        {shipment.deliveryPincode}
                      </div>
                      {shipment.deliveryPhone && (
                        <div className="text-xs text-muted-foreground">
                          {shipment.deliveryPhone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                      Weight{shipment.disputedWeight ? " (Disputed)" : ""}
                    </div>
                    <div className="text-lg font-bold">
                      {shipment.disputedWeight ??
                        shipment.chargeableWeight ??
                        shipment.weight ??
                        "—"}{" "}
                      kg
                    </div>
                    {shipment.disputedWeight &&
                      shipment.disputedWeight !== shipment.weight && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Original: {shipment.weight} kg
                        </div>
                      )}
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                      Value
                    </div>
                    <div className="text-lg font-bold">
                      {shipment.value ? formatCurrency(shipment.value) : "—"}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 dark:bg-purple-950 dark:border-purple-800">
                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                      Dimensions
                    </div>
                    <div className="text-lg font-bold">
                      {shipment.length && shipment.width && shipment.height
                        ? `${shipment.length}×${shipment.width}×${shipment.height}`
                        : "—"}
                    </div>
                  </div>
                  {shipment.paymentType === "COD" && shipment.codAmount ? (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                      <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                        COD Amount
                      </div>
                      <div className="text-lg font-bold">
                        {formatCurrency(shipment.codAmount)}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Courier
                      </div>
                      <div className="text-lg font-bold">
                        {shipment.partnerName || "Unassigned"}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Charges Summary */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-emerald-600" /> Charges
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {chargeBreakdown && chargeBreakdown.length > 0 ? (
                    <div className="rounded-xl border overflow-hidden">
                      <div className="divide-y">
                        {chargeBreakdown.map((cb, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-5 py-3.5"
                          >
                            <span className="text-sm text-muted-foreground">
                              {cb.name}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {formatCurrency(cb.amount)}
                            </span>
                          </div>
                        ))}
                        {quoteDiscount && (
                          <div className="flex items-center justify-between px-5 py-3.5 bg-green-50 dark:bg-green-950/40">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 border-green-300 text-green-600"
                              >
                                {quoteDiscount.badge}
                              </Badge>
                              <span className="text-sm text-green-700 dark:text-green-400">
                                {quoteDiscount.packageName}
                              </span>
                            </div>
                            <span className="font-semibold text-green-600 tabular-nums">
                              -{formatCurrency(quoteDiscount.totalDiscount)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      No charge breakdown available.
                    </div>
                  )}

                  <div className="p-6 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-2">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold">Total Amount</div>
                      <div className="text-3xl font-bold">
                        {formatCurrency(shipment.totalCost)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      Payment: {shipment.paymentType} · Status:{" "}
                      {shipment.paymentStatus || "—"}
                      {shipment.codAmount
                        ? ` · COD: ${formatCurrency(shipment.codAmount)}`
                        : ""}
                    </div>
                    {quoteDiscount && (
                      <p className="text-xs text-green-600 mt-1">
                        Original: {formatCurrency(quoteDiscount.originalTotal)}{" "}
                        · You saved{" "}
                        {formatCurrency(quoteDiscount.totalDiscount)}
                      </p>
                    )}
                  </div>

                  {shipment.disputeStatus && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
                        <AlertTriangle className="h-4 w-4" /> Dispute:{" "}
                        {shipment.disputeStatus}
                      </div>
                      {shipment.disputedCost && (
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                          Disputed Cost: {formatCurrency(shipment.disputedCost)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Timeline */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" /> Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {trackingEvents.length > 0 ? (
                  trackingEvents.map((evt, idx) => (
                    <div
                      key={evt.id || idx}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {formatStatus(evt.status)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {evt.message || evt.description || "—"}
                        </div>
                        {evt.location && (
                          <div className="text-xs text-muted-foreground">
                            {evt.location}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(evt.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No tracking events yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions - Dynamic from provider capabilities */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canRetryBooking && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={() => {
                      if (resolvedPickupLocation) {
                        void handleRetryBooking(resolvedPickupLocation);
                        return;
                      }
                      setRetryOpen(true);
                    }}
                    disabled={retrying}
                  >
                    {retrying ? (
                      <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-3" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">Retry Booking</div>
                      <div className="text-xs text-muted-foreground">
                        Generate AWB again (pending booking)
                      </div>
                    </div>
                  </Button>
                )}

                {isAdminLike &&
                  ["CREATED", "BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(
                    shipment.status,
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-auto py-3 px-4 text-amber-600 hover:text-amber-700"
                      onClick={() => {
                        setRevalueError(null);
                        setRevalueSuccess(null);
                        setRevalueWeight(
                          shipment.weight ? String(shipment.weight) : "",
                        );
                        setRevalueLength(
                          shipment.length ? String(shipment.length) : "",
                        );
                        setRevalueWidth(
                          shipment.width ? String(shipment.width) : "",
                        );
                        setRevalueHeight(
                          shipment.height ? String(shipment.height) : "",
                        );
                        setRevalueOpen(true);
                      }}
                    >
                      <Scale className="h-4 w-4 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">Revalue Charges</div>
                        <div className="text-xs text-muted-foreground">
                          Re-rate with updated weight or dimensions
                        </div>
                      </div>
                    </Button>
                  )}

                {availableActions
                  .filter((a) => a.enabled)
                  .map((action) => {
                    if (action.action === "refresh") {
                      return (
                        <Button
                          key={action.action}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-auto py-3 px-4"
                          onClick={handleRefreshFromProvider}
                          disabled={refreshing}
                        >
                          {refreshing ? (
                            <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-3" />
                          )}
                          <div className="text-left">
                            <div className="font-medium">
                              Refresh from Provider
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {action.description}
                            </div>
                          </div>
                        </Button>
                      );
                    }

                    if (action.action === "track" && shipment.trackingUrl) {
                      return (
                        <a
                          key={action.action}
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full block"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start h-auto py-3 px-4"
                          >
                            <ExternalLink className="h-4 w-4 mr-3" />
                            <div className="text-left">
                              <div className="font-medium">Track Shipment</div>
                              <div className="text-xs text-muted-foreground">
                                {action.description}
                              </div>
                            </div>
                          </Button>
                        </a>
                      );
                    }

                    if (action.action === "label") {
                      return (
                        <Button
                          key={action.action}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-auto py-3 px-4"
                          onClick={handleFetchCourierLabel}
                          disabled={fetchingLabel}
                        >
                          {fetchingLabel ? (
                            <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-3" />
                          )}
                          <div className="text-left">
                            <div className="font-medium">
                              Download Courier Label
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {action.description}
                            </div>
                          </div>
                        </Button>
                      );
                    }

                    if (action.action === "cancel") {
                      return (
                        <Button
                          key={action.action}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-auto py-3 px-4 text-red-600 hover:text-red-700"
                          onClick={handleCancelWithProvider}
                          disabled={
                            cancellingProvider ||
                            shipment.status === "CANCELLED" ||
                            shipment.status === "DELIVERED"
                          }
                        >
                          {cancellingProvider ? (
                            <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-3" />
                          )}
                          <div className="text-left">
                            <div className="font-medium">Cancel Shipment</div>
                            <div className="text-xs text-muted-foreground">
                              {action.description}
                            </div>
                          </div>
                        </Button>
                      );
                    }

                    if (action.action === "edit") {
                      return (
                        <Button
                          key={action.action}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-auto py-3 px-4"
                          onClick={() => router.push(`/shipments/${id}/edit`)}
                        >
                          <FileText className="h-4 w-4 mr-3" />
                          <div className="text-left">
                            <div className="font-medium">Edit Shipment</div>
                            <div className="text-xs text-muted-foreground">
                              {action.description}
                            </div>
                          </div>
                        </Button>
                      );
                    }

                    if (action.action === "pickup") {
                      return (
                        <Button
                          key={action.action}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-auto py-3 px-4"
                          disabled
                        >
                          <Truck className="h-4 w-4 mr-3" />
                          <div className="text-left">
                            <div className="font-medium">Request Pickup</div>
                            <div className="text-xs text-muted-foreground">
                              {action.description}
                            </div>
                          </div>
                        </Button>
                      );
                    }

                    return null;
                  })}

                {/* Fallback actions when no provider capabilities loaded */}
                {availableActions.length === 0 && !canRetryBooking && (
                  <>
                    {shipment.trackingUrl && (
                      <a
                        href={shipment.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full block"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-auto py-3 px-4"
                        >
                          <ExternalLink className="h-4 w-4 mr-3" />
                          <div className="text-left">
                            <div className="font-medium">Track Shipment</div>
                            <div className="text-xs text-muted-foreground">
                              View on courier website
                            </div>
                          </div>
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-auto py-3 px-4"
                      onClick={handleDownloadLabel}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-3" />
                      )}
                      <div className="text-left">
                        <div className="font-medium">Download Label</div>
                        <div className="text-xs text-muted-foreground">
                          PDF format
                        </div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-auto py-3 px-4 text-red-600 hover:text-red-700"
                      onClick={handleCancel}
                      disabled={
                        cancelling ||
                        shipment.status === "CANCELLED" ||
                        shipment.status === "DELIVERED"
                      }
                    >
                      {cancelling ? (
                        <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-3" />
                      )}
                      <div className="text-left">
                        <div className="font-medium">Cancel Shipment</div>
                        <div className="text-xs text-muted-foreground">
                          Cancel and request refund
                        </div>
                      </div>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            {shipment.documents && shipment.documents.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" /> Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {shipment.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-950">
                          <FileText className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {doc.type} · {doc.source} · {doc.format || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {doc.fetchedAt
                          ? formatDateTime(doc.fetchedAt)
                          : formatDateTime(doc.createdAt)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Provider Sync Status */}
            {providerCapabilities && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-600" /> Provider
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Provider</dt>
                      <dd className="font-medium">
                        {providerCapabilities.providerName}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="font-medium">
                        {providerCapabilities.aggregatorType}
                      </dd>
                    </div>
                    {shipment.providerLastSyncAt && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Last Synced</dt>
                        <dd className="font-medium">
                          {formatDateTime(shipment.providerLastSyncAt)}
                        </dd>
                      </div>
                    )}
                    {shipment.providerStatus && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                          Provider Status
                        </dt>
                        <dd className="font-medium">
                          {formatStatus(shipment.providerStatus)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Shipment Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-slate-600" /> Additional Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Service</dt>
                    <dd className="font-medium">
                      {shipment.serviceType || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Boxes</dt>
                    <dd className="font-medium">
                      {shipment.numberOfBoxes || 1}
                    </dd>
                  </div>
                  {shipment.chargeableWeight && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Chargeable Weight
                      </dt>
                      <dd className="font-medium">
                        {shipment.chargeableWeight} kg
                      </dd>
                    </div>
                  )}
                  {shipment.volumetricWeight && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Volumetric Weight
                      </dt>
                      <dd className="font-medium">
                        {shipment.volumetricWeight} kg
                      </dd>
                    </div>
                  )}
                  {shipment.fragile && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Fragile</dt>
                      <dd className="font-medium text-amber-600">Yes</dd>
                    </div>
                  )}
                  {shipment.specialInstructions && (
                    <div className="pt-2 border-t">
                      <dt className="text-muted-foreground mb-1">
                        Special Instructions
                      </dt>
                      <dd className="text-sm">
                        {shipment.specialInstructions}
                      </dd>
                    </div>
                  )}
                  {shipment.estimatedDelivery && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Est. Delivery</dt>
                      <dd className="font-medium">
                        {formatDate(shipment.estimatedDelivery)}
                      </dd>
                    </div>
                  )}
                  {shipment.actualDelivery && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Actual Delivery</dt>
                      <dd className="font-medium">
                        {formatDate(shipment.actualDelivery)}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={retryOpen}
        onOpenChange={(open) => {
          setRetryOpen(open);
          if (!open) setRetryError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retry Courier Booking</DialogTitle>
            <DialogDescription>
              If you’re using Delhivery,{" "}
              <span className="font-medium">Pickup Location</span> must match
              the warehouse name configured in your Delhivery account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="pickupLocation">Pickup Location</Label>
            <Input
              id="pickupLocation"
              placeholder="e.g. WH_HOWRAH_01"
              value={retryPickupLocation}
              onChange={(e) => setRetryPickupLocation(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use the exact Delhivery One pickup location name (warehouse), not
              the pickup person’s name. If your pickup address has a warehouse
              label, we auto-fill it for you.
            </p>
            {retryError && (
              <p className="text-sm text-destructive">{retryError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRetryOpen(false)}
              disabled={retrying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRetryBooking()}
              disabled={retrying}
            >
              {retrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Retrying…
                </>
              ) : (
                "Retry Booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revalue Charges Dialog */}
      <Dialog
        open={revalueOpen}
        onOpenChange={(open) => {
          setRevalueOpen(open);
          if (!open) {
            setRevalueError(null);
            setRevalueSuccess(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revalue Charges</DialogTitle>
            <DialogDescription>
              Enter the courier-validated weight and/or dimensions to
              recalculate shipping charges. The difference will be settled based
              on the payment type.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="revalueWeight">Weight (kg)</Label>
                <Input
                  id="revalueWeight"
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="e.g. 2.5"
                  value={revalueWeight}
                  onChange={(e) => setRevalueWeight(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="revalueLength">Length (cm)</Label>
                <Input
                  id="revalueLength"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 30"
                  value={revalueLength}
                  onChange={(e) => setRevalueLength(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="revalueWidth">Width (cm)</Label>
                <Input
                  id="revalueWidth"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 20"
                  value={revalueWidth}
                  onChange={(e) => setRevalueWidth(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="revalueHeight">Height (cm)</Label>
                <Input
                  id="revalueHeight"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 15"
                  value={revalueHeight}
                  onChange={(e) => setRevalueHeight(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="revalueReason">Reason</Label>
              <Input
                id="revalueReason"
                placeholder="e.g. Courier weight discrepancy"
                value={revalueReason}
                onChange={(e) => setRevalueReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 5 characters. Describe why the charges need revaluation.
              </p>
            </div>

            {shipment?.paymentType === "COD" && (
              <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <Label className="text-amber-800 dark:text-amber-300 font-medium">
                  COD Extra Charge Handling
                </Label>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  If the new charges are higher, how should the extra cost be
                  handled?
                </p>
                <div className="space-y-2 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="codAction"
                      value="UPDATE_COD"
                      checked={revalueCodAction === "UPDATE_COD"}
                      onChange={() => setRevalueCodAction("UPDATE_COD")}
                      className="accent-amber-600"
                    />
                    <div>
                      <span className="text-sm font-medium">
                        Update COD Amount
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Increase the COD collection amount to cover the
                        difference
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="codAction"
                      value="DEDUCT_WALLET"
                      checked={revalueCodAction === "DEDUCT_WALLET"}
                      onChange={() => setRevalueCodAction("DEDUCT_WALLET")}
                      className="accent-amber-600"
                    />
                    <div>
                      <span className="text-sm font-medium">
                        Deduct from Wallet
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Charge the difference from the user&apos;s wallet
                        balance
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {revalueError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {revalueError}
              </div>
            )}

            {revalueSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {revalueSuccess}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevalueOpen(false)}
              disabled={rerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRevalueCharges()}
              disabled={rerating || !!revalueSuccess}
            >
              {rerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                  Recalculating...
                </>
              ) : (
                "Revalue Charges"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
