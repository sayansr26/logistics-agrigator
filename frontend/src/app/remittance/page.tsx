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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  mockRemittances,
  mockRetailers,
  getRemittanceStatusColor,
  formatAmount,
} from "@/lib/mock-data";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  BarChart3,
  MapPin,
  User,
  Truck,
  CreditCard,
} from "lucide-react";

export default function RemittancePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage] = useState(1);
  const [selectedRetailer, setSelectedRetailer] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const itemsPerPage = 10;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Remittance" },
  ];

  // Calculate remittance statistics
  const totalRemittances = mockRemittances.length;
  const pendingRemittances = mockRemittances.filter(
    (r) => r.status === "pending",
  ).length;
  const totalAmount = mockRemittances.reduce((sum, r) => sum + r.amount, 0);
  const pendingAmount = mockRemittances
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + r.amount, 0);

  // Filter data based on search and filters
  const filteredRemittances = mockRemittances.filter((remittance) => {
    const matchesSearch =
      remittance.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      remittance.awbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      remittance.receiver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      remittance.outlet.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRetailer =
      selectedRetailer === "all"
        ? true
        : remittance.outlet === selectedRetailer;
    const matchesStatus =
      selectedStatus === "all" ? true : remittance.status === selectedStatus;

    return matchesSearch && matchesRetailer && matchesStatus;
  });

  // Pagination logic
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredRemittances.slice(startIndex, endIndex);

  const handleExport = () => {
    // Export functionality would be implemented here
    // console.log("Exporting remittance data...");
  };

  const handleRefresh = () => {
    // Refresh functionality would be implemented here
    // console.log("Refreshing remittance data...");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "settled":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "settled":
        return "bg-green-50 text-green-700 border-green-200";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <span>Remittance Management</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Track and manage COD remittances, settlements, and payment
              processing
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline">
              <Clock className="mr-2 h-4 w-4" />
              Upcoming
            </Button>
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              History
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Remittances
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRemittances}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                +5.2% from last month
              </div>
            </CardContent>
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full -translate-y-10 translate-x-10"></div>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Remittances
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {pendingRemittances}
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <AlertTriangle className="mr-1 h-3 w-3 text-yellow-500" />
                Requires attention
              </div>
            </CardContent>
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-50 rounded-full -translate-y-10 translate-x-10"></div>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Amount
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{totalAmount.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                +12.8% from last month
              </div>
            </CardContent>
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 rounded-full -translate-y-10 translate-x-10"></div>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Amount
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ₹{pendingAmount.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                -2.1% from last week
              </div>
            </CardContent>
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-full -translate-y-10 translate-x-10"></div>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters & Search</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Ref No, AWB, Receiver..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select
                value={selectedRetailer}
                onValueChange={setSelectedRetailer}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Retailer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Retailers</SelectItem>
                  {mockRetailers.map((retailer) => (
                    <SelectItem key={retailer} value={retailer}>
                      {retailer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Date Range
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Remittances - Enhanced Design */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">
                  Recent Remittances
                </CardTitle>
                <CardDescription className="text-base">
                  Latest remittance activities and status updates
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={viewMode === "cards" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("cards")}
                    className="h-8 px-3"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="h-8 px-3"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  View All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedData.slice(0, 6).map((remittance) => (
                  <Card
                    key={remittance.id}
                    className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-gray-900">
                                {remittance.refNo}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">
                                {remittance.awbNumber}
                              </p>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download Receipt
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              Receiver
                            </span>
                          </div>
                          <span
                            className="text-sm font-medium text-gray-900 truncate max-w-[120px]"
                            title={remittance.receiver}
                          >
                            {remittance.receiver}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Truck className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              Courier
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {remittance.courier}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              Outlet
                            </span>
                          </div>
                          <span
                            className="text-sm font-medium text-gray-900 truncate max-w-[120px]"
                            title={remittance.outlet}
                          >
                            {remittance.outlet}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              Amount
                            </span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">
                            {formatAmount(remittance.amount)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Status</span>
                          <Badge
                            className={`${getStatusColor(remittance.status)} border`}
                          >
                            {getStatusIcon(remittance.status)}
                            <span className="ml-1 text-xs font-medium">
                              {remittance.status.charAt(0).toUpperCase() +
                                remittance.status.slice(1)}
                            </span>
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference No</TableHead>
                    <TableHead>AWB Number</TableHead>
                    <TableHead>Receiver</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.slice(0, 5).map((remittance) => (
                    <TableRow key={remittance.id}>
                      <TableCell className="font-medium">
                        <div
                          className="truncate max-w-[120px]"
                          title={remittance.refNo}
                        >
                          {remittance.refNo}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div
                          className="truncate max-w-[120px]"
                          title={remittance.awbNumber}
                        >
                          {remittance.awbNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="truncate max-w-[130px]"
                          title={remittance.receiver}
                        >
                          {remittance.receiver}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{remittance.courier}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(remittance.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getRemittanceStatusColor(
                            remittance.status,
                          )}
                        >
                          {remittance.status === "pending" && (
                            <Clock className="mr-1 h-3 w-3" />
                          )}
                          {remittance.status === "settled" && (
                            <CheckCircle className="mr-1 h-3 w-3" />
                          )}
                          {remittance.status === "cancelled" && (
                            <AlertTriangle className="mr-1 h-3 w-3" />
                          )}
                          {remittance.status.charAt(0).toUpperCase() +
                            remittance.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
