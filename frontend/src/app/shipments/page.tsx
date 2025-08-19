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
  mockShipments,
  getStatusColor,
  getPriorityColor,
  formatCurrency,
  formatDate,
  type Shipment,
} from "@/lib/mock-data";
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
} from "lucide-react";

export default function ShipmentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments" },
  ];

  // Filter data based on search term
  const filteredShipments = mockShipments.filter(
    (shipment) =>
      shipment.trackingNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      shipment.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.receiverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.destination.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Pagination logic
  const currentData = filteredShipments;
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
              <Package className="h-8 w-8 text-logistics-600" />
              <span>All Shipments</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Track and manage all your shipments in one place
            </p>
          </div>
          <div className="flex items-center space-x-1.5">
            <Button variant="outline" size="sm">
              <Truck className="h-3.5 w-3.5 mr-1.5" />
              Track
            </Button>
            <Button variant="outline" size="sm">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              NDR
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Bulk
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Shipment
            </Button>
          </div>
        </div>

        {/* Search and Table */}
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
                    placeholder="Search shipments..."
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
                  ? `Filtered shipments for "${searchTerm}"`
                  : "A list of recent shipments"}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((shipment) => (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-medium">
                      {shipment.trackingNumber}
                    </TableCell>
                    <TableCell>{shipment.senderName}</TableCell>
                    <TableCell>{shipment.receiverName}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{shipment.origin}</div>
                        <div className="text-muted-foreground">
                          → {shipment.destination}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(shipment.status)}>
                        {shipment.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getPriorityColor(shipment.priority)}
                      >
                        {shipment.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(shipment.value)}</TableCell>
                    <TableCell className="text-sm">
                      {shipment.courierPartner}
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
                            Edit Shipment
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Cancel Shipment
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
                  <p className="text-2xl font-bold">{mockShipments.length}</p>
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
                    {
                      mockShipments.filter((s) => s.status === "delivered")
                        .length
                    }
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
                    In Transit
                  </p>
                  <p className="text-2xl font-bold">
                    {
                      mockShipments.filter((s) => s.status === "in_transit")
                        .length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-orange-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending
                  </p>
                  <p className="text-2xl font-bold">
                    {mockShipments.filter((s) => s.status === "pending").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
