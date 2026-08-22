"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Package,
  Wallet as WalletIcon,
  PieChart as PieIcon,
} from "lucide-react";
import { ChartEmptyState } from "./chart-empty-state";
import {
  formatCompactINR,
  formatINR,
  formatNumber,
  formatShortDate,
  STATUS_LABELS,
} from "./formatters";

// Fixed categorical order — never cycled/reassigned per series identity.
// See dataviz skill: references/color-formula.md
const CHART_1 = "var(--chart-1)"; // blue
const CHART_2 = "var(--chart-2)"; // orange
const CHART_GOOD = "var(--chart-good)";
const CHART_WARNING = "var(--chart-warning)";
const CHART_SERIOUS = "var(--chart-serious)";
const CHART_CRITICAL = "var(--chart-critical)";
const GRID = "var(--chart-grid)";
const AXIS = "var(--chart-axis)";

const tooltipContentStyle = {
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  fontSize: "12px",
  padding: "8px 12px",
};
const tooltipLabelStyle = { color: "hsl(var(--muted-foreground))" };

const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };

// ===========================
// Shipment volume trend
// ===========================

export function VolumeTrendChart({
  data,
}: {
  data: Array<{ date: string; count: number; revenue: number }>;
}) {
  const hasData = data.length > 0 && data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <ChartEmptyState
        icon={Package}
        title="No shipment volume yet"
        description="Once shipments are booked in this window, daily volume will appear here."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_1} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_1} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={axisTick}
          axisLine={{ stroke: AXIS }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(v) => formatShortDate(String(v))}
          formatter={(value: number, name: string) =>
            name === "revenue"
              ? [formatINR(value), "Revenue"]
              : [formatNumber(value), "Shipments"]
          }
        />
        <Area
          type="monotone"
          dataKey="count"
          name="count"
          stroke={CHART_1}
          strokeWidth={2}
          fill="url(#volumeFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ===========================
// Status breakdown (bar)
// ===========================

const STATUS_COLOR: Record<string, string> = {
  CREATED: AXIS,
  BOOKED: CHART_1,
  PICKED_UP: CHART_1,
  IN_TRANSIT: CHART_1,
  OUT_FOR_DELIVERY: CHART_1,
  DELIVERED: CHART_GOOD,
  CANCELLED: AXIS,
  RTO: CHART_SERIOUS,
  NDR: CHART_WARNING,
  HOLD: CHART_CRITICAL,
};

export function StatusBreakdownChart({
  byStatus,
}: {
  byStatus: Record<string, number>;
}) {
  const data = Object.entries(byStatus)
    .map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] || status,
      count,
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return (
      <ChartEmptyState
        icon={Package}
        title="No shipments in this window"
        description="Status breakdown will populate once shipments are created."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: number) => [formatNumber(value), "Shipments"]}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((entry) => (
            <Cell
              key={entry.status}
              fill={STATUS_COLOR[entry.status] || CHART_1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===========================
// B2B vs B2C split (donut)
// ===========================

const TYPE_COLOR: Record<string, string> = {
  B2C: CHART_1,
  B2B: CHART_2,
};

export function ShipmentTypeSplitChart({
  byShipmentType,
}: {
  byShipmentType: Record<string, number>;
}) {
  const data = Object.entries(byShipmentType)
    .map(([type, count]) => ({ type, count }))
    .filter((d) => d.count > 0);

  if (data.length === 0) {
    return (
      <ChartEmptyState
        icon={PieIcon}
        title="No shipment type data yet"
        height={200}
      />
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="type"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={data.length > 1 ? 3 : 0}
            stroke="hsl(var(--card))"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.type} fill={TYPE_COLOR[entry.type] || CHART_1} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number, name: string) => [
              `${formatNumber(value)} (${((value / total) * 100).toFixed(0)}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={24}
            iconType="circle"
            wrapperStyle={{
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===========================
// Wallet top-up vs debit trend
// ===========================

export function WalletTrendChart({
  data,
}: {
  data: Array<{ date: string; topUp: number; debit: number }>;
}) {
  const hasData = data.some((d) => d.topUp > 0 || d.debit > 0);

  if (!hasData) {
    return (
      <ChartEmptyState
        icon={WalletIcon}
        title="No wallet activity yet"
        description="Top-ups and debits will chart here once wallet transactions start flowing."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={axisTick}
          axisLine={{ stroke: AXIS }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatCompactINR(v)}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(v) => formatShortDate(String(v))}
          formatter={(value: number, name: string) => [
            formatINR(value),
            name === "topUp" ? "Top-ups" : "Debits",
          ]}
        />
        <Legend
          iconType="circle"
          formatter={(value) => (value === "topUp" ? "Top-ups" : "Debits")}
          wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
        />
        <Line
          type="monotone"
          dataKey="topUp"
          stroke={CHART_1}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="debit"
          stroke={CHART_2}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
