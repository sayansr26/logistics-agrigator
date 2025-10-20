"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useGetServicesQuery,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
  type Service,
} from "@/store/api/endpoints/serviceApi";
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
  Package,
  CreditCard,
  MapPin,
  Sparkles,
  IndianRupee,
  X,
  AlertCircle,
} from "lucide-react";

// Helper function to get category icon
const getCategoryIcon = (category: string) => {
  switch (category) {
    case "LOGISTICS":
      return <Package className="h-4 w-4" />;
    case "PAYMENT":
      return <CreditCard className="h-4 w-4" />;
    case "LOCATION":
      return <MapPin className="h-4 w-4" />;
    case "SPECIAL":
      return <Sparkles className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
};

// Helper function to get category color
const getCategoryColor = (category: string) => {
  switch (category) {
    case "LOGISTICS":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "PAYMENT":
      return "bg-green-100 text-green-800 border-green-200";
    case "LOCATION":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "SPECIAL":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function ServiceTypesPage() {
  const router = useRouter();
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Service Types" },
  ];

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const itemsPerPage = 20;

  // RTK Query - Fetch service types from API
  const {
    data: servicesData,
    isLoading,
    error,
    refetch,
  } = useGetServicesQuery({
    page: currentPage,
    limit: itemsPerPage,
    status: statusFilter === "all" ? "ALL" : statusFilter.toUpperCase(),
    category:
      categoryFilter === "all" ? undefined : categoryFilter.toUpperCase(),
  });

  const services = servicesData?.data || [];
  const totalCount = servicesData?.meta?.pagination?.totalCount || 0;
  const totalPages = servicesData?.meta?.pagination?.totalPages || 1;

  // Calculate statistics
  const activeServices = services.filter((s: Service) => s.isAvailable).length;
  const inactiveServices = services.filter(
    (s: Service) => !s.isAvailable,
  ).length;

  // Category breakdown
  const categoryStats = {
    LOGISTICS: services.filter((s: Service) => s.category === "LOGISTICS")
      .length,
    PAYMENT: services.filter((s: Service) => s.category === "PAYMENT").length,
    LOCATION: services.filter((s: Service) => s.category === "LOCATION").length,
    SPECIAL: services.filter((s: Service) => s.category === "SPECIAL").length,
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCategoryFilterChange = (category: string) => {
    setCategoryFilter(category);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const clearAllFilters = () => {
    setCategoryFilter("all");
    setStatusFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    categoryFilter !== "all" || statusFilter !== "all" || searchTerm !== "";

  // Filter services by search term (client-side)
  const filteredServices = services.filter((service: Service) => {
    const matchesSearch =
      searchTerm === "" ||
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.description?.toLowerCase() || "").includes(
        searchTerm.toLowerCase(),
      );
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
              <p className="text-muted-foreground">Loading service types...</p>
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
                    Failed to Load Service Types
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(error as any)?.data?.error?.message ||
                      "An error occurred while fetching service types"}
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
              Service Types Management
            </h1>
            <p className="text-muted-foreground">
              Configure logistics service types with pricing and availability
            </p>
          </div>
          <Button disabled className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Service Type</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Settings className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Service Types
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
                  <div className="h-4 w-4 bg-green-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active
                  </p>
                  <p className="text-2xl font-bold">{activeServices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-gray-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Inactive
                  </p>
                  <p className="text-2xl font-bold">{inactiveServices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-purple-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Categories
                  </p>
                  <p className="text-2xl font-bold">
                    {Object.values(categoryStats).filter((v) => v > 0).length}
                  </p>
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
                  <Settings className="h-5 w-5" />
                  <span>Service Types Management</span>
                </CardTitle>
                <CardDescription>
                  Search, filter, and manage service type configurations
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search service types..."
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
              <div className="space-y-6 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Category Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-blue-100 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700">
                      Filter by Category
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={categoryFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCategoryFilterChange("all")}
                      className={`transition-all duration-200 ${
                        categoryFilter === "all"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                          : "hover:bg-gray-50 border-gray-300"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      All Categories
                    </Button>
                    <Button
                      variant={
                        categoryFilter === "logistics" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleCategoryFilterChange("logistics")}
                      className={`transition-all duration-200 ${
                        categoryFilter === "logistics"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                          : "hover:bg-blue-50 border-blue-300 text-blue-700"
                      }`}
                    >
                      <Package className="h-3 w-3 mr-2" />
                      Logistics
                    </Button>
                    <Button
                      variant={
                        categoryFilter === "payment" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleCategoryFilterChange("payment")}
                      className={`transition-all duration-200 ${
                        categoryFilter === "payment"
                          ? "bg-green-600 hover:bg-green-700 text-white shadow-md"
                          : "hover:bg-green-50 border-green-300 text-green-700"
                      }`}
                    >
                      <CreditCard className="h-3 w-3 mr-2" />
                      Payment
                    </Button>
                    <Button
                      variant={
                        categoryFilter === "location" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleCategoryFilterChange("location")}
                      className={`transition-all duration-200 ${
                        categoryFilter === "location"
                          ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                          : "hover:bg-purple-50 border-purple-300 text-purple-700"
                      }`}
                    >
                      <MapPin className="h-3 w-3 mr-2" />
                      Location
                    </Button>
                    <Button
                      variant={
                        categoryFilter === "special" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleCategoryFilterChange("special")}
                      className={`transition-all duration-200 ${
                        categoryFilter === "special"
                          ? "bg-orange-600 hover:bg-orange-700 text-white shadow-md"
                          : "hover:bg-orange-50 border-orange-300 text-orange-700"
                      }`}
                    >
                      <Sparkles className="h-3 w-3 mr-2" />
                      Special
                    </Button>
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-green-100 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-green-600 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700">
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
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
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
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      Inactive
                    </Button>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {hasActiveFilters && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Active Filters:
                      </span>
                      {categoryFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-800"
                        >
                          Category: {categoryFilter}
                        </Badge>
                      )}
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
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {filteredServices.length} service type
                  {filteredServices.length !== 1 ? "s" : ""} found
                </span>
                {hasActiveFilters && (
                  <span className="text-xs text-blue-600">
                    (filtered from {totalCount} total)
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Service Types Table */}
            <ServiceTypesTable
              services={filteredServices}
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

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    ),
                  )}

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
      </div>
    </DashboardLayout>
  );
}

interface ServiceTypesTableProps {
  services: Service[];
  searchTerm: string;
}

function ServiceTypesTable({ services, searchTerm }: ServiceTypesTableProps) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered service types for &quot;${searchTerm}&quot;`
          : "A list of all service types"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Display Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Base Charge</TableHead>
          <TableHead>Sort Order</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-12">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Settings className="h-12 w-12 mb-4" />
                <p className="text-lg font-semibold">No service types found</p>
                <p className="text-sm mt-2">
                  {searchTerm
                    ? "Try adjusting your search or filters"
                    : "No service types available"}
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          services.map((service) => (
            <ServiceTypeRow key={service.id} service={service} />
          ))
        )}
      </TableBody>
    </Table>
  );
}

// Service Type Row Component
function ServiceTypeRow({ service }: { service: Service }) {
  const [updateService, { isLoading: isUpdating }] = useUpdateServiceMutation();
  const [deleteService, { isLoading: isDeleting }] = useDeleteServiceMutation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleToggleStatus = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmToggleStatus = async () => {
    try {
      await updateService({
        id: service.id,
        data: { isAvailable: !service.isAvailable },
      }).unwrap();
      setShowConfirmDialog(false);
    } catch (error) {
      console.error("Failed to update service type:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteService(service.id).unwrap();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete service type:", error);
    }
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
              {getCategoryIcon(service.category)}
            </div>
            <div className="font-medium font-mono text-sm">{service.name}</div>
          </div>
        </TableCell>
        <TableCell>{service.displayName}</TableCell>
        <TableCell>
          <Badge className={getCategoryColor(service.category)}>
            {service.category}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            className={
              service.isAvailable
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-gray-100 text-gray-800 border-gray-200"
            }
          >
            <div className="h-2 w-2 rounded-full bg-current mr-1"></div>
            {service.isAvailable ? "Active" : "Inactive"}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-1">
            <IndianRupee className="h-3 w-3 text-muted-foreground" />
            <span>{service.baseCharge}</span>
          </div>
        </TableCell>
        <TableCell>{service.sortOrder}</TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem disabled>
                <Edit className="mr-2 h-4 w-4" />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-yellow-600"
                onClick={handleToggleStatus}
                disabled={isUpdating}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {service.isAvailable ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Service Type
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
              {service.isAvailable ? (
                <div className="space-y-3">
                  <p className="text-base">
                    Are you sure you want to{" "}
                    <span className="font-semibold text-yellow-700">
                      deactivate
                    </span>{" "}
                    this service type?
                  </p>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">
                      {service.displayName} ({service.name})
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Warning:</strong> This service type will be
                      unavailable for new shipments.
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
                    this service type?
                  </p>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium">
                      {service.displayName} ({service.name})
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      This service type will be available for new shipments.
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
              variant={service.isAvailable ? "destructive" : "default"}
              onClick={handleConfirmToggleStatus}
              disabled={isUpdating}
              className={
                service.isAvailable
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
                <>
                  {service.isAvailable
                    ? "Deactivate Service Type"
                    : "Activate Service Type"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  Are you sure you want to delete this service type?
                </p>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">
                    {service.displayName} ({service.name})
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Category: {service.category}
                  </p>
                </div>
                <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg">
                  <p className="text-sm text-red-900 font-semibold mb-2">
                    ⚠️ Warning: This action will soft-delete the service type!
                  </p>
                  <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                    <li>The service type will be marked as unavailable</li>
                    <li>It will not appear in active service type lists</li>
                    <li>Historical data will be preserved</li>
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
                  Delete Service Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
