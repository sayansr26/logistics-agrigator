"use client";

import React, { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  Edit,
  Trash2,
  Loader2,
  Users,
  AlertCircle,
  Save,
  Shield,
  Mail,
  Phone,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";
import {
  useGetOutletUsersQuery,
  useCreateOutletUserMutation,
  useUpdateOutletUserMutation,
  useRemoveOutletUserMutation,
  useGetOutletByIdQuery,
} from "@/store/api/endpoints/customerApi";

export default function OutletTeamManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const outletId = user?.outletId;

  // RTK Query hooks
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    error: usersError,
    refetch: refetchUsers,
  } = useGetOutletUsersQuery(
    { outletId: outletId || "" },
    { skip: !outletId }
  );

  const {
    data: outletData,
    isLoading: isLoadingOutlet,
  } = useGetOutletByIdQuery(outletId || "", { skip: !outletId });

  const [createOutletUser, { isLoading: isCreating }] = useCreateOutletUserMutation();
  const [updateOutletUser, { isLoading: isUpdating }] = useUpdateOutletUserMutation();
  const [removeOutletUser, { isLoading: isRemoving }] = useRemoveOutletUserMutation();

  // Derived state
  const outletUsers = usersData?.data?.users || [];
  const outletInfo = outletData?.data?.outlet || usersData?.data?.outlet;
  const isLoading = isLoadingUsers || isLoadingOutlet;
  const isSubmitting = isCreating || isUpdating || isRemoving;

  // Modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [newUserData, setNewUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    role: "outlet_staff",
  });

  const [editUserData, setEditUserData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    role: "outlet_staff",
    isActive: true,
  });

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Team Management" },
  ];

  // Redirect if not outlet admin
  useEffect(() => {
    if (user && user.role !== "outlet_admin") {
      toast.error("You don't have permission to access this page");
      router.push("/dashboard");
    }
  }, [user, router, toast]);

  // Populate edit form when user is selected
  useEffect(() => {
    if (selectedUser) {
      setEditUserData({
        firstName: selectedUser.profile?.firstName || "",
        lastName: selectedUser.profile?.lastName || "",
        phoneNumber: selectedUser.profile?.phoneNumber || "",
        role: selectedUser.role,
        isActive: selectedUser.isActive,
      });
    }
  }, [selectedUser]);

  const handleNewUserInputChange = (field, value) => {
    setNewUserData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditUserInputChange = (field, value) => {
    setEditUserData((prev) => ({ ...prev, [field]: value }));
  };

  const resetNewUserForm = () => {
    setNewUserData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phoneNumber: "",
      role: "outlet_staff",
    });
  };

  const validateNewUser = () => {
    if (!newUserData.firstName.trim()) {
      toast.error("First name is required");
      return false;
    }
    if (!newUserData.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserData.email)) {
      toast.error("Invalid email format");
      return false;
    }
    if (!newUserData.password) {
      toast.error("Password is required");
      return false;
    }
    if (newUserData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }
    if (newUserData.password !== newUserData.confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleAddUser = async () => {
    if (!validateNewUser()) return;

    try {
      await createOutletUser({
        outletId,
        data: {
          firstName: newUserData.firstName,
          lastName: newUserData.lastName,
          email: newUserData.email,
          password: newUserData.password,
          phoneNumber: newUserData.phoneNumber,
          role: newUserData.role,
        },
      }).unwrap();

      toast.success("Team member added successfully!");
      setIsAddUserModalOpen(false);
      resetNewUserForm();
    } catch (error) {
      console.error("Error adding team member:", error);
      toast.error(error?.data?.error?.message || error?.message || "Failed to add team member");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      await updateOutletUser({
        outletId,
        userId: selectedUser.userId,
        data: editUserData,
      }).unwrap();

      toast.success("Team member updated successfully!");
      setIsEditUserModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error updating team member:", error);
      toast.error(error?.data?.error?.message || error?.message || "Failed to update team member");
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedUser) return;

    try {
      await removeOutletUser({
        outletId,
        userId: selectedUser.userId,
      }).unwrap();

      toast.success("Team member removed successfully!");
      setIsRemoveDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error removing team member:", error);
      toast.error(error?.data?.error?.message || error?.message || "Failed to remove team member");
    }
  };

  // Check if user can be managed (can't manage yourself)
  const canManageUser = (targetUser) => {
    if (targetUser.userId === user?.id) return false;
    return true;
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // No outlet access
  if (!outletId) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">No Outlet Access</h2>
              <p className="text-muted-foreground mb-6">
                You are not associated with any outlet.
              </p>
              <Button onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (usersError) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">Error Loading Team</h2>
              <p className="text-muted-foreground mb-6">
                Failed to load team members. Please try again.
              </p>
              <Button onClick={() => refetchUsers()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="h-8 w-8" />
              Team Management
            </h1>
            <p className="text-muted-foreground mt-1">
              {outletInfo?.name && `Manage your team members for ${outletInfo.name}`}
            </p>
          </div>
          <Button onClick={() => setIsAddUserModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">{outletUsers.length}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Admins</p>
                  <p className="text-2xl font-bold">
                    {outletUsers.filter(u => u.role === "outlet_admin").length}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Staff</p>
                  <p className="text-2xl font-bold">
                    {outletUsers.filter(u => u.isActive && u.role === "outlet_staff").length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members List */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage staff members who have access to your outlet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {outletUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Team Members Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Add team members to help manage your outlet operations.
                </p>
                <Button onClick={() => setIsAddUserModalOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Team Member
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outletUsers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {member.profile?.firstName} {member.profile?.lastName}
                          {member.userId === user?.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {member.email || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {member.profile?.phoneNumber || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.role === "outlet_admin" ? "default" : "secondary"}
                        >
                          {member.role === "outlet_admin" ? "Admin" : "Staff"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.isActive ? "success" : "destructive"}>
                          {member.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageUser(member) ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(member);
                                setIsEditUserModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedUser(member);
                                setIsRemoveDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add User Modal */}
      <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Team Member
            </DialogTitle>
            <DialogDescription>
              Create a new account for a team member to access your outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newUserData.firstName}
                  onChange={(e) => handleNewUserInputChange("firstName", e.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newUserData.lastName}
                  onChange={(e) => handleNewUserInputChange("lastName", e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUserData.email}
                onChange={(e) => handleNewUserInputChange("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => handleNewUserInputChange("password", e.target.value)}
                  placeholder="Min 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={newUserData.confirmPassword}
                  onChange={(e) => handleNewUserInputChange("confirmPassword", e.target.value)}
                  placeholder="Confirm password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={newUserData.phoneNumber}
                onChange={(e) => handleNewUserInputChange("phoneNumber", e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUserData.role}
                onValueChange={(value) => handleNewUserInputChange("role", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet_staff">Staff</SelectItem>
                  <SelectItem value="outlet_admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins can manage team members and all outlet settings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={isSubmitting}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditUserModalOpen} onOpenChange={setIsEditUserModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Team Member
            </DialogTitle>
            <DialogDescription>
              Update team member information and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={selectedUser?.email || "Not available"}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={editUserData.firstName}
                  onChange={(e) => handleEditUserInputChange("firstName", e.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={editUserData.lastName}
                  onChange={(e) => handleEditUserInputChange("lastName", e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhoneNumber">Phone Number</Label>
              <Input
                id="editPhoneNumber"
                value={editUserData.phoneNumber}
                onChange={(e) => handleEditUserInputChange("phoneNumber", e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select
                value={editUserData.role}
                onValueChange={(value) => handleEditUserInputChange("role", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet_staff">Staff</SelectItem>
                  <SelectItem value="outlet_admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="editIsActive">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive members cannot access the outlet
                </p>
              </div>
              <Switch
                id="editIsActive"
                checked={editUserData.isActive}
                onCheckedChange={(checked) => handleEditUserInputChange("isActive", checked)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isSubmitting}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Confirmation */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <strong>
                {selectedUser?.profile?.firstName} {selectedUser?.profile?.lastName}
              </strong>{" "}
              from your outlet. They will no longer have access to outlet operations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
