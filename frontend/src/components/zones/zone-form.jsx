"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Truck,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Loader2,
  MapPin,
  Building,
  Users,
  Plus,
  Trash2,
  Route,
  Map,
  Search,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { geographicalApiService, partnersApiService } from "@/services";
import { useAuth } from "@/hooks/useAuth";

const defaultFormData = {
  name: "",
  description: "",
  partnerId: "", // For geological zones (single partner)
  selectedPartnerIds: [], // For distance zones (multiple partners)
  status: true,
  zoneType: "distance-wise", // Default to distance-wise (zone-wise coming soon)
  selectedStates: [],
  selectedCities: [],
  selectedAreas: [],
  selectedPincodes: [],
  manualPincodes: [], // New field for manually entered pincodes
  services: [],
  // Distance-wise specific fields
  distanceSlabs: [{ id: 1, name: "", distanceFrom: "0", distanceTo: "" }], // First slab must start at 0
  // Network tax table fields
  networkTaxes: [
    {
      id: 1,
      taxName: "",
      taxType: "percentage",
      taxValue: "",
      isActive: true,
      description: "",
    },
  ],
  // Legacy fields for backward compatibility
  code: "",
  type: "both",
  area: "",
  population: "",
  density: "medium",
  weightLimit: "",
  hazardousAllowed: false,
  fragileAllowed: true,
  liquidAllowed: false,
  perishableAllowed: true,
};

/**
 * ScopedSelectMenu — a "Select ▾" trigger opening a grouped menu of scoped
 * bulk-select actions. Sections carry a small label; every row shows the count
 * it will add so the number itself is the affordance. Radix supplies keyboard
 * navigation, focus management and Escape-to-close.
 *
 * Props:
 *   label     — text on the trigger (e.g. "Select")
 *   sections  — [{ label?, options: [{ key, label, count, onSelect, disabled? }] }]
 *   disabled  — disables the whole trigger
 */
