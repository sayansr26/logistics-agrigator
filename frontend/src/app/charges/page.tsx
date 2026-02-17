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
  Calculator,
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
  MapPin,
  DollarSign,
  Layers,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  useGetChargeRulesQuery,
  useGetChargeRuleByIdQuery,
  useCreateChargeRuleMutation,
  useUpdateChargeRuleMutation,
  useDeleteChargeRuleMutation,
  useToggleChargeRuleStatusMutation,
} from "@/store/api/endpoints/chargesApi";
import type {
  ChargeRuleBase,
  CreateChargeRuleRequest,
} from "@/store/api/endpoints/chargesApi";
import { useGetPartnersQuery } from "@/store/api/endpoints/partnersApi";
import { useGetChargesTypesQuery } from "@/store/api/endpoints/chargesTypeApi";
import { useGetPincodeTypesQuery } from "@/store/api/endpoints/pincodeTypeApi";
import { useGetZonesQuery } from "@/store/api/endpoints/zonesApi";

// ============================================
// HELPERS
// ============================================

const BASE_LABELS: Record<string, string> = {
  INVOICE_VALUE: "Invoice Value",
  WEIGHT: "Weight",
  ZONE_TO_ZONE_WEIGHT: "Zone to Zone (Weight)",
  DISTANCE_BASE_WEIGHT: "Distance Based (Weight)",
};

