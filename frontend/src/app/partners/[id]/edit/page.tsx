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
  Key,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useGetPartnerByIdQuery,
  useUpdatePartnerMutation,
} from "@/store/api/endpoints/partnersApi";
import {
  useListPartnerChannelsQuery,
  useCreateChannelsMutation,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
  useSwitchChannelModeMutation,
  type ChannelConfig,
} from "@/store/api/endpoints/partnerChannelApi";
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
  channelMode: "SINGLE" | "MULTI";
  apiUrl: string;
  apiToken: string;
  apiVersion: string;
  channelConfigs: ChannelConfig[];

  // Service Config
  supportsCOD: boolean;
  supportsReverse: boolean;
  minWeight: string;
  maxWeight: string;
  maxLength: string;
  maxWidth: string;
  maxHeight: string;
}

export default function EditPartnerPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;
  const { hasPermission } = usePermission();

  const { data: partnerData, isLoading: isLoadingPartner } =
    useGetPartnerByIdQuery(partnerId);
  const { data: channelsData } = useListPartnerChannelsQuery(partnerId, {
    skip: !partnerId,
  });
  const [updatePartner, { isLoading: isUpdating }] = useUpdatePartnerMutation();
  const [switchChannelMode] = useSwitchChannelModeMutation();
  const [createChannels] = useCreateChannelsMutation();
  const [updateChannel] = useUpdateChannelMutation();
  const [deleteChannel] = useDeleteChannelMutation();

  const canEdit = hasPermission("partner", "update", "all");
  const partner = partnerData?.data?.partner;
  const channels = channelsData?.data?.channels || [];

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<PartnerFormData>({
    name: "",
    displayName: "",
    code: "",
    isActive: true,
    channelMode: "SINGLE",
    apiUrl: "",
    apiToken: "",
    apiVersion: "",
    channelConfigs: [],
    supportsCOD: false,
    supportsReverse: false,
    minWeight: "",
    maxWeight: "",
    maxLength: "",
    maxWidth: "",
    maxHeight: "",
  });

  // Load partner data
  useEffect(() => {
    if (partner) {
      setFormData({
        name: partner.name || "",
        displayName: partner.displayName || "",
        code: partner.code || "",
        isActive: partner.isActive ?? true,
        channelMode: partner.channelMode || "SINGLE",
        apiUrl: partner.apiUrl || "",
        apiToken: partner.apiToken || "",
        apiVersion: partner.apiVersion || "",
        channelConfigs: [],
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

  // Load channel configs when fetched
  useEffect(() => {
    if (channels && channels.length > 0) {
      setFormData((prev) => ({
        ...prev,
        channelConfigs: channels.map((c: any) => ({
          id: c.id,
          channelName: c.channelName,
          apiUrl: c.apiUrl,
          apiKey: c.apiKey || "",
          isActive: c.isActive ?? true,
          isPrimary: c.isPrimary ?? false,
          priority: c.priority ?? 1,
        })),
      }));
    }
  }, [channels]);

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  // Channel management handlers
  const addChannel = () => {
    setFormData((prev) => ({
      ...prev,
      channelConfigs: [
        ...prev.channelConfigs,
        {
          channelName: `channel-${prev.channelConfigs.length + 1}`,
          apiUrl: "",
          apiKey: "",
          isActive: true,
          isPrimary: prev.channelConfigs.length === 0,
          priority: prev.channelConfigs.length + 1,
        },
      ],
    }));
  };

  const removeChannel = async (index: number) => {
    const channel = formData.channelConfigs[index];
    if (channel.id) {
      // Delete from backend
      try {
        await deleteChannel(channel.id).unwrap();
      } catch (error) {
        console.error("Failed to delete channel:", error);
        return;
      }
    }
    setFormData((prev) => {
      const newConfigs = prev.channelConfigs.filter((_, i) => i !== index);
      if (prev.channelConfigs[index]?.isPrimary && newConfigs.length > 0) {
        newConfigs[0].isPrimary = true;
      }
      return { ...prev, channelConfigs: newConfigs };
    });
  };

  const handleUpdateChannel = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const newConfigs = [...prev.channelConfigs];
      newConfigs[index] = { ...newConfigs[index], [field]: value };

      if (field === "isPrimary" && value === true) {
        newConfigs.forEach((c, i) => {
          if (i !== index) c.isPrimary = false;
        });
      }

      return { ...prev, channelConfigs: newConfigs };
    });
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
        if (formData.channelMode === "SINGLE") {
          if (!formData.apiUrl) newErrors.apiUrl = "API URL is required";
        } else {
          if (formData.channelConfigs.length === 0) {
            newErrors.channelConfigs = "At least one channel is required";
          } else {
            formData.channelConfigs.forEach((channel, index) => {
              if (!channel.channelName) {
                newErrors[`channelName-${index}`] = "Channel name is required";
              }
              if (!channel.apiUrl) {
                newErrors[`channelUrl-${index}`] = "API URL is required";
              }
            });
          }
        }
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
      const payload: any = {
        name: formData.name,
        displayName: formData.displayName,
        isActive: formData.isActive,
        channelMode: formData.channelMode,
      };

      // Add channel-specific data
      if (formData.channelMode === "SINGLE") {
        payload.apiUrl = formData.apiUrl;
        payload.apiToken = formData.apiToken || undefined;
        payload.apiVersion = formData.apiVersion || undefined;
      } else {
        payload.channelConfigs = formData.channelConfigs.map((c) => ({
          id: c.id,
          channelName: c.channelName,
          apiUrl: c.apiUrl,
          apiKey: c.apiKey || undefined,
          isActive: c.isActive,
          isPrimary: c.isPrimary,
          priority: c.priority,
        }));
      }

      // Handle service config (existing fields)
      payload.supportsCOD = formData.supportsCOD;
      payload.supportsReverse = formData.supportsReverse;
      payload.minWeight = formData.minWeight
        ? parseFloat(formData.minWeight)
        : undefined;
      payload.maxWeight = formData.maxWeight
        ? parseFloat(formData.maxWeight)
        : undefined;
      payload.maxDimensions =
        formData.maxLength && formData.maxWidth && formData.maxHeight
          ? {
              length: parseFloat(formData.maxLength),
              width: parseFloat(formData.maxWidth),
              height: parseFloat(formData.maxHeight),
            }
          : undefined;

      // First, update partner with new channel mode
      await updatePartner({ id: partnerId, data: payload }).unwrap();

      // Handle channel mode switching and channel updates
      if (formData.channelMode === "MULTI") {
        // Switch to MULTI mode if needed
        if (partner?.channelMode !== "MULTI") {
          try {
            await switchChannelMode({
              partnerId,
              mode: "MULTI",
              migrateConfig: true,
            }).unwrap();
          } catch (e) {
            console.log("Channel mode switch skipped or failed:", e);
          }
        }

        // Update channels
        for (const channel of formData.channelConfigs) {
          if (channel.id) {
            // Update existing channel
            await updateChannel({
              channelId: channel.id,
              updates: {
                channelName: channel.channelName,
                apiUrl: channel.apiUrl,
                apiKey: channel.apiKey,
                isActive: channel.isActive,
                isPrimary: channel.isPrimary,
                priority: channel.priority,
              },
            }).unwrap();
          } else {
            // New channel (shouldn't happen in edit, but handle it)
            await createChannels({
              partnerId,
              channels: [channel],
            }).unwrap();
          }
        }
      } else {
        // Switch to SINGLE mode if needed
        if (partner?.channelMode !== "SINGLE") {
          try {
            await switchChannelMode({
              partnerId,
              mode: "SINGLE",
              migrateConfig: true,
            }).unwrap();
          } catch (e) {
            console.log("Channel mode switch skipped or failed:", e);
          }
        }
      }

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
        <div className="bg-card rounded-lg border border-border p-6">
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
                            : "bg-muted border-border text-muted-foreground"
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
                          isCurrent ? "text-blue-600" : "text-foreground"
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-4 ${
                        isCompleted ? "bg-green-500" : "bg-border"
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
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
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
              <div className="space-y-6">
                {/* Channel Mode Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div>
                    <h3 className="font-medium">Channel Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      {formData.channelMode === "SINGLE"
                        ? "Single API endpoint configuration"
                        : "Multiple API endpoints with load balancing"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 bg-background p-1 rounded-lg border">
                    <Button
                      variant={
                        formData.channelMode === "SINGLE" ? "default" : "ghost"
                      }
                      size="sm"
                      onClick={() => handleInputChange("channelMode", "SINGLE")}
                    >
                      Single
                    </Button>
                    <Button
                      variant={
                        formData.channelMode === "MULTI" ? "default" : "ghost"
                      }
                      size="sm"
                      onClick={() => handleInputChange("channelMode", "MULTI")}
                    >
                      Multi
                    </Button>
                  </div>
                </div>

                {/* Single Channel Form */}
                {formData.channelMode === "SINGLE" && (
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
                        <p className="text-red-500 text-sm mt-1">
                          {errors.apiUrl}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="apiToken">API Key (Optional)</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="apiToken"
                          type="password"
                          value={formData.apiToken}
                          onChange={(e) =>
                            handleInputChange("apiToken", e.target.value)
                          }
                          placeholder="Enter API authentication key"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
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
                )}

                {/* Multi Channel Form */}
                {formData.channelMode === "MULTI" && (
                  <div className="space-y-4">
                    {errors.channelConfigs && (
                      <p className="text-sm text-red-500 flex items-center space-x-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>{errors.channelConfigs}</span>
                      </p>
                    )}

                    {formData.channelConfigs.map((channel, index) => (
                      <div
                        key={channel.id || index}
                        className="p-4 border rounded-lg space-y-3 bg-muted/30"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Channel {index + 1}</h4>
                          {formData.channelConfigs.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeChannel(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Channel Name *</Label>
                            <Input
                              value={channel.channelName}
                              onChange={(e) =>
                                handleUpdateChannel(
                                  index,
                                  "channelName",
                                  e.target.value,
                                )
                              }
                              placeholder="e.g., production"
                              className={
                                errors[`channelName-${index}`]
                                  ? "border-red-500"
                                  : ""
                              }
                            />
                            {errors[`channelName-${index}`] && (
                              <p className="text-sm text-red-500">
                                {errors[`channelName-${index}`]}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>API URL *</Label>
                            <Input
                              type="url"
                              value={channel.apiUrl}
                              onChange={(e) =>
                                handleUpdateChannel(
                                  index,
                                  "apiUrl",
                                  e.target.value,
                                )
                              }
                              placeholder="https://api.partner.com"
                              className={
                                errors[`channelUrl-${index}`]
                                  ? "border-red-500"
                                  : ""
                              }
                            />
                            {errors[`channelUrl-${index}`] && (
                              <p className="text-sm text-red-500">
                                {errors[`channelUrl-${index}`]}
                              </p>
                            )}
                          </div>

                          <div className="col-span-2 space-y-2">
                            <Label>API Key (Optional)</Label>
                            <Input
                              type="password"
                              value={channel.apiKey}
                              onChange={(e) =>
                                handleUpdateChannel(
                                  index,
                                  "apiKey",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter API key"
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <Checkbox
                            checked={channel.isPrimary}
                            onCheckedChange={(checked) =>
                              handleUpdateChannel(index, "isPrimary", checked)
                            }
                            id={`primary-${index}`}
                          />
                          <Label
                            htmlFor={`primary-${index}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            Primary Channel
                          </Label>
                          {channel.isPrimary && (
                            <Badge variant="default" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      onClick={addChannel}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Channel
                    </Button>
                  </div>
                )}
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
                      <dt className="text-muted-foreground">Name:</dt>
                      <dd className="font-medium">{formData.name}</dd>
                      <dt className="text-muted-foreground">Display Name:</dt>
                      <dd className="font-medium">{formData.displayName}</dd>
                      <dt className="text-muted-foreground">Code:</dt>
                      <dd className="font-medium">
                        {formData.code} (unchanged)
                      </dd>
                      <dt className="text-muted-foreground">Status:</dt>
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
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {formData.channelMode} Channel
                        </Badge>
                        {partner?.channelMode !== formData.channelMode && (
                          <Badge variant="secondary" className="text-xs">
                            Mode will change
                          </Badge>
                        )}
                      </div>

                      {formData.channelMode === "SINGLE" ? (
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                          <dt className="text-muted-foreground">API URL:</dt>
                          <dd className="font-medium break-all">
                            {formData.apiUrl || "Not set"}
                          </dd>
                          <dt className="text-muted-foreground">API Key:</dt>
                          <dd className="font-medium">
                            {formData.apiToken ? "Configured" : "Not set"}
                          </dd>
                          <dt className="text-muted-foreground">
                            API Version:
                          </dt>
                          <dd className="font-medium">
                            {formData.apiVersion || "Not specified"}
                          </dd>
                        </dl>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            {formData.channelConfigs.length} channel(s)
                            configured
                          </p>
                          {formData.channelConfigs.map((channel, index) => (
                            <div
                              key={channel.id || index}
                              className="p-3 border rounded bg-muted/30"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">
                                  {channel.channelName}
                                </span>
                                <div className="flex items-center space-x-2">
                                  {channel.isPrimary && (
                                    <Badge
                                      variant="default"
                                      className="text-xs"
                                    >
                                      Primary
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={
                                      channel.isActive ? "default" : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {channel.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <div className="grid grid-cols-2 gap-2">
                                  <span>
                                    URL: {channel.apiUrl || "Not set"}
                                  </span>
                                  <span>
                                    Key:{" "}
                                    {channel.apiKey ? "Configured" : "Not set"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
