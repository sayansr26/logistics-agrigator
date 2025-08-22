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
  mockOrders,
  getOrderStatusColor,
  getPlatformColor,
  getPriorityColor,
  getPaymentStatusColor,
  formatDate,
} from "@/lib/mock-data";
import {
  FileText,
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
  ShoppingCart,
  Package,
  Clock,
} from "lucide-react";

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Orders" },
  ];

  // Filter data based on search term
  const filteredOrders = mockOrders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.platform.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Pagination logic
  const currentData = filteredOrders;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = currentData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <ShoppingCart className="h-8 w-8 text-logistics-600" />
              <span>All Orders</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage and track all your orders from various platforms
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button variant="outline" size="sm">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Order
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold">{mockOrders.length}</p>
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
                    Delivered
                  </p>
                  <p className="text-2xl font-bold">
                    {mockOrders.filter((o) => o.status === "delivered").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-blue-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Processing
                  </p>
                  <p className="text-2xl font-bold">
                    {mockOrders.filter((o) => o.status === "processing").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending
                  </p>
                  <p className="text-2xl font-bold">
                    {mockOrders.filter((o) => o.status === "pending").length}
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
                  <FileText className="h-5 w-5" />
                  <span>Orders Management</span>
                </CardTitle>
                <CardDescription>
                  Track and manage orders from all connected platforms
                </CardDescription>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
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
                  ? `Filtered orders for "${searchTerm}"`
                  : "A list of recent orders"}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{order.customerName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPlatformColor(order.platform)}>
                        {order.platform.charAt(0).toUpperCase() +
                          order.platform.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getOrderStatusColor(order.status)}>
                        {order.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getPriorityColor(order.priority)}
                      >
                        {order.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{order.itemCount}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        className={getPaymentStatusColor(order.paymentStatus)}
                      >
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(order.createdAt)}
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
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Order
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Package className="mr-2 h-4 w-4" />
                            Create Shipment
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Cancel Order
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
