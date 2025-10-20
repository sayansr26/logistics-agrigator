"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreVertical,
  Info,
  Settings,
  BarChart,
  Shield,
  Building,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  useGetPartnerByIdQuery,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
} from "@/store/api/endpoints/partnersApi";
import { usePermission } from "@/hooks/usePermission";
import { formatDate } from "@/lib/mock-data";

interface PartnerDetailPageProps {
  params: {
    id: string;
  };
}

export default function PartnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;
  const [activeTab, setActiveTab] = useState("overview");
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Permission checks
  const { hasPermission } = usePermission();
  const canEdit = hasPermission("partner", "update", "all");
  const canDelete = hasPermission("partner", "delete", "all");
  const canManage = hasPermission("partner", "manage", "all");

  // RTK Query hooks
  const {
    data: partnerData,
    isLoading,
    error,
    refetch,
  } = useGetPartnerByIdQuery(partnerId);

  const [updatePartner, { isLoading: isUpdating }] = useUpdatePartnerMutation();
  const [deletePartner, { isLoading: isDeleting }] = useDeletePartnerMutation();

  const partner = partnerData?.data?.partner;

  const handleEdit = () => {
    router.push(`/partners/${partnerId}/edit`);
  };

  const handleDeactivate = async () => {
    try {
      await updatePartner({
        id: partnerId,
        data: { isActive: false },
      }).unwrap();
      setShowDeactivateDialog(false);
      refetch();
    } catch (error) {
      console.error("Error deactivating partner:", error);
    }
  };

  const handleActivate = async () => {
    try {
      await updatePartner({
        id: partnerId,
        data: { isActive: true },
      }).unwrap();
      setShowActivateDialog(false);
      refetch();
    } catch (error) {
      console.error("Error activating partner:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePartner(partnerId).unwrap();
      setShowDeleteDialog(false);
      router.push("/partners?success=partner-deleted");
    } catch (error) {
      console.error("Error deleting partner:", error);
    }
  };

  // Statistics calculations - only partner-specific stats
  const stats = [
    {
      title: "Total Shipments",
      value: partner?._count?.shipments || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Min Weight",
      value: partner?.minWeight ? `${partner.minWeight}kg` : "Not set",
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Max Weight",
      value: partner?.maxWeight ? `${partner.maxWeight}kg` : "No limit",
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "API Status",
      value: partner?.apiToken ? "Connected" : "Not Connected",
      icon: Globe,
      color: partner?.apiToken ? "text-green-600" : "text-orange-600",
      bgColor: partner?.apiToken ? "bg-green-50" : "bg-orange-50",
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !partner) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {error ? "Error Loading Partner" : "Partner Not Found"}
                </h3>
                <p className="text-gray-500">
                  {error
                    ? "Failed to load partner details"
                    : "The partner you're looking for doesn't exist."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {partner.displayName}
            </h1>
            <p className="text-gray-500 mt-1">
              Partner details and configuration
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                {partner.isActive ? (
                  <Button
                    onClick={() => setShowDeactivateDialog(true)}
                    disabled={isUpdating}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowActivateDialog(true)}
                    disabled={isUpdating}
                    variant="outline"
                    className="border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <Power className="h-4 w-4 mr-2" />
                    Activate
                  </Button>
                )}
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canEdit && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Partner
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Delete Partner
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Hero Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-2xl font-bold">
                    {partner.displayName
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold">
                      {partner.displayName}
                    </h2>
                    <Badge variant={partner.isActive ? "default" : "secondary"}>
                      {partner.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                    <Badge variant="outline">
                      <Truck className="h-3 w-3 mr-1" />
                      {partner.code}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Building className="h-4 w-4 mr-1" />
                      {partner.name}
                    </span>
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Since {new Date(partner.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {partner.supportsCOD && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    COD Enabled
                  </Badge>
                )}
                {partner.supportsReverse && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    Reverse Pickup
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-xl">
            <TabsTrigger value="overview">
              <Info className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="api">
              <Settings className="h-4 w-4 mr-2" />
              API Config
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Partner Name</p>
                      <p className="font-medium">{partner.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Display Name</p>
                      <p className="font-medium">{partner.displayName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Partner Code</p>
                      <p className="font-medium font-mono">{partner.code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <Badge
                        variant={partner.isActive ? "default" : "secondary"}
                      >
                        {partner.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Created On</p>
                      <p className="font-medium">
                        {formatDate(partner.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Updated</p>
                      <p className="font-medium">
                        {formatDate(partner.updatedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Shipments</p>
                      <p className="font-medium">
                        {partner._count?.shipments || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Integration Status
                      </p>
                      <Badge
                        variant={partner.apiToken ? "default" : "secondary"}
                      >
                        {partner.apiToken ? "Connected" : "Not Connected"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>API Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">API Endpoint</p>
                    <p className="font-medium font-mono break-all">
                      {partner.apiUrl || "Not configured"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">API Version</p>
                    <p className="font-medium">
                      {partner.apiVersion || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">API Token</p>
                    <p className="font-medium">
                      {partner.apiToken ? "••••••••••••••••" : "Not configured"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      Authentication Status
                    </p>
                    <Badge variant={partner.apiToken ? "default" : "secondary"}>
                      {partner.apiToken ? "Configured" : "Not Configured"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Deactivate Dialog */}
        <AlertDialog
          open={showDeactivateDialog}
          onOpenChange={setShowDeactivateDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate Partner?</AlertDialogTitle>
              <AlertDialogDescription>
                This will temporarily disable the partner. Active shipments will
                continue to be processed, but new shipments cannot be created
                with this partner.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeactivate}
                disabled={isUpdating}
                className="bg-red-600 hover:bg-red-700"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Deactivate"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Activate Dialog */}
        <AlertDialog
          open={showActivateDialog}
          onOpenChange={setShowActivateDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Activate Partner?</AlertDialogTitle>
              <AlertDialogDescription>
                This will enable the partner for creating new shipments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleActivate} disabled={isUpdating}>
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Activate"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Partner?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                partner and all associated data including rate configurations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete Partner"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
