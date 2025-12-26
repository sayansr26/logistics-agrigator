"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save,
  ArrowLeft,
  User,
  Store,
  MapPin,
  Building2,
  CreditCard,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  useCreateCustomerMutation,
  type CreateCustomerRequest,
  type CustomerType,
  type OutletType,
  type OutletStatus,
} from "@/store/api/endpoints/customerApi";

const outletTypes: { value: OutletType; label: string }[] = [
  { value: "RETAIL", label: "Retail Store" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "FRANCHISE", label: "Franchise" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "OTHER", label: "Other" },
];

const outletStatuses: { value: OutletStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "PENDING", label: "Pending Approval" },
  { value: "SUSPENDED", label: "Suspended" },
];

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface FormData {
  // Basic info
  name: string;
  email: string;
  phone: string;
  customerType: CustomerType;
  // Address
  address: string;
  city: string;
  state: string;
  pincode: string;
  // Business info
  gstNumber: string;
  panNumber: string;
  businessType: string;
  // Outlet-specific
  outletCode: string;
  outletName: string;
  retailerName: string;
  contactPerson: string;
  outletType: OutletType | "";
  outletStatus: OutletStatus;
  // Business hours
  businessHoursOpen: string;
  businessHoursClose: string;
  businessDays: string[];
  // Bank details
  accountName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  // Additional
  serviceAreas: string;
}

const initialFormData: FormData = {
  name: "",
  email: "",
  phone: "",
  customerType: "DIRECT",
  address: "",
  city: "",
  state: "",
  pincode: "",
  gstNumber: "",
  panNumber: "",
  businessType: "",
  outletCode: "",
  outletName: "",
  retailerName: "",
  contactPerson: "",
  outletType: "",
  outletStatus: "ACTIVE",
  businessHoursOpen: "09:00",
  businessHoursClose: "18:00",
  businessDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  accountName: "",
  accountNumber: "",
  bankName: "",
  ifscCode: "",
  serviceAreas: "",
};

