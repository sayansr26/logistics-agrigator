"use client";

import React, { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useGetPincodeTypesQuery,
  useCreatePincodeTypeMutation,
  useUpdatePincodeTypeMutation,
  useDeletePincodeTypeMutation,
  useAssignPincodesToTypeMutation,
  useUnassignPincodesFromTypeMutation,
  useGetPincodesByTypeQuery,
  type PincodeTypeWithStats,
} from "@/store/api/endpoints/pincodeTypeApi";
import { useSearchPincodesQuery } from "@/store/api/endpoints/geoApi";
import {
  Settings,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  MapPin,
  IndianRupee,
  X,
  AlertCircle,
  Tag,
  Hash,
} from "lucide-react";

export default function PincodeTypesPage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Pincode Types" },
  ];

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const itemsPerPage = 20;

  // RTK Query - Fetch pincode types from API
  const {
    data: pincodeTypesData,
    isLoading,
    error,
    refetch,
  } = useGetPincodeTypesQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm || undefined,
    isActive: statusFilter === "all" ? undefined : statusFilter === "active",
  });

  // Ensure pincodeTypes is always an array
  const pincodeTypes = Array.isArray(pincodeTypesData?.data)
    ? pincodeTypesData.data
    : [];
  const totalCount =
    pincodeTypesData?.meta?.pagination?.totalCount || pincodeTypes.length;
  const totalPages = pincodeTypesData?.meta?.pagination?.totalPages || 1;

  // Calculate statistics (safely handle empty arrays)
  const activePincodeTypes = pincodeTypes.filter(
    (pt: PincodeTypeWithStats) => pt.isActive,
  ).length;
  const inactivePincodeTypes = pincodeTypes.filter(
    (pt: PincodeTypeWithStats) => !pt.isActive,
  ).length;
  const totalAssignments = pincodeTypes.reduce(
    (acc: number, pt: PincodeTypeWithStats) =>
      acc + (pt._count?.assignments || 0),
    0,
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleStatusFilterChange = (status: "all" | "active" | "inactive") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== "all" || searchTerm !== "";

  // Filter pincode types by search term (client-side additional filtering)
  const filteredPincodeTypes = pincodeTypes.filter(
    (pt: PincodeTypeWithStats) => {
      const matchesSearch =
        searchTerm === "" ||
        pt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pt.description?.toLowerCase() || "").includes(
          searchTerm.toLowerCase(),
        );
      return matchesSearch;
    },
  );

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">Loading pincode types...</p>
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
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                  <h3 className="text-lg font-semibold">
                    Failed to Load Pincode Types
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(error as any)?.data?.error?.message ||
                      "An error occurred while fetching pincode types"}
                  </p>
                  <Button onClick={() => refetch()}>Try Again</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              Pincode Types Management
            </h1>
            <p className="text-muted-foreground">
              Configure pincode types with charges for Metro, ODA, Hill areas,
              etc.
            </p>
          </div>
          <Button
            className="flex items-center space-x-2"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Add Pincode Type</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Tag className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Types
                  </p>
                  <p className="text-2xl font-bold">{totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active
                  </p>
                  <p className="text-2xl font-bold">{activePincodeTypes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Inactive
                  </p>
                  <p className="text-2xl font-bold">{inactivePincodeTypes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Assignments
                  </p>
                  <p className="text-2xl font-bold">{totalAssignments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Tag className="h-5 w-5" />
                  <span>Pincode Types</span>
                </CardTitle>
                <CardDescription>
                  Search, filter, and manage pincode type configurations
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search pincode types..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    className={`pl-10 w-64 transition-all duration-200 ${
                      isSearchFocused
                        ? "ring-2 ring-blue-500 border-blue-500"
                        : ""
                    }`}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="icon"
                  onClick={toggleFilters}
                  className="transition-all duration-200"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Enhanced Filter Section */}
            {showFilters && (
              <div className="space-y-6 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                {/* Status Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-green-100 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-green-600 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filter by Status
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={statusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusFilterChange("all")}
                      className={`transition-all duration-200 ${
                        statusFilter === "all"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                          : "hover:bg-gray-50 border-gray-300"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      All Status
                    </Button>
                    <Button
                      variant={
                        statusFilter === "active" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleStatusFilterChange("active")}
                      className={`transition-all duration-200 ${
                        statusFilter === "active"
                          ? "bg-green-600 hover:bg-green-700 text-white shadow-md"
                          : "hover:bg-green-50 border-green-300 text-green-700"
                      }`}
                    >
                      <CheckCircle className="h-3 w-3 mr-2" />
                      Active
                    </Button>
                    <Button
                      variant={
                        statusFilter === "inactive" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleStatusFilterChange("inactive")}
                      className={`transition-all duration-200 ${
                        statusFilter === "inactive"
                          ? "bg-gray-600 hover:bg-gray-700 text-white shadow-md"
                          : "hover:bg-gray-50 border-gray-300 text-gray-700"
                      }`}
                    >
                      <XCircle className="h-3 w-3 mr-2" />
                      Inactive
                    </Button>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {hasActiveFilters && (
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Active Filters:
                      </span>
                      {statusFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                        >
                          Status: {statusFilter}
                        </Badge>
                      )}
                      {searchTerm && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-800"
                        >
                          Search: &quot;{searchTerm}&quot;
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Results Summary */}
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {filteredPincodeTypes.length} pincode type
                  {filteredPincodeTypes.length !== 1 ? "s" : ""} found
                </span>
                {hasActiveFilters && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    (filtered from {totalCount} total)
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Pincode Types Table */}
            <PincodeTypesTable
              pincodeTypes={filteredPincodeTypes}
              searchTerm={searchTerm}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>

                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, i) => i + 1,
                  ).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Pincode Type Dialog */}
        <CreatePincodeTypeDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </DashboardLayout>
  );
}

interface PincodeTypesTableProps {
  pincodeTypes: PincodeTypeWithStats[];
  searchTerm: string;
}

function PincodeTypesTable({
  pincodeTypes,
  searchTerm,
}: PincodeTypesTableProps) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered pincode types for "${searchTerm}"`
          : "A list of all pincode types"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Charge</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assignments</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pincodeTypes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-12">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Tag className="h-12 w-12 mb-4" />
                <p className="text-lg font-semibold">No pincode types found</p>
                <p className="text-sm mt-2">
                  {searchTerm
                    ? "Try adjusting your search or filters"
                    : "No pincode types available. Create one to get started."}
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          pincodeTypes.map((pincodeType) => (
            <PincodeTypeRow key={pincodeType.id} pincodeType={pincodeType} />
          ))
        )}
      </TableBody>
    </Table>
  );
}

// Pincode Type Row Component
function PincodeTypeRow({
  pincodeType,
}: {
  pincodeType: PincodeTypeWithStats;
}) {
  const [updatePincodeType, { isLoading: isUpdating }] =
    useUpdatePincodeTypeMutation();
  const [deletePincodeType, { isLoading: isDeleting }] =
    useDeletePincodeTypeMutation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPincodesDialog, setShowPincodesDialog] = useState(false);

  const handleToggleStatus = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmToggleStatus = async () => {
    try {
      await updatePincodeType({
        id: pincodeType.id,
        data: { isActive: !pincodeType.isActive },
      }).unwrap();
      setShowConfirmDialog(false);
    } catch (error) {
      console.error("Failed to update pincode type:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePincodeType(pincodeType.id).unwrap();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete pincode type:", error);
    }
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
              <Tag className="h-4 w-4 text-blue-600" />
            </div>
            <div className="font-medium">{pincodeType.name}</div>
          </div>
        </TableCell>
        <TableCell className="max-w-xs truncate">
          {pincodeType.description || "-"}
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-1">
            <IndianRupee className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{pincodeType.charge}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            className={
              pincodeType.isActive
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-gray-100 text-gray-800 border-gray-200"
            }
          >
            <div className="h-2 w-2 rounded-full bg-current mr-1"></div>
            {pincodeType.isActive ? "Active" : "Inactive"}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-1">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <span>{pincodeType._count?.assignments || 0}</span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPincodesDialog(true)}>
                <MapPin className="mr-2 h-4 w-4" />
                Manage Pincodes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-yellow-600"
                onClick={handleToggleStatus}
                disabled={isUpdating}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {pincodeType.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span>Confirm Action</span>
            </DialogTitle>
            <DialogDescription className="pt-4">
              {pincodeType.isActive ? (
                <div className="space-y-3">
                  <p className="text-base">
                    Are you sure you want to{" "}
                    <span className="font-semibold text-yellow-700">
                      deactivate
                    </span>{" "}
                    this pincode type?
                  </p>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">
                      {pincodeType.name}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-base">
                    Are you sure you want to{" "}
                    <span className="font-semibold text-green-700">
                      activate
                    </span>{" "}
                    this pincode type?
                  </p>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium">
                      {pincodeType.name}
                    </p>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={pincodeType.isActive ? "destructive" : "default"}
              onClick={handleConfirmToggleStatus}
              disabled={isUpdating}
              className={
                pincodeType.isActive
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>{pincodeType.isActive ? "Deactivate" : "Activate"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pincode Type Dialog */}
      <EditPincodeTypeDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        pincodeType={pincodeType}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              <span>Confirm Deletion</span>
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-4">
                <p className="text-base font-semibold text-red-700">
                  Are you sure you want to delete this pincode type?
                </p>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">
                    {pincodeType.name}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Charge: ₹{pincodeType.charge}
                  </p>
                </div>
                <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg">
                  <p className="text-sm text-red-900 font-semibold mb-2">
                    ⚠️ Warning: This action will soft-delete the pincode type!
                  </p>
                  <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                    <li>The pincode type will be deactivated</li>
                    <li>Existing assignments will be preserved</li>
                    <li>You can reactivate it later if needed</li>
                  </ul>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Pincode Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Pincodes Dialog */}
      <ManagePincodesDialog
        open={showPincodesDialog}
        onOpenChange={setShowPincodesDialog}
        pincodeType={pincodeType}
      />
    </>
  );
}

// Create Pincode Type Dialog Component
function CreatePincodeTypeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [createPincodeType, { isLoading }] = useCreatePincodeTypeMutation();
  const [formData, setFormData] = useState({
    name: "",
    charge: "0",
    description: "",
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPincodeType(formData).unwrap();

      // Reset form and close dialog
      setFormData({
        name: "",
        charge: "0",
        description: "",
        isActive: true,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create pincode type:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-blue-600" />
            <span>Create New Pincode Type</span>
          </DialogTitle>
          <DialogDescription>
            Add a new pincode type with a charge for special delivery areas
            (Metro, ODA, Hill, etc.)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Metro, ODA, Hill"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                A unique name for this pincode type
              </p>
            </div>

            {/* Charge */}
            <div className="space-y-2">
              <Label htmlFor="charge">Charge (₹) *</Label>
              <Input
                id="charge"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.charge}
                onChange={(e) =>
                  setFormData({ ...formData, charge: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Additional charge applied to shipments with this pincode type
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter a description for this pincode type..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            {/* Active Status */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Pincode Type
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Pincode Type Dialog Component
function EditPincodeTypeDialog({
  open,
  onOpenChange,
  pincodeType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pincodeType: PincodeTypeWithStats;
}) {
  const [updatePincodeType, { isLoading }] = useUpdatePincodeTypeMutation();
  const [formData, setFormData] = useState({
    name: pincodeType.name,
    charge: pincodeType.charge,
    description: pincodeType.description || "",
    isActive: pincodeType.isActive,
  });

  // Update form data when pincodeType prop changes
  useEffect(() => {
    setFormData({
      name: pincodeType.name,
      charge: pincodeType.charge,
      description: pincodeType.description || "",
      isActive: pincodeType.isActive,
    });
  }, [pincodeType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePincodeType({
        id: pincodeType.id,
        data: formData,
      }).unwrap();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update pincode type:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5 text-blue-600" />
              <span>Edit Pincode Type</span>
            </DialogTitle>
            <DialogDescription>
              Update the pincode type details
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Metro, ODA, Hill"
                required
              />
            </div>

            {/* Charge */}
            <div className="space-y-2">
              <Label htmlFor="edit-charge">Charge (₹) *</Label>
              <Input
                id="edit-charge"
                type="number"
                min="0"
                step="0.01"
                value={formData.charge}
                onChange={(e) =>
                  setFormData({ ...formData, charge: e.target.value })
                }
                placeholder="0.00"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter a description..."
                rows={3}
              />
            </div>

            {/* Active Status */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Update Pincode Type
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Manage Pincodes Dialog Component
function ManagePincodesDialog({
  open,
  onOpenChange,
  pincodeType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pincodeType: PincodeTypeWithStats;
}) {
  const [assignPincodes, { isLoading: isAssigning }] =
    useAssignPincodesToTypeMutation();
  const [unassignPincodes, { isLoading: isUnassigning }] =
    useUnassignPincodesFromTypeMutation();
  const {
    data: pincodesData,
    isLoading: isLoadingPincodes,
    refetch,
  } = useGetPincodesByTypeQuery(
    { id: pincodeType.id, page: 1, limit: 100 },
    { skip: !open },
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedToAssign, setSelectedToAssign] = useState<string[]>([]);
  const [selectedPincodes, setSelectedPincodes] = useState<string[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch pincodes for autocomplete - use search endpoint with 'code' parameter
  const { data: searchResults, isLoading: isSearching } =
    useSearchPincodesQuery(
      { code: debouncedSearch },
      { skip: !debouncedSearch || debouncedSearch.length < 2 },
    );

  const suggestions = Array.isArray(searchResults?.data)
    ? searchResults.data
    : [];
  const assignedPincodes = Array.isArray(pincodesData?.data)
    ? pincodesData.data
    : [];
  const assignedCodes = assignedPincodes.map(
    (p: any) => p.pincode?.code || p.code,
  );

  // Filter out already assigned and already selected pincodes from suggestions
  const filteredSuggestions = suggestions.filter(
    (p: any) =>
      !assignedCodes.includes(p.code) && !selectedToAssign.includes(p.code),
  );

  const handleSelectSuggestion = (pincode: any) => {
    if (!selectedToAssign.includes(pincode.code)) {
      setSelectedToAssign([...selectedToAssign, pincode.code]);
    }
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const handleRemoveFromSelection = (code: string) => {
    setSelectedToAssign(selectedToAssign.filter((c) => c !== code));
  };

  const handleAssign = async () => {
    setAssignError(null);
    setAssignSuccess(null);

    if (selectedToAssign.length === 0) {
      setAssignError("Please select at least one pincode to assign");
      return;
    }

    try {
      const result = await assignPincodes({
        id: pincodeType.id,
        data: { pincodeCodes: selectedToAssign },
      }).unwrap();

      setSelectedToAssign([]);
      setAssignSuccess(
        `Assigned ${result.data?.assigned || 0} pincodes. ${
          result.data?.skipped
            ? `Skipped ${result.data.skipped} (already assigned or not found).`
            : ""
        }`,
      );
      refetch();
    } catch (error: any) {
      setAssignError(
        error?.data?.error?.message || "Failed to assign pincodes",
      );
    }
  };

  const handleUnassign = async () => {
    if (selectedPincodes.length === 0) return;

    setAssignError(null);
    setAssignSuccess(null);

    try {
      const result = await unassignPincodes({
        id: pincodeType.id,
        data: { pincodeCodes: selectedPincodes },
      }).unwrap();

      setSelectedPincodes([]);
      setAssignSuccess(
        `Unassigned ${result.data?.unassigned || selectedPincodes.length} pincodes`,
      );
      refetch();
    } catch (error: any) {
      setAssignError(
        error?.data?.error?.message || "Failed to unassign pincodes",
      );
    }
  };

  const togglePincodeSelection = (code: string) => {
    setSelectedPincodes((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code],
    );
  };

  const selectAllPincodes = () => {
    if (selectedPincodes.length === assignedPincodes.length) {
      setSelectedPincodes([]);
    } else {
      setSelectedPincodes(
        assignedPincodes.map((p: any) => p.pincode?.code || p.code),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span>Manage Pincodes - {pincodeType.name}</span>
          </DialogTitle>
          <DialogDescription>
            Assign or remove pincodes from this pincode type. Charge: ₹
            {pincodeType.charge}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Assign New Pincodes Section */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Assign New Pincodes
            </h3>

            {/* Autocomplete Search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pincodes (type at least 2 characters)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-10"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && debouncedSearch.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Searching...
                    </div>
                  ) : filteredSuggestions.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      No matching pincodes found
                    </div>
                  ) : (
                    filteredSuggestions.map((pincode: any) => (
                      <button
                        key={pincode.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(pincode)}
                        className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                      >
                        <div>
                          <span className="font-medium">{pincode.code}</span>
                          {pincode.area?.name && (
                            <span className="text-muted-foreground ml-2">
                              {pincode.area.name}
                            </span>
                          )}
                          {(pincode.area?.city?.name || pincode.city?.name) && (
                            <span className="text-muted-foreground ml-1">
                              , {pincode.area?.city?.name || pincode.city?.name}
                            </span>
                          )}
                          {pincode.state?.name && (
                            <span className="text-muted-foreground ml-1">
                              ({pincode.state.code || pincode.state.name})
                            </span>
                          )}
                        </div>
                        <Plus className="h-4 w-4 text-blue-600" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Pincodes to Assign */}
            {selectedToAssign.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Selected to assign ({selectedToAssign.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedToAssign.map((code) => (
                    <Badge
                      key={code}
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                      onClick={() => handleRemoveFromSelection(code)}
                    >
                      {code}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleAssign}
              disabled={isAssigning || selectedToAssign.length === 0}
              size="sm"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Assign{" "}
                  {selectedToAssign.length > 0
                    ? `(${selectedToAssign.length})`
                    : ""}{" "}
                  Pincodes
                </>
              )}
            </Button>
          </div>

          {/* Success/Error Messages */}
          {assignSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <CheckCircle className="h-4 w-4 inline mr-2" />
              {assignSuccess}
            </div>
          )}
          {assignError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              {assignError}
            </div>
          )}

          {/* Assigned Pincodes Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Assigned Pincodes ({assignedPincodes.length})
              </h3>
              {assignedPincodes.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllPincodes}
                  >
                    {selectedPincodes.length === assignedPincodes.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                  {selectedPincodes.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleUnassign}
                      disabled={isUnassigning}
                    >
                      {isUnassigning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove ({selectedPincodes.length})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isLoadingPincodes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : assignedPincodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pincodes assigned yet</p>
                <p className="text-xs">Use the form above to assign pincodes</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-[200px] overflow-y-auto p-2 border rounded-lg">
                {assignedPincodes.map((assignment: any) => {
                  const code = assignment.pincode?.code || assignment.code;
                  const isSelected = selectedPincodes.includes(code);
                  return (
                    <Badge
                      key={assignment.id || code}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer text-center justify-center py-1.5 transition-all ${
                        isSelected
                          ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                          : "hover:bg-gray-100"
                      }`}
                      onClick={() => togglePincodeSelection(code)}
                    >
                      {code}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
