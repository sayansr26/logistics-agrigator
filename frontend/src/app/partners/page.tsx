"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PageHeader,
  PageContainer,
  StatsCard,
  StatsGrid,
  DataTablePagination,
} from "@/components/shared";
import {
  Truck,
  Package,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Plus,
  Power,
  PowerOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  MapPin,
  IndianRupee,
  Settings,
} from "lucide-react";

// RTK Query hooks
import {
  useGetPartnersQuery,
  useDeletePartnerMutation,
  useUpdatePartnerStatusMutation,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  type Partner,
} from "@/store/api/endpoints/partnersApi";

// Permission hooks
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";

export default function PartnersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { hasPermission, canAccessResource } = usePermission();

  // Permission checks
  const canCreatePartner = canAccessResource("partner", "create", "all");
  const canEditPartner = canAccessResource("partner", "update", "all");
  const canDeletePartner = canAccessResource("partner", "delete", "all");
  const canManagePartner = canAccessResource("partner", "manage", "all");

  // State for filters and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "activate" | "deactivate" | null
  >(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  // Create/Edit modal state
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    displayName: "",
    code: "",
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // RTK Query
  const {
    data: partnersData,
    isLoading,
    error,
    refetch,
  } = useGetPartnersQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm || undefined,
    isActive: statusFilter === "all" ? undefined : statusFilter === "active",
    sortBy,
    sortOrder,
  });

  // Mutations
  const [deletePartner, { isLoading: isDeleting }] = useDeletePartnerMutation();
  const [updatePartnerStatus, { isLoading: isUpdatingStatus }] =
    useUpdatePartnerStatusMutation();
  const [updatePartner, { isLoading: isUpdatingPartner }] =
    useUpdatePartnerMutation();
  const [createPartner, { isLoading: isCreating }] = useCreatePartnerMutation();

  // Calculate statistics
  const partners = partnersData?.data?.partners || [];
  const pagination = partnersData?.data?.pagination;
  const totalPartners = pagination?.total || 0;
  const activeCount = partners.filter((p) => p.isActive).length;
  const inactiveCount = partners.filter((p) => !p.isActive).length;

  // Handle success messages from redirects
  useEffect(() => {
    const success = searchParams.get("success");
    if (success) {
      const messages: Record<string, string> = {
        "partner-created": "Partner created successfully!",
        "partner-updated": "Partner updated successfully!",
        "partner-deleted": "Partner deleted successfully!",
        "partner-activated": "Partner activated successfully!",
        "partner-deactivated": "Partner deactivated successfully!",
      };
      if (messages[success]) {
        setSuccessMessage(messages[success]);
        setShowSuccessMessage(true);
        router.replace("/partners", { scroll: false });
        setTimeout(() => setShowSuccessMessage(false), 5000);
        refetch();
      }
    }
  }, [searchParams, router, refetch]);

  // Handle confirmation actions
  const handleConfirmAction = async () => {
    if (!selectedPartner || !confirmAction) return;

    try {
      if (confirmAction === "delete") {
        await deletePartner(selectedPartner.id).unwrap();
        router.push("/partners?success=partner-deleted");
      } else if (confirmAction === "activate") {
        await updatePartnerStatus({
          partnerId: selectedPartner.id,
          isActive: true,
        }).unwrap();
        router.push("/partners?success=partner-activated");
      } else if (confirmAction === "deactivate") {
        await updatePartnerStatus({
          partnerId: selectedPartner.id,
          isActive: false,
        }).unwrap();
        router.push("/partners?success=partner-deactivated");
      }
    } catch (error) {
      console.error("Failed to perform action:", error);
    } finally {
      setShowConfirmDialog(false);
      setConfirmAction(null);
      setSelectedPartner(null);
    }
  };

  // Generate partner code from name
  const generatePartnerCode = (name: string) => {
    if (name) {
      const prefix = name.substring(0, 3).toUpperCase();
      const suffix = Math.floor(100 + Math.random() * 900);
      return `${prefix}${suffix}`;
    }
    return "";
  };

  // Open create modal
  const openCreateModal = () => {
    setEditingPartner(null);
    setPartnerForm({ name: "", displayName: "", code: "", isActive: true });
    setFormErrors({});
    setShowPartnerModal(true);
  };

  // Open edit modal
  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setPartnerForm({
      name: partner.name,
      displayName: partner.displayName || "",
      code: partner.code,
      isActive: partner.isActive,
    });
    setFormErrors({});
    setShowPartnerModal(true);
  };

  // Validate and submit partner form
  const handlePartnerSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!partnerForm.name.trim()) errors.name = "Partner name is required";
    if (!partnerForm.displayName.trim())
      errors.displayName = "Display name is required";
    if (!partnerForm.code.trim()) errors.code = "Partner code is required";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (editingPartner) {
        await updatePartner({
          partnerId: editingPartner.id,
          partnerData: {
            name: partnerForm.name,
            displayName: partnerForm.displayName,
            code: partnerForm.code,
            isActive: partnerForm.isActive,
          },
        }).unwrap();
        setSuccessMessage("Partner updated successfully!");
      } else {
        await createPartner({
          name: partnerForm.name,
          displayName: partnerForm.displayName,
          code: partnerForm.code,
          isActive: partnerForm.isActive,
        }).unwrap();
        setSuccessMessage("Partner created successfully!");
      }
      setShowPartnerModal(false);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
      refetch();
    } catch (error) {
      console.error("Failed to save partner:", error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading partners...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to Load Partners
            </h3>
            <p className="text-muted-foreground mb-4">
              An error occurred while loading partners
            </p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start justify-between">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Success!</h3>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccessMessage(false)}
              className="text-green-400 hover:text-green-500"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <PageHeader
          title="Courier Partners"
          description="Manage your courier service providers and their configurations"
          primaryAction={
            canCreatePartner
              ? { label: "Add Partner", onClick: openCreateModal }
              : undefined
          }
        />

        {/* Statistics Cards */}
        <StatsGrid columns={4}>
          <StatsCard
            title="Total Partners"
            value={totalPartners}
            icon={Users}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Active Partners"
            value={activeCount}
            icon={CheckCircle}
            iconColor="text-green-600"
          />
          <StatsCard
            title="Inactive Partners"
            value={inactiveCount}
            icon={XCircle}
            iconColor="text-gray-600"
          />
          <StatsCard
            title="COD Enabled"
            value={partners.filter((p) => p.supportsCOD).length}
            icon={IndianRupee}
            iconColor="text-purple-600"
          />
        </StatsGrid>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search partners by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Advanced Filters */}
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {showFilters && (
                  <Badge variant="secondary" className="ml-2">
                    ON
                  </Badge>
                )}
              </Button>

              {/* Refresh */}
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="createdAt">Created Date</SelectItem>
                    <SelectItem value="updatedAt">Updated Date</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sortOrder}
                  onValueChange={(value) =>
                    setSortOrder(value as "asc" | "desc")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort Order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => setItemsPerPage(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Per Page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 per page</SelectItem>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Partners Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>API Status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center">
                        <Package className="h-12 w-12 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          No partners found
                        </p>
                        {canCreatePartner && (
                          <Button className="mt-4" onClick={openCreateModal}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add First Partner
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  partners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-50 text-blue-600">
                              {partner.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link
                              href={`/partners/${partner.id}`}
                              className="font-medium hover:underline"
                            >
                              {partner.name}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {partner.displayName}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{partner.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={partner.apiToken ? "default" : "secondary"}
                        >
                          {partner.apiToken ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Connected
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Connected
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {partner.isActive ? (
                          <Badge className="bg-green-50 text-green-700">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">
                            <XCircle className="mr-1 h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/partners/${partner.id}`)
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {canEditPartner && (
                              <DropdownMenuItem
                                onClick={() => openEditModal(partner)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Partner
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/partners/${partner.id}/pincodes`)
                              }
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              Pincode Assign
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/partners/${partner.id}/charges`)
                              }
                            >
                              <IndianRupee className="mr-2 h-4 w-4" />
                              Charges Types
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/partners/${partner.id}/channels`)
                              }
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Manage Channels
                            </DropdownMenuItem>
                            {canManagePartner && (
                              <>
                                <DropdownMenuSeparator />
                                {partner.isActive ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedPartner(partner);
                                      setConfirmAction("deactivate");
                                      setShowConfirmDialog(true);
                                    }}
                                  >
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    Deactivate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedPartner(partner);
                                      setConfirmAction("activate");
                                      setShowConfirmDialog(true);
                                    }}
                                  >
                                    <Power className="mr-2 h-4 w-4" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {canDeletePartner && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setSelectedPartner(partner);
                                    setConfirmAction("delete");
                                    setShowConfirmDialog(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Partner
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalPartners}
            pageSize={itemsPerPage}
          />
        )}

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span>Confirm Action</span>
              </DialogTitle>
              <DialogDescription className="pt-4">
                {confirmAction === "delete" && (
                  <>
                    Are you sure you want to delete{" "}
                    <strong>{selectedPartner?.name}</strong>? This action cannot
                    be undone.
                  </>
                )}
                {confirmAction === "activate" && (
                  <>
                    Are you sure you want to activate{" "}
                    <strong>{selectedPartner?.name}</strong>? This will enable
                    the partner for shipment processing.
                  </>
                )}
                {confirmAction === "deactivate" && (
                  <>
                    Are you sure you want to deactivate{" "}
                    <strong>{selectedPartner?.name}</strong>? This will disable
                    the partner for new shipments.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                  setSelectedPartner(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAction}
                disabled={isDeleting || isUpdatingStatus}
                className={
                  confirmAction === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmAction === "activate"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-yellow-600 hover:bg-yellow-700"
                }
              >
                {(isDeleting || isUpdatingStatus) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {confirmAction === "delete"
                  ? "Delete"
                  : confirmAction === "activate"
                    ? "Activate"
                    : "Deactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Create/Edit Partner Modal */}
        <Dialog open={showPartnerModal} onOpenChange={setShowPartnerModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingPartner ? "Edit Partner" : "Add New Partner"}
              </DialogTitle>
              <DialogDescription>
                {editingPartner
                  ? "Update partner basic information"
                  : "Create a new courier partner"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partner-name">Partner Name *</Label>
                  <Input
                    id="partner-name"
                    value={partnerForm.name}
                    onChange={(e) =>
                      setPartnerForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g., FedEx India"
                    className={formErrors.name ? "border-red-500" : ""}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-displayName">Display Name *</Label>
                  <Input
                    id="partner-displayName"
                    value={partnerForm.displayName}
                    onChange={(e) =>
                      setPartnerForm((prev) => ({
                        ...prev,
                        displayName: e.target.value,
                      }))
                    }
                    placeholder="e.g., FedEx Express"
                    className={formErrors.displayName ? "border-red-500" : ""}
                  />
                  {formErrors.displayName && (
                    <p className="text-sm text-red-500">
                      {formErrors.displayName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-code">Partner Code *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="partner-code"
                      value={partnerForm.code}
                      onChange={(e) =>
                        setPartnerForm((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="e.g., FDX001"
                      className={formErrors.code ? "border-red-500" : ""}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPartnerForm((prev) => ({
                          ...prev,
                          code: generatePartnerCode(prev.name),
                        }))
                      }
                      disabled={!partnerForm.name}
                    >
                      Generate
                    </Button>
                  </div>
                  {formErrors.code && (
                    <p className="text-sm text-red-500">{formErrors.code}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="partner-active"
                    checked={partnerForm.isActive}
                    onCheckedChange={(checked) =>
                      setPartnerForm((prev) => ({
                        ...prev,
                        isActive: checked as boolean,
                      }))
                    }
                  />
                  <Label
                    htmlFor="partner-active"
                    className="text-sm font-normal"
                  >
                    Active (Partner can be used for shipments)
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPartnerModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePartnerSubmit}
                disabled={isCreating || isUpdatingPartner}
              >
                {(isCreating || isUpdatingPartner) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingPartner ? "Update Partner" : "Create Partner"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}
