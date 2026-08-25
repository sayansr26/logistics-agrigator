"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaymentStatusChip } from "@/components/wallet/payment-status-chip";
import { CopyButton } from "@/components/wallet/copy-button";
import { useToast } from "@/components/ui/toast";
import { cn, extractApiError, formatINR } from "@/lib/utils";
import {
  useCancelPaymentLinkMutation,
  useGetPaymentLinksQuery,
  useRefreshPaymentLinkMutation,
} from "@/store/api/endpoints/paymentApi";
import type { PaymentLinkData } from "@/store/api/endpoints/paymentApi";

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

export interface PaymentLinksTabProps {
  /** Maps `walletUserId` -> outlet display name. Falls back to the raw id when missing. */
  outletMap?: Record<string, string>;
}

/**
 * Admin table of Razorpay payment links generated for top-ups.
 *
 * Self-contained: fetches its own data via `useGetPaymentLinksQuery` and only
 * needs an optional `outletMap` for friendlier customer names.
 */
export function PaymentLinksTab({ outletMap = {} }: PaymentLinksTabProps) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [cancelTarget, setCancelTarget] = useState<PaymentLinkData | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetPaymentLinksQuery({
    page,
    size: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const [refreshLink, { isLoading: refreshing }] =
    useRefreshPaymentLinkMutation();
  const [cancelLink, { isLoading: cancelling }] =
    useCancelPaymentLinkMutation();

  const links = data?.data ?? [];
  const pagination = data?.pagination;

  const handleRefresh = async (orderId: string) => {
    setError(null);
    try {
      await refreshLink(orderId).unwrap();
      toast.success("Payment link status refreshed");
    } catch (err: any) {
      setError(extractApiError(err, "Failed to refresh payment link"));
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setError(null);
    try {
      await cancelLink(cancelTarget.orderId).unwrap();
      toast.success("Payment link cancelled");
      setCancelTarget(null);
    } catch (err: any) {
      setError(extractApiError(err, "Failed to cancel payment link"));
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            <span>Payment Links</span>
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
                setStatusFilter(v === "all" ? "" : v);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
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
          {error && (
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : queryError ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                Failed to load payment links
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
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <Link2 className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No payment links yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.orderId}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(link.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {outletMap[link.walletUserId] ?? link.walletUserId}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatINR(link.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <PaymentStatusChip status={link.uiStatus} />
                          {link.needsAttention && (
                            <span
                              title="Captured but the wallet credit is still reconciling"
                              className="inline-flex items-center text-amber-600 dark:text-amber-400"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(link.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[220px] items-center gap-1">
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {link.shortUrl}
                          </span>
                          <CopyButton
                            value={link.shortUrl}
                            label="Copy link"
                            size="icon"
                          />
                          <a
                            href={link.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            title="Open link"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {link.createdBy}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={refreshing}
                            onClick={() => handleRefresh(link.orderId)}
                            title="Refresh status"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          {link.uiStatus === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-red-600"
                              onClick={() => setCancelTarget(link)}
                              title="Cancel link"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
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
                Page {pagination.current_page + 1} of {pagination.total_pages} (
                {pagination.total_elements} total)
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

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel payment link?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  This will cancel the {formatINR(cancelTarget.amount)} payment
                  link for{" "}
                  {outletMap[cancelTarget.walletUserId] ??
                    cancelTarget.walletUserId}
                  . The payer will no longer be able to use it.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? "Cancelling..." : "Cancel link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
