import { create } from "zustand";
import type { CreatePincodeTypeInput } from "@/store/api/endpoints/pincodeTypeApi";

// ===========================
// Type Definitions
// ===========================

export interface SelectedState {
  id: string;
  name: string;
  code: string;
}

export interface SelectedCity {
  id: string;
  name: string;
  stateId: string;
  code: string;
}

export interface SelectedArea {
  id: string;
  name: string;
  cityId: string;
}

export interface SelectedPincode {
  id: string;
  code: string;
  areaId?: string;
  areaName?: string;
}

export interface FormErrors {
  [key: string]: string;
}

// ===========================
// Store State Interface
// ===========================

export interface PincodeTypeWizardState {
  // Current step (1-4)
  currentStep: number;

  // Form data for pincode type details
  formData: {
    name: string;
    description: string;
    isActive: boolean;
  };

  // Selected items at each level
  selectedStates: SelectedState[];
  selectedCities: SelectedCity[];
  selectedAreas: SelectedArea[];
  selectedPincodes: SelectedPincode[];

  // Validation errors
  errors: FormErrors;

  // ===========================
  // Navigation Methods
  // ===========================

  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;

  // ===========================
  // Form Data Methods
  // ===========================

  setFormField: <K extends keyof PincodeTypeWizardState["formData"]>(
    field: K,
    value: PincodeTypeWizardState["formData"][K],
  ) => void;

  // ===========================
  // Selection Methods with Cascade
  // ===========================

  toggleState: (state: SelectedState) => void;
  toggleCity: (city: SelectedCity) => void;
  toggleArea: (area: SelectedArea) => void;
  togglePincode: (pincode: SelectedPincode) => void;

  // Toggle all items in a group
  toggleAllCitiesInState: (stateId: string, cities: SelectedCity[]) => void;
  toggleAllAreasInCity: (cityId: string, areas: SelectedArea[]) => void;
  toggleAllPincodesInArea: (
    areaId: string,
    pincodes: SelectedPincode[],
  ) => void;

  // ===========================
  // Validation Methods
  // ===========================

  validateCurrentStep: () => boolean;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;

  // ===========================
  // Utility Methods
  // ===========================

  resetWizard: () => void;
  getFinalPayload: () => CreatePincodeTypeInput;

  // Initialize for edit mode
  initializeFromEdit: (data: {
    name: string;
    description?: string;
    isActive: boolean;
    pincodes: SelectedPincode[];
    areas?: SelectedArea[];
    cities?: SelectedCity[];
    states?: SelectedState[];
  }) => void;

  // Direct setters for edit mode
  setSelectedPincodes: (pincodes: SelectedPincode[]) => void;
  setSelectedAreas: (areas: SelectedArea[]) => void;
  setSelectedCities: (cities: SelectedCity[]) => void;
  setSelectedStates: (states: SelectedState[]) => void;
  setFormData: (data: {
    name: string;
    description?: string;
    isActive: boolean;
  }) => void;

  // Get cascade info (what will be removed if parent is deselected)
  getAffectedCities: (stateId: string) => SelectedCity[];
  getAffectedAreas: (cityId: string) => SelectedArea[];
  getAffectedPincodes: (areaId: string) => SelectedPincode[];
}

// ===========================
// Initial State
// ===========================

const initialState = {
  currentStep: 1,
  formData: {
    name: "",
    description: "",
    isActive: true,
  },
  selectedStates: [],
  selectedCities: [],
  selectedAreas: [],
  selectedPincodes: [],
  errors: {},
};

// ===========================
// Zustand Store
// ===========================

