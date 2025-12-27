"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Plus,
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  Pencil,
  Trash2,
  Loader2,
  UserPlus,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import {
  useGetOutletByIdQuery,
  useGetOutletUsersQuery,
} from "@/store/api/endpoints/customerApi";
import { baseApi } from "@/store/api/baseApi";

export default function OutletUsersPage() {
  const params = useParams();
  const router = useRouter();
  const outletId = params.id;

  // State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: "outlet_staff",
  });
  const [formErrors, setFormErrors] = useState({});

  // API hooks
  const { data: outletData, isLoading: isOutletLoading } = useGetOutletByIdQuery(outletId, {
    skip: !outletId,
  });
  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useGetOutletUsersQuery(
    { outletId },
    { skip: !outletId }
  );

  const outlet = outletData?.data?.outlet || outletData?.data?.customer;
  const outletUsers = usersData?.data?.users || [];

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets", href: "/outlets" },
    { title: outlet?.name || "Outlet", href: `/outlets/${outletId}` },
    { title: "Manage Users" },
  ];

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phone: "",
      role: "outlet_staff",
    });
    setFormErrors({});
  };

  const validateForm = (isEdit = false) => {
    const errors = {};

    if (!isEdit) {
      if (!formData.email) {
        errors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = "Invalid email format";
      }

      if (!formData.password) {
        errors.password = "Password is required";
      } else if (formData.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    if (!formData.firstName) {
      errors.firstName = "First name is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Call API to add user to outlet
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/outlets/${outletId}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to add user");
      }

      alert("User added successfully!");
      setIsAddUserOpen(false);
      resetForm();
      refetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      alert(error.message || "Failed to add user. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!validateForm(true)) return;
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      // Update user profile (firstName, lastName, phone)
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/outlets/${outletId}/users/${selectedUser.userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to update user");
      }

      alert("User updated successfully!");
      setIsEditUserOpen(false);
      setSelectedUser(null);
      resetForm();
      refetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      alert(error.message || "Failed to update user. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/outlets/${outletId}/users/${selectedUser.userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to remove user");
      }

      alert("User removed from outlet successfully!");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      refetchUsers();
    } catch (error) {
      console.error("Error removing user:", error);
      alert(error.message || "Failed to remove user. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email || user.profile?.email || "",
      password: "",
      confirmPassword: "",
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      phone: user.profile?.phoneNumber || "",
      role: user.role || "outlet_staff",
    });
    setIsEditUserOpen(true);
  };

  const openDeleteDialog = (user) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  // Loading state
  if (isOutletLoading || isUsersLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Not found state
  if (!outlet) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">Outlet Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The outlet you&apos;re looking for doesn&apos;t exist.
              </p>
              <Button asChild>
                <Link href="/outlets">Back to Outlets</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manage Users</h1>
            <p className="text-muted-foreground mt-1">
              {outlet.name} - {outlet.code}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href={`/outlets/${outletId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Outlet
              </Link>
            </Button>
            <Button onClick={() => {
              resetForm();
              setIsAddUserOpen(true);
            }}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Outlet Users
            </CardTitle>
            <CardDescription>
              Users who have access to this outlet&apos;s dashboard and resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            {outletUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Users Found</h3>
                <p className="text-muted-foreground mb-6">
                  Add users to allow them to access this outlet&apos;s dashboard.
                </p>
                <Button onClick={() => {
                  resetForm();
                  setIsAddUserOpen(true);
                }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First User
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {outletUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-lg">
                          {user.profile?.firstName || ""}{" "}
                          {user.profile?.lastName || ""}
                          {!user.profile?.firstName && !user.profile?.lastName && "Unnamed User"}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {user.email || user.profile?.email || "No email"}
                          </span>
                          {user.profile?.phoneNumber && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {user.profile.phoneNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium capitalize">
                          {user.role?.replace(/_/g, " ") || "User"}
                        </span>
                      </div>
                      <Badge variant={user.isActive ? "success" : "destructive"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account for this outlet. They will be able to log in and access the outlet dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="John"
                  />
                  {formErrors.firstName && (
                    <p className="text-sm text-red-500">{formErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
                {formErrors.email && (
                  <p className="text-sm text-red-500">{formErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outlet_admin">Outlet Admin</SelectItem>
                    <SelectItem value="outlet_staff">Outlet Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                  {formErrors.password && (
                    <p className="text-sm text-red-500">{formErrors.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                  {formErrors.confirmPassword && (
                    <p className="text-sm text-red-500">{formErrors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user profile information. Email and password cannot be changed here.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFirstName">First Name *</Label>
                  <Input
                    id="editFirstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="John"
                  />
                  {formErrors.firstName && (
                    <p className="text-sm text-red-500">{formErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={formData.email || "Not available"}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Email is managed by the authentication system and cannot be changed here.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRole">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outlet_admin">Outlet Admin</SelectItem>
                    <SelectItem value="outlet_staff">Outlet Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditUser} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove User from Outlet?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove{" "}
                <strong>
                  {selectedUser?.profile?.firstName} {selectedUser?.profile?.lastName}
                </strong>{" "}
                from this outlet. They will no longer be able to access the outlet dashboard.
                This action can be undone by adding them back later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-red-600 hover:bg-red-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Remove User"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

