"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRoleColor, getUserStatusColor, formatDate } from "@/lib/mock-data";
import {
  ArrowLeft,
  Edit,
  Shield,
  Activity,
  Mail,
  MapPin,
  Building,
  Phone,
  Package,
  Settings,
  UserCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Loader2,
  Calendar,
  Clock,
  Key,
  Lock,
  Unlock,
  User,
  CreditCard,
  FileText,
  ShieldCheck,
  MoreVertical,
  UserMinus,
  UserPlus,
  Trash2,
} from "lucide-react";
import {
  useGetUserByIdQuery,
  useGetUserProfileByUserIdQuery,
} from "@/store/api/endpoints/userApi";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id;
  const [activeTab, setActiveTab] = useState("overview");
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Use RTK Query to fetch user data
  const {
    data: userData,
    isLoading,
    error,
    refetch,
  } = useGetUserByIdQuery(userId);

  // Fetch user profile (extended information)
  const { data: profileData, isLoading: profileLoading } =
    useGetUserProfileByUserIdQuery(userId);

  const user = userData?.data?.user;
  const profile = profileData?.data?.profile;

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "User Management", href: "/users" },
    { title: user?.name || "User Profile" },
  ];

  const handleEditUser = () => {
    router.push(`/users/${userId}/edit`);
  };

  const handleManagePermissions = () => {
    router.push(`/users/${userId}/permissions`);
  };

  const handleBackToUsers = () => {
    router.push("/users");
  };

  const handleDisableUser = async () => {
    setActionLoading(true);
    try {
      // TODO: Replace with actual API call
      // await disableUserMutation({ userId }).unwrap();
      console.log("Disabling user:", userId);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refetch user data
      await refetch();
      setShowDisableDialog(false);
    } catch (error) {
      console.error("Failed to disable user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableUser = async () => {
    setActionLoading(true);
    try {
      // TODO: Replace with actual API call
      // await enableUserMutation({ userId }).unwrap();
      console.log("Enabling user:", userId);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refetch user data
      await refetch();
      setShowEnableDialog(false);
    } catch (error) {
      console.error("Failed to enable user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setActionLoading(true);
    try {
      // TODO: Replace with actual API call
      // await deleteUserMutation({ userId }).unwrap();
      console.log("Deleting user:", userId);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Redirect to users list
      router.push("/users");
    } catch (error) {
      console.error("Failed to delete user:", error);
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">Loading user details...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Failed to Load User
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {error?.data?.error?.message ||
                  "An error occurred while fetching user details"}
              </p>
              <Button
                onClick={handleBackToUsers}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Users</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-8 text-center">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                User Not Found
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The user you&apos;re looking for doesn&apos;t exist or has been
                removed.
              </p>
              <Button
                onClick={handleBackToUsers}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Users</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusIcon = (isActive) => {
    if (isActive) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <Pause className="h-4 w-4 text-gray-600" />;
  };

  const getStatusText = (isActive) => {
    return isActive ? "Active" : "Inactive";
  };

  const getStatusColorClass = (isActive) => {
    return isActive
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-800 border-gray-200";
  };

  // Mock permissions data - replace with actual API call
  const mockPermissions = {
    total: 39,
    categories: {
      shipment: {
        label: "Shipment Management",
        count: 8,
        permissions: ["create", "read", "update", "delete"],
      },
      customer: {
        label: "Customer Management",
        count: 6,
        permissions: ["create", "read", "update"],
      },
      wallet: {
        label: "Wallet & Billing",
        count: 5,
        permissions: ["read", "manage"],
      },
      partner: {
        label: "Partner Management",
        count: 4,
        permissions: ["read", "assign"],
      },
      reports: {
        label: "Reports & Analytics",
        count: 3,
        permissions: ["read", "export"],
      },
      settings: { label: "System Settings", count: 2, permissions: ["read"] },
    },
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Compact Hero Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border p-6">
          <div className="flex items-start justify-between gap-6">
            {/* Left: User Identity */}
            <div className="flex items-start gap-4 flex-1">
              <Avatar className="h-16 w-16 border-2 border-white shadow-md">
                <AvatarFallback className="text-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">
                    {[user.firstName, user.lastName]
                      .filter(Boolean)
                      .join(" ") || user.email}
                  </h1>
                  <Badge className={`${getStatusColorClass(user.isActive)}`}>
                    {getStatusIcon(user.isActive)}
                    <span className="ml-1">{getStatusText(user.isActive)}</span>
                  </Badge>
                  <Badge className={`${getRoleColor(user.role)}`}>
                    <Shield className="mr-1 h-3 w-3" />
                    {user.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>
                {/* Quick Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Joined{" "}
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-3" />
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    <span>{mockPermissions.total} permissions</span>
                  </div>
                  {user.twoFactorEnabled !== undefined && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <div className="flex items-center gap-1">
                        {user.twoFactorEnabled ? (
                          <Lock className="h-3 w-3 text-green-600" />
                        ) : (
                          <Unlock className="h-3 w-3 text-amber-600" />
                        )}
                        <span>
                          2FA {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManagePermissions}
                className="gap-2"
              >
                <Shield className="h-4 w-4" />
                <span>Permissions</span>
              </Button>
              <Button size="sm" onClick={handleEditUser} className="gap-2">
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Button>

              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.isActive ? (
                    <DropdownMenuItem
                      onClick={() => setShowDisableDialog(true)}
                      className="text-orange-600 focus:text-orange-600"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      <span>Disable Account</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setShowEnableDialog(true)}
                      className="text-green-600 focus:text-green-600"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      <span>Enable Account</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Account</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <User className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              <span>Permissions</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Quick Info Cards */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Account Status
                      </p>
                      <p className="text-2xl font-bold">
                        {getStatusText(user.isActive)}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-full ${user.isActive ? "bg-green-100" : "bg-gray-100"}`}
                    >
                      {getStatusIcon(user.isActive)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">User Role</p>
                      <p className="text-2xl font-bold capitalize">
                        {user.role.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-100">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {user.accessLevel && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Access Level
                        </p>
                        <p className="text-2xl font-bold">{user.accessLevel}</p>
                      </div>
                      <div className="p-3 rounded-full bg-purple-100">
                        <Key className="h-5 w-5 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Member Since
                      </p>
                      <p className="text-2xl font-bold">
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-indigo-100">
                      <Calendar className="h-5 w-5 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact & Personal Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <span>Contact & Personal Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {(user.firstName || user.lastName) && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Full Name
                        </span>
                        <span className="font-medium">
                          {[user.firstName, user.lastName]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Email Address
                      </span>
                      <span className="font-medium">{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Phone Number
                        </span>
                        <span className="font-medium">{user.phone}</span>
                      </div>
                    )}
                    {user.clientId && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Client ID
                        </span>
                        <span className="font-mono text-sm">
                          {user.clientId}
                        </span>
                      </div>
                    )}
                    {user.parentClientId && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Parent Client
                        </span>
                        <span className="font-mono text-sm">
                          {user.parentClientId}
                        </span>
                      </div>
                    )}
                    {user.parentUserId && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Parent User
                        </span>
                        <span className="font-mono text-sm">
                          {user.parentUserId}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Company & Organization Info */}
              {profile &&
                (profile.companyName ||
                  profile.department ||
                  profile.designation) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        <span>Company & Organization</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3">
                        {profile.companyName && (
                          <div className="flex items-center justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">
                              Company
                            </span>
                            <span className="font-medium">
                              {profile.companyName}
                            </span>
                          </div>
                        )}
                        {profile.designation && (
                          <div className="flex items-center justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">
                              Position
                            </span>
                            <span className="font-medium">
                              {profile.designation}
                            </span>
                          </div>
                        )}
                        {profile.department && (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-muted-foreground">
                              Department
                            </span>
                            <span className="font-medium">
                              {profile.department}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Address Information */}
              {profile && profile.address && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      <span>Address Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      {typeof profile.address === "string" ? (
                        <div className="flex items-start gap-2 py-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="font-medium">{profile.address}</span>
                        </div>
                      ) : (
                        <>
                          {profile.address.street && (
                            <div className="flex items-center justify-between py-2 border-b">
                              <span className="text-sm text-muted-foreground">
                                Street
                              </span>
                              <span className="font-medium">
                                {profile.address.street}
                              </span>
                            </div>
                          )}
                          {profile.address.city && (
                            <div className="flex items-center justify-between py-2 border-b">
                              <span className="text-sm text-muted-foreground">
                                City
                              </span>
                              <span className="font-medium">
                                {profile.address.city}
                              </span>
                            </div>
                          )}
                          {profile.address.state && (
                            <div className="flex items-center justify-between py-2 border-b">
                              <span className="text-sm text-muted-foreground">
                                State
                              </span>
                              <span className="font-medium">
                                {profile.address.state}
                              </span>
                            </div>
                          )}
                          {profile.address.postalCode && (
                            <div className="flex items-center justify-between py-2 border-b">
                              <span className="text-sm text-muted-foreground">
                                Postal Code
                              </span>
                              <span className="font-medium">
                                {profile.address.postalCode}
                              </span>
                            </div>
                          )}
                          {profile.address.country && (
                            <div className="flex items-center justify-between py-2">
                              <span className="text-sm text-muted-foreground">
                                Country
                              </span>
                              <span className="font-medium">
                                {profile.address.country}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Account Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <span>Account Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Role
                      </span>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Badge className={`${getRoleColor(user.role)}`}>
                          <span className="capitalize">{user.role}</span>
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Status
                      </span>
                      <Badge
                        className={`${getStatusColorClass(user.isActive)}`}
                      >
                        {getStatusIcon(user.isActive)}
                        <span className="ml-1">
                          {getStatusText(user.isActive)}
                        </span>
                      </Badge>
                    </div>
                    {user.twoFactorEnabled !== undefined && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">
                          Two-Factor Auth
                        </span>
                        <div className="flex items-center gap-2">
                          {user.twoFactorEnabled ? (
                            <Lock className="h-4 w-4 text-green-600" />
                          ) : (
                            <Unlock className="h-4 w-4 text-amber-600" />
                          )}
                          <Badge
                            variant={
                              user.twoFactorEnabled ? "default" : "secondary"
                            }
                          >
                            {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">
                        Created Date
                      </span>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">
                        Last Updated
                      </span>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(user.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Role-Specific Information */}
            {(user.commissionRate || user.role === "client") && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Commission Info (if exists) */}
                {user.commissionRate && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        <span>Commission Details</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-green-900 dark:text-green-100 font-medium mb-1">
                              Rate
                            </div>
                            <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                              {user.commissionRate}%
                            </div>
                          </div>
                          {user.commissionType && (
                            <Badge variant="outline" className="text-sm">
                              {user.commissionType}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* License Info (for client role) */}
                {user.role === "client" &&
                  (user.licenseId ||
                    user.isLicenseActive !== undefined ||
                    user.licenseValidUntil) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          <span>License Information</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {user.licenseId && (
                          <div className="flex items-center justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">
                              License ID
                            </span>
                            <span className="font-mono text-sm">
                              {user.licenseId}
                            </span>
                          </div>
                        )}
                        {user.isLicenseActive !== undefined && (
                          <div className="flex items-center justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">
                              Status
                            </span>
                            <Badge
                              className={
                                user.isLicenseActive
                                  ? "bg-green-600"
                                  : "bg-red-600"
                              }
                            >
                              {user.isLicenseActive ? (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {user.isLicenseActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        )}
                        {user.licenseValidUntil && (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-muted-foreground">
                              Valid Until
                            </span>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {new Date(
                                  user.licenseValidUntil,
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
              </div>
            )}
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      <span>User Permissions</span>
                    </CardTitle>
                    <CardDescription>
                      {mockPermissions.total} permissions across{" "}
                      {Object.keys(mockPermissions.categories).length}{" "}
                      categories
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={handleManagePermissions}>
                    <Edit className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(mockPermissions.categories).map(
                    ([key, category]) => (
                      <Card key={key} className="shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span>{category.label}</span>
                            <Badge variant="secondary" className="text-xs">
                              {category.count}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-1">
                            {category.permissions.map((perm) => (
                              <Badge
                                key={perm}
                                variant="outline"
                                className="text-xs"
                              >
                                {perm}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Disable Account Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable this user account? The user will
              not be able to log in or access the system until the account is
              re-enabled.
              <br />
              <br />
              <strong>User:</strong>{" "}
              {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                user?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableUser}
              disabled={actionLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                <>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Disable Account
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enable Account Dialog */}
      <AlertDialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to enable this user account? The user will
              be able to log in and access the system according to their
              assigned permissions.
              <br />
              <br />
              <strong>User:</strong>{" "}
              {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                user?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEnableUser}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Enable Account
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Delete User Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-red-600">
                Warning: This action cannot be undone!
              </strong>
              <br />
              <br />
              Are you sure you want to permanently delete this user account? All
              associated data will be removed from the system.
              <br />
              <br />
              <strong>User:</strong>{" "}
              {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                user?.email}
              <br />
              <strong>Email:</strong> {user?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
