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
import { Skeleton } from "@/components/ui/skeleton";
import { useGetOutletByIdQuery } from "@/store/api/endpoints/customerApi";
import {
  Store,
  MapPin,
  Phone,
  Mail,
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
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

// Helper functions
const getOutletStatusColor = (status) => {
  const statusColors = {
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    active: "bg-green-100 text-green-800 border-green-200",
    INACTIVE: "bg-gray-100 text-gray-800 border-gray-200",
    inactive: "bg-gray-100 text-gray-800 border-gray-200",
    SUSPENDED: "bg-red-100 text-red-800 border-red-200",
    suspended: "bg-red-100 text-red-800 border-red-200",
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };
  return statusColors[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getOutletTypeColor = (type) => {
  const typeColors = {
    RETAIL: "border-blue-500 text-blue-700",
    retail: "border-blue-500 text-blue-700",
    WHOLESALE: "border-purple-500 text-purple-700",
    wholesale: "border-purple-500 text-purple-700",
    FRANCHISE: "border-green-500 text-green-700",
    franchise: "border-green-500 text-green-700",
    WAREHOUSE: "border-orange-500 text-orange-700",
    warehouse: "border-orange-500 text-orange-700",
    DIRECT: "border-indigo-500 text-indigo-700",
    direct: "border-indigo-500 text-indigo-700",
  };
  return typeColors[type] || "border-gray-500 text-gray-700";
};

const getOutletTypeIcon = (type) => {
  const normalizedType = type?.toLowerCase();
  switch (normalizedType) {
    case "retail":
      return <Store className="h-5 w-5" />;
    case "wholesale":
    case "warehouse":
      return <Warehouse className="h-5 w-5" />;
    case "ecommerce":
      return <ShoppingCart className="h-5 w-5" />;
    case "franchise":
    case "direct":
      return <Building2 className="h-5 w-5" />;
    default:
      return <Store className="h-5 w-5" />;
  }
};

export default function OutletDetailsPage() {
  const params = useParams();
  const outletId = params.id;

  const { data, isLoading, error } = useGetOutletByIdQuery(outletId, {
    skip: !outletId,
  });

  // Get outlet from API response
  const outlet = data?.data?.outlet || data?.data?.customer || null;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets", href: "/outlets" },
    { title: outlet?.name || "Outlet Details" },
  ];

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Error Loading Outlet
              </h2>
              <p className="text-muted-foreground mb-6">
                {error?.data?.error?.message || "Failed to load outlet details"}
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

  // Not found state
  if (!outlet) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Outlet Not Found
              </h2>
              <p className="text-muted-foreground mb-6">
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

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
                {getOutletTypeIcon(outlet.type || outlet.outletType)}
                <span>{outlet.name || outlet.outletName}</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                {outlet.contactPerson && `${outlet.contactPerson} • `}
                {outlet.city}, {outlet.state}
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
            <Button size="sm" variant="outline" asChild>
              <Link href={`/outlets/${outlet.id}/users`}>
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Link>
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
                    <p className="text-sm font-semibold">{outlet.code || outlet.outletCode || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <div className="mt-1">
                      <Badge className={getOutletStatusColor(outlet.status || outlet.outletStatus)}>
                        {outlet.status || outlet.outletStatus || "N/A"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Type
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      {getOutletTypeIcon(outlet.type || outlet.outletType)}
                      <Badge
                        variant="outline"
                        className={getOutletTypeColor(outlet.type || outlet.outletType)}
                      >
                        {outlet.type || outlet.outletType || "N/A"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Active
                    </label>
                    <div className="mt-1">
                      <Badge variant={outlet.isActive ? "default" : "secondary"}>
                        {outlet.isActive ? "Yes" : "No"}
                      </Badge>
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
                      {outlet.contactPerson || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Phone Number
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{outlet.phone || "N/A"}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Email Address
                    </label>
                    <div className="mt-1 flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{outlet.email || "N/A"}</span>
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
                  <p className="text-sm mt-1">{outlet.address || "N/A"}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      City
                    </label>
                    <p className="text-sm font-semibold">{outlet.city || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      State
                    </label>
                    <p className="text-sm font-semibold">{outlet.state || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      PIN Code
                    </label>
                    <p className="text-sm font-semibold">{outlet.pincode || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Country
                    </label>
                    <p className="text-sm font-semibold">{outlet.country || "India"}</p>
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
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/outlets/${outlet.id}/users`}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/outlets/${outlet.id}/customers`}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Manage Customers
                  </Link>
                </Button>
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
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    GST Number
                  </label>
                  <p className="text-sm font-semibold">{outlet.gstNumber || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    PAN Number
                  </label>
                  <p className="text-sm font-semibold">{outlet.panNumber || "N/A"}</p>
                </div>
                {outlet.bankDetails && Object.keys(outlet.bankDetails).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Bank Details
                    </label>
                    <div className="mt-1 space-y-1">
                      {outlet.bankDetails.bankName && (
                        <p className="text-sm">
                          <span className="font-medium">Bank:</span>{" "}
                          {outlet.bankDetails.bankName}
                        </p>
                      )}
                      {outlet.bankDetails.accountNumber && (
                        <p className="text-sm">
                          <span className="font-medium">Account:</span>{" "}
                          {outlet.bankDetails.accountNumber}
                        </p>
                      )}
                      {outlet.bankDetails.ifscCode && (
                        <p className="text-sm">
                          <span className="font-medium">IFSC:</span>{" "}
                          {outlet.bankDetails.ifscCode}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle>Timestamps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>
                  <p className="text-sm font-semibold">
                    {outlet.createdAt ? new Date(outlet.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </label>
                  <p className="text-sm font-semibold">
                    {outlet.updatedAt ? new Date(outlet.updatedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
