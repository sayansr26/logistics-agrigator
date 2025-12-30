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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  // Fetch cities for multiple states with better error handling
  const fetchCitiesForStates = async (selectedStates) => {
    setLoadingCities(true);
    try {
      // Set the access token before making the API call
      if (accessToken) {
        geographicalApiService.setAccessToken(accessToken);
      }

      // Limit concurrent requests to prevent overwhelming the system
      const maxConcurrentRequests = 3;
      const allCities = [];

      // Process states in batches to prevent memory issues
      for (let i = 0; i < selectedStates.length; i += maxConcurrentRequests) {
        const batch = selectedStates.slice(i, i + maxConcurrentRequests);

        try {
          // Add timeout protection
          const cityPromises = batch.map((state) =>
            Promise.race([
              geographicalApiService.getCitiesByState(state.id),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timeout")), 10000),
              ),
            ]),
          );

          const responses = await Promise.allSettled(cityPromises);

          responses.forEach((result, index) => {
            if (
              result.status === "fulfilled" &&
              result.value.status === "success" &&
              result.value.data
            ) {
              allCities.push(...result.value.data);
            } else {
              const error =
                result.status === "rejected"
                  ? result.reason
                  : result.value.error;
              console.error(
                `Failed to fetch cities for state ${batch[index].name}:`,
                error,
              );
            }
          });

          // Small delay between batches to prevent overwhelming the system
          if (i + maxConcurrentRequests < selectedStates.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (batchError) {
          console.error(
            `Error in batch ${i}-${i + maxConcurrentRequests}:`,
            batchError,
          );
        }
      }

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

      // Fetch areas for all selected cities
      const areaPromises = selectedCities.map((city) =>
        geographicalApiService.getAreasByCity(city.id),
      );

      const responses = await Promise.all(areaPromises);
      const allAreas = [];

      responses.forEach((response, index) => {
        if (response.status === "success" && response.data) {
          allAreas.push(...response.data);
        } else {
          console.error(
            `Failed to fetch areas for city ${selectedCities[index].name}:`,
            response.error,
          );
        }
      });

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

      // Fetch pincodes for all selected areas
      const pincodePromises = selectedAreas.map((area) =>
        geographicalApiService.getPincodesByArea(area.id),
      );

      const responses = await Promise.all(pincodePromises);
      const allPincodes = [];

      responses.forEach((response, index) => {
        if (response.status === "success" && response.data) {
          allPincodes.push(...response.data);
        } else {
          console.error(
            `Failed to fetch pincodes for area ${selectedAreas[index].name}:`,
            response.error,
          );
        }
      });

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

    // Partner validation based on zone type
    if (formData.zoneType === "zone-wise" && !formData.partnerId) {
      newErrors.partnerId =
        "Partner selection is required for geographical zones";
    }

    if (formData.zoneType === "distance-wise") {
      if (
        !formData.selectedPartnerIds ||
        formData.selectedPartnerIds.length === 0
      ) {
        newErrors.selectedPartnerIds =
          "At least one partner is required for distance zones";
      }
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
                  pincodes: formData.selectedPincodes.map(
                    (pincode) => pincode.id,
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
    const state = states.find((s) => s.id === parseInt(stateId));
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
    const city = cities.find((c) => c.id === parseInt(cityId));
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
    const area = areas.find((a) => a.id === parseInt(areaId));
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
    const pincode = pincodes.find((p) => p.id === parseInt(pincodeId));
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
  const getFilteredCities = () => {
    if (!cities || cities.length === 0) return [];

    switch (cityFilter) {
      case "metro":
        return cities.filter((city) => city.isMetro === true);
      case "non-metro":
        return cities.filter((city) => city.isMetro === false);
      default:
        return cities;
    }
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
                  Courier Partner
                  {formData.zoneType === "distance-wise" ? "s" : ""} *
                  {formData.zoneType === "distance-wise" && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Select multiple)
                    </span>
                  )}
                </Label>

                {/* Single select for Geological zones */}
                {formData.zoneType === "zone-wise" && (
                  <>
                    <Select
                      value={formData.partnerId}
                      onValueChange={(value) =>
                        updateFormData({ partnerId: value })
                      }
                      disabled={loadingPartners || partners.length === 0}
                    >
                      <SelectTrigger
                        className={errors.partnerId ? "border-red-500" : ""}
                      >
                        <SelectValue
                          placeholder={
                            loadingPartners
                              ? "Loading partners..."
                              : partners.length === 0
                                ? "No partners available"
                                : "Select a courier partner"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingPartners ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">
                              Loading partners...
                            </span>
                          </div>
                        ) : partners.length === 0 ? (
                          <div className="flex items-center justify-center py-4">
                            <span className="text-sm text-muted-foreground">
                              No partners available
                            </span>
                          </div>
                        ) : (
                          partners.map((partner) => (
                            <SelectItem key={partner.id} value={partner.id}>
                              <div className="flex items-center space-x-2">
                                <Truck className="h-4 w-4 text-blue-600" />
                                <span>{partner.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({partner.code})
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {errors.partnerId && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.partnerId}
                      </p>
                    )}
                  </>
                )}

                {/* Multi-select for Distance zones - Chips UI */}
                {formData.zoneType === "distance-wise" && (
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
                )}
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
                {/* Zone Wise - Coming Soon */}
                <div
                  className="border-2 rounded-lg p-4 cursor-not-allowed transition-all border-border opacity-50 relative"
                  title="Coming Soon"
                >
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-yellow-500 text-yellow-900 px-2 py-0.5 rounded-full font-medium">
                      Coming Soon
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="zoneType"
                      value="zone-wise"
                      checked={false}
                      disabled
                      className="h-4 w-4 text-gray-400"
                    />
                    <div className="flex items-center space-x-2">
                      <Map className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-muted-foreground">
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
                {/* State Selection */}
                <div className="space-y-2">
                  <Label htmlFor="state">States *</Label>
                  <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                    {loadingStates ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading states...</span>
                      </div>
                    ) : states.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No states available (Debug: states.length ={" "}
                        {states.length})
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {states.map((state) => (
                          <div
                            key={state.id}
                            className="flex items-center space-x-3"
                          >
                            <input
                              type="checkbox"
                              id={`state-${state.id}`}
                              checked={formData.selectedStates.some(
                                (s) => s.id === state.id,
                              )}
                              onChange={(e) =>
                                handleStateChange(state.id, e.target.checked)
                              }
                              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label
                              htmlFor={`state-${state.id}`}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <MapPin className="h-4 w-4 text-blue-600" />
                              <span className="text-sm">{state.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({state.code})
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.selectedStates.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        Selected:{" "}
                        {formData.selectedStates.map((s) => s.name).join(", ")}
                      </p>
                    </div>
                  )}
                  {errors.selectedStates && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.selectedStates}
                    </p>
                  )}
                </div>

                {/* City Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="city">Cities *</Label>
                    {cities.length > 0 && (
                      <div className="flex items-center space-x-2">
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
                            <SelectItem value="metro">Metro Only</SelectItem>
                            <SelectItem value="non-metro">Non-Metro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                    {!formData.selectedStates.length ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Select states first
                      </div>
                    ) : loadingCities ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading cities...</span>
                      </div>
                    ) : cities.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No cities available
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {getFilteredCities().map((city) => (
                          <div
                            key={city.id}
                            className="flex items-center space-x-3"
                          >
                            <input
                              type="checkbox"
                              id={`city-${city.id}`}
                              checked={formData.selectedCities.some(
                                (c) => c.id === city.id,
                              )}
                              onChange={(e) =>
                                handleCityChange(city.id, e.target.checked)
                              }
                              className="h-4 w-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <label
                              htmlFor={`city-${city.id}`}
                              className="flex items-center space-x-2 cursor-pointer flex-1"
                            >
                              <Building className="h-4 w-4 text-green-600" />
                              <span className="text-sm">{city.name}</span>
                              {city.isMetro && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Metro
                                </span>
                              )}
                              {city.population && (
                                <span className="text-xs text-muted-foreground">
                                  ({city.population.toLocaleString()})
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                        {getFilteredCities().length === 0 &&
                          cityFilter !== "all" && (
                            <div className="text-center py-4 text-muted-foreground">
                              No{" "}
                              {cityFilter === "metro" ? "metro" : "non-metro"}{" "}
                              cities found
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                  {formData.selectedCities.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-2">
                        Selected Cities ({formData.selectedCities.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {formData.selectedCities.map((city) => (
                          <div
                            key={city.id}
                            className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                          >
                            <Building className="h-3 w-3" />
                            <span>{city.name}</span>
                            {city.isMetro && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
                                Metro
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCityChange(city.id, false)}
                              className="text-green-600 hover:text-green-800 ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {errors.selectedCities && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.selectedCities}
                    </p>
                  )}

                  {/* City Statistics */}
                  {cities.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Building className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600">Total Cities:</span>
                            <span className="font-medium">{cities.length}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span className="text-gray-600">Metro:</span>
                            <span className="font-medium">
                              {cities.filter((c) => c.isMetro).length}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            <span className="text-gray-600">Non-Metro:</span>
                            <span className="font-medium">
                              {cities.filter((c) => !c.isMetro).length}
                            </span>
                          </div>
                        </div>
                        {formData.selectedCities.length > 0 && (
                          <div className="text-green-600 font-medium">
                            {formData.selectedCities.length} selected
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Area Selection */}
                <div className="space-y-2">
                  <Label htmlFor="area">Areas (Optional)</Label>
                  <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                    {!formData.selectedCities.length ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Select cities first
                      </div>
                    ) : loadingAreas ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading areas...</span>
                      </div>
                    ) : areas.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No areas available
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {areas.map((area) => (
                          <div
                            key={area.id}
                            className="flex items-center space-x-3"
                          >
                            <input
                              type="checkbox"
                              id={`area-${area.id}`}
                              checked={formData.selectedAreas.some(
                                (a) => a.id === area.id,
                              )}
                              onChange={(e) =>
                                handleAreaChange(area.id, e.target.checked)
                              }
                              className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <label
                              htmlFor={`area-${area.id}`}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <Users className="h-4 w-4 text-purple-600" />
                              <span className="text-sm">{area.name}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.selectedAreas.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        Selected:{" "}
                        {formData.selectedAreas.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pincode Selection */}
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincodes *</Label>
                  <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                    {!formData.selectedAreas.length ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Select areas first
                      </div>
                    ) : loadingPincodes ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading pincodes...</span>
                      </div>
                    ) : pincodes.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No pincodes available
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pincodes.map((pincode) => (
                          <div
                            key={pincode.id}
                            className="flex items-center space-x-3"
                          >
                            <input
                              type="checkbox"
                              id={`pincode-${pincode.id}`}
                              checked={formData.selectedPincodes.some(
                                (p) => p.id === pincode.id,
                              )}
                              onChange={(e) =>
                                handlePincodeChange(
                                  pincode.id,
                                  e.target.checked,
                                )
                              }
                              className="h-4 w-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <label
                              htmlFor={`pincode-${pincode.id}`}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <MapPin className="h-4 w-4 text-orange-600" />
                              <span className="text-sm">{pincode.pincode}</span>
                              {pincode.areaName && (
                                <span className="text-xs text-muted-foreground">
                                  ({pincode.areaName})
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.selectedPincodes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        Selected:{" "}
                        {formData.selectedPincodes
                          .map((p) => p.pincode)
                          .join(", ")}
                      </p>
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
