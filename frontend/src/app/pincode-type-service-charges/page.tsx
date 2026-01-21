"use client";

import React, { useState } from "react";
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
  useGetChargesQuery,
  useCreateChargeMutation,
  useUpdateChargeMutation,
  useDeleteChargeMutation,
  type PincodeTypeServiceCharge,
} from "@/store/api/endpoints/pincodeTypeServiceChargeApi";
import { useGetPincodeTypesQuery } from "@/store/api/endpoints/pincodeTypeApi";
import { useGetPartnersQuery } from "@/store/api/endpoints/partnersApi";
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
  IndianRupee,
  X,
  AlertCircle,
  DollarSign,
  Tag,
  Truck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PincodeTypeServiceChargesPage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Pincode Type Service Charges" },
  ];

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const itemsPerPage = 20;

  // RTK Query - Fetch charges
  const {
    data: chargesData,
    isLoading,
    error,
    refetch,
  } = useGetChargesQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm || undefined,
    isActive: statusFilter === "all" ? undefined : statusFilter === "active",
  });

  // Fetch pincode types and partners for the dialog
  const { data: pincodeTypesData } = useGetPincodeTypesQuery({});
  const { data: partnersData } = useGetPartnersQuery({});

  const pincodeTypes = Array.isArray(pincodeTypesData?.data)
    ? pincodeTypesData.data
    : [];
  const partners = Array.isArray(partnersData?.data?.partners)
    ? partnersData.data.partners
    : [];

  // Ensure charges is always an array
  const charges = Array.isArray(chargesData?.data) ? chargesData.data : [];
  const totalCount = chargesData?.meta?.pagination?.total || charges.length;
  const totalPages = chargesData?.meta?.pagination?.totalPages || 1;

  // Calculate statistics
  const activeCharges = charges.filter((c) => c.isActive).length;
  const inactiveCharges = charges.filter((c) => !c.isActive).length;
  const totalValue = charges.reduce(
    (acc: number, c: PincodeTypeServiceCharge) => acc + c.baseCharge,
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

  // Filter charges by search term (client-side)
  const filteredCharges = charges.filter((c: PincodeTypeServiceCharge) => {
    const matchesSearch =
      searchTerm === "" ||
      c.pincodeType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.partner.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">
                Loading service charges...
              </p>
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
                    Failed to Load Service Charges
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(error as any)?.data?.error?.message ||
                      "An error occurred while fetching service charges"}
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
              Pincode Type Service Charges
            </h1>
            <p className="text-muted-foreground">
              Manage service charges for pincode types and partners
            </p>
          </div>
          <Button
            className="flex items-center space-x-2"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Add Service Charge</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Charges
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
                  <p className="text-2xl font-bold">{activeCharges}</p>
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
                  <p className="text-2xl font-bold">{inactiveCharges}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <IndianRupee className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Value
                  </p>
                  <p className="text-2xl font-bold">₹{totalValue.toFixed(2)}</p>
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
                  <DollarSign className="h-5 w-5" />
                  <span>Service Charges</span>
                </CardTitle>
                <CardDescription>
                  Search, filter, and manage pincode type service charges
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search charges..."
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
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter Section */}
            {showFilters && (
              <div className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusFilterChange("all")}
                  >
                    All Status
                  </Button>
                  <Button
                    variant={statusFilter === "active" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusFilterChange("active")}
                  >
                    Active
                  </Button>
                  <Button
                    variant={
                      statusFilter === "inactive" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleStatusFilterChange("inactive")}
                  >
                    Inactive
                  </Button>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear All Filters
                  </Button>
                )}
              </div>
            )}

            {/* Charges Table */}
            <ChargesTable
              charges={filteredCharges}
              refetch={refetch}
              pincodeTypes={pincodeTypes}
              partners={partners}
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

        {/* Create Charge Dialog */}
        <CreateChargeDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          pincodeTypes={pincodeTypes}
          partners={partners}
          onSuccess={() => refetch()}
        />
      </div>
    </DashboardLayout>
  );
}

// Charges Table Component
interface ChargesTableProps {
  charges: PincodeTypeServiceCharge[];
  refetch: () => void;
  pincodeTypes: any[];
  partners: any[];
}

