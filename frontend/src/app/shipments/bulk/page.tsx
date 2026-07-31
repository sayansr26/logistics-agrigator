"use client";

import { useMemo, useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkUploadModal } from "@/components/shipments/BulkUploadModal";
import {
  useGetBulkJobsQuery,
  useUploadBulkShipmentsMutation,
  type BulkJob,
  type BulkJobStatus,
  type BulkUploadResponse,
} from "@/store/api/endpoints/shipmentApi";
import { useGetMyAddressesQuery } from "@/store/api/endpoints/outletApi";
import { useAppSelector } from "@/store/hooks";
import { API_CONFIG } from "@/constants/api";
import {
  BULK_JOB_STATUS_VALUES,
  formatDateTime,
  formatEnumLabel,
  formatFileSize,
  getBulkJobStatusColor,
} from "@/lib/utils/shipment-status";
import {
  Upload,
  Download,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;
const ALL_STATUSES = "ALL";

export default function BulkShipmentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [lastResult, setLastResult] = useState<
    BulkUploadResponse["data"] | null
  >(null);
  const [detailJob, setDetailJob] = useState<BulkJob | null>(null);

  const accessToken = useAppSelector((state) => state.auth.token);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: "Bulk Shipments" },
  ];

  const queryParams = useMemo(
    () => ({
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      ...(statusFilter !== ALL_STATUSES
        ? { status: statusFilter as BulkJobStatus }
        : {}),
      ...(searchTerm ? { search: searchTerm } : {}),
    }),
    [currentPage, statusFilter, searchTerm],
  );

  const { data, isLoading, isFetching, error, refetch } =
    useGetBulkJobsQuery(queryParams);

  const [uploadBulkShipments] = useUploadBulkShipmentsMutation();

  // Pickup addresses are optional here - they only prefill the template, and
  // this endpoint is outlet-scoped, so failures are non-fatal.
  const { data: addressData, isLoading: isLoadingAddresses } =
    useGetMyAddressesQuery();

  const jobs = data?.data?.jobs ?? [];
  const pagination = data?.data?.pagination;
  const summary = data?.data?.summary;

  const totalPages = pagination?.pages ?? 0;

  const pickupAddresses = (addressData?.data?.addresses ?? []).map(
    (address) => ({
      id: address.id,
      label: address.label,
      name: address.name,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      phone: address.phone,
      email: address.email,
    }),
  );

  const handlePageChange = (page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) return;
    setCurrentPage(page);
  };

  const handleUpload = async (file: File) => {
    try {
      const response = await uploadBulkShipments(file).unwrap();
      setLastResult(response.data);
    } catch (err) {
      const message =
        (err as { data?: { error?: { message?: string } } })?.data?.error
          ?.message ?? "Upload failed. Please try again.";
      // Rethrow so the modal can render the real server message
      throw new Error(message);
    }
  };

  /**
   * Fetch the canonical template from the backend so it always matches what
   * the parser accepts. Optionally prefill the pickup columns.
   */
  const handleDownloadTemplate = async (pickupAddress?: {
    name: string;
    phone: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  }) => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/shipments/bulk/template`,
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      );

      if (!response.ok) throw new Error("Template download failed");

      let csv = await response.text();

      if (pickupAddress) {
        csv = prefillPickupColumns(csv, pickupAddress);
      }

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bulk_shipment_template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      // Non-fatal: the user can retry from the modal
    }
  };

  const statCards = [
    {
      label: "Total Bulk Uploads",
      value: summary?.totalJobs ?? 0,
      icon: <Package className="h-8 w-8 text-blue-600" />,
    },
    {
      label: "Successful",
      value: summary?.successful ?? 0,
      dotClass: "bg-green-100",
      innerClass: "bg-green-600",
    },
    {
      label: "Failed",
      value: summary?.failed ?? 0,
      dotClass: "bg-red-100",
      innerClass: "bg-red-600",
    },
    {
      label: "In Progress",
      value: summary?.inProgress ?? 0,
      dotClass: "bg-orange-100",
      innerClass: "bg-orange-600",
    },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Package className="h-8 w-8 text-logistics-600" />
              <span>Bulk Shipments</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage bulk shipments efficiently
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadTemplate()}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download Template
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload Shipments
            </Button>
          </div>
        </div>

        {/* Last upload outcome */}
        {lastResult && (
          <Alert
            variant={
              lastResult.summary.successCount > 0 ? "default" : "destructive"
            }
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">{lastResult.fileName}</span>:{" "}
              {lastResult.summary.successCount} created,{" "}
              {lastResult.summary.failureCount} failed
              {lastResult.summary.parseErrorCount > 0
                ? ` (${lastResult.summary.parseErrorCount} rejected before processing)`
                : ""}
              .
              {lastResult.failed.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {lastResult.failed.slice(0, 5).map((row, index) => (
                    <li key={`${row.index}-${index}`}>
                      Row {row.index}
                      {row.orderId ? ` (${row.orderId})` : ""}: {row.error}
                    </li>
                  ))}
                  {lastResult.failed.length > 5 && (
                    <li>…and {lastResult.failed.length - 5} more.</li>
                  )}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  {card.icon ?? (
                    <div
                      className={`h-8 w-8 ${card.dotClass} rounded-full flex items-center justify-center`}
                    >
                      <div
                        className={`h-4 w-4 ${card.innerClass} rounded-full`}
                      ></div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{card.value}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Bulk Upload History</span>
                </CardTitle>
                <CardDescription>
                  Track and manage your bulk shipment uploads
                </CardDescription>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by file name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10 w-56"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                    {BULK_JOB_STATUS_VALUES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatEnumLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-3"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                <p className="text-lg font-medium text-foreground">
                  Failed to load bulk uploads
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check your connection and try again.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-lg font-medium text-foreground">
                  No bulk uploads yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm || statusFilter !== ALL_STATUSES
                    ? "Try adjusting your search or filters."
                    : "Upload a CSV or Excel file to create shipments in bulk."}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableCaption>
                    {searchTerm
                      ? `Filtered uploads for "${searchTerm}"`
                      : "A list of recent bulk uploads"}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Success</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          {job.fileName ?? "-"}
                        </TableCell>
                        <TableCell>{formatDateTime(job.createdAt)}</TableCell>
                        <TableCell>
                          <Badge className={getBulkJobStatusColor(job.status)}>
                            {formatEnumLabel(job.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.totalRecords}</TableCell>
                        <TableCell className="text-green-700">
                          {job.successfulRecords}
                        </TableCell>
                        <TableCell className="text-red-700">
                          {job.failedRecords}
                        </TableCell>
                        <TableCell>{formatFileSize(job.fileSize)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setDetailJob(job)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination - server-side */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Page {pagination?.page ?? currentPage} of {totalPages} (
                      {pagination?.total ?? 0} total)
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || isFetching}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || isFetching}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job detail dialog */}
      <Dialog
        open={detailJob !== null}
        onOpenChange={(open) => !open && setDetailJob(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload details</DialogTitle>
            <DialogDescription>
              {detailJob?.fileName ?? "Bulk upload"}
            </DialogDescription>
          </DialogHeader>

          {detailJob && (
            <div className="space-y-3 text-sm">
              <DetailRow
                label="Status"
                value={formatEnumLabel(detailJob.status)}
              />
              <DetailRow
                label="Total records"
                value={String(detailJob.totalRecords)}
              />
              <DetailRow
                label="Successful"
                value={String(detailJob.successfulRecords)}
              />
              <DetailRow
                label="Failed"
                value={String(detailJob.failedRecords)}
              />
              <DetailRow
                label="File size"
                value={formatFileSize(detailJob.fileSize)}
              />
              <DetailRow
                label="Started"
                value={formatDateTime(detailJob.startedAt)}
              />
              <DetailRow
                label="Completed"
                value={formatDateTime(detailJob.completedAt)}
              />
              <DetailRow
                label="Processing time"
                value={
                  detailJob.processingTimeMs !== null
                    ? `${detailJob.processingTimeMs} ms`
                    : "-"
                }
              />
              {detailJob.errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{detailJob.errorMessage}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
        onDownloadTemplate={handleDownloadTemplate}
        pickupAddresses={pickupAddresses}
        isLoadingAddresses={isLoadingAddresses}
      />
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/**
 * Replace the pickup columns in the template's sample rows with a saved
 * warehouse address, so users can start from their own data.
 */
function prefillPickupColumns(
  csv: string,
  address: {
    name: string;
    phone: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  },
): string {
  const lines = csv.split("\n");
  if (lines.length < 2) return csv;

  const escape = (value: string) =>
    /[",]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  const header = parseCsvLine(lines[0]);
  const pickupValues: Record<string, string> = {
    "Pickup Name": address.name,
    "Pickup Phone": address.phone,
    "Pickup Email": address.email ?? "",
    "Pickup Address Line 1": address.addressLine1,
    "Pickup Address Line 2": address.addressLine2 ?? "",
    "Pickup City": address.city,
    "Pickup State": address.state,
    "Pickup Pincode": address.pincode,
  };

  const updated = lines.map((line, index) => {
    if (index === 0 || !line.trim()) return line;

    const cells = parseCsvLine(line);
    header.forEach((columnName, columnIndex) => {
      if (columnName in pickupValues) {
        cells[columnIndex] = pickupValues[columnName];
      }
    });
    return cells.map(escape).join(",");
  });

  return updated.join("\n");
}

/** Minimal CSV line parser that respects quoted cells. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}
