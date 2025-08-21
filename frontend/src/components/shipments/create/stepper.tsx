import { cn } from "@/lib/utils";
import { Package, MapPin, FileText, Box, CheckCircle } from "lucide-react";

interface StepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const steps = [
  {
    title: "Docket Information",
    icon: Package,
    path: "/shipments/create/docket",
  },
  {
    title: "Delivery Location",
    icon: MapPin,
    path: "/shipments/create/delivery",
  },
  {
    title: "Invoices",
    icon: FileText,
    path: "/shipments/create/invoice",
  },
  {
    title: "Dimensions",
    icon: Box,
    path: "/shipments/create/dimensions",
  },
  {
    title: "Review",
    icon: CheckCircle,
    path: "/shipments/create/review",
  },
];

export function CreateShipmentStepper({
  currentStep,
  onStepClick,
}: StepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === index + 1;
          const isCompleted = currentStep > index + 1;
          const isClickable = onStepClick && isCompleted;

          return (
            <div
              key={step.title}
              className="flex flex-col items-center flex-1 relative"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors",
                  isActive && "bg-blue-600 text-white",
                  isCompleted && "bg-green-600 text-white",
                  !isActive && !isCompleted && "bg-gray-200 text-gray-500",
                  isClickable && "cursor-pointer hover:opacity-80",
                )}
                onClick={() => isClickable && onStepClick(index + 1)}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  "text-sm font-medium text-center",
                  isActive && "text-blue-600",
                  isCompleted && "text-green-600",
                  !isActive && !isCompleted && "text-gray-500",
                )}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-1/2 w-1/2 h-0.5 top-5 -z-10",
                    isCompleted ? "bg-green-600" : "bg-gray-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
