"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  settlementApi,
  Settlement,
  SettlementAction,
  SettlementStatus,
} from "@/services/api/settlement-api";
import { useAppSelector } from "@/store/hooks";
import { RefreshCw, Wallet, CheckCircle2, Clock, XCircle } from "lucide-react";

const STATUS_STYLES: Record<SettlementStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  FINANCE_VERIFICATION: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  RELEASED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  HOLD: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-gray-200 text-gray-600",
};

// Allowed workflow actions per current status (mirrors settlementService.TRANSITIONS)
const ACTIONS_BY_STATUS: Record<SettlementStatus, SettlementAction[]> = {
  DRAFT: ["verify", "hold", "cancel"],
  FINANCE_VERIFICATION: ["approve", "reject", "hold"],
  APPROVED: ["release", "reject", "hold"],
  RELEASED: [],
  REJECTED: ["reprocess", "cancel"],
  HOLD: ["reprocess", "cancel"],
  CANCELLED: [],
};

const STATUS_FILTERS: Array<SettlementStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "FINANCE_VERIFICATION",
  "APPROVED",
  "RELEASED",
  "HOLD",
  "REJECTED",
  "CANCELLED",
];

function money(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v || 0;
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface SummaryRow {
  status: string;
  count: number;
  totalNetPayable: number;
}

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const accessToken = useAppSelector((s) => s.auth.token);

  const load = useCallback(async () => {
    if (!accessToken) return; // wait for auth token to hydrate before calling APIs
    setLoading(true);
    setError(null);
    try {
      settlementApi.setAccessToken(accessToken);
      const [listRes, summaryRes] = await Promise.all([
        settlementApi.listSettlements(
          statusFilter === "ALL" ? { limit: 50 } : { status: statusFilter, limit: 50 },
        ),
        settlementApi.getReport("settlement-summary"),
      ]);
      setSettlements(listRes.data || []);
      const report = (summaryRes?.data?.report as SummaryRow[]) || [];
      setSummary(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settlements");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (settlement: Settlement, action: SettlementAction) => {
    setActioningId(settlement.id);
    setError(null);
    try {
      const opts: Parameters<typeof settlementApi.actOnSettlement>[1] = { action };
      if (action === "release") {
        // Default to wallet credit unless a mode is already set
        if (!settlement.paymentMode) opts.paymentMode = "WALLET_CREDIT";
      }
      if (action === "reject" || action === "hold") {
        opts.reason = window.prompt(`Reason for ${action}?`) || `${action} via portal`;
      }
      await settlementApi.actOnSettlement(settlement.id, opts);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setActioningId(null);
    }
  };

  const totals = useMemo(() => {
    const released = summary.find((s) => s.status === "RELEASED");
    const pendingStatuses = ["DRAFT", "FINANCE_VERIFICATION", "APPROVED"];
    const pending = summary
      .filter((s) => pendingStatuses.includes(s.status))
      .reduce(
        (acc, s) => ({ count: acc.count + s.count, amount: acc.amount + s.totalNetPayable }),
        { count: 0, amount: 0 },
      );
    const hold = summary.find((s) => s.status === "HOLD");
    return {
      releasedAmount: released?.totalNetPayable || 0,
      releasedCount: released?.count || 0,
      pendingCount: pending.count,
      pendingAmount: pending.amount,
      holdCount: hold?.count || 0,
    };
  }, [summary]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">COD Settlements</h1>
            <p className="text-muted-foreground">
              Reconciled COD remittances and the settlement approval workflow
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Settlement</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{money(totals.pendingAmount)}</div>
              <p className="text-xs text-muted-foreground">{totals.pendingCount} settlement(s) in workflow</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Released</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{money(totals.releasedAmount)}</div>
              <p className="text-xs text-muted-foreground">{totals.releasedCount} paid out</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Hold</CardTitle>
              <XCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.holdCount}</div>
              <p className="text-xs text-muted-foreground">settlement(s) held</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Settlements</CardTitle>
                <CardDescription>Generate, verify, approve and release COD settlements</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SettlementStatus | "ALL")}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Settlement No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total COD</TableHead>
                    <TableHead className="text-right">Adjustments</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No settlements found. Generate one from reconciled COD shipments.
                      </TableCell>
                    </TableRow>
                  )}
                  {settlements.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.settlementNo}</TableCell>
                      <TableCell className="font-mono text-xs">{s.userId.slice(0, 8)}…</TableCell>
                      <TableCell className="text-right">{money(s.totalCod)}</TableCell>
                      <TableCell className="text-right">{money(s.totalAdjustments)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(s.netPayable)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[s.status]} variant="outline">
                          {s.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{s.paymentMode || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(ACTIONS_BY_STATUS[s.status] || []).map((action) => (
                            <Button
                              key={action}
                              size="sm"
                              variant={action === "release" || action === "approve" ? "default" : "outline"}
                              disabled={actioningId === s.id}
                              onClick={() => handleAction(s, action)}
                            >
                              {action}
                            </Button>
                          ))}
                          {(ACTIONS_BY_STATUS[s.status] || []).length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              <Wallet className="inline h-3 w-3 mr-1" />
                              {s.payoutReference || "final"}
                            </span>
                          )}
                        </div>
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
