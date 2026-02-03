"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
  PageContainer,
  DetailHeader,
  DetailSection,
  DetailItem,
  DetailGrid,
  StatsCard,
  StatsGrid,
} from "@/components/shared";
import {
  MapPin,
  DollarSign,
  Globe,
  Package,
  Truck,
  Calendar,
  Edit,
  Loader2,
  AlertCircle,
  Power,
  PowerOff,
  MoreVertical,
  Info,
  Settings,
  Building,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  useGetPartnerByIdQuery,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
} from "@/store/api/endpoints/partnersApi";
import { usePermission } from "@/hooks/usePermission";
import { formatDate } from "@/lib/mock-data";

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

  const handleDeactivate = async () => {
    try {
      await updatePartner({
        partnerId,
        partnerData: { isActive: false },
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
        partnerId,
        partnerData: { isActive: true },
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

  // Error state
  if (error || !partner) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {error ? "Error Loading Partner" : "Partner Not Found"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {error
                ? "Failed to load partner details"
                : "The partner doesn't exist."}
            </p>
            <Button onClick={() => router.push("/partners")} variant="outline">
              Back to Partners
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Header */}
        <DetailHeader
          title={partner.displayName}
          description="Partner details and configuration"
          backHref="/partners"
          badges={[
            partner.isActive ? (
              <Badge key="status" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge key="status" variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Inactive
              </Badge>
            ),
            <Badge key="code" variant="outline">
              <Truck className="h-3 w-3 mr-1" />
              {partner.code}
            </Badge>,
          ]}
          actions={
            <div className="flex items-center gap-2">
              {canManage && partner.isActive ? (
                <Button
                  onClick={() => setShowDeactivateDialog(true)}
                  disabled={isUpdating}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              ) : canManage && !partner.isActive ? (
                <Button
                  onClick={() => setShowActivateDialog(true)}
                  disabled={isUpdating}
                  variant="outline"
                  className="border-green-200 text-green-600 hover:bg-green-50"
                >
                  <Power className="h-4 w-4 mr-2" />
                  Activate
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/partners/${partnerId}/pincodes`)
                    }
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Assign Pincodes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/partners/${partnerId}/charges`)
                    }
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Charges Types
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={() => router.push(`/partners/${partnerId}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Partner
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Partner
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        {/* Stats */}
        <StatsGrid columns={4}>
          <StatsCard
            title="Assigned Pincodes"
            value={partner._count?.pincodeAssigns || 0}
            icon={MapPin}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Charges Types"
            value={partner._count?.chargesTypes || 0}
            icon={DollarSign}
            iconColor="text-green-600"
          />
          <StatsCard
            title="Channel Configs"
            value={partner._count?.channelConfigs || 0}
            icon={Globe}
            iconColor="text-purple-600"
          />
          <StatsCard
            title="Total Shipments"
            value={partner._count?.shipments || 0}
            icon={Package}
            iconColor="text-orange-600"
          />
        </StatsGrid>

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
            <TabsContent value="overview" className="space-y-6">
              <DetailGrid columns={2}>
                <DetailSection title="Basic Information">
                  <DetailItem label="Partner Name" value={partner.name} />
                  <DetailItem
                    label="Display Name"
                    value={partner.displayName}
                  />
                  <DetailItem label="Partner Code" value={partner.code} mono />
                  <DetailItem
                    label="Status"
                    value={
                      <Badge
                        variant={partner.isActive ? "default" : "secondary"}
                      >
                        {partner.isActive ? "Active" : "Inactive"}
                      </Badge>
                    }
                  />
                </DetailSection>

                <DetailSection title="Timeline">
                  <DetailItem
                    label="Created On"
                    value={formatDate(partner.createdAt)}
                  />
                  <DetailItem
                    label="Last Updated"
                    value={formatDate(partner.updatedAt)}
                  />
                  <DetailItem
                    label="Total Shipments"
                    value={partner._count?.shipments || 0}
                  />
                  <DetailItem
                    label="Integration Status"
                    value={
                      <Badge
                        variant={partner.apiToken ? "default" : "secondary"}
                      >
                        {partner.apiToken ? "Connected" : "Not Connected"}
                      </Badge>
                    }
                  />
                </DetailSection>

                <DetailSection title="Channel Configuration">
                  <DetailItem
                    label="Channel Mode"
                    value={
                      <Badge variant="outline">
                        {partner.channelMode || "SINGLE"}
                      </Badge>
                    }
                  />
                  <DetailItem
                    label="Channel Configs"
                    value={`${partner._count?.channelConfigs || 0} configured`}
                  />
                  <DetailItem
                    label="Charges Types"
                    value={`${partner._count?.chargesTypes || 0} types`}
                  />
                </DetailSection>
              </DetailGrid>
            </TabsContent>

            <TabsContent value="api" className="space-y-6">
              <DetailSection title="API Configuration">
                <DetailItem
                  label="Channel Mode"
                  value={
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {partner.channelMode || "SINGLE"}
                      </Badge>
                      {partner.channelMode === "MULTI" && (
                        <span className="text-sm text-muted-foreground">
                          ({partner._count?.channelConfigs || 0} channels)
                        </span>
                      )}
                    </div>
                  }
                />
                <Separator />
                <DetailItem
                  label="API Endpoint"
                  value={partner.apiUrl || "Not configured"}
                  mono
                />
                <DetailItem
                  label="API Version"
                  value={partner.apiVersion || "Not specified"}
                />
                <DetailItem
                  label="API Token"
                  value={
                    partner.apiToken ? "••••••••••••••••" : "Not configured"
                  }
                />
                <DetailItem
                  label="Authentication Status"
                  value={
                    <Badge variant={partner.apiToken ? "default" : "secondary"}>
                      {partner.apiToken ? "Configured" : "Not Configured"}
                    </Badge>
                  }
                />
              </DetailSection>
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
                This will disable the partner. New shipments cannot be created
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
                This will permanently delete the partner and all associated
                data.
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
      </PageContainer>
    </DashboardLayout>
  );
}
