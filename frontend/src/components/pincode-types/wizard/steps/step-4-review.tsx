import { useEffect, useMemo } from "react";
import { AlertCircle, MapPin, Hash } from "lucide-react";
import { useGetPincodesQuery } from "@/store/api/endpoints/geoApi";
import { usePincodeTypeWizardStore } from "@/store/pincode-type-wizard-store";
import { GroupedSelectionList, ItemGroup } from "../grouped-selection-list";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export function Step4Review() {
  const {
    selectedAreas,
    selectedPincodes,
    togglePincode,
    toggleAllPincodesInArea,
    formData,
    setFormField,
    errors,
    clearError,
  } = usePincodeTypeWizardStore();

  // Fetch pincodes for each selected area in parallel
  const pincodesQueries = selectedAreas.map((area) =>
    useGetPincodesQuery({ areaId: area.id, limit: 1000 }),
  );

  // Check loading state
  const isLoadingPincodes = pincodesQueries.some((query) => query.isLoading);

  // Check error state
  const hasError = pincodesQueries.some((query) => query.isError);

  // Clear error when selection changes
  useEffect(() => {
    if (selectedPincodes.length > 0) {
      clearError("pincodes");
    }
  }, [selectedPincodes, clearError]);

  // Transform pincodes into groups by area
  const groups: ItemGroup<{
    id: string;
    code: string;
    areaId?: string;
    areaName?: string;
  }>[] = useMemo(() => {
    const result: ItemGroup<{
      id: string;
      code: string;
      areaId?: string;
      areaName?: string;
    }>[] = [];

    selectedAreas.forEach((area, index) => {
      const query = pincodesQueries[index];
      const pincodes = query.data?.data || [];

      // Filter active pincodes
      const activePincodes = pincodes
        .filter((pincode) => pincode.status !== false)
        .map((pincode) => ({
          id: pincode.id,
          code: pincode.code,
          areaId: pincode.areaId,
          areaName: area.name,
        }));

      if (activePincodes.length > 0) {
        result.push({
          id: area.id,
          title: area.name,
          subtitle: `${activePincodes.length} pincode${activePincodes.length !== 1 ? "s" : ""}`,
          items: activePincodes,
        });
      }
    });

    return result;
  }, [selectedAreas, pincodesQueries]);

  const selectedPincodeIds = selectedPincodes.map((p) => p.id);

  // Calculate summary stats
  const totalAvailablePincodes = useMemo(() => {
    return pincodesQueries.reduce((sum, query) => {
      const pincodes = query.data?.data || [];
      return sum + pincodes.filter((p) => p.status !== false).length;
    }, 0);
  }, [pincodesQueries]);

  const coverage = useMemo(() => {
    if (totalAvailablePincodes === 0) return 0;
    return Math.round((selectedPincodes.length / totalAvailablePincodes) * 100);
  }, [selectedPincodes.length, totalAvailablePincodes]);

  return (
    <div className="space-y-6">
      {/* Error Messages */}
      {(errors.pincodes || errors.name) && (
        <div className="space-y-2">
          {errors.pincodes && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-sm text-red-800 dark:text-red-300">
                {errors.pincodes}
              </span>
            </div>
          )}
          {errors.name && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-sm text-red-800 dark:text-red-300">
                {errors.name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary Card */}
      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
          Selection Summary
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {selectedAreas.length}
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              Areas
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {totalAvailablePincodes}
            </div>
            <div className="text-xs text-indigo-700 dark:text-indigo-300">
              Available
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {selectedPincodes.length}
            </div>
            <div className="text-xs text-green-700 dark:text-green-300">
              Selected
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {coverage}%
            </div>
            <div className="text-xs text-purple-700 dark:text-purple-300">
              Coverage
            </div>
          </div>
        </div>
      </div>

      {/* Pincode Type Form */}
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Pincode Type Details
        </h3>

        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="pincodeTypeName" className="text-sm">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="pincodeTypeName"
            placeholder="e.g., Metro, ODA, Hill"
            value={formData.name}
            onChange={(e) => {
              setFormField("name", e.target.value);
              clearError("name");
            }}
            className={errors.name ? "border-red-500" : ""}
          />
          <p className="text-xs text-muted-foreground">
            A unique name for this pincode type service
          </p>
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="pincodeTypeDescription" className="text-sm">
            Description
          </Label>
          <Textarea
            id="pincodeTypeDescription"
            placeholder="Enter a description for this pincode type..."
            value={formData.description}
            onChange={(e) => setFormField("description", e.target.value)}
            rows={2}
          />
        </div>

        {/* Active Status */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormField("isActive", !!checked)}
          />
          <Label htmlFor="isActive" className="text-sm cursor-pointer">
            Active (this pincode type will be enabled immediately)
          </Label>
        </div>
      </div>

      {/* Pincodes Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Select Pincodes
          </h3>
          {selectedPincodes.length > 0 && (
            <Badge variant="default" className="bg-blue-600">
              <MapPin className="h-3 w-3 mr-1" />
              {selectedPincodes.length} selected
            </Badge>
          )}
        </div>

        <GroupedSelectionList
          groups={groups}
          selectedIds={selectedPincodeIds}
          onToggle={(pincode) => togglePincode(pincode)}
          onToggleGroup={(groupId, items) =>
            toggleAllPincodesInArea(groupId, items)
          }
          searchPlaceholder="Search pincodes..."
          emptyMessage="No pincodes available for the selected areas"
          emptySearchMessage="No pincodes match your search"
          isLoading={isLoadingPincodes}
          maxHeight="300px"
        />
      </div>

      {/* API Error */}
      {hasError && !isLoadingPincodes && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-sm text-yellow-800 dark:text-yellow-300">
            Failed to load pincodes. Please try again.
          </span>
        </div>
      )}
    </div>
  );
}
