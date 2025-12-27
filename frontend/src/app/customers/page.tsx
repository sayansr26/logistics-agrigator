"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Users,
  Store,
  UserCheck,
  Building,
  Filter,
  RefreshCw,
  Download,
} from "lucide-react";
import {
  useGetCustomersQuery,
  useDeleteCustomerMutation,
  type Customer,
  type CustomerType,
} from "@/store/api/endpoints/customerApi";
import { useAuth } from "@/hooks/useAuth";

export default function CustomersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<
    CustomerType | "ALL"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "active" | "inactive"
  >("ALL");
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );

  // Check if user can manage B2B customers (superadmin, admin)
  const canManageB2BCustomers =
    user?.role === "superadmin" || user?.role === "admin";

  // Build query params
  const queryParams = {
    page,
    limit: 10,
    ...(search && { search }),
    ...(customerTypeFilter !== "ALL" && { customerType: customerTypeFilter }),
    ...(statusFilter !== "ALL" && { isActive: statusFilter === "active" }),
  };

  const { data, isLoading, isFetching, refetch } =
    useGetCustomersQuery(queryParams);
  const [deleteCustomer, { isLoading: isDeleting }] =
    useDeleteCustomerMutation();

  const customers = data?.data?.customers || [];
  const pagination = data?.data?.pagination;

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Customer Management" },
  ];

  const handleViewCustomer = (customer: Customer) => {
    router.push(`/customers/${customer.id}`);
  };

  const handleEditCustomer = (customer: Customer) => {
    router.push(`/customers/${customer.id}/edit`);
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (customerToDelete) {
      try {
        await deleteCustomer(customerToDelete.id).unwrap();
        setDeleteDialogOpen(false);
        setCustomerToDelete(null);
      } catch (error) {
        console.error("Failed to delete customer:", error);
      }
    }
  };

  const getCustomerTypeBadge = (type: CustomerType) => {
    if (type === "B2C") {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          <UserCheck className="w-3 h-3 mr-1" />
          B2C
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
        <Store className="w-3 h-3 mr-1" />
        B2B
      </Badge>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          Active
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
        Inactive
      </Badge>
    );
  };

  // Stats calculation
  const b2cCount = customers.filter((c) => c.customerType === "B2C").length;
  const b2bCount = customers.filter((c) => c.customerType === "B2B").length;
  const activeCount = customers.filter((c) => c.isActive).length;

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Customer Management
            </h1>
            <p className="text-muted-foreground">
              Manage B2C (Direct) and B2B (Outlet) customers
            </p>
          </div>
          <Button
            onClick={() => router.push("/customers/add")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Customers
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pagination?.total || customers.length}
              </div>
              <p className="text-xs text-muted-foreground">All customer types</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                B2C Customers
              </CardTitle>
              <UserCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{b2cCount}</div>
              <p className="text-xs text-muted-foreground">Direct customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                B2B Customers
              </CardTitle>
              <Store className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{b2bCount}</div>
              <p className="text-xs text-muted-foreground">Outlet customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Building className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {activeCount}
              </div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select
                value={customerTypeFilter}
                onValueChange={(value) =>
                  setCustomerTypeFilter(value as CustomerType | "ALL")
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Customer Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="B2C">B2C (Direct)</SelectItem>
                  {canManageB2BCustomers ? (
                    <SelectItem value="B2B">B2B (Outlet)</SelectItem>
                  ) : (
                    <SelectItem value="B2B" disabled>
                      <span className="flex items-center gap-2">
                        B2B (Outlet)
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "ALL" | "active" | "inactive")
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
            <CardDescription>
              {pagination
                ? `Showing ${customers.length} of ${pagination.total} customers`
                : `${customers.length} customers`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No customers found</h3>
                <p className="text-muted-foreground mb-4">
                  {search ||
                  customerTypeFilter !== "ALL" ||
                  statusFilter !== "ALL"
                    ? "Try adjusting your filters"
                    : "Get started by adding your first customer"}
                </p>
                <Button onClick={() => router.push("/customers/add")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <span className="font-medium">{customer.name}</span>
                        </TableCell>
                        <TableCell>
                          {getCustomerTypeBadge(customer.customerType)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{customer.email}</span>
                            {customer.phone && (
                              <span className="text-muted-foreground">
                                {customer.phone}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.customerType === "B2B" && customer.outlet ? (
                            <span className="text-sm">
                              {customer.outlet.name}
                              {customer.outlet.code && (
                                <span className="text-muted-foreground ml-1">
                                  ({customer.outlet.code})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(customer.isActive)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleViewCustomer(customer)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditCustomer(customer)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(customer)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage((p) => Math.min(pagination.totalPages, p + 1))
                        }
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{customerToDelete?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
