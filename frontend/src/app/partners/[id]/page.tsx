"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Edit,
  Loader2,
  AlertCircle,
  Power,
  PowerOff,
  MoreVertical,
  Info,
  Settings,
  CheckCircle,
  XCircle,
  Trash2,
  Key,
} from "lucide-react";
import {
  useGetPartnerByIdQuery,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
} from "@/store/api/endpoints/partnersApi";
import { useListPartnerChannelsQuery } from "@/store/api/endpoints/partnerChannelApi";
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    displayName: "",
    code: "",
    isActive: true,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

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
  } = useGetPartnerByIdQuery(partnerId);
  const [updatePartner, { isLoading: isUpdating }] = useUpdatePartnerMutation();
  const [deletePartner, { isLoading: isDeleting }] = useDeletePartnerMutation();
  const { data: channelsData } = useListPartnerChannelsQuery(partnerId, {
    skip: !partnerId,
  });

  const partner = partnerData?.data?.partner;
  const channels = channelsData?.data?.channels || [];

  const handleDeactivate = async () => {
    try {
      await updatePartner({
        partnerId,
        partnerData: { isActive: false },
      }).unwrap();
      setShowDeactivateDialog(false);
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

  const openEditModal = () => {
    if (!partner) return;
    setEditForm({
      name: partner.name,
      displayName: partner.displayName || "",
      code: partner.code,
      isActive: partner.isActive,
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!editForm.name.trim()) errors.name = "Partner name is required";
    if (!editForm.displayName.trim())
      errors.displayName = "Display name is required";
    if (!editForm.code.trim()) errors.code = "Partner code is required";
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await updatePartner({
        partnerId,
        partnerData: {
          name: editForm.name,
          displayName: editForm.displayName,
          code: editForm.code,
          isActive: editForm.isActive,
        },
      }).unwrap();
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating partner:", error);
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
          canEdit={false}
          canDelete={false}
          actions={
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button onClick={openEditModal} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Manage</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/partners/${partnerId}/channels`)
                    }
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Manage Channels
                  </DropdownMenuItem>
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
                  {canManage && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          partner.isActive
                            ? setShowDeactivateDialog(true)
                            : setShowActivateDialog(true)
                        }
                        disabled={isUpdating}
                      >
                        {partner.isActive ? (
                          <>
                            <PowerOff className="h-4 w-4 mr-2" />
                            Deactivate Partner
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4 mr-2" />
                            Activate Partner
                          </>
                        )}
                      </DropdownMenuItem>
                    </>
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
            <TabsTrigger value="channels">
              <Globe className="h-4 w-4 mr-2" />
              Channels
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
                </DetailSection>
              </DetailGrid>
            </TabsContent>

            <TabsContent value="channels" className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {channels.length === 0
                    ? "No channels configured yet."
                    : `${channels.length} channel${channels.length > 1 ? "s" : ""} configured`}
                </p>
                <Button
                  onClick={() => router.push(`/partners/${partnerId}/channels`)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Channels
                </Button>
              </div>

              {channels.length > 0 && (
                <div className="space-y-3">
                  {channels.map((channel: any, index: number) => (
                    <Card key={channel.id || index}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {channel.channelName}
                            </span>
                            {channel.isPrimary && (
                              <Badge variant="default" className="text-xs">
                                Primary
                              </Badge>
                            )}
                            <Badge
                              variant={
                                channel.isActive ? "default" : "secondary"
                              }
                              className="text-xs"
                            >
                              {channel.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              channel.aggregatorType === "DELHIVERY"
                                ? "border-blue-300 text-blue-700 bg-blue-50"
                                : channel.aggregatorType === "BLUEDART"
                                  ? "border-indigo-300 text-indigo-700 bg-indigo-50"
                                  : "border-gray-300 text-gray-700"
                            }
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            {channel.aggregatorType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Key className="h-3 w-3" />
                            {channel.aggregatorType === "DELHIVERY" && (
                              <span>
                                {channel.apiKey
                                  ? "API Token configured"
                                  : "API Token not set"}
                              </span>
                            )}
                            {channel.aggregatorType === "BLUEDART" && (
                              <span>
                                {channel.aggregatorConfig?.loginId
                                  ? `Login: ${channel.aggregatorConfig.loginId}`
                                  : "Credentials not set"}
                              </span>
                            )}
                            {channel.aggregatorType !== "DELHIVERY" &&
                              channel.aggregatorType !== "BLUEDART" && (
                                <span>
                                  {channel.apiKey
                                    ? "API Key configured"
                                    : "No credentials"}
                                </span>
                              )}
                          </div>
                          {channel.aggregatorType === "BLUEDART" &&
                            channel.aggregatorConfig?.customerCode && (
                              <span className="text-sm text-muted-foreground">
                                Customer:{" "}
                                {channel.aggregatorConfig.customerCode}
                              </span>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Priority: {channel.priority}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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

        {/* Edit Partner Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Partner</DialogTitle>
              <DialogDescription>
                Update partner basic information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Partner Name *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., FedEx India"
                  className={editErrors.name ? "border-red-500" : ""}
                />
                {editErrors.name && (
                  <p className="text-sm text-red-500">{editErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-displayName">Display Name *</Label>
                <Input
                  id="edit-displayName"
                  value={editForm.displayName}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  placeholder="e.g., FedEx Express"
                  className={editErrors.displayName ? "border-red-500" : ""}
                />
                {editErrors.displayName && (
                  <p className="text-sm text-red-500">
                    {editErrors.displayName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-code">Partner Code *</Label>
                <Input
                  id="edit-code"
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g., FDX001"
                  className={editErrors.code ? "border-red-500" : ""}
                />
                {editErrors.code && (
                  <p className="text-sm text-red-500">{editErrors.code}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-active"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({
                      ...prev,
                      isActive: checked as boolean,
                    }))
                  }
                />
                <Label htmlFor="edit-active" className="text-sm font-normal">
                  Active (Partner can be used for shipments)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={isUpdating}>
                {isUpdating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Partner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}
