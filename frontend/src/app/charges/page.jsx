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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IndianRupee,
  Percent,
  Calculator,
  CheckCircle,
  XCircle,
  Plus,
  Settings,
  RefreshCw,
  Edit,
  Trash2,
  Search,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  Package,
  AlertTriangle,
  Filter,
  Download,
  Upload,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChargeCard } from "@/components/charges/charge-card";

function getChargeTypeIcon(type) {
  switch (type) {
    case "fsc":
      return <TrendingUp className="h-5 w-5 text-blue-600" />;
    case "handling":
      return <Package className="h-5 w-5 text-green-600" />;
    case "fuel":
      return <TrendingUp className="h-5 w-5 text-orange-600" />;
    case "service":
      return <Settings className="h-5 w-5 text-purple-600" />;
    default:
      return <Calculator className="h-5 w-5 text-gray-600" />;
  }
}

function getChargeTypeColor(type) {
  switch (type) {
    case "fsc":
      return "bg-blue-100 text-blue-800";
    case "handling":
      return "bg-green-100 text-green-800";
    case "fuel":
      return "bg-orange-100 text-orange-800";
    case "service":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusColor(status) {
  switch (status) {
    case true:
      return "bg-green-100 text-green-800";
    case false:
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status) {
  switch (status) {
    case true:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case false:
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <XCircle className="h-4 w-4 text-gray-500" />;
  }
}

export default function ChargesPage() {
  const router = useRouter();
  const [charges, setCharges] = useState([]);
  const [selectedCharge, setSelectedCharge] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [loading, setLoading] = useState(false);

  // Calculate stats dynamically
  const chargeStats = {
    totalCharges: charges.length,
    activeCharges: charges.filter((c) => c.status === true).length,
    fscCharges: charges.filter((c) => c.type === "fsc").length,
    handlingCharges: charges.filter((c) => c.type === "handling").length,
    percentageCharges: charges.filter((c) => c.chargeType === "percentage")
      .length,
    fixedCharges: charges.filter((c) => c.chargeType === "fixed").length,
    averageValue:
      charges.length > 0
        ? charges.reduce((sum, c) => sum + c.value, 0) / charges.length
        : 0,
  };

  // Filter charges based on search and filters
  const filteredCharges = charges.filter((charge) => {
    const matchesSearch =
      charge.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charge.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charge.otherChargeType?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || charge.type === filterType;
    const matchesStatus =
      filterStatus === "all" || charge.status.toString() === filterStatus;
    const matchesCustomer =
      filterCustomer === "all" || charge.customerId === filterCustomer;

    return matchesSearch && matchesType && matchesStatus && matchesCustomer;
  });

  // Mock data for charges
  const mockCharges = [
    {
      id: "1",
      customerId: "customer_123",
      type: "fsc",
      chargeType: "percentage",
      value: 3.5,
      minKg: 0.5,
      maxKg: 10,
      minValue: 100,
      maxValue: 10000,
      otherChargeType: "handling",
      status: true,
      createdAt: "2024-01-15T10:30:00Z",
      updatedAt: "2024-01-15T10:30:00Z",
    },
    {
      id: "2",
      customerId: "customer_456",
      type: "handling",
      chargeType: "fixed",
      value: 25,
      minKg: 0.1,
      maxKg: 50,
      minValue: 50,
      maxValue: 50000,
      otherChargeType: "processing",
      status: true,
      createdAt: "2024-01-14T14:20:00Z",
      updatedAt: "2024-01-14T14:20:00Z",
    },
    {
      id: "3",
      customerId: "customer_789",
      type: "fuel",
      chargeType: "percentage",
      value: 2.8,
      minKg: 1,
      maxKg: 25,
      minValue: 200,
      maxValue: 25000,
      otherChargeType: "surcharge",
      status: false,
      createdAt: "2024-01-13T09:15:00Z",
      updatedAt: "2024-01-13T09:15:00Z",
    },
    {
      id: "4",
      customerId: "customer_123",
      type: "service",
      chargeType: "fixed",
      value: 15,
      minKg: 0.5,
      maxKg: 15,
      minValue: 100,
      maxValue: 15000,
      otherChargeType: "admin",
      status: true,
      createdAt: "2024-01-12T16:45:00Z",
      updatedAt: "2024-01-12T16:45:00Z",
    },
  ];

  // Load charges on component mount
  useEffect(() => {
    loadCharges();
  }, []);

  const loadCharges = () => {
    setLoading(true);
    // Simulate loading delay
    setTimeout(() => {
      setCharges(mockCharges);
      setLoading(false);
    }, 1000);
  };

  const handleChargeSelect = (charge) => {
    setSelectedCharge(charge);
  };

  const handleEditCharge = (charge) => {
    // TODO: Navigate to edit page or open edit modal
    console.log("Edit charge:", charge);
  };

  const handleDeleteCharge = (chargeId) => {
    if (confirm("Are you sure you want to delete this charge?")) {
      setCharges((prev) => prev.filter((c) => c.id !== chargeId));
      if (selectedCharge?.id === chargeId) {
        setSelectedCharge(null);
      }
    }
  };

  const handleSyncCharges = () => {
    loadCharges();
  };

  const handleExportCharges = () => {
    // TODO: Implement export functionality
    console.log("Exporting charges...");
  };

  const handleImportCharges = () => {
    // TODO: Implement import functionality
    console.log("Importing charges...");
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[{ title: "Charges Management", href: "/charges" }]}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Charges Management
            </h1>
            <p className="text-muted-foreground">
              Manage customer charges, FSC rates, handling fees, and other
              billing components for accurate cost calculation.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleImportCharges}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCharges}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncCharges}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync
            </Button>
            <Button size="sm" onClick={() => router.push("/charges/create")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Charge
            </Button>
          </div>
        </div>

        {/* Charge Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Charges
              </CardTitle>
              <Calculator className="h-5 w-5 text-muted-foreground text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {chargeStats.totalCharges}
              </div>
              <p className="text-xs text-muted-foreground">
                {chargeStats.activeCharges} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">FSC Charges</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{chargeStats.fscCharges}</div>
              <p className="text-xs text-muted-foreground">
                {chargeStats.handlingCharges} handling
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Charge Types
              </CardTitle>
              <Percent className="h-5 w-5 text-muted-foreground text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {chargeStats.percentageCharges}
              </div>
              <p className="text-xs text-muted-foreground">
                {chargeStats.fixedCharges} fixed charges
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Value</CardTitle>
              <IndianRupee className="h-5 w-5 text-muted-foreground text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{chargeStats.averageValue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Per charge</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search charges by customer, type, or charge type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40 h-10">
                    <SelectValue placeholder="Charge Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="fsc">FSC</SelectItem>
                    <SelectItem value="handling">Handling</SelectItem>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40 h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterCustomer}
                  onValueChange={setFilterCustomer}
                >
                  <SelectTrigger className="w-40 h-10">
                    <SelectValue placeholder="Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {Array.from(new Set(charges.map((c) => c.customerId))).map(
                      (customerId) => (
                        <SelectItem key={customerId} value={customerId}>
                          {customerId}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-10">
                  <Filter className="mr-2 h-4 w-4" />
                  More Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Table Layout */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Package Charges ({filteredCharges.length})
                </CardTitle>
                <CardDescription>
                  {charges.length === 0
                    ? "No charges configured yet. Add your first charge to get started."
                    : "Manage customer charges and billing components"}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {charges.length > 0 && (
                  <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => router.push("/charges/create")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Charge
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-16 w-16 mx-auto mb-4 opacity-50 animate-spin" />
                <p className="text-lg font-medium mb-2">Loading charges...</p>
              </div>
            ) : charges.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  No charges configured
                </p>
                <p className="text-sm mb-4">
                  Create your first charge to start managing billing components
                  and rates.
                </p>
                <Button onClick={() => router.push("/charges/create")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Charge
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        #
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Customer
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Charge Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Value
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Weight Range
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Value Range
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCharges.map((charge, index) => (
                      <tr
                        key={charge.id || `${charge.customerId}-${charge.type}`}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleChargeSelect(charge)}
                      >
                        <td className="py-3 px-4 text-sm font-medium">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                              {getChargeTypeIcon(charge.type)}
                            </div>
                            <span className="font-medium">
                              {charge.customerId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={getChargeTypeColor(charge.type)}>
                            {charge.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center space-x-1">
                            {charge.chargeType === "percentage" ? (
                              <Percent className="h-3 w-3" />
                            ) : (
                              <IndianRupee className="h-3 w-3" />
                            )}
                            <span className="capitalize">
                              {charge.chargeType}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">
                          {charge.value}{" "}
                          {charge.chargeType === "percentage" ? "%" : "₹"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {charge.minKg}kg - {charge.maxKg}kg
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          ₹{charge.minValue} - ₹{charge.maxValue}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(charge.status)}
                            <Badge className={getStatusColor(charge.status)}>
                              {charge.status ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCharge(charge);
                              }}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCharge(charge.id);
                              }}
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
