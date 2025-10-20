/**
 * Error Boundary Component
 *
 * React error boundary to catch component errors and display fallback UI
 * Wraps the entire application to provide graceful error handling
 */

"use client";

import React, { Component, ReactNode } from "react";
import { ErrorFallback } from "./ErrorFallback";
import { logError, createErrorReport } from "@/utils/errorHandler";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary Class Component
 *
 * Catches errors in child components and displays fallback UI
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method called when error is thrown in child component
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called after error is caught
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    logError(error, "ErrorBoundary");

    // Create error report
    const errorReport = createErrorReport(error, {
      componentStack: errorInfo.componentStack,
    });

    // Log error report (in production, send to error tracking service)
    if (process.env.NODE_ENV === "production") {
      // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
      console.error("Error Report:", errorReport);
    } else {
      console.error("Error caught by ErrorBoundary:", error);
      console.error("Component Stack:", errorInfo.componentStack);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reset error state to retry rendering
   */
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.resetError);
      }

      // Default fallback UI
      return (
        <ErrorFallback error={this.state.error} resetError={this.resetError} />
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

/**
 * Higher-Order Component to wrap any component with ErrorBoundary
 *
 * Usage:
 * const SafeComponent = withErrorBoundary(MyComponent);
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, resetError: () => void) => ReactNode,
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Hook to manually throw errors to ErrorBoundary
 *
 * Usage:
 * const throwError = useErrorHandler();
 * throwError(new Error("Something went wrong"));
 */
export function useErrorHandler() {
  const [, setError] = React.useState();

  return React.useCallback(
    (error: Error) => {
      setError(() => {
        throw error;
      });
    },
    [setError],
  );
}