function ChargesTable({
  charges,
  refetch,
  pincodeTypes,
  partners,
}: ChargesTableProps) {
  return (
    <Table>
      <TableCaption>A list of all pincode type service charges</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Pincode Type</TableHead>
          <TableHead>Partner</TableHead>
          <TableHead>Base Charge</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {charges.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-12">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mb-4" />
                <p className="text-lg font-semibold">
                  No service charges found
                </p>
                <p className="text-sm mt-2">
                  Create a service charge to get started
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          charges.map((charge) => (
            <ChargeRow
              key={charge.id}
              charge={charge}
              refetch={refetch}
              pincodeTypes={pincodeTypes}
              partners={partners}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}

// Charge Row Component
function ChargeRow({
  charge,
  refetch,
  pincodeTypes,
  partners,
}: {
  charge: PincodeTypeServiceCharge;
  refetch: () => void;
  pincodeTypes: any[];
  partners: any[];
}) {
  const [updateCharge] = useUpdateChargeMutation();
  const [deleteCharge] = useDeleteChargeMutation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleToggleStatus = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmToggleStatus = async () => {
    try {
      await updateCharge({
        id: charge.id,
        data: { isActive: !charge.isActive },
      }).unwrap();
      setShowConfirmDialog(false);
    } catch (error) {
      console.error("Failed to update charge:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCharge(charge.id).unwrap();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete charge:", error);
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
            <div className="font-medium">{charge.pincodeType.name}</div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100">
              <Truck className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <div className="font-medium">{charge.partner.name}</div>
              <div className="text-xs text-muted-foreground">
                {charge.partner.code}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-1">
            <IndianRupee className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{charge.baseCharge.toFixed(2)}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            className={
              charge.isActive
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-gray-100 text-gray-800 border-gray-200"
            }
          >
            <div className="h-2 w-2 rounded-full bg-current mr-1"></div>
            {charge.isActive ? "Active" : "Inactive"}
          </Badge>
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
                Edit Charge
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-yellow-600"
                onClick={handleToggleStatus}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {charge.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setShowDeleteDialog(true)}
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
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to{" "}
              {charge.isActive ? "deactivate" : "activate"} this service charge?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant={charge.isActive ? "destructive" : "default"}
              onClick={handleConfirmToggleStatus}
            >
              {charge.isActive ? "Deactivate" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Charge Dialog */}
      <EditChargeDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        charge={charge}
        pincodeTypes={pincodeTypes}
        partners={partners}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this service charge? This action
              will soft-delete the charge.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Create Charge Dialog Component
interface CreateChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pincodeTypes: any[];
  partners: any[];
  onSuccess: () => void;
}

function CreateChargeDialog({
  open,
  onOpenChange,
  pincodeTypes,
  partners,
  onSuccess,
}: CreateChargeDialogProps) {
  const [createCharge, { isLoading }] = useCreateChargeMutation();
  const [selectedPincodeTypes, setSelectedPincodeTypes] = useState<string[]>(
    [],
  );
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [baseCharge, setBaseCharge] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPincodeTypes.length === 0 || selectedPartners.length === 0) {
      return;
    }

    try {
      await createCharge({
        pincodeTypeIds: selectedPincodeTypes,
        partnerIds: selectedPartners,
        baseCharge: parseFloat(baseCharge),
      }).unwrap();
      onOpenChange(false);
      setSelectedPincodeTypes([]);
      setSelectedPartners([]);
      setBaseCharge("");
      onSuccess();
    } catch (error) {
      console.error("Failed to create charge:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Service Charge</DialogTitle>
          <DialogDescription>
            Create service charges for pincode type and partner combinations
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Pincode Types Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Select Pincode Types *
            </Label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {pincodeTypes
                .filter((pt) => pt.isActive)
                .map((pt) => (
                  <div key={pt.id} className="flex items-center space-x-2 py-2">
                    <Checkbox
                      id={`pt-${pt.id}`}
                      checked={selectedPincodeTypes.includes(pt.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPincodeTypes([
                            ...selectedPincodeTypes,
                            pt.id,
                          ]);
                        } else {
                          setSelectedPincodeTypes(
                            selectedPincodeTypes.filter((id) => id !== pt.id),
                          );
                        }
                      }}
                    />
                    <Label htmlFor={`pt-${pt.id}`} className="cursor-pointer">
                      {pt.name}
                      {pt.description && (
                        <span className="text-muted-foreground ml-2">
                          ({pt.description})
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPincodeTypes.length} pincode type(s) selected
            </p>
          </div>

          {/* Partners Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Select Partners *</Label>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {partners
                .filter((p) => p.isActive)
                .map((p) => (
                  <div key={p.id} className="flex items-center space-x-2 py-2">
                    <Checkbox
                      id={`p-${p.id}`}
                      checked={selectedPartners.includes(p.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPartners([...selectedPartners, p.id]);
                        } else {
                          setSelectedPartners(
                            selectedPartners.filter((id) => id !== p.id),
                          );
                        }
                      }}
                    />
                    <Label htmlFor={`p-${p.id}`} className="cursor-pointer">
                      {p.displayName} ({p.code})
                    </Label>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPartners.length} partner(s) selected
            </p>
          </div>

          {/* Base Charge */}
          <div className="space-y-2">
            <Label htmlFor="baseCharge">Base Charge (₹) *</Label>
            <Input
              id="baseCharge"
              type="number"
              step="0.01"
              placeholder="50.00"
              value={baseCharge}
              onChange={(e) => setBaseCharge(e.target.value)}
              required
            />
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
            <Button
              type="submit"
              disabled={
                isLoading ||
                selectedPincodeTypes.length === 0 ||
                selectedPartners.length === 0 ||
                !baseCharge
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Charge
                  {selectedPincodeTypes.length > 1 ||
                  selectedPartners.length > 1
                    ? `s (${selectedPincodeTypes.length * selectedPartners.length})`
                    : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Charge Dialog Component
interface EditChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: PincodeTypeServiceCharge;
  pincodeTypes: any[];
  partners: any[];
  onSuccess: () => void;
}

function EditChargeDialog({
  open,
  onOpenChange,
  charge,
  pincodeTypes,
  partners,
  onSuccess,
}: EditChargeDialogProps) {
  const [updateCharge, { isLoading: isUpdating }] = useUpdateChargeMutation();
  const [deleteCharge] = useDeleteChargeMutation();
  const [createCharge] = useCreateChargeMutation();

  const [selectedPincodeTypeId, setSelectedPincodeTypeId] = useState(
    charge.pincodeType.id,
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState(charge.partner.id);
  const [baseCharge, setBaseCharge] = useState(charge.baseCharge.toString());
  const [isActive, setIsActive] = useState(charge.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // If pincode type or partner changed, we need to delete old and create new
      const typeOrPartnerChanged =
        selectedPincodeTypeId !== charge.pincodeType.id ||
        selectedPartnerId !== charge.partner.id;

      if (typeOrPartnerChanged) {
        // Delete old charge
        await deleteCharge(charge.id).unwrap();

        // Create new charge with updated values
        await createCharge({
          pincodeTypeIds: [selectedPincodeTypeId],
          partnerIds: [selectedPartnerId],
          baseCharge: parseFloat(baseCharge),
          isActive,
        }).unwrap();
      } else {
        // Just update the charge amount and status
        await updateCharge({
          id: charge.id,
          data: {
            baseCharge: parseFloat(baseCharge),
            isActive,
          },
        }).unwrap();
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to update charge:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Service Charge</DialogTitle>
          <DialogDescription>
            Update the service charge configuration
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Pincode Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="editPincodeType">Pincode Type *</Label>
            <select
              id="editPincodeType"
              value={selectedPincodeTypeId}
              onChange={(e) => setSelectedPincodeTypeId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              {pincodeTypes
                .filter((pt) => pt.isActive)
                .map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                    {pt.description && ` (${pt.description})`}
                  </option>
                ))}
            </select>
          </div>

          {/* Partner Selection */}
          <div className="space-y-2">
            <Label htmlFor="editPartner">Partner *</Label>
            <select
              id="editPartner"
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              {partners
                .filter((p) => p.isActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Base Charge */}
          <div className="space-y-2">
            <Label htmlFor="editBaseCharge">Base Charge (₹) *</Label>
            <Input
              id="editBaseCharge"
              type="number"
              step="0.01"
              value={baseCharge}
              onChange={(e) => setBaseCharge(e.target.value)}
              required
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="editIsActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked as boolean)}
            />
            <Label htmlFor="editIsActive" className="cursor-pointer">
              Active
            </Label>
          </div>

          {/* Warning if changing type or partner */}
          {(selectedPincodeTypeId !== charge.pincodeType.id ||
            selectedPartnerId !== charge.partner.id) && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Changing pincode type or partner will delete the existing
                charge and create a new one.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Charge"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