function getBaseColor(base: string) {
  switch (base) {
    case "INVOICE_VALUE":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "WEIGHT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "ZONE_TO_ZONE_WEIGHT":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "DISTANCE_BASE_WEIGHT":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

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

function getRuleSummary(rule: any) {
  const minVal = formatCurrency(rule.minValue);
  switch (rule.base) {
    case "INVOICE_VALUE":
      return `${rule.percentageValue}% | min ${minVal}`;
    case "WEIGHT":
      return `ceil(wt/${rule.perKg}kg) × ${formatCurrency(rule.perKgCharge)} | min ${minVal}`;
    case "ZONE_TO_ZONE_WEIGHT":
      return `ceil(wt/${rule.perKg}kg) × ${formatCurrency(rule.perKgCharge)} | min ${minVal}`;
    case "DISTANCE_BASE_WEIGHT": {
      const ms = rule.zoneMilestone;
      const label = ms ? `${ms.minKm}-${ms.maxKm}km` : "-";
      return `Slab ${label} | ceil(wt/${rule.perKg}kg) × ${formatCurrency(rule.perKgCharge)} | min ${minVal}`;
    }
    default:
      return "-";
  }
}

// ============================================
// SHARED FIELD: Type Selector (ChargesType / PincodeType)
// ============================================
function TypeSelector({
  partnerId,
  typeMode,
  chargesTypeId,
  pincodeTypeId,
  onTypeModeChange,
  onChargesTypeChange,
  onPincodeTypeChange,
  errors,
}: {
  partnerId: string;
  typeMode: "CHARGES_TYPE" | "PINCODE_TYPE" | "";
  chargesTypeId: string;
  pincodeTypeId: string;
  onTypeModeChange: (v: string) => void;
  onChargesTypeChange: (v: string) => void;
  onPincodeTypeChange: (v: string) => void;
  errors: any;
}) {
  const { data: chargesTypesData } = useGetChargesTypesQuery(
    { partnerId, isActive: true },
    { skip: !partnerId || typeMode !== "CHARGES_TYPE" },
  );
  const chargesTypes = (chargesTypesData as any)?.data || [];

  const { data: pincodeTypesData } = useGetPincodeTypesQuery(
    { isActive: true },
    { skip: typeMode !== "PINCODE_TYPE" },
  );
  const pincodeTypes = (pincodeTypesData as any)?.data || [];

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Select Type *</Label>
        <Select value={typeMode} onValueChange={onTypeModeChange}>
          <SelectTrigger className={errors.typeMode ? "border-red-500" : ""}>
            <SelectValue placeholder="Choose type category..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CHARGES_TYPE">Charges Types</SelectItem>
            <SelectItem value="PINCODE_TYPE">Pincode Types</SelectItem>
          </SelectContent>
        </Select>
        {errors.typeMode && (
          <p className="text-red-500 text-sm">{errors.typeMode}</p>
        )}
      </div>

      {typeMode === "CHARGES_TYPE" && (
        <div className="space-y-1">
          <Label>Charges Type *</Label>
          <Select value={chargesTypeId} onValueChange={onChargesTypeChange}>
            <SelectTrigger
              className={errors.chargesTypeId ? "border-red-500" : ""}
            >
              <SelectValue placeholder="Select charges type..." />
            </SelectTrigger>
            <SelectContent>
              {chargesTypes.map((ct: any) => (
                <SelectItem key={ct.id} value={ct.id}>
                  {ct.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.chargesTypeId && (
            <p className="text-red-500 text-sm">{errors.chargesTypeId}</p>
          )}
        </div>
      )}

      {typeMode === "PINCODE_TYPE" && (
        <div className="space-y-1">
          <Label>Pincode Type *</Label>
          <Select value={pincodeTypeId} onValueChange={onPincodeTypeChange}>
            <SelectTrigger
              className={errors.pincodeTypeId ? "border-red-500" : ""}
            >
              <SelectValue placeholder="Select pincode type..." />
            </SelectTrigger>
            <SelectContent>
              {pincodeTypes.map((pt: any) => (
                <SelectItem key={pt.id} value={pt.id}>
                  {pt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.pincodeTypeId && (
            <p className="text-red-500 text-sm">{errors.pincodeTypeId}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// CREATE MODAL
// ============================================
function CreateChargeRuleModal({
  open,
  onClose,
  partners,
}: {
  open: boolean;
  onClose: () => void;
  partners: any[];
}) {
  const initialForm = {
    partnerId: "",
    base: "",
    typeMode: "" as "CHARGES_TYPE" | "PINCODE_TYPE" | "",
    chargesTypeId: "",
    pincodeTypeId: "",
    // Shared
    minValue: "",
    // INVOICE_VALUE
    percentageValue: "",
    // WEIGHT / ZONE_TO_ZONE_WEIGHT / DISTANCE_BASE_WEIGHT
    perKg: "",
    perKgCharge: "",
    // ZONE_TO_ZONE_WEIGHT
    fromZoneId: "",
    toZoneId: "",
    // DISTANCE_BASE_WEIGHT - multiple milestones support
    selectedMilestones: [] as string[], // milestone IDs
    milestonePerKg: {} as Record<string, string>,
    milestonePerKgCharge: {} as Record<string, string>,
    isActive: true,
  };

  const [formData, setFormData] = useState<any>(initialForm);
  const [errors, setErrors] = useState<any>({});
  const [createRule, { isLoading }] = useCreateChargeRuleMutation();

  // Geological zones for Zone-to-Zone
  const { data: geoZonesData } = useGetZonesQuery(
    { partnerId: formData.partnerId, status: true },
    {
      skip: !formData.partnerId || formData.base !== "ZONE_TO_ZONE_WEIGHT",
    },
  );
  const geoZones =
    (geoZonesData as any)?.data?.zones?.filter?.(
      (z: any) => z.zoneType === "GEOLOGICAL",
    ) || [];

  // Distance zones with milestones
  const { data: distZonesData } = useGetZonesQuery(
    { partnerId: formData.partnerId, status: true },
    {
      skip: !formData.partnerId || formData.base !== "DISTANCE_BASE_WEIGHT",
    },
  );
  const distanceZones =
    (distZonesData as any)?.data?.zones?.filter?.(
      (z: any) => z.zoneType === "DISTANCE",
    ) || [];
  const allMilestones = distanceZones.flatMap((z: any) =>
    (z.milestones || []).map((m: any) => ({ ...m, zoneName: z.name })),
  );

  useEffect(() => {
    if (open) {
      setFormData(initialForm);
      setErrors({});
    }
  }, [open]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: null }));
    if (field === "partnerId") {
      setFormData((prev: any) => ({
        ...prev,
        partnerId: value,
        chargesTypeId: "",
        fromZoneId: "",
        toZoneId: "",
        selectedMilestones: [],
      }));
    }
    if (field === "base") {
      setFormData((prev: any) => ({
        ...prev,
        base: value,
        typeMode: "",
        chargesTypeId: "",
        pincodeTypeId: "",
        fromZoneId: "",
        toZoneId: "",
        selectedMilestones: [],
        milestonePerKg: {},
        milestonePerKgCharge: {},
      }));
    }
  };

  const toggleMilestone = (milestoneId: string) => {
    setFormData((prev: any) => {
      const selected: string[] = prev.selectedMilestones;
      if (selected.includes(milestoneId)) {
        const newSelected = selected.filter((id: string) => id !== milestoneId);
        const newPerKg = { ...prev.milestonePerKg };
        const newPerKgCharge = { ...prev.milestonePerKgCharge };
        delete newPerKg[milestoneId];
        delete newPerKgCharge[milestoneId];
        return {
          ...prev,
          selectedMilestones: newSelected,
          milestonePerKg: newPerKg,
          milestonePerKgCharge: newPerKgCharge,
        };
      }
      return { ...prev, selectedMilestones: [...selected, milestoneId] };
    });
  };

  const validate = () => {
    const e: any = {};
    if (!formData.partnerId) e.partnerId = "Partner is required";
    if (!formData.base) e.base = "Base is required";
    if (!formData.minValue && formData.minValue !== 0)
      e.minValue = "Min Value is required";

    if (formData.base === "INVOICE_VALUE" || formData.base === "WEIGHT") {
      if (!formData.typeMode) e.typeMode = "Select a type category";
      if (formData.typeMode === "CHARGES_TYPE" && !formData.chargesTypeId)
        e.chargesTypeId = "Charges Type is required";
      if (formData.typeMode === "PINCODE_TYPE" && !formData.pincodeTypeId)
        e.pincodeTypeId = "Pincode Type is required";
    }

    if (formData.base === "INVOICE_VALUE") {
      if (!formData.percentageValue) e.percentageValue = "Required";
    }

    if (formData.base === "WEIGHT" || formData.base === "ZONE_TO_ZONE_WEIGHT") {
      if (!formData.perKg) e.perKg = "Per KG is required";
      if (!formData.perKgCharge) e.perKgCharge = "Per KG Charge is required";
    }

    if (formData.base === "ZONE_TO_ZONE_WEIGHT") {
      if (!formData.fromZoneId) e.fromZoneId = "From Zone is required";
      if (!formData.toZoneId) e.toZoneId = "To Zone is required";
    }

    if (formData.base === "DISTANCE_BASE_WEIGHT") {
      if (formData.selectedMilestones.length === 0)
        e.milestones = "Select at least one distance slab";
    }

    return e;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const basePayload: Partial<CreateChargeRuleRequest> = {
      partnerId: formData.partnerId,
      base: formData.base as ChargeRuleBase,
      minValue: parseFloat(formData.minValue) || 0,
      isActive: formData.isActive,
    };

    if (formData.typeMode === "CHARGES_TYPE")
      basePayload.chargesTypeId = formData.chargesTypeId;
    if (formData.typeMode === "PINCODE_TYPE")
      basePayload.pincodeTypeId = formData.pincodeTypeId;

    try {
      if (formData.base === "INVOICE_VALUE") {
        await createRule({
          ...(basePayload as CreateChargeRuleRequest),
          percentageValue: parseFloat(formData.percentageValue) || 0,
        }).unwrap();
      } else if (formData.base === "WEIGHT") {
        await createRule({
          ...(basePayload as CreateChargeRuleRequest),
          perKg: parseFloat(formData.perKg) || 1,
          perKgCharge: parseFloat(formData.perKgCharge) || 0,
        }).unwrap();
      } else if (formData.base === "ZONE_TO_ZONE_WEIGHT") {
        await createRule({
          ...(basePayload as CreateChargeRuleRequest),
          fromZoneId: formData.fromZoneId,
          toZoneId: formData.toZoneId,
          perKg: parseFloat(formData.perKg) || 1,
          perKgCharge: parseFloat(formData.perKgCharge) || 0,
        }).unwrap();
      } else if (formData.base === "DISTANCE_BASE_WEIGHT") {
        // Create one rule per selected milestone
        await Promise.all(
          formData.selectedMilestones.map((msId: string) =>
            createRule({
              ...(basePayload as CreateChargeRuleRequest),
              zoneMilestoneId: msId,
              perKg: parseFloat(formData.milestonePerKg[msId] || "1") || 1,
              perKgCharge:
                parseFloat(formData.milestonePerKgCharge[msId] || "0") || 0,
            }).unwrap(),
          ),
        );
      }
      onClose();
    } catch (err: any) {
      setErrors({
        submit: err?.data?.error?.message || "Failed to create charge rule",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Create Charge Rule
          </DialogTitle>
          <DialogDescription>
            Define a new charge rule for a courier partner.
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

          {/* Charges Base */}
          <div className="space-y-2">
            <Label>Charges Base *</Label>
            <Select
              value={formData.base}
              onValueChange={(v) => handleChange("base", v)}
            >
              <SelectTrigger className={errors.base ? "border-red-500" : ""}>
                <SelectValue placeholder="Select charges base..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INVOICE_VALUE">Invoice Value</SelectItem>
                <SelectItem value="WEIGHT">Weight</SelectItem>
                <SelectItem value="ZONE_TO_ZONE_WEIGHT">
                  Weight Zone-to-Zone
                </SelectItem>
                <SelectItem value="DISTANCE_BASE_WEIGHT">
                  Weight Distance Based
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.base && (
              <p className="text-red-500 text-sm">{errors.base}</p>
            )}
          </div>

          {/* Type selector for INVOICE_VALUE and WEIGHT */}
          {(formData.base === "INVOICE_VALUE" ||
            formData.base === "WEIGHT") && (
            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <TypeSelector
                partnerId={formData.partnerId}
                typeMode={formData.typeMode}
                chargesTypeId={formData.chargesTypeId}
                pincodeTypeId={formData.pincodeTypeId}
                onTypeModeChange={(v) => handleChange("typeMode", v)}
                onChargesTypeChange={(v) =>
                  setFormData((p: any) => ({ ...p, chargesTypeId: v }))
                }
                onPincodeTypeChange={(v) =>
                  setFormData((p: any) => ({ ...p, pincodeTypeId: v }))
                }
                errors={errors}
              />
            </div>
          )}

          {/* Shared: Min Value */}
          {formData.base && (
            <div className="space-y-2">
              <Label>Min Value (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={formData.minValue}
                onChange={(e) => handleChange("minValue", e.target.value)}
                className={errors.minValue ? "border-red-500" : ""}
              />
              {errors.minValue && (
                <p className="text-red-500 text-sm">{errors.minValue}</p>
              )}
              <p className="text-xs text-muted-foreground">
                final = max(minValue, computed)
              </p>
            </div>
          )}

          {/* INVOICE_VALUE specific */}
          {formData.base === "INVOICE_VALUE" && (
            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                Invoice Value formula: max(minValue, percentage% × invoiceValue)
              </p>
              <div className="space-y-1">
                <Label>Percentage Value (%) *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="2.5"
                  value={formData.percentageValue}
                  onChange={(e) =>
                    handleChange("percentageValue", e.target.value)
                  }
                  className={errors.percentageValue ? "border-red-500" : ""}
                />
                {errors.percentageValue && (
                  <p className="text-red-500 text-sm">
                    {errors.percentageValue}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* WEIGHT specific */}
          {formData.base === "WEIGHT" && (
            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                Formula: max(minValue, ceil(weight / perKg) × perKgCharge)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Per KG (kg) *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="1"
                    value={formData.perKg}
                    onChange={(e) => handleChange("perKg", e.target.value)}
                    className={errors.perKg ? "border-red-500" : ""}
                  />
                  {errors.perKg && (
                    <p className="text-red-500 text-sm">{errors.perKg}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Per KG Charge (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="30"
                    value={formData.perKgCharge}
                    onChange={(e) =>
                      handleChange("perKgCharge", e.target.value)
                    }
                    className={errors.perKgCharge ? "border-red-500" : ""}
                  />
                  {errors.perKgCharge && (
                    <p className="text-red-500 text-sm">{errors.perKgCharge}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ZONE_TO_ZONE_WEIGHT specific */}
          {formData.base === "ZONE_TO_ZONE_WEIGHT" && (
            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                Zone-to-Zone: Formula: max(minValue, ceil(weight / perKg) ×
                perKgCharge)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>From Zone *</Label>
                  <Select
                    value={formData.fromZoneId}
                    onValueChange={(v) => handleChange("fromZoneId", v)}
                  >
                    <SelectTrigger
                      className={errors.fromZoneId ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select zone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {geoZones.map((z: any) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.fromZoneId && (
                    <p className="text-red-500 text-sm">{errors.fromZoneId}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>To Zone *</Label>
                  <Select
                    value={formData.toZoneId}
                    onValueChange={(v) => handleChange("toZoneId", v)}
                  >
                    <SelectTrigger
                      className={errors.toZoneId ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select zone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {geoZones.map((z: any) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.toZoneId && (
                    <p className="text-red-500 text-sm">{errors.toZoneId}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Per KG (kg) *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="1"
                    value={formData.perKg}
                    onChange={(e) => handleChange("perKg", e.target.value)}
                    className={errors.perKg ? "border-red-500" : ""}
                  />
                  {errors.perKg && (
                    <p className="text-red-500 text-sm">{errors.perKg}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Per KG Charge (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="30"
                    value={formData.perKgCharge}
                    onChange={(e) =>
                      handleChange("perKgCharge", e.target.value)
                    }
                    className={errors.perKgCharge ? "border-red-500" : ""}
                  />
                  {errors.perKgCharge && (
                    <p className="text-red-500 text-sm">{errors.perKgCharge}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DISTANCE_BASE_WEIGHT specific */}
          {formData.base === "DISTANCE_BASE_WEIGHT" && (
            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                Distance Slabs — select milestones and set perKg/charge per
                slab. One rule will be created per selected milestone.
              </p>
              {errors.milestones && (
                <p className="text-red-500 text-sm">{errors.milestones}</p>
              )}
              {allMilestones.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No distance zone milestones found for this partner. Create a
                  DISTANCE zone first.
                </p>
              ) : (
                <div className="space-y-3">
                  {allMilestones.map((ms: any) => {
                    const selected = formData.selectedMilestones.includes(
                      ms.id,
                    );
                    return (
                      <div
                        key={ms.id}
                        className={`border rounded-lg p-3 space-y-2 cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                        onClick={() => toggleMilestone(ms.id)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="h-4 w-4 pointer-events-none"
                          />
                          <span className="font-medium text-sm">
                            {ms.zoneName} — {ms.minKm}-{ms.maxKm} km (
                            {ms.suffix})
                          </span>
                        </div>
                        {selected && (
                          <div
                            className="grid grid-cols-2 gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-1">
                              <Label className="text-xs">Per KG (kg)</Label>
                              <Input
                                type="number"
                                step="0.001"
                                min="0.001"
                                placeholder="1"
                                value={formData.milestonePerKg[ms.id] || ""}
                                onChange={(e) =>
                                  setFormData((p: any) => ({
                                    ...p,
                                    milestonePerKg: {
                                      ...p.milestonePerKg,
                                      [ms.id]: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">
                                Per KG Charge (₹)
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                value={
                                  formData.milestonePerKgCharge[ms.id] || ""
                                }
                                onChange={(e) =>
                                  setFormData((p: any) => ({
                                    ...p,
                                    milestonePerKgCharge: {
                                      ...p.milestonePerKgCharge,
                                      [ms.id]: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Active toggle */}
          {formData.base && (
            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="h-4 w-4"
              />
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
                <Plus className="mr-2 h-4 w-4" /> Create Rule
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
function ViewEditChargeRuleModal({
  open,
  onClose,
  ruleId,
  mode: initialMode,
}: {
  open: boolean;
  onClose: () => void;
  ruleId: string | null;
  mode: "view" | "edit";
}) {
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<any>({});

  const { data: ruleData, isLoading: isLoadingRule } =
    useGetChargeRuleByIdQuery(ruleId!, { skip: !ruleId || !open });
  const [updateRule, { isLoading: isUpdating }] = useUpdateChargeRuleMutation();
  const [toggleStatus, { isLoading: isToggling }] =
    useToggleChargeRuleStatusMutation();

  const rule = ruleData?.chargeRule;

  useEffect(() => {
    if (rule) {
      setFormData({
        minValue: rule.minValue?.toString() || "",
        percentageValue: rule.percentageValue?.toString() || "",
        perKg: rule.perKg?.toString() || "",
        perKgCharge: rule.perKgCharge?.toString() || "",
        isActive: rule.isActive,
      });
    }
  }, [rule]);

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
    if (!ruleId || !rule) return;
    const payload: any = {
      minValue: parseFloat(formData.minValue) || 0,
      isActive: formData.isActive,
    };

    if (rule.base === "INVOICE_VALUE") {
      payload.percentageValue = parseFloat(formData.percentageValue) || 0;
    }
    if (
      rule.base === "WEIGHT" ||
      rule.base === "ZONE_TO_ZONE_WEIGHT" ||
      rule.base === "DISTANCE_BASE_WEIGHT"
    ) {
      payload.perKg = parseFloat(formData.perKg) || 1;
      payload.perKgCharge = parseFloat(formData.perKgCharge) || 0;
    }

    try {
      await updateRule({ id: ruleId, data: payload }).unwrap();
      setMode("view");
    } catch (err: any) {
      setErrors({ submit: err?.data?.error?.message || "Failed to update" });
    }
  };

  const handleToggleStatus = async () => {
    if (!ruleId || !rule) return;
    try {
      await toggleStatus({ id: ruleId, isActive: !rule.isActive }).unwrap();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  if (isLoadingRule) {
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

  if (!rule) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-8 space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <p className="text-lg font-medium">Charge rule not found</p>
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
            <Calculator className="h-5 w-5" />
            {mode === "view" ? "View" : "Edit"} Charge Rule
          </DialogTitle>
          <DialogDescription>
            {rule.partner?.displayName || rule.partner?.name} &bull;{" "}
            {BASE_LABELS[rule.base]}
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
              <Badge variant={rule.isActive ? "default" : "secondary"}>
                {rule.isActive ? "Active" : "Inactive"}
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
              ) : rule.isActive ? (
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

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Base</Label>
              <div>
                <Badge className={getBaseColor(rule.base)}>
                  {BASE_LABELS[rule.base]}
                </Badge>
              </div>
            </div>
            {rule.chargesType && (
              <div>
                <Label className="text-muted-foreground text-xs">
                  Charges Type
                </Label>
                <p className="font-medium text-sm">{rule.chargesType.name}</p>
              </div>
            )}
            {rule.pincodeType && (
              <div>
                <Label className="text-muted-foreground text-xs">
                  Pincode Type
                </Label>
                <p className="font-medium text-sm">{rule.pincodeType.name}</p>
              </div>
            )}
            {rule.zoneMilestone && (
              <div>
                <Label className="text-muted-foreground text-xs">
                  Distance Slab
                </Label>
                <p className="font-medium text-sm">
                  {rule.zoneMilestone.minKm}-{rule.zoneMilestone.maxKm} km (
                  {rule.zoneMilestone.suffix})
                </p>
              </div>
            )}
          </div>

          {/* View/Edit fields */}
          {mode === "view" ? (
            <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-sm">
              <p className="font-medium">{getRuleSummary(rule)}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Min Value:</span>{" "}
                  {formatCurrency(rule.minValue)}
                </div>
                {rule.base === "INVOICE_VALUE" && (
                  <div>
                    <span className="text-muted-foreground">Percentage:</span>{" "}
                    {rule.percentageValue}%
                  </div>
                )}
                {rule.base !== "INVOICE_VALUE" && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Per KG:</span>{" "}
                      {rule.perKg} kg
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Per KG Charge:
                      </span>{" "}
                      {formatCurrency(rule.perKgCharge)}
                    </div>
                  </>
                )}
                {rule.base === "ZONE_TO_ZONE_WEIGHT" && (
                  <>
                    <div>
                      <span className="text-muted-foreground">From Zone:</span>{" "}
                      {rule.fromZoneId?.slice(0, 8)}...
                    </div>
                    <div>
                      <span className="text-muted-foreground">To Zone:</span>{" "}
                      {rule.toZoneId?.slice(0, 8)}...
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <Label>Min Value (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.minValue}
                  onChange={(e) => handleChange("minValue", e.target.value)}
                />
              </div>
              {rule.base === "INVOICE_VALUE" && (
                <div className="space-y-1">
                  <Label>Percentage Value (%)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.percentageValue}
                    onChange={(e) =>
                      handleChange("percentageValue", e.target.value)
                    }
                  />
                </div>
              )}
              {(rule.base === "WEIGHT" ||
                rule.base === "ZONE_TO_ZONE_WEIGHT" ||
                rule.base === "DISTANCE_BASE_WEIGHT") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Per KG (kg)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.perKg}
                      onChange={(e) => handleChange("perKg", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Per KG Charge (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.perKgCharge}
                      onChange={(e) =>
                        handleChange("perKgCharge", e.target.value)
                      }
                    />
                  </div>
                </div>
              )}
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
export default function ChargesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBase, setFilterBase] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewEditModalOpen, setViewEditModalOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");

  const {
    data: rulesData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetChargeRulesQuery({
    page,
    limit,
    ...(filterBase !== "all" && { base: filterBase as ChargeRuleBase }),
    ...(filterStatus !== "all" && { isActive: filterStatus === "active" }),
    ...(filterPartner !== "all" && { partnerId: filterPartner }),
    ...(searchTerm && { search: searchTerm }),
  });

  const { data: partnersData } = useGetPartnersQuery({ isActive: true });
  const partners = (partnersData as any)?.data?.partners || [];

  const [deleteRule] = useDeleteChargeRuleMutation();
  const [toggleStatus] = useToggleChargeRuleStatusMutation();

  const chargeRules = rulesData?.chargeRules || [];
  const pagination = rulesData?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const handleView = (rule: any) => {
    setSelectedRuleId(rule.id);
    setModalMode("view");
    setViewEditModalOpen(true);
  };

  const handleEdit = (rule: any) => {
    setSelectedRuleId(rule.id);
    setModalMode("edit");
    setViewEditModalOpen(true);
  };

  const handleToggleStatus = async (rule: any) => {
    try {
      await toggleStatus({ id: rule.id, isActive: !rule.isActive }).unwrap();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (
      confirm(
        "Are you sure you want to permanently delete this charge rule? This cannot be undone.",
      )
    ) {
      try {
        await deleteRule(ruleId).unwrap();
      } catch (err) {
        console.error("Failed to delete rule:", err);
      }
    }
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[{ title: "Charges Management", href: "/charges" }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Charges Management
            </h1>
            <p className="text-muted-foreground">
              Manage charge rules for partners — invoice, weight, zone-to-zone,
              and distance based.
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
              <Plus className="mr-2 h-4 w-4" /> Create Rule
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Invoice / Weight
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  chargeRules.filter(
                    (r: any) =>
                      r.base === "INVOICE_VALUE" || r.base === "WEIGHT",
                  ).length
                }
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Zone / Distance
              </CardTitle>
              <MapPin className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  chargeRules.filter(
                    (r: any) =>
                      r.base === "ZONE_TO_ZONE_WEIGHT" ||
                      r.base === "DISTANCE_BASE_WEIGHT",
                  ).length
                }
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partners</CardTitle>
              <Layers className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{partners.length}</div>
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
                    placeholder="Search by partner name..."
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
              <Select value={filterBase} onValueChange={setFilterBase}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Bases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bases</SelectItem>
                  <SelectItem value="INVOICE_VALUE">Invoice Value</SelectItem>
                  <SelectItem value="WEIGHT">Weight</SelectItem>
                  <SelectItem value="ZONE_TO_ZONE_WEIGHT">
                    Zone to Zone
                  </SelectItem>
                  <SelectItem value="DISTANCE_BASE_WEIGHT">
                    Distance Based
                  </SelectItem>
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
            <CardTitle>Charge Rules</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${pagination.total} rules found`}
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
                  Failed to load charge rules
                </p>
                <Button onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry
                </Button>
              </div>
            ) : chargeRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Calculator className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No charge rules found</p>
                <p className="text-sm text-muted-foreground">
                  Create your first charge rule to get started.
                </p>
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create Rule
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
                        Type / Detail
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Base
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">
                        Summary
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
                    {chargeRules.map((rule: any) => (
                      <tr
                        key={rule.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm">
                          <button
                            onClick={() => handleView(rule)}
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {rule.partner?.displayName ||
                              rule.partner?.name ||
                              "-"}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {rule.chargesType?.name ||
                            rule.pincodeType?.name ||
                            (rule.zoneMilestone
                              ? `${rule.zoneMilestone.minKm}-${rule.zoneMilestone.maxKm}km`
                              : "-")}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={getBaseColor(rule.base)}
                          >
                            {BASE_LABELS[rule.base] || rule.base}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground max-w-[250px] truncate">
                          {getRuleSummary(rule)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={rule.isActive ? "default" : "secondary"}
                          >
                            {rule.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(rule)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(rule)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(rule)}
                              title={rule.isActive ? "Deactivate" : "Activate"}
                            >
                              {rule.isActive ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(rule.id)}
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

      <CreateChargeRuleModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        partners={partners}
      />
      <ViewEditChargeRuleModal
        open={viewEditModalOpen}
        onClose={() => {
          setViewEditModalOpen(false);
          setSelectedRuleId(null);
        }}
        ruleId={selectedRuleId}
        mode={modalMode}
      />
    </DashboardLayout>
  );
}
