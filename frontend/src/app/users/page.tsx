"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  useGetUsersQuery,
  useActivateUserMutation,
  useDeactivateUserMutation,
  useDeleteUserMutation,
} from "@/store/api/endpoints/userApi";
import { getRoleColor, getUserStatusColor } from "@/lib/mock-data";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  Mail,
  Phone,
  HelpCircle,
  X,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  permissions?: string[];
}

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "User Management" },
  ];

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const itemsPerPage = 10;

  // RTK Query - Fetch users from API
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = useGetUsersQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm || undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    isActive:
      statusFilter !== "all"
        ? statusFilter === "active"
          ? true
          : false
        : undefined,
  });

  // Extract users from API response
  const users = usersData?.data?.users || [];
  const totalUsers = usersData?.data?.pagination?.total || 0;
  const totalPages = usersData?.data?.pagination?.totalPages || 1;

  // Check for success message in URL
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "user-created") {
      setShowSuccessMessage(true);
      // Remove the success parameter from URL
      router.replace("/users", { scroll: false });
      // Auto-hide success message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
      // Refetch users to show newly created user
      refetch();
    }
  }, [searchParams, router, refetch]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role);
    setCurrentPage(1);
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setRoleFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    statusFilter !== "all" || roleFilter !== "all" || searchTerm !== "";

  // Calculate statistics from all users (not filtered)
  const activeUsers = users.filter((u: User) => u.isActive).length;
  const inactiveUsers = users.filter((u: User) => !u.isActive).length;

  const handleAddNewUser = () => {
    router.push("/users/add");
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                  <h3 className="text-lg font-semibold">
                    Failed to Load Users
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(error as any)?.data?.error?.message ||
                      "An error occurred while fetching users"}
                  </p>
                  <Button onClick={() => refetch()}>Try Again</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              User Management
            </h1>
            <p className="text-muted-foreground">
              Manage user accounts, permissions, and access control
            </p>
          </div>
          <Button
            className="flex items-center space-x-2"
            onClick={handleAddNewUser}
          >
            <UserPlus className="h-4 w-4" />
            <span>Add New User</span>
          </Button>
        </div>

        {/* Success Message */}
        {showSuccessMessage && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                  User Created Successfully!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-400">
                  The new user has been added to the system.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuccessMessage(false)}
                className="ml-auto text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Users
                  </p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-green-600 dark:bg-green-400 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </p>
                  <p className="text-2xl font-bold">{activeUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-yellow-600 dark:bg-yellow-400 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Inactive Users
                  </p>
                  <p className="text-2xl font-bold">{inactiveUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-red-600 dark:bg-red-400 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Suspended Users
                  </p>
                  <p className="text-2xl font-bold">
                    {totalUsers - activeUsers - inactiveUsers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </CardTitle>
                <CardDescription>
                  Search, filter, and manage user accounts across the platform
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    className={`pl-10 w-64 transition-all duration-200 ${
                      isSearchFocused
                        ? "ring-2 ring-blue-500 dark:ring-blue-600 border-blue-500 dark:border-blue-600"
                        : ""
                    }`}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="icon"
                  onClick={toggleFilters}
                  className="transition-all duration-200"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Enhanced Filter Section */}
            {showFilters && (
              <div className="space-y-6 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                {/* Status Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filter by Status
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={statusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusFilterChange("all")}
                      className={`transition-all duration-200 ${
                        statusFilter === "all"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                          : "hover:bg-gray-50 border-gray-300"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      All Status
                    </Button>
                    <Button
                      variant={
                        statusFilter === "active" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleStatusFilterChange("active")}
                      className={`transition-all duration-200 ${
                        statusFilter === "active"
                          ? "bg-green-600 hover:bg-green-700 text-white shadow-md"
                          : "hover:bg-green-50 border-green-300 text-green-700"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      Active
                    </Button>
                    <Button
                      variant={
                        statusFilter === "inactive" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleStatusFilterChange("inactive")}
                      className={`transition-all duration-200 ${
                        statusFilter === "inactive"
                          ? "bg-yellow-600 hover:bg-yellow-700 text-white shadow-md"
                          : "hover:bg-yellow-50 border-yellow-300 text-yellow-700"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      Inactive
                    </Button>
                  </div>
                </div>

                {/* Role Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-purple-600 dark:bg-purple-400 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filter by Role
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={roleFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleRoleFilterChange("all")}
                      className={`transition-all duration-200 ${
                        roleFilter === "all"
                          ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                          : "hover:bg-purple-50 border-purple-300"
                      }`}
                    >
                      <Shield className="h-3 w-3 mr-2" />
                      All Roles
                    </Button>
                    <Button
                      variant={roleFilter === "admin" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleRoleFilterChange("admin")}
                      className={`transition-all duration-200 ${
                        roleFilter === "admin"
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-md"
                          : "hover:bg-red-50 border-red-300 text-red-700"
                      }`}
                    >
                      <Shield className="h-3 w-3 mr-2" />
                      Admin
                    </Button>
                    <Button
                      variant={roleFilter === "client" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleRoleFilterChange("client")}
                      className={`transition-all duration-200 ${
                        roleFilter === "client"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                          : "hover:bg-blue-50 border-blue-300 text-blue-700"
                      }`}
                    >
                      <Users className="h-3 w-3 mr-2" />
                      Client
                    </Button>
                    <Button
                      variant={
                        roleFilter === "operations" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleRoleFilterChange("operations")}
                      className={`transition-all duration-200 ${
                        roleFilter === "operations"
                          ? "bg-orange-600 hover:bg-orange-700 text-white shadow-md"
                          : "hover:bg-orange-50 border-orange-300 text-orange-700"
                      }`}
                    >
                      <Activity className="h-3 w-3 mr-2" />
                      Operations
                    </Button>
                    <Button
                      variant={roleFilter === "support" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleRoleFilterChange("support")}
                      className={`transition-all duration-200 ${
                        roleFilter === "support"
                          ? "bg-teal-600 hover:bg-teal-700 text-white shadow-md"
                          : "hover:bg-teal-50 border-teal-300 text-teal-700"
                      }`}
                    >
                      <HelpCircle className="h-3 w-3 mr-2" />
                      Support
                    </Button>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {hasActiveFilters && (
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Active Filters:
                      </span>
                      {statusFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300"
                        >
                          Status: {statusFilter}
                        </Badge>
                      )}
                      {roleFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300"
                        >
                          Role: {roleFilter}
                        </Badge>
                      )}
                      {searchTerm && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300"
                        >
                          Search: &quot;{searchTerm}&quot;
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Results Summary */}
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {users.length} user{users.length !== 1 ? "s" : ""} found
                </span>
                {hasActiveFilters && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    (filtered from {totalUsers} total)
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Users Table */}
            <UsersTable users={users} searchTerm={searchTerm} router={router} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing page {currentPage} of {totalPages}
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

interface UsersTableProps {
  users: User[];
  searchTerm: string;
  router: any;
}

function UsersTable({ users, searchTerm, router }: UsersTableProps) {
  // RTK Query mutations
  const [activateUser, { isLoading: isActivating }] = useActivateUserMutation();
  const [deactivateUser, { isLoading: isDeactivating }] =
    useDeactivateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    email: string;
    isActive: boolean;
    role?: string;
  } | null>(null);

  // Helper to determine status string from isActive
  const getStatus = (isActive: boolean) => (isActive ? "active" : "inactive");

  // Open confirmation dialog
  const openConfirmDialog = (
    userId: string,
    userEmail: string,
    isActive: boolean,
  ) => {
    setSelectedUser({ id: userId, email: userEmail, isActive });
    setShowConfirmDialog(true);
  };

  // Close confirmation dialog
  const closeConfirmDialog = () => {
    setShowConfirmDialog(false);
    setSelectedUser(null);
  };

  // Handle activate/deactivate user after confirmation
  const handleConfirmToggleStatus = async () => {
    if (!selectedUser) return;

    try {
      if (selectedUser.isActive) {
        await deactivateUser(selectedUser.id).unwrap();
      } else {
        await activateUser(selectedUser.id).unwrap();
      }
      closeConfirmDialog();
    } catch (error) {
      console.error("Failed to toggle user status:", error);
      // You can add a toast notification here
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (
    userId: string,
    userEmail: string,
    userRole: string,
  ) => {
    setSelectedUser({
      id: userId,
      email: userEmail,
      isActive: false,
      role: userRole,
    });
    setShowDeleteDialog(true);
  };

  // Close delete confirmation dialog
  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setSelectedUser(null);
  };

  // Handle delete user after confirmation
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    try {
      await deleteUser(selectedUser.id).unwrap();
      closeDeleteDialog();
    } catch (error) {
      console.error("Failed to delete user:", error);
      // You can add a toast notification here
    }
  };

  return (
    <>
      <Table>
        <TableCaption>
          {searchTerm
            ? `Filtered users for &quot;${searchTerm}&quot;`
            : "A list of all system users"}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                      {user.firstName && user.lastName
                        ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                        : user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {user.firstName || user.lastName
                        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                        : user.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span>{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getRoleColor(user.role)}>
                  <Shield className="mr-1 h-3 w-3" />
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.role === "superadmin" || user.role === "admin" ? (
                    <Badge variant="secondary" className="text-xs">
                      All Permissions
                    </Badge>
                  ) : user.permissions && user.permissions.length > 0 ? (
                    <>
                      {user.permissions.slice(0, 2).map((permission) => (
                        <Badge
                          key={permission}
                          variant="secondary"
                          className="text-xs"
                        >
                          {permission}
                        </Badge>
                      ))}
                      {user.permissions.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{user.permissions.length - 2} more
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No permissions
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getUserStatusColor(getStatus(user.isActive))}>
                  <Activity className="mr-1 h-3 w-3" />
                  {user.isActive ? "Active" : "Inactive"}
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
                    <DropdownMenuItem
                      onClick={() => router.push(`/users/${user.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push(`/users/${user.id}/edit`)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit User
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/users/${user.id}/permissions`)
                      }
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Manage Permissions
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-yellow-600"
                      onClick={() =>
                        openConfirmDialog(user.id, user.email, user.isActive)
                      }
                      disabled={isActivating || isDeactivating}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      {user.isActive ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() =>
                        openDeleteDialog(user.id, user.email, user.role)
                      }
                      disabled={isDeleting || user.role === "superadmin"}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span>Confirm Action</span>
            </DialogTitle>
            <DialogDescription className="pt-4">
              {selectedUser?.isActive ? (
                <div className="space-y-3">
                  <p className="text-base">
                    Are you sure you want to{" "}
                    <span className="font-semibold text-yellow-700">
                      deactivate
                    </span>{" "}
                    this user?
                  </p>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">
                      {selectedUser?.email}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Warning:</strong> The user will lose access to the
                      system and won&apos;t be able to log in.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-base">
                    Are you sure you want to{" "}
                    <span className="font-semibold text-green-700">
                      activate
                    </span>{" "}
                    this user?
                  </p>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium">
                      {selectedUser?.email}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      The user will regain access to the system and be able to
                      log in.
                    </p>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={closeConfirmDialog}
              disabled={isActivating || isDeactivating}
            >
              Cancel
            </Button>
            <Button
              variant={selectedUser?.isActive ? "destructive" : "default"}
              onClick={handleConfirmToggleStatus}
              disabled={isActivating || isDeactivating}
              className={
                selectedUser?.isActive
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {isActivating || isDeactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {selectedUser?.isActive ? "Deactivate User" : "Activate User"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              <span>Confirm Deletion</span>
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-4">
                <p className="text-base font-semibold text-red-700">
                  Are you sure you want to permanently delete this user?
                </p>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">
                    {selectedUser?.email}
                  </p>
                  {selectedUser?.role && (
                    <p className="text-xs text-red-600 mt-1">
                      Role: {selectedUser.role}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-red-100 border-2 border-red-300 rounded-lg">
                  <p className="text-sm text-red-900 font-semibold mb-2">
                    ⚠️ Warning: This action cannot be undone!
                  </p>
                  <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                    <li>The user account will be permanently deleted</li>
                    <li>All associated data will be removed</li>
                    <li>The user will lose all access immediately</li>
                  </ul>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
