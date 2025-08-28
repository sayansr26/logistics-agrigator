"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  mockUsers,
  getRoleColor,
  getUserStatusColor,
  formatDate,
} from "@/lib/mock-data";
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
} from "lucide-react";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchUser = async () => {
      setIsLoading(true);
      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const foundUser = mockUsers.find((u) => u.id === userId);
      if (foundUser) {
        // Enhance user data with additional mock information
        const enhancedUser = {
          ...foundUser,
          phone: "+91 98765 43210",
          company: "TechCorp Solutions",
          department: "Engineering",
          position: "Senior Developer",
          address: "123 Tech Street, Silicon Valley",
          city: "Bangalore",
          state: "Karnataka",
          pincode: "560001",
          notes: "Experienced developer with expertise in logistics systems",
          permissions: [
            "read:shipments",
            "write:shipments",
            "read:reports",
            "manage:users",
          ],
          lastActive: "2 hours ago",
          totalShipments: foundUser.shipmentsCount,
          successfulDeliveries: Math.floor(foundUser.shipmentsCount * 0.85),
          failedDeliveries: Math.floor(foundUser.shipmentsCount * 0.05),
          pendingShipments: Math.floor(foundUser.shipmentsCount * 0.1),
        };
        setUser(enhancedUser);
      }
      setIsLoading(false);
    };

    fetchUser();
  }, [userId]);

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

  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="lg:col-span-2 space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
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
              <p className="text-gray-600 mb-6">
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "inactive":
        return <Pause className="h-4 w-4 text-yellow-600" />;
      case "suspended":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToUsers}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Users</span>
            </Button>
            <Separator orientation="vertical" className="h-6" /> */}
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground">
                {user.name}
              </h1>
              <p className="text-muted-foreground">
                User Profile & Information
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleManagePermissions}
              className="flex items-center space-x-2"
            >
              <Shield className="h-4 w-4" />
              <span>Manage Permissions</span>
            </Button>
            <Button
              onClick={handleEditUser}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit User</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle className="text-xl">{user.name}</CardTitle>
                <CardDescription className="text-base">
                  {user.position}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center">
                  <Badge
                    className={`${getRoleColor(user.role)} text-sm px-3 py-1`}
                  >
                    <Shield className="mr-1 h-3 w-3" />
                    {user.role}
                  </Badge>
                </div>
                <div className="flex items-center justify-center">
                  <Badge
                    className={`${getUserStatusColor(user.status)} text-sm px-3 py-1`}
                  >
                    {getStatusIcon(user.status)}
                    <span className="ml-1">{user.status}</span>
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center space-x-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Company:</span>
                    <span className="font-medium">{user.company}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{user.department}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Position:</span>
                    <span className="font-medium">{user.position}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Contact Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.phone}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.address}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {user.city}, {user.state} {user.pincode}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Details & Statistics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity & Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Activity & Statistics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {user.totalShipments}
                    </div>
                    <div className="text-sm text-blue-600">Total Shipments</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {user.successfulDeliveries}
                    </div>
                    <div className="text-sm text-green-600">Successful</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {user.pendingShipments}
                    </div>
                    <div className="text-sm text-yellow-600">Pending</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {user.failedDeliveries}
                    </div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Last Login:
                    </span>
                    <span className="text-sm font-medium">
                      {formatDate(user.lastLogin)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Last Active:
                    </span>
                    <span className="text-sm font-medium">
                      {user.lastActive}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Account Created:
                    </span>
                    <span className="text-sm font-medium">August 15, 2024</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Permissions Overview</span>
                </CardTitle>
                <CardDescription>
                  Current permissions assigned to this user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {user.permissions.map((permission: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{permission}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleManagePermissions}
                    className="w-full"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Manage Permissions
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notes & Additional Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Notes & Additional Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Notes:
                    </label>
                    <p className="text-sm mt-1 p-3 bg-gray-50 rounded-lg">
                      {user.notes}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Profile Last Updated:
                    </span>
                    <span className="text-sm font-medium">August 18, 2024</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
