"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { extractApiError, extractApiErrorCode } from "@/lib/utils";
import { useImportQrCollectionsCsvMutation } from "@/store/api/endpoints/qrCollectionApi";
import type {
  ImportQrCollectionsCsvResponse,
  QrCsvParseError,
} from "@/store/api/endpoints/qrCollectionApi";

export interface QrImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a real (non-dry-run) import completes so the caller can refetch the ledger. */
  onImported?: () => void;
}

/**
 * CSV import for static-QR bank-credit collections (settlement files from the
 * bank/PSP). Always previews with `dryRun: true` first so an operator can see
 * the report before committing - re-running the same file is safe by design
 * (duplicates are skipped, not rejected), so the UI leans on that rather than
 * treating `skipped` as a failure signal.
 */
export function QrImportDialog({
  open,
  onClose,
  onImported,
}: QrImportDialogProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csv, setCsv] = useState("");
  const [report, setReport] = useState<ImportQrCollectionsCsvResponse | null>(
    null,
  );
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noRowsErrors, setNoRowsErrors] = useState<QrCsvParseError[] | null>(
    null,
  );

  const [runImport, { isLoading }] = useImportQrCollectionsCsvMutation();

  const reset = () => {
    setCsv("");
    setReport(null);
    setCommitted(false);
    setError(null);
    setNoRowsErrors(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setReport(null);
    setError(null);
    setNoRowsErrors(null);
    // Allow re-picking the same file later.
    e.target.value = "";
  };

  const runDryRun = async () => {
    setError(null);
    setNoRowsErrors(null);
    setReport(null);
    try {
      const res = await runImport({ csv, dryRun: true }).unwrap();
      setReport(res);
    } catch (err) {
      const code = extractApiErrorCode(err);
      if (code === "CSV_NO_ROWS") {
        const details = (err as any)?.data?.error?.details;
        setNoRowsErrors(Array.isArray(details) ? details : []);
        setError(
          extractApiError(
            err,
            "The CSV had no parseable rows - check the file below.",
          ),
        );
      } else {
        setError(extractApiError(err, "Failed to preview the import"));
      }
    }
  };

  const runCommit = async () => {
    setError(null);
    try {
      const res = await runImport({ csv, dryRun: false }).unwrap();
      setReport(res);
      setCommitted(true);
      toast.success(
        `Imported ${res.successCount} collection${res.successCount === 1 ? "" : "s"} (${res.duplicateCount} duplicate${res.duplicateCount === 1 ? "" : "s"} skipped).`,
      );
      onImported?.();
    } catch (err) {
      setError(extractApiError(err, "Failed to import"));
    }
  };

  const mergedErrors = report?.errors ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import QR collections from CSV</DialogTitle>
          <DialogDescription>
            Paste or upload a settlement CSV. Preview it first (dry run) - the
            file isn&apos;t written until you click Import.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Re-importing the same settlement file is safe by design - rows
            already on record are skipped as duplicates, not rejected. A high
            &ldquo;skipped&rdquo; count is normal, not a failure.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="qr-csv-input">CSV content</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleFilePick}
            >
              <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
              Upload file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <Textarea
            id="qr-csv-input"
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setReport(null);
              setError(null);
              setNoRowsErrors(null);
            }}
            placeholder={
              "utr,amount,qrIdentifier,payerVpa,payerName,txnAt,providerTxnId\n2026082512345678,499.00,QR001,ramesh@okhdfc,Ramesh Kumar,2026-08-25T10:15:00Z,TXN123"
            }
            className="min-h-[160px] font-mono text-xs"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {noRowsErrors && noRowsErrors.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Parse errors
            </p>
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {noRowsErrors.map((e, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 border-b px-3 py-1.5 text-xs last:border-b-0"
                >
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    line {e.line}
                  </Badge>
                  <span className="text-muted-foreground">{e.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <ReportStat label="Rows parsed" value={report.parsedRows} />
              <ReportStat
                label={committed ? "Imported" : "Would import"}
                value={report.successCount}
                tone="emerald"
              />
              <ReportStat
                label="Duplicates"
                value={report.duplicateCount}
                tone="slate"
              />
              <ReportStat
                label="Unmatched"
                value={report.unmatchedCount}
                tone={report.unmatchedCount > 0 ? "amber" : undefined}
              />
              <ReportStat
                label="Failed"
                value={report.failureCount}
                tone={report.failureCount > 0 ? "red" : undefined}
              />
              <ReportStat
                label="Parse errors"
                value={report.parseErrorCount}
                tone={report.parseErrorCount > 0 ? "red" : undefined}
              />
            </div>

            {report.duplicateCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                {report.duplicateCount} row
                {report.duplicateCount === 1 ? "" : "s"} already on record -
                skipped as a duplicate, not a failure. This is expected when
                re-importing the same file.
              </p>
            )}

            {mergedErrors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Row errors ({mergedErrors.length})
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {mergedErrors.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 border-b px-3 py-1.5 text-xs last:border-b-0"
                    >
                      <Badge
                        variant="outline"
                        className={
                          e.scope === "PARSE"
                            ? "shrink-0 text-[10px] border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                            : "shrink-0 text-[10px] border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                        }
                      >
                        {e.scope === "PARSE"
                          ? `line ${e.line ?? "?"}`
                          : `#${e.index ?? "?"}${e.utr ? ` · ${e.utr}` : ""}`}
                      </Badge>
                      <span className="text-muted-foreground">{e.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {committed && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Import complete. Close this dialog to see the new rows in the
                  ledger.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            {committed ? "Done" : "Cancel"}
          </Button>
          {!committed && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading || !csv.trim()}
                onClick={runDryRun}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileUp className="mr-2 h-4 w-4" />
                Preview (dry run)
              </Button>
              <Button
                type="button"
                disabled={isLoading || !csv.trim() || !report}
                onClick={runCommit}
                title={
                  !report
                    ? "Run a preview first"
                    : "Write these rows to the ledger"
                }
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "slate" | "red" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "slate"
        ? "text-muted-foreground"
        : tone === "amber"
          ? "text-amber-600 dark:text-amber-400"
          : tone === "red"
            ? "text-red-600 dark:text-red-400"
            : "text-foreground";
  return (
    <div className="rounded-md border p-2.5 text-center">
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
