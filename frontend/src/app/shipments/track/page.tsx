"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";
import {
  Package,
  Truck,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  Copy,
  Share2,
  Printer,
  CheckCircle2,
  Upload,
  Plus,
} from "lucide-react";

// Mock tracking data - replace with actual API call
const mockTrackingData = {
  trackingNumber: "LOG123456789",
  status: "in_transit",
  estimatedDelivery: "2024-03-20",
  currentLocation: "Mumbai, Maharashtra",
  shipmentDetails: {
    origin: "Delhi, India",
    destination: "Bangalore, India",
    weight: "2.5 kg",
    dimensions: "30x20x10 cm",
    service: "Express Delivery",
  },
  timeline: [
    {
      status: "delivered",
      location: "Bangalore Hub",
      timestamp: "2024-03-19 15:30",
      description: "Package delivered successfully",
      isCompleted: true,
    },
    {
      status: "out_for_delivery",
      location: "Bangalore Local Hub",
      timestamp: "2024-03-19 09:15",
      description: "Out for delivery with courier",
      isCompleted: true,
    },
    {
      status: "in_transit",
      location: "Mumbai Hub",
      timestamp: "2024-03-18 18:45",
      description: "Package in transit to destination",
      isCompleted: true,
    },
    {
      status: "picked_up",
      location: "Delhi Hub",
      timestamp: "2024-03-17 14:20",
      description: "Package picked up by courier",
      isCompleted: true,
    },
    {
      status: "label_created",
      location: "Delhi",
      timestamp: "2024-03-17 10:00",
      description: "Shipping label created",
      isCompleted: true,
    },
  ],
};

const getStatusBadge = (status: string) => {
  const statusMap = {
    delivered: { label: "Delivered", variant: "default" as const },
    out_for_delivery: {
      label: "Out for Delivery",
      variant: "secondary" as const,
    },
    in_transit: { label: "In Transit", variant: "secondary" as const },
    picked_up: { label: "Picked Up", variant: "secondary" as const },
    label_created: { label: "Label Created", variant: "default" as const },
    exception: { label: "Exception", variant: "destructive" as const },
  };
  return (
    statusMap[status as keyof typeof statusMap] || {
      label: status,
      variant: "default" as const,
    }
  );
};

