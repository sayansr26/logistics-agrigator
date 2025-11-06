"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (_checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    { className, id, defaultChecked, checked, onCheckedChange, ...props },
    ref,
  ) => {
    // Use controlled state from parent via 'checked' prop
    const isChecked = checked !== undefined ? checked : defaultChecked || false;

    return (
      <div
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          isChecked ? "bg-blue-600" : "bg-gray-300",
          className,
        )}
        onClick={(e) => {
          e.preventDefault();
          // Only call the callback, don't change state here
          // Parent component will handle confirmation and update via 'checked' prop
          onCheckedChange?.(!isChecked);
        }}
      >
        <input
          type="checkbox"
          id={id}
          ref={ref}
          checked={isChecked}
          readOnly
          className="sr-only"
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
            isChecked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </div>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
