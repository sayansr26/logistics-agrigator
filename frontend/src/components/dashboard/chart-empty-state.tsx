"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  /** px height so the surrounding card doesn't collapse/jump when a chart has no data. */
  height?: number;
}

/**
 * Deliberate, polished placeholder for a chart with no data yet — used
 * instead of letting recharts render a broken/empty axis. Matches the
 * card's chart-surface footprint so cards don't jump when data arrives.
 */
export function ChartEmptyState({
  icon: Icon,
  title,
  description,
  className,
  height = 240,
}: ChartEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center",
        className,
      )}
      style={{ height }}
    >
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
