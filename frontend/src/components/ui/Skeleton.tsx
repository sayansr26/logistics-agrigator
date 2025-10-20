import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width of the skeleton
   * Can be a number (pixels), string with units (e.g., "100%"), or Tailwind class
   */
  width?: number | string;

  /**
   * Height of the skeleton
   * Can be a number (pixels), string with units (e.g., "2rem"), or Tailwind class
   */
  height?: number | string;

  /**
   * Variant of the skeleton animation
   */
  variant?: "pulse" | "wave";

  /**
   * Shape of the skeleton
   */
  shape?: "rect" | "circle" | "rounded";
}

/**
 * Skeleton loading component for showing placeholder content while data loads
 *
 * @example
 * ```tsx
 * // Basic skeleton
 * <Skeleton width="100%" height="20px" />
 *
 * // Circle avatar skeleton
 * <Skeleton shape="circle" width={40} height={40} />
 *
 * // Card skeleton
 * <div className="space-y-3">
 *   <Skeleton width="100%" height="200px" />
 *   <Skeleton width="80%" height="20px" />
 *   <Skeleton width="60%" height="20px" />
 * </div>
 * ```
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      width,
      height,
      variant = "pulse",
      shape = "rounded",
      ...props
    },
    ref,
  ) => {
    const shapeClasses = {
      rect: "",
      circle: "rounded-full",
      rounded: "rounded-md",
    };

    const animationClasses = {
      pulse: "animate-pulse",
      wave: "animate-shimmer",
    };

    const styles: React.CSSProperties = {};

    // Handle width
    if (typeof width === "number") {
      styles.width = `${width}px`;
    } else if (typeof width === "string" && !width.includes(" ")) {
      styles.width = width;
    }

    // Handle height
    if (typeof height === "number") {
      styles.height = `${height}px`;
    } else if (typeof height === "string" && !height.includes(" ")) {
      styles.height = height;
    }

    return (
      <div
        ref={ref}
        style={styles}
        className={cn(
          "bg-gray-200 dark:bg-gray-700",
          shapeClasses[shape],
          animationClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";

/**
 * Pre-built skeleton layouts for common use cases
 */
export const SkeletonLayouts = {
  /**
   * Card skeleton with image and text
   */
  Card: () => (
    <div className="space-y-3">
      <Skeleton width="100%" height="200px" />
      <Skeleton width="80%" height="20px" />
      <Skeleton width="60%" height="16px" />
    </div>
  ),

  /**
   * List item skeleton
   */
  ListItem: () => (
    <div className="flex items-center space-x-4">
      <Skeleton shape="circle" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton width="40%" height="16px" />
        <Skeleton width="60%" height="14px" />
      </div>
    </div>
  ),

  /**
   * Table row skeleton
   */
  TableRow: ({ columns = 4 }: { columns?: number }) => (
    <div className="flex space-x-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="flex-1" height="20px" />
      ))}
    </div>
  ),

  /**
   * Avatar with text skeleton
   */
  Avatar: () => (
    <div className="flex items-center space-x-3">
      <Skeleton shape="circle" width={40} height={40} />
      <div className="space-y-2">
        <Skeleton width="120px" height="14px" />
        <Skeleton width="80px" height="12px" />
      </div>
    </div>
  ),

  /**
   * Dashboard stat card skeleton
   */
  StatCard: () => (
    <div className="space-y-3">
      <Skeleton width="60%" height="16px" />
      <Skeleton width="100%" height="32px" />
      <Skeleton width="40%" height="14px" />
    </div>
  ),
};
