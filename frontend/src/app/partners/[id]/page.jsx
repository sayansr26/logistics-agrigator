"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Star,
  MapPin,
  Clock,
  DollarSign,
  Phone,
  Mail,
  Globe,
  Package,
  TrendingUp,
  Users,
  Calendar,
  Edit,
  ExternalLink,
  Truck,
  Award,
  Activity,
  Loader2,
  AlertCircle,
  Power,
  PowerOff,
} from "lucide-react";
import { usePartner } from "@/hooks/usePartner";
import { partnersApiService } from "@/services";

export default function PartnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id;
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Use the custom hook to fetch partner data
  const { partner, isLoading, error, refetch } = usePartner(partnerId);

  const handleEdit = () => {
    router.push(`/partners/${partnerId}/edit`);
  };

  const handleDeactivate = async () => {
    if (!partner) return;

    setIsDeactivating(true);
    try {
      await partnersApiService.deactivatePartner(partnerId);
      await refetch(); // Refresh the data
    } catch (error) {
      console.error("Error deactivating partner:", error);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleActivate = async () => {
    if (!partner) return;

    setIsActivating(true);
    try {
      await partnersApiService.activatePartner(partnerId);
      await refetch(); // Refresh the data
    } catch (error) {
      console.error("Error activating partner:", error);
    } finally {
      setIsActivating(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return <div className="w-3 h-3 bg-green-500 rounded-full"></div>;
      case "inactive":
        return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
      case "suspended":
        return <div className="w-3 h-3 bg-red-500 rounded-full"></div>;
      case "pending":
        return <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>;
      default:
        return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "courier":
        return <Truck className="h-4 w-4 text-blue-600" />;
      case "logistics":
        return <Package className="h-4 w-4 text-green-600" />;
      case "warehouse":
        return <Award className="h-4 w-4 text-purple-600" />;
      case "customs":
        return <Activity className="h-4 w-4 text-orange-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading partner details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error Loading Partner
            </h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={refetch} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!partner) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Partner Not Found
            </h3>
            <p className="text-gray-500">
              The partner you're looking for doesn't exist.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {partner.displayName}
              </h1>
              <p className="text-muted-foreground">
                Partner details and performance metrics
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {partner.isActive ? (
              <Button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                {isDeactivating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4 mr-2" />
                )}
                Deactivate
              </Button>
            ) : (
              <Button
                onClick={handleActivate}
                disabled={isActivating}
                variant="outline"
                className="border-green-200 text-green-600 hover:bg-green-50"
              >
                {isActivating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Power className="h-4 w-4 mr-2" />
                )}
                Activate
              </Button>
            )}
            <Button
              onClick={handleEdit}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Partner
            </Button>
          </div>
        </div>

        {/* Partner Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20 ring-4 ring-gray-100">
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 text-2xl font-bold">
                    {partner.displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-foreground">
                      {partner.displayName}
                    </h2>
                    <Badge
                      className={`${partner.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"} text-sm`}
                    >
                      {partner.isActive ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      ) : (
                        <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                      )}
                      <span className="capitalize">
                        {partner.isActive ? "Active" : "Inactive"}
                      </span>
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      <Truck className="h-3 w-3 mr-2" />
                      <span className="font-mono">{partner.code}</span>
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {partner.servicePincodes?.length || 0} pincodes
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4" />
                      <span>{partner.supportsCOD ? "COD" : "No COD"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Since {new Date(partner.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-2">
                  Partner Statistics
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-blue-600">
                    {partner._count?.shipments || 0} shipments
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {partner._count?.rates || 0} rate entries
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Performance Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Performance Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {partner._count?.shipments || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total Shipments
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {partner._count?.rates || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Rate Entries
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {partner.servicePincodes?.length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Service Areas
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600 mb-2">
                      {partner.maxWeight ? `${partner.maxWeight}kg` : "∞"}
                    </div>
                    <p className="text-sm text-muted-foreground">Max Weight</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span>Service Capabilities</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">COD Support</span>
                      <Badge
                        className={
                          partner.supportsCOD
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-800 border-gray-200"
                        }
                      >
                        {partner.supportsCOD ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Reverse Logistics
                      </span>
                      <Badge
                        className={
                          partner.supportsReverse
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-800 border-gray-200"
                        }
                      >
                        {partner.supportsReverse ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Max Weight</span>
                      <span className="text-sm text-muted-foreground">
                        {partner.maxWeight
                          ? `${partner.maxWeight}kg`
                          : "No limit"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">API Version</span>
                      <span className="text-sm text-muted-foreground">
                        {partner.apiVersion || "Not specified"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Service Areas</span>
                      <span className="text-sm text-muted-foreground">
                        {partner.servicePincodes?.length || 0} pincodes
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge
                        className={
                          partner.isActive
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-800 border-gray-200"
                        }
                      >
                        {partner.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coverage & Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <span>Coverage & Services</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Service Pincodes</h4>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {partner.servicePincodes &&
                    partner.servicePincodes.length > 0 ? (
                      partner.servicePincodes.map((pincode) => (
                        <Badge
                          key={pincode}
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {pincode}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground">
                        No service pincodes configured
                      </p>
                    )}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3">Service Features</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={
                        partner.supportsCOD
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }
                    >
                      COD Support
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        partner.supportsReverse
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }
                    >
                      Reverse Logistics
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      API Integration
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Structure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <span>Pricing Structure</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {partner.baseRate ? `₹${partner.baseRate}` : "N/A"}
                    </div>
                    <p className="text-sm text-muted-foreground">Base Rate</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {partner.perKgRate ? `₹${partner.perKgRate}` : "N/A"}
                    </div>
                    <p className="text-sm text-muted-foreground">Per KG Rate</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                      {partner.fuelSurcharge
                        ? `${partner.fuelSurcharge}%`
                        : "N/A"}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fuel Surcharge
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Additional Charges</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="font-semibold text-gray-900">
                        COD Charge
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {partner.codChargePercent
                          ? `${partner.codChargePercent}%`
                          : "Not configured"}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="font-semibold text-gray-900">
                        Max Dimensions
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {partner.maxDimensions
                          ? `${partner.maxDimensions.length}×${partner.maxDimensions.width}×${partner.maxDimensions.height} cm`
                          : "No limit"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Contact & Contract Info */}
          <div className="space-y-6">
            {/* API Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-purple-600" />
                  <span>API Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Globe className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium break-all">{partner.apiUrl}</p>
                    <p className="text-sm text-muted-foreground">API URL</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {partner.apiVersion || "Not specified"}
                    </p>
                    <p className="text-sm text-muted-foreground">API Version</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {partner.apiToken ? "Configured" : "Not configured"}
                    </p>
                    <p className="text-sm text-muted-foreground">API Token</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Partner Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <span>Partner Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Partner Code</p>
                  <p className="font-medium font-mono">{partner.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Display Name</p>
                  <p className="font-medium">{partner.displayName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(partner.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {new Date(partner.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push(`/partners/${partnerId}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Partner
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/partners")}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Back to Partners
                </Button>
                {partner.isActive ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start border-red-200 text-red-600 hover:bg-red-50"
                    onClick={handleDeactivate}
                    disabled={isDeactivating}
                  >
                    {isDeactivating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PowerOff className="h-4 w-4 mr-2" />
                    )}
                    Deactivate Partner
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start border-green-200 text-green-600 hover:bg-green-50"
                    onClick={handleActivate}
                    disabled={isActivating}
                  >
                    {isActivating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Power className="h-4 w-4 mr-2" />
                    )}
                    Activate Partner
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
