"use client";

import React, { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Store,
  MapPin,
  Phone,
  Building2,
  ShoppingCart,
  Warehouse,
  ArrowLeft,
  Save,
  X,
  Plus,
  CreditCard,
  Globe,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const initialFormData = {
  outletCode: "",
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
  businessHours: "",
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
  assignedCouriers: [],
  serviceAreas: [],
};

const availableCouriers = [
  "Delhivery",
  "Blue Dart",
  "DTDC",
  "FedEx",
  "Aramex",
  "UPS",
  "Ecom Express",
  "XpressBees",
];

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
  "Puducherry",
  "Andaman and Nicobar Islands",
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
    title: "Services & Areas",
    description: "Courier assignment and service areas",
  },
];

export default function AddOutletPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [newServiceArea, setNewServiceArea] = useState("");

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets", href: "/outlets" },
    { title: "Add Outlet" },
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
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

  const handleCourierChange = (courier, checked) => {
    setFormData((prev) => ({
      ...prev,
      assignedCouriers: checked
        ? [...prev.assignedCouriers, courier]
        : prev.assignedCouriers.filter((c) => c !== courier),
    }));
  };

  const addServiceArea = () => {
    if (newServiceArea && !formData.serviceAreas.includes(newServiceArea)) {
      setFormData((prev) => ({
        ...prev,
        serviceAreas: [...prev.serviceAreas, newServiceArea],
      }));
      setNewServiceArea("");
    }
  };

  const removeServiceArea = (area) => {
    setFormData((prev) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.filter((a) => a !== area),
    }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In real implementation, make API call here
      // console.log("Creating outlet:", formData);

      // Redirect to outlets list
      router.push("/outlets");
    } catch (error) {
      // console.error("Error creating outlet:", error);
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
                  <Input
                    id="outletCode"
                    value={formData.outletCode}
                    onChange={(e) =>
                      handleInputChange("outletCode", e.target.value)
                    }
                    placeholder="e.g., OUT001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outletName">Business Name *</Label>
                  <Input
                    id="outletName"
                    value={formData.outletName}
                    onChange={(e) =>
                      handleInputChange("outletName", e.target.value)
                    }
                    placeholder="e.g., Main Branch"
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
                    placeholder="e.g., RG ENTERPRISES"
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
                <div className="space-y-2">
                  <Label htmlFor="businessHours">Business Hours</Label>
                  <Input
                    id="businessHours"
                    value={formData.businessHours}
                    onChange={(e) =>
                      handleInputChange("businessHours", e.target.value)
                    }
                    placeholder="e.g., 9:00 AM - 8:00 PM"
                  />
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
                    placeholder="e.g., 27AABFR1234M1Z5"
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
                    placeholder="e.g., AABFR1234M"
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
                      placeholder="e.g., Rajesh Gupta"
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
                      placeholder="e.g., +91 98765 43210"
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
                      placeholder="e.g., rajesh@rgenterprises.com"
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Complete Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                      placeholder="e.g., 123 Main Street, Sector 15"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) =>
                          handleInputChange("city", e.target.value)
                        }
                        placeholder="e.g., Mumbai"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) =>
                          handleInputChange("state", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
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
                        placeholder="e.g., 400001"
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
                      placeholder="e.g., Registered business address for legal purposes"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessCity">City</Label>
                      <Input
                        id="businessCity"
                        value={formData.businessCity}
                        onChange={(e) =>
                          handleInputChange("businessCity", e.target.value)
                        }
                        placeholder="e.g., Mumbai"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessState">State</Label>
                      <Select
                        value={formData.businessState}
                        onValueChange={(value) =>
                          handleInputChange("businessState", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
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
                        placeholder="e.g., 400001"
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Courier Assignment
                </CardTitle>
                <CardDescription>
                  Select courier partners for this outlet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableCouriers.map((courier) => (
                    <div key={courier} className="flex items-center space-x-2">
                      <Checkbox
                        id={courier}
                        checked={formData.assignedCouriers.includes(courier)}
                        onCheckedChange={(checked) =>
                          handleCourierChange(courier, checked)
                        }
                      />
                      <Label
                        htmlFor={courier}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {courier}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Service Areas
                </CardTitle>
                <CardDescription>
                  Areas where this outlet provides services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newServiceArea}
                    onChange={(e) => setNewServiceArea(e.target.value)}
                    placeholder="Enter service area"
                    onKeyPress={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addServiceArea())
                    }
                  />
                  <Button
                    type="button"
                    onClick={addServiceArea}
                    disabled={!newServiceArea}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.serviceAreas.map((area) => (
                    <Badge
                      key={area}
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      {area}
                      <button
                        type="button"
                        onClick={() => removeServiceArea(area)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
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
                          ? "bg-blue-600 border-blue-600 text-white"
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
