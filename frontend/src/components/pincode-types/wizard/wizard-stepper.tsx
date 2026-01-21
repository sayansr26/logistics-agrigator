import { cn } from "@/lib/utils";
import { MapPin, Building2, Map, CheckCircle } from "lucide-react";

interface WizardStepperProps {
  currentStep: number;
}

const steps = [
  {
    title: "Select States",
    icon: MapPin,
    description: "Choose one or more states",
  },
  {
    title: "Select Cities",
    icon: Building2,
    description: "Choose cities from selected states",
  },
  {
    title: "Select Areas",
    icon: Map,
    description: "Choose areas from selected cities",
  },
  {
    title: "Review & Pincodes",
    icon: CheckCircle,
    description: "Select pincodes and complete",
  },
];

export function PincodeTypeWizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="w-full">
      {/* Step Number Indicator */}
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isCompleted = currentStep > stepNumber;
          const isPending = currentStep < stepNumber;

          return (
            <div
              key={step.title}
              className="flex flex-col items-center flex-1 relative"
            >
              {/* Step Circle */}
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors z-10",
                  isActive &&
                    "bg-blue-600 text-white shadow-lg shadow-blue-200",
                  isCompleted && "bg-green-600 text-white",
                  isPending && "bg-gray-100 text-gray-400",
                )}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Step Title */}
              <span
                className={cn(
                  "text-sm font-medium text-center transition-colors",
                  isActive && "text-blue-600 font-semibold",
                  isCompleted && "text-green-600",
                  isPending && "text-gray-400",
                )}
              >
                {step.title}
              </span>

              {/* Progress Line (connector) */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-1/2 w-1/2 h-0.5 top-5 -z-10 transition-colors",
                    isCompleted ? "bg-green-500" : "bg-gray-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Step Description */}
      <div className="text-center py-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
          {steps[currentStep - 1]?.description}
        </p>
      </div>

      {/* Step Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              currentStep === 1 && "bg-blue-600 w-1/4",
              currentStep === 2 && "bg-blue-600 w-2/4",
              currentStep === 3 && "bg-blue-600 w-3/4",
              currentStep === 4 && "bg-green-600 w-full",
            )}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 text-center">
          Step {currentStep} of 4
        </p>
      </div>
    </div>
  );
}
