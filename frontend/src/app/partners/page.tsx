"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Truck,
  Package,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  Clock,
  Power,
  PowerOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  Users,
} from "lucide-react";

// RTK Query hooks
import {
  useGetPartnersQuery,
  useDeletePartnerMutation,
  useUpdatePartnerStatusMutation,
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
  const [codFilter, setCodFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "activate" | "deactivate" | null
  >(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

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
      let message = "";
      switch (success) {
        case "partner-created":
          message = "Partner created successfully!";
          break;
        case "partner-updated":
          message = "Partner updated successfully!";
          break;
        case "partner-deleted":
          message = "Partner deleted successfully!";
          break;
        case "partner-activated":
          message = "Partner activated successfully!";
          break;
        case "partner-deactivated":
          message = "Partner deactivated successfully!";
          break;
      }
      if (message) {
        setSuccessMessage(message);
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

  // Custom breadcrumbs
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Courier Partners" },
  ];

  // Render partner status badge
  const renderStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-50 text-green-700 hover:bg-green-100">
          <CheckCircle className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-50 text-gray-600 hover:bg-gray-100">
        <XCircle className="mr-1 h-3 w-3" />
        Inactive
      </Badge>
    );
  };

  // Render service badges
  const renderServiceBadges = (partner: Partner) => {
    return (
      <div className="flex gap-1">
        {partner.supportsCOD && (
          <Badge variant="outline" className="text-xs">
            COD
          </Badge>
        )}
        {partner.supportsReverse && (
          <Badge variant="outline" className="text-xs">
            Reverse
          </Badge>
        )}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout breadcrumbs={customBreadcrumbs}>
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
      <DashboardLayout breadcrumbs={customBreadcrumbs}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to Load Partners
            </h3>
            <p className="text-muted-foreground mb-4">
              {error?.data?.error?.message ||
                "An error occurred while loading partners"}
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
    <DashboardLayout breadcrumbs={customBreadcrumbs}>
      <div className="space-y-4">
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Courier Partners
            </h1>
            <p className="text-muted-foreground">
              Manage your courier service providers and their configurations
            </p>
          </div>
          {canCreatePartner && (
            <Button onClick={() => router.push("/partners/add")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Partner
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Partners
                  </p>
                  <p className="text-2xl font-bold">{totalPartners}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Partners
                  </p>
                  <p className="text-2xl font-bold">{activeCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Inactive Partners
                  </p>
                  <p className="text-2xl font-bold">{inactiveCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    COD Enabled
                  </p>
                  <p className="text-2xl font-bold">
                    {partners.filter((p) => p.supportsCOD).length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search partners by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className={`pl-10 ${isSearchFocused ? "ring-2 ring-blue-500" : ""}`}
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
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  <Select value={codFilter} onValueChange={setCodFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="COD Support" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">COD Enabled</SelectItem>
                      <SelectItem value="no">COD Disabled</SelectItem>
                    </SelectContent>
                  </Select>

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
                        <Package className="h-12 w-12 text-gray-400 mb-2" />
                        <p className="text-muted-foreground">
                          No partners found
                        </p>
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
                            <p className="font-medium">{partner.name}</p>
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
                        {renderStatusBadge(partner.isActive)}
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
                                onClick={() =>
                                  router.push(`/partners/${partner.id}/edit`)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Partner
                              </DropdownMenuItem>
                            )}
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
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, totalPartners)} of{" "}
                  {totalPartners} partners
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex gap-1">
                    {Array.from(
                      { length: pagination.totalPages },
                      (_, i) => i + 1,
                    )
                      .filter((page) => {
                        // Show first page, last page, and pages around current
                        return (
                          page === 1 ||
                          page === pagination.totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, index, array) => (
                        <>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span
                              key={`ellipsis-${page}`}
                              className="px-2 py-1"
                            >
                              ...
                            </span>
                          )}
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-10"
                          >
                            {page}
                          </Button>
                        </>
                      ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(pagination.totalPages, prev + 1),
                      )
                    }
                    disabled={currentPage === pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
      </div>
    </DashboardLayout>
  );
}
