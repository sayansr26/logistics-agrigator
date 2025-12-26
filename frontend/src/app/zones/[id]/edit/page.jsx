"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { ZoneForm } from "@/components/zones/zone-form.jsx";
import {
  useGetZoneByIdQuery,
  useUpdateZoneMutation,
} from "@/store/api/endpoints/zonesApi";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function EditZonePage() {
  const router = useRouter();
  const params = useParams();
  const zoneId = params.id;

  const [notification, setNotification] = useState(null);

  // RTK Query - fetch zone data
  const {
    data: zoneResponse,
    isLoading: isLoadingData,
    error: fetchError,
    refetch,
  } = useGetZoneByIdQuery(zoneId);

  // RTK Query - update mutation
  const [updateZone, { isLoading: isUpdating }] = useUpdateZoneMutation();

  // Backend returns zone directly in data field
  const zone = zoneResponse?.data;

  // Convert backend data to form format
  const initialData = useMemo(() => {
    if (!zone) return null;

    const formData = {
      name: zone.name || "",
      description: zone.description || "",
      partnerId: zone.partnerId || "",
      selectedPartnerIds: zone.partnerId ? [zone.partnerId] : [],
      status: zone.status ?? true,
      // Convert backend zoneType to form zoneType
      zoneType: zone.zoneType === "GEOLOGICAL" ? "zone-wise" : "distance-wise",
      selectedStates: [],
      selectedCities: [],
      selectedAreas: [],
      selectedPincodes: [],
      manualPincodes: [],
      services: [],
      // Convert backend milestones to form distanceSlabs
      distanceSlabs:
        zone.milestones?.length > 0
          ? zone.milestones.map((m, index) => ({
              id: index + 1,
              name: m.suffix || "",
              distanceFrom: String(m.minKm),
              distanceTo: String(m.maxKm),
            }))
          : [{ id: 1, name: "", distanceFrom: "0", distanceTo: "" }],
      // Network taxes (empty for now)
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
    };

    return formData;
  }, [zone]);

  const handleSubmit = async (formData) => {
    setNotification(null);

    try {
      // Map frontend zoneType to backend enum
      const backendZoneType =
        formData.zoneType === "zone-wise" ? "GEOLOGICAL" : "DISTANCE";

      // Build update data
      const updateData = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
      };

      // For DISTANCE zones, include milestones if they changed
      if (
        backendZoneType === "DISTANCE" &&
        formData.distanceSlabs?.length > 0
      ) {
        // Note: Milestone updates might need a separate API call
        // For now, we'll just update basic zone info
      }

      console.log("Updating zone with data:", updateData);

      // Call the update API
      const response = await updateZone({
        id: zoneId,
        data: updateData,
      }).unwrap();

      console.log("Zone updated successfully:", response);
      setNotification({
        type: "success",
        message: "Zone updated successfully! Redirecting...",
      });

      // Redirect to zone details after a short delay
      setTimeout(() => {
        router.push(`/zones/${zoneId}`);
      }, 1500);
    } catch (error) {
      console.error("Failed to update zone:", error);
      setNotification({
        type: "error",
        message: `Failed to update zone: ${error.data?.error?.message || error.message || "Unknown error"}`,
      });
      throw error;
    }
  };

  const handleCancel = () => {
    router.push(`/zones/${zoneId}`);
  };

  const handleBackToZones = () => {
    router.push("/zones");
  };

  // Loading state
  if (isLoadingData) {
    return (
      <DashboardLayout
        customBreadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Zone Management", href: "/zones" },
          { title: "Edit Zone" },
        ]}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">Loading zone data...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <DashboardLayout
        customBreadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Zone Management", href: "/zones" },
          { title: "Edit Zone" },
        ]}
      >
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Failed to Load Zone
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {fetchError?.data?.error?.message ||
                  "An error occurred while fetching zone details"}
              </p>
              <div className="flex items-center justify-center space-x-4">
                <Button variant="outline" onClick={handleBackToZones}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Zones
                </Button>
                <Button onClick={refetch}>Try Again</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Zone not found
  if (!zone) {
    return (
      <DashboardLayout
        customBreadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Zone Management", href: "/zones" },
          { title: "Edit Zone" },
        ]}
      >
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Zone Not Found
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The zone you're trying to edit doesn't exist or has been
                removed.
              </p>
              <Button onClick={handleBackToZones}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Zones
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      customBreadcrumbs={[
        { title: "Home", href: "/" },
        { title: "Zone Management", href: "/zones" },
        { title: zone.name, href: `/zones/${zoneId}` },
        { title: "Edit" },
      ]}
    >
      <div className="max-w-4xl mx-auto">
        {/* Notification */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
              notification.type === "success"
                ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Edit Zone</h1>
          <p className="text-muted-foreground">
            Update zone configuration for <strong>{zone.name}</strong>
          </p>
        </div>

        {initialData && (
          <ZoneForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isUpdating}
            title="Edit Zone Configuration"
            description="Update the zone details, coverage area, and service capabilities"
          />
        )}
      </div>
    </DashboardLayout>
  );
}
