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
  TableCaption,
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
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const itemsPerPage = 10;

  // RTK Query - automatically handles auth via baseApi
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

  // Check if filters are active
  const hasActiveFilters =
    filterType !== "all" || filterStatus !== "all" || searchTerm;

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleTypeFilterChange = (type) => {
    setFilterType(type);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setCurrentPage(1);
  };

  const openDeleteDialog = (zone) => {
    setSelectedZone(zone);
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setSelectedZone(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedZone) return;

    try {
      await deleteZone(selectedZone.id).unwrap();
      closeDeleteDialog();
    } catch (err) {
      console.error("Failed to delete zone:", err);
      alert(
        "Failed to delete zone: " + (err.data?.error?.message || err.message),
      );
    }
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[
        { title: "Home", href: "/" },
        { title: "Zone Management" },
      ]}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Globe className="h-8 w-8 text-blue-600" />
              <span>Zone Management</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage delivery zones, distance milestones, and geographical
              coverage for efficient logistics operations.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Zones
            </Button>
            <Button size="sm" onClick={() => router.push("/zones/create")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Zone
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Globe className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Zones
                  </p>
                  <p className="text-2xl font-bold">{totalZones}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Zones
                  </p>
                  <p className="text-2xl font-bold">{activeZones}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Route className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Distance Zones
                  </p>
                  <p className="text-2xl font-bold">{distanceZones}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Geological Zones
                  </p>
                  <p className="text-2xl font-bold">{geologicalZones}</p>
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
                  <Globe className="h-5 w-5" />
                  <span>Zone Management</span>
                </CardTitle>
                <CardDescription>
                  Search, filter, and manage delivery zones across the platform
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search zones..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    className={`pl-10 w-64 transition-all duration-200 ${
                      isSearchFocused
                        ? "ring-2 ring-blue-500 dark:ring-blue-600 border-blue-500 dark:border-blue-600"
                        : ""
                    }`}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                {/* Zone Type Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-purple-600 dark:bg-purple-400 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filter by Zone Type
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={filterType === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTypeFilterChange("all")}
                      className={`transition-all duration-200 ${
                        filterType === "all"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                          : "hover:bg-gray-50 border-gray-300"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      All Types
                    </Button>
                    <Button
                      variant={
                        filterType === "DISTANCE" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleTypeFilterChange("DISTANCE")}
                      className={`transition-all duration-200 ${
                        filterType === "DISTANCE"
                          ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                          : "hover:bg-purple-50 border-purple-300 text-purple-700"
                      }`}
                    >
                      <Route className="h-3 w-3 mr-2" />
                      Distance
                    </Button>
                    <Button
                      variant={
                        filterType === "GEOLOGICAL" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleTypeFilterChange("GEOLOGICAL")}
                      className={`transition-all duration-200 ${
                        filterType === "GEOLOGICAL"
                          ? "bg-orange-600 hover:bg-orange-700 text-white shadow-md"
                          : "hover:bg-orange-50 border-orange-300 text-orange-700"
                      }`}
                    >
                      <MapPin className="h-3 w-3 mr-2" />
                      Geological
                    </Button>
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filter by Status
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={filterStatus === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusFilterChange("all")}
                      className={`transition-all duration-200 ${
                        filterStatus === "all"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                          : "hover:bg-gray-50 border-gray-300"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      All Status
                    </Button>
                    <Button
                      variant={
                        filterStatus === "active" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleStatusFilterChange("active")}
                      className={`transition-all duration-200 ${
                        filterStatus === "active"
                          ? "bg-green-600 hover:bg-green-700 text-white shadow-md"
                          : "hover:bg-green-50 border-green-300 text-green-700"
                      }`}
                    >
                      <CheckCircle className="h-3 w-3 mr-2" />
                      Active
                    </Button>
                    <Button
                      variant={
                        filterStatus === "inactive" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleStatusFilterChange("inactive")}
                      className={`transition-all duration-200 ${
                        filterStatus === "inactive"
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-md"
                          : "hover:bg-red-50 border-red-300 text-red-700"
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
                      <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Active Filters:
                      </span>
                      {filterType !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300"
                        >
                          Type: {filterType}
                        </Badge>
                      )}
                      {filterStatus !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300"
                        >
                          Status: {filterStatus}
                        </Badge>
                      )}
                      {searchTerm && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300"
                        >
                          Search: "{searchTerm}"
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
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {zones.length} zone{zones.length !== 1 ? "s" : ""} found
                </span>
                {hasActiveFilters && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    (filtered from {totalZones} total)
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Zones Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  Loading zones...
                </span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500 opacity-50" />
                <p className="text-lg font-medium mb-2 text-red-600">
                  Error loading zones
                </p>
                <p className="text-sm mb-4 text-muted-foreground">
                  {error?.data?.error?.message ||
                    error?.message ||
                    "Failed to fetch zones"}
                </p>
                <Button onClick={refetch} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  {hasActiveFilters
                    ? "No zones match your filters"
                    : "No zones configured"}
                </p>
                <p className="text-sm mb-4">
                  {hasActiveFilters
                    ? "Try adjusting your filters or search term"
                    : "Create your first delivery zone to start managing coverage areas and rates"}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={() => router.push("/zones/create")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Zone
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableCaption>
                  {searchTerm
                    ? `Filtered zones for "${searchTerm}"`
                    : "A list of all delivery zones"}
                </TableCaption>
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
                              <Route className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <MapPin className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{zone.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {zone.id.slice(0, 8)}...
                            </div>
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
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {zone.description || "No description"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {zone.zoneType === "DISTANCE" && zone.milestones ? (
                          <div className="flex flex-wrap gap-1">
                            {zone.milestones.slice(0, 3).map((milestone) => (
                              <Badge
                                key={milestone.id}
                                variant="outline"
                                className="text-xs"
                              >
                                {milestone.suffix}: {milestone.minKm}-
                                {milestone.maxKm}km
                              </Badge>
                            ))}
                            {zone.milestones.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{zone.milestones.length - 3} more
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
                        <Badge
                          variant={zone.status ? "success" : "secondary"}
                          className={
                            zone.status
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                          }
                        >
                          {zone.status ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
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
                              onClick={() => openDeleteDialog(zone)}
                              className="text-red-600 focus:text-red-600"
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

            {/* Pagination */}
            {totalPages > 1 && !isLoading && !error && (
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
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Zone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the zone "
              <strong>{selectedZone?.name}</strong>"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
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
    </DashboardLayout>
  );
}
