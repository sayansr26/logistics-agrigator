"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  useGetNDRCasesQuery,
  useTakeNDRActionMutation,
  type NDRActionType,
  type NDRCase,
  type NDRStatusValue,
} from "@/store/api/endpoints/shipmentApi";
import {
  formatDateTime,
  formatEnumLabel,
  getNDRPriorityColor,
  getNDRStatusColor,
  NDR_STATUS_VALUES,
} from "@/lib/utils/shipment-status";
import {
  Package,
  Search,
  MoreHorizontal,
  Edit,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Download,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;
const ALL_STATUSES = "ALL";

const NDR_ACTIONS: { value: NDRActionType; label: string; hint: string }[] = [
  {
    value: "REATTEMPT_DELIVERY",
    label: "Reattempt Delivery",
    hint: "Schedule another delivery attempt.",
  },
  {
    value: "RETURN_TO_ORIGIN",
    label: "Return to Origin (RTO)",
    hint: "Send the shipment back to the pickup location.",
  },
  {
    value: "MARK_RESOLVED",
    label: "Mark Resolved",
    hint: "Close this NDR case as resolved.",
  },
];

export default function NDRPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [currentPage, setCurrentPage] = useState(1);

  // Action dialog state
  const [actionCase, setActionCase] = useState<NDRCase | null>(null);
  const [selectedAction, setSelectedAction] =
    useState<NDRActionType>("REATTEMPT_DELIVERY");
  const [actionNotes, setActionNotes] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: "Non-Delivery Reports" },
  ];

  const queryParams = useMemo(
    () => ({
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      ...(statusFilter !== ALL_STATUSES
        ? { status: statusFilter as NDRStatusValue }
        : {}),
    }),
    [currentPage, statusFilter],
  );

  const { data, isLoading, isFetching, error, refetch } =
    useGetNDRCasesQuery(queryParams);

  const [takeNDRAction, { isLoading: isSubmittingAction }] =
    useTakeNDRActionMutation();

  const ndrCases = data?.data?.ndrCases ?? [];
  const pagination = data?.data?.pagination;
  const statusDistribution = data?.data?.summary?.statusDistribution ?? [];

  const totalPages = pagination?.pages ?? 0;
  const totalRecords = pagination?.total ?? 0;

  // Stat cards come from the server-side groupBy so they reflect every case,
  // not just the rows on the current page.
  const countFor = (statuses: NDRStatusValue[]) =>
    statusDistribution
      .filter((entry) => statuses.includes(entry.status))
      .reduce((sum, entry) => sum + entry.count, 0);

  const openCount = countFor(["OPEN", "ASSIGNED"]);
  const inProgressCount = countFor([
    "IN_PROGRESS",
    "REATTEMPT_SCHEDULED",
    "ADDRESS_UPDATED",
  ]);
  const resolvedCount = countFor(["RESOLVED", "CLOSED"]);
  const rtoCount = countFor(["RTO_INITIATED"]);

  // The backend has no free-text search on NDR cases, so filter the current
  // page client-side and label it as such in the table caption.
  const visibleCases = searchTerm
    ? ndrCases.filter((ndrCase) => {
        const haystack = [
          ndrCase.shipment?.awbNumber,
          ndrCase.shipment?.orderId,
          ndrCase.shipment?.deliveryName,
          ndrCase.reason,
          ndrCase.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      })
    : ndrCases;

  const handlePageChange = (page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) return;
    setCurrentPage(page);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const openActionDialog = (ndrCase: NDRCase) => {
    setActionCase(ndrCase);
    setSelectedAction("REATTEMPT_DELIVERY");
    setActionNotes("");
    setPreferredDate("");
    setActionError(null);
  };

  const handleSubmitAction = async () => {
    if (!actionCase) return;

    setActionError(null);

    try {
      await takeNDRAction({
        ndrCaseId: actionCase.id,
        action: selectedAction,
        ...(actionNotes.trim() ? { notes: actionNotes.trim() } : {}),
        // Only a reattempt can carry a preferred date
        ...(selectedAction === "REATTEMPT_DELIVERY" && preferredDate
          ? { preferredDate: new Date(preferredDate).toISOString() }
          : {}),
      }).unwrap();

      setActionCase(null);
    } catch (err) {
      const message =
        (err as { data?: { error?: { message?: string } } })?.data?.error
          ?.message ?? "Failed to update the NDR case. Please try again.";
      setActionError(message);
    }
  };

  const handleExport = () => {
    if (visibleCases.length === 0) return;

    const headers = [
      "AWB",
      "Order ID",
      "Receiver",
      "Phone",
      "City",
      "Reason",
      "Status",
      "Priority",
      "Created At",
    ];

    const escape = (value: unknown) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = visibleCases.map((ndrCase) =>
      [
        ndrCase.shipment?.awbNumber ?? "",
        ndrCase.shipment?.orderId ?? "",
        ndrCase.shipment?.deliveryName ?? "",
        ndrCase.shipment?.deliveryPhone ?? "",
        ndrCase.shipment?.deliveryCity ?? "",
        ndrCase.reason,
        ndrCase.status,
        ndrCase.priority,
        ndrCase.createdAt,
      ]
        .map(escape)
        .join(","),
    );

    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ndr-cases-page-${currentPage}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const statCards = [
    {
      label: "Total NDRs",
      value: totalRecords,
      icon: <AlertTriangle className="h-8 w-8 text-blue-600" />,
    },
    {
      label: "Open",
      value: openCount,
      dotClass: "bg-yellow-100",
      innerClass: "bg-yellow-600",
    },
    {
      label: "In Progress",
      value: inProgressCount,
      dotClass: "bg-indigo-100",
      innerClass: "bg-indigo-600",
    },
    {
      label: "Resolved",
      value: resolvedCount,
      dotClass: "bg-green-100",
      innerClass: "bg-green-600",
    },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-logistics-600" />
              <span>Non-Delivery Reports</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage and track non-delivery reports for your shipments
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
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
            <Button
              variant="outline"
              size="sm"
              className="px-3"
              onClick={handleExport}
              disabled={visibleCases.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          </div>
        </div>

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

        {/* RTO callout - only when there are RTO cases to act on */}
        {rtoCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {rtoCount} shipment{rtoCount === 1 ? " is" : "s are"} currently in
              Return to Origin.
            </AlertDescription>
          </Alert>
        )}

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>NDR Management</span>
                </CardTitle>
                <CardDescription>
                  View and manage all non-delivery reports for your shipments
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search AWB, receiver, or reason..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={handleStatusFilterChange}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                    {NDR_STATUS_VALUES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatEnumLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                <p className="text-lg font-medium text-foreground">
                  Failed to load NDR cases
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
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : visibleCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-lg font-medium text-foreground">
                  No NDR cases found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm || statusFilter !== ALL_STATUSES
                    ? "Try adjusting your search or filters."
                    : "Non-delivery reports will appear here once couriers report failed deliveries."}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableCaption>
                      {searchTerm
                        ? `Filtered NDR cases on this page for "${searchTerm}"`
                        : "A list of all non-delivery reports"}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>AWB / Order</TableHead>
                        <TableHead>Receiver</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleCases.map((ndrCase) => (
                        <TableRow key={ndrCase.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{ndrCase.shipment?.awbNumber ?? "-"}</div>
                              <div className="text-sm text-muted-foreground">
                                {ndrCase.shipment?.orderId ?? ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {ndrCase.shipment?.deliveryName ?? "-"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {ndrCase.shipment?.deliveryCity ?? ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {formatEnumLabel(ndrCase.reason)}
                              </div>
                              {ndrCase.description && (
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {ndrCase.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={getNDRStatusColor(ndrCase.status)}
                            >
                              {formatEnumLabel(ndrCase.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={getNDRPriorityColor(ndrCase.priority)}
                            >
                              {formatEnumLabel(ndrCase.priority)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDateTime(ndrCase.createdAt)}
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
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openActionDialog(ndrCase)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Take Action
                                </DropdownMenuItem>
                                {ndrCase.shipmentId && (
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/shipments/${ndrCase.shipmentId}`}
                                    >
                                      <Package className="mr-2 h-4 w-4" />
                                      View Shipment
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination - server-side */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Page {pagination?.page ?? currentPage} of {totalPages} (
                      {totalRecords} total)
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

      {/* Take Action dialog */}
      <Dialog
        open={actionCase !== null}
        onOpenChange={(open) => !open && setActionCase(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take action on NDR case</DialogTitle>
            <DialogDescription>
              {actionCase?.shipment?.awbNumber
                ? `AWB ${actionCase.shipment.awbNumber} - ${formatEnumLabel(actionCase.reason)}`
                : "Update this non-delivery report"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={selectedAction}
                onValueChange={(value) =>
                  setSelectedAction(value as NDRActionType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NDR_ACTIONS.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {NDR_ACTIONS.find((a) => a.value === selectedAction)?.hint}
              </p>
            </div>

            {selectedAction === "REATTEMPT_DELIVERY" && (
              <div className="space-y-2">
                <Label htmlFor="preferredDate">
                  Preferred reattempt date (optional)
                </Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setPreferredDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="actionNotes">Notes (optional)</Label>
              <Textarea
                id="actionNotes"
                placeholder="Add context for this action..."
                value={actionNotes}
                maxLength={500}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionCase(null)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitAction} disabled={isSubmittingAction}>
              {isSubmittingAction ? "Submitting..." : "Submit action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