export const usePincodeTypeWizardStore = create<PincodeTypeWizardState>(
  (set, get) => ({
    ...initialState,

    // ===========================
    // Navigation Methods
    // ===========================

    setCurrentStep: (step) => set({ currentStep: step }),

    nextStep: () => {
      const { currentStep, validateCurrentStep } = get();
      if (validateCurrentStep() && currentStep < 4) {
        set({ currentStep: currentStep + 1 });
      }
    },

    previousStep: () => {
      const { currentStep } = get();
      if (currentStep > 1) {
        set({ currentStep: currentStep - 1 });
      }
    },

    // ===========================
    // Form Data Methods
    // ===========================

    setFormField: (field, value) =>
      set((state) => ({
        formData: { ...state.formData, [field]: value },
        errors: { ...state.errors, [field]: "" },
      })),

    // ===========================
    // Selection Methods with Cascade
    // ===========================

    toggleState: (state) =>
      set((stateStore) => {
        const exists = stateStore.selectedStates.find((s) => s.id === state.id);
        if (exists) {
          // Remove state and all its children (cascade)
          const newStates = stateStore.selectedStates.filter(
            (s) => s.id !== state.id,
          );
          const affectedCities = stateStore.selectedCities.filter(
            (c) => c.stateId === state.id,
          );
          const newCities = stateStore.selectedCities.filter(
            (c) => c.stateId !== state.id,
          );
          const affectedCityIds = affectedCities.map((c) => c.id);
          const affectedAreas = stateStore.selectedAreas.filter((a) =>
            affectedCityIds.includes(a.cityId),
          );
          const newAreas = stateStore.selectedAreas.filter(
            (a) => !affectedCityIds.includes(a.cityId),
          );
          const affectedAreaIds = affectedAreas.map((a) => a.id);
          const newPincodes = stateStore.selectedPincodes.filter(
            (p) => !affectedAreaIds.includes(p.areaId || ""),
          );
          return {
            selectedStates: newStates,
            selectedCities: newCities,
            selectedAreas: newAreas,
            selectedPincodes: newPincodes,
          };
        } else {
          // Add state
          return { selectedStates: [...stateStore.selectedStates, state] };
        }
      }),

    toggleCity: (city) =>
      set((stateStore) => {
        const exists = stateStore.selectedCities.find((c) => c.id === city.id);
        if (exists) {
          // Remove city and all its children (cascade)
          const newCities = stateStore.selectedCities.filter(
            (c) => c.id !== city.id,
          );
          const affectedAreas = stateStore.selectedAreas.filter(
            (a) => a.cityId === city.id,
          );
          const newAreas = stateStore.selectedAreas.filter(
            (a) => a.cityId !== city.id,
          );
          const affectedAreaIds = affectedAreas.map((a) => a.id);
          const newPincodes = stateStore.selectedPincodes.filter(
            (p) => !affectedAreaIds.includes(p.areaId || ""),
          );
          return {
            selectedCities: newCities,
            selectedAreas: newAreas,
            selectedPincodes: newPincodes,
          };
        } else {
          // Add city
          return { selectedCities: [...stateStore.selectedCities, city] };
        }
      }),

    toggleArea: (area) =>
      set((stateStore) => {
        const exists = stateStore.selectedAreas.find((a) => a.id === area.id);
        if (exists) {
          // Remove area and all its pincodes (cascade)
          const newAreas = stateStore.selectedAreas.filter(
            (a) => a.id !== area.id,
          );
          const newPincodes = stateStore.selectedPincodes.filter(
            (p) => p.areaId !== area.id,
          );
          return {
            selectedAreas: newAreas,
            selectedPincodes: newPincodes,
          };
        } else {
          // Add area
          return { selectedAreas: [...stateStore.selectedAreas, area] };
        }
      }),

    togglePincode: (pincode) =>
      set((stateStore) => {
        const exists = stateStore.selectedPincodes.find(
          (p) => p.id === pincode.id,
        );
        if (exists) {
          // Remove pincode (no cascade - leaf node)
          return {
            selectedPincodes: stateStore.selectedPincodes.filter(
              (p) => p.id !== pincode.id,
            ),
          };
        } else {
          // Add pincode
          return {
            selectedPincodes: [...stateStore.selectedPincodes, pincode],
          };
        }
      }),

    // Toggle all items in a group
    toggleAllCitiesInState: (stateId, cities) =>
      set((stateStore) => {
        const stateCities = stateStore.selectedCities.filter(
          (c) => c.stateId === stateId,
        );
        const allSelected = cities.every((city) =>
          stateCities.some((sc) => sc.id === city.id),
        );

        if (allSelected) {
          // Deselect all cities in this state (cascade)
          const newCities = stateStore.selectedCities.filter(
            (c) => c.stateId !== stateId,
          );
          const affectedCityIds = cities.map((c) => c.id);
          const newAreas = stateStore.selectedAreas.filter(
            (a) => !affectedCityIds.includes(a.cityId),
          );
          const affectedAreaIds = stateStore.selectedAreas
            .filter((a) => affectedCityIds.includes(a.cityId))
            .map((a) => a.id);
          const newPincodes = stateStore.selectedPincodes.filter(
            (p) => !affectedAreaIds.includes(p.areaId || ""),
          );
          return {
            selectedCities: newCities,
            selectedAreas: newAreas,
            selectedPincodes: newPincodes,
          };
        } else {
          // Select all cities in this state
          const citiesToAdd = cities.filter(
            (city) =>
              !stateStore.selectedCities.some((sc) => sc.id === city.id),
          );
          return {
            selectedCities: [...stateStore.selectedCities, ...citiesToAdd],
          };
        }
      }),

    toggleAllAreasInCity: (cityId, areas) =>
      set((stateStore) => {
        const cityAreas = stateStore.selectedAreas.filter(
          (a) => a.cityId === cityId,
        );
        const allSelected = areas.every((area) =>
          cityAreas.some((sa) => sa.id === area.id),
        );

        if (allSelected) {
          // Deselect all areas in this city (cascade)
          const newAreas = stateStore.selectedAreas.filter(
            (a) => a.cityId !== cityId,
          );
          const affectedAreaIds = areas.map((a) => a.id);
          const newPincodes = stateStore.selectedPincodes.filter(
            (p) => !affectedAreaIds.includes(p.areaId || ""),
          );
          return {
            selectedAreas: newAreas,
            selectedPincodes: newPincodes,
          };
        } else {
          // Select all areas in this city
          const areasToAdd = areas.filter(
            (area) => !stateStore.selectedAreas.some((sa) => sa.id === area.id),
          );
          return {
            selectedAreas: [...stateStore.selectedAreas, ...areasToAdd],
          };
        }
      }),

    toggleAllPincodesInArea: (areaId, pincodes) =>
      set((stateStore) => {
        const areaPincodes = stateStore.selectedPincodes.filter(
          (p) => p.areaId === areaId,
        );
        const allSelected = pincodes.every((pincode) =>
          areaPincodes.some((sp) => sp.id === pincode.id),
        );

        if (allSelected) {
          // Deselect all pincodes in this area
          return {
            selectedPincodes: stateStore.selectedPincodes.filter(
              (p) => p.areaId !== areaId,
            ),
          };
        } else {
          // Select all pincodes in this area
          const pincodesToAdd = pincodes.filter(
            (pincode) =>
              !stateStore.selectedPincodes.some((sp) => sp.id === pincode.id),
          );
          return {
            selectedPincodes: [
              ...stateStore.selectedPincodes,
              ...pincodesToAdd,
            ],
          };
        }
      }),

    // ===========================
    // Validation Methods
    // ===========================

    validateCurrentStep: () => {
      const {
        currentStep,
        selectedStates,
        selectedCities,
        selectedAreas,
        selectedPincodes,
        formData,
      } = get();
      const errors: FormErrors = {};

      switch (currentStep) {
        case 1:
          if (selectedStates.length === 0) {
            errors.states = "Please select at least one state";
          }
          break;
        case 2:
          if (selectedCities.length === 0) {
            errors.cities = "Please select at least one city";
          }
          break;
        case 3:
          if (selectedAreas.length === 0) {
            errors.areas = "Please select at least one area";
          }
          break;
        case 4:
          if (selectedPincodes.length === 0) {
            errors.pincodes = "Please select at least one pincode";
          }
          if (!formData.name.trim()) {
            errors.name = "Pincode type name is required";
          }
          break;
      }

      set({ errors });
      return Object.keys(errors).length === 0;
    },

    setError: (field, error) =>
      set((state) => ({
        errors: { ...state.errors, [field]: error },
      })),

    clearError: (field) =>
      set((state) => ({
        errors: { ...state.errors, [field]: "" },
      })),

    clearAllErrors: () => set({ errors: {} }),

    // ===========================
    // Utility Methods
    // ===========================

    resetWizard: () =>
      set({
        ...initialState,
        currentStep: 1,
      }),

    getFinalPayload: () => {
      const { formData, selectedPincodes } = get();
      return {
        name: formData.name,
        description: formData.description || undefined,
        isActive: formData.isActive,
        pincodeCodes: selectedPincodes.map((p) => p.code),
      };
    },

    // Get cascade info
    getAffectedCities: (stateId) =>
      get().selectedCities.filter((c) => c.stateId === stateId),

    getAffectedAreas: (cityId) =>
      get().selectedAreas.filter((a) => a.cityId === cityId),

    getAffectedPincodes: (areaId) =>
      get().selectedPincodes.filter((p) => p.areaId === areaId),

    // Initialize for edit mode
    initializeFromEdit: (data) =>
      set({
        currentStep: 1,
        formData: {
          name: data.name,
          description: data.description || "",
          isActive: data.isActive,
        },
        selectedStates: data.states || [],
        selectedCities: data.cities || [],
        selectedAreas: data.areas || [],
        selectedPincodes: data.pincodes,
        errors: {},
      }),

    // Direct setters for edit mode
    setSelectedPincodes: (pincodes) => set({ selectedPincodes: pincodes }),
    setSelectedAreas: (areas) => set({ selectedAreas: areas }),
    setSelectedCities: (cities) => set({ selectedCities: cities }),
    setSelectedStates: (states) => set({ selectedStates: states }),
    setFormData: (data) =>
      set((state) => ({
        formData: { ...state.formData, ...data },
      })),
  }),
);
