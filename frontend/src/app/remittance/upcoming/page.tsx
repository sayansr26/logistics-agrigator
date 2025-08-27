"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  formatAmount,
  formatWeight,
} from "@/lib/mock-data";
import {
  Calendar,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function UpcomingRemittancesPage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Remittance", href: "/remittance" },
    { title: "Upcoming Remittances" },
  ];

  const [selectedRetailer, setSelectedRetailer] = useState("All");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter for upcoming remittances (status pending)
  const upcomingRemittances = mockRemittances.filter(
    (item) => item.status === "pending",
  );

  // Filter based on search term and retailer
  const filteredRemittances = upcomingRemittances.filter((item) => {
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

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">
            Upcoming Remittances
          </h1>
          <p className="text-muted-foreground">
            View and manage upcoming cash on delivery settlements
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-blue-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Upcoming Items
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
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-green-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Amount
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(
                      filteredRemittances.reduce(
                        (sum, item) => sum + item.amount,
                        0,
                      ),
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-yellow-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Selected Amount
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatAmount(
                      filteredRemittances
                        .filter((item) => selectedItems.includes(item.id))
                        .reduce((sum, item) => sum + item.amount, 0),
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-purple-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Average Amount
                  </p>
                  <p className="text-2xl font-bold">
                    {filteredRemittances.length > 0
                      ? formatAmount(
                          filteredRemittances.reduce(
                            (sum, item) => sum + item.amount,
                            0,
                          ) / filteredRemittances.length,
                        )
                      : formatAmount(0)}
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
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Upcoming Remittances Management</span>
                </CardTitle>
                <CardDescription>
                  Filter and search upcoming COD settlements
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
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <UpcomingRemittancesTable
              remittances={paginatedRemittances}
              selectedItems={selectedItems}
              onSelectAll={handleSelectAll}
              onSelectItem={handleSelectItem}
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

        {/* Action Buttons for Selected Items */}
        {selectedItems.length > 0 && (
          <div className="flex gap-4 justify-end">
            <Button variant="outline">Export Selected</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              Schedule Settlement
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function UpcomingRemittancesTable({
  remittances,
  selectedItems,
  onSelectAll,
  onSelectItem,
  searchTerm,
}: {
  remittances: any[];
  selectedItems: string[];
  onSelectAll: (_checked: boolean) => void;
  onSelectItem: (_id: string, _checked: boolean) => void;
  searchTerm: string;
}) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered upcoming remittances for "${searchTerm}"`
          : "A list of upcoming COD settlements"}
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
          <TableHead> Date of Manifest</TableHead>
          <TableHead>Date of Delivery</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {remittances.map((remittance, index) => (
          <TableRow key={remittance.id}>
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
