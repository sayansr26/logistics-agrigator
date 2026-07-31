import type {
  BulkJobStatus,
  NDRPriority,
  NDRStatusValue,
} from "@/store/api/endpoints/shipmentApi";

/**
 * Badge colours for the real NDRStatus enum defined in
 * backend/shipment-service/prisma/schema.prisma.
 */
export function getNDRStatusColor(status: NDRStatusValue | string): string {
  switch (status) {
    case "OPEN":
      return "bg-yellow-100 text-yellow-800";
    case "ASSIGNED":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-indigo-100 text-indigo-800";
    case "REATTEMPT_SCHEDULED":
      return "bg-purple-100 text-purple-800";
    case "ADDRESS_UPDATED":
      return "bg-cyan-100 text-cyan-800";
    case "RTO_INITIATED":
      return "bg-orange-100 text-orange-800";
    case "RESOLVED":
      return "bg-green-100 text-green-800";
    case "CLOSED":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getNDRPriorityColor(priority: NDRPriority | string): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800";
    case "LOW":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getBulkJobStatusColor(status: BulkJobStatus | string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "PROCESSING":
      return "bg-blue-100 text-blue-800";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "CANCELLED":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Turn an ENUM_VALUE into a human label ("REATTEMPT_SCHEDULED" -> "Reattempt Scheduled")
 */
export function formatEnumLabel(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const NDR_STATUS_VALUES: NDRStatusValue[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "REATTEMPT_SCHEDULED",
  "ADDRESS_UPDATED",
  "RTO_INITIATED",
  "RESOLVED",
  "CLOSED",
];

export const BULK_JOB_STATUS_VALUES: BulkJobStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

/**
 * Format a byte count for display in the bulk upload history table.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format an ISO timestamp in Indian locale, matching the rest of the portal.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
