"use client";

import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Save,
  Shield,
  Mail,
  Phone,
  MapPin,
  Building,
  User,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  userRoles,
  userStatuses,
  userPermissions,
  getRoleByValue,
  getDefaultPermissionsForRole,
} from "@/lib/mock-data";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  company: string;
  department: string;
  position: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  permissions: string[];
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
  [key: string]: string | undefined;
}

const initialFormData: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "",
  status: "active",
  company: "",
  department: "",
  position: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  notes: "",
  permissions: [],
};

const steps = [
  {
    id: 1,
    title: "Basic Information",
    description: "Personal and contact details",
    icon: User,
  },
  {
    id: 2,
    title: "Role & Status",
    description: "User role and account status",
    icon: Shield,
  },
  {
    id: 3,
    title: "Company Details",
    description: "Professional information",
    icon: Building,
  },
  {
    id: 4,
    title: "Address",
    description: "Location details",
    icon: MapPin,
  },
  {
    id: 5,
    title: "Permissions & Notes",
    description: "Access rights and additional info",
    icon: Calendar,
  },
];

export default function AddUserPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "User Management", href: "/users" },
    { title: "Add New User" },
  ];

  const handleInputChange = (
    field: keyof FormData,
    value: string | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-assign default permissions when role changes
    if (field === "role" && typeof value === "string") {
      const defaultPermissions = getDefaultPermissionsForRole(value);
      setFormData((prev) => ({ ...prev, permissions: defaultPermissions }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const validateCurrentStep = () => {
    const newErrors: FormErrors = {};

    switch (currentStep) {
      case 1: // Basic Information
        if (!formData.firstName.trim())
          newErrors.firstName = "First name is required";
        if (!formData.lastName.trim())
          newErrors.lastName = "Last name is required";
        if (!formData.email.trim()) {
          newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "Invalid email format";
        }
        if (!formData.phone.trim())
          newErrors.phone = "Phone number is required";
        break;
      case 2: // Role & Status
        if (!formData.role) newErrors.role = "Role is required";
        break;
      case 3: // Company Information
        if (!formData.company.trim()) newErrors.company = "Company is required";
        break;
      case 4: // Address (optional)
        break;
      case 5: // Permissions & Notes (optional)
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAllSteps = () => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.role) newErrors.role = "Role is required";
    if (!formData.company.trim()) newErrors.company = "Company is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const goToStep = (step: number) => {
    // Only allow going to completed steps or current step
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAllSteps()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Success - redirect to users list
      router.push("/users?success=user-created");
    } catch (error) {
      // Log error for debugging - in production, this would be sent to error tracking service
      // console.error("Error creating user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Group permissions by category for better organization
  const permissionsByCategory = userPermissions.reduce(
    (acc: Record<string, typeof userPermissions>, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    },
    {},
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Basic Information</span>
              </CardTitle>
              <CardDescription>
                Enter the user&apos;s personal and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    placeholder="Enter first name"
                    className={errors.firstName ? "border-red-500" : ""}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.firstName}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    placeholder="Enter last name"
                    className={errors.lastName ? "border-red-500" : ""}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.lastName}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="Enter email address"
                      className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      placeholder="Enter phone number"
                      className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* User Preview */}
              {(formData.firstName || formData.lastName || formData.email) && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-lg">
                        {formData.firstName?.[0]}
                        {formData.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium">
                        {formData.firstName} {formData.lastName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {formData.email}
                      </p>
                      {formData.role && (
                        <Badge className={getRoleByValue(formData.role)?.color}>
                          {getRoleByValue(formData.role)?.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Role & Status</span>
              </CardTitle>
              <CardDescription>
                Assign appropriate role and account status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => handleInputChange("role", value)}
                  >
                    <SelectTrigger
                      className={errors.role ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {userRoles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex items-center space-x-2">
                            <Badge className={role.color}>{role.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {role.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.role}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      handleInputChange("status", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {userStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center space-x-2">
                            <Badge className={status.color}>
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {status.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Company Information</span>
              </CardTitle>
              <CardDescription>
                Enter company and professional details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) =>
                      handleInputChange("company", e.target.value)
                    }
                    placeholder="Enter company name"
                    className={errors.company ? "border-red-500" : ""}
                  />
                  {errors.company && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.company}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) =>
                      handleInputChange("department", e.target.value)
                    }
                    placeholder="Enter department"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) =>
                    handleInputChange("position", e.target.value)
                  }
                  placeholder="Enter job position"
                />
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Address Information</span>
              </CardTitle>
              <CardDescription>
                Enter the user&apos;s address details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="Enter street address"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    placeholder="Enter state"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) =>
                      handleInputChange("pincode", e.target.value)
                    }
                    placeholder="Enter pincode"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Permissions</span>
                </CardTitle>
                <CardDescription>
                  Select the permissions this user should have. Default
                  permissions are automatically assigned based on the selected
                  role.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(
                    ([category, permissions]) => (
                      <div key={category} className="space-y-3">
                        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
                          {category}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {permissions.map((permission) => (
                            <div
                              key={permission.value}
                              className="flex items-start space-x-3"
                            >
                              <input
                                type="checkbox"
                                id={permission.value}
                                checked={formData.permissions.includes(
                                  permission.value,
                                )}
                                onChange={() =>
                                  handlePermissionToggle(permission.value)
                                }
                                className="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor={permission.value}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {permission.label}
                                </Label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Additional Notes</span>
                </CardTitle>
                <CardDescription>
                  Add any additional information about this user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Enter any additional notes or comments..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground">
                Add New User
              </h1>
              <p className="text-muted-foreground">
                Create a new user account with appropriate permissions
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            {currentStep === steps.length && (
              <Button
                type="submit"
                form="user-form"
                disabled={isSubmitting}
                className="flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Create User</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => goToStep(step.id)}
                    disabled={step.id > currentStep}
                    className={`flex flex-col items-center space-y-2 ${
                      step.id <= currentStep
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                        isCompleted
                          ? "bg-green-500 border-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {step.description}
                      </p>
                    </div>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-4 ${
                        isCompleted
                          ? "bg-green-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation - Moved to top */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </Button>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Step {currentStep} of {steps.length}
            </span>
          </div>

          {currentStep < steps.length ? (
            <Button onClick={nextStep} className="flex items-center space-x-2">
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              form="user-form"
              disabled={isSubmitting}
              className="flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Create User</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Step Content */}
        <form id="user-form" onSubmit={handleSubmit}>
          {renderStepContent()}
        </form>
      </div>
    </DashboardLayout>
  );
}
