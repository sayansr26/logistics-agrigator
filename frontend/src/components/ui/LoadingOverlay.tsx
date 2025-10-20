import React from "react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "./LoadingSpinner";
import { createPortal } from "react-dom";

interface LoadingOverlayProps {
  /**
   * Whether the overlay is visible
   */
  isLoading: boolean;

  /**
   * Loading message to display
   */
  message?: string;

  /**
   * Size of the spinner
   */
  spinnerSize?: "xs" | "sm" | "md" | "lg" | "xl";

  /**
   * Whether to blur the background
   */
  blur?: boolean;

  /**
   * Whether the overlay covers the full screen or is relative to parent
   */
  fullScreen?: boolean;

  /**
   * Custom className for the overlay container
   */
  className?: string;

  /**
   * Z-index for the overlay
   */
  zIndex?: number;
}

/**
 * Loading overlay component that can cover full screen or container
 *
 * @example
 * ```tsx
 * // Full screen overlay
 * <LoadingOverlay
 *   isLoading={isSubmitting}
 *   message="Saving changes..."
 *   fullScreen
 * />
 *
 * // Container overlay (parent must have position: relative)
 * <div className="relative">
 *   <LoadingOverlay isLoading={isLoading} message="Loading data..." />
 *   <YourContent />
 * </div>
 *
 * // With blur effect
 * <LoadingOverlay
 *   isLoading={true}
 *   blur
 *   message="Processing payment..."
 * />
 * ```
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message,
  spinnerSize = "lg",
  blur = false,
  fullScreen = false,
  className,
  zIndex = 50,
}) => {
  if (!isLoading) return null;

  const overlayContent = (
    <div
      className={cn(
        "flex items-center justify-center",
        "bg-white/80 dark:bg-gray-900/80",
        blur && "backdrop-blur-sm",
        fullScreen ? "fixed inset-0" : "absolute inset-0",
        className,
      )}
      style={{ zIndex }}
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <LoadingSpinner size={spinnerSize} />
        {message && (
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {message}
          </p>
        )}
      </div>
    </div>
  );

  // Use portal for full-screen overlays to ensure proper stacking
  if (fullScreen && typeof document !== "undefined") {
    return createPortal(overlayContent, document.body);
  }

  return overlayContent;
};

/**
 * Inline loading state for sections (no overlay)
 */
export const LoadingSection: React.FC<{
  message?: string;
  spinnerSize?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}> = ({ message = "Loading...", spinnerSize = "md", className }) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12",
        className,
      )}
    >
      <LoadingSpinner size={spinnerSize} showLabel label={message} />
    </div>
  );
};

/**
 * Skeleton loading state for data tables
 */
export const LoadingTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className }) => {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Table header skeleton */}
      <div className="flex space-x-4 border-b pb-2">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex space-x-4 py-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className="flex-1">
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Page loading skeleton with header and content
 */
export const LoadingPage: React.FC<{
  hasHeader?: boolean;
  hasSidebar?: boolean;
  className?: string;
}> = ({ hasHeader = true, hasSidebar = false, className }) => {
  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Header skeleton */}
      {hasHeader && (
        <div className="space-y-4">
          <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>
      )}

      {/* Content skeleton */}
      <div className={cn("space-y-4", hasSidebar && "grid grid-cols-4 gap-6")}>
        {hasSidebar && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
              />
            ))}
          </div>
        )}

        <div className={cn("space-y-6", hasSidebar && "col-span-3")}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
