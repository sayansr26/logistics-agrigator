"use client";

import React, { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Store,
  Phone,
  Building2,
  ShoppingCart,
  Warehouse,
  ArrowLeft,
  Save,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GeographicalApiService } from "@/services/api/geographical-api";
import { useAuth } from "@/hooks/useAuth";
import { useCreateOutletMutation } from "@/store/api/endpoints/customerApi";
import { User, Lock, Eye, EyeOff } from "lucide-react";

// Generate a unique outlet code
const generateOutletCode = () => {
  const prefix = "OUT";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const initialFormData = {
  outletCode: generateOutletCode(),
  outletName: "",
  retailerName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  status: "pending",
  type: "retail",
  gstNumber: "",
  panNumber: "",
  businessAddress: "",
  businessCity: "",
  businessState: "",
  businessPincode: "",
  bankDetails: {
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
  },
  // Admin credentials for outlet login
  adminCredentials: {
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  },
};

// Fallback states in case API fails
const fallbackStates = [
  { id: 1, name: "Andhra Pradesh", code: "AP", isActive: true },
  { id: 2, name: "Arunachal Pradesh", code: "AR", isActive: true },
  { id: 3, name: "Assam", code: "AS", isActive: true },
  { id: 4, name: "Bihar", code: "BR", isActive: true },
  { id: 5, name: "Chhattisgarh", code: "CG", isActive: true },
  { id: 6, name: "Goa", code: "GA", isActive: true },
  { id: 7, name: "Gujarat", code: "GJ", isActive: true },
  { id: 8, name: "Haryana", code: "HR", isActive: true },
  { id: 9, name: "Himachal Pradesh", code: "HP", isActive: true },
  { id: 10, name: "Jharkhand", code: "JH", isActive: true },
  { id: 11, name: "Karnataka", code: "KA", isActive: true },
  { id: 12, name: "Kerala", code: "KL", isActive: true },
  { id: 13, name: "Madhya Pradesh", code: "MP", isActive: true },
  { id: 14, name: "Maharashtra", code: "MH", isActive: true },
  { id: 15, name: "Manipur", code: "MN", isActive: true },
  { id: 16, name: "Meghalaya", code: "ML", isActive: true },
  { id: 17, name: "Mizoram", code: "MZ", isActive: true },
  { id: 18, name: "Nagaland", code: "NL", isActive: true },
  { id: 19, name: "Odisha", code: "OR", isActive: true },
  { id: 20, name: "Punjab", code: "PB", isActive: true },
  { id: 21, name: "Rajasthan", code: "RJ", isActive: true },
  { id: 22, name: "Sikkim", code: "SK", isActive: true },
  { id: 23, name: "Tamil Nadu", code: "TN", isActive: true },
  { id: 24, name: "Telangana", code: "TG", isActive: true },
  { id: 25, name: "Tripura", code: "TR", isActive: true },
  { id: 26, name: "Uttar Pradesh", code: "UP", isActive: true },
  { id: 27, name: "Uttarakhand", code: "UK", isActive: true },
  { id: 28, name: "West Bengal", code: "WB", isActive: true },
  { id: 29, name: "Delhi", code: "DL", isActive: true },
  { id: 30, name: "Jammu and Kashmir", code: "JK", isActive: true },
  { id: 31, name: "Ladakh", code: "LA", isActive: true },
  { id: 32, name: "Chandigarh", code: "CH", isActive: true },
  {
    id: 33,
    name: "Dadra and Nagar Haveli and Daman and Diu",
    code: "DH",
    isActive: true,
  },
  { id: 34, name: "Lakshadweep", code: "LD", isActive: true },
  { id: 35, name: "Puducherry", code: "PY", isActive: true },
  { id: 36, name: "Andaman and Nicobar Islands", code: "AN", isActive: true },
];

const steps = [
  {
    id: 1,
    title: "Basic Information",
    description: "Outlet details and business info",
  },
  {
    id: 2,
    title: "Contact & Address",
    description: "Contact details and addresses",
  },
  { id: 3, title: "Bank Details", description: "Banking information" },
  {
    id: 4,
    title: "Admin Account",
    description: "Outlet admin login credentials",
  },
];

export default function AddOutletPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [createOutlet] = useCreateOutletMutation();

  // Geographical data state
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [businessCities, setBusinessCities] = useState([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingBusinessCities, setIsLoadingBusinessCities] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [geoApiService] = useState(() => new GeographicalApiService());

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets", href: "/outlets" },
    { title: "Add Outlet" },
  ];

  // Load states on component mount
  useEffect(() => {
    const loadStates = async () => {
      console.log("Loading states, accessToken:", !!accessToken);
      if (accessToken) {
        setIsLoadingStates(true);
        setGeoError(null);
        try {
          geoApiService.setAccessToken(accessToken);
          console.log("Making API call to get states...");
          const response = await geoApiService.getStates();
          console.log("States API response:", response);
          if (response.status === "success") {
            setStates(response.data);
            console.log("States loaded:", response.data);
          } else {
            console.error(
              "Failed to load states from API, using fallback:",
              response.error,
            );
            setStates(fallbackStates);
            setGeoError("Using offline states");
          }
        } catch (error) {
          console.error("Error loading states, using fallback:", error);
          setStates(fallbackStates);
          setGeoError("Using offline states");
        } finally {
          setIsLoadingStates(false);
        }
      } else {
        console.log("No access token available, using fallback states");
        setStates(fallbackStates);
      }
    };

    loadStates();
  }, [accessToken, geoApiService]);

  // Load cities when state changes
  const loadCities = async (stateId) => {
    console.log("Loading cities for stateId:", stateId);
    if (stateId && accessToken) {
      setIsLoadingCities(true);
      try {
        geoApiService.setAccessToken(accessToken);
        const response = await geoApiService.getCitiesByState(stateId);
        console.log("Cities API response:", response);
        if (response.status === "success") {
          setCities(response.data);
          console.log("Cities loaded:", response.data);
        } else {
          console.error("Failed to load cities from API:", response.error);
          // For now, we'll just clear cities if API fails
          setCities([]);
        }
      } catch (error) {
        console.error("Error loading cities:", error);
        setCities([]);
      } finally {
        setIsLoadingCities(false);
      }
    } else {
      console.log("No access token or stateId, clearing cities");
      setCities([]);
    }
  };

  // Load business cities when business state changes
  const loadBusinessCities = async (stateId) => {
    console.log("Loading business cities for stateId:", stateId);
    if (stateId && accessToken) {
      setIsLoadingBusinessCities(true);
      try {
        geoApiService.setAccessToken(accessToken);
        const response = await geoApiService.getCitiesByState(stateId);
        console.log("Business cities API response:", response);
        if (response.status === "success") {
          setBusinessCities(response.data);
          console.log("Business cities loaded:", response.data);
        } else {
          console.error(
            "Failed to load business cities from API:",
            response.error,
          );
          setBusinessCities([]);
        }
      } catch (error) {
        console.error("Error loading business cities:", error);
        setBusinessCities([]);
      } finally {
        setIsLoadingBusinessCities(false);
      }
    } else {
      console.log("No access token or stateId, clearing business cities");
      setBusinessCities([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Handle state changes to load cities
    if (field === "state") {
      const selectedState = states.find((state) => state.name === value);
      if (selectedState) {
        loadCities(selectedState.id);
        // Clear city when state changes
        setFormData((prev) => ({ ...prev, city: "" }));
      }
    }

    if (field === "businessState") {
      const selectedState = states.find((state) => state.name === value);
      if (selectedState) {
        loadBusinessCities(selectedState.id);
        // Clear business city when business state changes
        setFormData((prev) => ({ ...prev, businessCity: "" }));
      }
    }
  };

  // Regenerate outlet code
  const regenerateOutletCode = () => {
    setFormData((prev) => ({
      ...prev,
      outletCode: generateOutletCode(),
    }));
  };

  const handleBankDetailsChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        [field]: value,
      },
    }));
  };

  const handleAdminCredentialsChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      adminCredentials: {
        ...prev.adminCredentials,
        [field]: value,
      },
    }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return (
          formData.outletCode &&
          formData.outletName &&
          formData.retailerName &&
          formData.type &&
          formData.status
        );
      case 2:
        return (
          formData.contactPerson &&
          formData.phone &&
          formData.email &&
          formData.address &&
          formData.city &&
          formData.state &&
          formData.pincode
        );
      case 3:
        return true; // Bank details are optional
      case 4:
        // Admin credentials are required
        const { email, password, confirmPassword, firstName, lastName } = formData.adminCredentials;
        if (!email || !password || !confirmPassword || !firstName || !lastName) {
          return false;
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return false;
        }
        // Validate password match
        if (password !== confirmPassword) {
          return false;
        }
        // Validate password strength (minimum 8 characters)
        if (password.length < 8) {
          return false;
        }
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      if (validateStep(currentStep)) {
        setCurrentStep(currentStep + 1);
      } else {
        alert(
          "Please fill in all required fields before proceeding to the next step.",
        );
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Final validation before submission
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      alert(
        "Please complete all required fields in all steps before creating the outlet.",
      );
      return;
    }

    // Validate password match
    if (formData.adminCredentials.password !== formData.adminCredentials.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare outlet data for API
      const outletData = {
        code: formData.outletCode,
        name: formData.outletName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        status: formData.status === "active" ? "ACTIVE" : formData.status === "inactive" ? "INACTIVE" : "PENDING",
        type: formData.type.toUpperCase(),
        gstNumber: formData.gstNumber || undefined,
        panNumber: formData.panNumber || undefined,
        bankDetails: formData.bankDetails.accountNumber ? formData.bankDetails : undefined,
        // Admin credentials for outlet login
        adminCredentials: {
          email: formData.adminCredentials.email,
          password: formData.adminCredentials.password,
          name: `${formData.adminCredentials.firstName} ${formData.adminCredentials.lastName}`,
          firstName: formData.adminCredentials.firstName,
          lastName: formData.adminCredentials.lastName,
        },
      };

      console.log("Creating outlet with data:", outletData);
      
      const result = await createOutlet(outletData).unwrap();
      console.log("Outlet created successfully:", result);

      // Show success message
      alert("Outlet created successfully! The outlet admin can now login with the provided credentials.");

      // Redirect to outlets list
      router.push("/outlets");
    } catch (error) {
      console.error("Error creating outlet:", error);
      const errorMessage = error?.data?.error?.message || error?.message || "Failed to create outlet. Please try again.";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // const getOutletTypeIcon = (type) => {
  //   switch (type) {
  //     case "retail":
  //       return <Store className="h-4 w-4" />;
  //     case "wholesale":
  //       return <Warehouse className="h-4 w-4" />;
  //     case "ecommerce":
  //       return <ShoppingCart className="h-4 w-4" />;
  //     case "franchise":
  //       return <Building2 className="h-4 w-4" />;
  //     default:
  //       return <Store className="h-4 w-4" />;
  //   }
  // };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Enter the basic details of the outlet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="outletCode">Outlet Code *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="outletCode"
                      value={formData.outletCode}
                      readOnly
                      className="bg-muted font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={regenerateOutletCode}
                      title="Regenerate Code"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-generated outlet code
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outletName">Business Name *</Label>
                  <Input
                    id="outletName"
                    value={formData.outletName}
                    onChange={(e) =>
                      handleInputChange("outletName", e.target.value)
                    }
                    placeholder="Enter Business Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retailerName">Business Owner Name *</Label>
                  <Input
                    id="retailerName"
                    value={formData.retailerName}
                    onChange={(e) =>
                      handleInputChange("retailerName", e.target.value)
                    }
                    placeholder="Enter Business Owner Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Outlet Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => handleInputChange("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          Retail
                        </div>
                      </SelectItem>
                      <SelectItem value="wholesale">
                        <div className="flex items-center gap-2">
                          <Warehouse className="h-4 w-4" />
                          Wholesale
                        </div>
                      </SelectItem>
                      <SelectItem value="ecommerce">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          E-commerce
                        </div>
                      </SelectItem>
                      <SelectItem value="franchise">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Franchise
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
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
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <Input
                    id="gstNumber"
                    value={formData.gstNumber}
                    onChange={(e) =>
                      handleInputChange("gstNumber", e.target.value)
                    }
                    placeholder="Enter GST Number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panNumber">PAN Number</Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={(e) =>
                      handleInputChange("panNumber", e.target.value)
                    }
                    placeholder="Enter PAN Number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact & Address Information
              </CardTitle>
              <CardDescription>
                Contact details and addresses for the outlet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person *</Label>
                    <Input
                      id="contactPerson"
                      value={formData.contactPerson}
                      onChange={(e) =>
                        handleInputChange("contactPerson", e.target.value)
                      }
                      placeholder="Enter Contact Person"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      placeholder="Enter Phone Number"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="Enter Email Address"
                      required
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Address Information
                </h3>
                {geoError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{geoError}</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Complete Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                      placeholder="Enter Complete Address"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Select
                        value={formData.city}
                        onValueChange={(value) =>
                          handleInputChange("city", value)
                        }
                        disabled={!formData.state || isLoadingCities}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingCities
                                ? "Loading cities..."
                                : !formData.state
                                  ? "Select state first"
                                  : "Select City"
                            }
                          />
                          {isLoadingCities && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {cities.map((city) => (
                            <SelectItem key={city.id} value={city.name}>
                              {city.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) =>
                          handleInputChange("state", value)
                        }
                        disabled={isLoadingStates}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingStates
                                ? "Loading states..."
                                : "Select State"
                            }
                          />
                          {isLoadingStates && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state.id} value={state.name}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode">Pincode *</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) =>
                          handleInputChange("pincode", e.target.value)
                        }
                        placeholder="Enter Pincode"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Business Address</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessAddress">Complete Address</Label>
                    <Textarea
                      id="businessAddress"
                      value={formData.businessAddress}
                      onChange={(e) =>
                        handleInputChange("businessAddress", e.target.value)
                      }
                      placeholder="Enter Complete Business Address"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessCity">City</Label>
                      <Select
                        value={formData.businessCity}
                        onValueChange={(value) =>
                          handleInputChange("businessCity", value)
                        }
                        disabled={
                          !formData.businessState || isLoadingBusinessCities
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingBusinessCities
                                ? "Loading cities..."
                                : !formData.businessState
                                  ? "Select state first"
                                  : "Select City"
                            }
                          />
                          {isLoadingBusinessCities && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {businessCities.map((city) => (
                            <SelectItem key={city.id} value={city.name}>
                              {city.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessState">State</Label>
                      <Select
                        value={formData.businessState}
                        onValueChange={(value) =>
                          handleInputChange("businessState", value)
                        }
                        disabled={isLoadingStates}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingStates
                                ? "Loading states..."
                                : "Select State"
                            }
                          />
                          {isLoadingStates && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state.id} value={state.name}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessPincode">Pincode</Label>
                      <Input
                        id="businessPincode"
                        value={formData.businessPincode}
                        onChange={(e) =>
                          handleInputChange("businessPincode", e.target.value)
                        }
                        placeholder="e.g., Enter Pincode"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Bank Details
              </CardTitle>
              <CardDescription>
                Banking information for settlements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountHolderName">
                    Account Holder Name *
                  </Label>
                  <Input
                    id="accountHolderName"
                    value={formData.bankDetails.accountHolderName}
                    onChange={(e) =>
                      handleBankDetailsChange(
                        "accountHolderName",
                        e.target.value,
                      )
                    }
                    placeholder="e.g., Rajesh Gupta"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={formData.bankDetails.bankName}
                    onChange={(e) =>
                      handleBankDetailsChange("bankName", e.target.value)
                    }
                    placeholder="e.g., State Bank of India"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={formData.bankDetails.accountNumber}
                    onChange={(e) =>
                      handleBankDetailsChange("accountNumber", e.target.value)
                    }
                    placeholder="e.g., 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input
                    id="ifscCode"
                    value={formData.bankDetails.ifscCode}
                    onChange={(e) =>
                      handleBankDetailsChange("ifscCode", e.target.value)
                    }
                    placeholder="e.g., SBIN0001234"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Admin Account
              </CardTitle>
              <CardDescription>
                Create login credentials for the outlet administrator. The outlet admin can use these credentials to login and manage the outlet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminFirstName">First Name *</Label>
                  <Input
                    id="adminFirstName"
                    value={formData.adminCredentials.firstName}
                    onChange={(e) =>
                      handleAdminCredentialsChange("firstName", e.target.value)
                    }
                    placeholder="e.g., Rajesh"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminLastName">Last Name *</Label>
                  <Input
                    id="adminLastName"
                    value={formData.adminCredentials.lastName}
                    onChange={(e) =>
                      handleAdminCredentialsChange("lastName", e.target.value)
                    }
                    placeholder="e.g., Kumar"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adminEmail">Admin Email *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={formData.adminCredentials.email}
                    onChange={(e) =>
                      handleAdminCredentialsChange("email", e.target.value)
                    }
                    placeholder="e.g., admin@outlet.com"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    This email will be used to login to the outlet dashboard
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Password *</Label>
                  <div className="relative">
                    <Input
                      id="adminPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.adminCredentials.password}
                      onChange={(e) =>
                        handleAdminCredentialsChange("password", e.target.value)
                      }
                      placeholder="Minimum 8 characters"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {formData.adminCredentials.password && formData.adminCredentials.password.length < 8 && (
                    <p className="text-sm text-red-500">
                      Password must be at least 8 characters
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminConfirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="adminConfirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.adminCredentials.confirmPassword}
                      onChange={(e) =>
                        handleAdminCredentialsChange("confirmPassword", e.target.value)
                      }
                      placeholder="Confirm password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {formData.adminCredentials.confirmPassword && 
                   formData.adminCredentials.password !== formData.adminCredentials.confirmPassword && (
                    <p className="text-sm text-red-500">
                      Passwords do not match
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Important
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  The outlet admin will receive an email with login instructions once the outlet is created. They will be able to manage customers, shipments, and other outlet-specific settings.
                </p>
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add New Outlet</h1>
            <p className="text-gray-600 mt-2">
              Create a new outlet for your logistics network
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/outlets">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Outlets
            </Link>
          </Button>
        </div>

        {/* Stepper */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                        currentStep >= step.id
                          ? validateStep(step.id)
                            ? "bg-green-600 border-green-600 text-white"
                            : "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 text-gray-500"
                      }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </div>
                    <div className="ml-3">
                      <p
                        className={`text-sm font-medium ${
                          currentStep >= step.id
                            ? "text-blue-600"
                            : "text-gray-500"
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-4 ${
                        currentStep > step.id ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {renderStepContent()}

          {/* Form Actions */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-4">
              {currentStep < steps.length ? (
                <Button type="button" onClick={nextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <form onSubmit={handleSubmit}>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Outlet
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
