import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useCreatePincodeTypeMutation } from "@/store/api/endpoints/pincodeTypeApi";
import { usePincodeTypeWizardStore } from "@/store/pincode-type-wizard-store";
import { PincodeTypeWizardStepper } from "./wizard-stepper";
import { Step1States } from "./steps/step-1-states";
import { Step2Cities } from "./steps/step-2-cities";
import { Step3Areas } from "./steps/step-3-areas";
import { Step4Review } from "./steps/step-4-review";

interface PincodeTypeWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PincodeTypeWizardDialog({
  open,
  onOpenChange,
  onSuccess,
}: PincodeTypeWizardDialogProps) {
  const router = useRouter();
  const [createPincodeType, { isLoading: isCreating }] =
    useCreatePincodeTypeMutation();

  const {
    currentStep,
    nextStep,
    previousStep,
    validateCurrentStep,
    resetWizard,
    getFinalPayload,
    formData,
    selectedPincodes,
  } = usePincodeTypeWizardStore();

  // Reset wizard when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Small delay to avoid visual glitch during close animation
      const timeout = setTimeout(() => resetWizard(), 300);
      return () => clearTimeout(timeout);
    }
  }, [open, resetWizard]);

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    try {
      const payload = getFinalPayload();
      await createPincodeType(payload).unwrap();

      // Close dialog and trigger success callback
      onOpenChange(false);
      onSuccess?.();

      // Optionally refresh the page data
      router.refresh();
    } catch (error: any) {
      console.error("Failed to create pincode type:", error);
      // Error is handled by the mutation hook, but we could add additional handling here
    }
  };

  const handleNext = () => {
    nextStep();
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Step titles for dialog header
  const stepTitles = [
    "Select States",
    "Select Cities",
    "Select Areas",
    "Review & Complete",
  ];

  const currentStepTitle = stepTitles[currentStep - 1];

  // Button text based on step
  const getNextButtonText = () => {
    if (currentStep === 4) {
      return `Create${selectedPincodes.length > 0 ? ` (${selectedPincodes.length} pincodes)` : ""}`;
    }
    return `Next: ${stepTitles[currentStep]}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            <span>Create Pincode Type Service</span>
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 4: {currentStepTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Stepper */}
            <PincodeTypeWizardStepper currentStep={currentStep} />

            {/* Current Step Content */}
            <div className="min-h-[300px]">
              {currentStep === 1 && <Step1States />}
              {currentStep === 2 && <Step2Cities />}
              {currentStep === 3 && <Step3Areas />}
              {currentStep === 4 && <Step4Review />}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t pt-4">
          {/* Previous Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1 || isCreating}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>

            {currentStep === 4 ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isCreating || selectedPincodes.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {getNextButtonText()}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {getNextButtonText()}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
