"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Check,
  Info,
  Loader2,
  AlertCircle,
  Save,
} from "lucide-react";
import {
  useGetPartnerByIdQuery,
  useUpdatePartnerMutation,
} from "@/store/api/endpoints/partnersApi";
import { usePermission } from "@/hooks/usePermission";

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    icon: Info,
    description: "Partner identification details",
  },
  {
    id: 2,
    title: "API Configuration",
    icon: Globe,
    description: "Integration settings",
  },
  {
    id: 3,
    title: "Review",
    icon: Check,
    description: "Confirm changes",
  },
];

interface PartnerFormData {
  // Basic Info
  name: string;
  displayName: string;
  code: string;
  isActive: boolean;

  // API Config
  apiUrl: string;
  apiToken: string;
  apiVersion: string;
}

export default function EditPartnerPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;
  const { hasPermission } = usePermission();

  const { data: partnerData, isLoading: isLoadingPartner } =
    useGetPartnerByIdQuery(partnerId);
  const [updatePartner, { isLoading: isUpdating }] = useUpdatePartnerMutation();

  const canEdit = hasPermission("partner", "update", "all");
  const partner = partnerData?.data?.partner;

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<PartnerFormData>({
    name: "",
    displayName: "",
    code: "",
    isActive: true,
    apiUrl: "",
    apiToken: "",
    apiVersion: "",
  });

  // Load partner data
  useEffect(() => {
    if (partner) {
      setFormData({
        name: partner.name || "",
        displayName: partner.displayName || "",
        code: partner.code || "",
        isActive: partner.isActive ?? true,
        apiUrl: partner.apiUrl || "",
        apiToken: partner.apiToken || "",
        apiVersion: partner.apiVersion || "",
        supportsCOD: partner.supportsCOD ?? false,
        supportsReverse: partner.supportsReverse ?? false,
        minWeight: partner.minWeight?.toString() || "",
        maxWeight: partner.maxWeight?.toString() || "",
        maxLength: partner.maxDimensions?.length?.toString() || "",
        maxWidth: partner.maxDimensions?.width?.toString() || "",
        maxHeight: partner.maxDimensions?.height?.toString() || "",
      });
    }
  }, [partner]);

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // Validate current step
  const validateStep = () => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 1:
        if (!formData.name) newErrors.name = "Partner name is required";
        if (!formData.displayName)
          newErrors.displayName = "Display name is required";
        if (!formData.code) newErrors.code = "Partner code is required";
        break;
      case 2:
        if (!formData.apiUrl) newErrors.apiUrl = "API URL is required";
        break;
      case 3:
        if (formData.minWeight && isNaN(Number(formData.minWeight))) {
          newErrors.minWeight = "Must be a valid number";
        }
        if (formData.maxWeight && isNaN(Number(formData.maxWeight))) {
          newErrors.maxWeight = "Must be a valid number";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Jump to specific step (only if step is accessible)
  const goToStep = (stepId: number) => {
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        displayName: formData.displayName,
        // Note: code is immutable, not included in update
        isActive: formData.isActive,
        apiUrl: formData.apiUrl,
        apiToken: formData.apiToken || undefined,
        apiVersion: formData.apiVersion || undefined,
        supportsCOD: formData.supportsCOD,
        supportsReverse: formData.supportsReverse,
        minWeight: formData.minWeight
          ? parseFloat(formData.minWeight)
          : undefined,
        maxWeight: formData.maxWeight
          ? parseFloat(formData.maxWeight)
          : undefined,
        maxDimensions:
          formData.maxLength && formData.maxWidth && formData.maxHeight
            ? {
                length: parseFloat(formData.maxLength),
                width: parseFloat(formData.maxWidth),
                height: parseFloat(formData.maxHeight),
              }
            : undefined,
      };

      await updatePartner({ id: partnerId, data: payload }).unwrap();
      router.push(`/partners/${partnerId}?success=partner-updated`);
    } catch (error) {
      console.error("Failed to update partner:", error);
    }
  };

  if (!canEdit) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <Alert>
            <AlertDescription>
              You don't have permission to edit partners.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoadingPartner) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!partner) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Partner not found.</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground">
                Edit Partner
              </h1>
              <p className="text-muted-foreground">
                Update partner integration details
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => router.push("/partners")}>
              Cancel
            </Button>
            {currentStep === STEPS.length && (
              <Button
                onClick={handleSubmit}
                disabled={isUpdating}
                className="flex items-center space-x-2"
              >
                {isUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Update Partner</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-8">
            {STEPS.map((step, index) => {
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
                            : "bg-gray-100 border-gray-300 text-gray-500"
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
                          isCurrent ? "text-blue-600" : "text-gray-600"
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {step.description}
                      </p>
                    </div>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-4 ${
                        isCompleted ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </p>
            <Button
              onClick={currentStep === STEPS.length ? handleSubmit : handleNext}
              disabled={isUpdating}
            >
              {currentStep === STEPS.length ? (
                isUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Partner
                  </>
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Form Steps */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>
              {STEPS[currentStep - 1].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Partner Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g., FedEx India"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="displayName">Display Name *</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) =>
                      handleInputChange("displayName", e.target.value)
                    }
                    placeholder="e.g., FedEx Express"
                    className={errors.displayName ? "border-red-500" : ""}
                  />
                  {errors.displayName && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.displayName}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="code">Partner Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Code cannot be changed
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      handleInputChange("isActive", checked)
                    }
                  />
                  <Label htmlFor="isActive">
                    Active (Partner can be used for shipments)
                  </Label>
                </div>
              </div>
            )}

            {/* Step 2: API Configuration */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="apiUrl">API Endpoint URL *</Label>
                  <Input
                    id="apiUrl"
                    type="url"
                    value={formData.apiUrl}
                    onChange={(e) =>
                      handleInputChange("apiUrl", e.target.value)
                    }
                    placeholder="https://api.partner.com"
                    className={errors.apiUrl ? "border-red-500" : ""}
                  />
                  {errors.apiUrl && (
                    <p className="text-red-500 text-sm mt-1">{errors.apiUrl}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="apiToken">API Token/Key (Optional)</Label>
                  <Input
                    id="apiToken"
                    type="password"
                    value={formData.apiToken}
                    onChange={(e) =>
                      handleInputChange("apiToken", e.target.value)
                    }
                    placeholder="Enter API authentication token"
                  />
                </div>

                <div>
                  <Label htmlFor="apiVersion">API Version (Optional)</Label>
                  <Input
                    id="apiVersion"
                    value={formData.apiVersion}
                    onChange={(e) =>
                      handleInputChange("apiVersion", e.target.value)
                    }
                    placeholder="e.g., v2.0"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Please review the changes before updating.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Basic Information</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-gray-500">Name:</dt>
                      <dd className="font-medium">{formData.name}</dd>
                      <dt className="text-gray-500">Display Name:</dt>
                      <dd className="font-medium">{formData.displayName}</dd>
                      <dt className="text-gray-500">Code:</dt>
                      <dd className="font-medium">
                        {formData.code} (unchanged)
                      </dd>
                      <dt className="text-gray-500">Status:</dt>
                      <dd>
                        <Badge
                          variant={formData.isActive ? "default" : "secondary"}
                        >
                          {formData.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </dd>
                    </dl>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-2">API Configuration</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-gray-500">API URL:</dt>
                      <dd className="font-medium break-all">
                        {formData.apiUrl}
                      </dd>
                      <dt className="text-gray-500">API Token:</dt>
                      <dd className="font-medium">
                        {formData.apiToken ? "Configured" : "Not set"}
                      </dd>
                      <dt className="text-gray-500">API Version:</dt>
                      <dd className="font-medium">
                        {formData.apiVersion || "Not specified"}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => router.push(`/partners/${partnerId}`)}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isUpdating}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Update Partner
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
