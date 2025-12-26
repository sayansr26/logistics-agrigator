"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { ZoneForm } from "@/components/zones/zone-form.jsx";
import { zonesApiService } from "@/services";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, XCircle } from "lucide-react";

export default function CreateZonePage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    setNotification(null); // Clear any existing notifications

    try {
      // Map frontend zoneType to backend enum
      const backendZoneType =
        formData.zoneType === "zone-wise" ? "GEOLOGICAL" : "DISTANCE";

      // Convert form data to API format matching new backend schema
      const zoneData = {
        name: formData.name,
        description: formData.description,
        status: formData.status, // Backend expects 'status' not 'isActive'
        zoneType: backendZoneType,
      };

      // Add type-specific data
      if (backendZoneType === "GEOLOGICAL") {
        // For geological zones, use partnerId (singular)
        zoneData.partnerId = formData.partnerId;
        zoneData.geographical = {
          states: formData.selectedStates?.map((s) => s.id) || [],
          cities: formData.selectedCities?.map((c) => c.id) || [],
          areas: formData.selectedAreas?.map((a) => a.id) || [],
          pincodes: formData.selectedPincodes?.map((p) => p.id) || [],
        };
      } else {
        // For distance zones, use partnerIds (array) - backend requires this
        // Support both single partnerId and multiple selectedPartnerIds
        if (
          formData.selectedPartnerIds &&
          formData.selectedPartnerIds.length > 0
        ) {
          zoneData.partnerIds = formData.selectedPartnerIds;
        } else if (formData.partnerId) {
          zoneData.partnerIds = [formData.partnerId];
        } else {
          zoneData.partnerIds = [];
        }
        // Convert distanceSlabs to milestones (backend only accepts minKm and maxKm)
        // suffix and sortOrder are generated server-side
        zoneData.milestones = formData.distanceSlabs.map((slab) => ({
          minKm: Number(slab.distanceFrom),
          maxKm: Number(slab.distanceTo),
        }));
      }

      console.log("Creating zone with data:", zoneData);

      // Set access token before making API call
      if (accessToken) {
        zonesApiService.setAccessToken(accessToken);
      }

      // Call the actual API
      const response = await zonesApiService.createZone(zoneData);

      // Backend returns { status: "success", data: {...} }
      if (response.status === "success" || response.success) {
        console.log("Zone created successfully:", response.data);
        setNotification({
          type: "success",
          message: "Zone created successfully! Redirecting to zones list...",
        });

        // Redirect to zones list after a short delay to show success message
        setTimeout(() => {
          router.push("/zones");
        }, 2000);
      } else {
        throw new Error(response.error?.message || "Failed to create zone");
      }
    } catch (error) {
      console.error("Failed to create zone:", error);
      setNotification({
        type: "error",
        message: `Failed to create zone: ${error.message}`,
      });
      // Re-throw the error so the form can handle it
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/zones");
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[
        { title: "Zone Management", href: "/zones" },
        { title: "Create Zone", href: "/zones/create" },
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
          <h1 className="text-3xl font-bold text-foreground">
            Create New Zone
          </h1>
          <p className="text-muted-foreground">
            Configure a new delivery zone with coverage areas and service
            restrictions.
          </p>
        </div>

        <ZoneForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
          title="New Zone Configuration"
          description="Define the zone details, coverage area, and service capabilities"
        />
      </div>
    </DashboardLayout>
  );
}
