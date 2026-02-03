"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PageHeader,
  PageContainer,
  StatsCard,
  StatsGrid,
  DataTablePagination,
} from "@/components/shared";
import {
  useGetUsersQuery,
  useActivateUserMutation,
  useDeactivateUserMutation,
  useDeleteUserMutation,
} from "@/store/api/endpoints/userApi";
import { getRoleColor, getUserStatusColor } from "@/lib/mock-data";
import {
  Users,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Shield,
  Activity,
  Mail,
  Phone,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
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

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const itemsPerPage = 10;

  // Dialog states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // RTK Query
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
    isActive: statusFilter !== "all" ? statusFilter === "active" : undefined,
  });

  const [activateUser, { isLoading: isActivating }] = useActivateUserMutation();
  const [deactivateUser, { isLoading: isDeactivating }] =
    useDeactivateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const users = usersData?.data?.users || [];
  const totalUsers = usersData?.data?.pagination?.total || 0;
  const totalPages = usersData?.data?.pagination?.totalPages || 1;
  const activeUsers = users.filter((u: User) => u.isActive).length;
  const inactiveUsers = users.filter((u: User) => !u.isActive).length;

  const hasActiveFilters =
    statusFilter !== "all" || roleFilter !== "all" || searchTerm !== "";

  // Handle success message
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "user-created") {
      setShowSuccessMessage(true);
      router.replace("/users", { scroll: false });
      setTimeout(() => setShowSuccessMessage(false), 5000);
      refetch();
    }
  }, [searchParams, router, refetch]);

  const clearAllFilters = () => {
    setStatusFilter("all");
    setRoleFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    try {
      if (selectedUser.isActive) {
        await deactivateUser(selectedUser.id).unwrap();
      } else {
        await activateUser(selectedUser.id).unwrap();
      }
      setShowConfirmDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Failed to toggle user status:", error);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await deleteUser(selectedUser.id).unwrap();
      setShowDeleteDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Users</h3>
            <p className="text-muted-foreground mb-4">An error occurred</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start justify-between">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Success!</h3>
                <p className="text-sm text-green-700">
                  User created successfully.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccessMessage(false)}
              className="text-green-400 hover:text-green-500"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <PageHeader
          title="User Management"
          description="Manage user accounts, permissions, and access control"
          primaryAction={{ label: "Add User", href: "/users/add" }}
        />

        {/* Statistics Cards */}
        <StatsGrid columns={4}>
          <StatsCard
            title="Total Users"
            value={totalUsers}
            icon={Users}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Active Users"
            value={activeUsers}
            icon={CheckCircle}
            iconColor="text-green-600"
          />
          <StatsCard
            title="Inactive Users"
            value={inactiveUsers}
            icon={XCircle}
            iconColor="text-yellow-600"
          />
          <StatsCard
            title="Admins"
            value={
              users.filter(
                (u: User) => u.role === "admin" || u.role === "superadmin",
              ).length
            }
            icon={Shield}
            iconColor="text-red-600"
          />
        </StatsGrid>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("active");
                    setCurrentPage(1);
                  }}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === "inactive" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("inactive");
                    setCurrentPage(1);
                  }}
                >
                  Inactive
                </Button>
              </div>

              {/* Role Filter */}
              <div className="flex gap-2">
                <Button
                  variant={roleFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setRoleFilter("all");
                    setCurrentPage(1);
                  }}
                >
                  All Roles
                </Button>
                <Button
                  variant={roleFilter === "admin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setRoleFilter("admin");
                    setCurrentPage(1);
                  }}
                >
                  Admin
                </Button>
                <Button
                  variant={roleFilter === "client" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setRoleFilter("client");
                    setCurrentPage(1);
                  }}
                >
                  Client
                </Button>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
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
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {user.firstName && user.lastName
                                ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                                : user.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link
                              href={`/users/${user.id}`}
                              className="font-medium hover:underline"
                            >
                              {user.firstName || user.lastName
                                ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                : user.email}
                            </Link>
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
                          {user.role === "superadmin" ||
                          user.role === "admin" ? (
                            <Badge variant="secondary" className="text-xs">
                              All Permissions
                            </Badge>
                          ) : user.permissions &&
                            user.permissions.length > 0 ? (
                            <>
                              {user.permissions
                                .slice(0, 2)
                                .map((permission) => (
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
                                  +{user.permissions.length - 2}
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
                        {user.isActive ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Activity className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Activity className="mr-1 h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
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
                              onClick={() =>
                                router.push(`/users/${user.id}/edit`)
                              }
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
                              onClick={() => {
                                setSelectedUser(user);
                                setShowConfirmDialog(true);
                              }}
                            >
                              <Activity className="mr-2 h-4 w-4" />
                              {user.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteDialog(true);
                              }}
                              disabled={user.role === "superadmin"}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalUsers}
            pageSize={itemsPerPage}
          />
        )}

        {/* Toggle Status Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span>Confirm Action</span>
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to{" "}
                {selectedUser?.isActive ? "deactivate" : "activate"}{" "}
                <strong>{selectedUser?.email}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                disabled={isActivating || isDeactivating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleToggleStatus}
                disabled={isActivating || isDeactivating}
                className={
                  selectedUser?.isActive
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-green-600 hover:bg-green-700"
                }
              >
                {(isActivating || isDeactivating) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedUser?.isActive ? "Deactivate" : "Activate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                <span>Delete User</span>
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete{" "}
                <strong>{selectedUser?.email}</strong>? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}