export default function AddCustomerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Customer Management", href: "/customers" },
    { title: "Add Customer" },
  ];

  const handleInputChange = (
    field: keyof FormData,
    value: string | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const toggleBusinessDay = (day: string) => {
    const currentDays = formData.businessDays;
    if (currentDays.includes(day)) {
      handleInputChange(
        "businessDays",
        currentDays.filter((d) => d !== day),
      );
    } else {
      handleInputChange("businessDays", [...currentDays, day]);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields for all customers
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) newErrors.phone = "Phone is required";

    // Outlet-specific required fields
    if (formData.customerType === "OUTLET") {
      if (!formData.outletCode.trim())
        newErrors.outletCode = "Outlet code is required";
      if (!formData.outletName.trim())
        newErrors.outletName = "Outlet name is required";
      if (!formData.outletType)
        newErrors.outletType = "Outlet type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Build request payload
    const payload: CreateCustomerRequest = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      customerType: formData.customerType,
      address: formData.address.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      pincode: formData.pincode.trim() || undefined,
      gstNumber: formData.gstNumber.trim() || undefined,
      panNumber: formData.panNumber.trim() || undefined,
      businessType: formData.businessType.trim() || undefined,
    };

    // Add outlet-specific fields
    if (formData.customerType === "OUTLET") {
      payload.outletCode = formData.outletCode.trim();
      payload.outletName = formData.outletName.trim();
      payload.retailerName = formData.retailerName.trim() || undefined;
      payload.contactPerson = formData.contactPerson.trim() || undefined;
      payload.outletType = formData.outletType as OutletType;
      payload.outletStatus = formData.outletStatus;
      payload.businessHours = {
        open: formData.businessHoursOpen,
        close: formData.businessHoursClose,
        days: formData.businessDays,
      };
      if (formData.accountNumber.trim()) {
        payload.bankDetails = {
          accountName: formData.accountName.trim() || undefined,
          accountNumber: formData.accountNumber.trim(),
          bankName: formData.bankName.trim() || undefined,
          ifscCode: formData.ifscCode.trim() || undefined,
        };
      }
      if (formData.serviceAreas.trim()) {
        payload.serviceAreas = formData.serviceAreas
          .split(",")
          .map((s) => s.trim());
      }
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

  const isOutlet = formData.customerType === "OUTLET";

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Add Customer
              </h1>
              <p className="text-muted-foreground">
                Create a new direct customer or outlet
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          {/* Customer Type Selection */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Customer Type</CardTitle>
              <CardDescription>
                Select the type of customer you want to create
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleInputChange("customerType", "DIRECT")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.customerType === "DIRECT"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <User
                      className={`h-8 w-8 ${formData.customerType === "DIRECT" ? "text-blue-500" : "text-gray-500"}`}
                    />
                    <span className="font-medium">Direct Customer (B2C)</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Individual customers who register themselves
                    </span>
                  </div>
                </button>
                {/* Outlet type disabled - Coming Soon */}
                <div className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed relative">
                  <div className="flex flex-col items-center gap-2">
                    <Store className="h-8 w-8 text-gray-400" />
                    <span className="font-medium text-gray-500">
                      Outlet (B2B)
                    </span>
                    <span className="text-sm text-muted-foreground text-center">
                      Business outlets managed by admin
                    </span>
                  </div>
                  <span className="absolute top-2 right-2 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                    Coming Soon
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList
              className={`grid w-full ${isOutlet ? "grid-cols-4" : "grid-cols-2"}`}
            >
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              {isOutlet && (
                <TabsTrigger value="outlet">Outlet Details</TabsTrigger>
              )}
              {isOutlet && <TabsTrigger value="bank">Bank Details</TabsTrigger>}
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                  <CardDescription>
                    Enter the customer&apos;s basic contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        {isOutlet ? "Business Name" : "Full Name"} *
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        placeholder={
                          isOutlet ? "Enter business name" : "Enter full name"
                        }
                        className={errors.name ? "border-red-500" : ""}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500">{errors.name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        placeholder="Enter email address"
                        className={errors.email ? "border-red-500" : ""}
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        placeholder="+91 9876543210"
                        className={errors.phone ? "border-red-500" : ""}
                      />
                      {errors.phone && (
                        <p className="text-sm text-red-500">{errors.phone}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type</Label>
                      <Input
                        id="businessType"
                        value={formData.businessType}
                        onChange={(e) =>
                          handleInputChange("businessType", e.target.value)
                        }
                        placeholder="e.g., E-commerce, Retail"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gstNumber">GST Number</Label>
                      <Input
                        id="gstNumber"
                        value={formData.gstNumber}
                        onChange={(e) =>
                          handleInputChange("gstNumber", e.target.value)
                        }
                        placeholder="e.g., 22AAAAA0000A1Z5"
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
                        placeholder="e.g., ABCDE1234F"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address Information
                  </CardTitle>
                  <CardDescription>
                    Enter the customer&apos;s address details
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) =>
                          handleInputChange("city", e.target.value)
                        }
                        placeholder="Enter city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) =>
                          handleInputChange("state", e.target.value)
                        }
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
            </TabsContent>

            {/* Outlet Details Tab (Only for OUTLET type) */}
            {isOutlet && (
              <TabsContent value="outlet">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Outlet Details
                    </CardTitle>
                    <CardDescription>
                      Enter outlet-specific information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="outletCode">Outlet Code *</Label>
                        <Input
                          id="outletCode"
                          value={formData.outletCode}
                          onChange={(e) =>
                            handleInputChange("outletCode", e.target.value)
                          }
                          placeholder="e.g., OUT-001"
                          className={errors.outletCode ? "border-red-500" : ""}
                        />
                        {errors.outletCode && (
                          <p className="text-sm text-red-500">
                            {errors.outletCode}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outletName">Outlet Name *</Label>
                        <Input
                          id="outletName"
                          value={formData.outletName}
                          onChange={(e) =>
                            handleInputChange("outletName", e.target.value)
                          }
                          placeholder="Enter outlet name"
                          className={errors.outletName ? "border-red-500" : ""}
                        />
                        {errors.outletName && (
                          <p className="text-sm text-red-500">
                            {errors.outletName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="retailerName">Retailer Name</Label>
                        <Input
                          id="retailerName"
                          value={formData.retailerName}
                          onChange={(e) =>
                            handleInputChange("retailerName", e.target.value)
                          }
                          placeholder="Enter retailer name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactPerson">Contact Person</Label>
                        <Input
                          id="contactPerson"
                          value={formData.contactPerson}
                          onChange={(e) =>
                            handleInputChange("contactPerson", e.target.value)
                          }
                          placeholder="Enter contact person name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="outletType">Outlet Type *</Label>
                        <Select
                          value={formData.outletType}
                          onValueChange={(value) =>
                            handleInputChange("outletType", value)
                          }
                        >
                          <SelectTrigger
                            className={
                              errors.outletType ? "border-red-500" : ""
                            }
                          >
                            <SelectValue placeholder="Select outlet type" />
                          </SelectTrigger>
                          <SelectContent>
                            {outletTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.outletType && (
                          <p className="text-sm text-red-500">
                            {errors.outletType}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outletStatus">Status</Label>
                        <Select
                          value={formData.outletStatus}
                          onValueChange={(value) =>
                            handleInputChange("outletStatus", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {outletStatuses.map((status) => (
                              <SelectItem
                                key={status.value}
                                value={status.value}
                              >
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Business Hours */}
                    <div className="space-y-3">
                      <Label>Business Hours</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="businessHoursOpen"
                            className="text-sm text-muted-foreground"
                          >
                            Opening Time
                          </Label>
                          <Input
                            id="businessHoursOpen"
                            type="time"
                            value={formData.businessHoursOpen}
                            onChange={(e) =>
                              handleInputChange(
                                "businessHoursOpen",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="businessHoursClose"
                            className="text-sm text-muted-foreground"
                          >
                            Closing Time
                          </Label>
                          <Input
                            id="businessHoursClose"
                            type="time"
                            value={formData.businessHoursClose}
                            onChange={(e) =>
                              handleInputChange(
                                "businessHoursClose",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          Business Days
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {weekDays.map((day) => (
                            <Button
                              key={day}
                              type="button"
                              variant={
                                formData.businessDays.includes(day)
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => toggleBusinessDay(day)}
                            >
                              {day.slice(0, 3)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="serviceAreas">
                        Service Areas (comma-separated)
                      </Label>
                      <Input
                        id="serviceAreas"
                        value={formData.serviceAreas}
                        onChange={(e) =>
                          handleInputChange("serviceAreas", e.target.value)
                        }
                        placeholder="e.g., Delhi, Mumbai, Bangalore"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Bank Details Tab (Only for OUTLET type) */}
            {isOutlet && (
              <TabsContent value="bank">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Bank Details
                    </CardTitle>
                    <CardDescription>
                      Enter bank account details for payments (optional)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="accountName">Account Holder Name</Label>
                        <Input
                          id="accountName"
                          value={formData.accountName}
                          onChange={(e) =>
                            handleInputChange("accountName", e.target.value)
                          }
                          placeholder="Enter account holder name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <Input
                          id="accountNumber"
                          value={formData.accountNumber}
                          onChange={(e) =>
                            handleInputChange("accountNumber", e.target.value)
                          }
                          placeholder="Enter account number"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={formData.bankName}
                          onChange={(e) =>
                            handleInputChange("bankName", e.target.value)
                          }
                          placeholder="Enter bank name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ifscCode">IFSC Code</Label>
                        <Input
                          id="ifscCode"
                          value={formData.ifscCode}
                          onChange={(e) =>
                            handleInputChange("ifscCode", e.target.value)
                          }
                          placeholder="e.g., SBIN0001234"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create {isOutlet ? "Outlet" : "Customer"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
