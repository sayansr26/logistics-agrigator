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
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageContainer,
  StatsCard,
  StatsGrid,
  DetailSection,
  DetailItem,
  DetailGrid,
} from "@/components/shared";
import {
  Edit,
  MapPin,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Trash2,
  Globe,
  Route,
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

  const { data: zoneData, isLoading, error } = useGetZoneByIdQuery(zoneId);
  const [deleteZone] = useDeleteZoneMutation();

  const zone = zoneData?.data;

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

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  // Error/Not found state
  if (error || !zone) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {error ? "Failed to Load Zone" : "Zone Not Found"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {error ? "An error occurred" : "The zone doesn't exist."}
            </p>
            <Button onClick={() => router.push("/zones")} variant="outline">
              Back to Zones
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <XCircle className="h-3 w-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  const getTypeBadge = (zoneType) => {
    const isDistance = zoneType === "DISTANCE";
    return (
      <Badge
        className={
          isDistance
            ? "bg-purple-100 text-purple-800"
            : "bg-orange-100 text-orange-800"
        }
      >
        {isDistance ? (
          <Route className="h-3 w-3 mr-1" />
        ) : (
          <MapPin className="h-3 w-3 mr-1" />
        )}
        {zoneType}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                {zone.zoneType === "DISTANCE" ? (
                  <Route className="h-6 w-6 text-white" />
                ) : (
                  <MapPin className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{zone.name}</h1>
                  {getStatusBadge(zone.status)}
                  {getTypeBadge(zone.zoneType)}
                </div>
                {zone.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {zone.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => router.push(`/zones/${zoneId}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push(`/zones/${zoneId}/edit`)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Zone
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Zone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Stats */}
        <StatsGrid columns={4}>
          <StatsCard
            title="Zone Status"
            value={zone.status ? "Active" : "Inactive"}
            icon={zone.status ? CheckCircle : XCircle}
            iconColor={zone.status ? "text-green-600" : "text-red-600"}
          />
          <StatsCard
            title="Zone Type"
            value={zone.zoneType}
            icon={Route}
            iconColor="text-purple-600"
          />
          <StatsCard
            title="Milestones"
            value={zone.milestones?.length || 0}
            icon={Route}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Created"
            value={new Date(zone.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            icon={Calendar}
            iconColor="text-indigo-600"
          />
        </StatsGrid>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="overview">
              <Globe className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="milestones">
              <Route className="h-4 w-4 mr-2" />
              Milestones
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview" className="space-y-6">
              <DetailGrid columns={2}>
                <DetailSection title="Basic Information">
                  <DetailItem label="Zone Name" value={zone.name} />
                  <DetailItem
                    label="Zone Type"
                    value={getTypeBadge(zone.zoneType)}
                  />
                  <DetailItem
                    label="Status"
                    value={getStatusBadge(zone.status)}
                  />
                  {zone.partnerId && (
                    <DetailItem
                      label="Partner ID"
                      value={zone.partnerId}
                      mono
                    />
                  )}
                  {zone.description && (
                    <DetailItem label="Description" value={zone.description} />
                  )}
                </DetailSection>

                <DetailSection title="System Details">
                  <DetailItem label="Zone ID" value={zone.id} mono />
                  <DetailItem
                    label="Created Date"
                    value={new Date(zone.createdAt).toLocaleDateString()}
                  />
                  <DetailItem
                    label="Last Updated"
                    value={new Date(zone.updatedAt).toLocaleDateString()}
                  />
                </DetailSection>
              </DetailGrid>
            </TabsContent>

            <TabsContent value="milestones" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Route className="h-5 w-5" />
                        Distance Milestones
                      </CardTitle>
                      <CardDescription>
                        {zone.milestones?.length || 0} milestones configured
                      </CardDescription>
                    </div>
                    {zone.milestones?.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/zones/${zoneId}/edit`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Milestones
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {zone.milestones?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {zone.milestones.map((milestone) => (
                        <Card key={milestone.id} className="shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                  <span className="text-purple-600 font-bold">
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
                      <Button
                        onClick={() => router.push(`/zones/${zoneId}/edit`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Add Milestones
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">
                Delete Zone
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete{" "}
                <strong>{zone.name}</strong>? This action cannot be undone.
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
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </DashboardLayout>
  );
}
