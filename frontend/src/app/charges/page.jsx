"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Weight,
  Ruler,
  Package,
  Calculator,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Search,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Loader2,
  Eye,
  X,
  Save,
  Users,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  useGetChargePackagesQuery,
  useGetChargePackageByIdQuery,
  useCreateChargePackageMutation,
  useUpdateChargePackageMutation,
  useToggleChargePackageStatusMutation,
  useDeleteChargePackageMutation,
} from "@/store/api/endpoints/chargePackagesApi";
import { useGetPartnersQuery } from "@/store/api/endpoints/partnersApi";

// Package type icon mapping
function getPackageTypeIcon(type, size = "h-5 w-5") {
  switch (type) {
    case "WEIGHT":
      return <Weight className={`${size} text-blue-600`} />;
    case "DISTANCE":
      return <Ruler className={`${size} text-green-600`} />;
    case "GENERIC":
      return <Package className={`${size} text-purple-600`} />;
    default:
      return <Calculator className={`${size} text-gray-600`} />;
  }
}

// Package type color mapping
function getPackageTypeColor(type) {
  switch (type) {
    case "WEIGHT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "DISTANCE":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "GENERIC":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

// Format currency
function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

// Format unit based on package type
function formatUnit(value, type) {
  if (value === null || value === undefined) return "-";
  if (type === "WEIGHT") return `${value} kg`;
  if (type === "DISTANCE") return `${value} km`;
  return value;
}

// ============================================
// CREATE MODAL COMPONENT
// ============================================
function CreateChargePackageModal({ open, onClose, partners }) {
  const [formData, setFormData] = useState({
    partnerIds: [],
    name: "",
    type: "",
    baseCharge: "",
    baseUnit: "",
    addonUnit: "",
    addonCharge: "",
    appliesTo: "ANY",
    calcType: "FLAT",
    isActive: true,
  });
  const [errors, setErrors] = useState({});

  const [createPackage, { isLoading }] = useCreateChargePackageMutation();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        partnerIds: [],
        name: "",
        type: "",
        baseCharge: "",
        baseUnit: "",
        addonUnit: "",
        addonCharge: "",
        appliesTo: "ANY",
        calcType: "FLAT",
        isActive: true,
      });
      setErrors({});
    }
  }, [open]);

  const handlePartnerToggle = (partnerId) => {
    setFormData((prev) => ({
      ...prev,
      partnerIds: prev.partnerIds.includes(partnerId)
        ? prev.partnerIds.filter((id) => id !== partnerId)
        : [...prev.partnerIds, partnerId],
    }));
  };

  const handleSelectAllPartners = () => {
    setFormData((prev) => ({ ...prev, partnerIds: partners.map((p) => p.id) }));
  };

  const handleClearPartners = () => {
    setFormData((prev) => ({ ...prev, partnerIds: [] }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (formData.partnerIds.length === 0)
      newErrors.partnerIds = "Select at least one partner";
    if (!formData.name.trim()) newErrors.name = "Package name is required";
    if (!formData.type) newErrors.type = "Package type is required";
    if (!formData.baseCharge || parseFloat(formData.baseCharge) <= 0)
      newErrors.baseCharge = "Base charge must be greater than 0";

    if (formData.type === "WEIGHT" || formData.type === "DISTANCE") {
      if (!formData.baseUnit || parseFloat(formData.baseUnit) < 0)
        newErrors.baseUnit = "Base unit is required";
      if (!formData.addonUnit || parseFloat(formData.addonUnit) <= 0)
        newErrors.addonUnit = "Addon unit must be greater than 0";
      if (!formData.addonCharge || parseFloat(formData.addonCharge) < 0)
        newErrors.addonCharge = "Addon charge is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const payload = {
      partnerIds: formData.partnerIds,
      name: formData.name.trim(),
      type: formData.type,
      baseCharge: parseFloat(formData.baseCharge),
      isActive: formData.isActive,
    };

    if (formData.type === "WEIGHT" || formData.type === "DISTANCE") {
      payload.baseUnit = parseFloat(formData.baseUnit);
      payload.addonUnit = parseFloat(formData.addonUnit);
      payload.addonCharge = parseFloat(formData.addonCharge);
    }

    if (formData.type === "GENERIC") {
      payload.appliesTo = formData.appliesTo;
      payload.calcType = formData.calcType;
    }

    try {
      await createPackage(payload).unwrap();
      onClose();
    } catch (err) {
      console.error("Failed to create package:", err);
      setErrors({
        submit: err?.data?.error?.message || "Failed to create package",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Charge Package
          </DialogTitle>
          <DialogDescription>
            Create a new charge package for one or more partners.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Partner Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Select Partners *
              </Label>
              <div className="space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllPartners}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearPartners}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
              {partners.map((partner) => (
                <label
                  key={partner.id}
                  className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
                    formData.partnerIds.includes(partner.id)
                      ? "bg-primary/10 border border-primary"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <Checkbox
                    checked={formData.partnerIds.includes(partner.id)}
                    onCheckedChange={() => handlePartnerToggle(partner.id)}
                  />
                  <span className="text-sm truncate">
                    {partner.displayName || partner.name}
                  </span>
                </label>
              ))}
            </div>
            {errors.partnerIds && (
              <p className="text-red-500 text-sm">{errors.partnerIds}</p>
            )}
          </div>

          {/* Package Name & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Package Name *</Label>
              <Input
                placeholder="e.g., Standard Weight Charge"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-red-500 text-sm">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Package Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(val) => handleChange("type", val)}
              >
                <SelectTrigger className={errors.type ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEIGHT">
                    <div className="flex items-center gap-2">
                      <Weight className="h-4 w-4" /> Weight (kg)
                    </div>
                  </SelectItem>
                  <SelectItem value="DISTANCE">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4" /> Distance (km)
                    </div>
                  </SelectItem>
                  <SelectItem value="GENERIC">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" /> Generic (flat)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-red-500 text-sm">{errors.type}</p>
              )}
            </div>
          </div>

          {/* Base Charge */}
          <div className="space-y-2">
            <Label>Base Charge (₹) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="100.00"
              value={formData.baseCharge}
              onChange={(e) => handleChange("baseCharge", e.target.value)}
              className={errors.baseCharge ? "border-red-500" : ""}
            />
            {errors.baseCharge && (
              <p className="text-red-500 text-sm">{errors.baseCharge}</p>
            )}
          </div>

          {/* Weight/Distance specific fields */}
          {(formData.type === "WEIGHT" || formData.type === "DISTANCE") && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <strong>Example:</strong> ₹{formData.baseCharge || "100"} for
                first {formData.baseUnit || "X"}{" "}
                {formData.type === "WEIGHT" ? "kg" : "km"}, then ₹
                {formData.addonCharge || "10"} per {formData.addonUnit || "1"}{" "}
                {formData.type === "WEIGHT" ? "kg" : "km"}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>
                    Base{" "}
                    {formData.type === "WEIGHT"
                      ? "Weight (kg)"
                      : "Distance (km)"}{" "}
                    *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={formData.type === "WEIGHT" ? "0.5" : "10"}
                    value={formData.baseUnit}
                    onChange={(e) => handleChange("baseUnit", e.target.value)}
                    className={errors.baseUnit ? "border-red-500" : ""}
                  />
                  {errors.baseUnit && (
                    <p className="text-red-500 text-sm">{errors.baseUnit}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    Addon{" "}
                    {formData.type === "WEIGHT"
                      ? "Weight (kg)"
                      : "Distance (km)"}{" "}
                    *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={formData.type === "WEIGHT" ? "0.5" : "1"}
                    value={formData.addonUnit}
                    onChange={(e) => handleChange("addonUnit", e.target.value)}
                    className={errors.addonUnit ? "border-red-500" : ""}
                  />
                  {errors.addonUnit && (
                    <p className="text-red-500 text-sm">{errors.addonUnit}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Addon Charge (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10.00"
                    value={formData.addonCharge}
                    onChange={(e) =>
                      handleChange("addonCharge", e.target.value)
                    }
                    className={errors.addonCharge ? "border-red-500" : ""}
                  />
                  {errors.addonCharge && (
                    <p className="text-red-500 text-sm">{errors.addonCharge}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Generic specific fields */}
          {formData.type === "GENERIC" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Applies To</Label>
                <Select
                  value={formData.appliesTo}
                  onValueChange={(val) => handleChange("appliesTo", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any (All shipments)</SelectItem>
                    <SelectItem value="COD">COD Only</SelectItem>
                    <SelectItem value="PREPAID">Prepaid Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Calculation Type</Label>
                <Select
                  value={formData.calcType}
                  onValueChange={(val) => handleChange("calcType", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">Flat Amount</SelectItem>
                    <SelectItem value="PERCENTAGE_OF_COD">
                      % of COD Amount
                    </SelectItem>
                    <SelectItem value="PERCENTAGE_OF_DECLARED_VALUE">
                      % of Declared Value
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">
                {errors.submit}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Create Package
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// VIEW/EDIT MODAL COMPONENT
// ============================================
function ViewEditChargePackageModal({
  open,
  onClose,
  packageId,
  mode: initialMode,
}) {
  const [mode, setMode] = useState(initialMode); // 'view' or 'edit'
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const { data: packageData, isLoading: isLoadingPackage } =
    useGetChargePackageByIdQuery(packageId, {
      skip: !packageId || !open,
    });

  const [updatePackage, { isLoading: isUpdating }] =
    useUpdateChargePackageMutation();
  const [toggleStatus, { isLoading: isToggling }] =
    useToggleChargePackageStatusMutation();

  const pkg = packageData?.data?.package;

  // Initialize form when package data loads
  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name || "",
        type: pkg.type || "",
        baseCharge: pkg.baseCharge?.toString() || "",
        baseUnit: pkg.baseUnit?.toString() || "",
        addonUnit: pkg.addonUnit?.toString() || "",
        addonCharge: pkg.addonCharge?.toString() || "",
        appliesTo: pkg.appliesTo || "ANY",
        calcType: pkg.calcType || "FLAT",
        isActive: pkg.isActive ?? true,
      });
    }
  }, [pkg]);

  // Reset mode when modal opens
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setErrors({});
    }
  }, [open, initialMode]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Package name is required";
    if (!formData.baseCharge || parseFloat(formData.baseCharge) <= 0)
      newErrors.baseCharge = "Base charge must be greater than 0";

    if (formData.type === "WEIGHT" || formData.type === "DISTANCE") {
      if (!formData.baseUnit || parseFloat(formData.baseUnit) < 0)
        newErrors.baseUnit = "Base unit is required";
      if (!formData.addonUnit || parseFloat(formData.addonUnit) <= 0)
        newErrors.addonUnit = "Addon unit must be greater than 0";
      if (!formData.addonCharge || parseFloat(formData.addonCharge) < 0)
        newErrors.addonCharge = "Addon charge is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const payload = {
      name: formData.name.trim(),
      baseCharge: parseFloat(formData.baseCharge),
      isActive: formData.isActive,
    };

    if (formData.type === "WEIGHT" || formData.type === "DISTANCE") {
      payload.baseUnit = parseFloat(formData.baseUnit);
      payload.addonUnit = parseFloat(formData.addonUnit);
      payload.addonCharge = parseFloat(formData.addonCharge);
    }

    if (formData.type === "GENERIC") {
      payload.appliesTo = formData.appliesTo;
      payload.calcType = formData.calcType;
    }

    try {
      await updatePackage({ id: packageId, data: payload }).unwrap();
      setMode("view");
    } catch (err) {
      console.error("Failed to update package:", err);
      setErrors({
        submit: err?.data?.error?.message || "Failed to update package",
      });
    }
  };

  const handleToggleStatus = async () => {
    try {
      await toggleStatus({ id: packageId, isActive: !pkg?.isActive }).unwrap();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  if (isLoadingPackage) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!pkg) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-8 space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <p className="text-lg font-medium">Package not found</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            {getPackageTypeIcon(pkg.type, "h-5 w-5")}
            {mode === "view" ? "View" : "Edit"} Charge Package
          </DialogTitle>
          <DialogDescription>
            {pkg.partner?.displayName || pkg.partner?.name} • {pkg.type} package
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle buttons - positioned below header */}
        <div className="flex items-center gap-2 -mt-2 mb-2">
          {mode === "view" ? (
            <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setMode("view")}>
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
        </div>

        <div className="space-y-6 py-4">
          {/* Status Badge & Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={pkg.isActive ? "default" : "secondary"}>
                {pkg.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              disabled={isToggling}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : pkg.isActive ? (
                <>
                  <ToggleLeft className="h-4 w-4 mr-1" /> Deactivate
                </>
              ) : (
                <>
                  <ToggleRight className="h-4 w-4 mr-1" /> Activate
                </>
              )}
            </Button>
          </div>

          {/* Partner Info */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Partner</Label>
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {pkg.partner?.displayName || pkg.partner?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pkg.partner?.code}
                </p>
              </div>
            </div>
          </div>

          {/* Package Type (always read-only) */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Package Type</Label>
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              {getPackageTypeIcon(pkg.type, "h-5 w-5")}
              <span className="font-medium">
                {pkg.type === "WEIGHT" && "Weight-based (kg)"}
                {pkg.type === "DISTANCE" && "Distance-based (km)"}
                {pkg.type === "GENERIC" && "Generic (flat)"}
              </span>
            </div>
          </div>

          <Separator />

          {/* Editable Fields */}
          {mode === "view" ? (
            // VIEW MODE
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Package Name</Label>
                  <p className="font-medium mt-1">{pkg.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Base Charge</Label>
                  <p className="font-medium mt-1">
                    {formatCurrency(pkg.baseCharge)}
                  </p>
                </div>
              </div>

              {(pkg.type === "WEIGHT" || pkg.type === "DISTANCE") && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">
                      Base {pkg.type === "WEIGHT" ? "Weight" : "Distance"}
                    </Label>
                    <p className="font-medium mt-1">
                      {formatUnit(pkg.baseUnit, pkg.type)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Addon {pkg.type === "WEIGHT" ? "Weight" : "Distance"}
                    </Label>
                    <p className="font-medium mt-1">
                      {formatUnit(pkg.addonUnit, pkg.type)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Addon Charge
                    </Label>
                    <p className="font-medium mt-1">
                      {formatCurrency(pkg.addonCharge || 0)}
                    </p>
                  </div>
                </div>
              )}

              {pkg.type === "GENERIC" && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">Applies To</Label>
                    <p className="font-medium mt-1">{pkg.appliesTo}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Calculation Type
                    </Label>
                    <p className="font-medium mt-1">
                      {pkg.calcType?.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              )}

              {/* Calculation Example */}
              {(pkg.type === "WEIGHT" || pkg.type === "DISTANCE") &&
                pkg.baseUnit &&
                pkg.addonUnit && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">
                      Calculation Example:
                    </p>
                    <p className="text-sm text-muted-foreground">
                      For {pkg.type === "WEIGHT" ? "2 kg" : "25 km"}:{" "}
                      {formatCurrency(pkg.baseCharge)} (first{" "}
                      {formatUnit(pkg.baseUnit, pkg.type)}) +{" "}
                      {formatCurrency(
                        Math.ceil(
                          ((pkg.type === "WEIGHT" ? 2 : 25) -
                            parseFloat(pkg.baseUnit)) /
                            parseFloat(pkg.addonUnit),
                        ) * parseFloat(pkg.addonCharge || 0),
                      )}{" "}
                      ={" "}
                      <strong>
                        {formatCurrency(
                          parseFloat(pkg.baseCharge) +
                            Math.ceil(
                              ((pkg.type === "WEIGHT" ? 2 : 25) -
                                parseFloat(pkg.baseUnit)) /
                                parseFloat(pkg.addonUnit),
                            ) *
                              parseFloat(pkg.addonCharge || 0),
                        )}
                      </strong>
                    </p>
                  </div>
                )}
            </div>
          ) : (
            // EDIT MODE
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Package Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm">{errors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Base Charge (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.baseCharge}
                    onChange={(e) => handleChange("baseCharge", e.target.value)}
                    className={errors.baseCharge ? "border-red-500" : ""}
                  />
                  {errors.baseCharge && (
                    <p className="text-red-500 text-sm">{errors.baseCharge}</p>
                  )}
                </div>
              </div>

              {(formData.type === "WEIGHT" || formData.type === "DISTANCE") && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="space-y-2">
                    <Label>
                      Base{" "}
                      {formData.type === "WEIGHT"
                        ? "Weight (kg)"
                        : "Distance (km)"}{" "}
                      *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.baseUnit}
                      onChange={(e) => handleChange("baseUnit", e.target.value)}
                      className={errors.baseUnit ? "border-red-500" : ""}
                    />
                    {errors.baseUnit && (
                      <p className="text-red-500 text-sm">{errors.baseUnit}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Addon{" "}
                      {formData.type === "WEIGHT"
                        ? "Weight (kg)"
                        : "Distance (km)"}{" "}
                      *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.addonUnit}
                      onChange={(e) =>
                        handleChange("addonUnit", e.target.value)
                      }
                      className={errors.addonUnit ? "border-red-500" : ""}
                    />
                    {errors.addonUnit && (
                      <p className="text-red-500 text-sm">{errors.addonUnit}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Addon Charge (₹) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.addonCharge}
                      onChange={(e) =>
                        handleChange("addonCharge", e.target.value)
                      }
                      className={errors.addonCharge ? "border-red-500" : ""}
                    />
                    {errors.addonCharge && (
                      <p className="text-red-500 text-sm">
                        {errors.addonCharge}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formData.type === "GENERIC" && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="space-y-2">
                    <Label>Applies To</Label>
                    <Select
                      value={formData.appliesTo}
                      onValueChange={(val) => handleChange("appliesTo", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANY">Any (All shipments)</SelectItem>
                        <SelectItem value="COD">COD Only</SelectItem>
                        <SelectItem value="PREPAID">Prepaid Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Calculation Type</Label>
                    <Select
                      value={formData.calcType}
                      onValueChange={(val) => handleChange("calcType", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FLAT">Flat Amount</SelectItem>
                        <SelectItem value="PERCENTAGE_OF_COD">
                          % of COD Amount
                        </SelectItem>
                        <SelectItem value="PERCENTAGE_OF_DECLARED_VALUE">
                          % of Declared Value
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {errors.submit && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {errors.submit}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === "view" ? (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setMode("view")}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Changes
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function ChargesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewEditModalOpen, setViewEditModalOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [modalMode, setModalMode] = useState("view");

  // Fetch charge packages
  const {
    data: packagesData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetChargePackagesQuery({
    page,
    limit,
    ...(filterType !== "all" && { type: filterType }),
    ...(filterStatus !== "all" && { isActive: filterStatus === "active" }),
    ...(filterPartner !== "all" && { partnerId: filterPartner }),
    ...(searchTerm && { search: searchTerm }),
  });

  // Fetch partners for filter and create modal
  const { data: partnersData, isLoading: isLoadingPartners } =
    useGetPartnersQuery({ isActive: true });
  const partners = partnersData?.data?.partners || [];

  const [deletePackage] = useDeleteChargePackageMutation();
  const [toggleStatus] = useToggleChargePackageStatusMutation();

  const packages = packagesData?.data?.packages || [];
  const pagination = packagesData?.data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: pagination.total,
      active: packages.filter((p) => p.isActive).length,
      weight: packages.filter((p) => p.type === "WEIGHT").length,
      distance: packages.filter((p) => p.type === "DISTANCE").length,
      generic: packages.filter((p) => p.type === "GENERIC").length,
    };
  }, [packages, pagination.total]);

  // Handle actions
  const handleView = (pkg) => {
    setSelectedPackageId(pkg.id);
    setModalMode("view");
    setViewEditModalOpen(true);
  };

  const handleEdit = (pkg) => {
    setSelectedPackageId(pkg.id);
    setModalMode("edit");
    setViewEditModalOpen(true);
  };

  const handleToggleStatus = async (pkg) => {
    try {
      await toggleStatus({ id: pkg.id, isActive: !pkg.isActive }).unwrap();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDelete = async (pkgId) => {
    if (confirm("Are you sure you want to delete this charge package?")) {
      try {
        await deletePackage(pkgId).unwrap();
      } catch (err) {
        console.error("Failed to delete package:", err);
      }
    }
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[{ title: "Charge Packages", href: "/charges" }]}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Charge Packages
            </h1>
            <p className="text-muted-foreground">
              Manage weight, distance, and generic charge packages for partners.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Package
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active} active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weight</CardTitle>
              <Weight className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weight}</div>
              <p className="text-xs text-muted-foreground">packages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distance</CardTitle>
              <Ruler className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.distance}</div>
              <p className="text-xs text-muted-foreground">packages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Generic</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.generic}</div>
              <p className="text-xs text-muted-foreground">packages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partners</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{partners.length}</div>
              <p className="text-xs text-muted-foreground">active</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by package name..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="WEIGHT">Weight</SelectItem>
                  <SelectItem value="DISTANCE">Distance</SelectItem>
                  <SelectItem value="GENERIC">Generic</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPartner} onValueChange={setFilterPartner}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Partners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.displayName || partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Packages Table */}
        <Card>
          <CardHeader>
            <CardTitle>Charge Packages</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${pagination.total} packages found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <p className="text-lg font-medium text-red-600">
                  Failed to load packages
                </p>
                <p className="text-sm text-muted-foreground">
                  {error?.data?.error?.message || "Internal server error"}
                </p>
                <Button onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry
                </Button>
              </div>
            ) : packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Package className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No charge packages found</p>
                <p className="text-sm text-muted-foreground">
                  Create your first charge package to get started.
                </p>
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create Package
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Package
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Partner
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Base Charge
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Details
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr
                        key={pkg.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleView(pkg)}
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {pkg.name}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {pkg.partner?.displayName || pkg.partner?.name || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={getPackageTypeColor(pkg.type)}>
                            <span className="flex items-center gap-1">
                              {getPackageTypeIcon(pkg.type, "h-3 w-3")}
                              {pkg.type}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {formatCurrency(pkg.baseCharge)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {pkg.type === "WEIGHT" && pkg.baseUnit && (
                            <span>
                              First {pkg.baseUnit} kg + ₹{pkg.addonCharge}/
                              {pkg.addonUnit} kg
                            </span>
                          )}
                          {pkg.type === "DISTANCE" && pkg.baseUnit && (
                            <span>
                              First {pkg.baseUnit} km + ₹{pkg.addonCharge}/
                              {pkg.addonUnit} km
                            </span>
                          )}
                          {pkg.type === "GENERIC" && (
                            <span>
                              {pkg.appliesTo} •{" "}
                              {pkg.calcType?.replace(/_/g, " ")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={pkg.isActive ? "default" : "secondary"}
                          >
                            {pkg.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(pkg)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(pkg)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(pkg)}
                              title={pkg.isActive ? "Deactivate" : "Activate"}
                            >
                              {pkg.isActive ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(pkg.id)}
                              title="Delete"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      <CreateChargePackageModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        partners={partners}
      />

      {/* View/Edit Modal */}
      <ViewEditChargePackageModal
        open={viewEditModalOpen}
        onClose={() => {
          setViewEditModalOpen(false);
          setSelectedPackageId(null);
        }}
        packageId={selectedPackageId}
        mode={modalMode}
      />
    </DashboardLayout>
  );
}
