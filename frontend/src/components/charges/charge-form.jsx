"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  IndianRupee,
  Percent,
  Package,
  TrendingUp,
  Settings,
  X,
} from "lucide-react";

const chargeTypes = [
  { value: "fsc", label: "FSC (Fuel Surcharge)", icon: TrendingUp },
  { value: "handling", label: "Handling", icon: Package },
  { value: "fuel", label: "Fuel", icon: TrendingUp },
  { value: "service", label: "Service", icon: Settings },
];

const chargeTypeOptions = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed Amount" },
];

const otherChargeTypes = [
  { value: "handling", label: "Handling" },
  { value: "processing", label: "Processing" },
  { value: "surcharge", label: "Surcharge" },
  { value: "admin", label: "Admin" },
  { value: "service", label: "Service" },
];

export function ChargeForm({ charge, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    clientId: "",
    type: "",
    chargeType: "percentage",
    value: "",
    minKg: "",
    maxKg: "",
    minValue: "",
    maxValue: "",
    otherChargeType: "",
    status: true,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (charge) {
      setFormData({
        clientId: charge.clientId || "",
        type: charge.type || "",
        chargeType: charge.chargeType || "percentage",
        value: charge.value || "",
        minKg: charge.minKg || "",
        maxKg: charge.maxKg || "",
        minValue: charge.minValue || "",
        maxValue: charge.maxValue || "",
        otherChargeType: charge.otherChargeType || "",
        status: charge.status !== undefined ? charge.status : true,
      });
    }
  }, [charge]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.clientId.trim()) {
      newErrors.clientId = "Client ID is required";
    }

    if (!formData.type) {
      newErrors.type = "Charge type is required";
    }

    if (!formData.value || formData.value <= 0) {
      newErrors.value = "Value must be greater than 0";
    }

    if (!formData.minKg || formData.minKg < 0) {
      newErrors.minKg = "Minimum weight must be 0 or greater";
    }

    if (!formData.maxKg || formData.maxKg <= formData.minKg) {
      newErrors.maxKg = "Maximum weight must be greater than minimum weight";
    }

    if (!formData.minValue || formData.minValue < 0) {
      newErrors.minValue = "Minimum value must be 0 or greater";
    }

    if (!formData.maxValue || formData.maxValue <= formData.minValue) {
      newErrors.maxValue = "Maximum value must be greater than minimum value";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const getChargeTypeIcon = (type) => {
    const chargeType = chargeTypes.find((ct) => ct.value === type);
    return chargeType ? chargeType.icon : Calculator;
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {charge ? (
              <>
                {React.createElement(getChargeTypeIcon(formData.type), {
                  className: "h-5 w-5",
                })}
                <span>Edit Charge</span>
              </>
            ) : (
              <>
                <Calculator className="h-5 w-5" />
                <span>Add New Charge</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {charge
              ? "Update the charge configuration and settings."
              : "Create a new charge for customer billing and cost calculation."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client ID */}
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID *</Label>
              <Input
                id="clientId"
                value={formData.clientId}
                onChange={(e) => handleInputChange("clientId", e.target.value)}
                placeholder="Enter client ID"
                className={`h-10 ${errors.clientId ? "border-red-500" : ""}`}
              />
              {errors.clientId && (
                <p className="text-sm text-red-500">{errors.clientId}</p>
              )}
            </div>

            {/* Charge Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Charge Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleInputChange("type", value)}
              >
                <SelectTrigger
                  className={`h-10 ${errors.type ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder="Select charge type" />
                </SelectTrigger>
                <SelectContent>
                  {chargeTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center space-x-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-red-500">{errors.type}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Charge Type (Percentage/Fixed) */}
            <div className="space-y-2">
              <Label htmlFor="chargeType">Rate Type *</Label>
              <Select
                value={formData.chargeType}
                onValueChange={(value) =>
                  handleInputChange("chargeType", value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  {chargeTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center space-x-2">
                        {option.value === "percentage" ? (
                          <Percent className="h-4 w-4" />
                        ) : (
                          <IndianRupee className="h-4 w-4" />
                        )}
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="value">Value *</Label>
              <div className="relative">
                {formData.chargeType === "percentage" ? (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) =>
                    handleInputChange("value", parseFloat(e.target.value) || "")
                  }
                  placeholder={
                    formData.chargeType === "percentage" ? "3.5" : "25"
                  }
                  className={`h-10 pl-10 ${errors.value ? "border-red-500" : ""}`}
                />
              </div>
              {errors.value && (
                <p className="text-sm text-red-500">{errors.value}</p>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Weight Range (kg)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minKg">Minimum *</Label>
                  <Input
                    id="minKg"
                    type="number"
                    step="0.1"
                    value={formData.minKg}
                    onChange={(e) =>
                      handleInputChange(
                        "minKg",
                        parseFloat(e.target.value) || "",
                      )
                    }
                    placeholder="0.5"
                    className={`h-10 ${errors.minKg ? "border-red-500" : ""}`}
                  />
                  {errors.minKg && (
                    <p className="text-sm text-red-500">{errors.minKg}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxKg">Maximum *</Label>
                  <Input
                    id="maxKg"
                    type="number"
                    step="0.1"
                    value={formData.maxKg}
                    onChange={(e) =>
                      handleInputChange(
                        "maxKg",
                        parseFloat(e.target.value) || "",
                      )
                    }
                    placeholder="10"
                    className={`h-10 ${errors.maxKg ? "border-red-500" : ""}`}
                  />
                  {errors.maxKg && (
                    <p className="text-sm text-red-500">{errors.maxKg}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Value Range (₹)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minValue">Minimum *</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="minValue"
                      type="number"
                      step="0.01"
                      value={formData.minValue}
                      onChange={(e) =>
                        handleInputChange(
                          "minValue",
                          parseFloat(e.target.value) || "",
                        )
                      }
                      placeholder="100"
                      className={`h-10 pl-10 ${errors.minValue ? "border-red-500" : ""}`}
                    />
                  </div>
                  {errors.minValue && (
                    <p className="text-sm text-red-500">{errors.minValue}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxValue">Maximum *</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="maxValue"
                      type="number"
                      step="0.01"
                      value={formData.maxValue}
                      onChange={(e) =>
                        handleInputChange(
                          "maxValue",
                          parseFloat(e.target.value) || "",
                        )
                      }
                      placeholder="10000"
                      className={`h-10 pl-10 ${errors.maxValue ? "border-red-500" : ""}`}
                    />
                  </div>
                  {errors.maxValue && (
                    <p className="text-sm text-red-500">{errors.maxValue}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Other Charge Type */}
            <div className="space-y-2">
              <Label htmlFor="otherChargeType">Other Charge Type</Label>
              <Select
                value={formData.otherChargeType}
                onValueChange={(value) =>
                  handleInputChange("otherChargeType", value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select other charge type" />
                </SelectTrigger>
                <SelectContent>
                  {otherChargeTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  id="status"
                  checked={formData.status}
                  onCheckedChange={(checked) =>
                    handleInputChange("status", checked)
                  }
                />
                <Label htmlFor="status" className="text-sm">
                  {formData.status ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {charge ? "Update Charge" : "Create Charge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
