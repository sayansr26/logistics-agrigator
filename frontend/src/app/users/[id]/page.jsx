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
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageContainer,
  StatsCard,
  StatsGrid,
  DetailSection,
  DetailItem,
  DetailGrid,
} from "@/components/shared";
import { getRoleColor } from "@/lib/mock-data";
import {
  Edit,
  Shield,
  Mail,
  Phone,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  ShieldCheck,
  MoreVertical,
  UserMinus,
  UserPlus,
  Trash2,
  Lock,
  Unlock,
  Key,
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

  const {
    data: userData,
    isLoading,
    error,
    refetch,
  } = useGetUserByIdQuery(userId);
  const { data: profileData } = useGetUserProfileByUserIdQuery(userId);

  const user = userData?.data?.user;
  const profile = profileData?.data?.profile;

  const handleAction = async (action, setDialog) => {
    setActionLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await refetch();
      setDialog(false);
      if (action === "delete") router.push("/users");
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  // Loading/Error states
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !user) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {error ? "Failed to Load User" : "User Not Found"}
            </h3>
            <p className="text-muted-foreground mb-4">An error occurred.</p>
            <Button onClick={() => router.push("/users")} variant="outline">
              Back to Users
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
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
    },
  };

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Hero Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-white shadow-md">
                <AvatarFallback className="text-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  <Badge
                    className={
                      user.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  >
                    {user.isActive ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1" />
                    )}
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge className={getRoleColor(user.role)}>
                    <Shield className="mr-1 h-3 w-3" />
                    {user.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </span>
                  {user.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {user.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/users/${userId}/permissions`)}
              >
                <Shield className="h-4 w-4 mr-2" />
                Permissions
              </Button>
              <Button
                size="sm"
                onClick={() => router.push(`/users/${userId}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.isActive ? (
                    <DropdownMenuItem
                      onClick={() => setShowDisableDialog(true)}
                      className="text-orange-600"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Disable Account
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setShowEnableDialog(true)}
                      className="text-green-600"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Enable Account
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Stats */}
        <StatsGrid columns={4}>
          <StatsCard
            title="Account Status"
            value={user.isActive ? "Active" : "Inactive"}
            icon={user.isActive ? CheckCircle : XCircle}
            iconColor={user.isActive ? "text-green-600" : "text-gray-600"}
          />
          <StatsCard
            title="User Role"
            value={user.role.replace(/_/g, " ")}
            icon={Shield}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Permissions"
            value={mockPermissions.total}
            icon={ShieldCheck}
            iconColor="text-purple-600"
          />
          <StatsCard
            title="Member Since"
            value={new Date(user.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            icon={Calendar}
            iconColor="text-indigo-600"
          />
        </StatsGrid>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="overview">
              <User className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview" className="space-y-6">
              <DetailGrid columns={2}>
                <DetailSection title="Contact Information">
                  {displayName !== user.email && (
                    <DetailItem label="Full Name" value={displayName} />
                  )}
                  <DetailItem label="Email Address" value={user.email} />
                  {user.phone && (
                    <DetailItem label="Phone Number" value={user.phone} />
                  )}
                  {user.clientId && (
                    <DetailItem label="Client ID" value={user.clientId} mono />
                  )}
                </DetailSection>

                <DetailSection title="Account Details">
                  <DetailItem
                    label="Role"
                    value={
                      <Badge className={getRoleColor(user.role)}>
                        <Shield className="mr-1 h-3 w-3" />
                        {user.role}
                      </Badge>
                    }
                  />
                  <DetailItem
                    label="Status"
                    value={
                      <Badge
                        className={
                          user.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    }
                  />
                  {user.twoFactorEnabled !== undefined && (
                    <DetailItem
                      label="Two-Factor Auth"
                      value={
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
                      }
                    />
                  )}
                  <DetailItem
                    label="Created Date"
                    value={new Date(user.createdAt).toLocaleDateString()}
                  />
                  <DetailItem
                    label="Last Updated"
                    value={new Date(user.updatedAt).toLocaleDateString()}
                  />
                </DetailSection>

                {profile?.companyName && (
                  <DetailSection title="Company Information">
                    <DetailItem label="Company" value={profile.companyName} />
                    {profile.designation && (
                      <DetailItem
                        label="Position"
                        value={profile.designation}
                      />
                    )}
                    {profile.department && (
                      <DetailItem
                        label="Department"
                        value={profile.department}
                      />
                    )}
                  </DetailSection>
                )}
              </DetailGrid>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        User Permissions
                      </CardTitle>
                      <CardDescription>
                        {mockPermissions.total} permissions across{" "}
                        {Object.keys(mockPermissions.categories).length}{" "}
                        categories
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(`/users/${userId}/permissions`)
                      }
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </Tabs>

        {/* Disable Dialog */}
        <AlertDialog
          open={showDisableDialog}
          onOpenChange={setShowDisableDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable User Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to disable <strong>{displayName}</strong>?
                They will not be able to log in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction("disable", setShowDisableDialog)}
                disabled={actionLoading}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserMinus className="h-4 w-4 mr-2" />
                )}
                Disable
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Enable Dialog */}
        <AlertDialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Enable User Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to enable <strong>{displayName}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction("enable", setShowEnableDialog)}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Enable
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">
                Delete User Account
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete{" "}
                <strong>{displayName}</strong>? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction("delete", setShowDeleteDialog)}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </DashboardLayout>
  );
}
