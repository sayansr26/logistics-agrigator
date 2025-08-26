"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockUsers, getRoleColor, getUserStatusColor } from "@/lib/mock-data";
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
  HelpCircle,
  X,
  CheckCircle,
} from "lucide-react";

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "User Management" },
  ];

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive" | "suspended"
  >("all");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "admin" | "client" | "operations" | "support"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const itemsPerPage = 10;

  // Check for success message in URL
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "user-created") {
      setShowSuccessMessage(true);
      // Remove the success parameter from URL
      router.replace("/users", { scroll: false });
      // Auto-hide success message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
  }, [searchParams, router]);

  // Filter data based on search term and filters
  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredUsers.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleStatusFilterChange = (
    status: "all" | "active" | "inactive" | "suspended",
  ) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleRoleFilterChange = (
    role: "all" | "admin" | "client" | "operations" | "support",
  ) => {
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

  // Statistics
  const totalUsers = mockUsers.length;
  const activeUsers = mockUsers.filter((u) => u.status === "active").length;
  const inactiveUsers = mockUsers.filter((u) => u.status === "inactive").length;
  const suspendedUsers = mockUsers.filter(
    (u) => u.status === "suspended",
  ).length;

  const handleAddNewUser = () => {
    router.push("/users/add");
  };

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
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="text-sm font-medium text-green-800">
                  User Created Successfully!
                </h3>
                <p className="text-sm text-green-700">
                  The new user has been added to the system.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuccessMessage(false)}
                className="ml-auto text-green-600 hover:text-green-800 hover:bg-green-100"
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
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-green-600 rounded-full"></div>
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
                <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-yellow-600 rounded-full"></div>
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
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                  <div className="h-4 w-4 bg-red-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Suspended Users
                  </p>
                  <p className="text-2xl font-bold">{suspendedUsers}</p>
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
                        ? "ring-2 ring-blue-500 border-blue-500"
                        : ""
                    }`}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
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
            {/* Enhanced Filter Section - Show/Hide based on state */}
            {showFilters && (
              <div className="space-y-6 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Status Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-blue-100 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700">
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
                    <Button
                      variant={
                        statusFilter === "suspended" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleStatusFilterChange("suspended")}
                      className={`transition-all duration-200 ${
                        statusFilter === "suspended"
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-md"
                          : "hover:bg-red-50 border-red-300 text-red-700"
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-current mr-2"></div>
                      Suspended
                    </Button>
                  </div>
                </div>

                {/* Role Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-purple-100 rounded-full flex items-center justify-center">
                      <div className="h-2 w-2 bg-purple-600 rounded-full"></div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-700">
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
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Active Filters:
                      </span>
                      {statusFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-800"
                        >
                          Status: {statusFilter}
                        </Badge>
                      )}
                      {roleFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-800"
                        >
                          Role: {roleFilter}
                        </Badge>
                      )}
                      {searchTerm && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
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
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {filteredUsers.length} user
                  {filteredUsers.length !== 1 ? "s" : ""} found
                </span>
                {hasActiveFilters && (
                  <span className="text-xs text-blue-600">
                    (filtered from {totalUsers} total)
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Users Table */}
            <UsersTable
              users={paginatedData}
              searchTerm={searchTerm}
              router={router}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(endIndex, filteredUsers.length)} of{" "}
                  {filteredUsers.length} results
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

function UsersTable({
  users,
  searchTerm,
  router,
}: {
  users: any[];
  searchTerm: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
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
          <TableHead>Status</TableHead>
          <TableHead>Shipments</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{user.name}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span>{user.email}</span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge className={getRoleColor(user.role)}>
                <Shield className="mr-1 h-3 w-3" />
                {user.role}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={getUserStatusColor(user.status)}>
                <Activity className="mr-1 h-3 w-3" />
                {user.status}
              </Badge>
            </TableCell>
            {/* <TableCell>
              <div className="text-sm">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>Last active: {formatDate(user.lastLogin)}</span>
                </div>
              </div>
            </TableCell> */}
            <TableCell>
              <div className="text-center">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {user.shipmentsCount}
                </Badge>
              </div>
            </TableCell>
            {/* <TableCell className="text-sm">
              {formatDate(user.lastLogin)}
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
                    onClick={() => router.push(`/users/${user.id}/permissions`)}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Manage Permissions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-yellow-600">
                    <Activity className="mr-2 h-4 w-4" />
                    {user.status === "active" ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {user.status === "suspended"
                      ? "Delete User"
                      : "Suspend User"}
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
