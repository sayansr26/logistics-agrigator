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
import {
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
  Save,
  Tag,
  Percent,
  IndianRupee,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  useGetChargeDiscountPackagesQuery,
  useGetChargeDiscountPackageByIdQuery,
  useCreateChargeDiscountPackageMutation,
  useUpdateChargeDiscountPackageMutation,
  useDeleteChargeDiscountPackageMutation,
} from "@/store/api/endpoints/chargeDiscountPackagesApi";
import type {
  BadgeTier,
  DiscountType,
  CreatePackageItemRequest,
} from "@/store/api/endpoints/chargeDiscountPackagesApi";
import { useGetPartnersQuery } from "@/store/api/endpoints/partnersApi";
import { useGetChargeRulesQuery } from "@/store/api/endpoints/chargesApi";

// ============================================
// HELPERS
// ============================================

const BADGE_OPTIONS: { value: BadgeTier; label: string }[] = [
  { value: "BRONZE", label: "Bronze" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
  { value: "PLATINUM", label: "Platinum" },
  { value: "DIAMOND", label: "Diamond" },
];

const BADGE_COLORS: Record<string, string> = {
  BASIC: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  BRONZE:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  SILVER: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  GOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  PLATINUM: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  DIAMOND:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const BASE_LABELS: Record<string, string> = {
  INVOICE_VALUE: "Invoice Value",
  COD_VALUE: "COD Value",
  WEIGHT: "Weight",
  ZONE_TO_ZONE_WEIGHT: "Zone to Zone",
  DISTANCE_BASE_WEIGHT: "Distance Based",
};

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}

function getRuleLabel(rule: any) {
  const typeName =
    rule.chargesType?.name ||
    rule.pincodeType?.name ||
    (rule.zoneMilestone
      ? `${rule.zoneMilestone.minKm}-${rule.zoneMilestone.maxKm}km`
      : "");
  return `${BASE_LABELS[rule.base] || rule.base}${typeName ? ` - ${typeName}` : ""}`;
}

function getRuleChargeInfo(rule: any): string {
  const minVal = formatCurrency(rule.minValue);
  switch (rule.base) {
    case "INVOICE_VALUE":
      return `${rule.percentageValue}% of invoice | Min ${minVal}`;
    case "COD_VALUE":
      return `${rule.percentageValue}% of COD amount | Min ${minVal}`;
    case "WEIGHT":
      return `${formatCurrency(rule.perKgCharge)} per ${rule.perKg}kg | Min ${minVal}`;
    case "ZONE_TO_ZONE_WEIGHT":
      return `${formatCurrency(rule.perKgCharge)} per ${rule.perKg}kg (zone) | Min ${minVal}`;
    case "DISTANCE_BASE_WEIGHT": {
      const ms = rule.zoneMilestone;
      const slab = ms ? `${ms.minKm}-${ms.maxKm}km` : "";
      return `${formatCurrency(rule.perKgCharge)} per ${rule.perKg}kg${slab ? ` (${slab})` : ""} | Min ${minVal}`;
    }
    default:
      return `Min ${minVal}`;
  }
}

// ============================================
// DISCOUNT ITEMS EDITOR
// ============================================
function DiscountItemsEditor({
  partnerId,
  items,
  onItemsChange,
}: {
  partnerId: string;
  items: CreatePackageItemRequest[];
  onItemsChange: (items: CreatePackageItemRequest[]) => void;
}) {
  const { data: rulesData, isLoading: isLoadingRules } = useGetChargeRulesQuery(
    { partnerId, isActive: true, limit: 100 },
    { skip: !partnerId },
  );
  const chargeRules = rulesData?.chargeRules || [];

  const selectedRuleIds = new Set(items.map((i) => i.chargeRuleId));

  const toggleRule = (ruleId: string) => {
    if (selectedRuleIds.has(ruleId)) {
      onItemsChange(items.filter((i) => i.chargeRuleId !== ruleId));
    } else {
      onItemsChange([
        ...items,
        {
          chargeRuleId: ruleId,
          discountType: "PERCENTAGE" as DiscountType,
          discountValue: 0,
        },
      ]);
    }
  };

  const updateItem = (ruleId: string, field: string, value: any) => {
    onItemsChange(
      items.map((item) =>
        item.chargeRuleId === ruleId ? { ...item, [field]: value } : item,
      ),
    );
  };

  if (!partnerId) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Select a partner first to see available charge rules.
      </p>
    );
  }

  if (isLoadingRules) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          Loading charge rules...
        </span>
      </div>
    );
  }

  if (chargeRules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No active charge rules found for this partner.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Select charge rules and set discount for each. {items.length} selected.
      </p>
      <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-2">
        {chargeRules.map((rule: any) => {
          const selected = selectedRuleIds.has(rule.id);
          const item = items.find((i) => i.chargeRuleId === rule.id);
          return (
            <div
              key={rule.id}
              className={`border rounded-lg p-3 space-y-2 transition-colors ${
                selected ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div
                className="cursor-pointer"
                onClick={() => toggleRule(rule.id)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    readOnly
                    className="h-4 w-4 pointer-events-none"
                  />
                  <span className="font-medium text-sm flex-1">
                    {getRuleLabel(rule)}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {rule.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground ml-6 mt-0.5">
                  {getRuleChargeInfo(rule)}
                </p>
              </div>
              {selected && item && (
                <div
                  className="grid grid-cols-2 gap-3 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Discount Type</Label>
                    <Select
                      value={item.discountType}
                      onValueChange={(v) =>
                        updateItem(rule.id, "discountType", v)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FLAT">Flat (INR)</SelectItem>
                        <SelectItem value="PERCENTAGE">
                          Percentage (%)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Value{" "}
                      {item.discountType === "PERCENTAGE" ? "(%)" : "(INR)"}
                    </Label>
                    <Input
                      type="number"
                      step={
                        item.discountType === "PERCENTAGE" ? "0.01" : "0.01"
                      }
                      min="0"
                      max={
                        item.discountType === "PERCENTAGE" ? "100" : undefined
                      }
                      placeholder="0"
                      value={item.discountValue || ""}
                      onChange={(e) =>
                        updateItem(
                          rule.id,
                          "discountValue",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// CREATE MODAL
// ============================================
function CreatePackageModal({
  open,
  onClose,
  partners,
}: {
  open: boolean;
  onClose: () => void;
  partners: any[];
}) {
  const [formData, setFormData] = useState({
    partnerId: "",
    badge: "" as BadgeTier | "",
    name: "",
    description: "",
    isActive: true,
    items: [] as CreatePackageItemRequest[],
  });
  const [errors, setErrors] = useState<any>({});
  const [createPackage, { isLoading }] =
    useCreateChargeDiscountPackageMutation();

  useEffect(() => {
    if (open) {
      setFormData({
        partnerId: "",
        badge: "",
        name: "",
        description: "",
        isActive: true,
        items: [],
      });
      setErrors({});
    }
  }, [open]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: null }));
    if (field === "partnerId") {
      setFormData((prev) => ({ ...prev, partnerId: value, items: [] }));
    }
  };

  const validate = () => {
    const e: any = {};
    if (!formData.partnerId) e.partnerId = "Partner is required";
    if (!formData.badge) e.badge = "Badge tier is required";
    if (!formData.name.trim()) e.name = "Name is required";
    if (formData.items.length === 0)
      e.items = "Select at least one charge rule";
    const invalidItems = formData.items.filter(
      (i) => !i.discountValue || i.discountValue <= 0,
    );
    if (invalidItems.length > 0)
      e.items = "All selected rules must have a discount value > 0";
    const percentageOver100 = formData.items.filter(
      (i) => i.discountType === "PERCENTAGE" && i.discountValue > 100,
    );
    if (percentageOver100.length > 0)
      e.items = "Percentage discount cannot exceed 100%";
    return e;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      await createPackage({
        partnerId: formData.partnerId,
        badge: formData.badge as BadgeTier,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
        items: formData.items,
      }).unwrap();
      onClose();
    } catch (err: any) {
      setErrors({
        submit:
          err?.data?.error?.message ||
          err?.data?.message ||
          "Failed to create package",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Create Discount Package
          </DialogTitle>
          <DialogDescription>
            Define a discount package for a partner + badge tier combination.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Partner */}
          <div className="space-y-2">
            <Label>Partner *</Label>
            <Select
              value={formData.partnerId}
              onValueChange={(v) => handleChange("partnerId", v)}
            >
              <SelectTrigger
                className={errors.partnerId ? "border-red-500" : ""}
              >
                <SelectValue placeholder="Select partner..." />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.partnerId && (
              <p className="text-red-500 text-sm">{errors.partnerId}</p>
            )}
          </div>

          {/* Badge */}
          <div className="space-y-2">
            <Label>Badge Tier *</Label>
            <Select
              value={formData.badge}
              onValueChange={(v) => handleChange("badge", v)}
            >
              <SelectTrigger className={errors.badge ? "border-red-500" : ""}>
                <SelectValue placeholder="Select badge tier..." />
              </SelectTrigger>
              <SelectContent>
                {BADGE_OPTIONS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.badge && (
              <p className="text-red-500 text-sm">{errors.badge}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Package Name *</Label>
            <Input
              placeholder="e.g., Gold Tier Delhivery Discounts"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-red-500 text-sm">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          {/* Charge Rule Items */}
          <div className="space-y-2">
            <Label>Charge Rule Discounts *</Label>
            <div className="p-4 bg-muted/40 rounded-lg">
              <DiscountItemsEditor
                partnerId={formData.partnerId}
                items={formData.items}
                onItemsChange={(items) =>
                  setFormData((prev) => ({ ...prev, items }))
                }
              />
            </div>
            {errors.items && (
              <p className="text-red-500 text-sm">{errors.items}</p>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Label>Active</Label>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => handleChange("isActive", e.target.checked)}
              className="h-4 w-4"
            />
          </div>

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
// VIEW / EDIT MODAL
// ============================================
function ViewEditPackageModal({
  open,
  onClose,
  packageId,
  mode: initialMode,
  partners,
}: {
  open: boolean;
  onClose: () => void;
  packageId: string | null;
  mode: "view" | "edit";
  partners: any[];
}) {
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<any>({});

  const { data: packageData, isLoading: isLoadingPackage } =
    useGetChargeDiscountPackageByIdQuery(packageId!, {
      skip: !packageId || !open,
    });
  const [updatePackage, { isLoading: isUpdating }] =
    useUpdateChargeDiscountPackageMutation();

  const pkg = packageData?.package;

  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name || "",
        description: pkg.description || "",
        badge: pkg.badge,
        isActive: pkg.isActive,
        items: (pkg.items || []).map((item: any) => ({
          chargeRuleId: item.chargeRuleId,
          discountType: item.discountType,
          discountValue:
            typeof item.discountValue === "string"
              ? parseFloat(item.discountValue)
              : item.discountValue,
        })),
      });
    }
  }, [pkg]);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setErrors({});
    }
  }, [open, initialMode]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: null }));
  };

  const handleSave = async () => {
    if (!packageId || !pkg) return;

    const e: any = {};
    if (!formData.name?.trim()) e.name = "Name is required";
    if (formData.items.length === 0)
      e.items = "Select at least one charge rule";
    const invalidItems = formData.items.filter(
      (i: any) => !i.discountValue || i.discountValue <= 0,
    );
    if (invalidItems.length > 0) e.items = "All rules must have discount > 0";
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    try {
      await updatePackage({
        id: packageId,
        data: {
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          badge: formData.badge,
          isActive: formData.isActive,
          items: formData.items,
        },
      }).unwrap();
      setMode("view");
    } catch (err: any) {
      setErrors({
        submit: err?.data?.error?.message || "Failed to update",
      });
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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {mode === "view" ? "View" : "Edit"} Discount Package
          </DialogTitle>
          <DialogDescription>
            {pkg.partner?.displayName || pkg.partner?.name} &bull;{" "}
            <Badge className={BADGE_COLORS[pkg.badge]}>{pkg.badge}</Badge>
          </DialogDescription>
        </DialogHeader>

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

        <div className="space-y-4 py-2">
          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={pkg.isActive ? "default" : "secondary"}>
                {pkg.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {mode === "view" ? (
            <div className="space-y-4">
              {/* Package Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium text-sm">{pkg.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Badge</Label>
                  <div>
                    <Badge className={BADGE_COLORS[pkg.badge]}>
                      {pkg.badge}
                    </Badge>
                  </div>
                </div>
                {pkg.description && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">
                      Description
                    </Label>
                    <p className="text-sm">{pkg.description}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">
                  Discount Rules ({pkg.items?.length || 0})
                </Label>
                <div className="space-y-2">
                  {(pkg.items || []).map((item: any) => (
                    <div key={item.id} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {item.chargeRule
                            ? getRuleLabel(item.chargeRule)
                            : item.chargeRuleId.slice(0, 8) + "..."}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.discountType === "PERCENTAGE" ? (
                            <Badge variant="outline" className="gap-1">
                              <Percent className="h-3 w-3" />
                              {item.discountValue}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <IndianRupee className="h-3 w-3" />
                              {formatCurrency(item.discountValue)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {item.chargeRule && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Current charge: {getRuleChargeInfo(item.chargeRule)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm">{errors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description || ""}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Badge Tier</Label>
                <Select
                  value={formData.badge}
                  onValueChange={(v) => handleChange("badge", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGE_OPTIONS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Label>Active</Label>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleChange("isActive", e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
              {/* Items editor */}
              <div className="space-y-2">
                <Label>Charge Rule Discounts</Label>
                <div className="p-4 bg-muted/40 rounded-lg">
                  <DiscountItemsEditor
                    partnerId={pkg.partnerId}
                    items={formData.items || []}
                    onItemsChange={(items) =>
                      setFormData((prev: any) => ({ ...prev, items }))
                    }
                  />
                </div>
                {errors.items && (
                  <p className="text-red-500 text-sm">{errors.items}</p>
                )}
              </div>
              {errors.submit && (
                <p className="text-red-600 text-sm">{errors.submit}</p>
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
// MAIN PAGE
// ============================================
export default function ChargeDiscountPackagesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBadge, setFilterBadge] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewEditModalOpen, setViewEditModalOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");

  const {
    data: packagesData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetChargeDiscountPackagesQuery({
    page,
    limit,
    ...(filterBadge !== "all" && { badge: filterBadge as BadgeTier }),
    ...(filterStatus !== "all" && { isActive: filterStatus === "active" }),
    ...(filterPartner !== "all" && { partnerId: filterPartner }),
    ...(searchTerm && { search: searchTerm }),
  });

  const { data: partnersData } = useGetPartnersQuery({ isActive: true });
  const partners = (partnersData as any)?.data?.partners || [];

  const [deletePackage] = useDeleteChargeDiscountPackageMutation();

  const packages = packagesData?.packages || [];
  const pagination = packagesData?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const handleView = (pkg: any) => {
    setSelectedPackageId(pkg.id);
    setModalMode("view");
    setViewEditModalOpen(true);
  };

  const handleEdit = (pkg: any) => {
    setSelectedPackageId(pkg.id);
    setModalMode("edit");
    setViewEditModalOpen(true);
  };

  const handleDelete = async (pkgId: string) => {
    if (
      confirm(
        "Are you sure you want to permanently delete this discount package? This cannot be undone.",
      )
    ) {
      try {
        await deletePackage(pkgId).unwrap();
      } catch (err) {
        console.error("Failed to delete package:", err);
      }
    }
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[
        { title: "Discount Packages", href: "/charge-discount-packages" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Charge Discount Packages
            </h1>
            <p className="text-muted-foreground">
              Manage badge-based discount packages for courier partners.
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
              <Plus className="mr-2 h-4 w-4" /> Create Package
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Packages
              </CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <ToggleRight className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {packages.filter((p: any) => p.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partners</CardTitle>
              <Tag className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(packages.map((p: any) => p.partnerId)).size}
              </div>
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
                    placeholder="Search by name..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={filterPartner} onValueChange={setFilterPartner}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Partners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  {partners.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterBadge} onValueChange={setFilterBadge}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Badges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Badges</SelectItem>
                  {BADGE_OPTIONS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Discount Packages</CardTitle>
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
                  Failed to load discount packages
                </p>
                <Button onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry
                </Button>
              </div>
            ) : packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Tag className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">
                  No discount packages found
                </p>
                <p className="text-sm text-muted-foreground">
                  Create your first discount package to get started.
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
                        Partner
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Badge
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Rules
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
                    {packages.map((pkg: any) => (
                      <tr
                        key={pkg.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm">
                          <button
                            onClick={() => handleView(pkg)}
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {pkg.partner?.displayName ||
                              pkg.partner?.name ||
                              "-"}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm">{pkg.name}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={BADGE_COLORS[pkg.badge]}
                          >
                            {pkg.badge}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {pkg.items?.length || 0} rules
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

      <CreatePackageModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        partners={partners}
      />
      <ViewEditPackageModal
        open={viewEditModalOpen}
        onClose={() => {
          setViewEditModalOpen(false);
          setSelectedPackageId(null);
        }}
        packageId={selectedPackageId}
        mode={modalMode}
        partners={partners}
      />
    </DashboardLayout>
  );
}
