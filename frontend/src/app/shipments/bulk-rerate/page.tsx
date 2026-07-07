"use client";

import { useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  shipmentRerateApi,
  RerateBulkRow,
  BulkRerateReport,
} from "@/services/api/shipment-rerate-api";
import { useAppSelector } from "@/store/hooks";
import { Upload, AlertTriangle, CheckCircle2, FileUp } from "lucide-react";

const PLACEHOLDER = `AWB, New Weight (kg), Length (cm), Width, Height, Courier Charge
TESTAWB001, 5.5, 30, 20, 15, 85
TESTAWB002, 2.0, 20, 15, 10, 45`;

function money(v: number | null | undefined): string {
  return v == null ? "—" : `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

/** Parse pasted CSV lines into re-rate rows (skips a header row if present). */
function parseRows(text: string): RerateBulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: RerateBulkRow[] = [];
  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    if (!parts[0] || /awb/i.test(parts[0])) continue; // skip header/blank
    const [awb, w, l, wd, h, cc] = parts;
    const num = (x?: string) => (x !== undefined && x !== "" && !isNaN(Number(x)) ? Number(x) : undefined);
    rows.push({
      awbNumber: awb,
      newWeight: num(w),
      newLength: num(l),
      newWidth: num(wd),
      newHeight: num(h),
      courierCharge: num(cc),
    });
  }
  return rows;
}

export default function BulkRerentPage() {
  const [raw, setRaw] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<BulkRerateReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accessToken = useAppSelector((s) => s.auth.token);

  const parsed = parseRows(raw);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      setError("Please upload a .csv or .txt file. For Excel, export it as CSV first.");
      return;
    }
    setError(null);
    try {
      const text = await file.text();
      setRaw(text);
      setFileName(file.name);
    } catch {
      setError("Could not read the file.");
    }
  };

  const submit = async () => {
    setError(null);
    setReport(null);
    if (reason.trim().length < 5) {
      setError("Please provide a reason (at least 5 characters).");
      return;
    }
    if (parsed.length === 0) {
      setError("No valid rows parsed. Check the format.");
      return;
    }
    if (!accessToken) {
      setError("Your session is still loading — please try again in a moment.");
      return;
    }
    setSubmitting(true);
    try {
      shipmentRerateApi.setAccessToken(accessToken);
      const res = await shipmentRerateApi.bulkRerate(reason.trim(), parsed);
      setReport(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk re-rate failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Weight &amp; Charge Update</h1>
          <p className="text-muted-foreground">
            Update weight/dimensions/courier charge for many shipments by AWB. Charges are
            recalculated and customer wallets are reconciled automatically.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>
              Paste rows as CSV: <code>AWB, Weight, Length, Width, Height, CourierCharge</code>. A header row is ignored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Reason for update (e.g. courier weight discrepancy)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            {/* Direct file upload (CSV) — drag & drop or click to browse */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-muted/40"
            >
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                {fileName ? `Loaded: ${fileName}` : "Upload a CSV file"}
              </p>
              <p className="text-xs text-muted-foreground">
                Drag &amp; drop or click to browse — or paste rows below
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || undefined)}
              />
            </div>

            <Textarea
              rows={8}
              placeholder={PLACEHOLDER}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                if (fileName) setFileName(null);
              }}
              className="font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {parsed.length} row(s) parsed
              </span>
              <Button onClick={submit} disabled={submitting || parsed.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                {submitting ? "Processing…" : "Process Update"}
              </Button>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {report && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Processing Report
              </CardTitle>
              <CardDescription>
                <Badge className="bg-green-100 text-green-800 mr-2" variant="outline">
                  {report.successCount} succeeded
                </Badge>
                <Badge className="bg-red-100 text-red-800" variant="outline">
                  {report.failureCount} failed
                </Badge>
                <span className="ml-2 text-muted-foreground">of {report.total} total</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {report.successful.length > 0 && (
                <div className="overflow-x-auto">
                  <h3 className="mb-2 text-sm font-semibold">Successful</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>AWB</TableHead>
                        <TableHead className="text-right">Old</TableHead>
                        <TableHead className="text-right">New (Selling)</TableHead>
                        <TableHead className="text-right">Courier Cost</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Δ</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.successful.map((r) => (
                        <TableRow key={r.awbNumber}>
                          <TableCell className="font-medium">{r.awbNumber}</TableCell>
                          <TableCell className="text-right">{money(r.oldCost)}</TableCell>
                          <TableCell className="text-right">{money(r.newCost)}</TableCell>
                          <TableCell className="text-right">{money(r.courierCost)}</TableCell>
                          <TableCell className="text-right">{money(r.profitMargin)}</TableCell>
                          <TableCell className="text-right">{money(r.difference)}</TableCell>
                          <TableCell>
                            {r.holdApplied ? (
                              <Badge className="bg-orange-100 text-orange-800" variant="outline">
                                ON HOLD
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {report.failed.length > 0 && (
                <div className="overflow-x-auto">
                  <h3 className="mb-2 text-sm font-semibold text-red-700">Failed</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>AWB</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.failed.map((r) => (
                        <TableRow key={r.awbNumber}>
                          <TableCell className="font-medium">{r.awbNumber}</TableCell>
                          <TableCell className="text-red-600">{r.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
