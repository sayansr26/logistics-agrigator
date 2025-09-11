"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
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
import {
  mockOutlets,
  getOutletStatusColor,
  getOutletTypeColor,
  formatCurrency,
} from "@/lib/mock-data";
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
  Clock,
  TrendingUp,
  Users,
  Package,
  Building2,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OutletsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets" },
  ];

  // Filter data based on search term
  const filteredOutlets = mockOutlets.filter(
    (outlet) =>
      outlet.outletCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      outlet.outletName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      outlet.retailerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      outlet.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      outlet.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      outlet.state.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Pagination logic
  const currentData = filteredOutlets;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = currentData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Calculate statistics
  const totalOutlets = mockOutlets.length;
  const activeOutlets = mockOutlets.filter((o) => o.status === "active").length;
  const totalShipments = mockOutlets.reduce(
    (sum, outlet) => sum + outlet.performance.totalShipments,
    0,
  );
  const totalRevenue = mockOutlets.reduce(
    (sum, outlet) => sum + outlet.performance.monthlyRevenue,
    0,
  );

  const getOutletTypeIcon = (type: string) => {
    switch (type) {
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Outlets
                  </p>
                  <p className="text-2xl font-bold">{totalOutlets}</p>
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
                    Active Outlets
                  </p>
                  <p className="text-2xl font-bold">{activeOutlets}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Package className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Shipments
                  </p>
                  <p className="text-2xl font-bold">
                    {totalShipments.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Monthly Revenue
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalRevenue)}
                  </p>
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
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                <Button variant="outline" size="sm" className="px-3">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>
                {searchTerm
                  ? `Filtered outlets for "${searchTerm}"`
                  : "A list of all registered outlets"}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Outlet Details</TableHead>
                  <TableHead>Contact Information</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status & Type</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Business Hours</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((outlet) => (
                  <TableRow key={outlet.id}>
                    <TableCell className="font-medium">
                      <div className="text-sm">
                        <div className="font-semibold">{outlet.outletName}</div>
                        <div className="text-muted-foreground text-xs">
                          Code: {outlet.outletCode}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Retailer: {outlet.retailerName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span>{outlet.contactPerson}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{outlet.phone}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{outlet.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {outlet.city}, {outlet.state}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {outlet.address}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          PIN: {outlet.pincode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <Badge className={getOutletStatusColor(outlet.status)}>
                          {outlet.status}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          {getOutletTypeIcon(outlet.type)}
                          <Badge
                            variant="outline"
                            className={getOutletTypeColor(outlet.type)}
                          >
                            {outlet.type}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="text-xs">
                          Shipments:{" "}
                          {outlet.performance.totalShipments.toLocaleString()}
                        </div>
                        <div className="text-xs">
                          Revenue:{" "}
                          {formatCurrency(outlet.performance.monthlyRevenue)}
                        </div>
                        <div className="text-xs">
                          Success: {outlet.performance.successRate}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">
                            {outlet.businessHours}
                          </span>
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
                          <DropdownMenuItem>
                            <Package className="mr-2 h-4 w-4" />
                            View Shipments
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Performance Report
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(endIndex, currentData.length)} of{" "}
                  {currentData.length} results
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
