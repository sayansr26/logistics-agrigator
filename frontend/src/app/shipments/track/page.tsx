"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  MapPin,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
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

const getStatusColor = (status: string) => {
  const statusColors = {
    delivered: "bg-green-500",
    out_for_delivery: "bg-blue-500",
    in_transit: "bg-yellow-500",
    picked_up: "bg-purple-500",
    label_created: "bg-gray-500",
    exception: "bg-red-500",
  };
  return statusColors[status as keyof typeof statusColors] || "bg-gray-500";
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

export default function TrackShipmentPage() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  const handleTrack = () => {
    if (trackingNumber) {
      setIsTracking(true);
      // Here you would make an API call to fetch tracking data
    }
  };

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: "Track Shipment" },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Tracking Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              Track Your Shipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter tracking number or order ID"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTrack}>Track Shipment</Button>
            </div>
          </CardContent>
        </Card>

        {isTracking && (
          <>
            {/* Shipment Overview */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-2">Tracking Number</h3>
                    <p className="text-2xl font-bold">
                      {mockTrackingData.trackingNumber}
                    </p>
                    <Badge
                      variant={getStatusBadge(mockTrackingData.status).variant}
                      className="mt-2"
                    >
                      {getStatusBadge(mockTrackingData.status).label}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Estimated Delivery</h3>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <p>{mockTrackingData.estimatedDelivery}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <p>{mockTrackingData.currentLocation}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipment Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Tracking Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {mockTrackingData.timeline.map((event, index) => (
                    <div key={index} className="relative">
                      {index !== mockTrackingData.timeline.length - 1 && (
                        <div
                          className="absolute left-[1.625rem] top-[2.25rem] bottom-0 w-px bg-border"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex gap-6">
                        <div
                          className={`flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full ${getStatusColor(
                            event.status,
                          )}`}
                        >
                          {event.status === "delivered" ? (
                            <CheckCircle2 className="h-6 w-6 text-white" />
                          ) : event.status === "exception" ? (
                            <AlertCircle className="h-6 w-6 text-white" />
                          ) : (
                            <Clock className="h-6 w-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <h3 className="font-semibold">{event.description}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                            <span>•</span>
                            <span>{event.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Shipment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Shipment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-2">Origin</h3>
                    <p>{mockTrackingData.shipmentDetails.origin}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Destination</h3>
                    <p>{mockTrackingData.shipmentDetails.destination}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Weight</h3>
                    <p>{mockTrackingData.shipmentDetails.weight}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Dimensions</h3>
                    <p>{mockTrackingData.shipmentDetails.dimensions}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Service Type</h3>
                    <p>{mockTrackingData.shipmentDetails.service}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
