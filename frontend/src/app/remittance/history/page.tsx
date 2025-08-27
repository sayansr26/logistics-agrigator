"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mockRemittances,
  mockRetailers,
  formatWeight,
  formatAmount,
} from "@/lib/mock-data";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function RemittanceHistoryPage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Remittance", href: "/remittance" },
    { title: "Remittance History" },
  ];

  const [selectedRetailer, setSelectedRetailer] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter for historical remittances (status settled or cancelled)
  const historicalRemittances = mockRemittances.filter(
    (item) => item.status === "settled" || item.status === "cancelled",
  );

  // Apply filters
  const filteredRemittances = historicalRemittances.filter((item) => {
    const retailerMatch =
      selectedRetailer === "All" || item.outlet === selectedRetailer;
    const statusMatch =
      selectedStatus === "All" || item.status === selectedStatus;
    const searchMatch =
      searchTerm === "" ||
      item.receiver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.awbNumber.toLowerCase().includes(searchTerm.toLowerCase());

    return retailerMatch && statusMatch && searchMatch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredRemittances.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRemittances = filteredRemittances.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalAmount = filteredRemittances.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const settledAmount = filteredRemittances
    .filter((item) => item.status === "settled")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">
            Remittance History
          </h1>
          <p className="text-muted-foreground">
            View and analyze historical remittance data
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Items
                  </p>
                  <p className="text-2xl font-bold">
                    {filteredRemittances.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Amount
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(totalAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Settled Amount
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatAmount(settledAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Success Rate
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredRemittances.length > 0
                      ? `${Math.round((filteredRemittances.filter((item) => item.status === "settled").length / filteredRemittances.length) * 100)}%`
                      : "0%"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                {/* <CardTitle className="flex items-center space-x-2">
                  <History className="h-5 w-5" />
                  <span>Remittance History Management</span>
                </CardTitle> */}
                <CardDescription>
                  Filter and search historical remittance data
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by receiver, ref no, or AWB..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select
                  value={selectedRetailer}
                  onValueChange={setSelectedRetailer}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Retailer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Retailers</SelectItem>
                    {mockRetailers.map((retailer) => (
                      <SelectItem key={retailer} value={retailer}>
                        {retailer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RemittanceHistoryTable
              remittances={paginatedRemittances}
              searchTerm={searchTerm}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(endIndex, filteredRemittances.length)} of{" "}
                  {filteredRemittances.length} results
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

function RemittanceHistoryTable({
  remittances,
  searchTerm,
}: {
  remittances: any[];
  searchTerm: string;
}) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered remittance history for "${searchTerm}"`
          : "A list of historical remittances"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Ref No</TableHead>
          {/* <TableHead>Receiver</TableHead> */}
          <TableHead>Courier</TableHead>
          <TableHead>Weight</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          {/* <TableHead>Created</TableHead> */}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {remittances.map((remittance, index) => (
          <TableRow key={remittance.id} className="hover:bg-muted/50">
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>
              <div className="space-y-1">
                <div className="font-medium">{remittance.refNo}</div>
                <div className="text-sm text-muted-foreground">
                  AWB: {remittance.awbNumber}
                </div>
              </div>
            </TableCell>
            {/* <TableCell>{remittance.receiver}</TableCell> */}
            <TableCell className="text-sm">{remittance.courier}</TableCell>
            <TableCell>{formatWeight(remittance.weight)}</TableCell>
            <TableCell className="font-medium">
              {formatAmount(remittance.amount)}
            </TableCell>
            <TableCell>
              <Badge
                className={
                  remittance.status === "settled"
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : remittance.status === "cancelled"
                      ? "bg-red-100 text-red-800 hover:bg-red-100"
                      : "bg-gray-100 text-gray-800"
                }
              >
                {remittance.status.charAt(0).toUpperCase() +
                  remittance.status.slice(1)}
              </Badge>
            </TableCell>
            {/* <TableCell className="text-sm">
              {new Date(remittance.createdAt).toLocaleDateString()}
            </TableCell> */}
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href={`/remittance/${remittance.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Remittance
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Record
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
