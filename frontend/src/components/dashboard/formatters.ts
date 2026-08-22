/**
 * Formatting helpers for the operations dashboard — India-locale currency,
 * compact counts, and short date ticks for chart axes.
 */

export function formatINR(amount: number | null | undefined): string {
  const value =
    typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatCompactINR(amount: number | null | undefined): string {
  const value =
    typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  const v = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat("en-IN").format(v);
}

export function formatPercent(value: number | null | undefined): string {
  const v = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  return `${v.toFixed(1)}%`;
}

/** "2026-08-22" -> "22 Aug" for compact chart axis ticks. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** Avg TAT hours -> "1d 4h" / "6h" for a KPI tile. */
export function formatDurationHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  const totalHours = Math.round(hours);
  const days = Math.floor(totalHours / 24);
  const rem = totalHours % 24;
  if (days > 0) return `${days}d ${rem}h`;
  return `${rem}h`;
}

/** Human labels for the shipment status enum returned by the summary endpoint. */
export const STATUS_LABELS: Record<string, string> = {
  CREATED: "Created",
  BOOKED: "Booked",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RTO: "RTO",
  NDR: "NDR",
  HOLD: "Hold",
};
