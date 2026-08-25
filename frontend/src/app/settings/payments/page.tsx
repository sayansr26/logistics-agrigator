"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageContainer, PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetPaymentProvidersQuery,
  useGetTopupPolicyQuery,
} from "@/store/api/endpoints/paymentApi";
import { ProviderConfigCard } from "@/components/settings/payments/provider-config-card";

const customBreadcrumbs = [
  { title: "Dashboard", href: "/dashboard" },
  { title: "Settings", href: "/settings" },
  { title: "Payments" },
];

export default function PaymentSettingsPage() {
  const {
    data: providers,
    isLoading: providersLoading,
    error: providersError,
    refetch: refetchProviders,
  } = useGetPaymentProvidersQuery();
  const {
    data: policy,
    isLoading: policyLoading,
    error: policyError,
    refetch: refetchPolicy,
  } = useGetTopupPolicyQuery();

  const isLoading = providersLoading || policyLoading;
  const error = providersError || policyError;
  const razorpay = providers?.find((p) => p.provider === "razorpay");

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <PermissionGuard
        module="settings"
        action="manage"
        scope="all"
        deniedMessage="You need admin privileges to manage payment providers."
      >
        <PageContainer>
          <PageHeader
            title="Payment Providers"
            description="Configure the payment gateway used for wallet top-ups."
          />

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[420px] w-full rounded-xl" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <div>
                  <h3 className="text-lg font-semibold">
                    Failed to load payment provider settings
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    refetchProviders();
                    refetchPolicy();
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : !razorpay ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Razorpay is not configured on the server yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ProviderConfigCard config={razorpay} policy={policy} />
          )}
        </PageContainer>
      </PermissionGuard>
    </DashboardLayout>
  );
}
