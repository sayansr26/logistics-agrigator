"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  mockShipments,
  mockNDRs,
  getStatusColor,
  getPaymentModeColor,
  getNDRStatusColor,
  formatCurrency,
  type Shipment,
} from "@/lib/mock-data";
import {
  Package,
  Truck,
  AlertTriangle,
  Upload,
  Plus,
  ArrowLeft,
  Calendar as CalendarIcon,
  MapPin,
  IndianRupee,
  Clock,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = (params?.id as string) || "";

  const shipment: Shipment | undefined = mockShipments.find(
    (s) => s.id === idParam,
  );

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: shipment ? shipment.trackingNumber : "Not found" },
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

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* <Button variant="outline" size="icon" onClick={() => router.push("/shipments")}>
              <ArrowLeft className="h-4 w-4" />
            </Button> */}
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Package className="h-8 w-8 text-logistics-600" />
                <span>Shipment Details</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                View detailed information about this shipment
              </p>
            </div>
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

        {/* Top Summary */}
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
                <div className="px-3 py-2 rounded-md border flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {shipment.origin} → {shipment.destination}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-md border flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Manifest: {shipment.manifestDate} {shipment.manifestTime}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-md border flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  <Badge className={getPaymentModeColor(shipment.paymentMode)}>
                    {shipment.paymentMode.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Tracking Progress</CardTitle>
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
                  const statusToIndex: Record<string, number> = {
                    pending: 0,
                    delayed: 2,
                    in_transit: 2,
                    delivered: 4,
                    cancelled: 0,
                  };
                  const currentIndex = statusToIndex[shipment.status] ?? 0;
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
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Route & Parties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-md border">
                    <div className="text-xs text-muted-foreground">Origin</div>
                    <div className="mt-1 font-medium">
                      {shipment.origin}, {shipment.originState} (
                      {shipment.originPinCode})
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Sender: {shipment.senderName}
                    </div>
                  </div>
                  <div className="p-4 rounded-md border">
                    <div className="text-xs text-muted-foreground">
                      Destination
                    </div>
                    <div className="mt-1 font-medium">
                      {shipment.destination}, {shipment.destinationState} (
                      {shipment.destinationPinCode})
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Receiver: {shipment.receiverName}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 rounded-md bg-muted/50">
                    <div className="text-xs text-muted-foreground">Weight</div>
                    <div className="mt-1 font-medium">{shipment.weight} kg</div>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <div className="text-xs text-muted-foreground">
                      Declared Value
                    </div>
                    <div className="mt-1 font-medium">
                      {formatCurrency(shipment.value)}
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <div className="text-xs text-muted-foreground">
                      Priority
                    </div>
                    <div className="mt-1 font-medium capitalize">
                      {shipment.priority}
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <div className="text-xs text-muted-foreground">Courier</div>
                    <div className="mt-1 font-medium">
                      {shipment.courierPartner}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Charges Summary</CardTitle>
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
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Component</TableHead>
                            <TableHead className="text-right">
                              Amount (INR)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>Base Freight</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(base)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Fuel Surcharge</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(fuelSurcharge)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Handling</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(handling)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>GST (18%)</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(gst)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-semibold">
                              Total
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(total)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <div className="text-xs text-muted-foreground">
                        Note: Charges are indicative for demo purposes.
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground">Created</div>
                  <div className="font-medium">
                    {new Date(shipment.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground">
                    Estimated Delivery
                  </div>
                  <div className="font-medium">
                    {new Date(shipment.estimatedDelivery).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground">Manifest</div>
                  <div className="font-medium">
                    {shipment.manifestDate} {shipment.manifestTime}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  Download Label
                </Button>
                <Button variant="outline" size="sm">
                  Generate Challan
                </Button>
                <Button variant="outline" size="sm">
                  Print Invoice
                </Button>
                <Button variant="outline" size="sm">
                  Schedule Pickup
                </Button>
                <Button variant="outline" size="sm">
                  Cancel Shipment
                </Button>
              </CardContent>
            </Card>
            {(() => {
              const ndr = mockNDRs.find(
                (n) => n.trackingNumber === shipment.trackingNumber,
              );
              if (!ndr) return null;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>NDR Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground">Status</div>
                      <Badge className={getNDRStatusColor(ndr.status)}>
                        {ndr.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground">Last Attempt</div>
                      <div className="font-medium">
                        {ndr.attemptDate} {ndr.attemptTime}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Reason</div>
                      <div className="font-medium">{ndr.reason}</div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/shipments/ndr">Manage NDR</Link>
                      </Button>
                      <Button size="sm" variant="outline">
                        Reattempt Delivery
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
            <Card>
              <CardHeader>
                <CardTitle>Customer Notifications</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  Send SMS
                </Button>
                <Button variant="outline" size="sm">
                  Send Email
                </Button>
                <Button variant="outline" size="sm">
                  Send WhatsApp
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder="Add a note for your team (not visible to customer)" />
                <div className="text-xs text-muted-foreground">
                  Notes are saved automatically in production.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
