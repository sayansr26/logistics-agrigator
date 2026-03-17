"use client";

import { useState, useCallback } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetShipmentsQuery,
  useCancelShipmentMutation,
} from "@/store/api/endpoints/shipmentApi";
import type {
  Shipment,
  GetShipmentsParams,
} from "@/store/api/endpoints/shipmentApi";
import {
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
  Upload,
  Truck,
  Download,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-800",
  BOOKED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-indigo-100 text-indigo-800",
  IN_TRANSIT: "bg-yellow-100 text-yellow-800",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RTO: "bg-pink-100 text-pink-800",
  NDR: "bg-purple-100 text-purple-800",
  HOLD: "bg-amber-100 text-amber-800",
};

const PAYMENT_COLORS: Record<string, string> = {
  PREPAID: "bg-blue-100 text-blue-800",
  COD: "bg-amber-100 text-amber-800",
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatStatus(s: string) {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function ShipmentsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const limit = 10;

  const params: GetShipmentsParams = {
    page: currentPage,
    limit,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
  };

  const { data, isLoading, isFetching, error, refetch } =
    useGetShipmentsQuery(params);
  const [cancelShipment] = useCancelShipmentMutation();

  const shipments = data?.data?.shipments || [];
  const pagination = data?.data?.pagination;
  const totalCount = pagination?.totalCount || 0;
  const totalPages = pagination?.totalPages || 1;

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this shipment?")) return;
    try {
      await cancelShipment(id).unwrap();
    } catch {
      // RTK Query handles error
    }
  };

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments" },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Package className="h-8 w-8 text-logistics-600" />
              <span>All Shipments</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Track and manage all your shipments in one place
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments/track">
                <Truck className="h-3.5 w-3.5 mr-1.5" />
                Track
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments/ndr">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                NDR
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments/bulk">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Bulk
              </Link>
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/shipments/create">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Shipment
              </Link>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Shipments
                  </p>
                  <p className="text-2xl font-bold">
                    {isLoading ? "—" : totalCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {(["DELIVERED", "IN_TRANSIT", "CREATED"] as const).map((st, i) => {
            const colors = ["green", "blue", "orange"];
            const labels = ["Delivered", "In Transit", "Pending"];
            const c = colors[i];
            return (
              <Card key={st}>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`h-8 w-8 bg-${c}-100 rounded-full flex items-center justify-center`}
                    >
                      <div className={`h-4 w-4 bg-${c}-600 rounded-full`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {labels[i]}
                      </p>
                      <p className="text-2xl font-bold">
                        {isLoading
                          ? "—"
                          : shipments.filter((s: Shipment) => s.status === st)
                              .length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Shipments Management</span>
                </CardTitle>
                <CardDescription>
                  Track and manage all shipments in your logistics network
                </CardDescription>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search AWB, Order, Name..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 w-60"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
                      <Filter className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setStatusFilter(undefined);
                        setCurrentPage(1);
                      }}
                    >
                      All
                    </DropdownMenuItem>
                    {Object.keys(STATUS_COLORS).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => {
                          setStatusFilter(s);
                          setCurrentPage(1);
                        }}
                      >
                        {formatStatus(s)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="px-3">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-3"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
            {statusFilter && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Filtered:</span>
                <Badge variant="secondary" className="text-xs">
                  {formatStatus(statusFilter)}
                  <button
                    className="ml-1.5"
                    onClick={() => {
                      setStatusFilter(undefined);
                      setCurrentPage(1);
                    }}
                  >
                    x
                  </button>
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                <p className="text-lg font-medium text-foreground">
                  Failed to load shipments
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
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : shipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-lg font-medium text-foreground">
                  No shipments found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm || statusFilter
                    ? "Try adjusting your filters."
                    : "Create your first shipment to get started."}
                </p>
                {!searchTerm && !statusFilter && (
                  <Button size="sm" className="mt-4" asChild>
                    <Link href="/shipments/create">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Shipment
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Pickup &amp; Delivery</TableHead>
                      <TableHead>Status &amp; Partner</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((shipment: Shipment) => (
                      <TableRow
                        key={shipment.id}
                        className={isFetching ? "opacity-60" : ""}
                      >
                        <TableCell className="font-medium">
                          <div className="text-sm">
                            <div>{shipment.awbNumber || "Pending AWB"}</div>
                            <div className="text-muted-foreground text-xs">
                              Ref: {shipment.orderId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="text-xs text-muted-foreground">
                              {shipment.pickupCity}, {shipment.pickupState} (
                              {shipment.pickupPincode})
                              {shipment.pickupName && (
                                <span className="font-medium ml-1">
                                  {shipment.pickupName.split(" ")[0]}
                                </span>
                              )}
                            </div>
                            <div className="border-t border-gray-300 dark:border-gray-600 my-1" />
                            <div className="text-xs text-muted-foreground">
                              {shipment.deliveryCity}, {shipment.deliveryState}{" "}
                              ({shipment.deliveryPincode})
                              {shipment.deliveryName && (
                                <span className="font-medium ml-1">
                                  {shipment.deliveryName.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <Badge
                              className={
                                STATUS_COLORS[shipment.status] ||
                                "bg-gray-100 text-gray-800"
                              }
                            >
                              {formatStatus(shipment.status)}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {shipment.partnerName || "Unassigned"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>
                            <div className="font-medium">
                              {formatDate(shipment.createdAt)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {formatTime(shipment.createdAt)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              PAYMENT_COLORS[shipment.paymentType || ""] ||
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {shipment.paymentType || "—"}
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
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/shipments/${shipment.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/shipments/${shipment.id}/edit`)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" /> Edit Shipment
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleCancel(shipment.id)}
                                disabled={
                                  shipment.status === "CANCELLED" ||
                                  shipment.status === "DELIVERED"
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Cancel
                                Shipment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages} ({totalCount} total)
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1 || isFetching}
                      >
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage >= totalPages || isFetching}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
