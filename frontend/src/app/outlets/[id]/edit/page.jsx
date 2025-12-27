"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  Phone,
  Building2,
  ShoppingCart,
  Warehouse,
  ArrowLeft,
  Save,
  CreditCard,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Users,
  Mail,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGetOutletByIdQuery, useUpdateOutletMutation, useGetOutletUsersQuery } from "@/store/api/endpoints/customerApi";

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
  { id: 4, title: "Admin Users", description: "Manage outlet admin users" },
];

export default function EditOutletPage() {
  const params = useParams();
  const router = useRouter();
  const outletId = params.id;

  const [formData, setFormData] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  // API hooks
  const { data, isLoading, error } = useGetOutletByIdQuery(outletId, {
    skip: !outletId,
  });
  const [updateOutlet, { isLoading: isSubmitting }] = useUpdateOutletMutation();
  const { data: usersData, isLoading: isLoadingUsers } = useGetOutletUsersQuery(
    { outletId },
    { skip: !outletId }
  );

  // Get outlet users from API response
  const outletUsers = usersData?.data?.users || [];

  // Get outlet from API response
  const outlet = data?.data?.outlet || data?.data?.customer || null;

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Outlets", href: "/outlets" },
    { title: outlet?.name || outlet?.outletName || "Outlet", href: `/outlets/${outletId}` },
    { title: "Edit" },
  ];

  // Initialize form data when outlet is loaded
  useEffect(() => {
    if (outlet && !formData) {
      setFormData({
        outletCode: outlet.code || outlet.outletCode || "",
        outletName: outlet.name || outlet.outletName || "",
        retailerName: outlet.retailerName || "",
        contactPerson: outlet.contactPerson || "",
        phone: outlet.phone || "",
        email: outlet.email || "",
        address: outlet.address || "",
        city: outlet.city || "",
        state: outlet.state || "",
        pincode: outlet.pincode || "",
        status: outlet.status || outlet.outletStatus || "active",
        type: outlet.type || outlet.outletType || "retail",
        gstNumber: outlet.gstNumber || "",
        panNumber: outlet.panNumber || "",
        businessAddress: "",
        businessCity: "",
        businessState: "",
        businessPincode: "",
        bankDetails: {
          accountHolderName: outlet.bankDetails?.accountHolderName || "",
          accountNumber: outlet.bankDetails?.accountNumber || "",
          ifscCode: outlet.bankDetails?.ifscCode || "",
          bankName: outlet.bankDetails?.bankName || "",
        },
      });
    }
  }, [outlet, formData]);

  const handleInputChange = (field, value) => {
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : null,
    );
  };

  const handleBankDetailsChange = (field, value) => {
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            bankDetails: {
              ...prev.bankDetails,
              [field]: value,
            },
          }
        : null,
    );
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

  const handleSubmit = async () => {
    if (!formData) return;

    try {
      // Prepare data for API
      const updateData = {
        name: formData.outletName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        type: formData.type?.toUpperCase(),
        status: formData.status?.toUpperCase(),
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        gstNumber: formData.gstNumber || undefined,
        panNumber: formData.panNumber || undefined,
        bankDetails: formData.bankDetails.accountNumber ? formData.bankDetails : undefined,
      };

      await updateOutlet({ id: outletId, data: updateData }).unwrap();

      // Show success and redirect to outlet details
      alert("Outlet updated successfully!");
      router.push(`/outlets/${outletId}`);
    } catch (error) {
      console.error("Error updating outlet:", error);
      const errorMessage = error?.data?.error?.message || error?.message || "Failed to update outlet. Please try again.";
      alert(errorMessage);
    }
  };

  const renderStepContent = () => {
    if (!formData) return null;

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
                Update the basic details of the outlet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="outletCode">Outlet Code</Label>
                  <Input
                    id="outletCode"
                    value={formData.outletCode}
                    readOnly
                    disabled
                    className="bg-muted font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Outlet code cannot be changed
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
                    placeholder="e.g., Main Branch"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retailerName">Business Owner Name</Label>
                  <Input
                    id="retailerName"
                    value={formData.retailerName}
                    onChange={(e) =>
                      handleInputChange("retailerName", e.target.value)
                    }
                    placeholder="e.g., RG ENTERPRISES"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Outlet Type *</Label>
                  <Select
                    value={formData.type?.toLowerCase()}
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
                      <SelectItem value="warehouse">
                        <div className="flex items-center gap-2">
                          <Warehouse className="h-4 w-4" />
                          Warehouse
                        </div>
                      </SelectItem>
                      <SelectItem value="franchise">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Franchise
                        </div>
                      </SelectItem>
                      <SelectItem value="direct">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Direct
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status?.toLowerCase()}
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
                Update contact details and addresses for the outlet
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
                Update banking information for settlements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountHolderName">
                    Account Holder Name
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
                <Users className="h-5 w-5" />
                Admin Users
              </CardTitle>
              <CardDescription>
                View and manage users who can access this outlet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading users...</span>
                </div>
              ) : outletUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No admin users found for this outlet.</p>
                  <p className="text-sm mt-2">
                    Admin users are created when the outlet is first set up.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {outletUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.profile?.firstName || ""}{" "}
                            {user.profile?.lastName || ""}
                            {!user.profile?.firstName && !user.profile?.lastName && "Outlet User"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>
                              {user.email || user.profile?.email || "No email"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span className="text-sm capitalize">
                            {user.role?.replace(/_/g, " ") || "User"}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> To add, edit, or remove users, use the Manage Users page.
                    </p>
                    <Button variant="outline" asChild>
                      <Link href={`/outlets/${outletId}/users`}>
                        <Users className="h-4 w-4 mr-2" />
                        Manage Users
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Error Loading Outlet
              </h2>
              <p className="text-muted-foreground mb-6">
                {error?.data?.error?.message || "Failed to load outlet details"}
              </p>
              <Button asChild>
                <Link href="/outlets">Back to Outlets</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Not found state
  if (!outlet || !formData) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Outlet Not Found
              </h2>
              <p className="text-muted-foreground mb-6">
                The outlet you&apos;re looking for doesn&apos;t exist or has
                been removed.
              </p>
              <Button asChild>
                <Link href="/outlets">Back to Outlets</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Outlet</h1>
            <p className="text-muted-foreground mt-2">
              Update outlet information and settings
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/outlets/${outletId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Outlet
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
                // Steps 1-3: Show Next button
                <Button type="button" onClick={nextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                // Step 4 (Admin Users): Show Save and Done buttons
                <>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
