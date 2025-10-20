"use client";

import React from "react";
import { Skeleton, SkeletonLayouts } from "@/components/ui/Skeleton";
import {
  LoadingSpinner,
  InlineSpinner,
  LoadingDots,
  LoadingPulse,
} from "@/components/ui/LoadingSpinner";
import {
  LoadingOverlay,
  LoadingSection,
  LoadingTable,
  LoadingPage,
} from "@/components/ui/LoadingOverlay";
import { useLoading, useScopedLoading } from "@/hooks/useLoading";

export default function LoadingDemoPage() {
  const { isLoading, startLoading, stopLoading } = useLoading();
  const { isLoading: isLocalLoading, withLoading } = useScopedLoading();
  const [showOverlay, setShowOverlay] = React.useState(false);

  const handleGlobalLoading = () => {
    startLoading("Processing global action...");
    setTimeout(stopLoading, 3000);
  };

  const handleLocalLoading = withLoading(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  const handleOverlayTest = () => {
    setShowOverlay(true);
    setTimeout(() => setShowOverlay(false), 3000);
  };

  return (
    <div className="container mx-auto py-8 space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-2">Loading States Demo</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive demonstration of all loading components and states
        </p>
      </div>

      {/* Loading Spinners */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading Spinners</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sizes */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Sizes</h3>
            <div className="flex items-center gap-4">
              <LoadingSpinner size="xs" />
              <LoadingSpinner size="sm" />
              <LoadingSpinner size="md" />
              <LoadingSpinner size="lg" />
              <LoadingSpinner size="xl" />
            </div>
          </div>

          {/* Variants */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Variants</h3>
            <div className="space-y-2">
              <LoadingSpinner variant="primary" showLabel label="Primary" />
              <LoadingSpinner variant="secondary" showLabel label="Secondary" />
            </div>
          </div>

          {/* With Label */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">With Label</h3>
            <LoadingSpinner size="lg" showLabel label="Loading data..." />
          </div>
        </div>
      </section>

      {/* Inline Indicators */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Inline Indicators</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Inline Spinner */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Inline Spinner</h3>
            <div className="flex items-center gap-2">
              <span>Loading</span>
              <InlineSpinner />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded">
              <InlineSpinner size="sm" className="text-white" />
              Submitting...
            </button>
          </div>

          {/* Loading Dots */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Loading Dots</h3>
            <div className="flex items-center gap-2">
              <span>Processing</span>
              <LoadingDots />
            </div>
          </div>

          {/* Loading Pulse */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Loading Pulse</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <LoadingPulse size="sm" />
                <span className="text-sm">Live</span>
              </div>
              <div className="flex items-center gap-2">
                <LoadingPulse size="md" />
                <span>Syncing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Skeleton Loading */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Skeleton Loading</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Skeletons */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Basic Shapes</h3>
            <Skeleton width="100%" height="20px" />
            <Skeleton width="80%" height="20px" />
            <Skeleton width="60%" height="20px" />
            <Skeleton shape="circle" width={48} height={48} />
          </div>

          {/* Skeleton Layouts */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Pre-built Layouts</h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-2">Card Layout</p>
                <SkeletonLayouts.Card />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">List Item</p>
                <SkeletonLayouts.ListItem />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* More Skeleton Layouts */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Advanced Skeleton Layouts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Avatar */}
          <div className="p-6 border rounded-lg space-y-2">
            <h3 className="font-medium text-sm">Avatar</h3>
            <SkeletonLayouts.Avatar />
          </div>

          {/* Table Row */}
          <div className="p-6 border rounded-lg space-y-2">
            <h3 className="font-medium text-sm">Table Row</h3>
            <SkeletonLayouts.TableRow columns={3} />
          </div>

          {/* Stat Card */}
          <div className="p-6 border rounded-lg space-y-2">
            <h3 className="font-medium text-sm">Stat Card</h3>
            <SkeletonLayouts.StatCard />
          </div>

          {/* Custom */}
          <div className="p-6 border rounded-lg space-y-2">
            <h3 className="font-medium text-sm">Custom</h3>
            <div className="space-y-2">
              <Skeleton width="100%" height="12px" />
              <Skeleton width="90%" height="12px" />
              <Skeleton width="70%" height="12px" />
            </div>
          </div>
        </div>
      </section>

      {/* Complex Loading States */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Complex Loading States</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Loading Section */}
          <div className="border rounded-lg">
            <div className="p-4 border-b">
              <h3 className="font-medium">Loading Section</h3>
            </div>
            <LoadingSection message="Fetching latest data..." />
          </div>

          {/* Loading Table */}
          <div className="border rounded-lg">
            <div className="p-4 border-b">
              <h3 className="font-medium">Loading Table</h3>
            </div>
            <div className="p-4">
              <LoadingTable rows={3} columns={4} />
            </div>
          </div>
        </div>
      </section>

      {/* Loading Overlays */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading Overlays</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Container Overlay */}
          <div className="p-6 border rounded-lg">
            <h3 className="font-medium mb-4">Container Overlay</h3>
            <div className="relative h-48 bg-gray-50 dark:bg-gray-900 rounded">
              <LoadingOverlay isLoading={showOverlay} message="Processing..." />
              <div className="p-4">
                <p>Content with overlay</p>
                <button
                  onClick={handleOverlayTest}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                  disabled={showOverlay}
                >
                  Test Overlay
                </button>
              </div>
            </div>
          </div>

          {/* Global Loading */}
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="font-medium">Global Loading</h3>
            <div className="space-y-2">
              <button
                onClick={handleGlobalLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <InlineSpinner size="sm" className="text-white" />
                    Loading...
                  </span>
                ) : (
                  "Test Global Loading"
                )}
              </button>
              <button
                onClick={handleLocalLoading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                disabled={isLocalLoading}
              >
                {isLocalLoading ? (
                  <span className="flex items-center gap-2">
                    <InlineSpinner size="sm" className="text-white" />
                    Loading...
                  </span>
                ) : (
                  "Test Scoped Loading"
                )}
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Global loading will show fullscreen overlay. Scoped loading is
              button-specific.
            </p>
          </div>
        </div>
      </section>

      {/* Loading Page Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Full Page Loading</h2>
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-medium">Page Skeleton</h3>
          </div>
          <LoadingPage hasHeader hasSidebar />
        </div>
      </section>

      {/* Global Loading Overlay */}
      {isLoading && (
        <LoadingOverlay
          isLoading={isLoading}
          message="Processing global action..."
          fullScreen
          blur
        />
      )}

      {/* Usage Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Usage Examples</h2>
        <div className="p-6 border rounded-lg space-y-4">
          <h3 className="font-medium">Code Examples</h3>
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded">
              <p className="font-mono text-xs mb-2 text-gray-500">
                Basic Spinner
              </p>
              <code className="block">
                &lt;LoadingSpinner size="lg" showLabel label="Loading..." /&gt;
              </code>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded">
              <p className="font-mono text-xs mb-2 text-gray-500">
                Skeleton Card
              </p>
              <code className="block">&lt;SkeletonLayouts.Card /&gt;</code>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded">
              <p className="font-mono text-xs mb-2 text-gray-500">
                Loading Overlay
              </p>
              <code className="block">
                &lt;LoadingOverlay isLoading=&#123;true&#125;
                message="Processing..." fullScreen blur /&gt;
              </code>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded">
              <p className="font-mono text-xs mb-2 text-gray-500">
                useLoading Hook
              </p>
              <code className="block">
                const &#123; isLoading, startLoading, stopLoading &#125; =
                useLoading();
                <br />
                startLoading('Saving...');
                <br />
                // ... async operation ...
                <br />
                stopLoading();
              </code>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