export default function TrackPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setTrackingResult] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: "Track" },
  ];

  const handleTrack = async () => {
    if (!searchTerm.trim()) return;

    setIsTracking(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock tracking result
    setTrackingResult({
      trackingNumber: searchTerm,
      status: "in_transit",
      location: "Mumbai, India",
      estimatedDelivery: "2024-01-20",
      lastUpdate: "2024-01-18 14:30",
    });
    setIsTracking(false);
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Truck className="h-8 w-8 text-logistics-600" />
              <span>Track Shipment</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Track and view detailed shipment status and history
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments">
                <Package className="h-3.5 w-3.5 mr-1.5" />
                All Shipments
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

        {/* Tracking Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Track Your Shipment</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter tracking number or order ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTrack}>Track</Button>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Number */}
        {/* <div className="text-2xl font-bold tracking-tight">LOG123456789</div> */}

        {isTracking && (
          <>
            {/* Top Status & Progress (Ecomiq-style) */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Tracking Number
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-2xl font-bold tracking-tight">
                        {mockTrackingData.trackingNumber}
                      </p>
                      <Badge
                        variant={
                          getStatusBadge(mockTrackingData.status).variant
                        }
                      >
                        {getStatusBadge(mockTrackingData.status).label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="px-3">
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" className="px-3">
                      <Share2 className="h-3.5 w-3.5 mr-1" /> Share
                    </Button>
                    <Button variant="outline" size="sm" className="px-3">
                      <Printer className="h-3.5 w-3.5 mr-1" /> Print
                    </Button>
                  </div>
                </div>

                {/* Horizontal Stepper */}
                {(() => {
                  const stepKeys = [
                    "label_created",
                    "picked_up",
                    "in_transit",
                    "out_for_delivery",
                    "delivered",
                  ];
                  const stepLabels: Record<string, string> = {
                    label_created: "Label Created",
                    picked_up: "Picked Up",
                    in_transit: "In Transit",
                    out_for_delivery: "Out for Delivery",
                    delivered: "Delivered",
                  };
                  const currentIndex = Math.max(
                    0,
                    stepKeys.indexOf(mockTrackingData.status),
                  );
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center">
                        {stepKeys.map((key, idx) => {
                          const isCompleted = idx <= currentIndex;
                          return (
                            <div key={key} className="flex items-center flex-1">
                              <div
                                className={`${
                                  isCompleted
                                    ? "bg-blue-600 text-white"
                                    : "bg-muted text-muted-foreground"
                                } h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold`}
                              >
                                {idx + 1}
                              </div>
                              {idx < stepKeys.length - 1 && (
                                <div
                                  className={`${
                                    idx < currentIndex
                                      ? "bg-blue-600"
                                      : "bg-border"
                                  } h-1 flex-1 mx-2 rounded`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-5 text-xs text-muted-foreground">
                        {stepKeys.map((key) => (
                          <div key={key} className="text-center">
                            {stepLabels[key]}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Quick Facts */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-2">Estimated Delivery</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{mockTrackingData.estimatedDelivery}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Current Location</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{mockTrackingData.currentLocation}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Content: Timeline + Summary (two-column) */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left: Timeline */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Tracking Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const stepKeys = [
                        "label_created",
                        "picked_up",
                        "in_transit",
                        "out_for_delivery",
                        "delivered",
                      ];
                      const stepLabels: Record<string, string> = {
                        label_created: "Label Created",
                        picked_up: "Picked Up",
                        in_transit: "In Transit",
                        out_for_delivery: "Out for Delivery",
                        delivered: "Delivered",
                      };
                      const currentIndex = Math.max(
                        0,
                        stepKeys.indexOf(mockTrackingData.status),
                      );
                      return (
                        <ol className="space-y-6">
                          {stepKeys.map((key, idx) => {
                            const event = mockTrackingData.timeline.find(
                              (e) => e.status === key,
                            );
                            const isCompleted = idx <= currentIndex;
                            const isCurrent = idx === currentIndex;
                            return (
                              <li key={key} className="flex items-start">
                                <div className="relative mr-4 flex flex-col items-center">
                                  <div
                                    className={`${
                                      isCompleted
                                        ? "bg-blue-600 text-white"
                                        : "bg-muted text-muted-foreground"
                                    } flex h-10 w-10 items-center justify-center rounded-full`}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                      <Clock className="h-5 w-5" />
                                    )}
                                  </div>
                                  {idx < stepKeys.length - 1 && (
                                    <div
                                      className={`${
                                        idx < currentIndex
                                          ? "bg-blue-600"
                                          : "bg-border"
                                      } mt-2 w-px flex-1`}
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div className="flex-1 pt-1">
                                  <h4 className="font-semibold">
                                    {stepLabels[key]}
                                    {isCurrent && (
                                      <span className="ml-2 text-xs font-medium text-blue-600">
                                        Current
                                      </span>
                                    )}
                                  </h4>
                                  {event && (
                                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                                      <MapPin className="h-4 w-4" />
                                      <span>{event.location}</span>
                                      <span>•</span>
                                      <span>{event.timestamp}</span>
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Summary */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Shipment Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Route
                        </h4>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 rounded-md border">
                            <div className="text-xs text-muted-foreground">
                              Origin
                            </div>
                            <div className="mt-1 font-medium">
                              {mockTrackingData.shipmentDetails.origin}
                            </div>
                          </div>
                          <div className="p-3 rounded-md border">
                            <div className="text-xs text-muted-foreground">
                              Destination
                            </div>
                            <div className="mt-1 font-medium">
                              {mockTrackingData.shipmentDetails.destination}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-md bg-muted/50">
                          <div className="text-xs text-muted-foreground">
                            Weight
                          </div>
                          <div className="mt-1 font-medium">
                            {mockTrackingData.shipmentDetails.weight}
                          </div>
                        </div>
                        <div className="p-3 rounded-md bg-muted/50">
                          <div className="text-xs text-muted-foreground">
                            Dimensions
                          </div>
                          <div className="mt-1 font-medium">
                            {mockTrackingData.shipmentDetails.dimensions}
                          </div>
                        </div>
                        <div className="p-3 rounded-md bg-muted/50">
                          <div className="text-xs text-muted-foreground">
                            Service
                          </div>
                          <div className="mt-1 font-medium">
                            {mockTrackingData.shipmentDetails.service}
                          </div>
                        </div>
                        <div className="p-3 rounded-md bg-muted/50">
                          <div className="text-xs text-muted-foreground">
                            ETA
                          </div>
                          <div className="mt-1 font-medium">
                            {mockTrackingData.estimatedDelivery}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* 
                <Card>
                  <CardHeader>
                    <CardTitle>Courier & Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Courier Partner</div>
                        <div className="mt-0.5 font-medium">Logistics Express</div>
                      </div>
                      <Badge variant="secondary">Standard</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="px-3">Download Label</Button>
            
                      <Button variant="outline" size="sm" className="px-3">Invoice</Button>
                    </div>
                  </CardContent>
                </Card> */}
              </div>
            </div>

            {/* Live Map */}
            <Card>
              <CardHeader>
                <CardTitle>Live Map</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md overflow-hidden border">
                  <iframe
                    title="shipment-map"
                    width="100%"
                    height="360"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(mockTrackingData.currentLocation)}&output=embed`}
                  />
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  Current location shown. For full map,
                  <a
                    className="text-blue-600 hover:underline ml-1"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mockTrackingData.currentLocation)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    open in Google Maps
                  </a>
                  .
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
