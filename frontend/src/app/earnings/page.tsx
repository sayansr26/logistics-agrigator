"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageHeader,
  PageContainer,
  StatsCard,
  StatsGrid,
  DataTablePagination,
} from "@/components/shared";
import {
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  useGetOutletEarningsQuery,
  useGetOutletEarningsSummaryQuery,
  type OutletEarningStatus,
} from "@/store/api/endpoints/shipmentApi";
import { useRole } from "@/hooks/useRole";
// Markup is retired — the settings card is hidden so an outlet cannot set a
// defaultMarkup that would revive the OUTLET_DEFAULT fallback in
// markupService.resolveEffectiveMarkup.
// import { MarkupSettingsCard } from "@/components/outlets/markup-settings-card";

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_TABS: { value: "all" | OutletEarningStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ACCRUED", label: "Accrued" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function EarningsPage() {
  const { isRole } = useRole();
  const [statusFilter, setStatusFilter] = useState<"all" | OutletEarningStatus>(
    "all",
  );
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: summaryData, isLoading: summaryLoading } =
    useGetOutletEarningsSummaryQuery();
  const { data, isLoading, error, refetch } = useGetOutletEarningsQuery({
    page,
    limit,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const summary = summaryData?.data?.summary;
  const earnings = data?.data?.earnings || [];
  const pagination = data?.data?.pagination;

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeader
          title="Earnings"
          description="Markup commission accrued from your bookings"
        />

        {/* {isRole("outlet") && <MarkupSettingsCard />} */}

        <StatsGrid columns={3}>
          <StatsCard
            title="Accrued"
            value={formatCurrency(summary?.totalAccrued)}
            description={`${summary?.accruedCount ?? 0} shipments`}
            icon={TrendingUp}
            iconColor="text-green-500"
            isLoading={summaryLoading}
          />
          <StatsCard
            title="Cancelled"
            value={formatCurrency(summary?.totalCancelled)}
            description={`${summary?.cancelledCount ?? 0} shipments`}
            icon={TrendingDown}
            iconColor="text-red-500"
            isLoading={summaryLoading}
          />
          <StatsCard
            title="Month to Date"
            value={formatCurrency(summary?.monthToDate)}
            description={`${summary?.monthToDateCount ?? 0} shipments`}
            icon={CalendarClock}
            iconColor="text-blue-500"
            isLoading={summaryLoading}
          />
        </StatsGrid>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Earnings Ledger</CardTitle>
              <Tabs
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as "all" | OutletEarningStatus);
                  setPage(1);
                }}
              >
                <TabsList>
                  {STATUS_TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Failed to load earnings
                </h3>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : earnings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No earnings found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">
                        System Charge
                      </TableHead>
                      <TableHead className="text-right">Markup</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((earning) => (
                      <TableRow key={earning.id}>
                        <TableCell>
                          <Link
                            href={`/shipments/${earning.shipmentId}`}
                            className="font-medium hover:underline"
                          >
                            {earning.shipment?.orderId || earning.shipmentId}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(earning.createdAt)}
                        </TableCell>
                        <TableCell>
                          {earning.shipment?.partnerName || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(earning.systemCharge)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">
                            {formatCurrency(earning.markupAmount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {earning.markupType === "PERCENTAGE"
                              ? `${earning.markupValue}%`
                              : `Flat ₹${earning.markupValue}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              earning.status === "ACCRUED"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {earning.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {pagination && pagination.totalPages > 1 && (
                  <DataTablePagination
                    currentPage={page}
                    totalPages={pagination.totalPages}
                    onPageChange={setPage}
                    totalItems={pagination.total}
                    pageSize={limit}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </DashboardLayout>
  );
}
