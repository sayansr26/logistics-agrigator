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
    const [isChecked, setIsChecked] = React.useState(
      defaultChecked || checked || false,
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.checked;
      setIsChecked(newValue);
      onCheckedChange?.(newValue);
    };

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked);
      }
    }, [checked]);

    return (
      <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input">
        <input
          type="checkbox"
          id={id}
          ref={ref}
          checked={isChecked}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
            isChecked ? "translate-x-5" : "translate-x-0",
            className,
          )}
        />
      </div>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
