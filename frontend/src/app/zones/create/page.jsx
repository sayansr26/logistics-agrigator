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
    try {
      // Convert form data to API format
      const zoneData = {
        name: formData.name,
        description: formData.description,
        partnerId: formData.partnerId,
        status: formData.status,
        geographical: {
          states: formData.states
            .split(",")
            .map((s) => parseInt(s.trim()))
            .filter((s) => !isNaN(s)),
          cities: formData.cities
            .split(",")
            .map((c) => parseInt(c.trim()))
            .filter((c) => !isNaN(c)),
          areas: formData.areas
            ? formData.areas
                .split(",")
                .map((a) => parseInt(a.trim()))
                .filter((a) => !isNaN(a))
            : [],
          pincodes: formData.pincodes
            .split(",")
            .map((p) => parseInt(p.trim()))
            .filter((p) => !isNaN(p)),
        },
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
          message: "Zone created successfully!",
        });

        // Redirect to zones list after a short delay
        setTimeout(() => {
          router.push("/zones");
        }, 1500);
      } else {
        throw new Error(response.error?.message || "Failed to create zone");
      }
    } catch (error) {
      console.error("Failed to create zone:", error);
      setNotification({
        type: "error",
        message: `Failed to create zone: ${error.message}`,
      });
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
