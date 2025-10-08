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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  mockPartnerShipments,
  getPartnerShipmentStatusColor,
  formatCurrency,
} from "@/lib/mock-data";
import {
  Truck,
  Package,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Star,
  Globe,
  Phone,
  Mail,
  Plus,
  TrendingUp,
  Clock,
  MapPin,
  Loader2,
  AlertCircle,
  Power,
  PowerOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { usePartners } from "@/hooks/usePartners";
import { partnersApiService } from "@/services";

export default function PartnersPage() {
  const router = useRouter();
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Courier Partners" },
  ];

  // State for search and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("partners");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, inactive, pending
  const itemsPerPage = 5;

  // Use the custom hook to fetch partners data
  const { partners, isLoading, error, refetch } = usePartners({}); // Show all partners including pending ones (no filters)

  // Filter partners based on status and search term
  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && partner.isActive === true) ||
      (statusFilter === "inactive" && partner.isActive === false) ||
      (statusFilter === "pending" &&
        (partner.isActive === null || partner.isActive === undefined));

    return matchesSearch && matchesStatus;
  });

  // Filter partner shipments based on search term (still using mock data for now)
  const filteredPartnerShipments = mockPartnerShipments.filter(
    (shipment) =>
      shipment.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.trackingNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      shipment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Pagination logic for partner shipments (mock data)
  const partnerShipmentsTotalPages = Math.ceil(
    filteredPartnerShipments.length / itemsPerPage,
  );
  const partnerShipmentsStartIndex = (currentPage - 1) * itemsPerPage;
  const partnerShipmentsEndIndex = partnerShipmentsStartIndex + itemsPerPage;
  const paginatedPartnerShipments = filteredPartnerShipments.slice(
    partnerShipmentsStartIndex,
    partnerShipmentsEndIndex,
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset to first page when changing tabs
  };

  // Partner management handlers
  const handleAddPartner = () => {
    router.push("/partners/add");
  };

  const handleViewPartner = (partner) => {
    router.push(`/partners/${partner.id}`);
  };

  const handleEditPartner = (partner) => {
    router.push(`/partners/${partner.id}/edit`);
  };

  const handleDeactivatePartner = async (partner) => {
    if (
      !confirm(`Are you sure you want to deactivate ${partner.displayName}?`)
    ) {
      return;
    }

    try {
      await partnersApiService.deactivatePartner(partner.id);
      await refetch(); // Refresh the partners list
    } catch (error) {
      console.error("Error deactivating partner:", error);
      alert("Failed to deactivate partner. Please try again.");
    }
  };

  const handleActivatePartner = async (partner) => {
    try {
      await partnersApiService.activatePartner(partner.id);
      await refetch(); // Refresh the partners list
    } catch (error) {
      console.error("Error activating partner:", error);
      alert("Failed to activate partner. Please try again.");
    }
  };

  const handleDeletePartner = async (partner) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete ${partner.displayName}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await partnersApiService.deletePartner(partner.id);
      await refetch(); // Refresh the partners list
    } catch (error) {
      console.error("Error deleting partner:", error);
      alert("Failed to delete partner. Please try again.");
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">
            Courier Partners Management
          </h1>
          <p className="text-muted-foreground">
            Manage your logistics partners, track performance, and monitor
            shipments
          </p>
        </div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Partners
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      partners.length
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Partners
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      partners.filter((p) => p.isActive === true).length
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Partners
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      partners.filter(
                        (p) => p.isActive === null || p.isActive === undefined,
                      ).length
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Shipments
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {mockPartnerShipments.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-red-100 rounded-full">
                  <PowerOff className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Inactive Partners
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      partners.filter((p) => p.isActive === false).length
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center space-x-4">
          <Button
            variant={activeTab === "partners" ? "default" : "outline"}
            onClick={() => handleTabChange("partners")}
            className="flex items-center space-x-2 px-6 py-3"
          >
            <Truck className="h-4 w-4" />
            <span>Partners</span>
          </Button>
          <Button
            variant={activeTab === "shipments" ? "default" : "outline"}
            onClick={() => handleTabChange("shipments")}
            className="flex items-center space-x-2 px-6 py-3"
          >
            <Package className="h-4 w-4" />
            <span>Partner Shipments</span>
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="shadow-sm border-0 bg-gradient-to-r from-gray-50 to-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2 text-xl">
                  {activeTab === "partners" ? (
                    <>
                      <Truck className="h-6 w-6 text-blue-600" />
                      <span>Partners Management</span>
                    </>
                  ) : (
                    <>
                      <Package className="h-6 w-6 text-purple-600" />
                      <span>Partner Shipments</span>
                    </>
                  )}
                </CardTitle>
                <CardDescription className="text-base">
                  {activeTab === "partners"
                    ? "Manage courier partners and their performance metrics"
                    : "Track shipments handled by partner couriers"}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${activeTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-72 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                {activeTab === "partners" && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 border-gray-200">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                      <SelectItem value="pending">Pending Only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="border-gray-200 hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4" />
                </Button>
                {activeTab === "partners" && (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                    onClick={handleAddPartner}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Partner
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === "partners" ? (
              <>
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refetch}
                      className="ml-auto"
                    >
                      Retry
                    </Button>
                  </div>
                )}
                <PartnersTable
                  partners={filteredPartners}
                  searchTerm={searchTerm}
                  onViewPartner={handleViewPartner}
                  onEditPartner={handleEditPartner}
                  onDeactivatePartner={handleDeactivatePartner}
                  onActivatePartner={handleActivatePartner}
                  onDeletePartner={handleDeletePartner}
                  isLoading={isLoading}
                />
              </>
            ) : (
              <PartnerShipmentsTable
                shipments={paginatedPartnerShipments}
                searchTerm={searchTerm}
              />
            )}

            {/* Partners count info */}
            {activeTab === "partners" && (
              <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredPartners.length} of {partners.length}{" "}
                    partner{partners.length !== 1 ? "s" : ""}
                    {statusFilter !== "all" && ` (filtered by ${statusFilter})`}
                  </div>
                </div>
              </div>
            )}

            {/* Pagination for partner shipments */}
            {activeTab === "shipments" && partnerShipmentsTotalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                <div className="text-sm text-muted-foreground">
                  Showing {partnerShipmentsStartIndex + 1} to{" "}
                  {Math.min(
                    partnerShipmentsEndIndex,
                    filteredPartnerShipments.length,
                  )}{" "}
                  of {filteredPartnerShipments.length} results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="border-gray-200 hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {Array.from(
                    { length: partnerShipmentsTotalPages },
                    (_, i) => i + 1,
                  ).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={
                        currentPage === page
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "border-gray-200 hover:bg-gray-50"
                      }
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === partnerShipmentsTotalPages}
                    className="border-gray-200 hover:bg-gray-50"
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

