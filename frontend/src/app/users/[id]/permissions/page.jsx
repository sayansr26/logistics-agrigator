"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
  enhancedMockUsers,
  permissionCategories,
  getRoleColor,
  getUserStatusColor,
} from "@/lib/mock-data";
import {
  ArrowLeft,
  Save,
  X,
  Shield,
  UserCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Search,
  Plus,
  Minus,
  Users,
  Package,
  BarChart3,
  CreditCard,
  Globe,
  Server,
} from "lucide-react";

// Icon mapping for dynamic icon rendering
const iconMap = {
  Package,
  Users,
  BarChart3,
  CreditCard,
  Globe,
  Server,
};

export default function ManagePermissionsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id;

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [userPermissions, setUserPermissions] = useState(new Set());
  const [originalPermissions, setOriginalPermissions] = useState(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Simulate API call
    const fetchUser = async () => {
      setIsLoading(true);
      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const foundUser = enhancedMockUsers.find((u) => u.id === userId);
      if (foundUser) {
        setUser(foundUser);

        // Set initial permissions
        const initialPermissions = new Set(foundUser.permissions || []);
        setUserPermissions(initialPermissions);
        setOriginalPermissions(initialPermissions);
      }
      setIsLoading(false);
    };

    fetchUser();
  }, [userId]);

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "User Management", href: "/users" },
    { title: user?.name || "User", href: `/users/${userId}` },
    { title: "Manage Permissions" },
  ];

  const handlePermissionToggle = (permissionId) => {
    const newPermissions = new Set(userPermissions);
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId);
    } else {
      newPermissions.add(permissionId);
    }
    setUserPermissions(newPermissions);

    // Check if there are changes
    const hasChangesNow = !setsAreEqual(newPermissions, originalPermissions);
    setHasChanges(hasChangesNow);
  };

  const handleCategoryToggle = (categoryId) => {
    const category = permissionCategories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const categoryPermissions = category.permissions.map((p) => p.id);
    const hasAllPermissions = categoryPermissions.every((p) =>
      userPermissions.has(p),
    );

    const newPermissions = new Set(userPermissions);

    if (hasAllPermissions) {
      // Remove all permissions from this category
      categoryPermissions.forEach((p) => newPermissions.delete(p));
    } else {
      // Add all permissions from this category
      categoryPermissions.forEach((p) => newPermissions.add(p));
    }

    setUserPermissions(newPermissions);

    // Check if there are changes
    const hasChangesNow = !setsAreEqual(newPermissions, originalPermissions);
    setHasChanges(hasChangesNow);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update original permissions
      setOriginalPermissions(new Set(userPermissions));
      setHasChanges(false);

      // In a real app, you would make an API call here
      // eslint-disable-next-line no-console
      console.log("Saving permissions:", Array.from(userPermissions));

      // Show success message
      // You could add a toast notification here
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error saving permissions:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original permissions
    setUserPermissions(new Set(originalPermissions));
    setHasChanges(false);
  };

  const setsAreEqual = (a, b) => {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  };

  const getStatusIcon = (status) => {
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

  const filteredCategories = permissionCategories.filter((category) => {
    if (selectedCategory !== "all" && category.id !== selectedCategory) {
      return false;
    }

    if (searchTerm) {
      const matchesSearch =
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.permissions.some(
          (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      return matchesSearch;
    }

    return true;
  });

  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
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
                onClick={() => router.push("/users")}
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

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToProfile}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Profile</span>
            </Button>
            <Separator orientation="vertical" className="h-6" /> */}
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground">
                Manage Permissions: {user.name}
              </h1>
              <p className="text-muted-foreground">
                Configure user access and permissions across the system
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving || !hasChanges}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex items-center space-x-2"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Current User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <span>User Information</span>
            </CardTitle>
            <CardDescription>
              Current user details and role information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl bg-blue-100 text-blue-600">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <Badge
                    className={`${getRoleColor(user.role)} text-sm px-3 py-1`}
                  >
                    <Shield className="mr-1 h-3 w-3" />
                    {user.role}
                  </Badge>
                  <Badge
                    className={`${getUserStatusColor(user.status)} text-sm px-3 py-1`}
                  >
                    {getStatusIcon(user.status)}
                    <span className="ml-1">{user.status}</span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {user.position} at {user.company} • {user.email}
                </p>
                <p className="text-sm text-muted-foreground">
                  Current Permissions: {userPermissions.size} active permissions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Permission Management</span>
            </CardTitle>
            <CardDescription>
              Search and configure user permissions by category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="category-filter"
                  className="text-sm font-medium"
                >
                  Category:
                </Label>
                <select
                  id="category-filter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {permissionCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions by Category */}
        <div className="space-y-6">
          {filteredCategories.map((category) => {
            const categoryPermissions = category.permissions.map((p) => p.id);
            const hasAllPermissions = categoryPermissions.every((p) =>
              userPermissions.has(p),
            );
            const hasSomePermissions = categoryPermissions.some((p) =>
              userPermissions.has(p),
            );
            const IconComponent = iconMap[category.icon] || Package;

            return (
              <Card key={category.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <IconComponent className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{category.name}</span>
                          {hasAllPermissions && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              All Permissions
                            </Badge>
                          )}
                          {hasSomePermissions && !hasAllPermissions && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Partial
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {category.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCategoryToggle(category.id)}
                        className="flex items-center space-x-2"
                      >
                        {hasAllPermissions ? (
                          <>
                            <Minus className="h-4 w-4" />
                            <span>Remove All</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            <span>Add All</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {category.permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                          userPermissions.has(permission.id)
                            ? "bg-blue-50 border-blue-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <Checkbox
                          id={permission.id}
                          checked={userPermissions.has(permission.id)}
                          onCheckedChange={() =>
                            handlePermissionToggle(permission.id)
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={permission.id}
                            className="text-sm font-medium text-gray-900 cursor-pointer"
                          >
                            {permission.name}
                          </Label>
                          <p className="text-xs text-gray-600 mt-1">
                            {permission.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary and Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Permission Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {userPermissions.size}
                </div>
                <div className="text-sm text-blue-600">Active Permissions</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {
                    permissionCategories.filter((cat) =>
                      cat.permissions.every((p) => userPermissions.has(p.id)),
                    ).length
                  }
                </div>
                <div className="text-sm text-green-600">Full Categories</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {
                    permissionCategories.filter(
                      (cat) =>
                        cat.permissions.some((p) =>
                          userPermissions.has(p.id),
                        ) &&
                        !cat.permissions.every((p) =>
                          userPermissions.has(p.id),
                        ),
                    ).length
                  }
                </div>
                <div className="text-sm text-yellow-600">
                  Partial Categories
                </div>
              </div>
            </div>

            {hasChanges && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    You have unsaved changes. Click &quot;Save Changes&quot; to
                    apply your permission modifications.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
