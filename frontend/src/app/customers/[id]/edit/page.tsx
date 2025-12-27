"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  ArrowLeft,
  ArrowRight,
  User,
  MapPin,
  Lock,
  Store,
  AlertCircle,
  Loader2,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  useGetCustomerByIdQuery,
  useUpdateCustomerMutation,
  useGetOutletsQuery,
  type UpdateCustomerRequest,
  type CustomerType,
} from "@/store/api/endpoints/customerApi";
import { useAuth } from "@/hooks/useAuth";

interface FormData {
  // Step 1: Customer Type
  customerType: CustomerType;
  outletId: string;
  // Step 2: Basic Info
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  // Step 3: Address
  address: string;
  city: string;
  state: string;
  pincode: string;
  // Step 4: Login Details (Password Reset)
  password: string;
  confirmPassword: string;
}

const initialFormData: FormData = {
  customerType: "B2C",
  outletId: "",
  name: "",
  email: "",
  phone: "",
  isActive: true,
  address: "",
  city: "",
  state: "",
  pincode: "",
  password: "",
  confirmPassword: "",
};

// 4-step wizard
const formSteps = [
  { id: "type", title: "Customer Type", icon: User },
  { id: "basic", title: "Basic Info", icon: User },
  { id: "address", title: "Address", icon: MapPin },
  { id: "login", title: "Password", icon: Lock },
];

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const customerId = params.id as string;

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    data,
    isLoading: isLoadingCustomer,
    error: fetchError,
  } = useGetCustomerByIdQuery(customerId, {
    skip: !customerId,
  });
  const [updateCustomer, { isLoading: isUpdating }] =
    useUpdateCustomerMutation();

  // Check if user can assign to outlets (superadmin, admin)
  const canAssignToOutlet =
    user?.role === "superadmin" || user?.role === "admin";

  // Fetch outlets for dropdown
  const { data: outletsData, isLoading: isLoadingOutlets } = useGetOutletsQuery(
    { page: 1, limit: 100 },
    { skip: !canAssignToOutlet },
  );
  const outlets = outletsData?.data?.outlets || [];

  const customer = data?.data?.customer || null;

  const totalSteps = formSteps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Customers", href: "/customers" },
    { title: customer?.name || "Edit Customer" },
  ];

  // Populate form with customer data
  useEffect(() => {
    if (customer) {
      setFormData({
        customerType: customer.customerType || "B2C",
        outletId: customer.outletId || "",
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        isActive: customer.isActive ?? true,
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        pincode: customer.pincode || "",
        password: "",
        confirmPassword: "",
      });
    }
  }, [customer]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // Validate current step
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    const stepId = formSteps[currentStep].id;

    switch (stepId) {
      case "type":
        // B2B requires outlet selection
        if (formData.customerType === "B2B" && !formData.outletId) {
          newErrors.outletId = "Please select an outlet for B2B customer";
        }
        break;

      case "basic":
        if (!formData.name.trim()) {
          newErrors.name = "Name is required";
        }
        if (!formData.email.trim()) {
          newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "Invalid email format";
        }
        break;

      case "address":
        // Address is optional
        break;

      case "login":
        // Password is optional for edit, but if provided must be valid
        if (formData.password) {
          if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters";
          }
          if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
          }
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (index: number) => {
    // Only allow going back to previous steps
    if (index <= currentStep) {
      setCurrentStep(index);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    const payload: UpdateCustomerRequest = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim() || undefined,
      isActive: formData.isActive,
      customerType: formData.customerType,
      outletId: formData.customerType === "B2B" ? formData.outletId : null,
      address: formData.address.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      pincode: formData.pincode.trim() || undefined,
    };

    // Add password only if provided
    if (formData.password) {
      payload.password = formData.password;
    }

    try {
      await updateCustomer({ id: customerId, data: payload }).unwrap();
      router.push(`/customers/${customerId}`);
    } catch (err: unknown) {
      console.error("Failed to update customer:", err);
      interface ApiError {
        data?: { error?: { message?: string }; message?: string };
      }
      const apiError = err as ApiError;
      const errorMessage =
        apiError?.data?.error?.message ||
        apiError?.data?.message ||
        "Failed to update customer";
      setErrors({ submit: errorMessage });
    }
  };

  // Loading state
  if (isLoadingCustomer) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (fetchError || !customer) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Customer Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The customer you&apos;re trying to edit doesn&apos;t exist.
            </p>
            <Button onClick={() => router.push("/customers")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Render step content
  const renderStepContent = () => {
    const stepId = formSteps[currentStep].id;

    switch (stepId) {
      case "type":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Customer Type</CardTitle>
              <CardDescription>
                Change the customer type if needed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* B2C Option */}
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange("customerType", "B2C");
                    handleInputChange("outletId", "");
                  }}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    formData.customerType === "B2C"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <User
                      className={`h-10 w-10 ${
                        formData.customerType === "B2C"
                          ? "text-blue-500"
                          : "text-gray-500"
                      }`}
                    />
                    <span className="font-semibold text-lg">
                      Direct Customer (B2C)
                    </span>
                    <span className="text-sm text-muted-foreground text-center">
                      Individual end-customers
                    </span>
                  </div>
                </button>

                {/* B2B Option */}
                {canAssignToOutlet ? (
                  <button
                    type="button"
                    onClick={() => handleInputChange("customerType", "B2B")}
                    className={`p-6 rounded-lg border-2 transition-all text-left ${
                      formData.customerType === "B2B"
                        ? "border-green-500 bg-green-50 dark:bg-green-950"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Store
                        className={`h-10 w-10 ${
                          formData.customerType === "B2B"
                            ? "text-green-500"
                            : "text-gray-500"
                        }`}
                      />
                      <span className="font-semibold text-lg">
                        Outlet Customer (B2B)
                      </span>
                      <span className="text-sm text-muted-foreground text-center">
                        Business customer linked to outlet
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed relative">
                    <div className="flex flex-col items-center gap-3">
                      <Store className="h-10 w-10 text-gray-400" />
                      <span className="font-semibold text-lg text-gray-500">
                        Outlet Customer (B2B)
                      </span>
                      <span className="text-sm text-muted-foreground text-center">
                        Admin access required
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Outlet Selection for B2B */}
              {formData.customerType === "B2B" && canAssignToOutlet && (
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="outletId">Select Outlet *</Label>
                  <Select
                    value={formData.outletId}
                    onValueChange={(value) =>
                      handleInputChange("outletId", value)
                    }
                  >
                    <SelectTrigger
                      className={errors.outletId ? "border-red-500" : ""}
                    >
                      <SelectValue
                        placeholder={
                          isLoadingOutlets
                            ? "Loading outlets..."
                            : "Select an outlet"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {outlets.map((outlet) => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          <div className="flex items-center gap-2">
                            <span>{outlet.name}</span>
                            {outlet.code && (
                              <span className="text-xs text-muted-foreground">
                                ({outlet.code})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      {outlets.length === 0 && !isLoadingOutlets && (
                        <SelectItem value="" disabled>
                          No outlets available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.outletId && (
                    <p className="text-sm text-red-500">{errors.outletId}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "basic":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Update customer contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Changing email will update the login email
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive customers cannot login or create shipments
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    handleInputChange("isActive", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        );

      case "address":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address Details
              </CardTitle>
              <CardDescription>
                Update the customer&apos;s address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    handleInputChange("address", e.target.value)
                  }
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
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
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "login":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password Reset
              </CardTitle>
              <CardDescription>
                Leave blank to keep the current password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Current login email:{" "}
                  <strong>{customer?.email || formData.email}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    placeholder="Leave blank to keep current password"
                    className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>

              {formData.password && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        handleInputChange("confirmPassword", e.target.value)
                      }
                      placeholder="Confirm new password"
                      className={
                        errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Customer</h1>
            <p className="text-sm text-muted-foreground">
              Update{" "}
              {formData.customerType === "B2B" ? "B2B (Outlet)" : "B2C (Direct)"}{" "}
              customer: {customer?.name}
            </p>
          </div>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {formSteps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleStepClick(index)}
                  disabled={index > currentStep}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all text-sm ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 cursor-pointer hover:bg-green-200 dark:hover:bg-green-800"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                  <span className="font-medium hidden sm:inline">
                    {step.title}
                  </span>
                </button>
                {index < formSteps.length - 1 && (
                  <div
                    className={`w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 ${
                      index < currentStep ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Alert */}
        {errors.submit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={isFirstStep ? () => router.back() : handlePrevious}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isFirstStep ? "Cancel" : "Previous"}
          </Button>

          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={isUpdating}>
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
          ) : (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
