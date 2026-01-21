import { baseApi } from "../baseApi";

/**
 * Logs API Endpoints
 *
 * All logs endpoints route through API Gateway (port 3001)
 * with automatic JWT token management.
 */

// ===========================
// Request/Response Interfaces
// ===========================

export interface AuditEvent {
  id: string;
  service: string;
  timestamp: string;
  userId: string | null;
  clientId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface RuntimeLogLine {
  service: string;
  file: string;
  line: number;
  parsed: {
    timestamp: string | null;
    level: string | null;
    message: string;
    service?: string;
  } | null;
  raw: string | null;
}

export interface LogsPagination {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface LogsResponse<T> {
  status: "success" | "error";
  data: T;
  pagination?: LogsPagination;
  meta?: {
    service?: string;
    gateway?: boolean;
    timestamp: string;
    servicesQueried?: number;
    [key: string]: unknown;
  };
}

export interface LogsQueryParams {
  limit?: number;
  cursor?: string;
  startDate?: string;
  endDate?: string;
  action?: string;
  resource?: string;
  userId?: string;
  clientId?: string;
  search?: string;
  service?: string;
  file?: string;
  level?: string;
}

// ===========================
// RTK Query API Definition
// ===========================

export const logsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get Admin Audit Logs - System-wide audit logs (superadmin only)
     */
    getAdminAuditLogs: builder.query<
      LogsResponse<AuditEvent[]>,
      LogsQueryParams
    >({
      query: (params) => ({
        url: "/api/v1/admin/audit-logs",
        params,
      }),
      providesTags: ["AuditLog"],
    }),

    /**
     * Get Admin Runtime Logs - System-wide runtime logs (superadmin only)
     */
    getAdminRuntimeLogs: builder.query<
      LogsResponse<
        RuntimeLogLine[] | Array<{ service: string; logs: RuntimeLogLine[] }>
      >,
      LogsQueryParams
    >({
      query: (params) => ({
        url: "/api/v1/admin/runtime-logs",
        params,
      }),
      providesTags: ["RuntimeLog"],
    }),

    /**
     * Get Client Audit Logs - Client-scoped audit logs
     */
    getClientAuditLogs: builder.query<
      LogsResponse<AuditEvent[]>,
      LogsQueryParams
    >({
      query: (params) => ({
        url: "/api/v1/audit-logs",
        params,
      }),
      providesTags: (result, error, arg) => [
        "AuditLog",
        { type: "AuditLog" as const, id: `client-${arg.clientId}` },
      ],
    }),
  }),
});

// ===========================
// Export Hooks
// ===========================

export const {
  useGetAdminAuditLogsQuery,
  useGetAdminRuntimeLogsQuery,
  useGetClientAuditLogsQuery,
} = logsApi;
