"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  PageHeader,
  PageContainer,
  StatsCard,
  StatsGrid,
  DataTablePagination,
} from "@/components/shared";
import {
  Globe,
  MapPin,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Search,
  Filter,
  Route,
  Loader2,
  X,
  MoreHorizontal,
  Eye,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useGetZonesQuery,
  useDeleteZoneMutation,
} from "@/store/api/endpoints/zonesApi";

export default function ZonesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const itemsPerPage = 10;

  // RTK Query
  const {
    data: zonesResponse,
    isLoading,
    error,
    refetch,
  } = useGetZonesQuery({
    page: currentPage,
    limit: itemsPerPage,
    zoneType: filterType !== "all" ? filterType : undefined,
    status:
      filterStatus !== "all"
        ? filterStatus === "active"
          ? true
          : false
        : undefined,
    search: searchTerm || undefined,
  });

  const [deleteZone, { isLoading: isDeleting }] = useDeleteZoneMutation();

  // Extract zones from response
  const zones = zonesResponse?.data?.zones || [];
  const totalZones = zonesResponse?.data?.pagination?.total || 0;
  const totalPages = zonesResponse?.data?.pagination?.totalPages || 1;

  // Calculate stats
  const activeZones = zones.filter((z) => z.status === true).length;
  const inactiveZones = zones.filter((z) => z.status === false).length;
  const distanceZones = zones.filter((z) => z.zoneType === "DISTANCE").length;
  const geologicalZones = zones.filter(
    (z) => z.zoneType === "GEOLOGICAL",
  ).length;

  const hasActiveFilters =
    filterType !== "all" || filterStatus !== "all" || searchTerm;

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setCurrentPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!selectedZone) return;
    try {
      await deleteZone(selectedZone.id).unwrap();
      setShowDeleteDialog(false);
      setSelectedZone(null);
    } catch (err) {
      console.error("Failed to delete zone:", err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading zones...</p>
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
            <h3 className="text-lg font-semibold mb-2">Failed to Load Zones</h3>
            <p className="text-muted-foreground mb-4">
              An error occurred while loading zones
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
        {/* Page Header */}
        <PageHeader
          title="Zone Management"
          description="Manage delivery zones, distance milestones, and geographical coverage"
          actions={
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync
            </Button>
          }
          primaryAction={{
            label: "Add Zone",
            href: "/zones/create",
          }}
        />

        {/* Statistics Cards */}
        <StatsGrid columns={4}>
          <StatsCard
            title="Total Zones"
            value={totalZones}
            icon={Globe}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Active Zones"
            value={activeZones}
            icon={CheckCircle}
            iconColor="text-green-600"
          />
          <StatsCard
            title="Distance Zones"
            value={distanceZones}
            icon={Route}
            iconColor="text-purple-600"
          />
          <StatsCard
            title="Geological Zones"
            value={geologicalZones}
            icon={MapPin}
            iconColor="text-orange-600"
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
                  placeholder="Search zones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Type Filter */}
              <div className="flex gap-2">
                <Button
                  variant={filterType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterType("all");
                    setCurrentPage(1);
                  }}
                >
                  All
                </Button>
                <Button
                  variant={filterType === "DISTANCE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterType("DISTANCE");
                    setCurrentPage(1);
                  }}
                >
                  <Route className="mr-1 h-3 w-3" />
                  Distance
                </Button>
                <Button
                  variant={filterType === "GEOLOGICAL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterType("GEOLOGICAL");
                    setCurrentPage(1);
                  }}
                >
                  <MapPin className="mr-1 h-3 w-3" />
                  Geological
                </Button>
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterStatus("all");
                    setCurrentPage(1);
                  }}
                >
                  All Status
                </Button>
                <Button
                  variant={filterStatus === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterStatus("active");
                    setCurrentPage(1);
                  }}
                >
                  Active
                </Button>
                <Button
                  variant={filterStatus === "inactive" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterStatus("inactive");
                    setCurrentPage(1);
                  }}
                >
                  Inactive
                </Button>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Zones Table */}
        <Card>
          <CardContent className="p-0">
            {zones.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  {hasActiveFilters
                    ? "No zones match your filters"
                    : "No zones configured"}
                </p>
                <p className="text-sm mb-4">
                  {hasActiveFilters
                    ? "Try adjusting your filters"
                    : "Create your first delivery zone"}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={() => router.push("/zones/create")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Zone
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Milestones</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                            {zone.zoneType === "DISTANCE" ? (
                              <Route className="h-5 w-5 text-blue-600" />
                            ) : (
                              <MapPin className="h-5 w-5 text-orange-600" />
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/zones/${zone.id}`}
                              className="font-medium hover:underline"
                            >
                              {zone.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              ID: {zone.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            zone.zoneType === "DISTANCE"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {zone.zoneType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="max-w-xs truncate text-sm text-muted-foreground">
                          {zone.description || "No description"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {zone.zoneType === "DISTANCE" && zone.milestones ? (
                          <div className="flex flex-wrap gap-1">
                            {zone.milestones.slice(0, 2).map((m) => (
                              <Badge
                                key={m.id}
                                variant="outline"
                                className="text-xs"
                              >
                                {m.suffix}: {m.minKm}-{m.maxKm}km
                              </Badge>
                            ))}
                            {zone.milestones.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{zone.milestones.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {zone.status ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
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
                              onClick={() => router.push(`/zones/${zone.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/zones/${zone.id}/edit`)
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Zone
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedZone(zone);
                                setShowDeleteDialog(true);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Zone
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalZones}
            pageSize={itemsPerPage}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Zone</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "
                <strong>{selectedZone?.name}</strong>"? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Zone
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}
