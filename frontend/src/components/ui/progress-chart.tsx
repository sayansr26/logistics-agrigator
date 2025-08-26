import React from "react";
import { cn } from "@/lib/utils";

interface ProgressChartProps {
  data: Array<{
    label: string;
    value: number;
    maxValue: number;
    color?: string;
    percentage?: number;
  }>;
  showValues?: boolean;
  showPercentages?: boolean;
  className?: string;
}

export function ProgressChart({
  data,
  showValues = true,
  showPercentages = true,
  className,
}: ProgressChartProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {data.map((item, index) => {
        const percentage =
          item.percentage ?? (item.value / item.maxValue) * 100;
        const color = item.color ?? "bg-blue-500";

        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <div className="flex items-center space-x-2">
                {showValues && (
                  <span className="text-muted-foreground">
                    {item.value.toLocaleString()}
                  </span>
                )}
                {showPercentages && (
                  <span className="font-semibold text-foreground">
                    {percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 shadow-inner">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-500 ease-out shadow-sm",
                  color,
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
    maxValue: number;
    color?: string;
    height?: number;
  }>;
  orientation?: "horizontal" | "vertical";
  showValues?: boolean;
  className?: string;
}

export function BarChart({
  data,
  orientation = "horizontal",
  showValues = true,
  className,
}: BarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value));

  if (orientation === "vertical") {
    return (
      <div
        className={cn(
          "flex items-end justify-center space-x-6 h-64 px-4",
          className,
        )}
      >
        {data.map((item, index) => {
          const height = (item.value / maxValue) * 100;
          const color =
            item.color ?? "bg-gradient-to-t from-blue-600 to-blue-500";

          return (
            <div key={index} className="flex flex-col items-center space-y-3">
              <div className="relative group">
                {/* Value tooltip */}
                {showValues && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      {item.value} shipments
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}

                {/* Bar */}
                <div
                  className={cn(
                    "w-12 rounded-t-lg transition-all duration-500 ease-out shadow-md hover:shadow-lg",
                    color,
                    "hover:scale-105 transform",
                  )}
                  style={{ height: `${Math.max(height, 8)}%` }}
                />

                {/* Value label above bar */}
                {showValues && (
                  <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-foreground bg-white px-1 rounded">
                    {item.value}
                  </span>
                )}
              </div>

              {/* Courier name */}
              <div className="text-center">
                <span className="text-sm font-medium text-foreground block">
                  {item.label.split(" ")[0]}
                </span>
                {item.label.includes(" ") && (
                  <span className="text-xs text-muted-foreground block">
                    {item.label.split(" ").slice(1).join(" ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {data.map((item, index) => {
        const width = (item.value / maxValue) * 100;
        const color =
          item.color ?? "bg-gradient-to-r from-blue-600 to-blue-500";

        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              {showValues && (
                <span className="text-muted-foreground font-medium">
                  {item.value.toLocaleString()}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 shadow-inner">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-500 ease-out shadow-sm",
                  color,
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  color = "text-blue-600",
  className,
}: MetricCardProps) {
  return (
    <div className={cn("p-6 bg-white rounded-lg border shadow-sm", className)}>
      <div className="flex items-center space-x-2">
        {Icon && <Icon className={cn("h-8 w-8", color)} />}
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {change && (
            <div className="flex items-center text-sm">
              <span
                className={cn(
                  "flex items-center",
                  change.isPositive ? "text-green-600" : "text-red-600",
                )}
              >
                {change.isPositive ? "↗" : "↘"}
                {Math.abs(change.value)}%
              </span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
