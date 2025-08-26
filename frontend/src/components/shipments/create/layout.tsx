"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Save, Send, ArrowLeft } from "lucide-react";
import { CreateShipmentStepper } from "./stepper";
import { useShipmentFormStore } from "@/store/shipment-form-store";

interface CreateShipmentLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  onStepChange: (_step: number) => void;
}

export function CreateShipmentLayout({
  children,
  currentStep,
  onStepChange,
}: CreateShipmentLayoutProps) {
  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: "Create Shipment" },
  ];

  const handleNext = () => {
    // In real app, this would validate the current step
    if (currentStep < 5) {
      onStepChange(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button> */}
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Create New Shipment
              </h1>
              <p className="text-muted-foreground mt-2">
                Fill in the details below to create a new shipment
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                const { resetForm } = useShipmentFormStore.getState();
                resetForm();
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Reset Form
            </Button>
            <Button variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            {currentStep === 5 ? (
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4 mr-2" />
                Create Shipment
              </Button>
            ) : (
              <Button onClick={handleNext}>Next Step</Button>
            )}
          </div>
        </div>

        {/* Stepper */}
        <CreateShipmentStepper
          currentStep={currentStep}
          onStepClick={onStepChange}
        />

        {/* Content */}
        <div className="mt-8">{children}</div>
      </div>
    </DashboardLayout>
  );
}
