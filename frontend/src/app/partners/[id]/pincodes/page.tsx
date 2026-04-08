"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Download,
  Upload,
  FileSpreadsheet,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

// RTK Query
import {
  useGetPartnerPincodesQuery,
  useDeletePartnerPincodeMutation,
  useLazyDownloadPincodeTemplateQuery,
} from "@/store/api/endpoints/partnerPincodesApi";
import { useGetPartnersQuery } from "@/store/api/endpoints/partnersApi";

// Components
import { PincodeTable } from "@/components/partners/pincode-table";
import { PincodeAssignDialog } from "@/components/partners/pincode-assign-dialog";
import { PincodeImportDialog } from "@/components/partners/pincode-import";

export default function PartnerPincodesPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;

  // State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pincodeToDelete, setPincodeToDelete] = useState<string | null>(null);

  // Debounce search input to prevent too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch partner details
  const { data: partnerData } = useGetPartnersQuery({ limit: 100 });

  // Fetch assigned pincodes
  const {
    data: pincodesData,
    isLoading,
    error,
    refetch,
  } = useGetPartnerPincodesQuery({
    partnerId,
    params: {
      page: currentPage,
      limit: itemsPerPage,
      search: debouncedSearch || undefined,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active",
    },
  });

  // Mutations
  const [deletePincode, { isLoading: isDeleting }] =
    useDeletePartnerPincodeMutation();

  // Template download - use lazy query to prevent automatic calls
  const [downloadTemplate, { isLoading: isDownloadingTemplate }] =
    useLazyDownloadPincodeTemplateQuery();

  // Find partner name
  const partner = partnerData?.data?.partners?.find((p) => p.id === partnerId);

  // Handle delete confirmation
  const handleDelete = async () => {
    if (!pincodeToDelete || !partner) return;

    try {
      await deletePincode({
        partnerId,
        assignmentId: pincodeToDelete,
      }).unwrap();
      refetch();
      setPincodeToDelete(null);
    } catch (error) {
      console.error("Failed to delete pincode:", error);
    }
  };

  // Handle template download
  const handleDownloadTemplate = async () => {
    try {
      const result = await downloadTemplate();
      if (result.data) {
        const url = window.URL.createObjectURL(new Blob([result.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = "pincode-import-template.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to download template:", error);
    }
  };

  // Custom breadcrumbs
  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Courier Partners", href: "/partners" },
    { title: partner?.name || "Partner" },
    { title: "Pincode Assign" },
  ];

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading pincodes...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to Load Pincodes
            </h3>
            <p className="text-muted-foreground mb-4">
              {("data" in error && (error.data as any)?.error?.message) ||
                "An error occurred while loading pincodes"}
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

  const pincodes = pincodesData?.pincodes || [];
  const pincodeTypes = pincodesData?.pincodeTypes || [];
  const pagination = pincodesData?.pagination;
  const totalPincodes = pagination?.total || 0;

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/partners")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold tracking-tight">
                Pincode Assignments
              </h1>
            </div>
            <p className="text-muted-foreground">
              Manage pincode assignments for{" "}
              <span className="font-semibold">{partner?.name}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="mr-2 w-4" />
              Import
            </Button>
            <Button onClick={() => setShowAssignDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Pincode
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Assigned
                  </p>
                  <p className="text-2xl font-bold">{totalPincodes}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active
                  </p>
                  <p className="text-2xl font-bold">
                    {pincodes.filter((p) => p.isActive).length}
                  </p>
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
                    Inactive
                  </p>
                  <p className="text-2xl font-bold">
                    {pincodes.filter((p) => !p.isActive).length}
                  </p>
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
                    Pincode Types
                  </p>
                  <p className="text-2xl font-bold">{pincodeTypes.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search by pincode code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(value: any) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Per Page */}
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(parseInt(value))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Per Page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pincodes Table */}
        <PincodeTable
          pincodes={pincodes}
          pincodeTypes={pincodeTypes}
          onEdit={(pincode) => {
            // TODO: Implement edit functionality
            console.log("Edit pincode:", pincode);
          }}
          onDelete={(pincodeId) => setPincodeToDelete(pincodeId)}
        />

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, totalPincodes)} of{" "}
                  {totalPincodes} pincodes
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
                    Previous
                  </Button>
                  <div className="flex gap-1">
                    {Array.from(
                      { length: pagination.totalPages },
                      (_, i) => i + 1,
                    )
                      .filter(
                        (page) =>
                          page === 1 ||
                          page === pagination.totalPages ||
                          Math.abs(page - currentPage) <= 1,
                      )
                      .map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
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
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assign Pincode Dialog */}
      <PincodeAssignDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        partnerId={partnerId}
        pincodeTypes={pincodeTypes}
        onSuccess={() => refetch()}
      />

      {/* Import Dialog */}
      <PincodeImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        partnerId={partnerId}
        partnerName={partner?.name || ""}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!pincodeToDelete}
        onOpenChange={() => setPincodeToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              <span>Remove Pincode Assignment</span>
            </DialogTitle>
            <DialogDescription className="pt-4">
              Are you sure you want to remove this pincode assignment? This
              action can be undone by reassigning the pincode.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPincodeToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
