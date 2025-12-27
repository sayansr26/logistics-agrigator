"use client";

import { useState, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Save,
  ArrowLeft,
  ArrowRight,
  User,
  Store,
  MapPin,
  Lock,
  AlertCircle,
  Loader2,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  useCreateCustomerMutation,
  useGetOutletsQuery,
  type CreateCustomerRequest,
  type CustomerType,
} from "@/store/api/endpoints/customerApi";
import {
  useGetStatesQuery,
  useGetCitiesQuery,
  useSearchPincodesQuery,
} from "@/store/api/endpoints/geoApi";
import { useAuth } from "@/hooks/useAuth";

interface FormData {
  // Step 1: Customer Type
  customerType: CustomerType;
  outletId: string;
  // Step 2: Basic Info
  name: string;
  email: string;
  phone: string;
  // Step 3: Address
  address: string;
  stateId: string;
  stateName: string;
  cityId: string;
  cityName: string;
  pincode: string;
  // Step 4: Login Details
  password: string;
  confirmPassword: string;
}

const initialFormData: FormData = {
  customerType: "B2C",
  outletId: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  stateId: "",
  stateName: "",
  cityId: "",
  cityName: "",
  pincode: "",
  password: "",
  confirmPassword: "",
};

// 4-step wizard
const formSteps = [
  { id: "type", title: "Customer Type", icon: User },
  { id: "basic", title: "Basic Info", icon: User },
  { id: "address", title: "Address", icon: MapPin },
  { id: "login", title: "Login Details", icon: Lock },
];

