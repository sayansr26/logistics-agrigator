import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useGetStatesQuery } from "@/store/api/endpoints/geoApi";
import { usePincodeTypeWizardStore } from "@/store/pincode-type-wizard-store";
import { GroupedSelectionList, ItemGroup } from "../grouped-selection-list";

export function Step1States() {
  const { selectedStates, toggleState, errors, clearError } =
    usePincodeTypeWizardStore();

  // Fetch all states
  const { data: statesData, isLoading: isLoadingStates } = useGetStatesQuery();

  // Clear error when selection changes
  useEffect(() => {
    if (selectedStates.length > 0) {
      clearError("states");
    }
  }, [selectedStates, clearError]);

  // Transform states into groups (single group for all states)
  const groups: ItemGroup<{ id: string; name: string; code: string }>[] = [];

  if (statesData?.data) {
    // Group by region (optional - for now single group)
    const allStates = statesData.data
      .filter((state) => state.status !== false)
      .map((state) => ({
        id: state.id,
        name: state.name,
        code: state.code,
      }));

    if (allStates.length > 0) {
      groups.push({
        id: "all-states",
        title: "All States",
        subtitle: "Select one or more states to continue",
        items: allStates,
      });
    }
  }

  const selectedStateIds = selectedStates.map((s) => s.id);

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {errors.states && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-sm text-red-800 dark:text-red-300">
            {errors.states}
          </span>
        </div>
      )}

      {/* States List */}
      <GroupedSelectionList
        groups={groups}
        selectedIds={selectedStateIds}
        onToggle={(state) => toggleState(state)}
        onToggleGroup={(groupId, items) => {
          // Toggle all states (since it's a single group)
          const allSelected = items.every((item) =>
            selectedStateIds.includes(item.id),
          );
          if (allSelected) {
            // Deselect all
            items.forEach((item) => {
              if (selectedStateIds.includes(item.id)) {
                // Find and toggle
                const state = selectedStates.find((s) => s.id === item.id);
                if (state) toggleState(state);
              }
            });
          } else {
            // Select all
            items.forEach((item) => {
              if (!selectedStateIds.includes(item.id)) {
                toggleState(item);
              }
            });
          }
        }}
        searchPlaceholder="Search states by name or code..."
        emptyMessage="No states available"
        emptySearchMessage="No states match your search"
        isLoading={isLoadingStates}
        maxHeight="350px"
      />

      {/* Selection Summary */}
      {selectedStates.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-semibold">{selectedStates.length}</span> state
            {selectedStates.length !== 1 ? "s" : ""} selected
          </p>
        </div>
      )}
    </div>
  );
}
