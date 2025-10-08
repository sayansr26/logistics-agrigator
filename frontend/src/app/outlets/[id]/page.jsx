"use client";

import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  mockOutlets,
  mockOutletShipments,
  getOutletStatusColor,
  getOutletTypeColor,
  getStatusColor,
  formatCurrency,
} from "@/lib/mock-data";
import {
  Store,
  MapPin,
  Phone,
  Mail,
  Clock,
  Users,
  Package,
  TrendingUp,
  Building2,
  ShoppingCart,
  Warehouse,
  Edit,
  Download,
  Share,
  Calendar,
  Globe,
  Truck,
} from "lucide-react";
import Link from "next/link";

export default function OutletDetailsPage() {
  const params = useParams();
  const outletId = params.id;

  const outlet = mockOutlets.find((o) => o.id === outletId);
  const outletShipments = mockOutletShipments.filter(
    (s) => s.outletId === outletId,
  );

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets", href: "/outlets" },
    { title: outlet?.outletName || "Outlet Details" },
  ];

  if (!outlet) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Outlet Not Found
              </h2>
              <p className="text-gray-600 mb-6">
                The outlet you&apos;re looking for doesn&apos;t exist or has
                been removed.
              </p>
              <Button asChild>
                <Link href="/outlets">Back to Outlets</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getOutletTypeIcon = (type) => {
    switch (type) {
      case "retail":
        return <Store className="h-5 w-5" />;
      case "wholesale":
        return <Warehouse className="h-5 w-5" />;
      case "ecommerce":
        return <ShoppingCart className="h-5 w-5" />;
      case "franchise":
        return <Building2 className="h-5 w-5" />;
      default:
        return <Store className="h-5 w-5" />;
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <Button variant="outline" size="sm" asChild>
              <Link href="/outlets">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Outlets
              </Link>
            </Button> */}
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
                {getOutletTypeIcon(outlet.type)}
                <span>{outlet.outletName}</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                {outlet.retailerName} • {outlet.city}, {outlet.state}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" asChild>
              <Link href={`/outlets/${outlet.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Outlet
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Store className="h-5 w-5" />
                  <span>Basic Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Outlet Code
                    </label>
                    <p className="text-sm font-semibold">{outlet.outletCode}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <div className="mt-1">
                      <Badge className={getOutletStatusColor(outlet.status)}>
                        {outlet.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Type
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      {getOutletTypeIcon(outlet.type)}
                      <Badge
                        variant="outline"
                        className={getOutletTypeColor(outlet.type)}
                      >
                        {outlet.type}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Business Hours
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{outlet.businessHours}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Contact Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Contact Person
                    </label>
                    <p className="text-sm font-semibold">
                      {outlet.contactPerson}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Phone Number
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{outlet.phone}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Email Address
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{outlet.email}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Location</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Address
                  </label>
                  <p className="text-sm mt-1">{outlet.address}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      City
                    </label>
                    <p className="text-sm font-semibold">{outlet.city}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      State
                    </label>
                    <p className="text-sm font-semibold">{outlet.state}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      PIN Code
                    </label>
                    <p className="text-sm font-semibold">{outlet.pincode}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {outlet.performance.totalShipments.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Shipments
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(outlet.performance.monthlyRevenue)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Monthly Revenue
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {outlet.performance.successRate}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Success Rate
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {outlet.performance.avgDeliveryTime} days
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg Delivery Time
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  View Shipments
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Performance Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Pickup
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Truck className="h-4 w-4 mr-2" />
                  Manage Couriers
                </Button>
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {outlet.gstNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      GST Number
                    </label>
                    <p className="text-sm font-semibold">{outlet.gstNumber}</p>
                  </div>
                )}
                {outlet.panNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      PAN Number
                    </label>
                    <p className="text-sm font-semibold">{outlet.panNumber}</p>
                  </div>
                )}
                {outlet.bankDetails && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Bank Details
                    </label>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Bank:</span>{" "}
                        {outlet.bankDetails.bankName}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Account:</span>{" "}
                        {outlet.bankDetails.accountNumber}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">IFSC:</span>{" "}
                        {outlet.bankDetails.ifscCode}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Areas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="h-5 w-5" />
                  <span>Service Areas</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {outlet.serviceAreas.map((area, index) => (
                    <Badge key={index} variant="outline">
                      {area}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Assigned Couriers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Truck className="h-5 w-5" />
                  <span>Assigned Couriers</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {outlet.assignedCouriers.map((courier, index) => (
                    <Badge key={index} variant="secondary">
                      {courier}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Shipments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Recent Shipments</span>
            </CardTitle>
            <CardDescription>Latest shipments from this outlet</CardDescription>
          </CardHeader>
          <CardContent>
            {outletShipments.length > 0 ? (
              <div className="space-y-4">
                {outletShipments.slice(0, 5).map((shipment) => (
                  <div
                    key={shipment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{shipment.trackingNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {shipment.customerName} • {shipment.destination}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getStatusColor(shipment.status)}>
                        {shipment.status.replace("_", " ")}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatCurrency(shipment.value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {shipment.weight} kg
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No shipments found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
