import { useEffect, useMemo, useState } from "react";
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
import { Loader2, ArrowLeft, CheckCircle2, Edit } from "lucide-react";
import { useUpdatePincodeTypeMutation } from "@/store/api/endpoints/pincodeTypeApi";
import { useGetPincodesByTypeQuery } from "@/store/api/endpoints/pincodeTypeApi";
import {
  usePincodeTypeWizardStore,
  type SelectedPincode,
  type SelectedArea,
  type SelectedCity,
  type SelectedState,
} from "@/store/pincode-type-wizard-store";
import { PincodeTypeWizardStepper } from "./wizard-stepper";
import { Step1States } from "./steps/step-1-states";
import { Step2Cities } from "./steps/step-2-cities";
import { Step3Areas } from "./steps/step-3-areas";
import { Step4Review } from "./steps/step-4-review";

interface PincodeTypeEditWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pincodeType: {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
  };
  onSuccess?: () => void;
}

export function PincodeTypeEditWizardDialog({
  open,
  onOpenChange,
  pincodeType,
  onSuccess,
}: PincodeTypeEditWizardDialogProps) {
  const router = useRouter();
  const [updatePincodeType, { isLoading: isUpdating }] =
    useUpdatePincodeTypeMutation();

  const {
    currentStep,
    nextStep,
    previousStep,
    validateCurrentStep,
    resetWizard,
    initializeFromEdit,
    getFinalPayload,
    selectedPincodes,
  } = usePincodeTypeWizardStore();

  // Track if wizard has been initialized with edit data
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch assigned pincodes for this pincode type
  // The API now returns complete hierarchy: state, area, area.city
  const { data: pincodesData, isLoading: isLoadingPincodes } =
    useGetPincodesByTypeQuery(
      { id: pincodeType.id, page: 1, limit: 1000 },
      { skip: !open },
    );

  // Extract and organize data for initialization
  // Use the pincodes directly from getPincodesByType - they have full hierarchy!
  const editData = useMemo(() => {
    if (!pincodesData?.data || isLoadingPincodes) return null;

    const pincodes = pincodesData.data as any[];
    if (pincodes.length === 0) {
      return {
        name: pincodeType.name,
        description: pincodeType.description,
        isActive: pincodeType.isActive,
        pincodes: [],
        areas: [],
        cities: [],
        states: [],
      };
    }

    const statesMap = new Map<string, SelectedState>();
    const citiesMap = new Map<string, SelectedCity>();
    const areasMap = new Map<string, SelectedArea>();
    const selectedPincodes: SelectedPincode[] = [];

    // Process each pincode from the API response
    // Note: pincodesData.data is an array of pincode objects directly (not wrapped in assignment)
    pincodes.forEach((pincode) => {
      if (!pincode) return;

      // Add pincode
      selectedPincodes.push({
        id: pincode.id,
        code: pincode.code,
        areaId: pincode.areaId,
        areaName: pincode.area?.name || pincode.areaName,
      });

      // Add state if present
      if (pincode.state) {
        if (!statesMap.has(pincode.state.id)) {
          statesMap.set(pincode.state.id, {
            id: pincode.state.id,
            name: pincode.state.name,
            code: pincode.state.code || "",
          });
        }
      }

      // Add area if present
      if (pincode.area) {
        if (!areasMap.has(pincode.area.id)) {
          areasMap.set(pincode.area.id, {
            id: pincode.area.id,
            name: pincode.area.name,
            cityId: pincode.area.cityId || "",
          });
        }

        // Add city from area if present
        if (pincode.area.city) {
          if (!citiesMap.has(pincode.area.city.id)) {
            citiesMap.set(pincode.area.city.id, {
              id: pincode.area.city.id,
              name: pincode.area.city.name,
              stateId: pincode.area.city.stateId || "",
              code: pincode.area.city.code || "",
            });
          }
        }
      }
    });

    return {
      name: pincodeType.name,
      description: pincodeType.description,
      isActive: pincodeType.isActive,
      pincodes: selectedPincodes,
      areas: Array.from(areasMap.values()),
      cities: Array.from(citiesMap.values()),
      states: Array.from(statesMap.values()),
    };
  }, [pincodesData, isLoadingPincodes, pincodeType]);

  // Initialize wizard with existing data when dialog opens and data is loaded
  useEffect(() => {
    if (open && editData) {
      initializeFromEdit(editData);
      setIsInitialized(true); // Mark as initialized AFTER store update
    } else if (!open) {
      setIsInitialized(false); // Reset when dialog closes
    }
  }, [open, editData, initializeFromEdit]);

  // Reset wizard when dialog closes
  useEffect(() => {
    if (!open) {
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
      await updatePincodeType({
        id: pincodeType.id,
        ...payload,
      }).unwrap();

      // Close dialog and trigger success callback
      onOpenChange(false);
      onSuccess?.();

      // Optionally refresh the page data
      router.refresh();
    } catch (error: any) {
      console.error("Failed to update pincode type:", error);
      // Error is handled by the mutation hook
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
      return `Update${selectedPincodes.length > 0 ? ` (${selectedPincodes.length} pincodes)` : ""}`;
    }
    return `Next: ${stepTitles[currentStep]}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-blue-600" />
            <span>Edit Pincode Type Service</span>
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 4: {currentStepTitle}
          </DialogDescription>
        </DialogHeader>

        {isLoadingPincodes || !isInitialized ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading assigned pincodes...
              </p>
            </div>
          </div>
        ) : (
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
        )}

        <DialogFooter className="flex items-center justify-between gap-2 border-t pt-4">
          {/* Previous Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={
              currentStep === 1 ||
              isUpdating ||
              isLoadingPincodes ||
              !isInitialized
            }
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
              disabled={isUpdating || isLoadingPincodes || !isInitialized}
            >
              Cancel
            </Button>

            {currentStep === 4 ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isUpdating || selectedPincodes.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
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
                disabled={isLoadingPincodes || !isInitialized}
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
