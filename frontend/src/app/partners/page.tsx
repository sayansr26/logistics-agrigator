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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  mockPartners,
  mockPartnerShipments,
  getPartnerStatusColor,
  getPartnerTypeColor,
  getPartnerShipmentStatusColor,
  getRatingColor,
  formatRating,
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
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function PartnersPage() {
  const router = useRouter();
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Courier Partners" },
  ];

  // Mock data for demonstration
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"partners" | "shipments">(
    "partners",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter data based on search term
  const filteredPartners = mockPartners.filter(
    (partner) =>
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredPartnerShipments = mockPartnerShipments.filter(
    (shipment) =>
      shipment.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.trackingNumber
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      shipment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Pagination logic
  const currentData =
    activeTab === "partners" ? filteredPartners : filteredPartnerShipments;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = currentData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleTabChange = (tab: "partners" | "shipments") => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset to first page when changing tabs
  };

  // Partner management handlers
  const handleAddPartner = () => {
    router.push("/partners/add");
  };

  const handleViewPartner = (partner: any) => {
    router.push(`/partners/${partner.id}`);
  };

  const handleEditPartner = (partner: any) => {
    router.push(`/partners/${partner.id}/edit`);
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                    {mockPartners.length}
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
                    {mockPartners.filter((p) => p.status === "active").length}
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

          <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-orange-100 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Avg Delivery Time
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {Math.round(
                      (mockPartners.reduce(
                        (acc, p) => acc + p.performance.avgDeliveryTime,
                        0,
                      ) /
                        mockPartners.length) *
                        10,
                    ) / 10}{" "}
                    days
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
              <PartnersTable
                partners={paginatedData}
                searchTerm={searchTerm}
                onViewPartner={handleViewPartner}
                onEditPartner={handleEditPartner}
              />
            ) : (
              <PartnerShipmentsTable
                shipments={paginatedData}
                searchTerm={searchTerm}
              />
            )}

            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
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
                    className="border-gray-200 hover:bg-gray-50"
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
                        className={
                          currentPage === page
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "border-gray-200 hover:bg-gray-50"
                        }
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
}: {
  partners: any[];
  searchTerm: string;
  onViewPartner: (_partner: any) => void;
  onEditPartner: (_partner: any) => void;
}) {
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
            <TableHead className="font-semibold text-gray-700">Type</TableHead>
            <TableHead className="font-semibold text-gray-700">
              Status
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Rating
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Performance
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Contact
            </TableHead>
            <TableHead className="text-right font-semibold text-gray-700">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* eslint-disable-next-line no-unused-vars */}
          {partners.map((partner) => (
            <TableRow
              key={partner.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12 ring-2 ring-gray-100">
                    <AvatarImage src={partner.logo} alt={partner.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-semibold">
                      {partner.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {partner.name}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center space-x-2">
                      <Clock className="h-3 w-3" />
                      <span>{partner.deliveryTime}</span>
                      <span>•</span>
                      <MapPin className="h-3 w-3" />
                      <span>{partner.coverage.join(", ")}</span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  className={`${getPartnerTypeColor(partner.type)} font-medium`}
                >
                  {partner.type}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  className={`${getPartnerStatusColor(partner.status)} font-medium`}
                >
                  {partner.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= partner.rating
                            ? `${getRatingColor(partner.rating)} fill-current`
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-sm font-medium ${getRatingColor(partner.rating)}`}
                  >
                    {formatRating(partner.rating)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-gray-900">
                      {partner.performance.totalShipments.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">
                      {partner.performance.successRate}% success rate
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600"
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
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
                    <DropdownMenuItem className="text-red-600 cursor-pointer">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Deactivate Partner
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

function PartnerShipmentsTable({
  shipments,
  searchTerm,
}: {
  shipments: any[];
  searchTerm: string;
}) {
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
