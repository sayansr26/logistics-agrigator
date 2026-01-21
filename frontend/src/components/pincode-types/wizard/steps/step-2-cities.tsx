import { useEffect, useMemo } from "react";
import { AlertCircle, Info } from "lucide-react";
import { useGetCitiesQuery } from "@/store/api/endpoints/geoApi";
import { usePincodeTypeWizardStore } from "@/store/pincode-type-wizard-store";
import { GroupedSelectionList, ItemGroup } from "../grouped-selection-list";

export function Step2Cities() {
  const {
    selectedStates,
    selectedCities,
    toggleCity,
    toggleAllCitiesInState,
    getAffectedCities,
    errors,
    clearError,
  } = usePincodeTypeWizardStore();

  // Fetch cities for each selected state in parallel
  const citiesQueries = selectedStates.map((state) =>
    useGetCitiesQuery({ stateId: state.id }),
  );

  // Check loading state
  const isLoadingCities = citiesQueries.some((query) => query.isLoading);

  // Check error state
  const hasError = citiesQueries.some((query) => query.isError);

  // Clear error when selection changes
  useEffect(() => {
    if (selectedCities.length > 0) {
      clearError("cities");
    }
  }, [selectedCities, clearError]);

  // Transform cities into groups by state
  const groups: ItemGroup<{
    id: string;
    name: string;
    code: string;
    stateId: string;
  }>[] = useMemo(() => {
    const result: ItemGroup<{
      id: string;
      name: string;
      code: string;
      stateId: string;
    }>[] = [];

    selectedStates.forEach((state, index) => {
      const query = citiesQueries[index];
      const cities = query.data?.data || [];

      // Filter active cities
      const activeCities = cities
        .filter((city) => city.status !== false)
        .map((city) => ({
          id: city.id,
          name: city.name,
          code: city.code,
          stateId: city.stateId,
        }));

      if (activeCities.length > 0) {
        result.push({
          id: state.id,
          title: state.name,
          subtitle: `${activeCities.length} cit${activeCities.length !== 1 ? "ies" : "y"}`,
          items: activeCities,
        });
      }
    });

    return result;
  }, [selectedStates, citiesQueries]);

  const selectedCityIds = selectedCities.map((c) => c.id);

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {errors.cities && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-sm text-red-800 dark:text-red-300">
            {errors.cities}
          </span>
        </div>
      )}

      {/* State Selection Summary */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Filtering by{" "}
          <span className="font-semibold">{selectedStates.length}</span> state
          {selectedStates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Cities List */}
      <GroupedSelectionList
        groups={groups}
        selectedIds={selectedCityIds}
        onToggle={(city) => toggleCity(city)}
        onToggleGroup={(groupId, items) =>
          toggleAllCitiesInState(groupId, items)
        }
        searchPlaceholder="Search cities by name or code..."
        emptyMessage="No cities available for the selected states"
        emptySearchMessage="No cities match your search"
        isLoading={isLoadingCities}
        maxHeight="350px"
      />

      {/* Selection Summary */}
      {selectedCities.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-semibold">{selectedCities.length}</span> cit
            {selectedCities.length !== 1 ? "ies" : "y"} selected from{" "}
            <span className="font-semibold">{selectedStates.length}</span> state
            {selectedStates.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* API Error */}
      {hasError && !isLoadingCities && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-sm text-yellow-800 dark:text-yellow-300">
            Failed to load cities. Please try again.
          </span>
        </div>
      )}
    </div>
  );
}
