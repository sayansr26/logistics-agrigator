import { useEffect, useMemo } from "react";
import { AlertCircle, Info } from "lucide-react";
import { useGetAreasQuery } from "@/store/api/endpoints/geoApi";
import { usePincodeTypeWizardStore } from "@/store/pincode-type-wizard-store";
import { GroupedSelectionList, ItemGroup } from "../grouped-selection-list";

export function Step3Areas() {
  const {
    selectedCities,
    selectedAreas,
    toggleArea,
    toggleAllAreasInCity,
    errors,
    clearError,
  } = usePincodeTypeWizardStore();

  // Group cities by state for display
  const citiesByState = useMemo(() => {
    const groups = new Map<string, typeof selectedCities>();
    selectedCities.forEach((city) => {
      if (!groups.has(city.stateId)) {
        groups.set(city.stateId, []);
      }
      groups.get(city.stateId)!.push(city);
    });
    return groups;
  }, [selectedCities]);

  // Fetch areas for each selected city in parallel
  const areasQueries = selectedCities.map((city) =>
    useGetAreasQuery({ cityId: city.id }),
  );

  // Check loading state
  const isLoadingAreas = areasQueries.some((query) => query.isLoading);

  // Check error state
  const hasError = areasQueries.some((query) => query.isError);

  // Clear error when selection changes
  useEffect(() => {
    if (selectedAreas.length > 0) {
      clearError("areas");
    }
  }, [selectedAreas, clearError]);

  // Transform areas into groups by city (and state)
  const groups: ItemGroup<{ id: string; name: string; cityId: string }>[] =
    useMemo(() => {
      const result: ItemGroup<{ id: string; name: string; cityId: string }>[] =
        [];

      selectedCities.forEach((city, index) => {
        const query = areasQueries[index];
        const areas = query.data?.data || [];

        // Filter active areas
        const activeAreas = areas
          .filter((area) => area.status !== false)
          .map((area) => ({
            id: area.id,
            name: area.name,
            cityId: area.cityId,
          }));

        if (activeAreas.length > 0) {
          result.push({
            id: city.id,
            title: city.name,
            subtitle: `${activeAreas.length} area${activeAreas.length !== 1 ? "s" : ""}`,
            items: activeAreas,
          });
        }
      });

      return result;
    }, [selectedCities, areasQueries]);

  const selectedAreaIds = selectedAreas.map((a) => a.id);

  // Get state name for a city
  const getStateNameForCity = (cityId: string) => {
    const city = selectedCities.find((c) => c.id === cityId);
    if (!city) return "";
    const state = selectedCities.find((c) => c.id === city.stateId); // This won't work, we need state info
    // Actually, we need to get state info from selectedStates or from city data
    return ""; // Will be fixed by using city.stateId to look up state name
  };

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {errors.areas && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-sm text-red-800 dark:text-red-300">
            {errors.areas}
          </span>
        </div>
      )}

      {/* City Selection Summary */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Filtering by{" "}
          <span className="font-semibold">{selectedCities.length}</span> cit
          {selectedCities.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      {/* Areas List */}
      <GroupedSelectionList
        groups={groups}
        selectedIds={selectedAreaIds}
        onToggle={(area) => toggleArea(area)}
        onToggleGroup={(groupId, items) => toggleAllAreasInCity(groupId, items)}
        searchPlaceholder="Search areas by name..."
        emptyMessage="No areas available for the selected cities"
        emptySearchMessage="No areas match your search"
        isLoading={isLoadingAreas}
        maxHeight="350px"
      />

      {/* Selection Summary */}
      {selectedAreas.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-semibold">{selectedAreas.length}</span> area
            {selectedAreas.length !== 1 ? "s" : ""} selected from{" "}
            <span className="font-semibold">{selectedCities.length}</span> cit
            {selectedCities.length !== 1 ? "ies" : "y"}
          </p>
        </div>
      )}

      {/* API Error */}
      {hasError && !isLoadingAreas && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-sm text-yellow-800 dark:text-yellow-300">
            Failed to load areas. Please try again.
          </span>
        </div>
      )}
    </div>
  );
}
