"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { ZoneForm } from "@/components/zones/zone-form.jsx";
import { zonesApiService } from "@/services";
import { CheckCircle, XCircle } from "lucide-react";

export default function CreateZonePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    setNotification(null); // Clear any existing notifications

    try {
      // Convert form data to API format
      const zoneData = {
        name: formData.name,
        description: formData.description,
        partnerId: formData.partnerId,
        status: formData.status,
        zoneType: formData.zoneType,
        ...(formData.zoneType === "zone-wise"
          ? {
              geographical: {
                states: formData.geographical.states,
                cities: formData.geographical.cities,
                areas: formData.geographical.areas,
                pincodes: formData.geographical.pincodes,
              },
            }
          : {
              distanceSlabs: formData.distanceSlabs.map((slab) => ({
                name: slab.name,
                distanceFrom: Number(slab.distanceFrom),
                distanceTo: Number(slab.distanceTo),
              })),
            }),
        services: formData.services || [
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
      };

      console.log("Creating zone with data:", zoneData);

      // Call the actual API
      const response = await zonesApiService.createZone(zoneData);

      if (response.success) {
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
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
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
