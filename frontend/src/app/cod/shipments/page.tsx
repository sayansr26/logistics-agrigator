"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { settlementApi } from "@/services/api/settlement-api";
import { useAppSelector } from "@/store/hooks";
import { RefreshCw, Search, ScanLine, Upload, FileUp } from "lucide-react";

interface CodShipment {
  id: string;
  awbNumber: string;
  orderId: string;
  invoiceNo?: string | null;
  userId: string;
  partnerName?: string | null;
  codAmount: string;
  collectedAmount?: string | null;
  collectionStatus: string;
  reconStatus: string;
  deliveredAt?: string | null;
}

const RECON_STYLES: Record<string, string> = {
  UNRECONCILED: "bg-slate-100 text-slate-700",
  MATCHED: "bg-green-100 text-green-800",
  MISSING: "bg-red-100 text-red-800",
  SHORT: "bg-orange-100 text-orange-800",
  EXCESS: "bg-amber-100 text-amber-800",
  DUPLICATE: "bg-purple-100 text-purple-800",
  MANUAL: "bg-blue-100 text-blue-800",
};

const COLLECTION_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  COLLECTED: "bg-blue-100 text-blue-800",
  REMITTED: "bg-green-100 text-green-800",
};

function money(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v || 0;
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function CodShipmentsPage() {
  const [rows, setRows] = useState<CodShipment[]>([]);
  const [search, setSearch] = useState("");
  const [reconFilter, setReconFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accessToken = useAppSelector((s) => s.auth.token);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      setError("Please upload a .csv or .txt file. For Excel, export it as CSV first.");
      return;
    }
    setError(null);
    try {
      setCsv(await file.text());
      setFileName(file.name);
    } catch {
      setError("Could not read the file.");
    }
  };

  const load = useCallback(async () => {
    if (!accessToken) return; // wait for auth token to hydrate before calling APIs
    setLoading(true);
    setError(null);
    try {
      settlementApi.setAccessToken(accessToken);
      const params: Record<string, string | number> = { limit: 50 };
      if (search) params.search = search;
      if (reconFilter !== "ALL") params.reconStatus = reconFilter;
      const res = await settlementApi.listCodShipments(params);
      setRows((res.data as CodShipment[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load COD shipments");
    } finally {
      setLoading(false);
    }
  }, [search, reconFilter, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const runAutoReconcile = async () => {
    setReconciling(true);
    setError(null);
    setMsg(null);
    try {
      const res = await settlementApi.autoReconcile();
      const summary = (res?.data as { summary?: Record<string, number> })?.summary;
      setMsg(
        summary
          ? `Reconciled — ${Object.entries(summary).map(([k, v]) => `${k}:${v}`).join(", ")}`
          : "Reconciliation complete",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-reconcile failed");
    } finally {
      setReconciling(false);
    }
  };

  const importCsv = async () => {
    setImporting(true);
    setError(null);
    setMsg(null);
    try {
      const res = await settlementApi.importCollectionsCsv(csv);
      const d = res.data;
      setMsg(
        `Imported ${d.successCount}/${d.total} collection(s)` +
          (d.parseErrors && d.parseErrors.length ? `, ${d.parseErrors.length} row(s) skipped` : ""),
      );
      setCsv("");
      setShowImport(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">COD Shipments</h1>
            <p className="text-muted-foreground">
              Delivered COD shipments, courier collections and reconciliation
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport((v) => !v)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Report
            </Button>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={runAutoReconcile} disabled={reconciling}>
              <ScanLine className={`mr-2 h-4 w-4 ${reconciling ? "animate-pulse" : ""}`} />
              Auto Reconcile
            </Button>
          </div>
        </div>

        {showImport && (
          <Card>
            <CardHeader>
              <CardTitle>Import Courier COD Report (CSV)</CardTitle>
              <CardDescription>
                Paste the courier report. Header row with AWB and amount columns required
                (e.g. <code>AWB Number, COD Amount, Collection Date, UTR</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 px-4 py-5 text-center transition-colors hover:border-primary hover:bg-muted/40"
              >
                <FileUp className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {fileName ? `Loaded: ${fileName}` : "Upload courier report (CSV)"}
                </p>
                <p className="text-xs text-muted-foreground">Drag &amp; drop or click — or paste below</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || undefined)}
                />
              </div>
              <Textarea
                rows={6}
                className="font-mono text-sm"
                placeholder={"AWB Number, COD Amount, Collection Date, UTR\nDL123456789, 1250.00, 2026-07-01, UTR-99"}
                value={csv}
                onChange={(e) => {
                  setCsv(e.target.value);
                  if (fileName) setFileName(null);
                }}
              />
              <div className="flex justify-end">
                <Button onClick={importCsv} disabled={importing || csv.trim().length === 0}>
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Importing…" : "Import Collections"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>COD Ledger</CardTitle>
            <CardDescription>Search by AWB / Order / Invoice and filter by reconciliation status</CardDescription>
            <div className="flex gap-2 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search AWB / Order / Invoice"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                />
              </div>
              <Select value={reconFilter} onValueChange={setReconFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Recon status" />
                </SelectTrigger>
                <SelectContent>
                  {["ALL", "UNRECONCILED", "MATCHED", "MISSING", "SHORT", "EXCESS", "DUPLICATE", "MANUAL"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "ALL" ? "All recon statuses" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
            {msg && <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</div>}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>AWB</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">COD Amount</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Collection</TableHead>
                    <TableHead>Reconciliation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No COD shipments found.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.awbNumber}</TableCell>
                      <TableCell>{r.orderId}</TableCell>
                      <TableCell>{r.partnerName || "—"}</TableCell>
                      <TableCell className="text-right">{money(r.codAmount)}</TableCell>
                      <TableCell className="text-right">{r.collectedAmount ? money(r.collectedAmount) : "—"}</TableCell>
                      <TableCell>
                        <Badge className={COLLECTION_STYLES[r.collectionStatus] || ""} variant="outline">
                          {r.collectionStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={RECON_STYLES[r.reconStatus] || ""} variant="outline">
                          {r.reconStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
