"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  MapPin,
  DollarSign,
  Phone,
  Save,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";
import {
  SERVICE_OPTIONS,
  PARTNER_TYPES,
  PARTNER_STATUSES,
  RATING_OPTIONS,
} from "@/lib/mock-data";
import { partnersApiService } from "@/services";
import { useAuthStore } from "@/store/auth-store";
import {
  CreatePartnerRequest,
  PartnerFormData,
  PartnerValidationErrors,
} from "@/types/partner";

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    icon: Star,
    description: "Partner details and type",
  },
  {
    id: 2,
    title: "Coverage & Services",
    icon: MapPin,
    description: "Service areas and offerings",
  },
  {
    id: 3,
    title: "Pricing Structure",
    icon: DollarSign,
    description: "Rates and charges",
  },
  {
    id: 4,
    title: "Contact Details",
    icon: Phone,
    description: "Contact information",
  },
];

export default function AddPartnerPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  // Generate partner code function
  const generatePartnerCode = () => {
    const firstChar = formData.name.charAt(0).toUpperCase();
    const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    return `${firstChar}${randomDigits}`;
  };

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    status: "pending",
    rating: 5,
    deliveryTime: "",
    servicePincodes: [],
    services: [],
    baseRate: 0,
    perKgRate: 0,
    fuelSurcharge: 0,
    email: "",
    phone: "",
    address: "",
    website: "",
    partnerCode: "",
    apiUrl: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [pincodeInput, setPincodeInput] = useState("");
  const [customServiceInput, setCustomServiceInput] = useState("");
  const [availableServices, setAvailableServices] = useState(SERVICE_OPTIONS);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updatedData = { ...prev, [field]: value };

      // Auto-generate partner code when name changes
      if (field === "name" && value.trim()) {
        const firstChar = value.charAt(0).toUpperCase();
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        updatedData.partnerCode = `${firstChar}${randomDigits}`;
      }

      return updatedData;
    });

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAddPincode = () => {
    if (pincodeInput.trim() && /^\d{6}$/.test(pincodeInput.trim())) {
      if (!formData.servicePincodes.includes(pincodeInput.trim())) {
        setFormData((prev) => ({
          ...prev,
          servicePincodes: [...prev.servicePincodes, pincodeInput.trim()],
        }));
        setPincodeInput("");
      }
    }
  };

  const handleRemovePincode = (pincode) => {
    setFormData((prev) => ({
      ...prev,
      servicePincodes: prev.servicePincodes.filter((p) => p !== pincode),
    }));
  };

  const handleServiceToggle = (service, checked) => {
    setFormData((prev) => ({
      ...prev,
      services: checked
        ? [...prev.services, service]
        : prev.services.filter((s) => s !== service),
    }));
  };

  const handleAddCustomService = () => {
    const serviceName = customServiceInput.trim();
    if (serviceName && !availableServices.includes(serviceName)) {
      setAvailableServices((prev) => [...prev, serviceName]);
      setCustomServiceInput("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomService();
    }
  };

  const handleRemoveCustomService = (service) => {
    // Only allow removal of custom services (not the original SERVICE_OPTIONS)
    if (!SERVICE_OPTIONS.includes(service)) {
      setAvailableServices((prev) => prev.filter((s) => s !== service));
      setFormData((prev) => ({
        ...prev,
        services: prev.services.filter((s) => s !== service),
      }));
    }
  };

  const validateCurrentStep = () => {
    const newErrors = {};

    switch (currentStep) {
      case 1:
        if (!formData.name.trim()) newErrors.name = "Partner name is required";
        // if (!formData.type) newErrors.type = "Partner type is required";
        // if (!formData.deliveryTime.trim())
        //   newErrors.deliveryTime = "Delivery time is required";
        if (!formData.apiUrl.trim()) newErrors.apiUrl = "API URL is required";
        break;
      case 2:
        if (formData.servicePincodes.length === 0)
          newErrors.servicePincodes =
            "At least one service pincode is required";
        if (formData.services.length === 0)
          newErrors.services = "At least one service is required";
        break;
      case 3:
        // Pricing validation is optional, so no errors here
        break;
      case 4:
        if (!formData.email.trim()) newErrors.email = "Email is required";
        if (!formData.phone.trim()) newErrors.phone = "Phone is required";
        if (!formData.address.trim()) newErrors.address = "Address is required";
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Ensure we have an access token
      if (!accessToken) {
        throw new Error("Authentication required. Please log in again.");
      }

      // Set the access token in the API service
      partnersApiService.setAccessToken(accessToken);

      // Prepare the data for API submission
      const partnerData = {
        name: formData.name,
        code: formData.partnerCode, // Backend expects 'code' field
        displayName: formData.name, // Use name as displayName for now
        apiUrl: formData.apiUrl || "https://api.example.com", // Default API URL
        isActive: formData.status === "active",
        baseRate: formData.baseRate,
        perKgRate: formData.perKgRate,
        fuelSurcharge: formData.fuelSurcharge,
        servicePincodes: formData.servicePincodes, // Use actual pincodes
      };

      // Call the API to create the partner
      const response = await partnersApiService.createPartner(partnerData);

      if (response.status === "success" && response.data) {
        // Success - redirect to partners list
        router.push("/partners");
      } else {
        // Handle API error response
        const errorMessage =
          response.error?.message || "Failed to create partner";
        setSubmitError(errorMessage);
      }
    } catch (error) {
      console.error("Error creating partner:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/partners");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-blue-600" />
                <span>Basic Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Partner Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter partner name"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partnerCode">Partner Code</Label>
                  <Input
                    id="partnerCode"
                    value={formData.partnerCode}
                    placeholder="Auto-generated when name is entered"
                    readOnly
                    className="bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiUrl">API URL *</Label>
                  <Input
                    id="apiUrl"
                    value={formData.apiUrl}
                    onChange={(e) =>
                      handleInputChange("apiUrl", e.target.value)
                    }
                    placeholder="https://api.partner.com"
                    className={errors.apiUrl ? "border-red-500" : ""}
                  />
                  {errors.apiUrl && (
                    <p className="text-sm text-red-500">{errors.apiUrl}</p>
                  )}
                </div>

                {/* <div className="space-y-2">
                  <Label htmlFor="type">Partner Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => handleInputChange("type", value)}
                  >
                    <SelectTrigger
                      className={errors.type ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select partner type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTNER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type}</p>
                  )}
                </div> */}

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
                      {PARTNER_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* <div className="space-y-2">
                  <Label htmlFor="rating">Rating</Label>
                  <Select
                    value={formData.rating.toString()}
                    onValueChange={(value) =>
                      handleInputChange("rating", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATING_OPTIONS.map((rating) => (
                        <SelectItem
                          key={rating.value}
                          value={rating.value.toString()}
                        >
                          {rating.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div> */}

                {/* <div className="space-y-2">
                  <Label htmlFor="deliveryTime">Delivery Time *</Label>
                  <Input
                    id="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={(e) =>
                      handleInputChange("deliveryTime", e.target.value)
                    }
                    placeholder="e.g., 2-3 business days"
                    className={errors.deliveryTime ? "border-red-500" : ""}
                  />
                  {errors.deliveryTime && (
                    <p className="text-sm text-red-500">
                      {errors.deliveryTime}
                    </p>
                  )}
                </div> */}
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-green-600" />
                <span>Coverage & Services</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <Label>Service Pincodes *</Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={pincodeInput}
                      onChange={(e) => setPincodeInput(e.target.value)}
                      placeholder="Enter 6-digit pincode (e.g., 110001)"
                      maxLength={6}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleAddPincode}
                      disabled={
                        !pincodeInput.trim() ||
                        !/^\d{6}$/.test(pincodeInput.trim())
                      }
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Add
                    </Button>
                  </div>

                  {formData.servicePincodes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.servicePincodes.map((pincode) => (
                        <div
                          key={pincode}
                          className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                        >
                          <span>{pincode}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePincode(pincode)}
                            className="text-blue-600 hover:text-blue-800 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Add 6-digit pincodes where this partner provides service
                  </p>
                </div>
                {errors.servicePincodes && (
                  <p className="text-sm text-red-500">
                    {errors.servicePincodes}
                  </p>
                )}
              </div>

              <div className="my-6">
                <Separator className="my-4" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Services Offered *</Label>
                  <span className="text-sm text-gray-500">
                    {formData.services.length} service
                    {formData.services.length !== 1 ? "s" : ""} selected
                  </span>
                </div>

                {/* Add Custom Service */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={customServiceInput}
                      onChange={(e) => setCustomServiceInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add custom service (e.g., White Glove Delivery)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleAddCustomService}
                      disabled={
                        !customServiceInput.trim() ||
                        availableServices.includes(customServiceInput.trim())
                      }
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Add Service
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Add custom services that aren't in the predefined list
                  </p>
                </div>

                {/* Services Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableServices.map((service) => {
                    const isCustomService = !SERVICE_OPTIONS.includes(service);
                    return (
                      <div
                        key={service}
                        className="flex items-center space-x-3 group"
                      >
                        <Checkbox
                          id={`service-${service}`}
                          checked={formData.services.includes(service)}
                          onCheckedChange={(checked) =>
                            handleServiceToggle(service, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`service-${service}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          {service}
                          {isCustomService && (
                            <span className="ml-2 text-xs text-blue-600 font-normal">
                              (Custom)
                            </span>
                          )}
                        </Label>
                        {isCustomService && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomService(service)}
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                            title="Remove custom service"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {errors.services && (
                  <p className="text-sm text-red-500">{errors.services}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <span>Pricing Structure</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="baseRate">Base Rate (₹)</Label>
                  <Input
                    id="baseRate"
                    type="number"
                    value={formData.baseRate}
                    onChange={(e) =>
                      handleInputChange(
                        "baseRate",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perKgRate">Per KG Rate (₹)</Label>
                  <Input
                    id="perKgRate"
                    type="number"
                    value={formData.perKgRate}
                    onChange={(e) =>
                      handleInputChange(
                        "perKgRate",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelSurcharge">Fuel Surcharge (%)</Label>
                  <Input
                    id="fuelSurcharge"
                    type="number"
                    value={formData.fuelSurcharge}
                    onChange={(e) =>
                      handleInputChange(
                        "fuelSurcharge",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="0.00"
                    step="0.01"
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
              <CardTitle className="flex items-center space-x-2">
                <Phone className="h-5 w-5 text-purple-600" />
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="partner@example.com"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-500">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      handleInputChange("address", e.target.value)
                    }
                    placeholder="Enter complete address"
                    rows={4}
                    className={errors.address ? "border-red-500" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-500">{errors.address}</p>
                  )}
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) =>
                      handleInputChange("website", e.target.value)
                    }
                    placeholder="https://partner-website.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Navigation Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Add New Partner
            </h1>
            <p className="text-muted-foreground">
              Create a new courier partner for your logistics network
            </p>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}

            {currentStep < STEPS.length ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding Partner...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Add Partner
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                      currentStep > step.id
                        ? "bg-green-600 border-green-600 text-white"
                        : currentStep === step.id
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-gray-100 border-gray-300 text-gray-500"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <step.icon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium text-gray-900">
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-24 h-0.5 mx-4 transition-colors ${
                      currentStep > step.id ? "bg-green-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div>{renderStepContent()}</div>

        {/* Error Display */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error creating partner
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{submitError}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
