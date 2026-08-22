"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  PageContainer,
  StatsCard,
  StatsGrid,
} from "@/components/shared";
import {
  Package,
  IndianRupee,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Clock,
  Wallet as WalletIcon,
  Truck,
  Scale,
  AlertTriangle,
  Store,
  Inbox,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import {
  useGetDashboardSummaryQuery,
  useGetDashboardTrendQuery,
  useGetDashboardCouriersQuery,
  useGetDashboardOutletsQuery,
  useGetDashboardAdjustmentsQuery,
} from "@/store/api/endpoints/shipmentApi";
import {
  useGetWalletDashboardSummaryQuery,
  useGetWalletDashboardTrendQuery,
} from "@/store/api/endpoints/walletApi";
import {
  VolumeTrendChart,
  StatusBreakdownChart,
  ShipmentTypeSplitChart,
  WalletTrendChart,
} from "@/components/dashboard/dashboard-charts";
import {
  formatDurationHours,
  formatINR,
  formatNumber,
  formatPercent,
} from "@/components/dashboard/formatters";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { isRole } = useRole();
  const isOutlet = isRole("outlet");
  const [days, setDays] = useState(30);

  // Exactly 7 RTK Query hooks total (5 shipment + 2 wallet). Backend already
  // scopes results server-side by the caller's token, so no client-side
  // filtering or per-row fetches are needed here.
  const { data: summaryData, isLoading: summaryLoading } =
    useGetDashboardSummaryQuery({ days });
  const { data: trendData, isLoading: trendLoading } =
    useGetDashboardTrendQuery({ days });
  const { data: couriersData, isLoading: couriersLoading } =
    useGetDashboardCouriersQuery({ days });
  const { data: outletsData, isLoading: outletsLoading } =
    useGetDashboardOutletsQuery({ days, limit: 10 });
  const { data: adjustmentsData, isLoading: adjustmentsLoading } =
    useGetDashboardAdjustmentsQuery({ days });
  const { data: walletSummaryData, isLoading: walletSummaryLoading } =
    useGetWalletDashboardSummaryQuery({ days });
  const { data: walletTrendData, isLoading: walletTrendLoading } =
    useGetWalletDashboardTrendQuery({ days });

  const summary = summaryData?.data;
  const trend = trendData?.data?.series || [];
  const couriers = couriersData?.data?.couriers || [];
  const topOutletsByVolume = outletsData?.data?.topByVolume || [];
  const adjustments = adjustmentsData?.data?.adjustments || [];
  const walletSummary = walletSummaryData?.data;
  const walletTrend = walletTrendData?.data?.series || [];

  const provisionalMargin =
    (summary?.financials.courierCostPendingCount ?? 0) > 0;
  const totalAdjustmentDiff = adjustments.reduce(
    (sum, a) => sum + Math.abs(a.totalDifference),
    0,
  );

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer>
          <PageHeader
            title="Dashboard"
            description={
              isOutlet
                ? `Welcome back, ${user?.name || ""}`
                : "Operations and financial overview"
            }
            actions={
              <Select
                value={String(days)}
                onValueChange={(v) => setDays(Number(v))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          {/* KPI tiles */}
          <StatsGrid columns={3}>
            <StatsCard
              title={isOutlet ? "Your Shipments" : "Total Shipments"}
              value={formatNumber(summary?.totals.count)}
              description={`Last ${days} days`}
              icon={Package}
              isLoading={summaryLoading}
            />
            <StatsCard
              title="Revenue"
              value={formatINR(summary?.financials.revenue)}
              description={`Last ${days} days`}
              icon={IndianRupee}
              iconColor="text-green-500"
              isLoading={summaryLoading}
            />
            <StatsCard
              title="Profit Margin"
              value={formatINR(summary?.financials.profitMargin)}
              description={
                provisionalMargin
                  ? `Provisional — ${summary?.financials.courierCostPendingCount} shipment(s) pending courier cost`
                  : "Revenue minus courier cost"
              }
              icon={TrendingUp}
              iconColor="text-blue-500"
              isLoading={summaryLoading}
            />
            <StatsCard
              title="On Hold — At Risk"
              value={formatNumber(summary?.exceptions.hold.count)}
              description="Needs attention"
              icon={ShieldAlert}
              iconColor="text-red-500"
              isLoading={summaryLoading}
            />
            <StatsCard
              title="NDR Rate"
              value={formatPercent(summary?.rates.ndr.rate)}
              description={`${formatNumber(summary?.rates.ndr.count)} non-delivery reports`}
              icon={TrendingDown}
              iconColor="text-amber-500"
              isLoading={summaryLoading}
            />
            <StatsCard
              title="RTO Rate"
              value={formatPercent(summary?.rates.rto.rate)}
              description={`${formatNumber(summary?.rates.rto.count)} returned to origin`}
              icon={TrendingDown}
              iconColor="text-orange-500"
              isLoading={summaryLoading}
            />
          </StatsGrid>

          {/* Volume trend + type split */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Shipment Volume Trend</CardTitle>
                <CardDescription>
                  Daily shipments created over the last {days} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <div className="h-[240px] animate-pulse rounded-lg bg-muted" />
                ) : (
                  <VolumeTrendChart data={trend} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>B2B vs B2C</CardTitle>
                <CardDescription>Shipment type split</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="h-[200px] animate-pulse rounded-lg bg-muted" />
                ) : (
                  <ShipmentTypeSplitChart
                    byShipmentType={summary?.byShipmentType || {}}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status breakdown + courier performance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
                <CardDescription>Shipments by lifecycle stage</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="h-[240px] animate-pulse rounded-lg bg-muted" />
                ) : (
                  <StatusBreakdownChart byStatus={summary?.byStatus || {}} />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Courier Performance</CardTitle>
                <CardDescription>
                  Volume, revenue and margin by courier partner
                </CardDescription>
              </CardHeader>
              <CardContent>
                {couriersLoading ? (
                  <div className="h-[160px] animate-pulse rounded-lg bg-muted" />
                ) : couriers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
                    <Truck className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      No courier activity in this window
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">Partner</th>
                          <th className="pb-2 font-medium text-right">
                            Shipments
                          </th>
                          <th className="pb-2 font-medium text-right">
                            Revenue
                          </th>
                          <th className="pb-2 font-medium text-right">
                            Courier Cost
                          </th>
                          <th className="pb-2 font-medium text-right">
                            Margin
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {couriers.map((c) => (
                          <tr
                            key={c.partnerId}
                            className="border-b last:border-0"
                          >
                            <td className="py-2 font-medium">
                              {c.partnerName}
                            </td>
                            <td className="py-2 text-right">
                              {formatNumber(c.shipmentCount)}
                            </td>
                            <td className="py-2 text-right">
                              {formatINR(c.revenue)}
                            </td>
                            <td className="py-2 text-right text-muted-foreground">
                              {formatINR(c.courierCost)}
                            </td>
                            <td className="py-2 text-right font-medium text-green-600 dark:text-green-400">
                              {formatINR(c.margin)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top outlets (admin/client only — meaningless for a single-outlet viewer) */}
          {!isOutlet && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Top Outlets by Volume</CardTitle>
                </div>
                <CardDescription>
                  Highest-volume outlets in the last {days} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {outletsLoading ? (
                  <div className="h-[120px] animate-pulse rounded-lg bg-muted" />
                ) : topOutletsByVolume.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
                    <Store className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      No outlet activity yet
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">Outlet</th>
                          <th className="pb-2 font-medium text-right">
                            Shipments
                          </th>
                          <th className="pb-2 font-medium text-right">
                            Revenue
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {topOutletsByVolume.map((o, i) => (
                          <tr
                            key={o.outletId}
                            className="border-b last:border-0"
                          >
                            <td className="py-2 text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="py-2">
                              {o.outletName ? (
                                <span className="font-medium">
                                  {o.outletName}
                                </span>
                              ) : (
                                // Name lookup failed — show a short id rather
                                // than a blank cell, so the row is still
                                // traceable.
                                <span
                                  className="font-mono text-xs text-muted-foreground"
                                  title={o.outletId}
                                >
                                  {o.outletId.slice(0, 8)}…
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right">
                              {formatNumber(o.shipmentCount)}
                            </td>
                            <td className="py-2 text-right">
                              {formatINR(o.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Wallet section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>
                  {isOutlet ? "Your Wallet Balance" : "Total Wallet Balance"}
                </CardTitle>
                <CardDescription>
                  {isOutlet
                    ? "Current available balance"
                    : `${formatNumber(walletSummary?.wallets.count)} wallet(s) across the platform`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {walletSummaryLoading ? (
                  <div className="h-8 w-32 animate-pulse rounded bg-muted" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-3">
                      <WalletIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {formatINR(walletSummary?.wallets.totalBalance)}
                      </p>
                      {!isOutlet &&
                        (walletSummary?.lowBalance.count ?? 0) > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {walletSummary?.lowBalance.count} wallet(s) below ₹
                            {walletSummary?.lowBalance.threshold}
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top-ups vs Debits</CardTitle>
                <CardDescription>Daily wallet activity trend</CardDescription>
              </CardHeader>
              <CardContent>
                {walletTrendLoading ? (
                  <div className="h-[220px] animate-pulse rounded-lg bg-muted" />
                ) : (
                  <WalletTrendChart data={walletTrend} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Low-balance outlets (admin/client only) */}
          {!isOutlet && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <CardTitle>Low-Balance Wallets</CardTitle>
                </div>
                <CardDescription>
                  Below the ₹{walletSummary?.lowBalance.threshold ?? 500}{" "}
                  threshold — capped at 20
                </CardDescription>
              </CardHeader>
              <CardContent>
                {walletSummaryLoading ? (
                  <div className="h-[100px] animate-pulse rounded-lg bg-muted" />
                ) : (walletSummary?.lowBalance.wallets.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
                    <WalletIcon className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {walletSummary?.wallets.count === 0
                        ? "No wallets yet"
                        : "No wallets below the threshold"}
                    </p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      {walletSummary?.wallets.count === 0
                        ? "Wallets will appear here once outlets are provisioned."
                        : "All wallets are comfortably funded."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">Client</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium text-right">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletSummary?.lowBalance.wallets.map((w) => (
                          <tr key={w.id} className="border-b last:border-0">
                            <td className="py-2">{w.clientCode || w.userId}</td>
                            <td className="py-2">
                              <Badge variant="outline">{w.status}</Badge>
                            </td>
                            <td className="py-2 text-right font-medium text-red-600 dark:text-red-400">
                              {formatINR(w.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Exceptions — needs attention */}
          <Card className="border-amber-300/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <CardTitle>Needs Attention</CardTitle>
              </div>
              <CardDescription>
                Exceptions requiring action in the last {days} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Link
                  href="/shipments?status=HOLD"
                  className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <div className="rounded-full bg-red-100 p-2 dark:bg-red-950">
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {formatNumber(summary?.exceptions.hold.count)}
                    </p>
                    <p className="text-xs text-muted-foreground">On hold</p>
                  </div>
                </Link>

                <Link
                  href="/shipments?bookingStatus=PENDING_BOOKING"
                  className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-950">
                    <Inbox className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {formatNumber(
                        summary?.bookingFailures.pendingBooking.count,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Booking failures
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950">
                    <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {adjustmentsLoading ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : (
                        formatINR(totalAdjustmentDiff)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Weight-dispute adjustments
                      {adjustments.length > 0 &&
                        ` (${formatNumber(adjustments.reduce((s, a) => s + a.count, 0))})`}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average TAT */}
          <StatsGrid columns={3}>
            <StatsCard
              title="Avg. Delivery TAT"
              value={formatDurationHours(summary?.tat.avgHours)}
              description={
                summary?.tat.sampleSize
                  ? `Based on ${formatNumber(summary.tat.sampleSize)} delivered shipment(s)`
                  : "No delivered shipments yet"
              }
              icon={Clock}
              isLoading={summaryLoading}
            />
            <StatsCard
              title="Delivered Rate"
              value={formatPercent(summary?.rates.delivered.rate)}
              description={`${formatNumber(summary?.rates.delivered.count)} delivered`}
              icon={Package}
              iconColor="text-green-500"
              isLoading={summaryLoading}
            />
            <StatsCard
              title="Courier Cost Pending"
              value={formatNumber(summary?.financials.courierCostPendingCount)}
              description="Shipments awaiting confirmed courier cost"
              icon={IndianRupee}
              iconColor="text-muted-foreground"
              isLoading={summaryLoading}
            />
          </StatsGrid>
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
