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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  mockRemittances,
  mockRetailers,
  formatWeight,
  formatAmount,
  type Remittance,
} from "@/lib/mock-data";
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Package,
  Clock,
  Download,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export default function RemittancePage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Remittance", href: "/remittance" },
    { title: "Pending COD Settlement" },
  ];

  const [selectedRetailer, setSelectedRetailer] = useState("All");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter remittances based on search term and retailer
  const filteredRemittances = mockRemittances.filter((item) => {
    const retailerMatch =
      selectedRetailer === "All" || item.outlet === selectedRetailer;
    const searchMatch =
      searchTerm === "" ||
      item.receiver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.awbNumber.toLowerCase().includes(searchTerm.toLowerCase());

    return retailerMatch && searchMatch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredRemittances.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRemittances = filteredRemittances.slice(startIndex, endIndex);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(paginatedRemittances.map((item) => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, id]);
    } else {
      setSelectedItems((prev) => prev.filter((item) => item !== id));
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalAmount = filteredRemittances.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const selectedAmount = filteredRemittances
    .filter((item) => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header - Updated to match reports page structure */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              <span>Pending COD Settlement</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage and process pending cash on delivery settlements
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/remittance/upcoming">
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Upcoming
              </Button>
            </Link>
            <Link href="/remittance/history">
              <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                History
              </Button>
            </Link>
            <Button size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Pending
            </Button>
          </div>
        </div>

        {/* Statistics Cards - Updated to match reports page styling */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Items
                  </p>
                  <p className="text-2xl font-bold">
                    {filteredRemittances.length}
                  </p>
                  <div className="flex items-center text-sm text-blue-600">
                    <TrendingUp className="h-4 w-4 mr-1" />+
                    {filteredRemittances.length} items
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
                    Total Amount
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(totalAmount)}
                  </p>
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-4 w-4 mr-1" />+
                    {formatAmount(totalAmount)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Selected Amount
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatAmount(selectedAmount)}
                  </p>
                  <div className="flex items-center text-sm text-yellow-600">
                    <Clock className="h-4 w-4 mr-1" />
                    Ready to process
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Items
                  </p>
                  <p className="text-2xl font-bold">
                    {
                      filteredRemittances.filter((r) => r.status === "pending")
                        .length
                    }
                  </p>
                  <div className="flex items-center text-sm text-purple-600">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Requires attention
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters - Updated to match reports page styling */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span>COD Settlement Management</span>
                </CardTitle>
                <CardDescription>
                  Filter and search pending COD settlements
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
            <RemittancesTable
              remittances={paginatedRemittances}
              selectedItems={selectedItems}
              onSelectAll={handleSelectAll}
              onSelectItem={handleSelectItem}
              searchTerm={searchTerm}
            />

            {/* Pagination - Updated to match reports page styling */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
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

        {/* Action Buttons for Selected Items - Updated to match reports page styling */}
        {selectedItems.length > 0 && (
          <div className="flex gap-4 justify-end">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Selected
            </Button>
            <Button size="sm">
              <DollarSign className="mr-2 h-4 w-4" />
              Process Settlement
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function RemittancesTable({
  remittances,
  selectedItems,
  onSelectAll,
  onSelectItem,
  searchTerm,
}: {
  remittances: Remittance[];
  selectedItems: string[];
  onSelectAll: (_checked: boolean) => void;
  onSelectItem: (_id: string, _checked: boolean) => void;
  searchTerm: string;
}) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered remittances for "${searchTerm}"`
          : "A list of pending COD settlements"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              checked={
                selectedItems.length === remittances.length &&
                remittances.length > 0
              }
              onCheckedChange={onSelectAll}
            />
          </TableHead>
          <TableHead>#</TableHead>
          <TableHead>Ref No</TableHead>
          <TableHead>Receiver</TableHead>
          <TableHead>Courier</TableHead>
          <TableHead>Weight</TableHead>
          <TableHead>Date of Manifest</TableHead>
          <TableHead>Date of Delivery</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {remittances.map((remittance, index) => (
          <TableRow key={remittance.id} className="hover:bg-muted/50">
            <TableCell>
              <Checkbox
                checked={selectedItems.includes(remittance.id)}
                onCheckedChange={(_checked) =>
                  onSelectItem(remittance.id, _checked as boolean)
                }
              />
            </TableCell>
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>
              <div>
                <div className="font-medium">{remittance.refNo}</div>
                <div className="text-sm text-muted-foreground">
                  AWB: {remittance.awbNumber}
                </div>
              </div>
            </TableCell>
            <TableCell>{remittance.receiver}</TableCell>
            <TableCell className="text-sm">{remittance.courier}</TableCell>
            <TableCell>{formatWeight(remittance.weight)}</TableCell>
            <TableCell className="font-medium">
              {remittance.manifestDate}
            </TableCell>
            <TableCell className="font-medium">
              {remittance.deliveryDate}
            </TableCell>
            <TableCell className="font-medium">
              {formatAmount(remittance.amount)}
            </TableCell>
            <TableCell>
              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                {remittance.status}
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
                    Cancel Settlement
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