function PartnersTable({
  partners,
  searchTerm,
  onViewPartner,
  onEditPartner,
  onDeactivatePartner,
  onActivatePartner,
  onDeletePartner,
  isLoading,
}) {
  // Helper functions for styling
  const getPartnerStatusColor = (partner) => {
    if (partner.isActive === true) {
      return "bg-green-100 text-green-800 border-green-200";
    } else if (partner.isActive === false) {
      return "bg-gray-100 text-gray-800 border-gray-200";
    } else {
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const getPartnerStatusText = (partner) => {
    if (partner.isActive === true) {
      return "Active";
    } else if (partner.isActive === false) {
      return "Inactive";
    } else {
      return "Pending";
    }
  };

  const getServiceSupportColor = (supports) => {
    return supports
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-800 border-gray-200";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading partners...</span>
        </div>
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Truck className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No partners found
        </h3>
        <p className="text-gray-500 text-center">
          {searchTerm
            ? `No partners match your search for "${searchTerm}"`
            : "No partners have been added yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <Table>
        <TableCaption className="py-4 text-sm text-muted-foreground bg-gray-50">
          {searchTerm
            ? `Filtered partners for "${searchTerm}"`
            : "A list of courier partners"}
        </TableCaption>
        <TableHeader className="bg-gray-50">
          <TableRow className="hover:bg-gray-50">
            <TableHead className="font-semibold text-gray-700">
              Partner
            </TableHead>
            <TableHead className="font-semibold text-gray-700">Code</TableHead>
            <TableHead className="font-semibold text-gray-700">
              Status
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Services
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Coverage
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Pricing
            </TableHead>
            <TableHead className="text-right font-semibold text-gray-700">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner) => (
            <TableRow
              key={partner.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12 ring-2 ring-gray-100">
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-semibold">
                      {partner.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {partner.displayName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {partner.name}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {partner.code}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  className={`${getPartnerStatusColor(partner)} font-medium`}
                >
                  {getPartnerStatusText(partner)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Badge
                      className={`${getServiceSupportColor(partner.supportsCOD)} text-xs`}
                    >
                      COD
                    </Badge>
                    <Badge
                      className={`${getServiceSupportColor(partner.supportsReverse)} text-xs`}
                    >
                      Reverse
                    </Badge>
                  </div>
                  {partner._count && (
                    <div className="text-xs text-muted-foreground">
                      {partner._count.shipments} shipments
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="text-gray-900">
                    {partner.servicePincodes?.length || 0} pincodes
                  </div>
                  <div className="text-muted-foreground">
                    {partner.maxWeight
                      ? `Max: ${partner.maxWeight}kg`
                      : "No limit"}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm space-y-1">
                  {partner.baseRate && (
                    <div className="text-gray-900">
                      Base: ₹{partner.baseRate}
                    </div>
                  )}
                  {partner.perKgRate && (
                    <div className="text-muted-foreground">
                      Per kg: ₹{partner.perKgRate}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-semibold">
                      Actions
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => onViewPartner(partner)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => onEditPartner(partner)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Partner
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {partner.isActive === true ? (
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeactivatePartner(partner)}
                      >
                        <PowerOff className="mr-2 h-4 w-4" />
                        Deactivate Partner
                      </DropdownMenuItem>
                    ) : partner.isActive === false ? (
                      <DropdownMenuItem
                        className="text-green-600 cursor-pointer"
                        onClick={() => onActivatePartner(partner)}
                      >
                        <Power className="mr-2 h-4 w-4" />
                        Activate Partner
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="text-green-600 cursor-pointer"
                        onClick={() => onActivatePartner(partner)}
                      >
                        <Power className="mr-2 h-4 w-4" />
                        Activate Partner
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer"
                      onClick={() => onDeletePartner(partner)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Partner
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PartnerShipmentsTable({ shipments, searchTerm }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <Table>
        <TableCaption className="py-4 text-sm text-muted-foreground bg-gray-50">
          {searchTerm
            ? `Filtered partner shipments for "${searchTerm}"`
            : "A list of partner shipments"}
        </TableCaption>
        <TableHeader className="bg-gray-50">
          <TableRow className="hover:bg-gray-50">
            <TableHead className="font-semibold text-gray-700">
              Tracking #
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Partner
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Customer
            </TableHead>
            <TableHead className="font-semibold text-gray-700">Route</TableHead>
            <TableHead className="font-semibold text-gray-700">
              Status
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Payment
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Charges
            </TableHead>
            <TableHead className="text-right font-semibold text-gray-700">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow
              key={shipment.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <TableCell className="font-medium">
                <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {shipment.trackingNumber}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium text-gray-900">
                  {shipment.partnerName}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {shipment.customerName}
                  </div>
                  <div className="text-muted-foreground font-mono">
                    {shipment.customerPhone}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {shipment.origin}
                  </div>
                  <div className="text-muted-foreground flex items-center">
                    <span className="mr-1">→</span>
                    {shipment.destination}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  className={`${getPartnerShipmentStatusColor(shipment.status)} font-medium`}
                >
                  {shipment.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`font-medium ${
                    shipment.paymentMode === "prepaid"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-orange-50 text-orange-700 border-orange-200"
                  }`}
                >
                  {shipment.paymentMode.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm space-y-1">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(shipment.charges)}
                  </div>
                  <div className="text-muted-foreground">
                    Comm: {formatCurrency(shipment.commission)}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-semibold">
                      Actions
                    </DropdownMenuLabel>
                    <DropdownMenuItem className="cursor-pointer">
                      <Eye className="mr-2 h-4 w-4" />
                      Track Shipment
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Edit className="mr-2 h-4 w-4" />
                      Update Status
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 cursor-pointer">
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
    </div>
  );
}
