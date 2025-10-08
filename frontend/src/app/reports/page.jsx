"use client";

import { useState } from "react";
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
import { ProgressChart } from "@/components/ui/progress-chart";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  DollarSign,
  Clock,
  Filter,
  Search,
  Download,
  Calendar,
  MoreHorizontal,
  Eye,
  FileText,
  PieChart,
  Activity,
  Target,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  mockShipments,
  mockUsers,
  mockOrders,
  mockTransactions,
  mockInvoices,
  getStatusColor,
  getPriorityColor,
  formatCurrency,
  formatDate,
  getPlatformColor,
  getPaymentModeColor,
  getTransactionStatusColor,
  getInvoiceStatusColor,
  getFirstWord,
} from "@/lib/mock-data";

export default function ReportsPage() {
  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Reports & Analytics" },
  ];

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30d");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Mock analytics data
  const analyticsData = {
    totalShipments: mockShipments.length,
    totalRevenue: mockShipments.reduce((sum, s) => sum + s.value, 0),
    activeUsers: mockUsers.filter((u) => u.status === "active").length,
    deliveryRate: 94.2,
    avgDeliveryTime: 3.2,
    topCourier: "DHL Express",
    topOrigin: "Mumbai",
    topDestination: "New York",
  };

  // Filter data based on search term and date range
  const filteredShipments = mockShipments.filter(
    (shipment) =>
      shipment.trackingNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      shipment.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.receiverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.destination.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredOrders = mockOrders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.platform.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Pagination logic
  const currentData =
    activeTab === "shipments" ? filteredShipments : filteredOrders;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = currentData.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header - Updated to match other pages */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <span>Reports & Analytics</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive insights into your logistics operations and
              performance metrics
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </div>

        {/* Tab Navigation - Updated styling */}
        <div className="flex justify-center space-x-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === "overview" ? "default" : "ghost"}
            onClick={() => handleTabChange("overview")}
            className="flex items-center space-x-2"
            size="sm"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Overview</span>
          </Button>
          <Button
            variant={activeTab === "shipments" ? "default" : "ghost"}
            onClick={() => handleTabChange("shipments")}
            className="flex items-center space-x-2"
            size="sm"
          >
            <Package className="h-4 w-4" />
            <span>Shipments</span>
          </Button>
          <Button
            variant={activeTab === "financial" ? "default" : "ghost"}
            onClick={() => handleTabChange("financial")}
            className="flex items-center space-x-2"
            size="sm"
          >
            <DollarSign className="h-4 w-4" />
            <span>Financial</span>
          </Button>
          <Button
            variant={activeTab === "performance" ? "default" : "ghost"}
            onClick={() => handleTabChange("performance")}
            className="flex items-center space-x-2"
            size="sm"
          >
            <Activity className="h-4 w-4" />
            <span>Performance</span>
          </Button>
        </div>

        {/* Date Range Selector - Updated styling */}
        <div className="flex justify-center">
          <div className="flex items-center space-x-4 bg-background border rounded-lg p-3">
            <span className="text-sm font-medium text-muted-foreground">
              Date Range:
            </span>
            <Select
              value={dateRange}
              onValueChange={(value) => setDateRange(value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Custom Range
            </Button>
          </div>
        </div>

        {/* Overview Dashboard */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Key Metrics Cards - Updated spacing and layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Shipments
                      </p>
                      <p className="text-2xl font-bold">
                        {analyticsData.totalShipments}
                      </p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +12.5%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Revenue
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(analyticsData.totalRevenue)}
                      </p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +8.7%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Active Users
                      </p>
                      <p className="text-2xl font-bold">
                        {analyticsData.activeUsers}
                      </p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +5.2%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Target className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Delivery Rate
                      </p>
                      <p className="text-2xl font-bold">
                        {analyticsData.deliveryRate}%
                      </p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +1.8%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics - Updated layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span>Delivery Performance</span>
                  </CardTitle>
                  <CardDescription>
                    Average delivery times and success rates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">
                      Average Delivery Time
                    </span>
                    <span className="text-lg font-semibold text-blue-600">
                      {analyticsData.avgDeliveryTime} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">
                      Top Performing Courier
                    </span>
                    <span className="text-lg font-semibold text-green-600">
                      {analyticsData.topCourier}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">
                      Most Active Origin
                    </span>
                    <span className="text-lg font-semibold text-purple-600">
                      {analyticsData.topOrigin}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">
                      Most Popular Destination
                    </span>
                    <span className="text-lg font-semibold text-orange-600">
                      {analyticsData.topDestination}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    <span>Shipment Status Distribution</span>
                  </CardTitle>
                  <CardDescription>
                    Current shipment status breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProgressChart
                    data={Object.entries(
                      mockShipments.reduce((acc, shipment) => {
                        acc[shipment.status] = (acc[shipment.status] || 0) + 1;
                        return acc;
                      }, {}),
                    ).map(([status, count]) => ({
                      label: status
                        .replace("_", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase()),
                      value: count,
                      maxValue: mockShipments.length,
                      color: getStatusColor(status).includes("green")
                        ? "bg-green-500"
                        : getStatusColor(status).includes("blue")
                          ? "bg-blue-500"
                          : getStatusColor(status).includes("yellow")
                            ? "bg-yellow-500"
                            : getStatusColor(status).includes("red")
                              ? "bg-red-500"
                              : "bg-gray-500",
                    }))}
                    showValues={true}
                    showPercentages={true}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity - Updated styling */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  <span>Recent Activity</span>
                </CardTitle>
                <CardDescription>Latest shipments and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockShipments.slice(0, 5).map((shipment) => (
                    <div
                      key={shipment.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {shipment.trackingNumber}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {shipment.senderName} → {shipment.receiverName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(shipment.status)}>
                          {shipment.status.replace("_", " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(shipment.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shipments Analytics - Updated header layout */}
        {activeTab === "shipments" && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span>Shipments Analytics</span>
                  </CardTitle>
                  <CardDescription>
                    Detailed shipment performance and trends analysis
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search shipments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ShipmentsAnalyticsTable
                shipments={paginatedData}
                searchTerm={searchTerm}
              />

              {/* Pagination - Updated styling */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
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
        )}

        {/* Financial Analytics - Updated layout and styling */}
        {activeTab === "financial" && (
          <div className="space-y-6">
            {/* Financial Overview Cards - Updated styling */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Revenue
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(analyticsData.totalRevenue)}
                      </p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +8.7%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        COD Shipments
                      </p>
                      <p className="text-2xl font-bold">
                        {
                          mockShipments.filter((s) => s.paymentMode === "cod")
                            .length
                        }
                      </p>
                      <div className="flex items-center text-sm text-blue-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +15.2%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Pending Invoices
                      </p>
                      <p className="text-2xl font-bold">
                        {
                          mockInvoices.filter((i) => i.status === "pending")
                            .length
                        }
                      </p>
                      <div className="flex items-center text-sm text-orange-600">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Requires attention
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Financial Charts - Updated styling */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <span>Payment Mode Distribution</span>
                </CardTitle>
                <CardDescription>
                  Shipment volume by payment method
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProgressChart
                  data={Object.entries(
                    mockShipments.reduce((acc, shipment) => {
                      acc[shipment.paymentMode] =
                        (acc[shipment.paymentMode] || 0) + 1;
                      return acc;
                    }, {}),
                  ).map(([mode, count]) => ({
                    label: mode.charAt(0).toUpperCase() + mode.slice(1),
                    value: count,
                    maxValue: mockShipments.length,
                    color: getPaymentModeColor(mode).includes("green")
                      ? "bg-green-500"
                      : getPaymentModeColor(mode).includes("blue")
                        ? "bg-blue-500"
                        : getPaymentModeColor(mode).includes("orange")
                          ? "bg-orange-500"
                          : getPaymentModeColor(mode).includes("purple")
                            ? "bg-purple-500"
                            : "bg-gray-500",
                  }))}
                  showValues={true}
                  showPercentages={true}
                />
              </CardContent>
            </Card>

            {/* Financial Tables - Updated styling */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span>Recent Transactions</span>
                  </CardTitle>
                  <CardDescription>
                    Latest wallet transactions and charges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockTransactions.slice(0, 5).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-3 h-3 rounded-full ${getTransactionStatusColor(transaction.transactionDetails.status).includes("green") ? "bg-green-500" : getTransactionStatusColor(transaction.transactionDetails.status).includes("yellow") ? "bg-yellow-500" : "bg-red-500"}`}
                          />
                          <div>
                            <p className="font-medium text-sm">
                              {transaction.transactionDetails.reference}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {transaction.transactionDetails.date}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {transaction.credit > 0 ? (
                            <p className="text-green-600 font-medium">
                              +{formatCurrency(transaction.credit)}
                            </p>
                          ) : (
                            <p className="text-red-600 font-medium">
                              -{formatCurrency(transaction.debit)}
                            </p>
                          )}
                          <Badge
                            className={getTransactionStatusColor(
                              transaction.transactionDetails.status,
                            )}
                          >
                            {transaction.transactionDetails.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span>Invoice Status</span>
                  </CardTitle>
                  <CardDescription>
                    Current invoice status and amounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {invoice.invoiceNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(invoice.amount)}
                          </p>
                          <Badge
                            className={getInvoiceStatusColor(invoice.status)}
                          >
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Performance Analytics - Updated styling */}
        {activeTab === "performance" && (
          <div className="space-y-6">
            {/* Performance Metrics - Updated styling */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Target className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Delivery Success Rate
                      </p>
                      <p className="text-2xl font-bold">
                        {analyticsData.deliveryRate}%
                      </p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +1.8%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Avg Delivery Time
                      </p>
                      <p className="text-2xl font-bold">
                        {analyticsData.avgDeliveryTime} days
                      </p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        -0.3 days
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Customer Satisfaction
                      </p>
                      <p className="text-2xl font-bold">4.8/5.0</p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +0.2
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Activity className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        On-Time Performance
                      </p>
                      <p className="text-2xl font-bold">96.5%</p>
                      <div className="flex items-center text-sm text-green-600">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        +2.1%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Tables - Updated styling */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <span>Platform Performance</span>
                </CardTitle>
                <CardDescription>
                  Performance metrics by e-commerce platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Avg Processing Time</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(
                      mockOrders.reduce((acc, order) => {
                        if (!acc[order.platform]) {
                          acc[order.platform] = {
                            orders: 0,
                            revenue: 0,
                            success: 0,
                            total: 0,
                          };
                        }
                        acc[order.platform].orders++;
                        acc[order.platform].total++;
                        if (order.status === "delivered")
                          acc[order.platform].success++;
                        acc[order.platform].revenue += 100; // Mock revenue
                        return acc;
                      }, {}),
                    ).map(([platform, data]) => (
                      <TableRow key={platform} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge className={getPlatformColor(platform)}>
                              {platform}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {data.orders}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {Math.round((data.success / data.total) * 100)}%
                            </span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{
                                  width: `${(data.success / data.total) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>2.3 days</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(data.revenue)}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ShipmentsAnalyticsTable({ shipments, searchTerm }) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered shipments for "${searchTerm}"`
          : "Comprehensive shipment analytics and performance data"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking</TableHead>
          <TableHead>Pick up and Delivery</TableHead>
          <TableHead>Status & Partner</TableHead>
          <TableHead>Manifest Date/Time</TableHead>
          <TableHead>Payment Mode</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((shipment) => (
          <TableRow key={shipment.id} className="hover:bg-muted/50">
            <TableCell className="font-medium">
              <div className="text-sm">
                <div>{shipment.trackingNumber}</div>
                <div className="text-muted-foreground text-xs">
                  Ref: {shipment.referenceNumber}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <div className="mt-1">
                  <div className="text-xs text-muted-foreground">
                    {shipment.origin}, {shipment.originState} (
                    {shipment.originPinCode})
                    <span className="font-medium">
                      {getFirstWord(shipment.senderName)}
                    </span>
                  </div>
                  <div className="border-t border-gray-300 my-1"></div>
                  <div className="text-xs text-muted-foreground">
                    {shipment.destination}, {shipment.destinationState} (
                    {shipment.destinationPinCode})
                    <span className="font-medium">
                      {getFirstWord(shipment.receiverName)}
                    </span>
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm space-y-1">
                <Badge className={getStatusColor(shipment.status)}>
                  {shipment.status.replace("_", " ")}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {shipment.courierPartner}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-sm">
              <div>
                <div className="font-medium">{shipment.manifestDate}</div>
                <div className="text-muted-foreground text-xs">
                  {shipment.manifestTime}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge className={getPaymentModeColor(shipment.paymentMode)}>
                {shipment.paymentMode.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">
              {formatCurrency(shipment.value)}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={getPriorityColor(shipment.priority)}
              >
                {shipment.priority}
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
                  <DropdownMenuItem>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
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
