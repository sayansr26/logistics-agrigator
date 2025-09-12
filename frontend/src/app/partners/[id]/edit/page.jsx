"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  MapPin,
  DollarSign,
  Phone,
  Save,
  AlertCircle,
} from "lucide-react";
import { usePartner } from "@/hooks/usePartner";
import { partnersApiService } from "@/services";
import { useAuthStore } from "@/store/auth-store";
import { UpdatePartnerRequest } from "@/types/partner";

export default function EditPartnerPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id;
  const { accessToken } = useAuthStore();

  // Use the usePartner hook to fetch partner data
  const {
    partner,
    isLoading: isLoadingPartner,
    error: partnerError,
    refetch,
  } = usePartner(partnerId);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    displayName: "",
    apiUrl: "",
    isActive: true,
    baseRate: 0,
    perKgRate: 0,
    fuelSurcharge: 0,
    servicePincodes: [],
    supportsCOD: false,
    supportsReverse: false,
    maxWeight: 0,
    maxDimensions: {
      length: 0,
      width: 0,
      height: 0,
    },
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (partner) {
      setFormData({
        name: partner.name || "",
        code: partner.code || "",
        displayName: partner.displayName || "",
        apiUrl: partner.apiUrl || "",
        isActive: partner.isActive ?? true,
        baseRate: partner.baseRate || 0,
        perKgRate: partner.perKgRate || 0,
        fuelSurcharge: partner.fuelSurcharge || 0,
        servicePincodes: partner.servicePincodes || [],
        supportsCOD: partner.supportsCOD ?? false,
        supportsReverse: partner.supportsReverse ?? false,
        maxWeight: partner.maxWeight || 0,
        maxDimensions: {
          length: partner.maxDimensions?.length || 0,
          width: partner.maxDimensions?.width || 0,
          height: partner.maxDimensions?.height || 0,
        },
      });
    }
  }, [partner]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Partner name is required";
    if (!formData.code.trim()) newErrors.code = "Partner code is required";
    if (!formData.displayName.trim())
      newErrors.displayName = "Display name is required";
    if (!formData.apiUrl.trim()) newErrors.apiUrl = "API URL is required";

    // Validate API URL format
    if (formData.apiUrl.trim() && !isValidUrl(formData.apiUrl)) {
      newErrors.apiUrl = "Please enter a valid API URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      // Set the access token in the partners API service
      partnersApiService.setAccessToken(accessToken);

      // Prepare the update data
      const updateData = {
        id: partnerId,
        name: formData.name.trim(),
        code: formData.code.trim(),
        displayName: formData.displayName.trim(),
        apiUrl: formData.apiUrl.trim(),
        isActive: formData.isActive,
        baseRate: formData.baseRate,
        perKgRate: formData.perKgRate,
        fuelSurcharge: formData.fuelSurcharge,
        servicePincodes: formData.servicePincodes,
        supportsCOD: formData.supportsCOD,
        supportsReverse: formData.supportsReverse,
        maxWeight: formData.maxWeight > 0 ? formData.maxWeight : undefined,
        maxDimensions:
          formData.maxDimensions.length > 0 ||
          formData.maxDimensions.width > 0 ||
          formData.maxDimensions.height > 0
            ? formData.maxDimensions
            : undefined,
      };

      // Call the API to update the partner
      const response = await partnersApiService.updatePartner(
        partnerId,
        updateData,
      );

      if (response.status === "success") {
        // Redirect back to partner details
        router.push(`/partners/${partnerId}`);
      } else {
        throw new Error(response.error?.message || "Failed to update partner");
      }
    } catch (error) {
      console.error("Error updating partner:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to update partner",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/partners/${partnerId}`);
  };

  if (isLoadingPartner) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading partner details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (partnerError) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-600 mb-2">
              Error Loading Partner
            </h2>
            <p className="text-muted-foreground mb-4">{partnerError}</p>
            <Button onClick={refetch} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!partner) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              Partner Not Found
            </h2>
            <p className="text-muted-foreground">
              The requested partner could not be found.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          {/* <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Partners
          </Button> */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Edit Partner: {partner.name}
            </h1>
            <p className="text-muted-foreground">
              Update partner information and settings
            </p>
          </div>
        </div>

        {/* Submit Error Display */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700">{submitError}</p>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-blue-600" />
                  <span>Basic Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Partner Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="Enter partner name"
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Partner Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        handleInputChange("code", e.target.value)
                      }
                      placeholder="e.g., DELHIVERY, BLUEDART"
                      className={errors.code ? "border-red-500" : ""}
                    />
                    {errors.code && (
                      <p className="text-sm text-red-500">{errors.code}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name *</Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) =>
                        handleInputChange("displayName", e.target.value)
                      }
                      placeholder="e.g., Delhivery Express"
                      className={errors.displayName ? "border-red-500" : ""}
                    />
                    {errors.displayName && (
                      <p className="text-sm text-red-500">
                        {errors.displayName}
                      </p>
                    )}
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

                  <div className="space-y-2">
                    <Label htmlFor="isActive">Status</Label>
                    <Select
                      value={formData.isActive ? "active" : "inactive"}
                      onValueChange={(value) =>
                        handleInputChange("isActive", value === "active")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <span>Service Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supportsCOD">Supports COD</Label>
                    <Select
                      value={formData.supportsCOD ? "yes" : "no"}
                      onValueChange={(value) =>
                        handleInputChange("supportsCOD", value === "yes")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supportsReverse">
                      Supports Reverse Pickup
                    </Label>
                    <Select
                      value={formData.supportsReverse ? "yes" : "no"}
                      onValueChange={(value) =>
                        handleInputChange("supportsReverse", value === "yes")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxWeight">Max Weight (kg)</Label>
                    <Input
                      id="maxWeight"
                      type="number"
                      value={formData.maxWeight}
                      onChange={(e) =>
                        handleInputChange(
                          "maxWeight",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0"
                      step="0.1"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Service Pincodes</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter pincodes separated by commas (e.g., 110001, 110002, 110003)"
                      value={formData.servicePincodes.join(", ")}
                      onChange={(e) => {
                        const pincodes = e.target.value
                          .split(",")
                          .map((p) => p.trim())
                          .filter((p) => p.length > 0);
                        handleInputChange("servicePincodes", pincodes);
                      }}
                    />
                    <p className="text-sm text-gray-500">
                      Enter pincodes where this partner provides service
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <span>Pricing Structure</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Dimensions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  <span>Package Dimensions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length">Max Length (cm)</Label>
                    <Input
                      id="length"
                      type="number"
                      value={formData.maxDimensions.length}
                      onChange={(e) =>
                        handleInputChange("maxDimensions", {
                          ...formData.maxDimensions,
                          length: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      step="0.1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="width">Max Width (cm)</Label>
                    <Input
                      id="width"
                      type="number"
                      value={formData.maxDimensions.width}
                      onChange={(e) =>
                        handleInputChange("maxDimensions", {
                          ...formData.maxDimensions,
                          width: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      step="0.1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Max Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={formData.maxDimensions.height}
                      onChange={(e) =>
                        handleInputChange("maxDimensions", {
                          ...formData.maxDimensions,
                          height: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
