"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  X as XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusChip } from "@/components/wallet/payment-status-chip";
import { ApprovalDecisionDialog } from "@/components/wallet/approval-decision-dialog";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { cn, formatINR } from "@/lib/utils";
import { useGetManualTopupsQuery } from "@/store/api/endpoints/paymentApi";
import type {
  ManualTopupRequestData,
  ManualTopupStatus,
} from "@/store/api/endpoints/paymentApi";

const PAGE_SIZE = 20;

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface DecisionState {
  open: boolean;
  action: "approve" | "reject" | null;
  approval: ManualTopupRequestData | null;
}

const CLOSED_DECISION: DecisionState = {
  open: false,
  action: null,
  approval: null,
};

export interface TopupApprovalsTabProps {
  /** Maps `walletUserId` -> outlet display name. Falls back to the raw id when missing. */
  outletMap?: Record<string, string>;
}

/**
 * Admin queue for reviewing manual (offline) wallet top-up requests.
 *
 * Self-contained: fetches its own data via `useGetManualTopupsQuery` and only
 * needs an optional `outletMap` for friendlier customer names. Wrapped in a
 * `PermissionGuard` for defence in depth - the real gate is server-side.
 */
export function TopupApprovalsTab({ outletMap = {} }: TopupApprovalsTabProps) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ManualTopupStatus | "">(
    "PENDING_APPROVAL",
  );
  const [decision, setDecision] = useState<DecisionState>(CLOSED_DECISION);

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetManualTopupsQuery({
    page,
    size: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const requests = data?.data ?? [];
  const pagination = data?.pagination;

  const openDecision = (
    action: "approve" | "reject",
    approval: ManualTopupRequestData,
  ) => setDecision({ open: true, action, approval });

  const closeDecision = () => setDecision(CLOSED_DECISION);

  const handleDone = () => {
    closeDecision();
    refetch();
  };

  return (
    <PermissionGuard module="wallet" action="approve" scope="all" hideOnDenied>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              <span>Top-up Approvals</span>
              {pagination?.total_elements != null && (
                <Badge variant="secondary" className="ml-2">
                  {pagination.total_elements} total
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter || "all"}
                onValueChange={(v) => {
                  setStatusFilter(v === "all" ? "" : (v as ManualTopupStatus));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">
                    Pending Approval
                  </SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CREDITED">Credited</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => refetch()}
                title="Refresh"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isFetching && "animate-spin")}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : queryError ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Failed to load top-up requests
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No top-up requests found.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requested</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>External Ref</TableHead>
                      <TableHead>Requested by</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(req.requestedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {outletMap[req.walletUserId] ?? req.walletUserId}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatINR(req.amount)}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <span
                            className="block truncate text-sm"
                            title={req.reason}
                          >
                            {req.reason || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {req.externalReference || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {req.requestedBy}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusChip status={req.status} />
                          {req.status !== "PENDING_APPROVAL" &&
                            (req.reviewedBy || req.reviewRemarks) && (
                              <div className="mt-1 max-w-[200px] text-[11px] text-muted-foreground">
                                {req.reviewedBy && (
                                  <span>by {req.reviewedBy}</span>
                                )}
                                {req.reviewRemarks && (
                                  <div
                                    className="truncate"
                                    title={req.reviewRemarks}
                                  >
                                    {req.reviewRemarks}
                                  </div>
                                )}
                              </div>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "PENDING_APPROVAL" && (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                                onClick={() => openDecision("approve", req)}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                                onClick={() => openDecision("reject", req)}
                              >
                                <XIcon className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {pagination.current_page + 1} of {pagination.total_pages}{" "}
                  ({pagination.total_elements} total)
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={!pagination.has_previous}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.has_next}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {decision.action && (
          <ApprovalDecisionDialog
            open={decision.open}
            action={decision.action}
            approval={decision.approval}
            onClose={closeDecision}
            onDone={handleDone}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
