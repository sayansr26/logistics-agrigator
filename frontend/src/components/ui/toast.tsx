/**
 * Toast Notification Component
 *
 * Displays toast notifications from Redux UI slice
 * Auto-dismisses after specified duration
 */

"use client";

import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addNotification,
  removeNotification,
  selectNotifications,
} from "@/store/slices/uiSlice";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast Container Component
 *
 * Renders all active notifications in a fixed position
 */
export function ToastContainer() {
  const notifications = useAppSelector(selectNotifications);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

/**
 * Individual Toast Component
 */
interface ToastProps {
  notification: {
    id: string;
    type: "success" | "error" | "warning" | "info";
    message: string;
    duration?: number;
  };
}

function Toast({ notification }: ToastProps) {
  const dispatch = useAppDispatch();

  // Auto-dismiss after duration
  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        dispatch(removeNotification(notification.id));
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, dispatch]);

  const handleClose = () => {
    dispatch(removeNotification(notification.id));
  };

  // Icon and colors based on type
  const typeConfig = {
    success: {
      icon: CheckCircle,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-800",
      iconColor: "text-green-600",
    },
    error: {
      icon: XCircle,
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-800",
      iconColor: "text-red-600",
    },
    warning: {
      icon: AlertCircle,
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      textColor: "text-yellow-800",
      iconColor: "text-yellow-600",
    },
    info: {
      icon: Info,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-800",
      iconColor: "text-blue-600",
    },
  };

  const config = typeConfig[notification.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-right duration-300",
        config.bgColor,
        config.borderColor,
      )}
      role="alert"
    >
      {/* Icon */}
      <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.iconColor)} />

      {/* Message */}
      <div className={cn("flex-1 text-sm font-medium", config.textColor)}>
        {notification.message}
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className={cn(
          "flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors",
          config.textColor,
        )}
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Hook to show toast notifications
 *
 * Usage:
 * const toast = useToast();
 * toast.success("Operation successful");
 * toast.error("Something went wrong");
 */
export function useToast() {
  const dispatch = useAppDispatch();

  return {
    success: (message: string, duration = 4000) => {
      dispatch(
        addNotification({
          type: "success",
          message,
          duration,
        }),
      );
    },

    error: (message: string, duration = 6000) => {
      dispatch(
        addNotification({
          type: "error",
          message,
          duration,
        }),
      );
    },

    warning: (message: string, duration = 5000) => {
      dispatch(
        addNotification({
          type: "warning",
          message,
          duration,
        }),
      );
    },

    info: (message: string, duration = 4000) => {
      dispatch(
        addNotification({
          type: "info",
          message,
          duration,
        }),
      );
    },
  };
}
