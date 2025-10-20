/**
 * Error Fallback Component
 *
 * User-friendly error display with reset functionality
 * Shown by ErrorBoundary when React component errors occur
 */

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

interface ErrorFallbackProps {
  error: Error | null;
  resetError?: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An unexpected error occurred while rendering this page. Our team has
            been notified.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* User-friendly message */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              {error?.message || "An unexpected error occurred"}
            </p>
          </div>

          {/* Error details (development only) */}
          {isDevelopment && error && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-gray-700">
                Error Details (Development Only)
              </h3>
              <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg overflow-auto max-h-64">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                  {error.stack || error.toString()}
                </pre>
              </div>
            </div>
          )}

          {/* Support information */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-sm text-blue-900 mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-blue-800">
              If this problem persists, please contact our support team with the
              error details above.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          {resetError && (
            <Button
              onClick={resetError}
              variant="default"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button
            onClick={() => (window.location.href = "/dashboard")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Minimal Error Fallback (for small components)
 */
export function MinimalErrorFallback({
  error,
  resetError,
}: ErrorFallbackProps) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-900">Error</h3>
          <p className="text-sm text-red-800 mt-1">
            {error?.message || "Something went wrong"}
          </p>
          {resetError && (
            <Button
              onClick={resetError}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
