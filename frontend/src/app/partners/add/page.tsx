"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Key,
  AlertCircle,
  Save,
  Code,
  TrendingUp,
} from "lucide-react";
import { useCreatePartnerMutation } from "@/store/api/endpoints/partnersApi";
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
    description: "Confirm partner details",
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

export default function AddPartnerPage() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const [createPartner, { isLoading }] = useCreatePartnerMutation();

  const canCreate = hasPermission("partner", "create", "all");

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

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Partners", href: "/partners" },
    { title: "Add New" },
  ];

  // Generate partner code
  const generatePartnerCode = () => {
    if (formData.name) {
      const prefix = formData.name.substring(0, 3).toUpperCase();
      const suffix = Math.floor(100 + Math.random() * 900);
      setFormData((prev) => ({ ...prev, code: `${prefix}${suffix}` }));
    }
  };

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
        code: formData.code,
        isActive: formData.isActive,
        apiUrl: formData.apiUrl,
        apiToken: formData.apiToken || undefined,
        apiVersion: formData.apiVersion || undefined,
      };

      await createPartner(payload).unwrap();
      router.push("/partners?success=partner-created");
    } catch (error) {
      console.error("Failed to create partner:", error);
    }
  };

  if (!canCreate) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-4xl mx-auto">
          <Alert>
            <AlertDescription>
              You don't have permission to create partners.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground">
                Add Partner
              </h1>
              <p className="text-muted-foreground">
                Create a new courier partner integration
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
                disabled={isLoading}
                className="flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Create Partner</span>
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

          {/* Step Counter */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1 || isLoading}
              className="flex items-center space-x-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </p>
            <Button
              onClick={currentStep === STEPS.length ? handleSubmit : handleNext}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form Content */}
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Info className="h-5 w-5" />
                <span>Basic Information</span>
              </CardTitle>
              <CardDescription>Partner identification details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Partner Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g., FedEx India"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.name}</span>
                    </p>
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
                    placeholder="e.g., FedEx Express"
                    className={errors.displayName ? "border-red-500" : ""}
                  />
                  {errors.displayName && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.displayName}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Partner Code *</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Code className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) =>
                          handleInputChange(
                            "code",
                            e.target.value.toUpperCase(),
                          )
                        }
                        placeholder="e.g., FDX001"
                        className={`pl-10 ${errors.code ? "border-red-500" : ""}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generatePartnerCode}
                      disabled={!formData.name}
                    >
                      Generate
                    </Button>
                  </div>
                  {errors.code && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.code}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex items-center space-x-2 h-10">
                    <Checkbox
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) =>
                        handleInputChange("isActive", checked)
                      }
                    />
                    <Label htmlFor="isActive" className="text-sm font-normal">
                      Active (Partner can be used for shipments)
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: API Configuration */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>API Configuration</span>
              </CardTitle>
              <CardDescription>
                Integration endpoint and authentication settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">API Endpoint URL *</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="apiUrl"
                    type="url"
                    value={formData.apiUrl}
                    onChange={(e) =>
                      handleInputChange("apiUrl", e.target.value)
                    }
                    placeholder="https://api.partner.com"
                    className={`pl-10 ${errors.apiUrl ? "border-red-500" : ""}`}
                  />
                </div>
                {errors.apiUrl && (
                  <p className="text-sm text-red-500 flex items-center space-x-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.apiUrl}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiToken">API Token/Key (Optional)</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="apiToken"
                      type="password"
                      value={formData.apiToken}
                      onChange={(e) =>
                        handleInputChange("apiToken", e.target.value)
                      }
                      placeholder="Enter API authentication token"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiVersion">API Version (Optional)</Label>
                  <div className="relative">
                    <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="apiVersion"
                      value={formData.apiVersion}
                      onChange={(e) =>
                        handleInputChange("apiVersion", e.target.value)
                      }
                      placeholder="e.g., v2.0"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Check className="h-5 w-5" />
                <span>Review Partner Details</span>
              </CardTitle>
              <CardDescription>
                Please review the partner details before creating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Please review the partner details before creating.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-3 flex items-center space-x-2">
                    <Info className="h-4 w-4" />
                    <span>Basic Information</span>
                  </h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <dt className="text-gray-500">Name:</dt>
                    <dd className="font-medium">{formData.name}</dd>
                    <dt className="text-gray-500">Display Name:</dt>
                    <dd className="font-medium">{formData.displayName}</dd>
                    <dt className="text-gray-500">Code:</dt>
                    <dd className="font-medium">{formData.code}</dd>
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
                  <h3 className="font-medium mb-3 flex items-center space-x-2">
                    <Globe className="h-4 w-4" />
                    <span>API Configuration</span>
                  </h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <dt className="text-gray-500">API URL:</dt>
                    <dd className="font-medium break-all">{formData.apiUrl}</dd>
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
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
