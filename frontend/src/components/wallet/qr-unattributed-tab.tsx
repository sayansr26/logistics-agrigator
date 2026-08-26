"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Loader2,
  RefreshCw,
  UserCheck,
  X as XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { usePermission } from "@/hooks/usePermission";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/components/ui/toast";
import {
  cn,
  extractApiError,
  extractApiErrorCode,
  formatINR,
} from "@/lib/utils";
import { QrAssignDialog } from "@/components/wallet/qr-assign-dialog";
import {
  useGetUnattributedQrCollectionsQuery,
  useRejectQrCollectionMutation,
} from "@/store/api/endpoints/qrCollectionApi";
import type {
  QrCollection,
  QrUnattributedReason,
} from "@/store/api/endpoints/qrCollectionApi";

const PAGE_SIZE = 20;
const MIN_REJECT_REMARKS_LENGTH = 10;

const REASON_LABELS: Record<QrUnattributedReason, string> = {
  NO_QR_MATCH: "No matching QR",
  INACTIVE_QR: "Retired QR",
  NO_UTR: "No UTR provided",
};

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

export interface QrUnattributedTabProps {
  /** Maps `walletUserId` -> outlet display name. Falls back to the raw id when missing. */
  outletMap?: Record<string, string>;
}

/**
 * Human review queue for static-QR bank credits the backend couldn't
 * automatically match to an outlet (no QR match, a retired QR, or no UTR to
 * dedupe on). This is where unclaimed money becomes visible and actionable.
 */
export function QrUnattributedTab({ outletMap = {} }: QrUnattributedTabProps) {
  const [page, setPage] = useState(0);
  const [assignTarget, setAssignTarget] = useState<QrCollection | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QrCollection | null>(null);

  const { hasPermission } = usePermission();
  const { isRole } = useRole();
  const canAssign = hasPermission("wallet", "manage", "all");
  const canReject = isRole("superadmin");

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetUnattributedQrCollectionsQuery({
    page,
    size: PAGE_SIZE,
  });

  const collections = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <PermissionGuard module="wallet" action="read" scope="all" hideOnDenied>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4" />
              <span>Unattributed Collections</span>
              {pagination?.total_elements != null && (
                <Badge
                  variant={
                    pagination.total_elements > 0 ? "default" : "secondary"
                  }
                  className={cn(
                    "ml-2",
                    pagination.total_elements > 0 &&
                      "bg-amber-500 text-white hover:bg-amber-600",
                  )}
                >
                  {pagination.total_elements} total
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
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
                  Failed to load unattributed collections
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
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                <UserCheck className="h-10 w-10 text-emerald-500 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nothing waiting on review. Every collection has been matched.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Received</TableHead>
                      <TableHead>UTR</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payer VPA</TableHead>
                      <TableHead>QR identifier</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(c.receivedAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.utr || (
                            <span className="text-amber-600 dark:text-amber-400">
                              no UTR
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatINR(c.amount)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {c.payerVpa || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {c.qrIdentifier || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400"
                          >
                            {c.unattributedReason
                              ? REASON_LABELS[c.unattributedReason]
                              : "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {canAssign && (
                              <Button
                                size="sm"
                                className="h-7 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700"
                                onClick={() => setAssignTarget(c)}
                              >
                                Assign
                              </Button>
                            )}
                            {canReject && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                                onClick={() => setRejectTarget(c)}
                              >
                                <XIcon className="h-3.5 w-3.5 mr-1" />
                                Reject
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

        <QrAssignDialog
          open={!!assignTarget}
          collection={assignTarget}
          onClose={() => setAssignTarget(null)}
          onDone={() => {
            setAssignTarget(null);
            refetch();
          }}
        />

        <RejectDialog
          collection={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null);
            refetch();
          }}
        />
      </div>
    </PermissionGuard>
  );
}

/**
 * Superadmin-only reject flow. Uses a plain `Dialog` (not `AlertDialog`)
 * because it needs an async mutation with mandatory remarks before it can
 * close - the same pattern as `ApprovalDecisionDialog`.
 */
function RejectDialog({
  collection,
  onClose,
  onDone,
}: {
  collection: QrCollection | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rejectCollection, { isLoading }] = useRejectQrCollectionMutation();

  useEffect(() => {
    if (collection) {
      setRemarks("");
      setError(null);
    }
  }, [collection?.id]);

  const open = !!collection;
  const remarksTooShort = remarks.trim().length < MIN_REJECT_REMARKS_LENGTH;

  const handleSubmit = async () => {
    if (!collection || remarksTooShort) return;
    setError(null);
    try {
      await rejectCollection({
        id: collection.id,
        remarks: remarks.trim(),
      }).unwrap();
      toast.success("Collection rejected");
      onDone();
    } catch (err) {
      const code = extractApiErrorCode(err);
      const fallback =
        code === "QR_COLLECTION_HAS_PENDING_REQUEST"
          ? "A top-up request is still open for this collection - reject that request first."
          : "Failed to reject this collection";
      setError(extractApiError(err, fallback));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject collection</DialogTitle>
          <DialogDescription>
            This marks the collection as ignored - it will not be credited to
            any wallet. A note explaining why is required.
          </DialogDescription>
        </DialogHeader>

        {collection && (
          <div className="space-y-2.5 rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground shrink-0">UTR</span>
              <span className="text-right font-mono text-xs">
                {collection.utr || "— (no UTR)"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Amount</span>
              <span className="text-right font-semibold">
                {formatINR(collection.amount)}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="qr-reject-remarks" className="text-xs">
            Remarks{" "}
            <span className="font-normal text-muted-foreground">
              (required, min {MIN_REJECT_REMARKS_LENGTH} characters)
            </span>
          </Label>
          <Textarea
            id="qr-reject-remarks"
            placeholder="Explain why this collection is being rejected..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="min-h-[90px] text-sm"
          />
          <p
            className={`text-xs ${
              remarksTooShort
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            }`}
          >
            {remarks.trim().length}/{MIN_REJECT_REMARKS_LENGTH} characters
            minimum
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isLoading || remarksTooShort}
          >
            {isLoading ? "Rejecting..." : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
