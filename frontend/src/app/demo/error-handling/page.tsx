/**
 * Error Handling Demo Page
 *
 * Interactive demo to test all error handling features
 * Access: /demo/error-handling
 */

"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useErrorHandler } from "@/components/ErrorBoundary";
import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Bug,
} from "lucide-react";

export default function ErrorHandlingDemoPage() {
  const toast = useToast();
  const throwError = useErrorHandler();
  const [shouldError, setShouldError] = useState(false);

  // Component that throws error when triggered
  const ErrorComponent = () => {
    if (shouldError) {
      throw new Error("Demo component error - This is caught by ErrorBoundary");
    }
    return null;
  };

  const handleToastSuccess = () => {
    toast.success("Operation completed successfully!");
  };

  const handleToastError = () => {
    toast.error("Something went wrong. Please try again.");
  };

  const handleToastWarning = () => {
    toast.warning("Please review your input before submitting.");
  };

  const handleToastInfo = () => {
    toast.info("Your request is being processed.");
  };

  const handleComponentError = () => {
    setShouldError(true);
    // This will cause ErrorComponent to throw, triggering ErrorBoundary
  };

  const handleManualError = () => {
    throwError(new Error("Manually thrown error via useErrorHandler hook"));
  };

  const handleMultipleToasts = () => {
    toast.success("First notification");
    setTimeout(() => toast.info("Second notification"), 500);
    setTimeout(() => toast.warning("Third notification"), 1000);
    setTimeout(() => toast.error("Fourth notification"), 1500);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Error Handling Demo
        </h1>
        <p className="text-gray-600 mt-2">
          Interactive demonstration of the error handling system
        </p>
      </div>

      {/* Hidden error component */}
      <ErrorComponent />

      {/* Toast Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Toast Notifications
          </CardTitle>
          <CardDescription>
            Test different types of toast notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            onClick={handleToastSuccess}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            Success Toast
          </Button>

          <Button
            onClick={handleToastError}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            Error Toast
          </Button>

          <Button
            onClick={handleToastWarning}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700"
          >
            <AlertTriangle className="h-4 w-4" />
            Warning Toast
          </Button>

          <Button
            onClick={handleToastInfo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Info className="h-4 w-4" />
            Info Toast
          </Button>
        </CardContent>
      </Card>

      {/* Multiple Toasts */}
      <Card>
        <CardHeader>
          <CardTitle>Multiple Notifications</CardTitle>
          <CardDescription>
            Test stacked notifications with auto-dismiss
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleMultipleToasts} variant="outline">
            Show 4 Stacked Notifications
          </Button>
        </CardContent>
      </Card>

      {/* Error Boundary Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-red-600" />
            Error Boundary Testing
          </CardTitle>
          <CardDescription>
            Test React ErrorBoundary component (will crash this page)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 mb-2">
              ⚠️ Warning: These buttons will intentionally crash the page to
              demonstrate error recovery.
            </p>
            <p className="text-sm text-red-600">
              You will see the ErrorBoundary fallback UI with "Try Again" and
              "Return to Dashboard" options.
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleComponentError}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Bug className="h-4 w-4" />
              Trigger Component Error
            </Button>

            <Button
              onClick={handleManualError}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Bug className="h-4 w-4" />
              Throw Manual Error
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Error Simulation */}
      <Card>
        <CardHeader>
          <CardTitle>API Error Simulation</CardTitle>
          <CardDescription>
            Simulate API errors (requires backend running)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                To test API error handling:
              </p>
              <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-1">
                <li>Make sure backend services are running</li>
                <li>Try logging out and back in (tests 401 handling)</li>
                <li>Try accessing restricted features (tests 403 handling)</li>
                <li>Try creating invalid data (tests validation errors)</li>
                <li>
                  Disconnect internet and make API call (tests network errors)
                </li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">
                  401 - Unauthorized
                </h4>
                <p className="text-xs text-gray-600 mb-2">
                  Delete auth token and make API request
                </p>
                <p className="text-xs text-gray-500">
                  Result: Redirect to login with toast
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">403 - Forbidden</h4>
                <p className="text-xs text-gray-600 mb-2">
                  Access restricted endpoint
                </p>
                <p className="text-xs text-gray-500">
                  Result: Permission denied toast
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">
                  500 - Server Error
                </h4>
                <p className="text-xs text-gray-600 mb-2">
                  Trigger backend error
                </p>
                <p className="text-xs text-gray-500">
                  Result: Server error toast
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Network Error</h4>
                <p className="text-xs text-gray-600 mb-2">
                  Disconnect and make request
                </p>
                <p className="text-xs text-gray-500">
                  Result: Network error toast
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            For detailed information about the error handling system, see:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                frontend/ERROR_HANDLING_GUIDE.md
              </code>
              - Complete usage guide
            </li>
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                FE-006_IMPLEMENTATION_SUMMARY.md
              </code>
              - Implementation summary
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
