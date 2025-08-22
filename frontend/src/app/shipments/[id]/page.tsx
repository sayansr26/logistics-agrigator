"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  Truck,
  MapPin,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Plus,
  Eye,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Search,
  Filter,
  Download,
  RefreshCw,
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  User,
  Building,
  ChevronRight,
  ArrowRight,
  Check,
  Navigation,
  Layers,
  Smartphone,
  Monitor,
  Home,
  ChevronDown,
  Menu,
  Info,
  Shield,
  FileText,
  Upload,
  Share2,
  Printer,
  CheckCircle2,
} from "lucide-react";
import {
  mockShipments,
  getStatusColor,
  getPriorityColor,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ShipmentDetailProps {
  params: { id: string };
}

export default function ShipmentDetailPage({ params }: ShipmentDetailProps) {
  const router = useRouter();
  const { id } = params;
  const [showNotes, setShowNotes] = useState(false);

  // Find the shipment by ID (in real app, this would be an API call)
  const shipment = mockShipments.find((s) => s.id === id);

  if (!shipment) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Shipment Not Found
              </h2>
              <p className="text-gray-600 mb-6">
                The shipment you&apos;re looking for doesn&apos;t exist or has
                been removed.
              </p>
              <Button onClick={() => router.back()}>
                <ChevronRight className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: `Shipment #${shipment.trackingNumber}` },
  ];

  const handleStatusUpdate = (newStatus: string) => {
    // In real app, this would update the shipment status via API
    // Status update logic would go here
  };

  const handlePriorityUpdate = (newPriority: string) => {
    // In real app, this would update the shipment priority via API
    // Priority update logic would go here
  };

  const handleAddNote = () => {
    // In real app, this would add a note via API
    // Note addition logic would go here
  };

  const handlePrintLabel = () => {
    // In real app, this would print the shipping label
    // Print logic would go here
  };

  const handleGenerateChallan = () => {
    // In real app, this would generate a challan
    // Challan generation logic would go here
  };

  const handleCancelShipment = () => {
    // In real app, this would cancel the shipment
    // Cancellation logic would go here
  };

  // Enhanced tracking steps with more detail
  const trackingSteps = [
    {
      key: "label_created",
      label: "Label Created",
      description: "Shipment label generated",
      icon: Package,
      color: "bg-blue-500",
    },
    {
      key: "picked_up",
      label: "Picked Up",
      description: "Package collected from sender",
      icon: Truck,
      color: "bg-green-500",
    },
    {
      key: "in_transit",
      label: "In Transit",
      description: "Package in transit",
      icon: Truck, // Changed from TrendingUp to Truck for consistency
      color: "bg-yellow-500",
    },
    {
      key: "out_for_delivery",
      label: "Out for Delivery",
      description: "Out for final delivery",
      icon: Truck, // Changed from Zap to Truck for consistency
      color: "bg-orange-500",
    },
    {
      key: "delivered",
      label: "Delivered",
      description: "Package delivered successfully",
      icon: CheckCircle,
      color: "bg-green-600",
    },
  ];

  const statusToIndex: Record<string, number> = {
    pending: 0,
    delayed: 2,
    in_transit: 2,
    delivered: 4,
    cancelled: 0,
  };

  const currentIndex = statusToIndex[shipment.status] ?? 0;
  const progressPercentage = ((currentIndex + 1) / trackingSteps.length) * 100;

  // Enhanced timeline data
  const timelineEvents = [
    {
      title: "Shipment Created",
      time: shipment.createdAt,
      description: "Shipment label generated and assigned tracking number",
      icon: Package,
      status: "completed",
    },
    {
      title: "Manifest Generated",
      time: `${shipment.manifestDate} ${shipment.manifestTime}`,
      description: "Shipment manifested for pickup",
      icon: Truck, // Changed from FileText to Truck for consistency
      status: "completed",
    },
    {
      title: "Estimated Delivery",
      time: shipment.estimatedDelivery,
      description: "Expected delivery date",
      icon: Clock,
      status: shipment.status === "delivered" ? "completed" : "pending",
    },
  ];

  // Smart action buttons with context
  const actionButtons = [
    {
      label: "Download Label",
      icon: Download,
      variant: "outline" as const,
      description: "PDF format",
      action: handlePrintLabel,
    },
    {
      label: "Generate Challan",
      icon: Truck, // Changed from FileText to Truck for consistency
      variant: "outline" as const,
      description: "Create delivery challan",
      action: handleGenerateChallan,
    },
    {
      label: "Print Invoice",
      icon: Truck, // Changed from Printer to Truck for consistency
      variant: "outline" as const,
      description: "Print invoice copy",
      action: () => handlePrintLabel(),
    },
    {
      label: "Schedule Pickup",
      icon: Truck,
      variant: "outline" as const,
      description: "Arrange pickup",
      action: () => handleAddNote(),
    },
    {
      label: "Cancel Shipment",
      icon: XCircle,
      variant: "outline" as const,
      description: "Cancel this shipment",
      action: handleCancelShipment,
    },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Enhanced Header with Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <span>Shipment Details</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                Tracking:{" "}
                <span className="font-mono font-medium">
                  {shipment.trackingNumber}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Reference: {shipment.referenceNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className={`${getStatusColor(shipment.status)} text-sm px-4 py-2 text-base`}
            >
              {shipment.status.replace("_", " ")}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
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
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              asChild
            >
              <Link href="/shipments/create">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Shipment
              </Link>
            </Button>
          </div>
        </div>

        {/* Enhanced Top Summary with Visual Elements */}
        <Card className="border-0 bg-gradient-to-r from-slate-50 to-blue-50">
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
                      {shipment.trackingNumber}
                    </div>
                  </div>
                </div>

                {/* Enhanced Progress Bar */}
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
                    {currentIndex + 1} of {trackingSteps.length} steps completed
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-4 rounded-lg border bg-white/80 backdrop-blur-sm flex items-center gap-3 hover:bg-green-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Route</div>
                    <div className="font-medium text-xs">
                      {shipment.origin} → {shipment.destination}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-white/80 backdrop-blur-sm flex items-center gap-3 hover:bg-blue-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Manifest
                    </div>
                    <div className="text-xs font-medium">
                      {shipment.manifestDate} {shipment.manifestTime}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-white/80 backdrop-blur-sm flex items-center gap-3 hover:bg-purple-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Payment</div>
                    <Badge
                      className={`${getStatusColor(shipment.status)} text-xs`}
                    >
                      {shipment.paymentMode.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Enhanced Tracking Progress */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Truck className="h-3 w-3 text-blue-600" />
                  </div>
                  Tracking Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {trackingSteps.map((step, idx) => {
                    const isCompleted = idx <= currentIndex;
                    const isCurrent = idx === currentIndex;
                    const Icon = step.icon;

                    return (
                      <div key={step.key} className="flex items-start gap-4">
                        <div className={`relative flex-shrink-0`}>
                          <div
                            className={`${
                              isCompleted
                                ? "bg-gradient-to-br from-green-500 to-green-600 text-white"
                                : "bg-gray-100 text-gray-400"
                            } h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isCurrent
                                ? "ring-4 ring-blue-200 ring-offset-2"
                                : ""
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          {idx < trackingSteps.length - 1 && (
                            <div
                              className={`absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-12 ${
                                isCompleted
                                  ? "bg-gradient-to-b from-green-500 to-green-600"
                                  : "bg-gray-200"
                              }`}
                            />
                          )}
                        </div>

                        <div className="flex-1 pt-1">
                          <div
                            className={`font-medium ${
                              isCompleted
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {step.label}
                          </div>
                          <div
                            className={`text-sm ${
                              isCompleted
                                ? "text-muted-foreground"
                                : "text-muted-foreground/70"
                            }`}
                          >
                            {step.description}
                          </div>
                          {isCurrent && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                              Current Status
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Route & Parties */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-purple-600" />
                  </div>
                  Route & Parties
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 hover:bg-blue-100/50 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Package className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-sm font-medium text-blue-700">
                        Origin
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-semibold text-foreground">
                        {shipment.origin}, {shipment.originState}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        PIN: {shipment.originPinCode}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sender:{" "}
                        <span className="font-medium">
                          {shipment.senderName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 hover:bg-green-100/50 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="text-sm font-medium text-green-700">
                        Destination
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-semibold text-foreground">
                        {shipment.destination}, {shipment.destinationState}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        PIN: {shipment.destinationPinCode}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Receiver:{" "}
                        <span className="font-medium">
                          {shipment.receiverName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 hover:bg-amber-100/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center">
                        <Package className="h-3 w-3 text-amber-600" />
                      </div>
                      <div className="text-xs font-medium text-amber-700">
                        Weight
                      </div>
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {shipment.weight} kg
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 hover:bg-emerald-100/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <DollarSign className="h-3 w-3 text-emerald-600" />
                      </div>
                      <div className="text-xs font-medium text-emerald-700">
                        Value
                      </div>
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrency(shipment.value)}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 hover:bg-purple-100/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center">
                        <Check className="h-3 w-3 text-purple-600" />
                      </div>
                      <div className="text-xs font-medium text-purple-700">
                        Priority
                      </div>
                    </div>
                    <div className="text-lg font-bold text-foreground capitalize">
                      {shipment.priority}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200 hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                        <Truck className="h-3 w-3 text-slate-600" />
                      </div>
                      <div className="text-xs font-medium text-slate-700">
                        Courier
                      </div>
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {shipment.courierPartner}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Charges Summary */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="h-3 w-3 text-emerald-600" />
                  </div>
                  Charges Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const base = Math.max(50, Math.round(shipment.weight * 40));
                  const fuelSurcharge = Math.round(base * 0.12);
                  const handling = 20;
                  const gst = Math.round(
                    (base + fuelSurcharge + handling) * 0.18,
                  );
                  const total = base + fuelSurcharge + handling + gst;

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700">
                              Base Freight
                            </span>
                            <span className="text-lg font-bold text-foreground">
                              {formatCurrency(base)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Based on weight: {shipment.weight}kg × ₹40
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-amber-700">
                              Fuel Surcharge
                            </span>
                            <span className="text-lg font-bold text-foreground">
                              {formatCurrency(fuelSurcharge)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            12% of base freight
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-emerald-700">
                              Handling
                            </span>
                            <span className="text-lg font-bold text-foreground">
                              {formatCurrency(handling)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Fixed handling charge
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-purple-700">
                              GST (18%)
                            </span>
                            <span className="text-lg font-bold text-foreground">
                              {formatCurrency(gst)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Tax on total charges
                          </div>
                        </div>
                      </div>

                      <div className="p-6 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 border-2 border-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold text-foreground">
                            Total Amount
                          </div>
                          <div className="text-3xl font-bold text-foreground">
                            {formatCurrency(total)}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          All charges are inclusive of taxes
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <Info className="h-3 w-3 inline mr-1" />
                        Note: Charges are indicative for demo purposes. Actual
                        rates may vary.
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Enhanced Timeline */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Clock className="h-3 w-3 text-indigo-600" />
                  </div>
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {timelineEvents.map((event, idx) => {
                  const Icon = event.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          event.status === "completed"
                            ? "bg-green-100 text-green-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {event.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {typeof event.time === "string"
                            ? event.time
                            : "Loading..."}
                        </div>
                      </div>
                      {event.status === "completed" && (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Enhanced Actions */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <Truck className="h-3 w-3 text-blue-600" />
                  </div>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {actionButtons.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={idx}
                      variant={action.variant}
                      size="sm"
                      className="w-full justify-start h-auto py-3 px-4"
                      onClick={action.action}
                    >
                      <Icon className="h-4 w-4 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">{action.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {action.description}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Enhanced NDR Summary */}
            {(() => {
              // mockNDRs is no longer imported, so this will cause an error.
              // Assuming it's meant to be removed or replaced with a real NDR data source.
              // For now, commenting out the NDR section as it's not directly related to the shipment detail page.
              // If NDR functionality is needed, it must be re-implemented with a real data source.
              return null;
            })()}

            {/* Enhanced Customer Notifications */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                    <MessageSquare className="h-3 w-3 text-green-600" />
                  </div>
                  Customer Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Phone className="h-4 w-4 mr-3" />
                  Send SMS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Mail className="h-4 w-4 mr-3" />
                  Send Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <MessageSquare className="h-4 w-4 mr-3" />
                  Send WhatsApp
                </Button>
              </CardContent>
            </Card>

            {/* Enhanced Internal Notes */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                    <FileText className="h-3 w-3 text-slate-600" />
                  </div>
                  Internal Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Add a note for your team (not visible to customer)"
                  className="min-h-[100px] resize-none"
                />
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Notes are saved automatically and visible only to your team
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
