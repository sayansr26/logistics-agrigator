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
  Weight,
  DollarSign,
  Layers,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  useGetChargeRulesQuery,
  useGetChargeRuleByIdQuery,
  useCreateChargeRuleMutation,
  useUpdateChargeRuleMutation,
  useDeleteChargeRuleMutation,
  useToggleChargeRuleStatusMutation,
} from "@/store/api/endpoints/chargesApi";
import type {
  ChargeRuleKind,
  ChargeRuleBase,
  ChargeCalcType,
  CreateChargeRuleRequest,
} from "@/store/api/endpoints/chargesApi";
import { useGetPartnersQuery } from "@/store/api/endpoints/partnersApi";
import { useGetChargesTypesQuery } from "@/store/api/endpoints/chargesTypeApi";
import { useGetPincodeTypesQuery } from "@/store/api/endpoints/pincodeTypeApi";
import { useGetZonesQuery } from "@/store/api/endpoints/zonesApi";

// ============================================
// HELPERS
// ============================================

const KIND_LABELS: Record<string, string> = {
  PARTNER_CHARGES_TYPE: "Partner Charge Type",
  GEOLOGICAL: "Geological Charges",
  ADDON: "Addon Charges",
};

const BASE_LABELS: Record<string, string> = {
  INVOICE_VALUE: "Invoice Value",
  WEIGHT: "Weight",
  ZONE_TO_ZONE_WEIGHT: "Zone to Zone (Weight)",
  DISTANCE_BASE_WEIGHT: "Distance Based (Weight)",
};

