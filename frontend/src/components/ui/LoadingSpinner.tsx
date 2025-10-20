import React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Size of the spinner
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /**
   * Color variant of the spinner
   */
  variant?: "primary" | "secondary" | "white" | "inherit";

  /**
   * Label text to display below the spinner
   */
  label?: string;

  /**
   * Whether to show the label
   */
  showLabel?: boolean;
}

const sizeClasses = {
  xs: "w-4 h-4 border-2",
  sm: "w-6 h-6 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-12 h-12 border-4",
  xl: "w-16 h-16 border-4",
};

const variantClasses = {
  primary: "border-blue-600 border-t-transparent",
  secondary: "border-gray-600 border-t-transparent",
  white: "border-white border-t-transparent",
  inherit: "border-current border-t-transparent",
};

/**
 * Circular loading spinner component
 *
 * @example
 * ```tsx
 * // Basic spinner
 * <LoadingSpinner />
 *
 * // Large spinner with label
 * <LoadingSpinner size="lg" label="Loading data..." showLabel />
 *
 * // White spinner for dark backgrounds
 * <LoadingSpinner variant="white" />
 * ```
 */
export const LoadingSpinner = React.forwardRef<
  HTMLDivElement,
  LoadingSpinnerProps
>(
  (
    {
      className,
      size = "md",
      variant = "primary",
      label = "Loading...",
      showLabel = false,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center gap-2",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "rounded-full animate-spin",
            sizeClasses[size],
            variantClasses[variant],
          )}
          role="status"
          aria-label={label}
        />
        {showLabel && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {label}
          </span>
        )}
      </div>
    );
  },
);

LoadingSpinner.displayName = "LoadingSpinner";

/**
 * Inline loading spinner for buttons and text
 */
export const InlineSpinner: React.FC<{
  size?: "xs" | "sm" | "md";
  className?: string;
}> = ({ size = "sm", className }) => {
  const inlineSizes = {
    xs: "w-3 h-3 border",
    sm: "w-4 h-4 border-2",
    md: "w-5 h-5 border-2",
  };

  return (
    <div
      className={cn(
        "inline-block rounded-full animate-spin border-current border-t-transparent",
        inlineSizes[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
};

/**
 * Dots loading indicator
 */
export const LoadingDots: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div
      className={cn("flex items-center justify-center space-x-1", className)}
    >
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
    </div>
  );
};

/**
 * Pulse loading indicator (for live updates)
 */
export const LoadingPulse: React.FC<{
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({ size = "md", className }) => {
  const pulseSizes = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div className={cn("rounded-full bg-blue-600", pulseSizes[size])} />
      <div
        className={cn(
          "absolute rounded-full bg-blue-600 animate-ping opacity-75",
          pulseSizes[size],
        )}
      />
    </div>
  );
};
