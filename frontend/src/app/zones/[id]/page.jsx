"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Activity,
  MapPin,
  Loader2,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Trash2,
  Globe,
  Route,
  FileText,
  Building,
} from "lucide-react";
import {
  useGetZoneByIdQuery,
  useDeleteZoneMutation,
} from "@/store/api/endpoints/zonesApi";

export default function ZoneDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const zoneId = params.id;
  const [activeTab, setActiveTab] = useState("overview");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Use RTK Query to fetch zone data
  const {
    data: zoneData,
    isLoading,
    error,
    refetch,
  } = useGetZoneByIdQuery(zoneId);

  const [deleteZone] = useDeleteZoneMutation();

  // Backend returns zone directly in data field, not data.zone
  const zone = zoneData?.data;

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Zone Management", href: "/zones" },
    { title: zone?.name || "Zone Details" },
  ];

  const handleEditZone = () => {
    router.push(`/zones/${zoneId}/edit`);
  };

  const handleBackToZones = () => {
    router.push("/zones");
  };

  const handleDeleteZone = async () => {
    setActionLoading(true);
    try {
      await deleteZone(zoneId).unwrap();
      router.push("/zones");
    } catch (error) {
      console.error("Failed to delete zone:", error);
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">Loading zone details...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Failed to Load Zone
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {error?.data?.error?.message ||
                  "An error occurred while fetching zone details"}
              </p>
              <Button
                onClick={handleBackToZones}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Zones</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!zone) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-8 text-center">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Zone Not Found
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The zone you're looking for doesn't exist or has been removed.
              </p>
              <Button
                onClick={handleBackToZones}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Zones</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusIcon = (isActive) => {
    if (isActive) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusText = (isActive) => {
    return isActive ? "Active" : "Inactive";
  };

  const getStatusColorClass = (isActive) => {
    return isActive
      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300"
      : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300";
  };

  const getZoneTypeIcon = (zoneType) => {
    return zoneType === "DISTANCE" ? (
      <Route className="h-5 w-5 text-purple-600" />
    ) : (
      <MapPin className="h-5 w-5 text-orange-600" />
    );
  };

  const getZoneTypeColor = (zoneType) => {
    return zoneType === "DISTANCE"
      ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300"
      : "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300";
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Compact Hero Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border p-6">
          <div className="flex items-start justify-between gap-6">
            {/* Left: Zone Identity */}
            <div className="flex items-start gap-4 flex-1">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                {getZoneTypeIcon(zone.zoneType)}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">
                    {zone.name}
                  </h1>
                  <Badge className={`${getStatusColorClass(zone.status)}`}>
                    {getStatusIcon(zone.status)}
                    <span className="ml-1">{getStatusText(zone.status)}</span>
                  </Badge>
                  <Badge className={`${getZoneTypeColor(zone.zoneType)}`}>
                    {getZoneTypeIcon(zone.zoneType)}
                    <span className="ml-1">{zone.zoneType}</span>
                  </Badge>
                </div>
                {zone.description && (
                  <p className="text-sm text-muted-foreground">
                    {zone.description}
                  </p>
                )}
                {/* Quick Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Created{" "}
                      {new Date(zone.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {zone.milestones && zone.milestones.length > 0 && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <div className="flex items-center gap-1">
                        <Route className="h-3 w-3" />
                        <span>{zone.milestones.length} milestones</span>
                      </div>
                    </>
                  )}
                  <Separator orientation="vertical" className="h-3" />
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    ID: {zone.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleEditZone} className="gap-2">
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Button>

              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Zone Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleEditZone}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit Zone</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Zone</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <Globe className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="milestones" className="gap-2">
              <Route className="h-4 w-4" />
              <span>Milestones</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Quick Info Cards */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Zone Status
                      </p>
                      <p className="text-2xl font-bold">
                        {getStatusText(zone.status)}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-full ${zone.status ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}
                    >
                      {getStatusIcon(zone.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Zone Type</p>
                      <p className="text-2xl font-bold">{zone.zoneType}</p>
                    </div>
                    <div
                      className={`p-3 rounded-full ${zone.zoneType === "DISTANCE" ? "bg-purple-100 dark:bg-purple-900" : "bg-orange-100 dark:bg-orange-900"}`}
                    >
                      {getZoneTypeIcon(zone.zoneType)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {zone.milestones && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Milestones
                        </p>
                        <p className="text-2xl font-bold">
                          {zone.milestones.length}
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                        <Route className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Created Date
                      </p>
                      <p className="text-2xl font-bold">
                        {new Date(zone.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900">
                      <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <span>Basic Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Zone Name
                      </span>
                      <span className="font-medium">{zone.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Zone Type
                      </span>
                      <Badge className={`${getZoneTypeColor(zone.zoneType)}`}>
                        {getZoneTypeIcon(zone.zoneType)}
                        <span className="ml-1">{zone.zoneType}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Status
                      </span>
                      <Badge className={`${getStatusColorClass(zone.status)}`}>
                        {getStatusIcon(zone.status)}
                        <span className="ml-1">
                          {getStatusText(zone.status)}
                        </span>
                      </Badge>
                    </div>
                    {zone.partnerId && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Partner ID
                        </span>
                        <span className="font-mono text-sm">
                          {zone.partnerId}
                        </span>
                      </div>
                    )}
                    {zone.description && (
                      <div className="flex flex-col gap-2 py-2">
                        <span className="text-sm text-muted-foreground">
                          Description
                        </span>
                        <span className="text-sm">{zone.description}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* System Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    <span>System Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Zone ID
                      </span>
                      <span className="font-mono text-xs">{zone.id}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Created Date
                      </span>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(zone.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">
                        Last Updated
                      </span>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(zone.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Milestones Tab */}
          <TabsContent value="milestones" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Route className="h-5 w-5" />
                      <span>Distance Milestones</span>
                    </CardTitle>
                    <CardDescription>
                      {zone.milestones?.length || 0} milestones configured for
                      this zone
                    </CardDescription>
                  </div>
                  {zone.milestones && zone.milestones.length > 0 && (
                    <Button size="sm" onClick={handleEditZone}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Milestones
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {zone.milestones && zone.milestones.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {zone.milestones.map((milestone, index) => (
                      <Card key={milestone.id} className="shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                <span className="text-purple-600 dark:text-purple-400 font-bold">
                                  {milestone.suffix}
                                </span>
                              </div>
                              Zone {milestone.suffix}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              #{milestone.sortOrder}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Distance Range
                              </span>
                              <span className="font-medium">
                                {milestone.minKm} - {milestone.maxKm} km
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Min Distance
                              </span>
                              <Badge variant="outline">
                                {milestone.minKm} km
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Max Distance
                              </span>
                              <Badge variant="outline">
                                {milestone.maxKm} km
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Route className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">
                      No milestones configured
                    </p>
                    <p className="text-sm mb-4">
                      This zone doesn't have any distance milestones yet.
                    </p>
                    <Button onClick={handleEditZone}>
                      <Edit className="mr-2 h-4 w-4" />
                      Add Milestones
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Zone Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Delete Zone
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-red-600">
                Warning: This action cannot be undone!
              </strong>
              <br />
              <br />
              Are you sure you want to permanently delete this zone? All
              associated data will be removed from the system.
              <br />
              <br />
              <strong>Zone:</strong> {zone?.name}
              <br />
              <strong>Type:</strong> {zone?.zoneType}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteZone}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