function getKindColor(kind: string) {
  switch (kind) {
    case "PARTNER_CHARGES_TYPE":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "GEOLOGICAL":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    case "ADDON":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

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
  switch (rule.base) {
    case "INVOICE_VALUE":
      return `₹${rule.fromAmount || 0} - ₹${rule.toAmount || "∞"} → ${rule.calcType === "PERCENTAGE" ? `${rule.charge}%` : formatCurrency(rule.charge)}`;
    case "WEIGHT":
      return `${rule.minKg || 0}kg - ${rule.maxKg || "∞"}kg → ${rule.calcType === "PERCENTAGE" ? `${rule.charge}%` : formatCurrency(rule.charge)}`;
    case "ZONE_TO_ZONE_WEIGHT":
      return `Min ${rule.minWeightKg || 0}kg, ${formatCurrency(rule.weightCharge)} + ${formatCurrency(rule.addonCharge)}/extra ${rule.addonWeightKg || 1}kg`;
    case "DISTANCE_BASE_WEIGHT":
      return `${rule.fromKm || 0}-${rule.toKm || "∞"}km, ${formatCurrency(rule.weightCharge)} + ${formatCurrency(rule.addonCharge)}/extra`;
    default:
      return "-";
  }
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
  const [formData, setFormData] = useState<any>({
    partnerId: "",
    kind: "",
    base: "",
    chargesTypeId: "",
    pincodeTypeId: "",
    fromAmount: "",
    toAmount: "",
    charge: "",
    calcType: "FLAT",
    minKg: "",
    maxKg: "",
    fromZoneId: "",
    toZoneId: "",
    minWeightKg: "",
    addonWeightKg: "",
    weightCharge: "",
    addonCharge: "",
    division: "",
    fromKm: "",
    toKm: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<any>({});

  const [createRule, { isLoading }] = useCreateChargeRuleMutation();

  // Fetch charges types for selected partner
  const { data: chargesTypesData } = useGetChargesTypesQuery(
    { partnerId: formData.partnerId, isActive: true },
    { skip: !formData.partnerId },
  );
  const chargesTypes = (chargesTypesData as any)?.data || [];

  // Fetch pincode types
  const { data: pincodeTypesData } = useGetPincodeTypesQuery(
    { isActive: true },
    { skip: formData.kind !== "GEOLOGICAL" },
  );
  const pincodeTypes = (pincodeTypesData as any)?.data || [];

  // Fetch zones (GEOLOGICAL type) for selected partner
  const { data: zonesData } = useGetZonesQuery(
    { partnerId: formData.partnerId, status: true },
    { skip: !formData.partnerId || formData.base !== "ZONE_TO_ZONE_WEIGHT" },
  );
  const zones =
    (zonesData as any)?.data?.zones?.filter?.(
      (z: any) => z.zoneType === "GEOLOGICAL",
    ) || [];

  useEffect(() => {
    if (open) {
      setFormData({
        partnerId: "",
        kind: "",
        base: "",
        chargesTypeId: "",
        pincodeTypeId: "",
        fromAmount: "",
        toAmount: "",
        charge: "",
        calcType: "FLAT",
        minKg: "",
        maxKg: "",
        fromZoneId: "",
        toZoneId: "",
        minWeightKg: "",
        addonWeightKg: "",
        weightCharge: "",
        addonCharge: "",
        division: "",
        fromKm: "",
        toKm: "",
        isActive: true,
      });
      setErrors({});
    }
  }, [open]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: null }));

    // Reset dependent fields
    if (field === "partnerId") {
      setFormData((prev: any) => ({
        ...prev,
        [field]: value,
        chargesTypeId: "",
        fromZoneId: "",
        toZoneId: "",
      }));
    }
    if (field === "kind") {
      setFormData((prev: any) => ({
        ...prev,
        [field]: value,
        chargesTypeId: "",
        pincodeTypeId: "",
      }));
    }
  };

  const handleSubmit = async () => {
    const newErrors: any = {};
    if (!formData.partnerId) newErrors.partnerId = "Partner is required";
    if (!formData.kind) newErrors.kind = "Kind is required";
    if (!formData.base) newErrors.base = "Base is required";

    if (formData.kind === "PARTNER_CHARGES_TYPE" && !formData.chargesTypeId)
      newErrors.chargesTypeId = "Charge type is required";
    if (formData.kind === "GEOLOGICAL" && !formData.pincodeTypeId)
      newErrors.pincodeTypeId = "Pincode type is required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const payload: CreateChargeRuleRequest = {
      partnerId: formData.partnerId,
      kind: formData.kind as ChargeRuleKind,
      base: formData.base as ChargeRuleBase,
      isActive: formData.isActive,
    };

    if (formData.kind === "PARTNER_CHARGES_TYPE")
      payload.chargesTypeId = formData.chargesTypeId;
    if (formData.kind === "GEOLOGICAL")
      payload.pincodeTypeId = formData.pincodeTypeId;

    if (formData.base === "INVOICE_VALUE") {
      payload.fromAmount = parseFloat(formData.fromAmount) || 0;
      payload.toAmount = parseFloat(formData.toAmount) || 0;
      payload.charge = parseFloat(formData.charge) || 0;
      payload.calcType = formData.calcType as ChargeCalcType;
    }

    if (formData.base === "WEIGHT") {
      payload.minKg = parseFloat(formData.minKg) || 0;
      payload.maxKg = parseFloat(formData.maxKg) || 0;
      payload.charge = parseFloat(formData.charge) || 0;
      payload.calcType = formData.calcType as ChargeCalcType;
    }

    if (formData.base === "ZONE_TO_ZONE_WEIGHT") {
      payload.fromZoneId = formData.fromZoneId;
      payload.toZoneId = formData.toZoneId;
      payload.minWeightKg = parseFloat(formData.minWeightKg) || 0;
      payload.addonWeightKg = parseFloat(formData.addonWeightKg) || 0;
      payload.weightCharge = parseFloat(formData.weightCharge) || 0;
      payload.addonCharge = parseFloat(formData.addonCharge) || 0;
    }

    if (formData.base === "DISTANCE_BASE_WEIGHT") {
      payload.division = formData.division;
      payload.fromKm = parseInt(formData.fromKm) || 0;
      payload.toKm = parseInt(formData.toKm) || 0;
      payload.minWeightKg = parseFloat(formData.minWeightKg) || 0;
      payload.addonWeightKg = parseFloat(formData.addonWeightKg) || 0;
      payload.weightCharge = parseFloat(formData.weightCharge) || 0;
      payload.addonCharge = parseFloat(formData.addonCharge) || 0;
    }

    try {
      await createRule(payload).unwrap();
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
          {/* Partner Selection */}
          <div className="space-y-2">
            <Label>Select Partner *</Label>
            <Select
              value={formData.partnerId}
              onValueChange={(v) => handleChange("partnerId", v)}
            >
              <SelectTrigger
                className={errors.partnerId ? "border-red-500" : ""}
              >
                <SelectValue placeholder="Search and select partner..." />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
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

          {/* Kind Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Charge Kind *</Label>
              <Select
                value={formData.kind}
                onValueChange={(v) => handleChange("kind", v)}
              >
                <SelectTrigger className={errors.kind ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARTNER_CHARGES_TYPE">
                    Partner Charge Type
                  </SelectItem>
                  <SelectItem value="GEOLOGICAL">Geological Charges</SelectItem>
                  <SelectItem value="ADDON">Addon Charges</SelectItem>
                </SelectContent>
              </Select>
              {errors.kind && (
                <p className="text-red-500 text-sm">{errors.kind}</p>
              )}
            </div>

            {/* Charges Type (when kind = PARTNER_CHARGES_TYPE) */}
            {formData.kind === "PARTNER_CHARGES_TYPE" && formData.partnerId && (
              <div className="space-y-2">
                <Label>Charges Type *</Label>
                <Select
                  value={formData.chargesTypeId}
                  onValueChange={(v) => handleChange("chargesTypeId", v)}
                >
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

            {/* Pincode Type (when kind = GEOLOGICAL) */}
            {formData.kind === "GEOLOGICAL" && (
              <div className="space-y-2">
                <Label>Pincode Type *</Label>
                <Select
                  value={formData.pincodeTypeId}
                  onValueChange={(v) => handleChange("pincodeTypeId", v)}
                >
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

          {/* Base Selection */}
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
                  Weight (Zone to Zone)
                </SelectItem>
                <SelectItem value="DISTANCE_BASE_WEIGHT">
                  Weight (Distance Based)
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.base && (
              <p className="text-red-500 text-sm">{errors.base}</p>
            )}
          </div>

          {/* Conditional Fields */}
          {formData.base === "INVOICE_VALUE" && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-semibold text-muted-foreground">
                Invoice Value Slab
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>From Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={formData.fromAmount}
                    onChange={(e) => handleChange("fromAmount", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>To Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10000"
                    value={formData.toAmount}
                    onChange={(e) => handleChange("toAmount", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Charge</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="50"
                    value={formData.charge}
                    onChange={(e) => handleChange("charge", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Calc Type</Label>
                  <Select
                    value={formData.calcType}
                    onValueChange={(v) => handleChange("calcType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FLAT">Flat (₹)</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {formData.base === "WEIGHT" && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-semibold text-muted-foreground">
                Weight Slab
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Min Kg</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0"
                    value={formData.minKg}
                    onChange={(e) => handleChange("minKg", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Max Kg</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="5"
                    value={formData.maxKg}
                    onChange={(e) => handleChange("maxKg", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Charge</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="100"
                    value={formData.charge}
                    onChange={(e) => handleChange("charge", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Calc Type</Label>
                  <Select
                    value={formData.calcType}
                    onValueChange={(v) => handleChange("calcType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FLAT">Flat (₹)</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {formData.base === "ZONE_TO_ZONE_WEIGHT" && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-semibold text-muted-foreground">
                Zone to Zone Weight
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>From Zone</Label>
                  <Select
                    value={formData.fromZoneId}
                    onValueChange={(v) => handleChange("fromZoneId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z: any) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>To Zone</Label>
                  <Select
                    value={formData.toZoneId}
                    onValueChange={(v) => handleChange("toZoneId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z: any) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Minimum Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.minWeightKg}
                    onChange={(e) =>
                      handleChange("minWeightKg", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Addon Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.addonWeightKg}
                    onChange={(e) =>
                      handleChange("addonWeightKg", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Weight Charge (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weightCharge}
                    onChange={(e) =>
                      handleChange("weightCharge", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Addon Charge (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.addonCharge}
                    onChange={(e) =>
                      handleChange("addonCharge", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {formData.base === "DISTANCE_BASE_WEIGHT" && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-semibold text-muted-foreground">
                Distance Based Weight
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Division</Label>
                  <Input
                    placeholder="e.g., A"
                    value={formData.division}
                    onChange={(e) => handleChange("division", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>From KM</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.fromKm}
                    onChange={(e) => handleChange("fromKm", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>To KM</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.toKm}
                    onChange={(e) => handleChange("toKm", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Minimum Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.minWeightKg}
                    onChange={(e) =>
                      handleChange("minWeightKg", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Addon Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.addonWeightKg}
                    onChange={(e) =>
                      handleChange("addonWeightKg", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Weight Charge (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weightCharge}
                    onChange={(e) =>
                      handleChange("weightCharge", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Addon Charge (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.addonCharge}
                    onChange={(e) =>
                      handleChange("addonCharge", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Status */}
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
        fromAmount: rule.fromAmount?.toString() || "",
        toAmount: rule.toAmount?.toString() || "",
        charge: rule.charge?.toString() || "",
        calcType: rule.calcType || "FLAT",
        minKg: rule.minKg?.toString() || "",
        maxKg: rule.maxKg?.toString() || "",
        minWeightKg: rule.minWeightKg?.toString() || "",
        addonWeightKg: rule.addonWeightKg?.toString() || "",
        weightCharge: rule.weightCharge?.toString() || "",
        addonCharge: rule.addonCharge?.toString() || "",
        division: rule.division || "",
        fromKm: rule.fromKm?.toString() || "",
        toKm: rule.toKm?.toString() || "",
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

    const payload: any = {};

    if (rule.base === "INVOICE_VALUE") {
      payload.fromAmount = parseFloat(formData.fromAmount) || 0;
      payload.toAmount = parseFloat(formData.toAmount) || 0;
      payload.charge = parseFloat(formData.charge) || 0;
      payload.calcType = formData.calcType;
    }

    if (rule.base === "WEIGHT") {
      payload.minKg = parseFloat(formData.minKg) || 0;
      payload.maxKg = parseFloat(formData.maxKg) || 0;
      payload.charge = parseFloat(formData.charge) || 0;
      payload.calcType = formData.calcType;
    }

    if (rule.base === "ZONE_TO_ZONE_WEIGHT") {
      payload.minWeightKg = parseFloat(formData.minWeightKg) || 0;
      payload.addonWeightKg = parseFloat(formData.addonWeightKg) || 0;
      payload.weightCharge = parseFloat(formData.weightCharge) || 0;
      payload.addonCharge = parseFloat(formData.addonCharge) || 0;
    }

    if (rule.base === "DISTANCE_BASE_WEIGHT") {
      payload.division = formData.division;
      payload.fromKm = parseInt(formData.fromKm) || 0;
      payload.toKm = parseInt(formData.toKm) || 0;
      payload.minWeightKg = parseFloat(formData.minWeightKg) || 0;
      payload.addonWeightKg = parseFloat(formData.addonWeightKg) || 0;
      payload.weightCharge = parseFloat(formData.weightCharge) || 0;
      payload.addonCharge = parseFloat(formData.addonCharge) || 0;
    }

    payload.isActive = formData.isActive;

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
            {KIND_LABELS[rule.kind]} &bull; {BASE_LABELS[rule.base]}
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

          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Kind</Label>
              <Badge className={getKindColor(rule.kind)}>
                {KIND_LABELS[rule.kind]}
              </Badge>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Base</Label>
              <Badge className={getBaseColor(rule.base)}>
                {BASE_LABELS[rule.base]}
              </Badge>
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
          </div>

          {/* View / Edit fields based on base type */}
          {mode === "view" ? (
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <p className="text-sm font-medium">{getRuleSummary(rule)}</p>
              {rule.base === "INVOICE_VALUE" && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">From:</span>{" "}
                    {formatCurrency(rule.fromAmount)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">To:</span>{" "}
                    {formatCurrency(rule.toAmount)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Charge:</span>{" "}
                    {rule.calcType === "PERCENTAGE"
                      ? `${rule.charge}%`
                      : formatCurrency(rule.charge)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {rule.calcType}
                  </div>
                </div>
              )}
              {rule.base === "WEIGHT" && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Min:</span>{" "}
                    {rule.minKg}kg
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max:</span>{" "}
                    {rule.maxKg}kg
                  </div>
                  <div>
                    <span className="text-muted-foreground">Charge:</span>{" "}
                    {rule.calcType === "PERCENTAGE"
                      ? `${rule.charge}%`
                      : formatCurrency(rule.charge)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {rule.calcType}
                  </div>
                </div>
              )}
              {(rule.base === "ZONE_TO_ZONE_WEIGHT" ||
                rule.base === "DISTANCE_BASE_WEIGHT") && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {rule.base === "DISTANCE_BASE_WEIGHT" && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Division:</span>{" "}
                        {rule.division || "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">KM Range:</span>{" "}
                        {rule.fromKm}-{rule.toKm}km
                      </div>
                    </>
                  )}
                  <div>
                    <span className="text-muted-foreground">Min Weight:</span>{" "}
                    {rule.minWeightKg}kg
                  </div>
                  <div>
                    <span className="text-muted-foreground">Addon Weight:</span>{" "}
                    {rule.addonWeightKg}kg
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Weight Charge:
                    </span>{" "}
                    {formatCurrency(rule.weightCharge)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Addon Charge:</span>{" "}
                    {formatCurrency(rule.addonCharge)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              {rule.base === "INVOICE_VALUE" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>From Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.fromAmount}
                        onChange={(e) =>
                          handleChange("fromAmount", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>To Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.toAmount}
                        onChange={(e) =>
                          handleChange("toAmount", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Charge</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.charge}
                        onChange={(e) => handleChange("charge", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Calc Type</Label>
                      <Select
                        value={formData.calcType}
                        onValueChange={(v) => handleChange("calcType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FLAT">Flat</SelectItem>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {rule.base === "WEIGHT" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Min Kg</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.minKg}
                        onChange={(e) => handleChange("minKg", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Max Kg</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.maxKg}
                        onChange={(e) => handleChange("maxKg", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Charge</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.charge}
                        onChange={(e) => handleChange("charge", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Calc Type</Label>
                      <Select
                        value={formData.calcType}
                        onValueChange={(v) => handleChange("calcType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FLAT">Flat</SelectItem>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {(rule.base === "ZONE_TO_ZONE_WEIGHT" ||
                rule.base === "DISTANCE_BASE_WEIGHT") && (
                <>
                  {rule.base === "DISTANCE_BASE_WEIGHT" && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Division</Label>
                        <Input
                          value={formData.division}
                          onChange={(e) =>
                            handleChange("division", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>From KM</Label>
                        <Input
                          type="number"
                          value={formData.fromKm}
                          onChange={(e) =>
                            handleChange("fromKm", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>To KM</Label>
                        <Input
                          type="number"
                          value={formData.toKm}
                          onChange={(e) => handleChange("toKm", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Min Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.minWeightKg}
                        onChange={(e) =>
                          handleChange("minWeightKg", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Addon Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.addonWeightKg}
                        onChange={(e) =>
                          handleChange("addonWeightKg", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Weight Charge</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.weightCharge}
                        onChange={(e) =>
                          handleChange("weightCharge", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Addon Charge</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.addonCharge}
                        onChange={(e) =>
                          handleChange("addonCharge", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </>
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
  const [filterKind, setFilterKind] = useState("all");
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
    ...(filterKind !== "all" && { kind: filterKind as ChargeRuleKind }),
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
    if (confirm("Are you sure you want to disable this charge rule?")) {
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
                Invoice/Weight
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
                Zone/Distance
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
              <Select value={filterKind} onValueChange={setFilterKind}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Kinds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Kinds</SelectItem>
                  <SelectItem value="PARTNER_CHARGES_TYPE">
                    Partner Type
                  </SelectItem>
                  <SelectItem value="GEOLOGICAL">Geological</SelectItem>
                  <SelectItem value="ADDON">Addon</SelectItem>
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
                        Kind
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
                        <td className="py-3 px-4">
                          <Badge className={getKindColor(rule.kind)}>
                            {KIND_LABELS[rule.kind] || rule.kind}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {rule.chargesType?.name ||
                            rule.pincodeType?.name ||
                            "-"}
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