function ScopedSelectMenu({ label = "Select", sections, disabled }) {
  const hasAny = sections.some((s) =>
    s.options.some((o) => (o.count ?? 0) > 0 || o.always),
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled || !hasAny}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {label}
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-h-80 overflow-y-auto"
      >
        {sections.map((section, si) => {
          const rows = section.options.filter(
            (o) => (o.count ?? 0) > 0 || o.always,
          );
          if (rows.length === 0) return null;
          return (
            <div key={section.label || si}>
              {si > 0 && <DropdownMenuSeparator />}
              {section.label && (
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </DropdownMenuLabel>
              )}
              {rows.map((o) => (
                <DropdownMenuItem
                  key={o.key}
                  disabled={o.disabled || (!o.always && (o.count ?? 0) === 0)}
                  onSelect={o.onSelect}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">{o.label}</span>
                  {o.count != null && (
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {o.count}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ZoneForm({
  initialData = {},
  onSubmit,
  onCancel,
  isLoading = false,
  title = "Zone Configuration",
  description = "Configure zone details, coverage, and service restrictions",
}) {
  const [formData, setFormData] = useState({
    ...defaultFormData,
    ...initialData,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Get authentication token
  const { accessToken } = useAuth();

  // Dynamic data state
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [pincodes, setPincodes] = useState([]);
  const [partners, setPartners] = useState([]);

  // Manual pincode input state
  const [manualPincodeInput, setManualPincodeInput] = useState("");
  const [pincodeSearchResults, setPincodeSearchResults] = useState([]);
  const [isSearchingPincodes, setIsSearchingPincodes] = useState(false);
  const [showPincodeSearch, setShowPincodeSearch] = useState(false);

  // City filtering state
  const [cityFilter, setCityFilter] = useState("all"); // "all", "metro", "non-metro"

  // Partner search state for chips UI
  const [partnerSearch, setPartnerSearch] = useState("");
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);

  // Geographical search state for chips UI (State -> City -> Area -> Pincode)
  const [stateSearch, setStateSearch] = useState("");
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [areaSearch, setAreaSearch] = useState("");
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [pincodeSearch, setPincodeSearch] = useState("");
  const [showPincodeDropdown, setShowPincodeDropdown] = useState(false);

  // Loading states
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingPincodes, setLoadingPincodes] = useState(false);
  const [loadingPartners, setLoadingPartners] = useState(false);

  // Fetch initial data on component mount and when token is available
  useEffect(() => {
    if (accessToken) {
      fetchStates();
      fetchPartners();
    }
  }, [accessToken]);

  // Fetch states
  const fetchStates = async () => {
    setLoadingStates(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      const response = await geographicalApiService.getStates();
      console.log("States API response:", response); // Debug log
      if (response.status === "success") {
        console.log("States data:", response.data); // Debug log
        setStates(response.data || []);
      } else {
        console.error("Failed to fetch states:", response.error);
        setStates([]);
      }
    } catch (error) {
      console.error("Error fetching states:", error);
      setStates([]);
    } finally {
      setLoadingStates(false);
    }
  };

  // Fetch cities by state
  const fetchCitiesByState = async (stateId) => {
    setLoadingCities(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      const response = await geographicalApiService.getCitiesByState(stateId);
      if (response.status === "success") {
        setCities(response.data || []);
      } else {
        console.error("Failed to fetch cities:", response.error);
        setCities([]);
      }
    } catch (error) {
      console.error("Error fetching cities:", error);
      setCities([]);
    } finally {
      setLoadingCities(false);
    }
  };

  // Fetch cities for multiple states
  const fetchCitiesForStates = async (selectedStates) => {
    setLoadingCities(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      // Bulk fetch: one chunked call set instead of one request per state
      // (avoids 429s and is far faster when many states are selected).
      const allCities = await geographicalApiService.getCitiesByStates(
        selectedStates.map((state) => state.id),
      );

      setCities(allCities);
    } catch (error) {
      console.error("Error fetching cities for states:", error);
      setCities([]);
    } finally {
      setLoadingCities(false);
    }
  };

  // Fetch areas by city
  const fetchAreasByCity = async (cityId) => {
    setLoadingAreas(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      const response = await geographicalApiService.getAreasByCity(cityId);
      if (response.status === "success") {
        setAreas(response.data || []);
      } else {
        console.error("Failed to fetch areas:", response.error);
        setAreas([]);
      }
    } catch (error) {
      console.error("Error fetching areas:", error);
      setAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  };

  // Fetch areas for multiple cities
  const fetchAreasForCities = async (selectedCities) => {
    setLoadingAreas(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      // Bulk fetch: one chunked call set instead of one request per city
      // (avoids 429s and is far faster when many/all cities are selected).
      const allAreas = await geographicalApiService.getAreasByCities(
        selectedCities.map((city) => city.id),
      );

      setAreas(allAreas);
    } catch (error) {
      console.error("Error fetching areas for cities:", error);
      setAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  };

  // Fetch pincodes by area
  const fetchPincodesByArea = async (areaId) => {
    setLoadingPincodes(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      const response = await geographicalApiService.getPincodesByArea(areaId);
      if (response.status === "success") {
        setPincodes(response.data || []);
      } else {
        console.error("Failed to fetch pincodes:", response.error);
        setPincodes([]);
      }
    } catch (error) {
      console.error("Error fetching pincodes:", error);
      setPincodes([]);
    } finally {
      setLoadingPincodes(false);
    }
  };

  // Fetch pincodes for multiple areas
  const fetchPincodesForAreas = async (selectedAreas) => {
    setLoadingPincodes(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      // Bulk fetch: one chunked call set instead of one request per area
      // (avoids 429s and is far faster when many/all areas are selected).
      const allPincodes = await geographicalApiService.getPincodesByAreas(
        selectedAreas.map((area) => area.id),
      );

      setPincodes(allPincodes);
    } catch (error) {
      console.error("Error fetching pincodes for areas:", error);
      setPincodes([]);
    } finally {
      setLoadingPincodes(false);
    }
  };

  // Fetch partners
  const fetchPartners = async () => {
    setLoadingPartners(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        partnersApiService.setAccessToken(accessToken);
      }

      const response = await partnersApiService.getPartners({ isActive: true });
      if (response.status === "success" && response.data?.partners) {
        setPartners(response.data.partners);
      } else {
        console.error("Failed to fetch partners:", response.error);
        setPartners([]);
      }
    } catch (error) {
      console.error("Error fetching partners:", error);
      setPartners([]);
    } finally {
      setLoadingPartners(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Zone name is required";
    } else if (formData.name.length < 3 || formData.name.length > 100) {
      newErrors.name = "Zone name must be between 3 and 100 characters";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Zone description is required";
    } else if (
      formData.description.length < 10 ||
      formData.description.length > 500
    ) {
      newErrors.description =
        "Zone description must be between 10 and 500 characters";
    }

    // Partner validation - common to both zone types (multi-select)
    if (
      !formData.selectedPartnerIds ||
      formData.selectedPartnerIds.length === 0
    ) {
      newErrors.selectedPartnerIds = "At least one partner is required";
    }

    // Zone-wise validation
    if (formData.zoneType === "zone-wise") {
      if (!formData.selectedStates || formData.selectedStates.length === 0) {
        newErrors.selectedStates = "At least one state is required";
      }

      if (!formData.selectedCities || formData.selectedCities.length === 0) {
        newErrors.selectedCities = "At least one city is required";
      }

      if (
        (!formData.selectedPincodes ||
          formData.selectedPincodes.length === 0) &&
        (!formData.manualPincodes || formData.manualPincodes.length === 0)
      ) {
        newErrors.selectedPincodes =
          "At least one pincode is required (either selected from areas or manually entered)";
      }
    }

    // Distance-wise validation
    if (formData.zoneType === "distance-wise") {
      if (!formData.distanceSlabs || formData.distanceSlabs.length === 0) {
        newErrors.distanceSlabs = "At least one distance slab is required";
      } else {
        // First milestone must start at 0
        if (Number(formData.distanceSlabs[0].distanceFrom) !== 0) {
          newErrors[`distanceSlab_0_distanceFrom`] =
            "First distance slab must start at 0 km";
        }

        formData.distanceSlabs.forEach((slab, index) => {
          if (!slab.name.trim()) {
            newErrors[`distanceSlab_${index}_name`] = "Zone name is required";
          }
          if (
            slab.distanceFrom === "" ||
            slab.distanceFrom === undefined ||
            isNaN(Number(slab.distanceFrom)) ||
            Number(slab.distanceFrom) < 0
          ) {
            newErrors[`distanceSlab_${index}_distanceFrom`] =
              "Valid distance from is required";
          }
          if (
            !slab.distanceTo ||
            isNaN(Number(slab.distanceTo)) ||
            Number(slab.distanceTo) <= 0
          ) {
            newErrors[`distanceSlab_${index}_distanceTo`] =
              "Valid distance to is required";
          }
          // Validate that distanceTo is greater than distanceFrom
          if (
            slab.distanceFrom !== "" &&
            slab.distanceTo &&
            Number(slab.distanceTo) <= Number(slab.distanceFrom)
          ) {
            newErrors[`distanceSlab_${index}_distanceTo`] =
              "Distance to must be greater than distance from";
          }
        });
      }
    }

    // Legacy validation for backward compatibility
    if (formData.code && !/^[A-Z0-9]+$/.test(formData.code)) {
      newErrors.code =
        "Zone code must contain only uppercase letters and numbers";
    }

    if (formData.area && isNaN(Number(formData.area))) {
      newErrors.area = "Area must be a valid number";
    }

    if (formData.population && isNaN(Number(formData.population))) {
      newErrors.population = "Population must be a valid number";
    }

    if (formData.weightLimit && isNaN(Number(formData.weightLimit))) {
      newErrors.weightLimit = "Weight limit must be a valid number";
    }

    // Manual pincode validation
    if (formData.manualPincodes && formData.manualPincodes.length > 0) {
      formData.manualPincodes.forEach((pincode, index) => {
        if (!pincode || !/^\d{6}$/.test(pincode)) {
          newErrors[`manualPincode_${index}`] =
            "Pincode must be exactly 6 digits";
        }
      });
    }

    // Network tax validation - only validate if user has entered data
    if (formData.networkTaxes && formData.networkTaxes.length > 0) {
      formData.networkTaxes.forEach((tax, index) => {
        // Skip validation for empty/default entries
        if (!tax.taxName.trim() && !tax.taxValue) {
          return; // Skip this entry - it's empty
        }

        if (tax.taxName.trim() && !tax.taxValue) {
          newErrors[`networkTax_${index}_taxValue`] =
            "Tax value is required when tax name is provided";
        }
        if (tax.taxValue && !tax.taxName.trim()) {
          newErrors[`networkTax_${index}_taxName`] =
            "Tax name is required when tax value is provided";
        }
        if (
          tax.taxValue &&
          (isNaN(Number(tax.taxValue)) || Number(tax.taxValue) < 0)
        ) {
          newErrors[`networkTax_${index}_taxValue`] =
            "Valid tax value is required";
        }
        if (tax.taxType === "percentage" && Number(tax.taxValue) > 100) {
          newErrors[`networkTax_${index}_taxValue`] =
            "Percentage cannot exceed 100%";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        // Convert form data to the format expected by the API
        const apiFormData = {
          name: formData.name,
          description: formData.description,
          partnerId: formData.partnerId,
          selectedPartnerIds: formData.selectedPartnerIds || [], // For distance zones (multi-select)
          status: formData.status,
          zoneType: formData.zoneType,
          ...(formData.zoneType === "zone-wise"
            ? {
                geographical: {
                  states: formData.selectedStates.map((state) => state.id),
                  cities: formData.selectedCities.map((city) => city.id),
                  areas: formData.selectedAreas.map((area) => area.id),
                  // Backend expects 6-digit pincode codes, not UUIDs
                  pincodes: formData.selectedPincodes.map(
                    (pincode) => pincode.pincode || pincode.code,
                  ),
                  manualPincodes: formData.manualPincodes || [],
                },
              }
            : {
                distanceSlabs: formData.distanceSlabs.map((slab) => ({
                  name: slab.name,
                  distanceFrom: Number(slab.distanceFrom),
                  distanceTo: Number(slab.distanceTo),
                })),
              }),
          services:
            formData.services.length > 0
              ? formData.services
              : [
                  {
                    serviceTypeId: 1,
                    isAvailable: true,
                    baseCharge: 60,
                    customCharges: {
                      expressDelivery: 25,
                      codCharge: 15,
                    },
                    additionalInfo: {
                      cutoffTime: "18:00",
                      deliveryWindow: "24-48 hours",
                    },
                  },
                ],
          networkTaxes: formData.networkTaxes.map((tax) => ({
            taxName: tax.taxName,
            taxType: tax.taxType,
            taxValue: Number(tax.taxValue),
            isActive: tax.isActive,
            description: tax.description,
          })),
        };

        // Call the onSubmit function and wait for it to complete
        await onSubmit(apiFormData);

        // Set success state
        setIsSuccess(true);

        // Reset form after successful submission
        setFormData({ ...defaultFormData });
        setErrors({});
        setCities([]);
        setAreas([]);
        setPincodes([]);
        setManualPincodeInput("");
        setPincodeSearchResults([]);
        setShowPincodeSearch(false);
      } catch (error) {
        console.error("Form submission error:", error);
        // Don't reset form on error, let user retry
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const updateFormData = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear related errors when user starts typing
    const clearedErrors = { ...errors };
    Object.keys(updates).forEach((key) => {
      delete clearedErrors[key];
    });
    setErrors(clearedErrors);
    // Clear success state when user makes changes
    if (isSuccess) {
      setIsSuccess(false);
    }
  };

  // Handle state selection (multiple)
  const handleStateChange = (stateId, isChecked) => {
    const state = states.find((s) => String(s.id) === String(stateId));
    if (state) {
      let newSelectedStates;
      if (isChecked) {
        // Add state if not already selected
        newSelectedStates = [...formData.selectedStates, state];
      } else {
        // Remove state
        newSelectedStates = formData.selectedStates.filter(
          (s) => s.id !== state.id,
        );
      }

      updateFormData({
        selectedStates: newSelectedStates,
        selectedCities: [],
        selectedAreas: [],
        selectedPincodes: [],
      });
      setCities([]);
      setAreas([]);
      setPincodes([]);

      // Fetch cities for all selected states
      if (newSelectedStates.length > 0) {
        fetchCitiesForStates(newSelectedStates);
      }
    }
  };

  // Handle city selection (multiple)
  const handleCityChange = (cityId, isChecked) => {
    const city = cities.find((c) => String(c.id) === String(cityId));
    if (city) {
      let newSelectedCities;
      if (isChecked) {
        // Add city if not already selected
        newSelectedCities = [...formData.selectedCities, city];
      } else {
        // Remove city
        newSelectedCities = formData.selectedCities.filter(
          (c) => c.id !== city.id,
        );
      }

      updateFormData({
        selectedCities: newSelectedCities,
        selectedAreas: [],
        selectedPincodes: [],
      });
      setAreas([]);
      setPincodes([]);

      // Fetch areas for all selected cities
      if (newSelectedCities.length > 0) {
        fetchAreasForCities(newSelectedCities);
      }
    }
  };

  // Handle area selection (multiple)
  const handleAreaChange = (areaId, isChecked) => {
    const area = areas.find((a) => String(a.id) === String(areaId));
    if (area) {
      let newSelectedAreas;
      if (isChecked) {
        // Add area if not already selected
        newSelectedAreas = [...formData.selectedAreas, area];
      } else {
        // Remove area
        newSelectedAreas = formData.selectedAreas.filter(
          (a) => a.id !== area.id,
        );
      }

      updateFormData({
        selectedAreas: newSelectedAreas,
        selectedPincodes: [],
      });
      setPincodes([]);

      // Fetch pincodes for all selected areas
      if (newSelectedAreas.length > 0) {
        fetchPincodesForAreas(newSelectedAreas);
      }
    }
  };

  // Handle pincode selection (multiple)
  const handlePincodeChange = (pincodeId, isChecked) => {
    const pincode = pincodes.find((p) => String(p.id) === String(pincodeId));
    if (pincode) {
      let newSelectedPincodes;
      if (isChecked) {
        // Add pincode if not already selected
        newSelectedPincodes = [...formData.selectedPincodes, pincode];
      } else {
        // Remove pincode
        newSelectedPincodes = formData.selectedPincodes.filter(
          (p) => p.id !== pincode.id,
        );
      }

      updateFormData({ selectedPincodes: newSelectedPincodes });
    }
  };

  // ── Scoped "Select All" helpers ───────────────────────────────
  // Each `add*` takes an explicit list of items to add (already scoped by the
  // caller), de-duplicates against the current selection, resets downstream
  // selections, and triggers the next cascade fetch. This one path backs every
  // scope (all / metro / per-state / per-city / per-area).

  const notYetSelected = (candidates, selected) => {
    const chosen = new Set(selected.map((s) => String(s.id)));
    return candidates.filter((c) => !chosen.has(String(c.id)));
  };

  const addCities = (cityList) => {
    const toAdd = notYetSelected(cityList, formData.selectedCities);
    if (toAdd.length === 0) return;
    const newSelectedCities = [...formData.selectedCities, ...toAdd];
    updateFormData({
      selectedCities: newSelectedCities,
      selectedAreas: [],
      selectedPincodes: [],
    });
    setAreas([]);
    setPincodes([]);
    setCitySearch("");
    setShowCityDropdown(false);
    fetchAreasForCities(newSelectedCities);
  };

  const addAreas = (areaList) => {
    const toAdd = notYetSelected(areaList, formData.selectedAreas);
    if (toAdd.length === 0) return;
    const newSelectedAreas = [...formData.selectedAreas, ...toAdd];
    updateFormData({
      selectedAreas: newSelectedAreas,
      selectedPincodes: [],
    });
    setPincodes([]);
    setAreaSearch("");
    setShowAreaDropdown(false);
    fetchPincodesForAreas(newSelectedAreas);
  };

  const addPincodes = (pincodeList) => {
    const toAdd = notYetSelected(pincodeList, formData.selectedPincodes);
    if (toAdd.length === 0) return;
    updateFormData({
      selectedPincodes: [...formData.selectedPincodes, ...toAdd],
    });
    setPincodeSearch("");
    setShowPincodeDropdown(false);
  };

  // Scope groups (used to build the "Select" menus). Each returns
  // [{ key, label, items }] respecting the active search/metro filter.
  // NOTE: use a plain object, NOT `new Map()` — `Map` is imported from
  // lucide-react in this file and shadows the built-in Map constructor.
  const groupByName = (items, getName) => {
    const groups = {};
    for (const item of items) {
      const name = getName(item) || "Other";
      (groups[name] || (groups[name] = [])).push(item);
    }
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ key: label, label, items: groups[label] }));
  };

  const cityScopeGroups = () => {
    const visible = getFilteredCities();
    return {
      all: visible,
      metro: visible.filter((c) => c.isMetro === true),
      byState: groupByName(visible, (c) => c.state?.name),
    };
  };

  const areaScopeGroups = () => {
    const visible = getFilteredAreas();
    return {
      all: visible,
      byCity: groupByName(visible, (a) => a.city?.name),
    };
  };

  const pincodeScopeGroups = () => {
    const visible = getFilteredPincodes();
    return {
      all: visible,
      byArea: groupByName(visible, (p) => p.area?.name || p.areaName),
    };
  };

  // Distance slab management functions
  const addDistanceSlab = () => {
    // Calculate the starting distance based on the previous slab's ending distance + 1
    const lastSlab = formData.distanceSlabs[formData.distanceSlabs.length - 1];
    const newDistanceFrom =
      lastSlab && lastSlab.distanceTo
        ? String(Number(lastSlab.distanceTo) + 1)
        : "";

    const newSlab = {
      id: Date.now(),
      name: "",
      distanceFrom: newDistanceFrom,
      distanceTo: "",
    };
    updateFormData({
      distanceSlabs: [...formData.distanceSlabs, newSlab],
    });
  };

  const removeDistanceSlab = (slabId) => {
    if (formData.distanceSlabs.length > 1) {
      updateFormData({
        distanceSlabs: formData.distanceSlabs.filter(
          (slab) => slab.id !== slabId,
        ),
      });
    }
  };

  const updateDistanceSlab = (slabId, field, value) => {
    updateFormData({
      distanceSlabs: formData.distanceSlabs.map((slab) =>
        slab.id === slabId ? { ...slab, [field]: value } : slab,
      ),
    });
  };

  // Network tax management functions
  const addNetworkTax = () => {
    const newTax = {
      id: Date.now(),
      taxName: "",
      taxType: "percentage",
      taxValue: "",
      isActive: true,
      description: "",
    };
    updateFormData({
      networkTaxes: [...formData.networkTaxes, newTax],
    });
  };

  const removeNetworkTax = (taxId) => {
    if (formData.networkTaxes.length > 1) {
      updateFormData({
        networkTaxes: formData.networkTaxes.filter((tax) => tax.id !== taxId),
      });
    }
  };

  const updateNetworkTax = (taxId, field, value) => {
    updateFormData({
      networkTaxes: formData.networkTaxes.map((tax) =>
        tax.id === taxId ? { ...tax, [field]: value } : tax,
      ),
    });
  };

  // Manual pincode management functions
  const addManualPincode = () => {
    if (
      manualPincodeInput.trim() &&
      /^\d{6}$/.test(manualPincodeInput.trim())
    ) {
      const pincode = manualPincodeInput.trim();
      if (!formData.manualPincodes.includes(pincode)) {
        updateFormData({
          manualPincodes: [...formData.manualPincodes, pincode],
        });
        setManualPincodeInput("");
      } else {
        // Show error for duplicate pincode
        setErrors({
          ...errors,
          manualPincodeDuplicate: "This pincode is already added",
        });
        setTimeout(() => {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.manualPincodeDuplicate;
            return newErrors;
          });
        }, 3000);
      }
    } else {
      setErrors({
        ...errors,
        manualPincodeInput: "Please enter a valid 6-digit pincode",
      });
      setTimeout(() => {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.manualPincodeInput;
          return newErrors;
        });
      }, 3000);
    }
  };

  const removeManualPincode = (pincode) => {
    updateFormData({
      manualPincodes: formData.manualPincodes.filter((p) => p !== pincode),
    });
  };

  const handleManualPincodeKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addManualPincode();
    }
  };

  // Search pincodes function
  const searchPincodes = async (query) => {
    if (!query || query.length < 3) {
      setPincodeSearchResults([]);
      setShowPincodeSearch(false);
      return;
    }

    setIsSearchingPincodes(true);
    try {
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      const response = await geographicalApiService.searchPincodes(query, 10);
      if (response.status === "success") {
        setPincodeSearchResults(response.data || []);
        setShowPincodeSearch(true);
      } else {
        console.error("Failed to search pincodes:", response.error);
        setPincodeSearchResults([]);
        setShowPincodeSearch(false);
      }
    } catch (error) {
      console.error("Error searching pincodes:", error);
      setPincodeSearchResults([]);
      setShowPincodeSearch(false);
    } finally {
      setIsSearchingPincodes(false);
    }
  };

  // Handle pincode search input change
  const handlePincodeSearchChange = (value) => {
    setManualPincodeInput(value);

    // Clear error when user starts typing
    if (errors.manualPincodeInput) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.manualPincodeInput;
        return newErrors;
      });
    }

    // Search pincodes with debounce
    if (value.length >= 3) {
      const timeoutId = setTimeout(() => {
        searchPincodes(value);
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setPincodeSearchResults([]);
      setShowPincodeSearch(false);
    }
  };

  // Add pincode from search results
  const addPincodeFromSearch = (pincodeData) => {
    const pincode = pincodeData.pincode;
    if (!formData.manualPincodes.includes(pincode)) {
      updateFormData({
        manualPincodes: [...formData.manualPincodes, pincode],
      });
      setManualPincodeInput("");
      setShowPincodeSearch(false);
      setPincodeSearchResults([]);
    } else {
      setErrors({
        ...errors,
        manualPincodeDuplicate: "This pincode is already added",
      });
      setTimeout(() => {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.manualPincodeDuplicate;
          return newErrors;
        });
      }, 3000);
    }
  };

  // Filter cities based on metro status
  // Filter states by search term, excluding already-selected
  const getFilteredStates = () => {
    if (!states || states.length === 0) return [];
    const selectedIds = formData.selectedStates.map((s) => String(s.id));
    const q = stateSearch.trim().toLowerCase();
    return states.filter((state) => {
      const isNotSelected = !selectedIds.includes(String(state.id));
      const matchesSearch =
        !q ||
        state.name?.toLowerCase().includes(q) ||
        state.code?.toLowerCase().includes(q);
      return isNotSelected && matchesSearch;
    });
  };

  const getFilteredCities = () => {
    if (!cities || cities.length === 0) return [];

    const selectedIds = formData.selectedCities.map((c) => String(c.id));
    const q = citySearch.trim().toLowerCase();

    return cities.filter((city) => {
      if (selectedIds.includes(String(city.id))) return false;

      // Metro filter
      if (cityFilter === "metro" && city.isMetro !== true) return false;
      if (cityFilter === "non-metro" && city.isMetro !== false) return false;

      // Search filter
      const matchesSearch = !q || city.name?.toLowerCase().includes(q);
      return matchesSearch;
    });
  };

  // Filter areas by search term, excluding already-selected
  const getFilteredAreas = () => {
    if (!areas || areas.length === 0) return [];
    const selectedIds = formData.selectedAreas.map((a) => String(a.id));
    const q = areaSearch.trim().toLowerCase();
    return areas.filter((area) => {
      const isNotSelected = !selectedIds.includes(String(area.id));
      const matchesSearch = !q || area.name?.toLowerCase().includes(q);
      return isNotSelected && matchesSearch;
    });
  };

  // Filter area-derived pincodes by search term, excluding already-selected
  const getFilteredPincodes = () => {
    if (!pincodes || pincodes.length === 0) return [];
    const selectedIds = formData.selectedPincodes.map((p) => String(p.id));
    const q = pincodeSearch.trim().toLowerCase();
    return pincodes.filter((pincode) => {
      const isNotSelected = !selectedIds.includes(String(pincode.id));
      const code = pincode.pincode || pincode.code || "";
      const matchesSearch =
        !q ||
        String(code).toLowerCase().includes(q) ||
        pincode.areaName?.toLowerCase().includes(q);
      return isNotSelected && matchesSearch;
    });
  };

  // Partner chips UI helper functions
  const getPartnerDisplayName = (partnerId) => {
    const partner = partners.find((p) => p.id === partnerId);
    return partner ? partner.displayName || partner.name : partnerId;
  };

  const handlePartnerSelect = (partnerId) => {
    const currentIds = formData.selectedPartnerIds || [];
    if (!currentIds.includes(partnerId)) {
      updateFormData({
        selectedPartnerIds: [...currentIds, partnerId],
      });
    }
    setPartnerSearch("");
    setShowPartnerDropdown(false);
  };

  const handlePartnerRemove = (partnerId) => {
    const currentIds = formData.selectedPartnerIds || [];
    updateFormData({
      selectedPartnerIds: currentIds.filter((id) => id !== partnerId),
    });
  };

  // Filter partners by search and exclude already selected
  const getFilteredPartners = () => {
    const selectedIds = formData.selectedPartnerIds || [];
    return partners.filter((partner) => {
      const isNotSelected = !selectedIds.includes(partner.id);
      const matchesSearch =
        !partnerSearch ||
        partner.name?.toLowerCase().includes(partnerSearch.toLowerCase()) ||
        partner.displayName
          ?.toLowerCase()
          .includes(partnerSearch.toLowerCase()) ||
        partner.code?.toLowerCase().includes(partnerSearch.toLowerCase());
      return isNotSelected && matchesSearch;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Success Message */}
        {isSuccess && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="font-medium">Zone created successfully!</span>
          </div>
        )}

        {/* Validation Error Summary */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
            <div className="flex items-center space-x-2 mb-2">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="font-medium">
                Please fix the following errors:
              </span>
            </div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {Object.entries(errors).map(([key, value]) => (
                <li key={key}>{value}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="text-sm font-medium">Basic Information</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Zone Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter zone name"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnerId">
                  Courier Partners *
                  <span className="text-xs text-muted-foreground ml-2">
                    (Select one or more)
                  </span>
                </Label>

                {/* Unified multi-select for both zone types - Chips UI */}
                <div className="space-y-2">
                  {/* Partner Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search and select courier partners..."
                      value={partnerSearch}
                      onChange={(e) => {
                        setPartnerSearch(e.target.value);
                        setShowPartnerDropdown(true);
                      }}
                      onFocus={() => setShowPartnerDropdown(true)}
                      onBlur={() => {
                        // Delay hiding to allow click on dropdown items
                        setTimeout(() => setShowPartnerDropdown(false), 200);
                      }}
                      className={`pl-10 ${errors.selectedPartnerIds ? "border-red-500" : ""}`}
                    />
                    {loadingPartners && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}

                    {/* Partner Dropdown */}
                    {showPartnerDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {loadingPartners ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Loading partners...
                          </div>
                        ) : getFilteredPartners().length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {partnerSearch
                              ? "No matching partners found"
                              : formData.selectedPartnerIds?.length ===
                                  partners.length
                                ? "All partners selected"
                                : "No partners available"}
                          </div>
                        ) : (
                          getFilteredPartners().map((partner) => (
                            <button
                              key={partner.id}
                              type="button"
                              onClick={() => handlePartnerSelect(partner.id)}
                              className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center space-x-2">
                                <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span className="font-medium">
                                  {partner.displayName || partner.name}
                                </span>
                                {partner.code && (
                                  <span className="text-muted-foreground text-xs">
                                    ({partner.code})
                                  </span>
                                )}
                              </div>
                              <Plus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Partners Chips */}
                  {formData.selectedPartnerIds?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.selectedPartnerIds.map((partnerId) => (
                        <Badge
                          key={partnerId}
                          variant="secondary"
                          className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-900/50 pr-1"
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          {getPartnerDisplayName(partnerId)}
                          <button
                            type="button"
                            onClick={() => handlePartnerRemove(partnerId)}
                            className="ml-1 p-0.5 rounded-full hover:bg-purple-300 dark:hover:bg-purple-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {formData.selectedPartnerIds?.length > 0
                      ? `${formData.selectedPartnerIds.length} partner(s) selected`
                      : "Select one or more courier partners for this zone"}
                  </p>
                  {errors.selectedPartnerIds && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.selectedPartnerIds}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Zone Description *</Label>
              <textarea
                id="description"
                placeholder="Enter detailed zone description"
                value={formData.description}
                onChange={(e) =>
                  updateFormData({ description: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.description ? "border-red-500" : "border-border"
                }`}
                rows={3}
              />
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Legacy Zone Code field - hidden by default */}
            {formData.code && (
              <div className="space-y-2">
                <Label htmlFor="code">Zone Code</Label>
                <Input
                  id="code"
                  placeholder="Enter zone code (e.g., ZONE001)"
                  value={formData.code}
                  onChange={(e) =>
                    updateFormData({ code: e.target.value.toUpperCase() })
                  }
                  className={errors.code ? "border-red-500" : ""}
                />
                {errors.code && (
                  <p className="text-sm text-red-500 mt-1">{errors.code}</p>
                )}
              </div>
            )}

            {/* Zone Type Selection */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Zone Type *
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Zone Wise - Geographical */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.zoneType === "zone-wise"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-600"
                      : "border-border hover:border-gray-400 dark:hover:border-gray-600"
                  }`}
                  onClick={() => updateFormData({ zoneType: "zone-wise" })}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="zoneType"
                      value="zone-wise"
                      checked={formData.zoneType === "zone-wise"}
                      onChange={() => updateFormData({ zoneType: "zone-wise" })}
                      className="h-4 w-4 text-blue-600"
                    />
                    <div className="flex items-center space-x-2">
                      <Map className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="font-medium text-foreground">
                          Zone Wise
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Define zones by geographical areas
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Distance Wise - Active */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    formData.zoneType === "distance-wise"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-600"
                      : "border-border hover:border-gray-400 dark:hover:border-gray-600"
                  }`}
                  onClick={() => updateFormData({ zoneType: "distance-wise" })}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="zoneType"
                      value="distance-wise"
                      checked={formData.zoneType === "distance-wise"}
                      onChange={() =>
                        updateFormData({ zoneType: "distance-wise" })
                      }
                      className="h-4 w-4 text-blue-600"
                    />
                    <div className="flex items-center space-x-2">
                      <Route className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <div className="font-medium text-foreground">
                          Distance Wise
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Define zones by distance slabs
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* <div>
                <Label htmlFor="type">Service Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => updateFormData({ type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-blue-600" />
                        <span>Pickup Only</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="delivery">
                      <div className="flex items-center space-x-2">
                        <Truck className="h-4 w-4 text-green-600" />
                        <span>Delivery Only</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="both">
                      <div className="flex items-center space-x-2">
                        <Navigation className="h-4 w-4 text-purple-600" />
                        <span>Both Services</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status ? "active" : "inactive"}
                  onValueChange={(value) =>
                    updateFormData({ status: value === "active" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Active</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>Inactive</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Coverage Details */}
          <div className="space-y-4">
            <div className="text-sm font-medium">
              {formData.zoneType === "zone-wise"
                ? "Geographical Coverage"
                : "Distance Slabs"}
            </div>

            {/* Zone-wise Geographical Coverage */}
            {formData.zoneType === "zone-wise" && (
              <>
                {/* State Selection - searchable multi-select */}
                <div className="space-y-2">
                  <Label htmlFor="state">States *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="state"
                      placeholder="Search and select states..."
                      value={stateSearch}
                      onChange={(e) => {
                        setStateSearch(e.target.value);
                        setShowStateDropdown(true);
                      }}
                      onFocus={() => setShowStateDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowStateDropdown(false), 200)
                      }
                      disabled={loadingStates || states.length === 0}
                      className={`pl-10 ${errors.selectedStates ? "border-red-500" : ""}`}
                    />
                    {loadingStates && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}

                    {showStateDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {loadingStates ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Loading states...
                          </div>
                        ) : getFilteredStates().length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {stateSearch
                              ? "No matching states found"
                              : formData.selectedStates.length === states.length
                                ? "All states selected"
                                : "No states available"}
                          </div>
                        ) : (
                          getFilteredStates().map((state) => (
                            <button
                              key={state.id}
                              type="button"
                              onClick={() => {
                                handleStateChange(state.id, true);
                                setStateSearch("");
                                setShowStateDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center space-x-2">
                                <MapPin className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">
                                  {state.name}
                                </span>
                                {state.code && (
                                  <span className="text-muted-foreground text-xs">
                                    ({state.code})
                                  </span>
                                )}
                              </div>
                              <Plus className="h-4 w-4 text-blue-600" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {formData.selectedStates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.selectedStates.map((state) => (
                        <Badge
                          key={state.id}
                          variant="secondary"
                          className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 pr-1"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {state.name}
                          <button
                            type="button"
                            onClick={() => handleStateChange(state.id, false)}
                            className="ml-1 p-0.5 rounded-full hover:bg-blue-300 dark:hover:bg-blue-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formData.selectedStates.length > 0
                      ? `${formData.selectedStates.length} state(s) selected`
                      : "Select one or more states to continue"}
                  </p>
                  {errors.selectedStates && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.selectedStates}
                    </p>
                  )}
                </div>

                {/* City Selection - searchable multi-select */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="city">Cities *</Label>
                    {cities.length > 0 &&
                      (() => {
                        const g = cityScopeGroups();
                        return (
                          <div className="flex items-center space-x-2">
                            <ScopedSelectMenu
                              label="Select"
                              sections={[
                                {
                                  label: "All",
                                  options: [
                                    {
                                      key: "all",
                                      label: "All cities",
                                      count: g.all.length,
                                      onSelect: () => addCities(g.all),
                                    },
                                    {
                                      key: "metro",
                                      label: "All metro cities",
                                      count: g.metro.length,
                                      onSelect: () => addCities(g.metro),
                                    },
                                  ],
                                },
                                {
                                  label:
                                    g.byState.length > 1 ? "By state" : null,
                                  options: g.byState.map((grp) => ({
                                    key: grp.key,
                                    label: grp.label,
                                    count: grp.items.length,
                                    onSelect: () => addCities(grp.items),
                                  })),
                                },
                              ]}
                            />
                            <span className="text-xs text-muted-foreground">
                              Filter:
                            </span>
                            <Select
                              value={cityFilter}
                              onValueChange={setCityFilter}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Cities</SelectItem>
                                <SelectItem value="metro">
                                  Metro Only
                                </SelectItem>
                                <SelectItem value="non-metro">
                                  Non-Metro
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })()}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="city"
                      placeholder={
                        !formData.selectedStates.length
                          ? "Select states first"
                          : "Search and select cities..."
                      }
                      value={citySearch}
                      onChange={(e) => {
                        setCitySearch(e.target.value);
                        setShowCityDropdown(true);
                      }}
                      onFocus={() => setShowCityDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowCityDropdown(false), 200)
                      }
                      disabled={
                        !formData.selectedStates.length ||
                        loadingCities ||
                        cities.length === 0
                      }
                      className={`pl-10 ${errors.selectedCities ? "border-red-500" : ""}`}
                    />
                    {loadingCities && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}

                    {showCityDropdown && formData.selectedStates.length > 0 && (
                      <div className="absolute z-40 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {loadingCities ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Loading cities...
                          </div>
                        ) : getFilteredCities().length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {citySearch
                              ? "No matching cities found"
                              : cityFilter !== "all"
                                ? `No ${cityFilter === "metro" ? "metro" : "non-metro"} cities found`
                                : "No cities available"}
                          </div>
                        ) : (
                          getFilteredCities().map((city) => (
                            <button
                              key={city.id}
                              type="button"
                              onClick={() => {
                                handleCityChange(city.id, true);
                                setCitySearch("");
                                setShowCityDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-green-600" />
                                <span className="font-medium">{city.name}</span>
                                {city.isMetro && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Metro
                                  </span>
                                )}
                              </div>
                              <Plus className="h-4 w-4 text-green-600" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {formData.selectedCities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.selectedCities.map((city) => (
                        <Badge
                          key={city.id}
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 pr-1"
                        >
                          <Building className="h-3 w-3 mr-1" />
                          {city.name}
                          {city.isMetro && (
                            <span className="inline-flex items-center px-1.5 py-0.5 ml-1 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
                              Metro
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCityChange(city.id, false)}
                            className="ml-1 p-0.5 rounded-full hover:bg-green-300 dark:hover:bg-green-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formData.selectedCities.length > 0
                      ? `${formData.selectedCities.length} city(ies) selected`
                      : "Select one or more cities to continue"}
                  </p>
                  {errors.selectedCities && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.selectedCities}
                    </p>
                  )}

                  {/* City Statistics */}
                  {cities.length > 0 && (
                    <div className="mt-3 p-3 bg-muted rounded-lg border">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <div className="flex items-center space-x-1">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Total Cities:
                            </span>
                            <span className="font-semibold text-foreground">
                              {cities.length}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span className="text-muted-foreground">
                              Metro:
                            </span>
                            <span className="font-semibold text-foreground">
                              {cities.filter((c) => c.isMetro).length}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            <span className="text-muted-foreground">
                              Non-Metro:
                            </span>
                            <span className="font-semibold text-foreground">
                              {cities.filter((c) => !c.isMetro).length}
                            </span>
                          </div>
                        </div>
                        {formData.selectedCities.length > 0 && (
                          <div className="text-green-600 dark:text-green-400 font-semibold">
                            {formData.selectedCities.length} selected
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Area Selection - searchable multi-select */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="area">Areas (Optional)</Label>
                    {areas.length > 0 &&
                      (() => {
                        const g = areaScopeGroups();
                        return (
                          <ScopedSelectMenu
                            label="Select"
                            sections={[
                              {
                                label: "All",
                                options: [
                                  {
                                    key: "all",
                                    label: "All areas",
                                    count: g.all.length,
                                    onSelect: () => addAreas(g.all),
                                  },
                                ],
                              },
                              {
                                label: g.byCity.length > 1 ? "By city" : null,
                                options: g.byCity.map((grp) => ({
                                  key: grp.key,
                                  label: grp.label,
                                  count: grp.items.length,
                                  onSelect: () => addAreas(grp.items),
                                })),
                              },
                            ]}
                          />
                        );
                      })()}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="area"
                      placeholder={
                        !formData.selectedCities.length
                          ? "Select cities first"
                          : "Search and select areas..."
                      }
                      value={areaSearch}
                      onChange={(e) => {
                        setAreaSearch(e.target.value);
                        setShowAreaDropdown(true);
                      }}
                      onFocus={() => setShowAreaDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowAreaDropdown(false), 200)
                      }
                      disabled={
                        !formData.selectedCities.length ||
                        loadingAreas ||
                        areas.length === 0
                      }
                      className="pl-10"
                    />
                    {loadingAreas && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}

                    {showAreaDropdown && formData.selectedCities.length > 0 && (
                      <div className="absolute z-30 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {loadingAreas ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Loading areas...
                          </div>
                        ) : getFilteredAreas().length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {areaSearch
                              ? "No matching areas found"
                              : "No areas available"}
                          </div>
                        ) : (
                          getFilteredAreas().map((area) => (
                            <button
                              key={area.id}
                              type="button"
                              onClick={() => {
                                handleAreaChange(area.id, true);
                                setAreaSearch("");
                                setShowAreaDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4 text-purple-600" />
                                <span className="font-medium">{area.name}</span>
                              </div>
                              <Plus className="h-4 w-4 text-purple-600" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {formData.selectedAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.selectedAreas.map((area) => (
                        <Badge
                          key={area.id}
                          variant="secondary"
                          className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 pr-1"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {area.name}
                          <button
                            type="button"
                            onClick={() => handleAreaChange(area.id, false)}
                            className="ml-1 p-0.5 rounded-full hover:bg-purple-300 dark:hover:bg-purple-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pincode Selection - searchable multi-select */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pincode">Pincodes *</Label>
                    {pincodes.length > 0 &&
                      (() => {
                        const g = pincodeScopeGroups();
                        return (
                          <ScopedSelectMenu
                            label="Select"
                            sections={[
                              {
                                label: "All",
                                options: [
                                  {
                                    key: "all",
                                    label: "All pincodes",
                                    count: g.all.length,
                                    onSelect: () => addPincodes(g.all),
                                  },
                                ],
                              },
                              {
                                label: g.byArea.length > 1 ? "By area" : null,
                                options: g.byArea.map((grp) => ({
                                  key: grp.key,
                                  label: grp.label,
                                  count: grp.items.length,
                                  onSelect: () => addPincodes(grp.items),
                                })),
                              },
                            ]}
                          />
                        );
                      })()}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="pincode"
                      placeholder={
                        !formData.selectedAreas.length
                          ? "Select areas first"
                          : "Search and select pincodes..."
                      }
                      value={pincodeSearch}
                      onChange={(e) => {
                        setPincodeSearch(e.target.value);
                        setShowPincodeDropdown(true);
                      }}
                      onFocus={() => setShowPincodeDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowPincodeDropdown(false), 200)
                      }
                      disabled={
                        !formData.selectedAreas.length ||
                        loadingPincodes ||
                        pincodes.length === 0
                      }
                      className={`pl-10 ${errors.selectedPincodes ? "border-red-500" : ""}`}
                    />
                    {loadingPincodes && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}

                    {showPincodeDropdown &&
                      formData.selectedAreas.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {loadingPincodes ? (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                              Loading pincodes...
                            </div>
                          ) : getFilteredPincodes().length === 0 ? (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                              {pincodeSearch
                                ? "No matching pincodes found"
                                : "No pincodes available"}
                            </div>
                          ) : (
                            getFilteredPincodes().map((pincode) => (
                              <button
                                key={pincode.id}
                                type="button"
                                onClick={() => {
                                  handlePincodeChange(pincode.id, true);
                                  setPincodeSearch("");
                                  setShowPincodeDropdown(false);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                              >
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-orange-600" />
                                  <span className="font-medium">
                                    {pincode.pincode || pincode.code}
                                  </span>
                                  {pincode.areaName && (
                                    <span className="text-muted-foreground text-xs">
                                      ({pincode.areaName})
                                    </span>
                                  )}
                                </div>
                                <Plus className="h-4 w-4 text-orange-600" />
                              </button>
                            ))
                          )}
                        </div>
                      )}
                  </div>

                  {formData.selectedPincodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.selectedPincodes.map((pincode) => (
                        <Badge
                          key={pincode.id}
                          variant="secondary"
                          className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 pr-1"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {pincode.pincode || pincode.code}
                          <button
                            type="button"
                            onClick={() =>
                              handlePincodeChange(pincode.id, false)
                            }
                            className="ml-1 p-0.5 rounded-full hover:bg-orange-300 dark:hover:bg-orange-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {errors.selectedPincodes && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.selectedPincodes}
                    </p>
                  )}
                </div>

                {/* Manual Pincode Input */}
                <div className="space-y-2">
                  <Label htmlFor="manualPincode">
                    Add Pincodes Manually (Optional)
                  </Label>
                  <div className="relative">
                    <div className="flex space-x-2 mt-2">
                      <div className="flex-1 relative">
                        <Input
                          id="manualPincode"
                          placeholder="Enter 6-digit pincode or search by area name (e.g., 110001 or 'Connaught Place')"
                          value={manualPincodeInput}
                          onChange={(e) =>
                            handlePincodeSearchChange(e.target.value)
                          }
                          onKeyPress={handleManualPincodeKeyPress}
                          className={`w-full ${errors.manualPincodeInput ? "border-red-500" : ""}`}
                          maxLength={50}
                        />
                        {isSearchingPincodes && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addManualPincode}
                        disabled={
                          !manualPincodeInput.trim() ||
                          manualPincodeInput.length !== 6
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Pincode Search Results Dropdown */}
                    {showPincodeSearch && pincodeSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {pincodeSearchResults.map((pincodeData, index) => (
                          <div
                            key={index}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => addPincodeFromSearch(pincodeData)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <MapPin className="h-4 w-4 text-blue-600" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {pincodeData.pincode}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {pincodeData.areaName &&
                                      `${pincodeData.areaName}, `}
                                    {pincodeData.cityName &&
                                      `${pincodeData.cityName}, `}
                                    {pincodeData.stateName}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-400">
                                Click to add
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No results message */}
                    {showPincodeSearch &&
                      pincodeSearchResults.length === 0 &&
                      manualPincodeInput.length >= 3 &&
                      !isSearchingPincodes && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg p-4">
                          <div className="text-center text-gray-500">
                            <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">
                              No pincodes found for "{manualPincodeInput}"
                            </p>
                            <p className="text-xs mt-1">
                              Try entering a 6-digit pincode directly
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                  {errors.manualPincodeInput && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.manualPincodeInput}
                    </p>
                  )}
                  {errors.manualPincodeDuplicate && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.manualPincodeDuplicate}
                    </p>
                  )}

                  {/* Display manually added pincodes */}
                  {formData.manualPincodes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Manually Added Pincodes:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {formData.manualPincodes.map((pincode, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                          >
                            <MapPin className="h-3 w-3" />
                            <span>{pincode}</span>
                            <button
                              type="button"
                              onClick={() => removeManualPincode(pincode)}
                              className="text-blue-600 hover:text-blue-800 ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Distance-wise Form */}
            {formData.zoneType === "distance-wise" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      Define zones based on distance ranges
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDistanceSlab}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Slab</span>
                  </Button>
                </div>

                {errors.distanceSlabs && (
                  <p className="text-sm text-red-500">{errors.distanceSlabs}</p>
                )}

                <div className="space-y-4">
                  {formData.distanceSlabs.map((slab, index) => (
                    <div
                      key={slab.id}
                      className="border border-border rounded-lg p-4 bg-card"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-foreground">
                          Distance Slab {index + 1}
                        </h4>
                        {formData.distanceSlabs.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDistanceSlab(slab.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`slab-name-${slab.id}`}>
                            Zone Name *
                          </Label>
                          <Input
                            id={`slab-name-${slab.id}`}
                            placeholder="e.g., Local Zone, Metro Zone"
                            value={slab.name}
                            onChange={(e) =>
                              updateDistanceSlab(
                                slab.id,
                                "name",
                                e.target.value,
                              )
                            }
                            className={
                              errors[`distanceSlab_${index}_name`]
                                ? "border-red-500"
                                : ""
                            }
                          />
                          {errors[`distanceSlab_${index}_name`] && (
                            <p className="text-sm text-red-500 mt-1">
                              {errors[`distanceSlab_${index}_name`]}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`slab-distance-from-${slab.id}`}>
                            Distance From (km) *
                            {index === 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (must start at 0)
                              </span>
                            )}
                          </Label>
                          <Input
                            id={`slab-distance-from-${slab.id}`}
                            type="number"
                            placeholder={index === 0 ? "0" : "e.g., 10, 25"}
                            value={slab.distanceFrom}
                            onChange={(e) =>
                              updateDistanceSlab(
                                slab.id,
                                "distanceFrom",
                                e.target.value,
                              )
                            }
                            className={
                              errors[`distanceSlab_${index}_distanceFrom`]
                                ? "border-red-500"
                                : index === 0
                                  ? "bg-muted"
                                  : ""
                            }
                            min="0"
                            step="0.1"
                            readOnly={index === 0} // First slab must always start at 0
                          />
                          {errors[`distanceSlab_${index}_distanceFrom`] && (
                            <p className="text-sm text-red-500 mt-1">
                              {errors[`distanceSlab_${index}_distanceFrom`]}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`slab-distance-to-${slab.id}`}>
                            Distance To (km) *
                          </Label>
                          <Input
                            id={`slab-distance-to-${slab.id}`}
                            type="number"
                            placeholder="e.g., 10, 25, 50"
                            value={slab.distanceTo}
                            onChange={(e) =>
                              updateDistanceSlab(
                                slab.id,
                                "distanceTo",
                                e.target.value,
                              )
                            }
                            className={
                              errors[`distanceSlab_${index}_distanceTo`]
                                ? "border-red-500"
                                : ""
                            }
                            min="0"
                            step="0.1"
                          />
                          {errors[`distanceSlab_${index}_distanceTo`] && (
                            <p className="text-sm text-red-500 mt-1">
                              {errors[`distanceSlab_${index}_distanceTo`]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="area">Area (sq km)</Label>
                <Input
                  id="area"
                  placeholder="100"
                  value={formData.area}
                  onChange={(e) => updateFormData({ area: e.target.value })}
                  className={errors.area ? "border-red-500" : ""}
                />
                {errors.area && (
                  <p className="text-sm text-red-500 mt-1">{errors.area}</p>
                )}
              </div>

              <div>
                <Label htmlFor="population">Population</Label>
                <Input
                  id="population"
                  placeholder="1000000"
                  value={formData.population}
                  onChange={(e) =>
                    updateFormData({ population: e.target.value })
                  }
                  className={errors.population ? "border-red-500" : ""}
                />
                {errors.population && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.population}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="density">Population Density</Label>
                <Select
                  value={formData.density}
                  onValueChange={(value) => updateFormData({ density: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select density" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div> */}
          </div>

          <Separator />

          {/* Service Restrictions */}
          {/* <div className="space-y-4">
            <div className="text-sm font-medium">Service Restrictions</div>

            <div>
              <Label htmlFor="weight-limit">Weight Limit (kg)</Label>
              <Input
                id="weight-limit"
                placeholder="25"
                value={formData.weightLimit}
                onChange={(e) =>
                  updateFormData({ weightLimit: e.target.value })
                }
                className={errors.weightLimit ? "border-red-500" : ""}
              />
              {errors.weightLimit && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.weightLimit}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hazardous-allowed"
                  checked={formData.hazardousAllowed}
                  onChange={(e) =>
                    updateFormData({ hazardousAllowed: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="hazardous-allowed" className="text-sm">
                  Allow Hazardous Items
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="fragile-allowed"
                  checked={formData.fragileAllowed}
                  onChange={(e) =>
                    updateFormData({ fragileAllowed: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="fragile-allowed" className="text-sm">
                  Allow Fragile Items
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="liquid-allowed"
                  checked={formData.liquidAllowed || false}
                  onChange={(e) =>
                    updateFormData({ liquidAllowed: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="liquid-allowed" className="text-sm">
                  Allow Liquid Items
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="perishable-allowed"
                  checked={formData.perishableAllowed || false}
                  onChange={(e) =>
                    updateFormData({ perishableAllowed: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="perishable-allowed" className="text-sm">
                  Allow Perishable Items
                </Label>
              </div>
            </div>
          </div> */}

          {/* Form Actions */}
          <div className="flex space-x-2 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || isSubmitting}
            >
              {isLoading || isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Zone"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading || isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
