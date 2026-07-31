/**
 * Error Middleware
 *
 * Redux middleware to intercept RTK Query errors and handle them globally
 * - Display toast notifications for API errors
 * - Handle 401 errors (redirect to login)
 * - Handle 403 errors (show permission denied)
 * - Handle 500 errors (show server error)
 */

import { isAction, isRejectedWithValue, Middleware } from "@reduxjs/toolkit";
import { addNotification } from "../slices/uiSlice";
import {
  parseRTKError,
  isAuthError,
  isAuthorizationError,
  isServerError,
  isNetworkError,
  logError,
} from "@/utils/errorHandler";

/**
 * Error Middleware
 *
 * Intercepts all rejected RTK Query actions and handles errors globally
 */
export const errorMiddleware: Middleware = (store) => (next) => (action) => {
  // Check if this is a rejected action with value (RTK Query error)
  if (isRejectedWithValue(action)) {
    const error = action.payload;

    // Parse error
    const parsedError = parseRTKError(error);

    // Log error in development
    logError(error, "RTK Query Error");

    // Handle different error types
    if (isAuthError(error)) {
      // 401 Unauthorized - owned entirely by baseQueryWithReauth in
      // store/api/baseApi.ts, which refreshes the access token and retries.
      // Showing a toast or redirecting here would fire on every recoverable
      // 401 (including pre-hydration requests) and bounce the user to login.
      // Only when refresh definitively fails does that layer end the session.
      return next(action);
    } else if (isAuthorizationError(error)) {
      // 403 Forbidden - Insufficient permissions
      handleAuthorizationError(store, parsedError);
    } else if (isServerError(error)) {
      // 500+ Server errors
      handleServerError(store, parsedError);
    } else if (isNetworkError(error)) {
      // Network/connection errors
      handleNetworkError(store, parsedError);
    } else {
      // Other errors (validation, not found, etc.)
      handleGenericError(store, parsedError);
    }
  }

  return next(action);
};

/**
 * Handle Authorization Errors (403)
 *
 * - Show permission denied notification
 * - Optionally redirect to access denied page
 */
function handleAuthorizationError(store: any, error: any) {
  // Show notification
  store.dispatch(
    addNotification({
      type: "error",
      message: error.message,
      duration: 7000,
    }),
  );

  // Optionally redirect to access denied page for severe cases
  // Uncomment if you want to redirect to a dedicated access denied page
  // setTimeout(() => {
  //   if (typeof window !== "undefined") {
  //     window.location.href = "/access-denied";
  //   }
  // }, 100);
}

/**
 * Handle Server Errors (500+)
 *
 * - Show server error notification
 * - Log error for monitoring
 */
function handleServerError(store: any, error: any) {
  // Show notification
  store.dispatch(
    addNotification({
      type: "error",
      message: error.message,
      duration: 10000,
    }),
  );

  // In production, send error report to monitoring service
  if (process.env.NODE_ENV === "production") {
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    console.error("Server Error:", error);
  }
}

/**
 * Handle Network Errors
 *
 * - Show network error notification
 * - Suggest checking connection
 */
function handleNetworkError(store: any, error: any) {
  // Show notification
  store.dispatch(
    addNotification({
      type: "error",
      message: error.message,
      duration: 8000,
    }),
  );
}

/**
 * Handle Generic Errors (400, 404, etc.)
 *
 * - Show error notification
 * - Don't redirect or take special action
 */
function handleGenericError(store: any, error: any) {
  // Only show notification for non-validation errors
  // Validation errors are typically shown inline in forms
  if (error.statusCode !== 400) {
    store.dispatch(
      addNotification({
        type: "error",
        message: error.message,
        duration: 6000,
      }),
    );
  }

  // For validation errors, let the form handle display
  // The error is still available in the query/mutation result
}

/**
 * Success Middleware (Optional)
 *
 * Intercepts successful mutations and shows success toast
 * Can be extended to handle specific success cases
 */
export const successMiddleware: Middleware = (store) => (next) => (action) => {
  // Check if action is a fulfilled mutation
  if (isAction(action) && action.type.endsWith("/fulfilled")) {
    // Extract endpoint name from action type
    // Example: "api/createShipment/fulfilled" -> "createShipment"
    const endpointMatch = action.type.match(/\/(\w+)\/fulfilled$/);

    if (endpointMatch) {
      const endpoint = endpointMatch[1];

      // Show success notification for specific mutations
      const successMessages: Record<string, string> = {
        createShipment: "Shipment created successfully",
        updateShipment: "Shipment updated successfully",
        cancelShipment: "Shipment cancelled successfully",
        createUser: "User created successfully",
        updateUser: "User updated successfully",
        deleteUser: "User deleted successfully",
        login: "Welcome back!",
        register: "Account created successfully",
        // Add more success messages as needed
      };

      if (successMessages[endpoint]) {
        store.dispatch(
          addNotification({
            type: "success",
            message: successMessages[endpoint],
            duration: 4000,
          }),
        );
      }
    }
  }

  return next(action);
};

/**
 * Combined Error & Success Middleware
 *
 * Export this to add both middlewares at once
 */
export const apiMiddleware = [errorMiddleware, successMiddleware];
