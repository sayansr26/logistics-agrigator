"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { ChargeForm } from "@/components/charges/charge-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateChargePage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(true);

  const handleFormSubmit = (chargeData) => {
    // In a real app, this would save to the backend
    console.log("Creating charge:", chargeData);
    // Redirect back to charges list
    router.push("/charges");
  };

  const handleCancel = () => {
    router.push("/charges");
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[
        { title: "Charges", href: "/charges" },
        { title: "Create Charge", href: "/charges/create" },
      ]}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">
            Create New Charge
          </h1>
          <p className="text-muted-foreground">
            Add a new charge configuration for customer billing and cost
            calculation.
          </p>
        </div>

        {showForm && (
          <ChargeForm onSubmit={handleFormSubmit} onCancel={handleCancel} />
        )}
      </div>
    </DashboardLayout>
  );
}
