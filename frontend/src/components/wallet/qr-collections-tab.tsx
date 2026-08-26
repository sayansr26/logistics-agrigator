"use client";

import { useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCw,
  Repeat,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { QrImportDialog } from "@/components/wallet/qr-import-dialog";
import { cn, formatINR } from "@/lib/utils";
import { useGetQrCollectionsQuery } from "@/store/api/endpoints/qrCollectionApi";
import type {
  QrCollectionSource,
  QrCollectionStatus,
} from "@/store/api/endpoints/qrCollectionApi";

const PAGE_SIZE = 20;

const STATUSES: QrCollectionStatus[] = [
  "UNATTRIBUTED",
  "ASSIGN_PENDING",
  "ATTRIBUTED",
  "CREDIT_PENDING",
  "CREDITED",
  "REJECTED",
  "IGNORED",
];

const SOURCES: QrCollectionSource[] = ["WEBHOOK", "IMPORT", "MANUAL", "POLL"];

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

export interface QrCollectionsTabProps {
  /** Maps `walletUserId` -> outlet display name. Falls back to the raw id when missing. */
  outletMap?: Record<string, string>;
}

/**
 * Admin ledger of every inbound static-QR bank credit, matched or not. This
 * is the raw feed the "Unattributed" queue is filtered from - it exists so
 * an operator can see the full picture (including already-credited rows) and
 * bulk-load a settlement file via CSV import.
 */
export function QrCollectionsTab({ outletMap = {} }: QrCollectionsTabProps) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<QrCollectionStatus | "">("");
  const [sourceFilter, setSourceFilter] = useState<QrCollectionSource | "">("");
  const [utrFilter, setUtrFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetQrCollectionsQuery({
    page,
    size: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(utrFilter.trim() ? { utr: utrFilter.trim() } : {}),
    ...(dateFrom ? { startDate: dateFrom } : {}),
    ...(dateTo ? { endDate: dateTo } : {}),
  });

  const collections = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4" />
              <span>QR Collections</span>
              {pagination?.total_elements != null && (
                <Badge variant="secondary" className="ml-2">
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
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => setImportOpen(true)}
              >
                <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                Import CSV
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={statusFilter || "all"}
                onValueChange={(v) => {
                  setStatusFilter(v === "all" ? "" : (v as QrCollectionStatus));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Source</Label>
              <Select
                value={sourceFilter || "all"}
                onValueChange={(v) => {
                  setSourceFilter(v === "all" ? "" : (v as QrCollectionSource));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">UTR</Label>
              <Input
                placeholder="Search UTR"
                value={utrFilter}
                onChange={(e) => {
                  setUtrFilter(e.target.value);
                  setPage(0);
                }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Received from</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Received to</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                className="h-8 text-sm"
              />
            </div>
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
                Failed to load QR collections
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
              <Inbox className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No QR collections found.
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
                    <TableHead>Outlet</TableHead>
                    <TableHead>QR identifier</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(c.receivedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          {c.utr || "-"}
                          {!c.utr && (
                            <span
                              title="No UTR - a weaker idempotency key, this row cannot auto-credit"
                              className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                            >
                              no UTR
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatINR(c.amount)}
                      </TableCell>
                      <TableCell>
                        {outletMap[c.walletUserId ?? ""] ??
                          c.walletUserId ??
                          "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.qrIdentifier || "-"}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusChip status={c.source} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PaymentStatusChip status={c.status} />
                          {(c.deliveryCount ?? 0) > 1 && (
                            <span
                              title="This provider has redelivered the same webhook more than once - dedupe handled it, but worth a look if it keeps happening"
                              className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-1.5 py-0 text-[10px] font-medium text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-400"
                            >
                              <Repeat className="h-2.5 w-2.5" />
                              delivered {c.deliveryCount}×
                            </span>
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

      <QrImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refetch}
      />
    </div>
  );
}
