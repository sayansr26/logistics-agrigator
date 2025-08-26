"use client";

import { useEffect, useState } from "react";
import { CreateShipmentLayout } from "@/components/shipments/create/layout";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { DocketInformation } from "./docket/docket-information";
import { DeliveryLocation } from "./delivery/delivery-location";
import { InvoiceDetails } from "./invoice/invoice-details";
import { DimensionsForm } from "./dimensions/dimensions-form";
import { ReviewForm } from "./review/review-form";

export default function CreateShipmentPage() {
  const { currentStep, setStep } = useShipmentFormStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Remove URL redirection - we want to show the stepper on the main page

  const handleStepChange = (step: number) => {
    setStep(step);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <DocketInformation />;
      case 2:
        return <DeliveryLocation />;
      case 3:
        return <InvoiceDetails />;
      case 4:
        return <DimensionsForm />;
      case 5:
        return <ReviewForm />;
      default:
        return <DocketInformation />;
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <CreateShipmentLayout
      currentStep={currentStep}
      onStepChange={handleStepChange}
    >
      {renderStepContent()}
    </CreateShipmentLayout>
  );
}
