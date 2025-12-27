"use client";

import { useState, useMemo } from "react";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetOutletsQuery,
  useDeleteOutletMutation,
} from "@/store/api/endpoints/customerApi";
import {
  Store,
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
  Download,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  TrendingUp,
  Users,
  UserCheck,
  Package,
  Building2,
  ShoppingCart,
  Warehouse,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

// Helper functions for outlet display
const getOutletStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200";
    case "inactive":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "suspended":
      return "bg-red-100 text-red-800 border-red-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getOutletTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case "retail":
      return "text-blue-600 border-blue-200";
    case "wholesale":
      return "text-purple-600 border-purple-200";
    case "franchise":
      return "text-orange-600 border-orange-200";
    case "warehouse":
      return "text-green-600 border-green-200";
    case "distributor":
      return "text-indigo-600 border-indigo-200";
    default:
      return "text-gray-600 border-gray-200";
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export default function OutletsPage() {
  const router = useRouter();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // RTK Query - Fetch outlets from API
  const {
    data: outletsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetOutletsQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm || undefined,
  });

  const [deleteOutlet, { isLoading: isDeleting }] = useDeleteOutletMutation();

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets" },
  ];

  // Get outlets from response (handle both { outlets } and { customers } shapes)
  const outlets = useMemo(() => {
    return outletsResponse?.data?.outlets || outletsResponse?.data?.customers || [];
  }, [outletsResponse]);

  const pagination = outletsResponse?.data?.pagination || {
    page: 1,
    limit: itemsPerPage,
    total: 0,
    totalPages: 0,
  };

  // Calculate statistics from loaded outlets
  const totalOutlets = pagination.total || outlets.length;
  const activeOutlets = outlets.filter((o) => o.isActive || o.outletStatus === "active").length;

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleDeleteOutlet = async (outletId, outletName) => {
    if (window.confirm(`Are you sure you want to deactivate outlet "${outletName}"?`)) {
      try {
        await deleteOutlet(outletId).unwrap();
        toast.success({
          title: "Outlet Deactivated",
          description: `Outlet "${outletName}" has been deactivated successfully.`,
        });
        refetch();
      } catch (err) {
        toast.error({
          title: "Failed to Deactivate",
          description: err.data?.message || err.message || "An error occurred",
        });
      }
    }
  };

  const getOutletTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case "retail":
        return <Store className="h-4 w-4" />;
      case "wholesale":
        return <Warehouse className="h-4 w-4" />;
      case "ecommerce":
        return <ShoppingCart className="h-4 w-4" />;
      case "franchise":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Store className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <Store className="h-8 w-8 text-logistics-600" />
              <span>Outlet Management</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage and monitor all your retail outlets and distribution
              centers
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button variant="outline" size="sm" asChild>
              <Link href="/outlets/analytics">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Analytics
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/outlets/bulk">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Bulk Import
              </Link>
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/outlets/add">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Outlet
              </Link>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Store className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Total Outlets
                  </div>
                  <div className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : totalOutlets}
                  </div>
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
                  <div className="text-sm font-medium text-muted-foreground">
                    Active Outlets
                  </div>
                  <div className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : activeOutlets}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Package className="h-8 w-8 text-purple-600" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    B2B Customers
                  </div>
                  <div className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : outlets.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Pages
                  </div>
                  <div className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : pagination.totalPages}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Store className="h-5 w-5" />
                  <span>Outlets Management</span>
                </CardTitle>
                <CardDescription>
                  Manage and monitor all your retail outlets and distribution
                  centers
                </CardDescription>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search outlets..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 w-56"
                  />
                </div>
                <Button variant="outline" size="sm" className="px-2">
                  <Filter className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="px-3">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="px-3"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Error State */}
            {isError && (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load outlets</h3>
                <p className="text-muted-foreground mb-4">
                  {error?.data?.message || "An error occurred while fetching outlets"}
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && outlets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Store className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No outlets found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm 
                    ? `No outlets match "${searchTerm}". Try a different search.`
                    : "Get started by adding your first outlet."}
                </p>
                <Button asChild>
                  <Link href="/outlets/add">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Outlet
                  </Link>
                </Button>
              </div>
            )}

            {/* Data Table */}
            {!isLoading && !isError && outlets.length > 0 && (
              <Table>
                <TableCaption>
                  {searchTerm
                    ? `Filtered outlets for "${searchTerm}"`
                    : "A list of all registered outlets (B2B customers)"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet Details</TableHead>
                    <TableHead>Contact Information</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status & Type</TableHead>
                    <TableHead>Business Info</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outlets.map((outlet) => (
                    <TableRow key={outlet.id}>
                      <TableCell className="font-medium">
                        <div className="text-sm">
                          <div className="font-semibold">{outlet.outletName || outlet.name}</div>
                          <div className="text-muted-foreground text-xs">
                            Code: {outlet.outletCode || 'N/A'}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Retailer: {outlet.retailerName || outlet.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{outlet.contactPerson || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{outlet.phone || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{outlet.email || 'N/A'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {outlet.city || 'N/A'}{outlet.state ? `, ${outlet.state}` : ''}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {outlet.address || 'No address'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            PIN: {outlet.pincode || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <Badge className={getOutletStatusColor(outlet.outletStatus || (outlet.isActive ? 'active' : 'inactive'))}>
                            {outlet.outletStatus || (outlet.isActive ? 'Active' : 'Inactive')}
                          </Badge>
                          <div className="flex items-center space-x-1">
                            {getOutletTypeIcon(outlet.outletType)}
                            <Badge
                              variant="outline"
                              className={getOutletTypeColor(outlet.outletType)}
                            >
                              {outlet.outletType || 'OUTLET'}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="text-xs">
                            GST: {outlet.gstNumber || 'N/A'}
                          </div>
                          <div className="text-xs">
                            PAN: {outlet.panNumber || 'N/A'}
                          </div>
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
                            <DropdownMenuItem
                              onClick={() => router.push(`/outlets/${outlet.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/outlets/${outlet.id}/edit`)
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Outlet
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/outlets/${outlet.id}/users`)}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Manage Users
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/outlets/${outlet.id}/customers`)}
                            >
                              <UserCheck className="mr-2 h-4 w-4" />
                              Manage Customers
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Package className="mr-2 h-4 w-4" />
                              View Shipments
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteOutlet(outlet.id, outlet.outletName || outlet.name)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Deactivate Outlet
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
            {!isLoading && !isError && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total outlets)
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {/* Show limited page numbers */}
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoading}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages || isLoading}
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
    </DashboardLayout>
  );
}