export default function AddCustomerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();

  // Check if user can create B2B customers (superadmin, admin)
  const canCreateB2BCustomer =
    user?.role === "superadmin" || user?.role === "admin";

  // Fetch outlets for dropdown (only if user can create B2B customers)
  const { data: outletsData, isLoading: isLoadingOutlets } = useGetOutletsQuery(
    { page: 1, limit: 100 },
    { skip: !canCreateB2BCustomer },
  );
  const outlets = outletsData?.data?.outlets || [];

  // Geo API hooks
  const { data: statesData, isLoading: isLoadingStates } = useGetStatesQuery();
  const { data: citiesData, isLoading: isLoadingCities } = useGetCitiesQuery(
    { stateId: formData.stateId },
    { skip: !formData.stateId },
  );
  const [pincodeSearch, setPincodeSearch] = useState("");
  const { data: pincodeData, isFetching: isSearchingPincode } =
    useSearchPincodesQuery(
      { code: pincodeSearch },
      { skip: !pincodeSearch || pincodeSearch.length < 3 },
    );

  const states = statesData?.data || [];
  const cities = citiesData?.data || [];

  const totalSteps = formSteps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Customer Management", href: "/customers" },
    { title: "Add Customer" },
  ];

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // Handle state selection
  const handleStateChange = (stateId: string) => {
    const selectedState = states.find(
      (s: { id: string; name: string }) => s.id === stateId,
    );
    setFormData((prev) => ({
      ...prev,
      stateId,
      stateName: selectedState?.name || "",
      cityId: "",
      cityName: "",
    }));
  };

  // Handle city selection
  const handleCityChange = (cityId: string) => {
    const selectedCity = cities.find(
      (c: { id: string; name: string }) => c.id === cityId,
    );
    setFormData((prev) => ({
      ...prev,
      cityId,
      cityName: selectedCity?.name || "",
    }));
  };

  // Handle pincode input with debounce for search
  const handlePincodeChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, pincode: value }));
    if (value.length >= 3) {
      setPincodeSearch(value);
    }
  }, []);

  // Auto-fill state/city from pincode selection
  // API returns: pincode.state and pincode.area.city (city is nested inside area)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePincodeSelect = (pincode: any) => {
    // City is nested inside area.city in the API response
    const city = pincode.area?.city;
    
    setFormData((prev) => ({
      ...prev,
      pincode: pincode.code,
      stateId: pincode.state?.id || "",
      stateName: pincode.state?.name || "",
      cityId: city?.id || "",
      cityName: city?.name || "",
    }));
    // Clear search to close dropdown
    setPincodeSearch("");
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
        if (!formData.phone.trim()) {
          newErrors.phone = "Phone number is required";
        }
        break;

      case "address":
        // Address is optional, no required validation
        break;

      case "login":
        if (!formData.password) {
          newErrors.password = "Password is required";
        } else if (formData.password.length < 8) {
          newErrors.password = "Password must be at least 8 characters";
        }
        if (!formData.confirmPassword) {
          newErrors.confirmPassword = "Please confirm password";
        } else if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = "Passwords do not match";
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

    // Build request payload
    const payload: CreateCustomerRequest = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim() || undefined,
      customerType: formData.customerType,
      password: formData.password,
      // Address fields (optional)
      address: formData.address.trim() || undefined,
      city: formData.cityName || undefined,
      state: formData.stateName || undefined,
      pincode: formData.pincode.trim() || undefined,
    };

    // Add outlet association for B2B customers
    if (formData.customerType === "B2B" && formData.outletId) {
      payload.outletId = formData.outletId;
    }

    try {
      await createCustomer(payload).unwrap();
      router.push("/customers?success=customer-created");
    } catch (err: unknown) {
      console.error("Failed to create customer:", err);
      interface ApiError {
        data?: { error?: { message?: string }; message?: string };
      }
      const apiError = err as ApiError;
      const errorMessage =
        apiError?.data?.error?.message ||
        apiError?.data?.message ||
        "Failed to create customer";
      setErrors({ submit: errorMessage });
    }
  };

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
                Select the type of customer you want to create
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
                      Individual end-customers without outlet association
                    </span>
                  </div>
                </button>

                {/* B2B Option */}
                {canCreateB2BCustomer ? (
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
                        Business customer linked to a specific outlet
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
                    <span className="absolute top-2 right-2 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                      Admin Only
                    </span>
                  </div>
                )}
              </div>

              {/* Outlet Selection for B2B */}
              {formData.customerType === "B2B" && canCreateB2BCustomer && (
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
                  <p className="text-xs text-muted-foreground">
                    This customer will be associated with the selected outlet.
                  </p>
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
                Enter the customer&apos;s contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter customer name"
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
                    placeholder="email@example.com"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This email will be used for login
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+91 9876543210"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-500">{errors.phone}</p>
                  )}
                </div>
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
                Enter the customer&apos;s address (optional)
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
                  placeholder="Enter street address"
                  rows={2}
                />
              </div>

              {/* Pincode with auto-fill */}
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <div className="relative">
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    placeholder="Enter pincode (auto-fills state & city)"
                    maxLength={6}
                  />
                  {isSearchingPincode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {/* Pincode search results dropdown */}
                  {pincodeData?.data?.length > 0 && pincodeSearch && (
                    <div 
                      className="absolute z-[100] w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto"
                      onMouseDown={(e) => e.preventDefault()} // Prevent input blur on click
                    >
                      {pincodeData.data.map((pincode) => (
                          <div
                            key={pincode.id}
                            role="button"
                            tabIndex={0}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent transition-colors cursor-pointer"
                            onClick={() => handlePincodeSelect(pincode)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                handlePincodeSelect(pincode);
                              }
                            }}
                          >
                            <span className="font-medium">{pincode.code}</span>
                            <span className="text-muted-foreground ml-2">
                              {pincode.area?.city?.name ? `${pincode.area.city.name}, ` : ""}{pincode.state?.name}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter pincode to auto-fill state and city
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* State dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.stateId}
                    onValueChange={handleStateChange}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingStates ? "Loading..." : "Select state"
                        }
                      >
                        {formData.stateName || "Select state"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {states.map(
                        (state: { id: string; name: string; code: string }) => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.name}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* City dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Select
                    value={formData.cityId}
                    onValueChange={handleCityChange}
                    disabled={!formData.stateId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingCities ? "Loading..." : "Select city"
                        }
                      >
                        {formData.cityName || "Select city"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(
                        (city: { id: string; name: string }) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  {!formData.stateId && (
                    <p className="text-xs text-muted-foreground">
                      Select state first
                    </p>
                  )}
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
                Login Details
              </CardTitle>
              <CardDescription>
                Set up login credentials for the customer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The email <strong>{formData.email || "(not set)"}</strong>{" "}
                  will be used as the login username.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    placeholder="Enter password"
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
                  Password must be at least 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handleInputChange("confirmPassword", e.target.value)
                    }
                    placeholder="Confirm password"
                    className={
                      errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>
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
            <h1 className="text-2xl font-bold text-foreground">Add Customer</h1>
            <p className="text-sm text-muted-foreground">
              Create a new {formData.customerType === "B2B" ? "B2B (Outlet)" : "B2C (Direct)"} customer
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
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Customer
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
